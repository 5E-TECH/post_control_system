import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ProductEntity } from 'src/core/entity/product.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderService } from 'src/api/order/order.service';
import {
  ClaudeService,
  ClaudeImageInput,
} from 'src/infrastructure/ai/claude.service';
import { AiBalanceService } from 'src/api/ai-balance/ai-balance.service';
import { MyLogger } from 'src/logger/logger.service';
import {
  Roles,
  Where_deliver,
  Order_status,
  OrderCreatedSource,
} from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { CreateOrderByBotDto } from 'src/api/order/dto/create-order-bot.dto';
import { CreateOrderDto } from 'src/api/order/dto/create-order.dto';
import { AiDraftItem, AiOrderDraft } from './session.interface';
import config from 'src/config';

const MAX_CANDIDATE_BUTTONS = 5;

// Kirill (o'zbek + rus) -> lotin transliteratsiya. Foydalanuvchi kirill yozsa ham
// DB (lotin) nomlariga mos kelishi uchun. Case-by-case emas — umumiy.
const CYR_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ғ: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  қ: 'q',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ў: 'o',
  ф: 'f',
  х: 'x',
  ҳ: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ә: 'a',
  ө: 'o',
  ү: 'u',
  ҷ: 'j',
  ұ: 'u',
};

const EXTRACT_SYSTEM = `Sen O'zbekistondagi yetkazib berish platformasining buyurtma yordamchisisan.
Foydalanuvchi (operator yoki market) yozgan yoki mijozdan forward qilingan erkin matndan buyurtma ma'lumotlarini ajratasan.
QAT'IY QOIDALAR:
- Faqat matnda ANIQ bor ma'lumotni chiqar. Yo'q bo'lsa null qoldiring — HECH NARSA TO'QIB CHIQARMA.
- Mahsulotlar uchun faqat NOMINI va sonini (quantity) yoz; ID/narx to'qima. Son ko'rsatilmagan bo'lsa 1.
- region_name = VILOYAT nomi (masalan "Andijon", "Navoiy"). MUHIM: agar matnda "shahri" yoki "viloyati" so'zi yozilgan bo'lsa, uni HAM qo'shib yoz — ayniqsa Toshkent uchun: "Toshkent shahri" (poytaxt) va "Toshkent viloyati" (atrofdagi tumanlar) ikki XIL joy, farqla.
  ⚠️ ANIQ AYTILGAN VILOYAT USTUN: agar mijoz viloyat/shaharни ANIQ yozgan bo'lsa (masalan "Toshkent shahri", "Andijon viloyati"), region_name AYNAN o'sha bo'ladi — tuman nomi boshqa viloyatni eslatsa HAM, viloyatni O'ZGARTIRMA. Ya'ni "Toshkent shahri Xonobod" -> region_name="Toshkent shahri" (Xonobod Andijonда bo'lsa ham, viloyatni Andijonга KO'CHIRMA); district_name="Xonobod" (yozilganicha), keyin tizim shu viloyatда tekshiradi, topolmasa operator to'ldiradi.
  GEOGRAFIK INFERENCE (faqat VILOYAT YOZILMAGANda): matnda viloyat umuman yo'q bo'lsa-yu, tuman/shahar/shaharcha/qishloq nomi bor bo'lsa — O'zbekiston geografiyasi bo'yicha u QAYSI VILOYATda ekanini o'zing aniqlab region_name'ga yoz (masalan "Chilonzor" -> "Toshkent shahri", "Xo'jaobod" -> "Andijon", "Asaka" -> "Andijon"). O'xshash nomli tumanlarni (Xo'jaobod/Andijon va boshqa viloyatdagi o'xshash nom) ADASHTIRMA. Viloyatni ishonch bilan aniqlay olmasang null qoldir — LEKIN district_name'ni baribir yozilganicha yoz (tizim o'zi qidiradi).
- district_name = yetkazish JOYI — TUMAN yoki SHAHAR nomi (masalan "Asaka", "Chilonzor", "Navoiy shahri", "Zarafshon shahri", "Nurota"). MUHIM: joy manzil ichida bo'lsa ham (masalan "Navoiy shahri vagzal xududi 20-uy") — shahar/tuman nomini ("Navoiy shahri") ajratib district_name'ga yoz, faqat qolgan ko'cha/uy qismini ("vagzal xududi 20-uy") address'ga yoz. SHAHAR ham district_name'ga tushadi, address'ga EMAS. SHAHARCHA/QISHLOQ/MAHALLA (MFY)/mavze: agar mijoz TUMAN emas, uning ichidagi kichik joyni (shaharcha, qishloq, mahalla, MFY) yozsa — u qaysi TUMANga qarashli ekanini geografik biliming bilan aniqlab, TUMAN nomini district_name'ga yoz (kichik joy nomini EMAS); asl kichik joy nomini full_address/address'da qoldir.
- full_address = MANZILNING TO'LIQ MATNI — viloyat, tuman/shahar, ko'cha, uy — HAMMASI, matnda qanday yozilgan bo'lsa AYNAN o'sha holicha ko'chir (o'zgartirma, tarjima qilma, hech narsani tushirib qoldirma). Kirill bo'lsa kirill, lotin bo'lsa lotin. Bu maydon rezolyutsiya uchun zaxira.
- total_price = BUTUN buyurtma narxi RAQAM sifatida (masalan "250 ming" -> 250000, "2.5 mln" -> 2500000, "300k" -> 300000). "ming"=1000, "mln"/"million"=1000000 ga ko'paytir. MUHIM: agar narx BIR DONA uchun berilsa ("donasi", "bittasi", "har biri", "tasi X so'm") — uni MAHSULOT SONIGA KO'PAYTIRIB butun narxni yoz (masalan "3 dona, donasi 2 mln" -> 6000000). Aniq bo'lmasa null.
- comment = yetkazish bo'yicha izoh (masalan "kechqurun keling"). Telefon raqamlar comment'ga tushmasin.
- Telefon O'zbekiston formatida; faqat raqamlarni ol.
- extra_number = mijozning IKKINCHI (qo'shimcha) telefon raqami, agar bo'lsa.
- where_deliver = yetkazish turi: "address" (uyga/manzilga yetkazilsa, "eshikkacha", "uyiga"), "center" (markazdan/pochtadan/filialdan olib ketsa yoki "olib ketadi"). Aniq bo'lmasa null.
- is_replacement = true FAQAT matn ALMASHTIRISH/kafolat holatini bildirsa: "almashtirish", "almashtirib berish", "kafolat", "brak", "nosoz", "buzuq", "ishlamayapti", "eski ... o'rniga", "qaytarib olib yangisini". Oddiy yangi buyurtma bo'lsa false.
- operator = MUTAXASSIS / operator / sotuvchi ismi, agar matnda ko'rsatilgan bo'lsa (masalan "Mutaxassis: #sevinch" -> "sevinch", "operator Ali" -> "Ali"). '#' belgisini olib tashla. Yo'q bo'lsa null.
Matn o'zbek, rus yoki lotin/kirill aralash bo'lishi mumkin.

MISOLLAR (matn -> to'g'ri chiqish; ko'rsatilmagan maydonlar null):
1) Matn: "Salom Dilnoza opa 3 ta atir sepgich olib berila donasi 250 ming +998901234567 Andijon Asaka temiryol kochasi 12 uy eshikkacha"
   Chiqish: {"customer_name":"Dilnoza","phone_number":"998901234567","extra_number":null,"region_name":"Andijon","district_name":"Asaka","address":"temiryol ko'chasi 12 uy","full_address":"Andijon Asaka temiryol kochasi 12 uy","items":[{"name":"atir sepgich","quantity":3}],"total_price":750000,"comment":null,"where_deliver":"address","is_replacement":false,"operator":null}
   Diqqat: "donasi 250 ming" BIR dona narxi -> 3 ga ko'paytirilib total_price=750000; "eshikkacha" -> where_deliver="address"; "Asaka" address ichida bo'lsa ham district_name'ga.
2) Matn: "Mijoz Aziz 900112233, Toshkent shahri Chilonzor, blender 1 ta 320k, markazdan oladi, Mutaxassis: #sevinch"
   Chiqish: {"customer_name":"Aziz","phone_number":"900112233","extra_number":null,"region_name":"Toshkent shahri","district_name":"Chilonzor","address":null,"full_address":"Toshkent shahri Chilonzor","items":[{"name":"blender","quantity":1}],"total_price":320000,"comment":null,"where_deliver":"center","is_replacement":false,"operator":"sevinch"}
   Diqqat: "Toshkent shahri" (poytaxt) — "Toshkent viloyati"dan farqla; "markazdan oladi" -> where_deliver="center"; "#sevinch" -> operator="sevinch".
3) Matn: "eski changyutgich buzuq ekan almashtirib beringlar, Kamola 933445566 Navoiy shahri vagzal 20-uy"
   Chiqish: {"customer_name":"Kamola","phone_number":"933445566","extra_number":null,"region_name":"Navoiy","district_name":"Navoiy shahri","address":"vagzal 20-uy","full_address":"Navoiy shahri vagzal 20-uy","items":[{"name":"changyutgich","quantity":1}],"total_price":null,"comment":null,"where_deliver":null,"is_replacement":true,"operator":null}
   Diqqat: "buzuq...almashtirib" -> is_replacement=true; narx yo'q -> total_price=null; "Navoiy shahri" district_name'ga, "vagzal 20-uy" address'ga.
4) Matn: "Nozima 901112233 xojaobd paxtaobod mfy 5-uy, muzlatgich 1 ta 4 mln 200"
   Chiqish: {"customer_name":"Nozima","phone_number":"901112233","extra_number":null,"region_name":"Andijon","district_name":"Xo'jaobod","address":"paxtaobod mfy 5-uy","full_address":"xojaobd paxtaobod mfy 5-uy","items":[{"name":"muzlatgich","quantity":1}],"total_price":4200000,"comment":null,"where_deliver":null,"is_replacement":false,"operator":null}
   Diqqat: viloyat yozilmagan — "xojaobd" (imlo) -> "Xo'jaobod" tuman, uni geografik bilim bilan "Andijon" viloyatiga bog'la; "paxtaobod mfy" — bu MAHALLA (tuman emas), district_name'ga QO'YMA, address'ga qoldir; "4 mln 200" -> 4200000.
5) Matn: "Bobur 998901112233 Toshkent shahri Xonobod, adapter 1 ta 90000"
   Chiqish: {"customer_name":"Bobur","phone_number":"998901112233","extra_number":null,"region_name":"Toshkent shahri","district_name":"Xonobod","address":null,"full_address":"Toshkent shahri Xonobod","items":[{"name":"adapter","quantity":1}],"total_price":90000,"comment":null,"where_deliver":null,"is_replacement":false,"operator":null}
   Diqqat: mijoz "Toshkent shahri"ni ANIQ yozgan — region_name AYNAN "Toshkent shahri"; "Xonobod" nomi Andijonni eslatsa HAM viloyatni Andijonga KO'CHIRMA. district_name="Xonobod" yozilganicha (tizim Toshkent ichida qidiradi, topolmasa operator to'ldiradi). Aniq aytilgan viloyatni tuman nomiga qarab hech qachon o'zgartirma.`;

const EXTRACT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    customer_name: { type: ['string', 'null'] },
    phone_number: { type: ['string', 'null'] },
    extra_number: { type: ['string', 'null'] },
    region_name: { type: ['string', 'null'] },
    district_name: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    full_address: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          quantity: { type: 'integer' },
        },
        required: ['name', 'quantity'],
      },
    },
    total_price: { type: ['number', 'null'] },
    comment: { type: ['string', 'null'] },
    where_deliver: { type: ['string', 'null'] },
    is_replacement: { type: 'boolean' },
    operator: { type: ['string', 'null'] },
  },
  required: [
    'customer_name',
    'phone_number',
    'extra_number',
    'region_name',
    'district_name',
    'address',
    'full_address',
    'items',
    'total_price',
    'comment',
    'where_deliver',
    'is_replacement',
    'operator',
  ],
};

