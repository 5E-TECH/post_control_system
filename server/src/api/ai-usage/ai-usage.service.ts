import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLogEntity } from 'src/core/entity/ai-usage-log.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { MyLogger } from 'src/logger/logger.service';
import { successRes, catchError } from 'src/infrastructure/lib/response';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';
import { OrderCreatedSource } from 'src/common/enums';
import config from 'src/config';

/**
 * Bitta model uchun narx (USD / 1M token). cacheWrite = in*1.25, cacheRead = in*0.1
 * (Anthropic standart prompt-caching koeffitsiyentlari). Hozir kesh ishlatilmaydi,
 * lekin qiymatlar 0 bo'lgani uchun ta'sir qilmaydi.
 */
interface ModelPrice {
  in: number;
  out: number;
}

/**
 * Model narxi — versiya/sana suffiksiga bardoshli bo'lishi uchun model nomi
 * ichidagi kalit so'z bo'yicha aniqlanadi ('opus'/'sonnet'/'haiku'). Noma'lum
 * model -> Opus narxi (ehtiyotkor, past baholanmasin uchun).
 */
function priceFor(model: string): ModelPrice {
  const m = (model || '').toLowerCase();
  if (m.includes('haiku')) return { in: 1, out: 5 };
  if (m.includes('sonnet')) return { in: 3, out: 15 };
  // opus + noma'lum -> opus narxi
  return { in: 5, out: 25 };
}

export interface AiUsageRecordInput {
  // Aniq AI amali (masalan 'order_extract', 'finance_chat').
  feature: string;
  // Koarse guruh (dashboard filtri): 'order' | 'finance' | 'bot' | 'other'.
  requestArea?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  // Nechta Anthropic API chaqiruvi bir qatorga yig'ilgan (askWithTools qadamlari).
  steps?: number;
  orderId?: string | null;
  userId?: string | null;
  conversationId?: string | null;
}

/**
 * AI (Claude) real xarajatini hisoblab, ai_usage_log jadvaliga yozadi.
 *
 * Asosiy metod record() — FIRE-AND-FORGET: hech qachon throw qilmaydi va
 * chaqiruvchini kutdirmaydi (AI amali xarajat yozuvi tufayli buzilmasin).
 * Narx qatorda saqlangan kurs bilan hisoblanadi — kurs keyin o'zgarsa eski
 * yozuvlar o'zgarmaydi (audit).
 */
@Injectable()
export class AiUsageService {
  constructor(
    @InjectRepository(AiUsageLogEntity)
    private readonly repo: Repository<AiUsageLogEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    private readonly logger: MyLogger,
  ) {}

  /**
   * USD xarajatini token sarfidan hisoblaydi. cache write/read koeffitsiyentlari
   * (1.25 / 0.10) qo'llanadi — hozir kesh 0 bo'lgani uchun ta'sir yo'q, lekin
   * kelajakda kesh yoqilsa narx aniq qoladi.
   */
  static computeCostUsd(input: AiUsageRecordInput): number {
    const p = priceFor(input.model);
    const inTok = Math.max(0, input.inputTokens || 0);
    const outTok = Math.max(0, input.outputTokens || 0);
    const cacheW = Math.max(0, input.cacheCreationTokens || 0);
    const cacheR = Math.max(0, input.cacheReadTokens || 0);
    const usd =
      (inTok * p.in +
        outTok * p.out +
        cacheW * (p.in * 1.25) +
        cacheR * (p.in * 0.1)) /
      1_000_000;
    return usd;
  }

  /**
   * Xarajat yozuvini fon rejimida saqlaydi. Xato bo'lsa faqat log qoldiradi —
   * chaqiruvchiga qaytmaydi (AI oqimi to'xtamasin).
   */
  record(input: AiUsageRecordInput): void {
    // Bo'sh/no-op chaqiruv (token yo'q) — yozmaymiz.
    const totalTokens =
      (input.inputTokens || 0) +
      (input.outputTokens || 0) +
      (input.cacheCreationTokens || 0) +
      (input.cacheReadTokens || 0);
    if (totalTokens <= 0) return;

    void this.persist(input).catch((err) => {
      this.logger.log(
        `AiUsage record error: ${(err as Error).message}`,
        'AiUsageService',
      );
    });
  }

