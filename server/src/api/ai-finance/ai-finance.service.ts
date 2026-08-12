import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { ClaudeService } from 'src/infrastructure/ai/claude.service';
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
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          category: { type: 'string' },
        },
        required: ['index', 'category'],
      },
    },
  },
  required: ['assignments'],
};

const CATEGORY_SYSTEM = `Sen buxgalter yordamchisisan. Har xarajat izohiga QISQA, umumiy kategoriya biriktir.
Tavsiya etilgan kategoriyalar: Ovqat, Transport, Yoqilg'i, Ijara, Kommunal, Aloqa/Internet, Kanstovar, Ta'mirlash, Reklama/Marketing, Soliq, Bank/komissiya, Sovg'a/mehmon, Tozalash, Boshqa.
QOIDALAR:
- Har izohga ENG mos bittasini tanla; ro'yxatda mos bo'lmasa qisqa yangi kategoriya o'yla.
- Izohsiz yoki tushunarsiz bo'lsa "Boshqa".
- Faqat kategoriya nomini qaytar; izohni o'zgartirma. Har izoh uchun uning INDEKSini qaytar.`;

interface Bucket {
  label: string;
  total: number;
  bySource: Record<string, number>;
}
interface Category {
  name: string;
  total: number;
  count: number;
  source: string;
  examples: string[];
}

@Injectable()
export class AiFinanceService {
  constructor(
    @InjectRepository(FinancialBalanceHistoryEntity)
    private readonly fbhRepo: Repository<FinancialBalanceHistoryEntity>,
    private readonly claude: ClaudeService,
    private readonly logger: MyLogger,
  ) {}

  // ─── Xarajat AI-hisoboti: vaqt-bucketli seriya + AI kategoriya + narrativ ───
  // Matematikani KOD qiladi (yig'indi, peak, %); Claude faqat kategoriyalaydi
  // (izoh -> kategoriya) va izohlaydi (o'zbekcha narrativ). PII yo'q — faqat
  // xarajat summalari va izoh matni.
  async getExpenseReport(period?: string, fromDate?: string, toDate?: string) {
    try {
      const p: Period = PERIODS.includes(period as Period)
        ? (period as Period)
        : 'monthly';

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

      return successRes({
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
      });
    } catch (error) {
      this.logger.log(
        `getExpenseReport xato: ${(error as Error).message}`,
        'AiFinance',
      );
      return catchError(error);
    }
  }

  // salary/bills = tayyor kategoriya; manual_expense izohlaridan AI klasterlaydi.
  private async buildCategories(
    fromTs: number,
    toTs: number,
    totalsBySource: Record<string, number>,
  ): Promise<Category[]> {
    const cats: Category[] = [];
    if (totalsBySource.salary > 0)
      cats.push({
        name: SOURCE_LABEL.salary,
        total: totalsBySource.salary,
        count: 0,
        source: 'salary',
        examples: [],
      });
    if (totalsBySource.bills > 0)
      cats.push({
        name: SOURCE_LABEL.bills,
        total: totalsBySource.bills,
        count: 0,
        source: 'bills',
        examples: [],
      });

    // manual_expense izohlarini distinct qilib olamiz (arzon — kam qator LLMga).
    const rows: Array<{
      comment: string;
      cnt: string | number;
      total: string | number;
    }> = await this.fbhRepo.query(
      `SELECT COALESCE(NULLIF(TRIM(comment), ''), '(izohsiz)') AS comment,
              COUNT(*)::int AS cnt, SUM(-1*amount)::bigint AS total
       FROM financial_balance_history
       WHERE source_type = 'manual_expense' AND amount < 0
         AND created_at >= $1 AND created_at <= $2
       GROUP BY 1 ORDER BY total DESC LIMIT 200`,
      [fromTs, toTs],
    );
    if (!rows.length) return cats.sort((a, b) => b.total - a.total);

    // AI klasterlash (o'chiq/xato bo'lsa — bitta "Qo'lda chiqimlar" kategoriyasi).
    let assignments: { index: number; category: string }[] | null = null;
    if (this.claude.isEnabled()) {
      const list = rows
        .map(
          (r, i) =>
            `${i}) ${r.comment} — ${Number(r.total)} so'm (${Number(r.cnt)} marta)`,
        )
        .join('\n');
      const res = await this.claude.extractJson<{
        assignments: { index: number; category: string }[];
      }>({
        system: CATEGORY_SYSTEM,
        userText: list,
        schema: CATEGORY_SCHEMA,
        maxTokens: 4000,
      });
      if (res && Array.isArray(res.assignments)) assignments = res.assignments;
    }

    const assignMap = new Map<number, string>();
    for (const a of assignments || []) {
      assignMap.set(
        Math.floor(Number(a.index)),
        (a.category || 'Boshqa').trim() || 'Boshqa',
      );
    }
    const byName = new Map<string, Category>();
    rows.forEach((r, i) => {
      const name =
        assignMap.get(i) ||
        (assignments ? 'Boshqa' : SOURCE_LABEL.manual_expense);
      const c: Category = byName.get(name) ?? {
        name,
        total: 0,
        count: 0,
        source: 'manual_expense',
        examples: [],
      };
      c.total += Number(r.total) || 0;
      c.count += Number(r.cnt) || 0;
      if (c.examples.length < 3 && r.comment && r.comment !== '(izohsiz)') {
        c.examples.push(r.comment);
      }
      byName.set(name, c);
    });
    cats.push(...byName.values());
    return cats.sort((a, b) => b.total - a.total);
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