interface RawExtraction {
  customer_name: string | null;
  phone_number: string | null;
  extra_number: string | null;
  region_name: string | null;
  district_name: string | null;
  address: string | null;
  full_address: string | null;
  items: { name: string; quantity: number }[];
  total_price: number | null;
  comment: string | null;
  where_deliver: string | null;
  is_replacement: boolean;
  operator: string | null;
}

// Ko'p buyurtma: bitta matnda bir nechta buyurtma bo'lishi mumkin.
const EXTRACT_MULTI_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    orders: {
      type: 'array',
      items: EXTRACT_SCHEMA,
    },
  },
  required: ['orders'],
};

const EXTRACT_MULTI_SYSTEM = `${EXTRACT_SYSTEM}

DIQQAT: Matnda BIR NECHTA buyurtma bo'lishi mumkin (har xil mijozlar / alohida buyurtmalar). Har bir ALOHIDA buyurtmani "orders" massivida alohida element qilib qaytar. Agar matnda bitta buyurtma bo'lsa — massivda bitta element bo'ladi. Buyurtmalar bo'sh qatorlar, raqamlash (1., 2., -) yoki har xil mijoz nomi/telefoni bilan ajralishi mumkin. Bitta mijozning bir nechta mahsulotini AJRATMA — u bitta buyurtma.`;

// Rasm (vision) orqali ko'p-buyurtma ekstraksiya. Matnли versiyaga rasmни
// o'qish yo'riqnomasi qo'shiladi. Sxema BIR XIL (RawExtraction).
const EXTRACT_MULTI_VISION_SYSTEM = `${EXTRACT_MULTI_SYSTEM}

MANBA — RASM: Ma'lumot foydalanuvchi yuborgan RASM(lar) ichida (buyurtma varag'i, qo'lyozma, skrinshot yoki chek bo'lishi mumkin). Rasmдаги matnни diqqat bilan o'qib, mijoz ismi, telefon(lar), manzil/tuman, mahsulot(lar) va narxni ajrat.
- Telefon raqamlarини xato o'qimaslikка e'tibor ber (raqamlar aniq bo'lsin).
- Rasm noaniq/o'qib bo'lmaydigan joyni TO'QIMA — o'sha maydonni bo'sh qoldir (operator to'ldiradi).
- Rasmда buyurtма bo'lmasa (tasodifiy rasm) — bo'sh "orders": [] qaytar.`;

// ─── LLM-disambiguation: fuzzy string-moslik noaniq qolgan mahsulotlarni
//     Claude SEMANTIK tushunish bilan tanlaydi ("krem" -> "Yuz kremi").
//     Xavfsiz: Claude faqat RAQAM (nomzod indeksi) qaytaradi; UUID'ni KOD
//     nomzod ro'yxatidan oladi — model UUID to'qiy olmaydi.
const DISAMBIG_SYSTEM = `Sen buyurtma yordamchisisan. Mijoz yozgan mahsulot nomiga market katalogidan ENG MOS nomzodni tanlaysan.
QOIDALAR:
- Har mahsulot uchun nomzodlar raqamlangan ([1], [2], ...). AYNAN shu mahsulotni bildiradigan nomzodning raqamini (choice) qaytar.
- Semantik mos kel: "krem" -> "Yuz kremi" bo'lishi mumkin; "changyutgich" -> "Chang yutgich".
- LEKIN o'lcham/model/hajm/rang aniq FARQ qilsa mos EMAS: "700 gr" != "500 gr", "A51" != "A50", "50ml" != "100ml".
- Agar hech bir nomzod aniq mos kelmasa -> choice=0 (operator qo'lда tanlaydi).
- Hech narsa to'qima; faqat berilgan nomzodlardan tanla.`;

const DISAMBIG_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          item_index: { type: 'integer' },
          choice: { type: 'integer' },
        },
        required: ['item_index', 'choice'],
      },
    },
  },
  required: ['picks'],
};

// ─── LLM tuman-rezolyutsiya: deterministik string-moslik ojiz qolganda
//     (imlo xatosi, shaharcha/qishloq/mahalla, viloyatsiz o'xshash nomlar)
//     Opus'ning O'zbekiston geografiyasi bilimi bilan TO'G'RI tumanni tanlaydi.
//     Xavfsiz: model faqat RAQAM (ro'yxat indeksi) qaytaradi; district_id KOD
//     tomonda o'sha indeksdan olinadi — model UUID/tuman to'qiy olmaydi.
const DISTRICT_LLM_SYSTEM = `Sen O'zbekiston geografiyasini yaxshi biladigan yetkazib berish yordamchisisan. Mijoz manzilidan yetkazish TUMAN yoki SHAHRINI aniqlaysan.
QOIDALAR:
- Quyidagi tuman/shaharlar raqamlangan ro'yxat sifatida beriladi ([N] Viloyat — Tuman/Shahar). Manzilga AYNAN TO'G'RI keladiganning raqamini (choice) qaytar.
- IMLO XATOSINI tuzat: "xojaobd" -> "Xo'jaobod", "chilonzr" -> "Chilonzor".
- SHAHARCHA / QISHLOQ / MAHALLA (MFY) / mavze yozilgan bo'lsa — u QAYSI tumanga qarashli ekanini O'Z BILIMING bilan aniqlab, o'sha tumanni tanla.
- ⚠️ ENG MUHIM — VILOYAT MOSLIGI: agar manzilda VILOYAT aytilgan bo'lsa ("Viloyat (agar aytilgan bo'lsa)" qatorida), FAQAT O'SHA VILOYATdagi tumanni tanla. Boshqa viloyatdagi o'xshash nomli tumanni HECH QACHON tanlama. Ro'yxatda o'sha viloyatда mos tuman bo'lmasa -> choice=0 (boshqa viloyatdan OLMA). Masalan manzil "Toshkent shahri Xonobod" bo'lsa va ro'yxatда Toshkentда "Xonobod" bo'lmasa — Andijondagi "Xo'jaobod"ni tanlama, choice=0 qaytar.
- VILOYAT aytilmagan bo'lsa, tuman nomidan qaysi viloyatда ekanini bil va AYNAN to'g'ri viloyatdagi tumanni tanla. O'xshash nomli tumanlarni ARALASHTIRMA.
- ISHONCH BO'LMASA — TO'QIMA: mos tuman umuman bo'lmasa, YOKI bir nechta bir xil ehtimolli variant bo'lsa (aniq ajrata olmasang), YOKI faqat taxminan o'xshasa -> choice=0. Noto'g'ri tanlashдан ko'ra 0 (operator to'ldiradi) YAXSHIROQ.
- Hech narsa to'qima; faqat ro'yxatdagi raqamlardan tanla.`;

const DISTRICT_LLM_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    choice: { type: 'integer' },
  },
  required: ['choice'],
};

// Narx shu chegaradan KAM bo'lsa shubhali (masalan 1 mln -> 1000, 1.2 mln ->
// 1200 kabi "ming"ni tushirib o'qish) — operator TASDIQLAMAGUNCHA kamchilik.
// 0 ham shu yerga tushadi (bepul buyurtma — tasdiqlansin). >= chegara to'g'ri.
export const PRICE_CONFIRM_THRESHOLD = 10000;

export interface OrderPreviewItem {
  name: string;
  quantity: number;
  product_id?: string;
  resolved_name?: string;
  candidates?: { id: string; name: string }[];
}

export interface OrderPreview {
  customer_name?: string;
  phone_number?: string;
  extra_number?: string;
  district_id?: string;
  district_name?: string; // DB'dagi tuman/shahar nomi
  region_id?: string;
  region_name?: string; // DB'dagi viloyat nomi
  region_given?: boolean; // matnda viloyat bor edimi (xabar uchun)
  district_candidates?: {
    id: string;
    label: string;
    region_name?: string;
    district_name?: string;
  }[];
  address?: string;
  items: OrderPreviewItem[];
  total_price?: number;
  comment?: string;
  operator?: string;
  where_deliver?: 'center' | 'address';
  is_replacement?: boolean;
  replaced_order_id?: string;
  replacement_candidates?: {
    id: string;
    order_number: number;
    created_at: number;
    total_price: number;
    items: string;
  }[];
  ready: boolean;
  issues: string[];
  created?: boolean; // bot: bu buyurtma yaratildimi (jonli xulosa hisobi uchun)
  price_confirmed?: boolean; // operator kichik/0 narxni ATAYLAB tasdiqladimi
}

export interface ConfirmedOrder {
  customer_name: string;
  phone_number: string;
  extra_number?: string;
  district_id: string;
  address?: string;
  order_item_info: { product_id: string; quantity: number }[];
  total_price: number;
  comment?: string;
  operator?: string;
  where_deliver?: Where_deliver;
  replaced_order_id?: string;
}

export interface ResolvedOperator {
  user: UserEntity;
  marketId: string;
  jwt: JwtPayload;
}

@Injectable()
export class AiOrderService {
  constructor(
    private readonly claude: ClaudeService,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(DistrictEntity)
    private readonly districtRepo: Repository<DistrictEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly aiBalance: AiBalanceService,
    private readonly logger: MyLogger,
  ) {}

  // Parse (tahlil) throttle: bir buyurtmani ko'p marta qayta tahlil qilish
  // Claude'ni behuda ishlatadi. Har market uchun BEPUL tahlillar soni; undan
  // ortig'i 1 buyurtma narxida yechiladi (telegram botdagi 3-urinish mantig'i).
  private readonly parseAttempts = new Map<
    string,
    { count: number; ts: number }
  >();
  private static readonly PARSE_FREE_LIMIT = 3;
  private static readonly PARSE_WINDOW_MS = 30 * 60 * 1000;

  isEnabled(): boolean {
    return this.claude.isEnabled();
  }