  private async persist(input: AiUsageRecordInput): Promise<void> {
    const rate = Number(config.AI_USD_UZS_RATE) || 0;
    const costUsd = AiUsageService.computeCostUsd(input);
    const costUzs = Math.round(costUsd * rate);

    const row = this.repo.create({
      feature: (input.feature || 'unknown').slice(0, 40),
      request_area: (input.requestArea || 'other').slice(0, 16),
      model: (input.model || '').slice(0, 48),
      input_tokens: Math.max(0, Math.round(input.inputTokens || 0)),
      output_tokens: Math.max(0, Math.round(input.outputTokens || 0)),
      cache_creation_tokens: Math.max(
        0,
        Math.round(input.cacheCreationTokens || 0),
      ),
      cache_read_tokens: Math.max(0, Math.round(input.cacheReadTokens || 0)),
      steps: Math.max(1, Math.round(input.steps || 1)),
      // numeric ustunlar pg'ga string sifatida boradi — 6 kasrga yaxlitlaymiz.
      cost_usd: Number(costUsd.toFixed(6)),
      cost_uzs: costUzs,
      usd_uzs_rate: rate,
      order_id: input.orderId ?? null,
      user_id: input.userId ?? null,
      conversation_id: input.conversationId ?? null,
    });
    await this.repo.save(row);
  }

  // ─────────────────────── DASHBOARD (o'qish-only) ───────────────────────
  // Faqat superadmin/admin ko'radi (controller RBAC). Barcha sana hisoblari
  // Asia/Tashkent kun-bucketida (bitta AT TIME ZONE — loyiha konvensiyasi).

  private isYmd(s?: string): boolean {
    return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  // epoch-ms -> Tashkent YYYY-MM-DD (DST yo'q, doim +5).
  private ymd(ms: number): string {
    return new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10);
  }

  // Sana oralig'ini (Tashkent) epoch-ms chegaralarga aylantiradi. Berilmasa
  // oxirgi `days` kun.
  private resolveRange(
    fromDate?: string,
    toDate?: string,
    days = 30,
  ): { from: string; to: string; fromTs: number; toTs: number } {
    const to = this.isYmd(toDate) ? (toDate as string) : this.ymd(Date.now());
    const from = this.isYmd(fromDate)
      ? (fromDate as string)
      : this.ymd(Date.now() - days * 86400000);
    return {
      from,
      to,
      fromTs: toUzbekistanTimestamp(from, false),
      toTs: toUzbekistanTimestamp(to, true),
    };
  }

