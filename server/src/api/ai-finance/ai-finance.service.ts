import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { AiFinanceReportSnapshotEntity } from 'src/core/entity/ai-finance-report-snapshot.entity';
import { ClaudeService } from 'src/infrastructure/ai/claude.service';
import { OrderService } from 'src/api/order/order.service';
import { CashBoxService } from 'src/api/cash-box/cash-box.service';
import { MyLogger } from 'src/logger/logger.service';
import { successRes, catchError } from 'src/infrastructure/lib/response';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';

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

// AI kategoriya klasterlash sxemasi (extractJson uchun) — model faqat RAQAM
// (izoh indeksi) + kategoriya nomini qaytaradi; summa KOD tomonда hisoblanadi.
const CATEGORY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    // Ixcham aligned massiv: categories[i] = i-izohning kategoriyasi.
    // (indeks+obyektga qaraganda ancha kam token — ko'p izohда kesilmaydi.)
    categories: { type: 'array', items: { type: 'string' } },
  },
  required: ['categories'],
};

const CATEGORY_SYSTEM = `Sen buxgalter yordamchisisan. Berilgan xarajat IZOHLARining har biriga QISQA, umumiy kategoriya biriktir.
Tavsiya etilgan kategoriyalar: Ovqat, Transport, Yoqilg'i, Ijara, Kommunal, Aloqa/Internet, Kanstovar, Ta'mirlash, Reklama/Marketing, Soliq, Bank/komissiya, Sovg'a/mehmon, Tozalash, Boshqa.
QOIDALAR:
- IMLO XATOSINI tushun va TO'G'RI ma'noga biriktir: "benzn"/"Benzin"/"benzin" -> Yoqilg'i; "ijra"/"ijara" -> Ijara; "kanselyariya"/"kanstavar" -> Kanstovar.
- Bir xil ma'noli TURLI yozuvlarni (sinonim, qisqartma, katta/kichik harf, kirill/lotin aralash, bo'sh joy/tinish farqi) AYNAN BITTA kategoriyaga birlashtir — kategoriya nomini HAR DOIM bir xil imlода yoz.
- Ro'yxatda mos bo'lmasa qisqa yangi kategoriya o'yla, lekin ortiqcha maydalab yuborma. Izohsiz/tushunarsiz -> "Boshqa".
- CHIQISH: "categories" massivi — categories[i] i-tartibli izohning kategoriyasi. Massiv uzunligi izohlar soniga TENG va tartibi AYNAN bir xil bo'lsin. Faqat kategoriya nomlari.`;

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
      "HOZIRGI naqd holat: kassa (naqd+karta), kuryerlar jami, marketlar jami, sof pozitsiya. Parametrsiz.",
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
];

@Injectable()
export class AiFinanceService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(FinancialBalanceHistoryEntity)
    private readonly fbhRepo: Repository<FinancialBalanceHistoryEntity>,
    @InjectRepository(AiFinanceReportSnapshotEntity)
    private readonly snapshotRepo: Repository<AiFinanceReportSnapshotEntity>,
    private readonly claude: ClaudeService,
    private readonly orderService: OrderService,
    private readonly cashBoxService: CashBoxService,
    private readonly logger: MyLogger,
  ) {}

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
  async ask(question: string, fromDate?: string, toDate?: string) {
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
      });

      if (!res) {
        return successRes({
          answer: "Kechirasiz, hozir javob bera olmadim. Qayta urinib ko'ring.",
          toolsUsed: [],
          aiEnabled: true,
        });
      }
      return successRes({
        answer: res.text,
        toolsUsed: [...new Set(res.toolsUsed)],
        aiEnabled: true,
      });
    } catch (error) {
      this.logger.log(`ask xato: ${(error as Error).message}`, 'AiFinance');
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
  private async runFinanceTool(
    name: string,
    input: unknown,
  ): Promise<unknown> {
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
          .reduce((s: number, x) => s + Math.abs(Number(x.total_amount) || 0), 0);
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

    // MANUAL_EXPENSE — izohlarni distinct guruhlab, AI kategoriyaга biriktiradi.
    const rows = await this.commentGroups(fromTs, toTs, 'manual_expense', 500);
    if (rows.length) {
      // AI klasterlash — izohlarni MA'NOSI bo'yicha kategoriyaga biriktiradi
      // (imlo/sinonim birlashtirib). Ixcham aligned massiv: categories[i] =
      // i-izohning kategoriyasi (ko'p izohда ham chiqish kesilmaydi).
      // O'chiq/xato bo'lsa — hammasi "Qo'lda chiqimlar"ga (graceful).
      let categories: string[] | null = null;
      if (this.claude.isEnabled()) {
        const list = rows
          .map(
            (r, i) => `${i}) ${r.comment} — ${r.total} so'm (${r.count} marta)`,
          )
          .join('\n');
        const res = await this.claude.extractJson<{ categories: string[] }>({
          system: CATEGORY_SYSTEM,
          userText: list,
          schema: CATEGORY_SCHEMA,
          maxTokens: 8000,
        });
        if (res && Array.isArray(res.categories)) categories = res.categories;
      }

      const byName = new Map<string, Category>();
      let categorizedSum = 0;
      rows.forEach((r, i) => {
        const assigned =
          categories && typeof categories[i] === 'string'
            ? categories[i].trim()
            : '';
        const name =
          assigned || (categories ? 'Boshqa' : SOURCE_LABEL.manual_expense);
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

  // Bitta source_type uchun izoh bo'yicha guruhlar (kategoriya ichi tarkibi).
  private async commentGroups(
    fromTs: number,
    toTs: number,
    source: string,
    limit = 200,
  ): Promise<CategoryItem[]> {
    const rows: Array<{
      comment: string;
      cnt: string | number;
      total: string | number;
    }> = await this.fbhRepo.query(
      `SELECT COALESCE(NULLIF(TRIM(comment), ''), '(izohsiz)') AS comment,
              COUNT(*)::int AS cnt, SUM(-1*amount)::bigint AS total
       FROM financial_balance_history
       WHERE source_type::text = $3 AND amount < 0
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