  // ─── Platforma (web) uchun: matndan AI buyurtma yaratish ───
  // Foydalanuvchi roliga qarab marketni aniqlab, balansdan yechadi (ozod
  // rollar bepul), extract+resolve qiladi; to'liq bo'lsa yangi customer +
  // createOrder (status NEW). To'liqsiz/xato bo'lsa pul qaytariladi.
  async createForPlatform(
    text: string,
    user: JwtPayload,
    bodyMarketId?: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    order?: unknown;
    balance?: number;
    price?: number;
    missing?: string[];
    draft?: Record<string, unknown>;
  }> {
    if (!this.isEnabled()) return { ok: false, reason: 'ai_off' };

    // Market aniqlash
    let marketId: string | undefined;
    if (user.role === Roles.MARKET) {
      marketId = user.id;
    } else if (user.role === Roles.OPERATOR) {
      const op = await this.userRepo.findOne({ where: { id: user.id } });
      marketId = op?.market_id || undefined;
    } else {
      marketId = bodyMarketId; // admin/registrator/superadmin market tanlaydi
    }
    if (!marketId) return { ok: false, reason: 'no_market' };

    // Balansdan yechish (ozod rollar bepul)
    const exempt = this.aiBalance.isExemptRole(user.role as Roles);
    let charge: { reason: string; balance: number; price: number } | null =
      null;
    if (!exempt) {
      charge = await this.aiBalance.chargeForOrder(marketId, {
        actor: user.id,
      });
      if (charge.reason !== 'ok') {
        return {
          ok: false,
          reason: charge.reason,
          balance: charge.balance,
          price: charge.price,
        };
      }
    }

    const draft = await this.extractDraft(text);
    if (!draft) {
      if (charge)
        await this.aiBalance.refund(marketId, charge.price, { actor: user.id });
      return { ok: false, reason: 'ai_error' };
    }
    await this.resolveDraft(draft, marketId);

    const missing = this.missingRequired(draft);
    const next = this.firstUnresolved(draft);
    if (missing.length || next) {
      // to'liq emas — pul qaytariladi, foydalanuvchi aniqlashtiradi
      if (charge)
        await this.aiBalance.refund(marketId, charge.price, { actor: user.id });
      return {
        ok: false,
        reason: 'incomplete',
        missing,
        draft: this.publicDraft(draft),
      };
    }

    // To'liq — yangi customer + createOrder (status NEW)
    const customer = await this.userRepo.save(
      this.userRepo.create({
        name: draft.customer_name,
        phone_number: draft.phone_number,
        extra_number: draft.extra_number,
        district_id: draft.district_id,
        address: draft.address,
        role: Roles.CUSTOMER,
      }),
    );

    try {
      const dto: CreateOrderDto = {
        customer_id: customer.id,
        market_id: marketId,
        order_item_info: draft.items.map((i) => ({
          product_id: i.product_id as string,
          quantity: i.quantity,
        })),
        total_price: draft.total_price as number,
        district_id: draft.district_id,
        comment: draft.comment,
        where_deliver: Where_deliver.CENTER,
      } as CreateOrderDto;

      const order = await this.orderService.createOrder(
        dto,
        user,
        OrderCreatedSource.AI,
      );
      return { ok: true, order, balance: charge?.balance };
    } catch (err) {
      // createOrder xato berdi (masalan add_order o'chiq / operator telefoni
      // majburiy) — orphan customer'ni tozalab, yechilgan pulni qaytaramiz.
      try {
        await this.userRepo.delete(customer.id);
      } catch {
        /* ignore */
      }
      if (charge) {
        await this.aiBalance.refund(marketId, charge.price, { actor: user.id });
      }
      this.logger.log(
        `createForPlatform createOrder xato: ${(err as Error).message}`,
        'AiOrder',
      );
      return { ok: false, reason: 'create_failed' };
    }
  }

  // Platforma: joriy foydalanuvchi uchun AI mavjudmi (market uchun balans
  // tekshiriladi; admin/registrator ozod — doim mavjud).
  async aiAvailabilityForUser(user: JwtPayload): Promise<{
    available: boolean;
    exempt?: boolean;
    enabled?: boolean;
    balance?: number;
    price?: number;
    reason?: string;
  }> {
    if (!this.isEnabled()) return { available: false, reason: 'ai_off' };
    if (this.aiBalance.isExemptRole(user.role as Roles)) {
      return { available: true, exempt: true };
    }
    let marketId: string | undefined;
    if (user.role === Roles.MARKET) {
      marketId = user.id;
    } else if (user.role === Roles.OPERATOR) {
      const op = await this.userRepo.findOne({ where: { id: user.id } });
      marketId = op?.market_id || undefined;
    }
    if (!marketId) return { available: false, reason: 'no_market' };
    const state = await this.aiBalance.getState(marketId);
    if (!state) return { available: false, reason: 'no_market' };
    const available = state.enabled && state.balance >= state.price;
    return {
      available,
      enabled: state.enabled,
      balance: state.balance,
      price: state.price,
      reason: available
        ? undefined
        : !state.enabled
          ? 'disabled'
          : 'insufficient',
    };
  }

