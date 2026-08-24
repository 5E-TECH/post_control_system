import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import * as ExcelJS from 'exceljs';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { AiFinanceReportSnapshotEntity } from 'src/core/entity/ai-finance-report-snapshot.entity';
import { AiFinanceChatEntity } from 'src/core/entity/ai-finance-chat.entity';
import { AiFinanceConversationEntity } from 'src/core/entity/ai-finance-conversation.entity';
import { ClaudeService } from 'src/infrastructure/ai/claude.service';
import { OrderService } from 'src/api/order/order.service';
import { CashBoxService } from 'src/api/cash-box/cash-box.service';
import { MyLogger } from 'src/logger/logger.service';
import { successRes, catchError } from 'src/infrastructure/lib/response';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';
import config from 'src/config';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';
const PERIODS: Period[] = ['daily', 'weekly', 'monthly', 'yearly'];

// Chiqim source_type'lari (FinancialSource_type — DB'da kichik harf): SQLда
// 'salary','bills','manual_expense'. SELL_PROFIT/MANUAL_INCOME kirim,
// CORRECTION esa tuzatish — chiqim EMAS, hisobga olinmaydi.
const SOURCE_LABEL: Record<string, string> = {
  salary: 'Oyliklar',
  bills: 'Kommunal / hisob-fakturalar',
  manual_expense: "Qo'lda chiqimlar",
};

// KIRIM manba turlari (FinancialSource_type — DB'da kichik harf):
// sell_profit = sotuvdan pochta foydasi, manual_income = qo'lda kirim.
const INCOME_LABEL: Record<string, string> = {
  sell_profit: 'Sotuvdan foyda (pochta marjasi)',
  manual_income: "Qo'lda kirim",
};
const INCOME_SOURCES = ['sell_profit', 'manual_income'];

// Umumiy/manba nomlari — bular HECH QACHON kategoriya bo'lolmaydi (-> "Boshqa").
// AI shundoq nom bersa ham yoki izohning o'zi shunday bo'lsa ham.
const GENERIC_CATEGORY = new Set([
  "qo'lda chiqim",
  'qolda chiqim',
  "qo'lda chiqimlar",
  'qolda chiqimlar',
  'chiqim',
  'chiqimlar',
  'xarajat',
  'xarajatlar',
  "to'lov",
  'tolov',
  'tulov',
  'pul',
  'naqd',
  'boshqa xarajat',
  'manual',
  'manual_expense',
  'other',
  'expense',
]);

// PostgreSQL TO_CHAR formati — davr bo'yicha (Tashkent kun/hafta/oy/yil).
const PERIOD_FMT: Record<Period, string> = {
  daily: 'YYYY-MM-DD',
  weekly: 'IYYY-"W"IW', // ISO hafta
  monthly: 'YYYY-MM',
  yearly: 'YYYY',
};

const PERIOD_UZ: Record<Period, string> = {
  daily: 'kunlik',
  weekly: 'haftalik',
  monthly: 'oylik',
  yearly: 'yillik',
};

// Sana berilmasa — davrga qarab standart oraliq (kun).
const DEFAULT_DAYS: Record<Period, number> = {
  daily: 30,
  weekly: 84,
  monthly: 365,
  yearly: 1825,
};

// ─── YOPIQ (fixed) kategoriya taksonomiyasi ───
// Muammo: erkin matnli kategoriya + bo'laklarni alohida klassifikatsiya = bir
// xil narsa turli nomlar oladi, har izoh yangi kategoriya bo'ladi (50+ maydalash).
// Yechim: AI faqat shu TAYYOR ro'yxatdan RAQAM (indeks) tanlaydi — yangi
// kategoriya o'ylab TOPOLMAYDI. Fragmentatsiya IMKONSIZ, chiqish ancha arzon.
// "Boshqa" HAR DOIM oxirgi element bo'lsin (OTHER_INDEX shunga tayanadi).
const CATEGORY_LABELS = [
  'Ovqat',
  'Transport',
  "Yoqilg'i",
  'Ijara',
  'Kommunal',
  'Aloqa/Internet',
  'Kanstovar',
  "Ta'mirlash",
  'Reklama/Marketing',
  'Soliq',
  'Bank/komissiya',
  "Sovg'a/mehmon",
  'Tozalash',
  'Ombor/qadoqlash',
  'Boshqa',
];
const OTHER_INDEX = CATEGORY_LABELS.length - 1; // "Boshqa"

// Deterministik kalit-so'z old-filtri: aniq (bir ma'noli) izohlarni AI'siz
// kategoriyaga biriktiradi — arzon va izchil. Faqat ISHONCHLI kalitlar (noaniq
// so'z yo'q); topilmasa null -> AI (Haiku) yopiq taksonomiya bilan hal qiladi.
// Tartib muhim: birinchi mos kelgan g'olib.
const CATEGORY_KEYWORDS: Array<{ idx: number; words: string[] }> = [
  {
    idx: 2,
    words: [
      'benzin',
      'benzn',
      'dizel',
      'solyar',
      'metan',
      'propan',
      'ai-92',
      'ai-95',
      'ai92',
      'ai95',
      'yoqilg',
      'zapravka',
      'gaz ball',
    ],
  },
  { idx: 3, words: ['ijara', 'ijra', 'arenda'] },
  {
    idx: 5,
    words: [
      'internet',
      'aloqa',
      'uzmobile',
      'beeline',
      'ucell',
      'mobiuz',
      'simkarta',
      'tarif puli',
    ],
  },
  {
    idx: 8,
    words: [
      'reklama',
      'marketing',
      'target',
      'smm',
      'banner',
      'listovka',
      'bloger',
      'instagram reklama',
    ],
  },
  { idx: 9, words: ['soliq', 'nalog', 'patent'] },
  {
    idx: 10,
    words: [
      'komissiya',
      'komissya',
      'ekvayring',
      'terminal haqi',
      'bank xizmat',
    ],
  },
  { idx: 12, words: ['tozalash', 'uborka', 'farrosh', 'tozalik'] },
  {
    idx: 13,
    words: [
      'ombor',
      'qadoq',
      'upakovka',
      'skotch',
      'karobka',
      'korobka',
      'paket',
      'sklad',
    ],
  },
  {
    idx: 6,
    words: ['kanstavar', 'kanstovar', 'kanselyar', 'ruchka', 'daftar', 'papka'],
  },
  {
    idx: 1,
    words: ['taksi', 'yol kira', 'yolkira', 'yo l kira', 'avtobus', 'dostavka'],
  },
  {
    idx: 0,
    words: [
      'ovqat',
      'ovkat',
      'ovqatlanish',
      'tushlik',
      'obed',
      'nonushta',
      'tamaddi',
      'choy',
      'choyxona',
      'kofe',
      'qahva',
      'kafe',
      'restoran',
      'restaran',
    ],
  },
  {
    idx: 7,
    words: ["ta'mir", 'tamir', 'remont', 'usta ', 'zapchast', 'ehtiyot qism'],
  },
];

// AI kategoriya klasterlash sxemasi — model har izoh uchun yopiq ro'yxatdan
// RAQAM (indeks) qaytaradi; nom KOD tomonда CATEGORY_LABELS'dan olinadi.
const CATEGORY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    // indexes[i] = i-izohning kategoriya indeksi (0..OTHER_INDEX).
    // MUHIM: structured output (json_schema) integer'da minimum/maximum'ni
    // QO'LLAB-QUVVATLAMAYDI (API 400 beradi) — diapazon description'da va
    // system promptda beriladi, chegaradan tashqari qiymatni KOD clamp qiladi.
    indexes: {
      type: 'array',
      items: {
        type: 'integer',
        description: `Kategoriya indeksi (0 dan ${OTHER_INDEX} gacha; noaniq bo'lsa ${OTHER_INDEX} = Boshqa).`,
      },
    },
  },
  required: ['indexes'],
};