  /**
   * AI dashboard uchun to'liq agregat: jami xarajat (USD+so'm), soha/feature/
   * model kesimlari, kunlik trend, AI buyurtma soni + o'rtacha xarajat, Elchin
   * prompt narxi. numeric ustunlar pg'dan STRING keladi -> Number() bilan.
   */
  async getDashboard(fromDate?: string, toDate?: string) {
    try {
      const { from, to, fromTs, toTs } = this.resolveRange(fromDate, toDate);
      const range: [number, number] = [fromTs, toTs];

      // 1) request_area kesimi (order / finance / bot / other).
      const areaRows: Array<{
        request_area: string;
        calls: number;
        usd: number;
        uzs: number;
        in_tok: number;
        out_tok: number;
      }> = await this.repo.query(
        `SELECT request_area,
                COUNT(*)::int AS calls,
                COALESCE(SUM(cost_usd),0)::float AS usd,
                COALESCE(SUM(cost_uzs),0)::bigint AS uzs,
                COALESCE(SUM(input_tokens),0)::bigint AS in_tok,
                COALESCE(SUM(output_tokens),0)::bigint AS out_tok
         FROM ai_usage_log
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY request_area
         ORDER BY usd DESC`,
        range,
      );

      // 2) feature kesimi.
      const featureRows: Array<{
        feature: string;
        request_area: string;
        calls: number;
        steps: number;
        in_tok: number;
        out_tok: number;
        usd: number;
        uzs: number;
      }> = await this.repo.query(
        `SELECT feature, request_area,
                COUNT(*)::int AS calls,
                COALESCE(SUM(steps),0)::int AS steps,
                COALESCE(SUM(input_tokens),0)::bigint AS in_tok,
                COALESCE(SUM(output_tokens),0)::bigint AS out_tok,
                COALESCE(SUM(cost_usd),0)::float AS usd,
                COALESCE(SUM(cost_uzs),0)::bigint AS uzs
         FROM ai_usage_log
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY feature, request_area
         ORDER BY usd DESC`,
        range,
      );

      // 3) model kesimi.
      const modelRows: Array<{
        model: string;
        calls: number;
        usd: number;
        uzs: number;
      }> = await this.repo.query(
        `SELECT model,
                COUNT(*)::int AS calls,
                COALESCE(SUM(cost_usd),0)::float AS usd,
                COALESCE(SUM(cost_uzs),0)::bigint AS uzs
         FROM ai_usage_log
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY model
         ORDER BY usd DESC`,
        range,
      );

      // 4) kunlik xarajat (Tashkent kun-bucketi).
      const usageDaily: Array<{
        day: string;
        calls: number;
        usd: number;
        uzs: number;
      }> = await this.repo.query(
        `SELECT TO_CHAR(TO_TIMESTAMP(created_at/1000) AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS calls,
                COALESCE(SUM(cost_usd),0)::float AS usd,
                COALESCE(SUM(cost_uzs),0)::bigint AS uzs
         FROM ai_usage_log
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY day ORDER BY day`,
        range,
      );

      // 5) buyurtma manbasi (ai/manual/bot) + kunlik AI buyurtma soni.
      const orderBySource: Array<{ created_source: string; cnt: number }> =
        await this.orderRepo.query(
          `SELECT created_source, COUNT(*)::int AS cnt
           FROM "order"
           WHERE created_at >= $1 AND created_at <= $2
           GROUP BY created_source`,
          range,
        );
      const aiOrdersDaily: Array<{ day: string; cnt: number }> =
        await this.orderRepo.query(
          `SELECT TO_CHAR(TO_TIMESTAMP(created_at/1000) AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
                  COUNT(*)::int AS cnt
           FROM "order"
           WHERE created_source = $3 AND created_at >= $1 AND created_at <= $2
           GROUP BY day ORDER BY day`,
          [fromTs, toTs, OrderCreatedSource.AI],
        );

      // ── Hisob-kitob ──
      const num = (v: unknown) => Number(v) || 0;
      const byArea = areaRows.map((r) => ({
        area: r.request_area,
        calls: num(r.calls),
        inputTokens: num(r.in_tok),
        outputTokens: num(r.out_tok),
        costUsd: num(r.usd),
        costUzs: num(r.uzs),
      }));
      const byFeature = featureRows.map((r) => ({
        feature: r.feature,
        area: r.request_area,
        calls: num(r.calls),
        steps: num(r.steps),
        inputTokens: num(r.in_tok),
        outputTokens: num(r.out_tok),
        costUsd: num(r.usd),
        costUzs: num(r.uzs),
      }));
      const byModel = modelRows.map((r) => ({
        model: r.model,
        calls: num(r.calls),
        costUsd: num(r.usd),
        costUzs: num(r.uzs),
      }));

      const totalCostUsd = byArea.reduce((s, a) => s + a.costUsd, 0);
      const totalCostUzs = byArea.reduce((s, a) => s + a.costUzs, 0);
      const totalCalls = byArea.reduce((s, a) => s + a.calls, 0);

      const orderArea = byArea.find((a) => a.area === 'order');
      const orderCostUsd = orderArea?.costUsd ?? 0;
      const orderCostUzs = orderArea?.costUzs ?? 0;

      const sourceCounts: Record<string, number> = {
        ai: 0,
        manual: 0,
        bot: 0,
      };
      orderBySource.forEach((r) => {
        sourceCounts[r.created_source] = num(r.cnt);
      });
      const aiOrderCount = sourceCounts.ai || 0;

      // O'rtacha xarajat/AI buyurtma — order-AI yozuvlari aniq buyurtmaga
      // bog'lanmagan (ekstraksiya buyurtmadan oldin), shuning uchun O'RTACHA:
      // davr order-AI xarajati / davr AI buyurtma soni.
      const avgCostPerOrderUsd =
        aiOrderCount > 0 ? orderCostUsd / aiOrderCount : 0;
      const avgCostPerOrderUzs =
        aiOrderCount > 0 ? Math.round(orderCostUzs / aiOrderCount) : 0;

      // Elchin prompt narxi — foydalanuvchiga ko'rinadigan promptlar
      // (finance_chat + finance_file). Ichki (category/title/report) hisobga
      // olinmaydi.
      const chatFeatures = byFeature.filter(
        (f) => f.feature === 'finance_chat' || f.feature === 'finance_file',
      );
      const financePrompts = chatFeatures.reduce((s, f) => s + f.calls, 0);
      const financePromptUsd = chatFeatures.reduce((s, f) => s + f.costUsd, 0);
      const financePromptUzs = chatFeatures.reduce((s, f) => s + f.costUzs, 0);

      // Kunlik seriya — xarajat + AI buyurtma sonini bitta o'qqa birlashtiramiz.
      const dayMap = new Map<
        string,
        { day: string; costUsd: number; costUzs: number; calls: number; aiOrders: number }
      >();
      const ensureDay = (day: string) => {
        let d = dayMap.get(day);
        if (!d) {
          d = { day, costUsd: 0, costUzs: 0, calls: 0, aiOrders: 0 };
          dayMap.set(day, d);
        }
        return d;
      };
      usageDaily.forEach((r) => {
        const d = ensureDay(r.day);
        d.costUsd = num(r.usd);
        d.costUzs = num(r.uzs);
        d.calls = num(r.calls);
      });
      aiOrdersDaily.forEach((r) => {
        ensureDay(r.day).aiOrders = num(r.cnt);
      });
      const dailySeries = [...dayMap.values()].sort((a, b) =>
        a.day.localeCompare(b.day),
      );

      return successRes({
        from,
        to,
        usdUzsRate: Number(config.AI_USD_UZS_RATE) || 0,
        summary: {
          totalCostUsd,
          totalCostUzs,
          totalCalls,
          aiOrderCount,
          avgCostPerOrderUsd,
          avgCostPerOrderUzs,
          orderCostUsd,
          orderCostUzs,
          financePrompts,
          financePromptUsd,
          financePromptUzs,
          avgCostPerPromptUsd:
            financePrompts > 0 ? financePromptUsd / financePrompts : 0,
          avgCostPerPromptUzs:
            financePrompts > 0
              ? Math.round(financePromptUzs / financePrompts)
              : 0,
        },
        orderSources: sourceCounts,
        byArea,
        byFeature,
        byModel,
        dailySeries,
      });
    } catch (error) {
      this.logger.log(
        `getDashboard xato: ${(error as Error).message}`,
        'AiUsageService',
      );
      return catchError(error);
    }
  }