  // Frontend'ga ko'rsatish uchun draftning ochiq versiyasi
  private publicDraft(draft: AiOrderDraft): Record<string, unknown> {
    return {
      customer_name: draft.customer_name,
      phone_number: draft.phone_number,
      district_label: draft.district_label,
      district_resolved: !!draft.district_id,
      district_candidates: draft.district_candidates,
      items: draft.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        resolved_name: i.resolved_name,
        resolved: !!i.product_id,
        candidates: i.candidates,
      })),
      total_price: draft.total_price,
      comment: draft.comment,
    };
  }

  // ─── Operator/market'ni telegram_id bo'yicha aniqlash ───
  async resolveOperator(
    telegramId: number | undefined,
  ): Promise<ResolvedOperator | null> {
    if (!telegramId) return null;
    const user = await this.userRepo.findOne({
      where: { telegram_id: telegramId, is_deleted: false },
    });
    if (!user) return null;
    if (user.role !== Roles.MARKET && user.role !== Roles.OPERATOR) return null;

    const marketId = user.role === Roles.MARKET ? user.id : user.market_id;
    if (!marketId) return null;

    return {
      user,
      marketId,
      jwt: { id: user.id, role: user.role, status: user.status },
    };
  }

  // ─── 1-faza: EKSTRAKSIYA (Claude, faqat nomlar) ───
  async extractDraft(text: string): Promise<AiOrderDraft | null> {
    const raw = await this.claude.extractJson<RawExtraction>({
      system: EXTRACT_SYSTEM,
      userText: text,
      schema: EXTRACT_SCHEMA,
      meta: { feature: 'order_extract', requestArea: 'order' },
    });
    if (!raw) return null;
    return this.rawToDraft(raw);
  }

  private rawToDraft(raw: RawExtraction): AiOrderDraft {
    const items: AiDraftItem[] = (raw.items || [])
      .filter((i) => i && typeof i.name === 'string' && i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
      }));

    // Telefon: asosiy bo'sh bo'lsa, qo'shimcha raqamni asosiy qilamiz (yagona
    // raqam extra_number'ga tushib qolsa buyurtma bloklanmasin).
    const phone = this.normalizePhone(raw.phone_number);
    const extra = this.normalizePhone(raw.extra_number);

    return {
      nonce: randomBytes(4).toString('hex'),
      // Mijoz ismi matnda bo'lmasa buyurtma bloklanmasin — "Mijoz" default
      // qo'yiladi (operator kartada o'zgartira oladi). rawToDraft ham bot
      // (parseOrders), ham platforma (extractDraft) uchun yagona nuqta, shuning
      // uchun default shu yerда — preview/DTO/@IsNotEmpty hammasidan o'tadi.
      customer_name: raw.customer_name?.trim() || 'Mijoz',
      phone_number: phone || extra,
      extra_number: phone ? extra : undefined,
      region_name: raw.region_name?.trim() || undefined,
      district_name: raw.district_name?.trim() || undefined,
      address: raw.address?.trim() || undefined,
      full_address: raw.full_address?.trim() || undefined,
      items,
      total_price:
        raw.total_price != null && Number(raw.total_price) > 0
          ? Math.round(Number(raw.total_price))
          : undefined,
      comment: raw.comment?.trim() || undefined,
      where_deliver:
        raw.where_deliver === 'address'
          ? 'address'
          : raw.where_deliver === 'center'
            ? 'center'
            : undefined,
      is_replacement: raw.is_replacement === true,
      operator: raw.operator?.replace(/^#+/, '').trim() || undefined,
    };
  }

  // ─── Ko'p buyurtma: matndan BIR NECHTA buyurtmani ajratib, har birini
  //     rezolyutsiya qiladi va tasdiqlash uchun preview qaytaradi (charge YO'Q).
  async parseOrders(
    text: string,
    marketId: string,
    defaultTariff?: Where_deliver,
    images?: ClaudeImageInput[],
  ): Promise<OrderPreview[]> {
    // Rasm(lar) berilsa vision model bilan (Sonnet) — rasmдаги matn o'qiladi.
    // Faqat matn bo'lsa odatдаги Opus ekstraksiya modeli.
    const hasImages = !!images?.length;
    const res = await this.claude.extractJson<{ orders: RawExtraction[] }>({
      system: hasImages ? EXTRACT_MULTI_VISION_SYSTEM : EXTRACT_MULTI_SYSTEM,
      userText: hasImages && !text ? '(rasm ichidagi ma\'lumotdan o\'qing)' : text,
      schema: EXTRACT_MULTI_SCHEMA,
      maxTokens: 16000, // ko'p buyurtma (30+) JSON'i kesilib qolmasin
      model: hasImages ? config.AI_ORDER_VISION_MODEL : undefined,
      images,
      meta: {
        feature: hasImages ? 'order_extract_image' : 'order_extract_multi',
        requestArea: 'order',
      },
    });
    if (!res || !Array.isArray(res.orders)) return [];

    // Yetkazish turi — MARKET default'iga qarab (AI taxminiga emas).
    const marketDefault: 'center' | 'address' =
      defaultTariff === Where_deliver.ADDRESS ? 'address' : 'center';

    // Ko'p buyurtma uchun tuman va mahsulotlarni BIR MARTA yuklaymiz (N+1 emas).
    const [districts, products] = await Promise.all([
      this.districtRepo.find({ relations: ['region'] }),
      this.productRepo.find({ where: { user_id: marketId, isDeleted: false } }),
    ]);

    const previews: OrderPreview[] = [];
    for (const raw of res.orders) {
      const draft = this.rawToDraft(raw);
      // Bo'sh-element skip: ism endi doim to'la ("Mijoz" default) — shuning uchun
      // haqiqiy buyurtma signali telefon YOKI mahsulot. Ikkalasi ham yo'q bo'lsa
      // — bu bo'sh/axlat qator (bitta ism qoldig'i), o'tkazib yuboramiz.
      if (!draft.phone_number && !draft.items.length) {
        continue; // bo'sh element
      }
      draft.where_deliver = marketDefault; // market default (operator kartada o'zgartiradi)
      await this.resolveDraft(draft, marketId, { districts, products });
      if (draft.is_replacement) {
        await this.resolveReplacement(draft, marketId);
      }
      previews.push(this.toPreview(draft));
    }
    return previews;
  }

  // Almashtirish: telefon bo'yicha shu marketning SOTILGAN eski buyurtmalarini
  // topib, eng so'nggisini avto-tanlaydi (operator tasdiqlaydi/o'zgartiradi).
  private async resolveReplacement(
    draft: AiOrderDraft,
    marketId: string,
  ): Promise<void> {
    const phone9 = (draft.phone_number || '').replace(/\D/g, '').slice(-9);
    if (phone9.length < 9) return; // to'liq 9 raqam bo'lsagina ishonchli qidiruv

    const DELIVERED = [
      Order_status.SOLD,
      Order_status.PAID,
      Order_status.PARTLY_PAID,
      Order_status.CLOSED,
    ];
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoin('o.customer', 'customer')
      .where('o.user_id = :m', { m: marketId })
      .andWhere('o.deleted_at IS NULL')
      .andWhere('o.is_replacement_return = false')
      .andWhere('o.status IN (:...s)', { s: DELIVERED })
      // Saqlangan telefon ajratuvchili bo'lishi mumkin (+998 90 111 22 33) —
      // faqat raqamlarni qoldirib solishtiramiz.
      .andWhere(
        "regexp_replace(customer.phone_number, '[^0-9]', '', 'g') LIKE :q",
        { q: `%${phone9}%` },
      )
      .orderBy('o.created_at', 'DESC')
      .take(10)
      .getMany();

    if (!rows.length) return;

    draft.replacement_candidates = rows.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      created_at: Number(o.created_at),
      total_price: Number(o.total_price) || 0,
      items: (o.items || [])
        .map((it) => `${it.product?.name || 'mahsulot'} x${it.quantity}`)
        .join(', '),
    }));
    // Eng so'nggisini avto-tanlaymiz (operator kartada o'zgartira oladi)
    draft.replaced_order_id = rows[0].id;
  }

  // Kamchiliklar ro'yxati — YAGONA manba (toPreview ham, bot ichidagi tuzatish
  // recomputePreview ham shuni ishlatadi, mantiq bir joyda turadi).
  private computeIssues(p: {
    customer_name?: string;
    phone_number?: string;
    district_id?: string;
    district_candidates?: { id: string }[];
    region_given?: boolean;
    is_replacement?: boolean;
    total_price?: number;
    price_confirmed?: boolean;
    items: {
      name: string;
      product_id?: string;
      candidates?: { id: string }[];
    }[];
  }): string[] {
    const issues: string[] = [];
    if (!p.customer_name) issues.push("mijoz ismi yo'q");
    if (!p.phone_number) issues.push("telefon yo'q");
    if (!p.district_id) {
      if (p.district_candidates?.length) {
        issues.push('tuman/shahar tanlang');
      } else if (p.region_given) {
        // Viloyat berilgan, lekin tuman/shahar aniqlanmagan
        issues.push('shahar/tuman kiritilmagan');
      } else {
        issues.push('tuman/shahar topilmadi');
      }
    }
    // Narx: bo'sh (null) — har doim kamchilik. Aks holda 0 yoki < 10 000 shubhali
    // ("1 mln"->1000 kabi xato) — operator ATAYLAB tasdiqlamaguncha (price_confirmed)
    // kamchilik. 0 ham ruxsat (bepul buyurtma), lekin tasdiq orqali. >= 10 000 to'g'ri.
    if (p.is_replacement) {
      if (p.total_price == null) issues.push("narx yo'q (0 bo'lsa 0 yozing)");
    } else if (p.total_price == null) {
      issues.push("narx yo'q");
    } else if (p.total_price < PRICE_CONFIRM_THRESHOLD && !p.price_confirmed) {
      issues.push(
        p.total_price === 0
          ? 'narx 0 (bepul) — tasdiqlang'
          : 'narx juda kichik — tasdiqlang (mingda?)',
      );
    }
    if (!p.items.length) issues.push("mahsulot yo'q");
    p.items.forEach((it) => {
      if (!it.product_id) {
        issues.push(
          `"${it.name}" ${it.candidates?.length ? 'aniqlanmagan' : "katalogda yo'q"}`,
        );
      }
    });
    return issues;
  }

  // Bot ichida tuzatilgach preview'ning issues/ready'sini qayta hisoblaydi (in-place).
  recomputePreview(p: OrderPreview): void {
    p.issues = this.computeIssues(p);
    p.ready = p.issues.length === 0;
  }

  private toPreview(draft: AiOrderDraft): OrderPreview {
    const preview: OrderPreview = {
      customer_name: draft.customer_name,
      phone_number: draft.phone_number,
      extra_number: draft.extra_number,
      district_id: draft.district_id,
      district_name: draft.district_resolved_name,
      region_id: draft.region_id,
      region_name: draft.region_label,
      region_given: !!draft.region_name,
      district_candidates: draft.district_candidates,
      address: draft.address,
      items: draft.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        product_id: i.product_id,
        resolved_name: i.resolved_name,
        candidates: i.candidates,
      })),
      total_price: draft.total_price,
      comment: draft.comment,
      operator: draft.operator,
      where_deliver: draft.where_deliver,
      is_replacement: draft.is_replacement,
      replaced_order_id: draft.replaced_order_id,
      replacement_candidates: draft.replacement_candidates,
      ready: false,
      issues: [],
    };
    preview.issues = this.computeIssues(preview);
    preview.ready = preview.issues.length === 0;
    return preview;
  }

  // Bot ichida bitta tuman/shahar matnini qayta rezolyutsiya (foydalanuvchi
  // yozgan "Andijon Bo'ston" kabi). Faqat DB — Claude chaqirilmaydi (bepul).
  async resolveDistrictInput(
    text: string,
    cache?: DistrictEntity[],
  ): Promise<{
    district_id?: string;
    district_name?: string;
    region_id?: string;
    region_name?: string;
    region_given: boolean;
    district_candidates?: OrderPreview['district_candidates'];
  }> {
    const draft = {
      nonce: '',
      district_name: text,
      full_address: text,
      items: [],
    } as AiOrderDraft;
    await this.resolveDistrict(draft, cache);
    return {
      district_id: draft.district_id,
      district_name: draft.district_resolved_name,
      region_id: draft.region_id,
      region_name: draft.region_label,
      region_given: !!draft.region_id,
      district_candidates: draft.district_candidates,
    };
  }

  // Bot ichida bitta mahsulot nomini qayta rezolyutsiya. Faqat DB (fuzzy).
  async resolveItemInput(
    name: string,
    quantity: number,
    marketId: string,
    cache?: ProductEntity[],
  ): Promise<OrderPreviewItem> {
    const draft = {
      nonce: '',
      items: [{ name, quantity: quantity > 0 ? quantity : 1 }],
    } as AiOrderDraft;
    await this.resolveItems(draft, marketId, cache);
    const it = draft.items[0];
    return {
      name: it.name,
      quantity: it.quantity,
      product_id: it.product_id,
      resolved_name: it.resolved_name,
      candidates: it.candidates,
    };
  }

  // Telefon matnini +998XXXXXXXXX ga keltiradi (bot tuzatishi uchun ochiq wrapper).
  normalizePhoneInput(input: string): string | undefined {
    return this.normalizePhone(input);
  }

  // Tayyor preview'ni yaratishga tayyor ConfirmedOrder'ga aylantiradi (bot
  // "✅ Yaratish" tugmasi uchun). Faqat ready buyurtmalar uchun chaqiriladi —
  // bu yerda barcha majburiy maydonlar mavjud deb hisoblanadi.
  previewToConfirmed(p: OrderPreview): ConfirmedOrder {
    return {
      customer_name: p.customer_name || '',
      phone_number: p.phone_number || '',
      extra_number: p.extra_number,
      district_id: p.district_id || '',
      address: p.address,
      order_item_info: p.items
        .filter((i) => i.product_id)
        .map((i) => ({
          product_id: i.product_id as string,
          quantity: i.quantity,
        })),
      total_price: p.total_price ?? 0,
      comment: p.comment,
      operator: p.operator,
      where_deliver:
        p.where_deliver === 'address'
          ? Where_deliver.ADDRESS
          : Where_deliver.CENTER,
      // Avto-topilgan eski buyurtma (almashtirish) — operatorning "Yaratish"
      // bosishi tasdiq hisoblanadi.
      replaced_order_id: p.replaced_order_id,
    };
  }

  // Parse endpoint uchun: marketni aniqlab, AI mavjudligini tekshirib parseOrders.
  async parseForUser(
    text: string,
    user: JwtPayload,
    bodyMarketId?: string,
    images?: ClaudeImageInput[],
  ): Promise<{
    ok: boolean;
    reason?: string;
    orders?: OrderPreview[];
    balance?: number;
    price?: number;
    reanalysis_charged?: boolean; // 3-tahlildan oshgani uchun pul yechildimi
  }> {
    if (!this.isEnabled()) return { ok: false, reason: 'ai_off' };
    const marketId = await this.resolveMarketId(user, bodyMarketId);
    if (!marketId) return { ok: false, reason: 'no_market' };

    let reanalysisCharged = false;
    let reanalysisPrice = 0;
    if (!this.aiBalance.isExemptRole(user.role as Roles)) {
      const state = await this.aiBalance.getState(marketId);
      if (!state || !state.enabled) return { ok: false, reason: 'disabled' };
      if (state.balance < state.price) {
        return {
          ok: false,
          reason: 'insufficient',
          balance: state.balance,
          price: state.price,
        };
      }

      // Qayta tahlil throttle: BEPUL_LIMIT tahlildan oshsa 1 buyurtma narxida
      // yechiladi va bepul hisob nolga tushadi (keyingi 3 yana bepul).
      const now = Date.now();
      const rec = this.parseAttempts.get(marketId);
      const attempts =
        rec && now - rec.ts <= AiOrderService.PARSE_WINDOW_MS
          ? rec.count + 1
          : 1;
      if (attempts > AiOrderService.PARSE_FREE_LIMIT) {
        // Bepul hisobni AVVAL (await'dan oldin) nolga tushiramiz — parallel
        // parse ikki marta charge qilmasin: racing so'rov count:0 o'qib bepul
        // yo'ldan ketadi (double-charge oldini oladi).
        this.parseAttempts.set(marketId, { count: 0, ts: now });
        const charge = await this.aiBalance.chargeForOrder(marketId, {
          actor: user.id,
        });
        if (charge.reason !== 'ok') {
          return {
            ok: false,
            reason: 'insufficient',
            balance: charge.balance,
            price: charge.price,
          };
        }
        reanalysisCharged = true;
        reanalysisPrice = charge.price;
      } else {
        this.parseAttempts.set(marketId, { count: attempts, ts: now });
      }
    }

    // Market default yetkazish tarifi
    const marketRow = await this.userRepo.findOne({ where: { id: marketId } });
    const orders = await this.parseOrders(
      text,
      marketId,
      marketRow?.default_tariff,
      images,
    );
    if (!orders.length) {
      // AI o'qiy olmadi (bizning xatomiz) — qayta-tahlil uchun yechilgan pulni
      // qaytaramiz (createForPlatform ai_error refund mantig'i kabi).
      if (reanalysisCharged) {
        await this.aiBalance.refund(marketId, reanalysisPrice, {
          actor: user.id,
        });
      }
      return { ok: false, reason: 'ai_error' };
    }
    return { ok: true, orders, reanalysis_charged: reanalysisCharged };
  }

  // Tasdiqlangan buyurtmalarni yaratish (har biriga alohida charge + create).
  // `source` — buyurtma manbasi:
  //   'platform' (default) → to'g'ridan NEW, guruhga YUBORILMAYDI (web platforma);
  //   'bot'                → CREATE guruh bo'lsa CREATED+guruhga ✅/❌ (Telegram bot).
  // Default 'platform' — yangi chaqiruvchi unutsa ham buyurtma xato guruhga
  // tushmaydi (guruh-tasdiqlash faqat bot uchun ataylab yoqiladi).
  async createConfirmedOrders(
    orders: ConfirmedOrder[],
    user: JwtPayload,
    bodyMarketId?: string,
    source: 'platform' | 'bot' = 'platform',
  ): Promise<{
    results: {
      ok: boolean;
      reason?: string;
      order_number?: number;
      balance?: number;
      customer_name?: string;
      pending_approval?: boolean; // guruh tasdiqiga yuborildimi (CREATED)
    }[];
  }> {
    const marketId = await this.resolveMarketId(user, bodyMarketId);
    if (!marketId) {
      return {
        results: orders.map((o) => ({
          ok: false,
          reason: 'no_market',
          customer_name: o.customer_name,
        })),
      };
    }
    const exempt = this.aiBalance.isExemptRole(user.role as Roles);
    const results: {
      ok: boolean;
      reason?: string;
      order_number?: number;
      balance?: number;
      customer_name?: string;
      pending_approval?: boolean;
    }[] = [];
    // Partiya ichida bir xil buyurtma ikki marta charge/yaratilmasin (dublikat
    // qatorlar) — imzo faqat MUVAFFAQIYATLI yaratilgach belgilanadi.
    const created = new Set<string>();
    // Kvitansiya uchun market default operator telefoni (mavjud bo'lsa).
    const marketRow = await this.userRepo.findOne({ where: { id: marketId } });
    const defaultOperatorPhone =
      marketRow?.default_operator_phone?.trim() || undefined;

    for (const o of orders) {
      const sig = this.orderSignature(o);
      if (created.has(sig)) {
        results.push({
          ok: false,
          reason: 'duplicate',
          customer_name: o.customer_name,
        });
        continue;
      }

      // Narx bo'sh (null) yoki manfiy bo'lsa rad etamiz. 0 ATAYLAB ruxsat etiladi
      // (bepul buyurtma — sovg'a/aksiya); operator uni kartada tasdiqlagan bo'ladi.
      if (
        !o.replaced_order_id &&
        (o.total_price == null || o.total_price < 0)
      ) {
        results.push({
          ok: false,
          reason: 'invalid_price',
          customer_name: o.customer_name,
        });
        continue;
      }

      // Cross-request DB dublikat (qayta tahlil -> qayta yaratish, retry) —
      // charge'DAN OLDIN tekshiramiz (dublikat uchun pul yechilmasin).
      if (await this.findRecentDuplicate(marketId, o)) {
        results.push({
          ok: false,
          reason: 'duplicate',
          customer_name: o.customer_name,
        });
        continue;
      }

      let charge: { reason: string; balance: number; price: number } | null =
        null;
      if (!exempt) {
        charge = await this.aiBalance.chargeForOrder(marketId, {
          actor: user.id,
        });
        if (charge.reason !== 'ok') {
          results.push({
            ok: false,
            reason: charge.reason,
            balance: charge.balance,
            customer_name: o.customer_name,
          });
          continue;
        }
      }

      // Charge'dan keyingi HAMMA narsa (customer.save + createOrder) himoyalangan:
      // istalgan xato bo'lsa pul qaytariladi, orphan o'chiriladi, loop TO'XTAMAYDI.
      let customerId: string | undefined;
      try {
        const customer = await this.userRepo.save(
          this.userRepo.create({
            name: o.customer_name,
            phone_number: o.phone_number,
            extra_number: o.extra_number,
            district_id: o.district_id,
            address: o.address,
            role: Roles.CUSTOMER,
          }),
        );
        customerId = customer.id;

        const dto: CreateOrderDto = {
          customer_id: customer.id,
          market_id: marketId,
          order_item_info: o.order_item_info,
          total_price: o.total_price,
          district_id: o.district_id,
          comment: o.comment,
          where_deliver:
            o.where_deliver ??
            marketRow?.default_tariff ??
            Where_deliver.CENTER,
          operator: o.operator,
          operator_phone: defaultOperatorPhone,
          replaced_order_id: o.replaced_order_id,
        } as CreateOrderDto;
        // Kanal manbasi: bot oqimi -> 'bot', web platforma AI -> 'ai'.
        const createdSource =
          source === 'bot' ? OrderCreatedSource.BOT : OrderCreatedSource.AI;
        const res = (await this.orderService.createOrder(
          dto,
          user,
          createdSource,
        )) as {
          data?: { order_number?: number; id?: string };
        };
        created.add(sig);

        // Guruh-tasdiqlashga yo'naltirish FAQAT bot manbasi uchun: CREATE guruh
        // bo'lsa CREATED+guruhga ✅/❌; aks holda NEW. Platforma (web) buyurtmasi
        // to'g'ridan NEW qoladi — guruhga yuborilmaydi. Xato bo'lsa buyurtma
        // allaqachon yaratilgan — faqat loglanadi (create'ni buzmaydi).
        let pendingApproval = false;
        if (source === 'bot' && res?.data?.id) {
          try {
            const disp = await this.orderService.dispatchOrderForApproval(
              res.data.id,
            );
            pendingApproval = disp === 'created';
          } catch (dispErr) {
            this.logger.log(
              `dispatchOrderForApproval xato (order ${res.data.id}): ${(dispErr as Error).message}`,
              'AiOrder',
            );
          }
        }

        results.push({
          ok: true,
          order_number: res?.data?.order_number,
          balance: charge?.balance,
          customer_name: o.customer_name,
          pending_approval: pendingApproval,
        });
      } catch (err) {
        if (customerId) {
          try {
            await this.userRepo.delete(customerId);
          } catch {
            /* ignore */
          }
        }
        if (charge) {
          await this.aiBalance.refund(marketId, charge.price, {
            actor: user.id,
          });
        }
        this.logger.log(
          `createConfirmedOrders xato: ${(err as Error).message}`,
          'AiOrder',
        );
        results.push({
          ok: false,
          reason: 'create_failed',
          customer_name: o.customer_name,
        });
      }
    }
    // Buyurtma yaratildi — qayta-tahlil bepul hisobini tiklaymiz (bu buyurtma
    // "tugadi"; keyingisi uchun yana bepul tahlillar).
    if (results.some((r) => r.ok)) this.parseAttempts.delete(marketId);
    return { results };
  }

  // Buyurtma imzosi (partiya ichi dublikat aniqlash): telefon(oxirgi 9)+mahsulotlar
  // +narx+almashtirilayotgan eski buyurtma. replaced_order_id imzoga kiradi —
  // aks holda bir mijozning bir xil mahsulotli (narx 0) IKKI almashtirishi bitta
  // deb sanalib, ikkinchisi yaratilmay qolardi.
  private orderSignature(o: ConfirmedOrder): string {
    const phone = (o.phone_number || '').replace(/\D/g, '').slice(-9);
    const items = (o.order_item_info || [])
      .map((i) => `${i.product_id}:${i.quantity}`)
      .sort()
      .join(',');
    return `${phone}|${items}|${o.total_price}|${o.replaced_order_id ?? ''}`;
  }

  // Cross-request DB dublikat: yaqinda (2 daqiqa) shu market'da AYNAN shu
  // telefon+savat+narx bilan yaratilgan (o'chirilmagan, aktiv) buyurtma bormi?
  // Qayta tahlil -> qayta yaratish, tugmani ikki bosish, retry'ni bloklaydi.
  private async findRecentDuplicate(
    marketId: string,
    o: ConfirmedOrder,
  ): Promise<boolean> {
    const phone9 = (o.phone_number || '').replace(/\D/g, '').slice(-9);
    if (phone9.length < 9) return false;
    const incomingSig = this.orderSignature(o);
    const WINDOW_MS = 2 * 60 * 1000;
    const recent = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('o.user_id = :m', { m: marketId })
      .andWhere('o.deleted_at IS NULL')
      .andWhere('o.total_price = :p', { p: o.total_price })
      .andWhere('o.created_at >= :t', { t: Date.now() - WINDOW_MS })
      .andWhere('o.status IN (:...s)', {
        s: [
          Order_status.CREATED,
          Order_status.NEW,
          Order_status.RECEIVED,
          Order_status.ON_THE_ROAD,
          Order_status.WAITING,
        ],
      })
      .orderBy('o.created_at', 'DESC')
      .take(20)
      .getMany();
    return recent.some((cand) => {
      const cp9 = (cand.customer?.phone_number || '')
        .replace(/\D/g, '')
        .slice(-9);
      const citems = (cand.items || [])
        .map((it) => `${it.productId}:${it.quantity}`)
        .sort()
        .join(',');
      const candSig = `${cp9}|${citems}|${cand.total_price}|${
        cand.replacement_of_order_id ?? ''
      }`;
      return candSig === incomingSig;
    });
  }

  private async resolveMarketId(
    user: JwtPayload,
    bodyMarketId?: string,
  ): Promise<string | undefined> {
    if (user.role === Roles.MARKET) return user.id;
    if (user.role === Roles.OPERATOR) {
      const op = await this.userRepo.findOne({ where: { id: user.id } });
      return op?.market_id || undefined;
    }
    return bodyMarketId;
  }

  // Barcha viloyat + tuman/shaharlar (AI karta Select'lari uchun) — bitta so'rov.
  async getGeo(): Promise<{
    regions: { id: string; name: string }[];
    districts: { id: string; name: string; region_id: string }[];
  }> {
    const districts = await this.districtRepo.find({ relations: ['region'] });
    const regionsMap = new Map<string, { id: string; name: string }>();
    const outDistricts = districts.map((d) => {
      if (d.region) {
        regionsMap.set(d.region_id, { id: d.region_id, name: d.region.name });
      }
      return { id: d.id, name: d.name, region_id: d.region_id };
    });
    const regions = [...regionsMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    outDistricts.sort((a, b) => a.name.localeCompare(b.name));
    return { regions, districts: outDistricts };
  }

  // Market mahsulotlari (AI karta Select'i uchun — mahsulot topilmasa qo'lda tanlash).
  async getMarketProducts(
    user: JwtPayload,
    bodyMarketId?: string,
  ): Promise<{ id: string; name: string }[]> {
    const marketId = await this.resolveMarketId(user, bodyMarketId);
    if (!marketId) return [];
    const products = await this.productRepo.find({
      where: { user_id: marketId, isDeleted: false },
    });
    return products
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Bot tuzatishi uchun: marketning barcha mahsulotlari (marketId to'g'ridan-
  // to'g'ri — JwtPayload kerak emas). Mahsulot topilmaganда ro'yxat ko'rsatiladi.
  async listProductsForMarket(
    marketId: string,
  ): Promise<{ id: string; name: string }[]> {
    const products = await this.productRepo.find({
      where: { user_id: marketId, isDeleted: false },
    });
    return products
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── 2-faza: REZOLYUTSIYA (DETERMINISTIK DB moslash + LLM semantik fallback) ───
  // llmAssist (default ON): fuzzy string-moslik noaniq qoldirgan mahsulotlarni
  // Claude semantik tanlaydi. FAQAT to'lovli oqimlardan (createForPlatform,
  // parseOrders) chaqiriladi — bepul bot-tuzatish resolveItems'ni to'g'ridan
  // ishlatadi, bu yerga kirmaydi.
  async resolveDraft(
    draft: AiOrderDraft,
    marketId: string,
    cache?: {
      districts?: DistrictEntity[];
      products?: ProductEntity[];
      llmAssist?: boolean;
    },
  ): Promise<AiOrderDraft> {
    // Tumanlarni bir marta yuklab, ham deterministik ham LLM bosqichida qayta
    // ishlatamiz (N+1 emas).
    const districts =
      cache?.districts ??
      (await this.districtRepo.find({ relations: ['region'] }));
    await this.resolveDistrict(draft, districts);
    await this.resolveItems(draft, marketId, cache?.products);
    if (cache?.llmAssist !== false) {
      // Tuman deterministik hal bo'lmagan YOKI xavfli (viloyatsiz o'xshash nom)
      // bo'lsa — geografik LLM bilan to'g'rilaymiz; keyin mahsulot semantik moslik.
      await this.resolveDistrictWithLlm(draft, districts);
      await this.disambiguateItemsWithLlm(draft);
    }
    return draft;
  }

  // Deterministik tuman-moslik ojiz qolganда Opus geografiya bilimini ishga
  // soladi. Ishlaydi qachonki: (a) tuman hal bo'lmagan (district_id yo'q), YOKI
  // (b) matnda/inference'da VILOYAT yo'q (region_name bo'sh) — bu holda
  // deterministik butun-mamlakat fuzzy noto'g'ri viloyatga adashtirgan bo'lishi
  // mumkin, shuning uchun to'liq ro'yxat bilan tekshiramiz. Model faqat indeks
  // qaytaradi; district_id kod tomonда o'sha indeksdan olinadi (xavfsiz).
  private async resolveDistrictWithLlm(
    draft: AiOrderDraft,
    districts: DistrictEntity[],
  ): Promise<void> {
    if (!this.claude.isEnabled()) return;
    const placeText =
      `${draft.district_name || ''} ${draft.full_address || draft.address || ''}`.trim();
    if (!placeText) return; // umuman joy matni yo'q — tekshiradigan narsa yo'q

    // Xavfli (LLM tekshiruvi kerak) qachonki: tuman hal bo'lmagan; YOKI matnda
    // viloyat aytilmagan (region_name yo'q) — deterministik butun-mamlakat fuzzy
    // noto'g'ri viloyatga tushirgan bo'lishi mumkin; YOKI viloyat aytilgan-u DB
    // viloyatiga tushmagan (region_id yo'q) — tuman qidiruvi cheklanmagan.
    const risky = !draft.district_id || !draft.region_name || !draft.region_id;
    if (!risky) return; // viloyat ham, tuman ham ishonchli hal bo'lgan — ishonamiz

    // 1-urinish: viloyat ISHONCHLI ma'lum bo'lsa (ekstraksiya region_name
    // bergan/infer qilgan VA u DB'ga tushgan) — faqat o'sha viloyat pooli
    // (kichik, arzon; imlo xatosi bilan topilmagan tumanni topadi).
    const trustRegion = !!draft.region_name && !!draft.region_id;
    if (trustRegion) {
      // Viloyat ISHONCHLI — FAQAT shu viloyat ichida so'raymiz va shu bilan
      // TO'XTAYMIZ. Model 0 (mos yo'q) qaytarsa tuman bo'sh qoladi (operator
      // to'ldiradi); BOSHQA viloyatga O'TMAYMIZ. Bu "Toshkent Xonobod ->
      // Andijon Xo'jaobod" cross-region xatosini butunlay yopadi.
      const regionPool = districts.filter(
        (d) => d.region_id === draft.region_id,
      );
      if (regionPool.length) {
        await this.llmPickDistrict(draft, regionPool, placeText);
      }
      return;
    }
    // Viloyat BERILMAGAN/noaniq bo'lsagina butun mamlakat bo'ylab qidiramiz.
    // 200+ tumandan arzon model ishonchli tanlashi uchun avval NOM/manzil
    // o'xshashligi bo'yicha qisqa nomzodlar ro'yxatini (top-K) tuzamiz — imlo
    // xatoli tuman ham ro'yxatga tushadi, model to'g'risini (yoki 0) tanlaydi.
    // Shortlist chiqmasa (juda g'alati nom) — oxirgi chora to'liq ro'yxat.
    const shortlist = this.shortlistDistricts(draft, districts);
    if (shortlist.length) {
      await this.llmPickDistrict(draft, shortlist, placeText);
      return; // shortlistдан hal bo'ldi yoki noaniq (0) — operator tanlaydi
    }
    await this.llmPickDistrict(draft, districts, placeText);
  }

  // Manzil matniga (yozilgan tuman nomi + to'liq manzil) NOM/substring
  // o'xshashligi bo'yicha eng yaqin K ta tumanni tanlaydi — LLM fallback'ini
  // 200+ dan qisqa ishonchli ro'yxatga toraytiradi. Imlo xatoli nom ham
  // (past ball bilan) ro'yxatga tushadi. Umumiy — har case uchun alohida qoida yo'q.
  private shortlistDistricts(
    draft: AiOrderDraft,
    districts: DistrictEntity[],
    k = 30,
  ): DistrictEntity[] {
    const nameQ = this.normGeo(draft.district_name || '');
    const corpus = this.normGeo(
      `${draft.district_name || ''} ${draft.full_address || draft.address || ''}`,
    ).replace(/\s+/g, '');
    if (!nameQ && corpus.length < 4) return [];

    const scored = districts
      .map((d) => {
        const dn = this.normGeo(d.name);
        const dnFlat = dn.replace(/\s+/g, '');
        let s = 0;
        if (nameQ) s = Math.max(s, this.simRatio(dn, nameQ));
        if (corpus.length >= 4 && dnFlat.length >= 4) {
          s = Math.max(s, this.bestSubstringSim(corpus, dnFlat));
        }
        return { d, s };
      })
      .filter((x) => x.s > 0.3)
      .sort((a, b) => b.s - a.s);

    return scored.slice(0, k).map((x) => x.d);
  }

  // Berilgan pool ustida bitta LLM tanlash: raqamlangan ro'yxat -> model indeks
  // qaytaradi -> district_id KOD tomonда pool[indeks-1] dan olinadi (xavfsiz).
  // Muvaffaqiyat (tuman aniqlandi) bo'lsa true qaytaradi.
  private async llmPickDistrict(
    draft: AiOrderDraft,
    pool: DistrictEntity[],
    placeText: string,
  ): Promise<boolean> {
    if (!pool.length) return false;
    const list = pool
      .map((d, i) => `[${i + 1}] ${d.region?.name || '?'} — ${d.name}`)
      .join('\n');
    const userText =
      `Mijoz manzili: "${placeText}"\n` +
      `Viloyat (agar aytilgan bo'lsa): ${draft.region_name || 'aytilmagan'}\n` +
      `Tuman/shahar ro'yxati:\n${list}`;

    const res = await this.claude.extractJson<{ choice: number }>({
      system: DISTRICT_LLM_SYSTEM,
      userText,
      schema: DISTRICT_LLM_SCHEMA,
      model: config.AI_CLASSIFY_MODEL,
      maxTokens: 64,
      meta: { feature: 'order_district', requestArea: 'order' },
    });
    if (!res) return false;
    const k = Math.floor(Number(res.choice));
    if (k < 1 || k > pool.length) return false; // 0 = noaniq

    const d = pool[k - 1];
    draft.district_id = d.id;
    draft.district_resolved_name = d.name;
    draft.region_id = d.region_id;
    draft.region_label = d.region?.name || draft.region_label;
    draft.district_label = d.region?.name
      ? `${d.region.name}, ${d.name}`
      : d.name;
    draft.district_candidates = undefined;
    return true;
  }

  // Fuzzy noaniq qolgan (product_id yo'q, lekin nomzodlari bor) mahsulotlarni
  // Claude'ga bir marta yuboradi: mijoz yozgan nom + raqamlangan nomzodlar ->
  // model eng mos RAQAMni tanlaydi (yoki 0 = mos yo'q). Indeks bilan xavfsiz
  // (UUID kod tomonda olinadi). Ambiguouslik bo'lmasa umuman chaqirilmaydi.
  private async disambiguateItemsWithLlm(draft: AiOrderDraft): Promise<void> {
    if (!this.claude.isEnabled()) return;
    const targets = draft.items
      .map((it, idx) => ({ it, idx }))
      .filter((x) => !x.it.product_id && (x.it.candidates?.length ?? 0) > 0);
    if (!targets.length) return;

    const lines = targets
      .map((t) => {
        const cands = (t.it.candidates || [])
          .map((c, ci) => `[${ci + 1}] ${c.name}`)
          .join(', ');
        return `${t.idx}) Mijoz yozdi: "${t.it.name}" (${t.it.quantity} dona) -> nomzodlar: ${cands}`;
      })
      .join('\n');

    const res = await this.claude.extractJson<{
      picks: { item_index: number; choice: number }[];
    }>({
      system: DISAMBIG_SYSTEM,
      userText: lines,
      schema: DISAMBIG_SCHEMA,
      model: config.AI_CLASSIFY_MODEL,
      maxTokens: 512,
      meta: { feature: 'order_item_match', requestArea: 'order' },
    });
    if (!res || !Array.isArray(res.picks)) return;

    for (const pick of res.picks) {
      const item = draft.items[pick.item_index];
      if (!item || item.product_id) continue; // allaqachon hal bo'lgan / noto'g'ri indeks
      const cands = item.candidates || [];
      const k = Math.floor(Number(pick.choice));
      if (k >= 1 && k <= cands.length) {
        const chosen = cands[k - 1];
        item.product_id = chosen.id;
        item.resolved_name = chosen.name;
        item.candidates = undefined;
      }
    }
  }

  private async resolveDistrict(
    draft: AiOrderDraft,
    districtsCache?: DistrictEntity[],
  ): Promise<void> {
    // Ko'p buyurtma parse'ida bir marta yuklab, qayta ishlatamiz (N+1 emas).
    const districts =
      districtsCache ??
      (await this.districtRepo.find({ relations: ['region'] }));

    // 0. VILOYATNI mustaqil aniqlaymiz (tuman topilmasa ham viloyat qolsin).
    //    "Toshkent shahri" va "Toshkent viloyati" bir xil base-nomga ega —
    //    shuning uchun avval "shahri/viloyati" markerini SAQLAB aniq mos
    //    qidiramiz; bare "Toshkent" (noaniq) bo'lsa qoldiramiz — tuman aniqlaydi.
    if (draft.region_name) {
      const regions = new Map<string, { id: string; name: string }>();
      for (const d of districts) {
        if (d.region) {
          regions.set(d.region_id, { id: d.region_id, name: d.region.name });
        }
      }
      const list = [...regions.values()];
      const rqLight = this.lightNorm(draft.region_name);
      let region = list.find((r) => this.lightNorm(r.name) === rqLight);
      if (!region) {
        const base = this.normGeo(draft.region_name);
        const baseMatches = base
          ? list.filter((r) => this.normGeo(r.name) === base)
          : [];
        if (baseMatches.length === 1) {
          region = baseMatches[0];
        } else if (baseMatches.length === 0 && base.length > 2) {
          const subs = list.filter((r) => {
            const rn = this.normGeo(r.name);
            return rn.length > 2 && (rn.includes(base) || base.includes(rn));
          });
          if (subs.length === 1) region = subs[0];
          // FUZZY: viloyat nomi imlo xatosi bilan ("Andijn" -> "Andijon").
          // Faqat aniq g'olib (0.72+ va ikkinchidan 0.1 oldinda) bo'lsa tanlanadi;
          // teng bo'lsa (masalan "Toshknt" -> ikki Toshkent) qoldiramiz.
          if (!region && base.length >= 3) {
            const scored = list
              .map((r) => ({ r, s: this.simRatio(this.normGeo(r.name), base) }))
              .filter((x) => x.s > 0)
              .sort((a, b) => b.s - a.s);
            if (
              scored.length &&
              scored[0].s >= 0.72 &&
              (scored.length === 1 || scored[0].s - scored[1].s >= 0.1)
            ) {
              region = scored[0].r;
            }
          }
        }
        // baseMatches.length > 1 (masalan bare "Toshkent") → NOANIQ: qoldiramiz.
      }
      if (region) {
        draft.region_id = region.id;
        draft.region_label = region.name;
      }
    }

    // VILOYAT ISHONCHLI aniqlangan bo'lsa — tuman qidiruvini FAQAT shu viloyat
    // ichida olib boramiz. Bu KRITIK cross-region xatoni oldini oladi: masalan
    // "Toshkent shahri Xonobod" — Toshkentda "Xonobod" yo'q bo'lsa, Andijondagi
    // o'xshash tuman (Xo'jaobod/Xonobod) OLINMAYDI; tuman bo'sh qoladi (operator
    // to'ldiradi), viloyat esa Toshkent bo'lib SAQLANADI. Viloyat berilmagan/
    // noaniq bo'lsagina butun mamlakat bo'ylab qidiramiz (tuman viloyatni tiklaydi).
    const regionLocked = !!draft.region_id;
    const searchPool = regionLocked
      ? districts.filter((d) => d.region_id === draft.region_id)
      : districts;

    // 1-usul: district_name bo'yicha (aniq base-nom, keyin qism-mos).
    let matches: DistrictEntity[] = [];
    if (draft.district_name) {
      const q = this.normGeo(draft.district_name);
      if (q) {
        matches = searchPool.filter((d) => this.normGeo(d.name) === q);
        if (!matches.length) {
          matches = searchPool.filter((d) => {
            const dn = this.normGeo(d.name);
            return dn.length > 2 && (dn.includes(q) || q.includes(dn));
          });
        }
      }
    }

    // PLACE-SIGNAL: matnda tuman/shahar ANIQ berilganmi (district_name yoki
    // "tuman/shahar" so'zi)? Bo'lmasa — oddiy address so'zini ("uzun ko'cha",
    // "Uzuntepa mahalla") jimgina TUMANga aylantirmaymiz; taklif qilamiz
    // (forceCandidate) — operator tasdiqlaydi. "Uzun"(=uzun) kabi lug'at
    // so'zlari yolg'on avto-tanlanmasin.
    const hasPlaceSignal =
      !!draft.district_name ||
      /\b(tumani|tuman|shahri|shahar|shaharcha)\b/.test(
        this.translit(`${draft.full_address || ''} ${draft.address || ''}`),
      );
    let forceCandidate = false;

    // 2-usul (FALLBACK): district_name topilmadi/bo'sh bo'lsa — LLM shaharni
    // address'ga qo'yib yuborgan bo'lishi mumkin. DB'dagi tuman/shahar nomini
    // (district_name + address) matnidan qidiramiz. region_name QO'SHILMAYDI —
    // shunda "faqat viloyat berilgan" holat topilmasdan qoladi (kerakli xatti-harakat).
    if (!matches.length) {
      const corpus = this.normGeo(
        `${draft.district_name || ''} ${draft.address || ''}`,
      );
      if (corpus) {
        const padded = ` ${corpus} `;
        const found = searchPool
          .map((d) => ({ d, dn: this.normGeo(d.name) }))
          .filter((x) => x.dn.length >= 4 && padded.includes(` ${x.dn} `))
          .sort((a, b) => b.dn.length - a.dn.length);
        if (found.length) {
          const maxLen = found[0].dn.length;
          matches = found.filter((x) => x.dn.length === maxLen).map((x) => x.d);
          if (!hasPlaceSignal) forceCandidate = true;
        }
      }
    }

    // 3-usul (FUZZY): tuman/shahar nomi imlo xatosi bilan ("Bosoton" ->
    // "Bo'ston", apostrof olib tashlangach). Viloyat aniq bo'lsa shu viloyat
    // ichida. Bitta aniq g'olib -> tanlanadi; bir nechta yaqin -> "qaysi biri?".
    if (!matches.length && draft.district_name) {
      const base = this.normGeo(draft.district_name);
      if (base.length >= 3) {
        // Viloyat qulf: ishonchli viloyat bo'lsa shu viloyat ichida (bo'sh
        // bo'lsa cross-region OLMAYMIZ); aks holda butun ro'yxat.
        const scored = searchPool
          .map((d) => ({ d, s: this.simRatio(this.normGeo(d.name), base) }))
          .filter((x) => x.s >= 0.72)
          .sort((a, b) => b.s - a.s);
        if (scored.length) {
          const top = scored[0].s;
          const near = scored.filter((x) => top - x.s < 0.08);
          matches = near.slice(0, MAX_CANDIDATE_BUTTONS).map((x) => x.d);
        }
      }
    }

    // 4-usul (FUZZY SUBSTRING): tuman AI tomonidan tushirib qoldirilgan yoki
    // to'liq manzil ichida (kirill/imlo xato/AI noaniq ajratgan) — DB nomini
    // FULL_ADDRESS matnidan bo'shliqsiz skeletda fuzzy-substring bilan topamiz.
    // Umumiy — har case uchun alohida qoida emas.
    if (!matches.length) {
      // Viloyat nomini korpusdan olib tashlaymiz — "Andijon"/"Samarqand" so'zi
      // shu nomli TUMANga (Andijon shahri/tumani) yolg'on mos kelmasin (faqat
      // viloyat berilgan holat tuman qaytarmasin).
      const regionWord = this.normGeo(
        draft.region_label || draft.region_name || '',
      );
      // Region so'zining FAQAT BIRINCHI uchrashini (viloyat mention) olib
      // tashlaymiz. Keyingilari SAQLANADI — chunki region nomi == tuman nomi
      // bo'lganda (masalan "Andijon viloyati Andijon tumani") ikkinchi "Andijon"
      // aynan TUMAN; hammasini o'chirsak tuman topilmay qolardi (flaky bug).
      // Faqat-viloyat holati (bitta "Andijon") baribir bo'sh korpus beradi.
      let regionRemoved = false;
      const corpus = this.normGeo(
        `${draft.district_name || ''} ${draft.full_address || draft.address || ''}`,
      )
        .split(' ')
        .filter((w) => {
          if (!w) return false;
          if (regionWord && w === regionWord && !regionRemoved) {
            regionRemoved = true;
            return false;
          }
          return true;
        })
        .join('');
      if (corpus.length >= 4) {
        // Viloyat qulf: ishonchli viloyat bo'lsa shu viloyat ichida qidiramiz.
        let bestScore = 0;
        let bestDs: DistrictEntity[] = [];
        for (const d of searchPool) {
          const dn = this.normGeo(d.name).replace(/\s+/g, '');
          if (dn.length < 4) continue;
          const sc = this.bestSubstringSim(corpus, dn);
          if (sc > bestScore + 1e-9) {
            bestScore = sc;
            bestDs = [d];
          } else if (Math.abs(sc - bestScore) < 1e-9) {
            bestDs.push(d);
          }
        }
        if (bestScore >= 0.82) {
          matches = bestDs.slice(0, MAX_CANDIDATE_BUTTONS);
          if (!hasPlaceSignal) forceCandidate = true;
        }
      }
    }

    // Viloyat aniqlangan bo'lsa — shu viloyatga cheklab aniqlashtirish.
    if (draft.region_id && matches.length > 1) {
      const inRegion = matches.filter((d) => d.region_id === draft.region_id);
      if (inRegion.length > 0) matches = inRegion;
    }

    // Shahri/tumani afzalligi: matnda "tuman(i)" bo'lsa tumani, "shahar/shahri"
    // bo'lsa shahri afzal (base-nom ikkalasiga mos kelganda — Samarqand
    // shahri/tumani, Kattaqo'rg'on shahri/tumani).
    if (matches.length > 1) {
      const raw = this.translit(
        `${draft.district_name || ''} ${draft.full_address || draft.address || ''}`,
      );
      const wantsShahar = /\b(shahri|shahar)\b/.test(raw);
      const wantsTuman = /\b(tumani|tuman)\b/.test(raw);
      if (wantsTuman && !wantsShahar) {
        const f = matches.filter((d) => /tuman/i.test(d.name));
        if (f.length) matches = f;
      } else if (wantsShahar && !wantsTuman) {
        const f = matches.filter((d) => /shah/i.test(d.name));
        if (f.length) matches = f;
      }
    }

    const toLabel = (d: DistrictEntity) =>
      d.region?.name ? `${d.region.name}, ${d.name}` : d.name;

    if (matches.length === 1 && !forceCandidate) {
      const d = matches[0];
      draft.district_id = d.id;
      draft.district_resolved_name = d.name;
      draft.region_id = d.region_id; // tuman viloyatini aniq bilamiz
      draft.region_label = d.region?.name || draft.region_label;
      draft.district_label = toLabel(d);
      draft.district_candidates = undefined;
    } else if (matches.length >= 1) {
      // Bir nechta mos YOKI place-signal yo'q bitta mos — jimgina tanlamaymiz,
      // TAKLIF qilamiz (operator tasdiqlaydi).
      // Tuman noaniq — lekin VILOYATni (0-bosqichda aniqlangan) saqlaymiz.
      draft.district_id = undefined;
      draft.district_resolved_name = undefined;
      draft.district_candidates = matches
        .slice(0, MAX_CANDIDATE_BUTTONS)
        .map((d) => ({
          id: d.id,
          label: toLabel(d),
          region_name: d.region?.name || undefined,
          district_name: d.name,
        }));
    } else {
      // Tuman topilmadi — viloyat (agar aniqlangan bo'lsa) saqlanadi.
      draft.district_id = undefined;
      draft.district_resolved_name = undefined;
      draft.district_candidates = [];
    }
  }

  private async resolveItems(
    draft: AiOrderDraft,
    marketId: string,
    productsCache?: ProductEntity[],
  ): Promise<void> {
    if (!draft.items.length) return;

    const catalog =
      productsCache ??
      (await this.productRepo.find({
        where: { user_id: marketId, isDeleted: false },
      }));

    for (const item of draft.items) {
      const ranked = this.rankProducts(item.name, catalog);

      // Avto-tanlash faqat ANIQ TENG nom (1.0) yoki aniq ustun (>=0.85, ikkinchi
      // nomzoddan ancha oldinda) bo'lganda. Substring/token mosligi (< 0.85)
      // hech qachon avto-tanlanmaydi — operator tasdiqlaydi (semantik xato
      // mahsulotni jimgina o'tkazib yubormaslik uchun).
      if (
        ranked.length &&
        ((ranked[0].score === 1 &&
          (ranked.length === 1 || ranked[1].score < 1)) ||
          (ranked[0].score >= 0.85 &&
            (ranked.length === 1 || ranked[0].score - ranked[1].score >= 0.2)))
      ) {
        item.product_id = ranked[0].product.id;
        item.resolved_name = ranked[0].product.name;
        item.candidates = undefined;
      } else {
        item.product_id = undefined;
        item.resolved_name = undefined;
        item.candidates = ranked
          .slice(0, MAX_CANDIDATE_BUTTONS)
          .map((r) => ({ id: r.product.id, name: r.product.name }));
      }
    }
  }

  private rankProducts(
    query: string,
    catalog: ProductEntity[],
  ): { product: ProductEntity; score: number }[] {
    const q = this.normalizeProduct(query);
    if (!q) return [];
    const qTokens = q.split(' ').filter(Boolean);
    const qTokenSet = new Set(qTokens);

    return catalog
      .map((product) => {
        const p = this.normalizeProduct(product.name);
        let score = 0;
        if (p === q) score = 1;
        // Substring < avto-chegara (0.85): nomzod sifatida ko'rinadi, lekin
        // qo'shimcha token boshqa SKU bo'lishi mumkin — avto-tanlanmaydi.
        else if (p.includes(q) || q.includes(p)) score = 0.8;
        else {
          const pTokens = p.split(' ').filter(Boolean);
          const pTokenSet = new Set(pTokens);
          const inter = [...qTokenSet].filter((t) => pTokenSet.has(t)).length;
          const union = new Set([...qTokenSet, ...pTokenSet]).size || 1;
          const jaccard = inter / union;
          // FUZZY (Levenshtein) — imlo xatolari/tushib qolgan harflarga bardosh:
          // har bir so'zga eng yaqin so'zni topib o'rtachasini oladi
          // ("televizr" -> "televizor" ~0.89).
          const tokenFuzzy = this.tokenFuzzy(qTokens, pTokens);
          score = Math.max(jaccard, tokenFuzzy);
        }
        return { product, score };
      })
      .filter((r) => r.score >= 0.4)
      .sort((a, b) => b.score - a.score);
  }

  // Har bir so'rov so'ziga eng yaqin mahsulot so'zini topib, o'rtacha o'xshashlik.
  // So'z SONI farqiga jarima — "olma sharbat" != "olma va uzum sharbat" (superset
  // boshqa SKU/narx) jimgina avto-tanlanib qolmasligi uchun.
  private tokenFuzzy(qTokens: string[], pTokens: string[]): number {
    if (!qTokens.length || !pTokens.length) return 0;
    let sum = 0;
    for (const qt of qTokens) {
      let best = 0;
      for (const pt of pTokens) {
        const r = this.simRatio(qt, pt);
        if (r > best) best = r;
      }
      sum += best;
    }
    const avg = sum / qTokens.length;
    const countPenalty =
      Math.min(qTokens.length, pTokens.length) /
      Math.max(qTokens.length, pTokens.length);
    return avg * countPenalty;
  }

  // needle'ning hay ichidagi ENG YAXSHI fuzzy-substring mosligi (0..1).
  // Manzil matni ichidan tuman nomini (imlo xato bilan) topish uchun.
  private bestSubstringSim(hay: string, needle: string): number {
    const n = needle.length;
    if (n < 4) return 0;
    if (hay.length <= n) {
      const m = Math.max(hay.length, n);
      return m ? 1 - this.levenshtein(hay, needle) / m : 0;
    }
    let best = 0;
    for (let len = n - 1; len <= n + 1; len++) {
      if (len < 4) continue;
      for (let i = 0; i + len <= hay.length; i++) {
        const win = hay.slice(i, i + len);
        const r = 1 - this.levenshtein(win, needle) / Math.max(len, n);
        if (r > best) best = r;
        if (best === 1) return 1;
      }
    }
    return best;
  }

  private simRatio(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    // Raqamli token (o'lcham/model: "700 gr", "a51") ANIQ mos kelishi shart —
    // "700"->"500", "a51"->"a50" fuzzy bilan avto-tanlanib boshqa SKU bo'lmasin.
    if (/\d/.test(a) || /\d/.test(b)) return 0;
    const m = Math.max(a.length, b.length);
    // Uzunliklar juda farq qilsa (ratio <= min/max < 0.4) — Levenshteinsiz 0.
    if (Math.min(a.length, b.length) < m * 0.4) return 0;
    return m ? 1 - this.levenshtein(a, b) / m : 0;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[n];
  }

  // Umumiy transliteratsiya + diakritik-folding — HAR QANDAY yozuvni (kirill,
  // ö/ğ/ş/ç kabi nostandart lotin, apostrofli) yagona lotin-skeletga keltiradi.
  // Shunda "Андижон"/"Kattaqörğon"/"Kattaqo'rg'on" bir xil taqqoslanadi. Har
  // bir holat uchun alohida qoida YOZILMAYDI — universal.
  private translit(s: string): string {
    const src = (s || '').toLowerCase().normalize('NFKC');
    let out = '';
    for (const ch of src) out += CYR_LATIN[ch] ?? ch;
    return out
      .replace(/ş/g, 'sh')
      .replace(/ç/g, 'ch')
      .replace(/ø/g, 'o')
      .replace(/ı/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // diakritiklar: ö→o, ü→u, ğ→g, é→e...
      .replace(/[`ʼʻ'‘’ʹ]/g, ''); // apostroflar (o'→o, g'→g)
  }

  private normalizeProduct(s: string): string {
    return this.translit(s)
      .replace(/\b(dona|ta|pcs|sht|shtuk)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizePhone(input: string | null | undefined): string | undefined {
    if (!input) return undefined;
    let digits = String(input).replace(/\D/g, '');
    // Davlat kodi (998...) yoki trunk prefiks (0.../8...) — milliy 9 raqamga
    // keltiramiz ("+998 90...", "0 90...", "8 90..." hammasi qabul qilinsin).
    if (digits.length === 12 && digits.startsWith('998'))
      digits = digits.slice(3);
    else if (
      digits.length === 10 &&
      (digits.startsWith('0') || digits.startsWith('8'))
    )
      digits = digits.slice(1);
    if (digits.length === 9) digits = `998${digits}`;
    // Faqat haqiqiy O'zbekiston raqami (998 + 9 raqam) qabul qilinadi; aks holda
    // undefined -> missingRequired uni belgilaydi -> operator WebApp'ga o'tadi
    // (buzuq raqamni jimgina saqlab qo'ymaslik uchun).
    return /^998\d{9}$/.test(digits) ? `+${digits}` : undefined;
  }

  // Geografik nomni base holatga keltiradi: tumani/shahri/viloyati kabi
  // qo'shimchalarni olib tashlaydi (operator kiritishi bilan DB nomini
  // solishtirish uchun — operator qo'shimcha yozmaydi).
  // Yengil normalizatsiya — geografik qo'shimchalarni (shahri/viloyati) SAQLAYDI.
  // "Toshkent shahri" != "Toshkent viloyati" farqini saqlash uchun.
  private lightNorm(s: string): string {
    // translit: kirill->lotin + diakritik + apostrof (universal).
    return this.translit(s).replace(/kh/g, 'x').replace(/\s+/g, ' ').trim();
  }

  private normGeo(s: string): string {
    return (
      this.translit(s) // kirill->lotin + diakritik + apostrof
        // Transliteratsiya: "kh" = "x" (Khiva=Xiva, Khorazm=Xorazm).
        .replace(/kh/g, 'x')
        // So'z-chegara bilan: qo'shimchalar faqat ALOHIDA so'z sifatida olib
        // tashlanadi — "Shahrixon"/"Shahrisabz" ichidagi "shahri" TEGILMAYDI.
        .replace(
          /\s*(\b(?:tumani|tuman|shahri|shahar|shaharcha|viloyati|viloyat|respublikasi)\b|\b(?:sh|t)\.)\s*/g,
          ' ',
        )
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  // ─── Keyingi aniqlashtirilishi kerak bo'lgan maydon ───
  firstUnresolved(
    draft: AiOrderDraft,
  ): { type: 'district' | 'item'; itemIndex?: number } | null {
    if (!draft.district_id && draft.district_candidates?.length) {
      return { type: 'district' };
    }
    for (let i = 0; i < draft.items.length; i++) {
      if (!draft.items[i].product_id && draft.items[i].candidates?.length) {
        return { type: 'item', itemIndex: i };
      }
    }
    return null;
  }

  // Umuman hal bo'lmaydigan (nomzod ham yo'q) yetishmovchiliklar — WebApp'ga yo'naltiriladi
  missingRequired(draft: AiOrderDraft): string[] {
    const missing: string[] = [];
    if (!draft.customer_name) missing.push('mijoz ismi');
    if (!draft.phone_number) missing.push('telefon raqami');
    if (!draft.district_id && !draft.district_candidates?.length)
      missing.push('tuman');
    if (!draft.items.length) missing.push('mahsulot');
    else if (draft.items.some((i) => !i.product_id && !i.candidates?.length))
      missing.push('katalogda topilmagan mahsulot');
    if (draft.total_price == null) missing.push('narx');
    return missing;
  }

  // ─── Tasdiq kartasi (barcha hal bo'lgach) ───
  buildConfirmCard(draft: AiOrderDraft): {
    text: string;
    keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
  } {
    const itemsText = draft.items
      .map(
        (it, i) =>
          `   ${i + 1}. ${it.resolved_name || it.name} — ${it.quantity} dona`,
      )
      .join('\n');

    const priceText =
      draft.total_price != null
        ? `${draft.total_price
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`
        : "— (WebApp'da kiriting)";

    // MUHIM: plain text (Markdown YO'Q) — mijoz ismi/mahsulot nomida _ * [ ]
    // kabi belgilar Telegram parse'ini buzib, buyurtmani jimgina yo'qotmasligi
    // uchun. parse_mode ishlatilmaydi.
    const text =
      `🤖 AI buyurtmani shunday tushundi — tekshiring:\n\n` +
      `👤 Mijoz: ${draft.customer_name || '-'}\n` +
      `📞 Telefon: ${draft.phone_number || '-'}\n` +
      `📍 Manzil: ${draft.district_label || '-'}${
        draft.address ? ` (${draft.address})` : ''
      }\n` +
      `📦 Mahsulotlar:\n${itemsText || '-'}\n` +
      `💰 Jami: ${priceText}\n` +
      (draft.comment ? `📝 Izoh: ${draft.comment}\n` : '');

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [
            {
              text: '✅ Tasdiqlash',
              callback_data: `order_ai:confirm:${draft.nonce}`,
            },
            {
              text: '❌ Bekor',
              callback_data: `order_ai:cancel:${draft.nonce}`,
            },
          ],
        ],
      },
    };
  }

  buildDistrictClarify(draft: AiOrderDraft): {
    text: string;
    keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
  } {
    const cands = draft.district_candidates || [];
    return {
      text: `❓ "${draft.district_name}" tumani aniq topilmadi. Qaysi biri?`,
      keyboard: {
        inline_keyboard: [
          ...cands.map((c, idx) => [
            {
              text: c.label,
              callback_data: `order_ai:pickdistrict:${draft.nonce}:${idx}`,
            },
          ]),
          [
            {
              text: '❌ Bekor',
              callback_data: `order_ai:cancel:${draft.nonce}`,
            },
          ],
        ],
      },
    };
  }

  buildItemClarify(
    draft: AiOrderDraft,
    itemIndex: number,
  ): {
    text: string;
    keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
  } {
    const item = draft.items[itemIndex];
    const cands = item.candidates || [];
    return {
      text: `❓ "${item.name}" (${item.quantity} dona) uchun mahsulotni tanlang:`,
      keyboard: {
        inline_keyboard: [
          ...cands.map((c, idx) => [
            {
              text: c.name,
              callback_data: `order_ai:pickproduct:${draft.nonce}:${itemIndex}:${idx}`,
            },
          ]),
          [
            {
              text: '❌ Bekor',
              callback_data: `order_ai:cancel:${draft.nonce}`,
            },
          ],
        ],
      },
    };
  }

  // ─── Commit: mavjud createOrderByBot ni qayta ishlatish ───
  async commit(
    draft: AiOrderDraft,
    operator: ResolvedOperator,
  ): Promise<{ ok: boolean; message: string }> {
    // Barcha majburiy maydonlar hal bo'lganini yakuniy tekshirish
    if (!draft.customer_name || !draft.phone_number || !draft.district_id) {
      return { ok: false, message: 'Buyurtma to‘liq emas.' };
    }
    // Telefon formati (createOrderByBot to'g'ridan chaqirilgani uchun DTO
    // validatsiyasi ishlamaydi — shu yerda tekshiramiz)
    if (!/^\+998\d{9}$/.test(draft.phone_number)) {
      return { ok: false, message: '📞 Telefon raqami noto‘g‘ri.' };
    }
    const resolvedItems = draft.items.filter((i) => i.product_id);
    if (!resolvedItems.length || resolvedItems.length !== draft.items.length) {
      return { ok: false, message: 'Barcha mahsulotlar tanlanmagan.' };
    }
    if (draft.total_price == null || draft.total_price <= 0) {
      return { ok: false, message: 'Narx kiritilmagan.' };
    }

    const dto: CreateOrderByBotDto = {
      name: draft.customer_name,
      phone_number: draft.phone_number,
      district_id: draft.district_id,
      extra_number: draft.extra_number,
      address: draft.address,
      order_item_info: resolvedItems.map((i) => ({
        product_id: i.product_id as string,
        quantity: i.quantity,
      })),
      total_price: draft.total_price,
      where_deliver: Where_deliver.CENTER,
      comment: draft.comment,
      operator: operator.user.name,
    };

    const res = (await this.orderService.createOrderByBot(
      dto,
      operator.jwt,
    )) as {
      statusCode?: number;
      message?: string;
    };

    // 201 = yangi yaratildi, 200 = dublikat (yangi yaratilmadi), aks holda xato.
    // (Xato holatida createOrderByBot odatda throw qiladi — uni chaqiruvchi
    //  handleAiCallback try/catch ushlaydi; bu tarmoq himoya sifatida qoladi.)
    if (res?.statusCode === 201) {
      return { ok: true, message: '✅ Buyurtma yaratildi!' };
    }
    if (res?.statusCode === 200) {
      return {
        ok: true,
        message: 'ℹ️ Bu buyurtma allaqachon yaratilgan (dublikat).',
      };
    }
    return {
      ok: false,
      message: `❌ ${res?.message || 'Buyurtma yaratilmadi'}`,
    };
  }
}