const CATEGORY_SYSTEM = `Sen buxgalter yordamchisisan. Har bir xarajat IZOHini quyidagi TAYYOR kategoriya ro'yxatidan AYNAN BITTASIGA biriktir. Faqat ro'yxatdagi RAQAMni (indeks) tanla — YANGI kategoriya O'YLAB TOPMA, ro'yxatdan tashqari nom BERMA.

KATEGORIYALAR:
0) Ovqat — ovqat, tushlik, nonushta, choyxona, restoran, mehmon uchun taom
1) Transport — taksi, yo'l kira, avtobus, yetkazish/dostavka haqi
2) Yoqilg'i — benzin, dizel, gaz(balon), metan, propan, AI-92/95, zapravka
3) Ijara — ofis/do'kon/ombor ijarasi, arenda
4) Kommunal — svet/elektr, suv puli, gaz puli, issiqlik, kommunal to'lov
5) Aloqa/Internet — internet, mobil aloqa, telefon, tarif, simkarta
6) Kanstovar — ruchka, qog'oz, daftar, papka, kanselyariya buyumlari
7) Ta'mirlash — remont, usta, zapchast, ehtiyot qism, tuzatish
8) Reklama/Marketing — reklama, target, SMM, banner, listovka, bloger
9) Soliq — soliq, nalog, patent, davlat yig'imi
10) Bank/komissiya — bank xizmati, komissiya, terminal/ekvayring haqi
11) Sovg'a/mehmon — sovg'a, gul, tug'ilgan kun, mehmon (taomdan tashqari)
12) Tozalash — tozalash, uborka, farrosh, tozalik vositalari
13) Ombor/qadoqlash — qadoqlash, upakovka, skotch, karobka, paket, ombor jihozi
14) Boshqa — yuqoridagilarga umuman tushmasa YOKI izoh bo'sh/tushunarsiz bo'lsa

QOIDALAR:
- IMLO XATO / sinonim / qisqartma / kirill-lotin farqini tushun: "benzn"->2, "ijra"->3, "kanselyariya"->6.
- Bir xil ma'noli turli yozuvlarni AYNAN bitta raqamga biriktir.
- Aniq bir kategoriyaga tushmasa yoki izoh tushunarsiz/bo'sh bo'lsa -> 14 (Boshqa). "Boshqa"ni kam ishlat — imkoni bo'lsa mazmunli kategoriyaga joyla.
- CHIQISH: "indexes" massivi — indexes[i] i-tartibli izohning kategoriya RAQAMI. Massiv uzunligi izohlar soniga TENG va tartibi AYNAN bir xil bo'lsin. Faqat 0..14 oralig'idagi butun sonlar.`;

interface Bucket {
  label: string;
  total: number;
  bySource: Record<string, number>;
}
interface CategoryItem {
  comment: string;
  count: number;
  total: number;
}
interface CategoryMember {
  name: string;
  count: number;
  total: number;
}
interface Category {
  name: string;
  total: number;
  count: number;
  source: string;
  examples: string[];
  items?: CategoryItem[]; // kategoriya ichi: izoh guruhlari (manual_expense/bills)
  members?: CategoryMember[]; // kategoriya ichi: per-hodim (salary — kim qancha oldi)
}

// ─── AI savol-javob (tool-use): model kerakli asboblarni O'ZI chaqiradi ───
const ASK_SYSTEM = `Isming ELCHIN. Sen O'zbekiston yetkazib berish biznesining tajribali moliyaviy tahlilchisi va MASLAHATCHISISAN. O'zingni "Elchin" deb tanishtir; foydalanuvchi senga "Elchin" deb murojaat qiladi. Vazifang — nafaqat raqam aytish, balki biznesni O'STIRISHga yordam berish: trendlarni ko'rsatish, muammolarni belgilash va amaliy tavsiyalar berish.

MA'LUMOT:
- Raqamlarni FAQAT asboblardan ol — o'zing hisoblab yoki to'qib yubormа. Kerakli asbob(lar)ni chaqir.
- Bugungi sana Asia/Tashkent. Sanalarni YYYY-MM-DD formatида uzat. Davr aniq aytilmasa oqilona standart ol (shu oy yoki shu yil). Taqqoslash uchun avvalgi davrni ham olib solishtir.
- Bir nechta raqam kerak bo'lsa bir nechta asbobni chaqir.
- XARAJAT savoli: qo'lda chiqimlar (manual_expense) bitta manba turi ostida, lekin IZOHLARI har xil (turli narsalar). Aniq narsaga qancha ketgani yoki maxsus kategoriya so'ralsa (masalan "benzinga qancha?", "reklama xarajati?") — get_expense_comments bilan IZOHLARni o'QI, imlo xato/sinonimlarni hisobga olib mos qatorlarni jamla va aniq javob ber. Umumiy kategoriya taqsimoti uchun get_expense_categories; turlar (oylik/kommunal/qo'lda) jami uchun get_expenses.
- KIRIM (daromad) savoli: get_income — kirimni TURLAR bo'yicha beradi: "Sotuvdan foyda" (sell_profit — buyurtmalardan pochta marjasi) va "Qo'lda kirim" (manual_income — qo'lда kiritilgan daromad). Qo'lda kirimning IZOHLARI (nimadan kelgani) uchun get_income_comments. Eslatma: get_revenue faqat sotuv/pochta marjasini beradi; umumiy kirimni get_income'dan ol. "Kirim qancha?", "daromad qancha?", "foyda vs xarajat" kabi savollarга get_income (kerak bo'lsa get_expenses bilan birga) ishlat.
- SMENA (kassa smenasi) savoli: "joriy/oxirgi smena", "oldingi smena", "smena hisobi to'g'rimi", "smena bo'yicha kirim/chiqim" — AVVAL get_shifts bilan smenalarni ol (joriy ochiq + oxirgilari), kerakli smenani aniqla (joriy=ochiq, oldingi=oxirgi yopilgan); KEYIN get_shift_transactions bilan o'sha smenaning satr-darajа yozuvlarini ol. MUHIM: smena = aniq SOAT oynasi (opened_at..closed_at), kun EMAS — sana asboblari (get_expenses/get_income) smenaга mos kelmasligi mumkin, smena uchun aynan smena asboblarини ishlat.

JAVOB FORMATI (Markdown — chiroyli va o'qiladigan bo'lsin):
- O'ZBEK tilida. Sonlarni bo'sh joy bilan yoz: **12 500 000 so'm**. Muhim raqamlarni **qalin** qil.
- Taqqoslash yoki bir nechta qatorли ma'lumot bo'lsa — MARKDOWN JADVAL ishlat (| ustun | ustun |). Kategoriya/davr taqsimotini doim jadvalда ber.
- Trend belgilari: 📈 o'sish, 📉 kamayish, ⚠️ e'tibor bering, ✅ yaxshi, 💡 tavsiya.
- Tuzilma: (1) qisqa javob/asosiy raqam; (2) kerak bo'lsa jadval yoki tafsilot; (3) qisqa **💡 Tavsiya** — biznesni o'stirish yoki xarajatni optimallashtirish bo'yicha 1-2 amaliy maslahat (agar ma'noli bo'lsa).
- Ortiqcha uzun yozma; aniq, ishga yaroqli bo'l. Savol moliyaga aloqasiz bo'lsa xushmuomala rad et.
- Taxmin/bashorat aytsang, taxmin ekanini bildir. Raqam TO'QIMA.`;

