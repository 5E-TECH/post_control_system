import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLogEntity } from 'src/core/entity/ai-usage-log.entity';
import { MyLogger } from 'src/logger/logger.service';
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
}