  /**
   * AI orqali yaratilgan buyurtmalar ro'yxati (davr bo'yicha) — "qaysi
   * buyurtmalar" savoli uchun. Eng yangi birinchi; limit bilan cheklangan.
   */
  async getAiOrders(fromDate?: string, toDate?: string, limit = 100) {
    try {
      const { from, to, fromTs, toTs } = this.resolveRange(fromDate, toDate);
      const lim = Math.min(Math.max(1, Math.floor(limit) || 100), 500);

      const rows: Array<{
        id: string;
        order_number: string | number;
        created_at: string | number;
        status: string;
        total_price: number;
        operator: string | null;
        market_name: string | null;
      }> = await this.orderRepo.query(
        `SELECT o.id, o.order_number, o.created_at, o.status,
                o.total_price, o.operator, u.name AS market_name
         FROM "order" o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.created_source = $3
           AND o.created_at >= $1 AND o.created_at <= $2
           AND o.deleted_at IS NULL
         ORDER BY o.created_at DESC
         LIMIT $4`,
        [fromTs, toTs, OrderCreatedSource.AI, lim],
      );

      const totalRow: Array<{ cnt: number }> = await this.orderRepo.query(
        `SELECT COUNT(*)::int AS cnt FROM "order"
         WHERE created_source = $3 AND created_at >= $1 AND created_at <= $2
           AND deleted_at IS NULL`,
        [fromTs, toTs, OrderCreatedSource.AI],
      );
      const total = Number(totalRow[0]?.cnt) || 0;

      return successRes({
        from,
        to,
        total,
        limit: lim,
        orders: rows.map((r) => ({
          id: r.id,
          orderNumber: Number(r.order_number) || 0,
          createdAt: Number(r.created_at) || 0,
          createdAtLabel: this.ymd(Number(r.created_at) || 0),
          status: r.status,
          totalPrice: Number(r.total_price) || 0,
          operator: r.operator || null,
          market: r.market_name || null,
        })),
      });
    } catch (error) {
      this.logger.log(
        `getAiOrders xato: ${(error as Error).message}`,
        'AiUsageService',
      );
      return catchError(error);
    }
  }
}