const ASK_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_revenue',
    description:
      "Davr bo'yicha YALPI foyda (pochta marjasi) va buyurtmalar soni. period + ixtiyoriy sana oralig'i.",
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'yearly'],
        },
        fromDate: { type: 'string', description: 'YYYY-MM-DD' },
        toDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_net_profit',
    description:
      "SOF foyda = yalpi foyda − OpEx (oylik+kommunal+qo'lda chiqim). Ixtiyoriy sana oralig'i.",
    input_schema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'YYYY-MM-DD' },
        toDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_expenses',
    description:
      "XARAJATlar turlar (oylik/kommunal/qo'lda chiqim) bo'yicha taqsimlangan. Ixtiyoriy sana oralig'i.",
    input_schema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'YYYY-MM-DD' },
        toDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_income',
    description:
      "KIRIM (daromad) turlar bo'yicha: 'Sotuvdan foyda' (sell_profit — buyurtmalardan pochta marjasi) va 'Qo'lda kirim' (manual_income). Jami kirim va har tur ulushi. Ixtiyoriy sana oralig'i.",
    input_schema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'YYYY-MM-DD' },
        toDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_income_comments',
    description:
      "Qo'lda kirimlarning (manual_income) IZOHLARI: har xil izoh guruhlari (izoh matni, necha marta, jami summa) — kirim aynan nimadan kelgani. Ixtiyoriy sana oralig'i (berilmasa oxirgi 1 yil).",
    input_schema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'YYYY-MM-DD' },
        toDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_expense_categories',
    description:
      "AI xarajat hisoboti: kategoriya bo'yicha taqsimot, jami va peaks (qaysi davr eng yuqori/past). period beriladi.",
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'yearly'],
        },
      },
    },
  },
  {
    name: 'get_expense_comments',
    description:
      "Qo'lda chiqimlarning (manual_expense) IZOHLARINI o'qish: har xil izoh guruhlari (izoh matni, necha marta, jami summa). Qo'lda chiqimlar bitta manba turi ostida bo'lsa-da izohlari HAR XIL (turli narsalar) — aynan nimaga qancha sarflanganini bilish yoki aniq savolga ('benzinga qancha ketdi?', 'ijara qancha?') javob berish uchun izohlarni O'QIB, imlo xato/sinonimlarni hisobga olib mos qatorlarni JAMLA. Ixtiyoriy sana oralig'i (berilmasa oxirgi 1 yil).",
    input_schema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'YYYY-MM-DD' },
        toDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_cash_position',
    description:
      'HOZIRGI naqd holat: kassa (naqd+karta), kuryerlar jami, marketlar jami, sof pozitsiya. Parametrsiz.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_order_flow',
    description:
      "Buyurtma oqimi: qabul qilingan, bekor qilingan, sotilgan/to'langan soni. Ixtiyoriy sana oralig'i.",
    input_schema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'YYYY-MM-DD' },
        toDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_shifts',
    description:
      "SMENA (kassa smenasi) ro'yxati: hozir OCHIQ smena + oxirgi yopilganlar. Har biri: id, holati (open/closed), ochilish/yopilish vaqti (ms), kim ochgan/yopgan, ochilish/yopilish qoldig'i, smena kirim/chiqimi (yopilganда). 'Joriy/oxirgi smena', 'oldingi smena' so'ralsa AVVAL shuni chaqir — kerakli smena id/oynasini shundan ol.",
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'nechta smena (default 6, max 20)',
        },
      },
    },
  },
  {
    name: 'get_shift_transactions',
    description:
      "Bitta SMENA ichidagi kassa harakatlari SATR-DARAJАDA (aniq SOAT oynasида, kun emas): har yozuv — vaqti, kirim/chiqim, summa, naqd/karta, izoh, kim kiritdi, buyurtma raqami. shift: 'current' (ochiq smena) | 'previous' (oxirgi yopilgan) | aniq smena id. Excel qoralamani platforma bilan SATR-MA-SATR solishtirib xatolarni (tushib qolgan / ikki marta / summa noto'g'ri / naqd-karta adashgan) topish uchun shuni ishlat. Jami subtotal'lar butun smena bo'yicha aniq.",
    input_schema: {
      type: 'object',
      properties: {
        shift: {
          type: 'string',
          description: "'current' | 'previous' | smena id (uuid)",
        },
      },
    },
  },
];

// Fayl (rasm/Excel) tahlili + platforma bilan solishtirib nomuvofiqlik topish.
const ANALYZE_SYSTEM = `${ASK_SYSTEM}

FAYL TAHLILI:
- Foydalanuvchi rasm yoki Excel yuklaydi. Uni diqqat bilan tahlil qil: raqamlar, sanalar, jadval qatorlari, summalar, oraliq jamlar.
- So'ralgan davrga moslab tahlil qil (agar oraliq berilgan bo'lsa faqat shu davr).
- NOMUVOFIQLIK/XATO TOPISH (muhim): agar foydalanuvchi platforma bilan solishtirishni so'rasa yoki fayldagi raqamlarni tekshirishni istasa — ASBOBLAR bilan platformadagi haqiqiy raqamlarni ol (get_revenue, get_expenses, get_income, get_net_profit, get_cash_position, get_order_flow, get_expense_comments, get_income_comments) va fayldagi raqamlar bilan SOLISHTIR. Farqni ANIQ ko'rsat: qaysi qator/summa/sana, fayldagi qiymat ↔ platformadagi qiymat, farq miqdori (jadvalда). Sababini taxmin qil (masalan tushib qolgan yozuv, ikki marta hisoblangan, sana noto'g'ri).
- SMENA hisobini solishtirish (ENG MUHIM stsenariy): foydalanuvchi "oxirgi/oldingi smena" Excel qoralamasini tizim bilan tekshirishni so'rasa — AVVAL get_shifts bilan smenani top (joriy=ochiq, oldingi=oxirgi yopilgan), KEYIN get_shift_transactions bilan o'sha smenaning HAQIQIY satr-darajа yozuvlarini ol. Fayldagi HAR QATORNI platforma yozuvi bilan solishtir va quyidagilarni ANIQ ko'rsat (jadval: holat, izoh/vaqt, fayl qiymati ↔ platforma qiymati, farq): (1) faylда bor, tizimda YO'Q (tushib qolgan); (2) tizimда bor, faylда yo'q; (3) summa FARQ qiladi; (4) naqd/karta turi noto'g'ri; (5) IKKI marta kiritilgan. Oxirida jami kirim/chiqim (naqd+karta) fayl ↔ tizim taqqoslamasini ber. Faqat asbob bergan haqiqiy yozuvlarga asoslan — TO'QIMA.
- Fayldagi raqamlarni TO'QIMA — faqat ko'rgan/asbobdan olganingga asoslan. Aniq bo'lmasa ayt.`;

