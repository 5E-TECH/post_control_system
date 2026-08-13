import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { AiFinanceReportSnapshotEntity } from 'src/core/entity/ai-finance-report-snapshot.entity';
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
- IMLO XATOSINI tushun va TO'G'RI ma'noga biriktir: "benzn"/"Benzin"/"benzin" -> Yoqilg'i; "ijra"/"ijara" -> Ijara; "kanselyariya"/"kanstavar" -> Kanstovar.
- Bir xil ma'noli TURLI yozuvlarni (sinonim, qisqartma, katta/kichik harf, kirill/lotin aralash, bo'sh joy/tinish farqi) AYNAN BITTA kategoriyaga birlashtir — kategoriya nomini HAR DOIM bir xil imlода yoz.
- Har izohga ENG mos bittasini tanla; ro'yxatda mos bo'lmasa qisqa yangi kategoriya o'yla, lekin ortiqcha maydalab yuborma.
- Izohsiz yoki tushunarsiz bo'lsa "Boshqa".
- Faqat kategoriya nomini qaytar; izohni o'zgartirma. Har izoh uchun uning INDEKSini va kategoriya nomini qaytar.`;

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

@Injectable()
export class AiFinanceService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(FinancialBalanceHistoryEntity)
    private readonly fbhRepo: Repository<FinancialBalanceHistoryEntity>,
    @InjectRepository(AiFinanceReportSnapshotEntity)
    private readonly snapshotRepo: Repository<AiFinanceReportSnapshotEntity>,
    private readonly claude: ClaudeService,
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
      // AI klasterlash (o'chiq/xato bo'lsa — hammasi "Qo'lda chiqimlar"ga).
      let assignments: { index: number; category: string }[] | null = null;
      if (this.claude.isEnabled()) {
        const list = rows
          .map(
            (r, i) => `${i}) ${r.comment} — ${r.total} so'm (${r.count} marta)`,
          )
          .join('\n');
        const res = await this.claude.extractJson<{
          assignments: { index: number; category: string }[];
        }>({
          system: CATEGORY_SYSTEM,
          userText: list,
          schema: CATEGORY_SCHEMA,
          maxTokens: 6000,
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
      let categorizedSum = 0;
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