@Injectable()
export class AiFinanceService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(FinancialBalanceHistoryEntity)
    private readonly fbhRepo: Repository<FinancialBalanceHistoryEntity>,
    @InjectRepository(AiFinanceReportSnapshotEntity)
    private readonly snapshotRepo: Repository<AiFinanceReportSnapshotEntity>,
    @InjectRepository(AiFinanceChatEntity)
    private readonly chatRepo: Repository<AiFinanceChatEntity>,
    @InjectRepository(AiFinanceConversationEntity)
    private readonly convRepo: Repository<AiFinanceConversationEntity>,
    private readonly claude: ClaudeService,
    private readonly orderService: OrderService,
    private readonly cashBoxService: CashBoxService,
    private readonly logger: MyLogger,
  ) {}

  // Izoh -> kategoriya indeksi keshi (jarayon hayoti davomida). Bir xil izoh
  // (masalan "benzin") har snapshot/davrда QAYTA AI'ga yuborilmaydi — narx
  // keskin tushadi. Distinct izohlar bilan chegaralangan; xavfsizlik uchun
  // o'lchov cheklangan (juda o'sib ketsa tozalanadi).
  private readonly categoryCache = new Map<string, number>();
  private static readonly CATEGORY_CACHE_MAX = 20000;

  // ─── Xarajat AI-hisoboti: vaqt-bucketli seriya + AI kategoriya + narrativ ───
  // Matematikani KOD qiladi (yig'indi, peak, %); Claude faqat kategoriyalaydi
  // (izoh -> kategoriya) va izohlaydi (o'zbekcha narrativ). PII yo'q — faqat
  // xarajat summalari va izoh matni.
  // Endpoint: standart davr -> SAQLANGAN snapshot (AI QAYTA chaqirilmaydi, tez);
  // custom oraliq yoki snapshot yo'q bo'lsa -> jonli hisoblab (kerak bo'lsa saqlab).
  async getExpenseReport(period?: string, fromDate?: string, toDate?: string) {
    try {
      const p: Period = PERIODS.includes(period as Period)
        ? (period as Period)
        : 'monthly';

      // Custom oraliq berilsa — jonli (kam ishlatiladi, AI puli ketadi).
      if (fromToValid(fromDate) && fromToValid(toDate)) {
        const report = await this.computeExpenseReport(p, fromDate, toDate);
        return successRes({ ...report, cached: false });
      }

      // Standart davr — oldindan saqlangan snapshot.
      const snap = await this.readSnapshot(p);
      if (snap) {
        return successRes({
          ...snap.payload,
          cached: true,
          computedAt: Number(snap.computed_at),
        });
      }

      // Snapshot hali yo'q (birinchi startup / migration) — jonli + saqlaymiz.
      const fresh = await this.computeExpenseReport(p);
      const computedAt = Date.now();
      await this.saveSnapshot(p, fresh, computedAt);
      return successRes({ ...fresh, cached: false, computedAt });
    } catch (error) {
      this.logger.log(
        `getExpenseReport xato: ${(error as Error).message}`,
        'AiFinance',
      );
      return catchError(error);
    }
  }

  // Jonli hisoblash (AI kategoriya + narrativ). Snapshot uchun ham shu ishlatiladi.
  private async computeExpenseReport(
    p: Period,
    fromDate?: string,
    toDate?: string,
  ): Promise<Record<string, any>> {
    // Sana oralig'i (Tashkent). Berilmasa — davrga qarab standart.
    const to = fromToValid(toDate) ? (toDate as string) : this.ymd(new Date());
    const from = fromToValid(fromDate)
      ? (fromDate as string)
      : this.ymd(new Date(Date.now() - DEFAULT_DAYS[p] * 86400000));
    const fromTs = toUzbekistanTimestamp(from, false);
    const toTs = toUzbekistanTimestamp(to, true);

    // 1) Vaqt-bucketli seriya (Tashkent) + source_type breakdown.
    //    $3 = format satri (KODdan, whitelistdan — user inputidan emas).
    const rows: Array<{
      bucket: string;
      source_type: string;
      total: string | number;
    }> = await this.fbhRepo.query(
      `SELECT TO_CHAR(TO_TIMESTAMP(created_at/1000) AT TIME ZONE 'Asia/Tashkent', $3) AS bucket,
                source_type,
                SUM(CASE WHEN amount < 0 THEN (-1*amount) ELSE 0 END)::bigint AS total
         FROM financial_balance_history
         WHERE source_type IN ('salary','bills','manual_expense')
           AND amount < 0
           AND created_at >= $1 AND created_at <= $2
         GROUP BY bucket, source_type
         ORDER BY bucket`,
      [fromTs, toTs, PERIOD_FMT[p]],
    );

    const bucketsMap = new Map<string, Bucket>();
    const totalsBySource: Record<string, number> = {
      salary: 0,
      bills: 0,
      manual_expense: 0,
    };
    for (const r of rows) {
      const total = Number(r.total) || 0;
      const b: Bucket = bucketsMap.get(r.bucket) ?? {
        label: r.bucket,
        total: 0,
        bySource: { salary: 0, bills: 0, manual_expense: 0 },
      };
      b.bySource[r.source_type] = (b.bySource[r.source_type] || 0) + total;
      b.total += total;
      bucketsMap.set(r.bucket, b);
      totalsBySource[r.source_type] =
        (totalsBySource[r.source_type] || 0) + total;
    }
    const series = [...bucketsMap.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    const grandTotal = series.reduce((s, b) => s + b.total, 0);

    // 2) Peaks — qaysi davr eng yuqori/past (KOD hisoblaydi).
    let peaks: {
      highest: { label: string; total: number } | null;
      lowest: { label: string; total: number } | null;
    } = { highest: null, lowest: null };
    if (series.length) {
      const sorted = [...series].sort((a, b) => b.total - a.total);
      const hi = sorted[0];
      const lo = sorted[sorted.length - 1];
      peaks = {
        highest: { label: hi.label, total: hi.total },
        lowest: { label: lo.label, total: lo.total },
      };
    }

    // 3) Kategoriya taqsimoti (salary/bills tayyor; manual_expense AI-klaster).
    const byCategory = await this.buildCategories(fromTs, toTs, totalsBySource);

    // 4) Eng katta 10 xarajat.
    const topRows: Array<{
      created_at: string | number;
      source_type: string;
      amount: string | number;
      comment: string | null;
    }> = await this.fbhRepo.query(
      `SELECT created_at, source_type, (-1*amount)::bigint AS amount, comment
         FROM financial_balance_history
         WHERE source_type IN ('salary','bills','manual_expense')
           AND amount < 0 AND created_at >= $1 AND created_at <= $2
         ORDER BY amount ASC
         LIMIT 10`,
      [fromTs, toTs],
    );
    const topExpenses = topRows.map((t) => ({
      date: this.toYmd(Number(t.created_at)),
      source_type: t.source_type,
      source_label: SOURCE_LABEL[t.source_type] || t.source_type,
      amount: Number(t.amount) || 0,
      comment: t.comment || null,
    }));

    // 5) AI narrativ (raqamlar KODdan; Claude faqat izohlaydi). Bo'sh davrда
    //    (xarajat yo'q) LLM behuda chaqirilmaydi.
    const narrative =
      grandTotal > 0
        ? await this.buildNarrative({
            p,
            from,
            to,
            series,
            totalsBySource,
            grandTotal,
            peaks,
            byCategory,
          })
        : null;

    return {
      period: p,
      from,
      to,
      currency: 'UZS',
      totals: { total: grandTotal, bySource: totalsBySource },
      sourceLabels: SOURCE_LABEL,
      series,
      peaks,
      byCategory,
      topExpenses,
      narrative,
      aiEnabled: this.claude.isEnabled(),
    };
  }

  // ─── Snapshot: oldindan hisoblangan hisobot (AI'siz ko'rish uchun) ───
  private async readSnapshot(
    period: Period,
  ): Promise<AiFinanceReportSnapshotEntity | null> {
    try {
      return await this.snapshotRepo.findOne({ where: { period } });
    } catch {
      return null; // jadval hali yo'q (migration yetmagan) — jonliga tushamiz
    }
  }

  private async saveSnapshot(
    period: Period,
    payload: Record<string, any>,
    computedAt: number,
  ): Promise<void> {
    try {
      const existing = await this.snapshotRepo.findOne({ where: { period } });
      if (existing) {
        existing.payload = payload;
        existing.computed_at = computedAt;
        await this.snapshotRepo.save(existing);
      } else {
        await this.snapshotRepo.save(
          this.snapshotRepo.create({
            period,
            payload,
            computed_at: computedAt,
          }),
        );
      }
    } catch (e) {
      this.logger.log(
        `saveSnapshot (${period}) xato: ${(e as Error).message}`,
        'AiFinance',
      );
    }
  }

  // Barcha davrlarni qayta hisoblab saqlaydi (cron + startup + qo'lda yangilash).
  async refreshAllSnapshots(): Promise<number> {
    const computedAt = Date.now();
    let ok = 0;
    for (const p of PERIODS) {
      try {
        const report = await this.computeExpenseReport(p);
        await this.saveSnapshot(p, report, computedAt);
        ok++;
      } catch (e) {
        this.logger.log(
          `refresh ${p} xato: ${(e as Error).message}`,
          'AiFinance',
        );
      }
    }
    this.logger.log(
      `AI xarajat snapshot yangilandi: ${ok}/${PERIODS.length}`,
      'AiFinance',
    );
    return ok;
  }

  // Qo'lda yangilash endpointi uchun (superadmin/admin).
  async refreshSnapshots() {
    const n = await this.refreshAllSnapshots();
    return successRes({
      refreshed: n,
      total: PERIODS.length,
      computedAt: Date.now(),
    });
  }

  // Kunlik avtomatik yangilash (Tashkent 03:00) — ko'rish AI'siz bo'lishi uchun.
  @Cron('0 0 3 * * *', { timeZone: 'Asia/Tashkent' })
  async refreshDailyCron(): Promise<void> {
    await this.refreshAllSnapshots();
  }

  // Loyiha ishga tushganda: snapshot yo'q/eskirgan bo'lsa fon rejimида hisoblaydi
  // (startupни bloklamaydi; jadval hali yo'q bo'lsa jim o'tadi).
  onApplicationBootstrap(): void {
    void (async () => {
      try {
        const snaps = await this.snapshotRepo.find();
        const now = Date.now();
        const fresh =
          snaps.length >= PERIODS.length &&
          snaps.every((s) => now - Number(s.computed_at) < 6 * 3600 * 1000);
        if (!fresh) await this.refreshAllSnapshots();
      } catch {
        /* jadval hali yo'q (migration) — o'tkazib yuboramiz */
      }
    })();
  }

  // ─── AI savol-javob (tool-use) — bu yerда haqiqiy AI puli ketadi ───
  // Model kerakli asboblarni O'ZI chaqiradi; raqamlar kanonik servislardan
  // keladi (model to'qimaydi). PII yo'q (cash-position skalyarga siqiladi).
  async ask(
    question: string,
    fromDate?: string,
    toDate?: string,
    userId?: string,
    conversationId?: string,
  ) {
    try {
      if (!this.claude.isEnabled()) {
        return successRes({
          answer: "AI hozircha o'chiq (ANTHROPIC_API_KEY sozlanmagan).",
          toolsUsed: [],
          aiEnabled: false,
        });
      }
      const today = this.ymd(new Date());
      const range =
        fromToValid(fromDate) && fromToValid(toDate)
          ? ` Foydalanuvchi tanlagan oraliq: ${fromDate} .. ${toDate}.`
          : '';
      const userText = `Bugungi sana: ${today} (Asia/Tashkent).${range}\n\nSavol: ${question}`;

      const res = await this.claude.askWithTools({
        system: ASK_SYSTEM,
        userText,
        tools: ASK_TOOLS,
        runTool: (name, input) => this.runFinanceTool(name, input),
        maxTokens: 3000,
        maxSteps: 8,
        meta: {
          feature: 'finance_chat',
          requestArea: 'finance',
          userId: userId ?? null,
          conversationId: conversationId ?? null,
        },
      });

      if (!res) {
        return successRes({
          answer: "Kechirasiz, hozir javob bera olmadim. Qayta urinib ko'ring.",
          toolsUsed: [],
          aiEnabled: true,
        });
      }
      const answer = res.text;
      const tools = [...new Set(res.toolsUsed)];
      const convId = await this.ensureConversation(
        userId,
        conversationId,
        question,
        answer,
      );
      await this.saveChat(userId, convId, question, answer, tools, null);
      return successRes({
        answer,
        toolsUsed: tools,
        aiEnabled: true,
        conversationId: convId,
      });
    } catch (error) {
      this.logger.log(`ask xato: ${(error as Error).message}`, 'AiFinance');
      return catchError(error);
    }
  }

  // ─── Fayl (rasm/Excel) tahlili — Elchin faylni o'qib, kerak bo'lsa platforma
  //     raqamlari bilan solishtirib nomuvofiqlikni topadi. Vision (rasm) +
  //     Excel matnga aylantirib + tool-use (platforma solishtiruvi).
  async analyzeFile(
    file: Express.Multer.File | undefined,
    question?: string,
    fromDate?: string,
    toDate?: string,
    userId?: string,
    conversationId?: string,
  ) {
    try {
      if (!this.claude.isEnabled()) {
        return successRes({
          answer: "AI hozircha o'chiq (ANTHROPIC_API_KEY sozlanmagan).",
          toolsUsed: [],
          aiEnabled: false,
        });
      }
      if (!file || !file.buffer) {
        return successRes({
          answer: 'Fayl topilmadi. Rasm yoki Excel (.xlsx) yuklang.',
          toolsUsed: [],
          aiEnabled: true,
        });
      }

      const mime = (file.mimetype || '').toLowerCase();
      const nameLc = (file.originalname || '').toLowerCase();
      const today = this.ymd(new Date());
      const range =
        fromToValid(fromDate) && fromToValid(toDate)
          ? ` So'ralgan oraliq: ${fromDate} .. ${toDate}.`
          : '';
      const q = (question || '').trim() || 'Faylni tahlil qil.';
      const baseText = `Bugungi sana: ${today} (Asia/Tashkent).${range}\n\nFoydalanuvchi so'rovi: ${q}`;

      let content: Anthropic.ContentBlockParam[];

      if (mime.startsWith('image/')) {
        const mediaType = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ].includes(mime)
          ? mime
          : 'image/jpeg';
        content = [
          { type: 'text', text: `${baseText}\n\nQuyidagi RASMni tahlil qil.` },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as
                | 'image/jpeg'
                | 'image/png'
                | 'image/gif'
                | 'image/webp',
              data: file.buffer.toString('base64'),
            },
          },
        ];
      } else if (
        nameLc.endsWith('.xlsx') ||
        nameLc.endsWith('.xls') ||
        mime.includes('spreadsheet') ||
        mime.includes('excel')
      ) {
        const excelText = await this.excelToText(file.buffer);
        content = [
          {
            type: 'text',
            text: `${baseText}\n\nQuyida EXCEL fayl mazmuni (matn):\n\n${excelText}`,
          },
        ];
      } else if (
        nameLc.endsWith('.csv') ||
        mime.includes('csv') ||
        mime.startsWith('text/')
      ) {
        const txt = file.buffer.toString('utf8').slice(0, 50000);
        content = [
          {
            type: 'text',
            text: `${baseText}\n\nQuyida fayl mazmuni:\n\n${txt}`,
          },
        ];
      } else {
        return successRes({
          answer:
            "Bu fayl turi qo'llab-quvvatlanmaydi. Rasm (jpg/png) yoki Excel (.xlsx) yuboring.",
          toolsUsed: [],
          aiEnabled: true,
        });
      }

      const res = await this.claude.askWithTools({
        system: ANALYZE_SYSTEM,
        content,
        tools: ASK_TOOLS,
        runTool: (name, input) => this.runFinanceTool(name, input),
        maxTokens: 3500,
        maxSteps: 8,
        meta: {
          feature: 'finance_file',
          requestArea: 'finance',
          userId: userId ?? null,
          conversationId: conversationId ?? null,
        },
      });
      if (!res) {
        return successRes({
          answer:
            "Kechirasiz, faylni tahlil qila olmadim. Qayta urinib ko'ring.",
          toolsUsed: [],
          aiEnabled: true,
        });
      }
      const answer = res.text;
      const tools = [...new Set(res.toolsUsed)];
      const convId = await this.ensureConversation(
        userId,
        conversationId,
        q,
        answer,
      );
      await this.saveChat(
        userId,
        convId,
        q,
        answer,
        tools,
        file.originalname || 'fayl',
      );
      return successRes({
        answer,
        toolsUsed: tools,
        aiEnabled: true,
        conversationId: convId,
      });
    } catch (error) {
      this.logger.log(
        `analyzeFile xato: ${(error as Error).message}`,
        'AiFinance',
      );
      return catchError(error);
    }
  }

  // Excel bufferni matnga aylantiradi (varaq | qatorlar). Token nazorati uchun
  // hujayralar soni cheklangan (katta fayl birinchi qismi).
  private async excelToText(buffer: Buffer): Promise<string> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const MAX_CELLS = 9000;
    let cells = 0;
    const parts: string[] = [];
    wb.eachSheet((ws) => {
      if (cells >= MAX_CELLS) return;
      parts.push(`### Varaq: ${ws.name}`);
      const rowsOut: string[] = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (cells >= MAX_CELLS || rowNumber > 2000) return;
        const vals: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          let v: unknown = cell.value;
          if (v && typeof v === 'object') {
            const o = v as Record<string, unknown>;
            if ('result' in o)
              v = o.result; // formula -> qiymat
            else if ('text' in o)
              v = o.text; // rich text
            else if (v instanceof Date) v = v.toISOString().slice(0, 10);
            else v = JSON.stringify(v);
          }
          vals.push(v == null ? '' : String(v));
          cells++;
        });
        rowsOut.push(vals.join(' | '));
      });
      parts.push(rowsOut.join('\n'));
    });
    let out = parts.join('\n\n');
    if (cells >= MAX_CELLS) {
      out += `\n\n[Eslatma: fayl katta — faqat birinchi qismi ko'rsatildi.]`;
    }
    return out.slice(0, 70000);
  }

  // ─── Suhbatlar (sessiyalar) + yozishmalar tarixi (DB'да) ───

  // Mavjud suhbatni tekshiradi (egasi bo'lsa) yoki YANGISINI yaratadi (title =
  // birinchi savol). Chat ochib yangi topshiriq berish uchun.
  private async ensureConversation(
    userId: string | undefined,
    conversationId: string | undefined,
    firstQuestion: string,
    firstAnswer?: string,
  ): Promise<string | null> {
    if (!userId) return null;
    try {
      if (conversationId) {
        const c = await this.convRepo.findOne({
          where: { id: conversationId, user_id: userId },
        });
        if (c) return c.id;
      }
      // Yangi suhbat — mazmunga qarab AI mazmunli sarlavha beradi.
      const title = await this.generateTitle(
        firstQuestion,
        firstAnswer,
        userId,
      );
      const created = await this.convRepo.save(
        this.convRepo.create({ user_id: userId, title }),
      );
      return created.id;
    } catch (e) {
      this.logger.log(
        `ensureConversation xato: ${(e as Error).message}`,
        'AiFinance',
      );
      return null;
    }
  }

  // Suhbat MAZMUNIga qarab qisqa (3-5 so'z) o'zbekcha sarlavha (AI). Xato/o'chiq
  // bo'lsa birinchi savolning qisqartmasi.
  private async generateTitle(
    question: string,
    answer?: string,
    userId?: string,
  ): Promise<string> {
    const fallback =
      (question || 'Yangi suhbat').replace(/\s+/g, ' ').trim().slice(0, 60) ||
      'Yangi suhbat';
    if (!this.claude.isEnabled()) return fallback;
    try {
      const ctx = `Savol: ${question || '-'}\n${answer ? `Javob (qisqacha): ${answer.slice(0, 500)}` : ''}`;
      const t = await this.claude.ask({
        system: `Quyidagi moliyaviy suhbatga 3-5 so'zli QISQA, mazmunli sarlavha ber (o'zbekcha). Faqat sarlavhani qaytar — tirnoq, nuqta yoki izohsiz. Masalan: Sentyabr sof foyda; Excel nomuvofiqlik tekshiruvi; Kategoriya bo'yicha xarajat; Kassa naqd holati.`,
        userText: ctx,
        model: config.AI_CLASSIFY_MODEL,
        maxTokens: 32,
        meta: {
          feature: 'finance_title',
          requestArea: 'finance',
          userId: userId ?? null,
        },
      });
      if (!t) return fallback;
      const clean = t
        .split('\n')[0]
        .replace(/["'«».]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return clean.slice(0, 60) || fallback;
    } catch {
      return fallback;
    }
  }

  private async saveChat(
    userId: string | undefined,
    conversationId: string | null,
    question: string,
    answer: string,
    tools: string[],
    fileName: string | null,
  ): Promise<void> {
    if (!userId || !answer) return;
    try {
      await this.chatRepo.save(
        this.chatRepo.create({
          user_id: userId,
          conversation_id: conversationId,
          question: (question || '').slice(0, 4000),
          answer: answer.slice(0, 20000),
          tools: tools && tools.length ? tools : null,
          file_name: fileName || null,
        }),
      );
      // Suhbatning oxirgi faollik vaqtini yangilaymiz (ro'yxatда tepada tursin).
      if (conversationId) {
        await this.convRepo.update(
          { id: conversationId },
          { updated_at: Date.now() },
        );
      }
    } catch (e) {
      this.logger.log(`saveChat xato: ${(e as Error).message}`, 'AiFinance');
    }
  }

  // Foydalanuvchi suhbatlari ro'yxati (oxirgi faol tepada) + xabar soni.
  async getConversations(userId: string) {
    try {
      const rows = await this.convRepo.find({
        where: { user_id: userId },
        order: { updated_at: 'DESC' },
        take: 100,
      });
      const counts = await this.chatRepo
        .createQueryBuilder('c')
        .select('c.conversation_id', 'cid')
        .addSelect('COUNT(*)', 'cnt')
        .where('c.user_id = :u', { u: userId })
        .andWhere('c.conversation_id IS NOT NULL')
        .groupBy('c.conversation_id')
        .getRawMany();
      const cntMap = new Map<string, number>();
      for (const c of counts) cntMap.set(c.cid, Number(c.cnt));
      return successRes(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          updatedAt: Number(r.updated_at),
          messageCount: cntMap.get(r.id) || 0,
        })),
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // Bitta suhbatning yozishmalari (xronologik). Egasi tekshiriladi.
  async getConversationMessages(userId: string, conversationId: string) {
    try {
      const conv = await this.convRepo.findOne({
        where: { id: conversationId, user_id: userId },
      });
      if (!conv) return successRes([]);
      const rows = await this.chatRepo.find({
        where: { conversation_id: conversationId },
        order: { created_at: 'ASC' },
        take: 200,
      });
      return successRes(
        rows.map((r) => ({
          id: r.id,
          question: r.question,
          answer: r.answer,
          tools: r.tools || [],
          file_name: r.file_name || null,
          created_at: Number(r.created_at),
        })),
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // Bitta suhbatni (va yozishmalarini) o'chirish.
  async deleteConversation(userId: string, conversationId: string) {
    try {
      const conv = await this.convRepo.findOne({
        where: { id: conversationId, user_id: userId },
      });
      if (!conv) return successRes({ deleted: false });
      await this.chatRepo.delete({ conversation_id: conversationId });
      await this.convRepo.delete({ id: conversationId });
      return successRes({ deleted: true });
    } catch (error) {
      return catchError(error);
    }
  }

  // successRes o'ramini ochadi (yoki xom obyektni qaytaradi).
  private unwrap(res: unknown): any {
    return res &&
      typeof res === 'object' &&
      'data' in (res as Record<string, unknown>) &&
      'statusCode' in (res as Record<string, unknown>)
      ? (res as { data: unknown }).data
      : res;
  }

  // Asboblarni haqiqiy kanonik servislarga bog'laydi (raqamlar shu yerdan).
  private async runFinanceTool(name: string, input: unknown): Promise<unknown> {
    const inp = (input || {}) as {
      period?: string;
      fromDate?: string;
      toDate?: string;
    };
    const from = fromToValid(inp.fromDate) ? inp.fromDate : undefined;
    const to = fromToValid(inp.toDate) ? inp.toDate : undefined;
    const period = PERIODS.includes(inp.period as Period)
      ? (inp.period as Period)
      : 'monthly';

    switch (name) {
      case 'get_revenue': {
        const d = this.unwrap(
          await this.orderService.getRevenueStats(period, from, to),
        );
        return { summary: d?.summary, series: d?.data };
      }
      case 'get_net_profit': {
        const rev = this.unwrap(
          await this.orderService.getRevenueStats('daily', from, to),
        );
        const gross = Number(rev?.summary?.totalRevenue) || 0;
        const an = this.unwrap(
          await this.cashBoxService.financialBalanceAnalytics({
            fromDate: from,
            toDate: to,
          }),
        );
        const opex = ((an?.negativeImpact as any[]) || [])
          .filter((x) =>
            ['salary', 'bills', 'manual_expense'].includes(x.source_type),
          )
          .reduce(
            (s: number, x) => s + Math.abs(Number(x.total_amount) || 0),
            0,
          );
        return {
          grossProfit: gross,
          totalOpEx: opex,
          netProfit: gross - opex,
          from: from || null,
          to: to || null,
        };
      }
      case 'get_expenses': {
        const an = this.unwrap(
          await this.cashBoxService.financialBalanceAnalytics({
            fromDate: from,
            toDate: to,
          }),
        );
        return { negativeImpact: an?.negativeImpact, totals: an?.totals };
      }
      case 'get_income': {
        const an = this.unwrap(
          await this.cashBoxService.financialBalanceAnalytics({
            fromDate: from,
            toDate: to,
          }),
        );
        const byType = ((an?.positiveImpact as any[]) || [])
          .filter((x) => INCOME_SOURCES.includes(x.source_type))
          .map((x) => ({
            source_type: x.source_type,
            label: INCOME_LABEL[x.source_type] || x.source_type,
            total: Math.abs(Number(x.total_amount) || 0),
            count: Number(x.transaction_count) || 0,
          }))
          .sort((a, b) => b.total - a.total);
        const total = byType.reduce((s, x) => s + x.total, 0);
        return { from: from || null, to: to || null, total, byType };
      }
      case 'get_income_comments': {
        const toS = to || this.ymd(new Date());
        const fromS = from || this.ymd(new Date(Date.now() - 365 * 86400000));
        const groups = await this.commentGroups(
          toUzbekistanTimestamp(fromS, false),
          toUzbekistanTimestamp(toS, true),
          'manual_income',
          150,
          'income',
        );
        return { from: fromS, to: toS, count: groups.length, comments: groups };
      }
      case 'get_expense_categories': {
        const d = this.unwrap(await this.getExpenseReport(period));
        return {
          period: d?.period,
          totals: d?.totals,
          peaks: d?.peaks,
          byCategory: ((d?.byCategory as any[]) || []).map((c) => ({
            name: c.name,
            total: c.total,
            count: c.count,
          })),
        };
      }
      case 'get_expense_comments': {
        const toS = to || this.ymd(new Date());
        const fromS = from || this.ymd(new Date(Date.now() - 365 * 86400000));
        const groups = await this.commentGroups(
          toUzbekistanTimestamp(fromS, false),
          toUzbekistanTimestamp(toS, true),
          'manual_expense',
          150,
        );
        return { from: fromS, to: toS, count: groups.length, comments: groups };
      }
      case 'get_cash_position': {
        const d = this.unwrap(await this.cashBoxService.financialBalance());
        // PII-strip: faqat skalyar yig'indilar (ism/karta massivlari yo'q).
        return {
          currentSituation: d?.currentSituation,
          kassa: d?.main?.balance,
          naqd: d?.main?.balance_cash,
          karta: d?.main?.balance_card,
          marketsTotal: d?.markets?.marketsTotalBalans,
          couriersTotal: d?.couriers?.couriersTotalBalanse,
          difference: d?.difference,
        };
      }
      case 'get_order_flow': {
        return this.unwrap(await this.orderService.getStats(from, to));
      }
      case 'get_shifts': {
        const raw = (input || {}) as { limit?: number };
        return this.cashBoxService.getRecentShiftsForAi(Number(raw.limit) || 6);
      }
      case 'get_shift_transactions': {
        const raw = (input || {}) as { shift?: string };
        const sel =
          typeof raw.shift === 'string' && raw.shift.trim()
            ? raw.shift.trim()
            : 'current';
        return this.cashBoxService.getShiftTransactionsForAi(sel);
      }
      default:
        return { error: `noma'lum asbob: ${name}` };
    }
  }

  // Kategoriya taqsimoti + HAR kategoriya ICHI (drill-down):
  //   salary  -> members (kim qancha maosh oldi)
  //   bills   -> items (izoh guruhlari)
  //   manual_expense -> AI kategoriyalar, har biriда items (izoh guruhlari)
  // Jami byCategory = haqiqiy chiqim (500 dan ortiq izoh yoki AIга tushmagan
  // qoldiq "Boshqa"ga qo'shiladi — hech narsa tushib qolmaydi).
  private async buildCategories(
    fromTs: number,
    toTs: number,
    totalsBySource: Record<string, number>,
  ): Promise<Category[]> {
    const cats: Category[] = [];

    // SALARY — ichida per-hodim taqsimot (kim shu davrда qancha maosh oldi).
    if (totalsBySource.salary > 0) {
      const members = await this.salaryMembers(fromTs, toTs);
      cats.push({
        name: SOURCE_LABEL.salary,
        total: totalsBySource.salary,
        count: members.reduce((s, m) => s + m.count, 0),
        source: 'salary',
        examples: [],
        members,
      });
    }

    // BILLS — ichida izoh bo'yicha taqsimot.
    if (totalsBySource.bills > 0) {
      const items = await this.commentGroups(fromTs, toTs, 'bills');
      cats.push({
        name: SOURCE_LABEL.bills,
        total: totalsBySource.bills,
        count: items.reduce((s, i) => s + i.count, 0),
        source: 'bills',
        examples: items
          .slice(0, 3)
          .map((i) => i.comment)
          .filter((c) => c !== '(izohsiz)'),
        items,
      });
    }

    // MANUAL_EXPENSE — izohlarni MA'NOSI bo'yicha kategoriyaга ajratamiz.
    // "Qo'lda chiqim" O'ZI HECH QACHON kategoriya bo'lmaydi — har doim izoh
    // mazmuniga qarab (Ovqat, Transport, Ijara...). AI o'chiq/xato bo'lsa
    // izohning O'ZI kategoriya bo'ladi (baribir "Qo'lda chiqim" emas).
    const rows = await this.commentGroups(fromTs, toTs, 'manual_expense', 500);
    if (rows.length) {
      const assigned = await this.classifyComments(rows.map((r) => r.comment));

      const byName = new Map<string, Category>();
      let categorizedSum = 0;
      rows.forEach((r, i) => {
        let name = (assigned[i] || '').trim();
        // Generik/manba nomi yoki bo'sh -> izohning O'ZI (u ham generik/bo'sh
        // bo'lsa "Boshqa"). "Qo'lda chiqim" hech qachon kategoriya bo'lmaydi.
        if (!name || GENERIC_CATEGORY.has(name.toLowerCase())) {
          const comment = (r.comment || '').trim();
          name =
            comment &&
            comment !== '(izohsiz)' &&
            !GENERIC_CATEGORY.has(comment.toLowerCase())
              ? comment
              : 'Boshqa';
        }
        const c: Category = byName.get(name) ?? {
          name,
          total: 0,
          count: 0,
          source: 'manual_expense',
          examples: [],
          items: [],
        };
        c.total += r.total;
        c.count += r.count;
        c.items!.push(r);
        if (c.examples.length < 3 && r.comment !== '(izohsiz)') {
          c.examples.push(r.comment);
        }
        byName.set(name, c);
        categorizedSum += r.total;
      });

      // Rekonsiliatsiya: hisoblangan yig'indi haqiqiy manual_expense'dan kam
      // bo'lsa (500+ izoh yoki AIга tushmagan) — qoldiqни "Boshqa"ga qo'shamiz.
      const remainder = totalsBySource.manual_expense - categorizedSum;
      if (remainder > 0) {
        const other: Category = byName.get('Boshqa') ?? {
          name: 'Boshqa',
          total: 0,
          count: 0,
          source: 'manual_expense',
          examples: [],
          items: [],
        };
        other.total += remainder;
        byName.set('Boshqa', other);
      }

      for (const c of byName.values()) {
        if (c.items) c.items.sort((a, b) => b.total - a.total);
      }
      cats.push(...byName.values());
    }

    return cats.sort((a, b) => b.total - a.total);
  }

  // Izohlarni YOPIQ taksonomiyaga (CATEGORY_LABELS) ajratadi. Uch bosqich:
  //   1) kesh — avval ko'rilgan izoh qayta hisoblanmaydi (bepul);
  //   2) kalit-so'z old-filtri — aniq izohlar AI'siz (bepul, izchil);
  //   3) qolgan noaniqlar — Haiku (arzon model) yopiq ro'yxatdan RAQAM tanlaydi.
  // Natija rows bilan bir tartibda; nom CATEGORY_LABELS'dan. AI o'chiq/xato
  // bo'lsa faqat kalit-so'z topilmaganlar bo'sh ('') — chaqiruvchi izohga tushiradi.
  private async classifyComments(comments: string[]): Promise<string[]> {
    const result: string[] = new Array(comments.length).fill('');
    if (!comments.length) return result;

    // 1) + 2): kesh va kalit-so'z bilan hal bo'lganlarni ajratamiz.
    const keys = comments.map((c) => this.normComment(c));
    const need: number[] = []; // AIга yuboriladigan indekslar
    for (let i = 0; i < comments.length; i++) {
      const key = keys[i];
      if (!key || key === '(izohsiz)') {
        result[i] = CATEGORY_LABELS[OTHER_INDEX];
        continue;
      }
      const cached = this.categoryCache.get(key);
      if (cached !== undefined) {
        result[i] = CATEGORY_LABELS[cached] || CATEGORY_LABELS[OTHER_INDEX];
        continue;
      }
      const kw = keywordCategoryIndex(key);
      if (kw !== null) {
        result[i] = CATEGORY_LABELS[kw];
        this.cacheCategory(key, kw);
        continue;
      }
      need.push(i);
    }

    // 3): qolganlarni arzon model (Haiku) yopiq ro'yxatdan indeks bilan tanlaydi.
    if (this.claude.isEnabled() && need.length) {
      const CHUNK = 150;
      for (let start = 0; start < need.length; start += CHUNK) {
        const slice = need.slice(start, start + CHUNK);
        const list = slice.map((idx, k) => `${k}) ${comments[idx]}`).join('\n');
        const res = await this.claude.extractJson<{ indexes: number[] }>({
          system: CATEGORY_SYSTEM,
          userText: list,
          schema: CATEGORY_SCHEMA,
          model: config.AI_CLASSIFY_MODEL,
          maxTokens: 1500,
          meta: { feature: 'finance_category', requestArea: 'finance' },
        });
        if (res && Array.isArray(res.indexes)) {
          slice.forEach((origIdx, k) => {
            const raw = Math.floor(Number(res.indexes[k]));
            const ci =
              raw >= 0 && raw < CATEGORY_LABELS.length ? raw : OTHER_INDEX;
            result[origIdx] = CATEGORY_LABELS[ci];
            this.cacheCategory(keys[origIdx], ci);
          });
        }
      }
    }
    return result;
  }

  // Izohni kesh/kalit-so'z uchun normallashtiradi (kichik harf, apostrof olib
  // tashlanadi, bo'sh joylar bir xil) — "Benzin", "benzin ", "benzn" bir kalit.
  private normComment(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[`ʼʻ'‘’ʹ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Keshga yozadi; hajmi juda oshsa (turli izohlar ko'p) tozalab yuboradi.
  private cacheCategory(key: string, idx: number): void {
    if (this.categoryCache.size >= AiFinanceService.CATEGORY_CACHE_MAX) {
      this.categoryCache.clear();
    }
    this.categoryCache.set(key, idx);
  }

  // Bitta source_type uchun izoh bo'yicha guruhlar (kategoriya ichi tarkibi).
  // direction: 'expense' (amount<0) yoki 'income' (amount>0). SQL shartlari
  // KODдан (whitelist) — user inputidan emas (injection yo'q).
  private async commentGroups(
    fromTs: number,
    toTs: number,
    source: string,
    limit = 200,
    direction: 'expense' | 'income' = 'expense',
  ): Promise<CategoryItem[]> {
    const amountCond = direction === 'income' ? 'amount > 0' : 'amount < 0';
    const sumExpr =
      direction === 'income' ? 'SUM(amount)::bigint' : 'SUM(-1*amount)::bigint';
    const rows: Array<{
      comment: string;
      cnt: string | number;
      total: string | number;
    }> = await this.fbhRepo.query(
      `SELECT COALESCE(NULLIF(TRIM(comment), ''), '(izohsiz)') AS comment,
              COUNT(*)::int AS cnt, ${sumExpr} AS total
       FROM financial_balance_history
       WHERE source_type::text = $3 AND ${amountCond}
         AND created_at >= $1 AND created_at <= $2
       GROUP BY 1 ORDER BY total DESC LIMIT $4`,
      [fromTs, toTs, source, limit],
    );
    return rows.map((r) => ({
      comment: r.comment,
      count: Number(r.cnt) || 0,
      total: Number(r.total) || 0,
    }));
  }

  // Maosh kategoriyasi ichi: kim shu davrда qancha maosh olgan (per-hodim).
  private async salaryMembers(
    fromTs: number,
    toTs: number,
  ): Promise<CategoryMember[]> {
    const rows: Array<{
      name: string | null;
      cnt: string | number;
      total: string | number;
    }> = await this.fbhRepo.query(
      `SELECT u.name AS name, COUNT(*)::int AS cnt, SUM(-1*h.amount)::bigint AS total
       FROM financial_balance_history h
       LEFT JOIN users u ON u.id = h.related_user_id
       WHERE h.source_type::text = 'salary' AND h.amount < 0
         AND h.created_at >= $1 AND h.created_at <= $2
       GROUP BY u.name
       ORDER BY total DESC`,
      [fromTs, toTs],
    );
    return rows.map((r) => ({
      name: r.name || "Noma'lum",
      count: Number(r.cnt) || 0,
      total: Number(r.total) || 0,
    }));
  }

  private async buildNarrative(d: {
    p: Period;
    from: string;
    to: string;
    series: Bucket[];
    totalsBySource: Record<string, number>;
    grandTotal: number;
    peaks: {
      highest: { label: string; total: number } | null;
      lowest: { label: string; total: number } | null;
    };
    byCategory: Category[];
  }): Promise<string | null> {
    if (!this.claude.isEnabled()) return null;
    const ctx = {
      davr: PERIOD_UZ[d.p],
      oraliq: `${d.from} .. ${d.to}`,
      jami_xarajat: d.grandTotal,
      turlar_boyicha: {
        oyliklar: d.totalsBySource.salary,
        kommunal_bills: d.totalsBySource.bills,
        qolda_chiqim: d.totalsBySource.manual_expense,
      },
      eng_yuqori_davr: d.peaks.highest,
      eng_past_davr: d.peaks.lowest,
      kategoriyalar: d.byCategory
        .slice(0, 10)
        .map((c) => ({ nom: c.name, jami: c.total })),
      seriya: d.series.map((s) => ({ davr: s.label, jami: s.total })),
    };
    const system = `Sen O'zbekiston biznesining moliyaviy tahlilchisisan. Berilgan XARAJAT raqamlariga asoslanib qisqa, aniq o'zbekcha hisobot yoz.
QOIDALAR:
- FAQAT berilgan raqamlarga asoslan — yangi raqam TO'QIMA, hisob-kitob qILMA.
- 3-6 jumla: umumiy xarajat, qaysi tur/kategoriya ustun, qaysi davr eng yuqori/past, sezilarli o'sish/kamayish trendi.
- Sonlarni o'qiladigan yoz (masalan 12 500 000 so'm).
- Ortiqcha kirish jumlasiz, to'g'ridan mazmun. Markdown ishlatishing mumkin.`;
    return this.claude.ask({
      system,
      userText: JSON.stringify(ctx),
      maxTokens: 900,
      meta: { feature: 'finance_report', requestArea: 'finance' },
    });
  }

  // epoch-ms -> Tashkent YYYY-MM-DD (DST yo'q, doim +5) — loyiha konvensiyasi.
  private toYmd(ms: number): string {
    return new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10);
  }
  private ymd(d: Date): string {
    return new Date(d.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  }
}

// YYYY-MM-DD ekanini yengil tekshirish (aks holda standart oraliqqa tushamiz).
function fromToValid(s?: string): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Deterministik kalit-so'z -> kategoriya indeksi. Normallashtirilgan izoh
// (normComment) beriladi. Aniq (bir ma'noli) kalit topilsa indeks, aks holda
// null (-> AI hal qiladi). Faqat ishonchli kalitlar — noaniqlik AI'ga qoladi.
function keywordCategoryIndex(norm: string): number | null {
  if (!norm) return null;
  for (const { idx, words } of CATEGORY_KEYWORDS) {
    for (const w of words) {
      if (norm.includes(w)) return idx;
    }
  }
  return null;
}
