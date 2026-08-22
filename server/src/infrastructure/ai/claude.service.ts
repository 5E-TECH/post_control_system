import { Injectable, Optional } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import config from 'src/config';
import { MyLogger } from 'src/logger/logger.service';
import { AiUsageService } from 'src/api/ai-usage/ai-usage.service';

/**
 * AI xarajat yozuvi uchun kontekst — chaqiruvchi (order-AI / Elchin) beradi.
 * feature: aniq amal, requestArea: koarse guruh (dashboard filtri).
 */
export interface ClaudeUsageMeta {
  feature: string;
  requestArea?: string;
  orderId?: string | null;
  userId?: string | null;
  conversationId?: string | null;
}

/**
 * Claude (Anthropic) uchun yupqa wrapper.
 *
 * - ANTHROPIC_API_KEY bo'lmasa AI o'chiq hisoblanadi (isEnabled()=false);
 *   chaqiruvchi WebApp formaga qaytadi (graceful degradation).
 * - extractJson() structured output (json_schema) bilan HAR DOIM sxemaga mos
 *   JSON qaytaradi; xato/refusal/timeout bo'lsa null qaytaradi (throw QILMAYDI).
 * - Faqat matnni tushunadi — UUID/narx kabi qiymatlarni KOD tekshiradi.
 */
@Injectable()
export class ClaudeService {
  private readonly client: Anthropic | null;

  constructor(
    private readonly logger: MyLogger,
    // Ixtiyoriy — AI xarajat jurnali. Berilmasa (modul import qilmagan bo'lsa)
    // yozuv o'tkazib yuboriladi; ClaudeService baribir ishlayveradi.
    @Optional() private readonly aiUsage?: AiUsageService,
  ) {
    const apiKey = (config.ANTHROPIC_API_KEY || '').trim();
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Bitta javob (bitta chaqiruv) usage'ini jurnalga yozadi — fire-and-forget.
   * meta berilmasa yoki AiUsageService yo'q bo'lsa jimgina o'tkazib yuboradi.
   */
  private recordUsage(
    response: Anthropic.Message,
    model: string,
    meta?: ClaudeUsageMeta,
  ): void {
    if (!meta || !this.aiUsage) return;
    const u = response.usage;
    this.aiUsage.record({
      feature: meta.feature,
      requestArea: meta.requestArea,
      model,
      inputTokens: u?.input_tokens ?? 0,
      outputTokens: u?.output_tokens ?? 0,
      cacheCreationTokens: u?.cache_creation_input_tokens ?? 0,
      cacheReadTokens: u?.cache_read_input_tokens ?? 0,
      steps: 1,
      orderId: meta.orderId,
      userId: meta.userId,
      conversationId: meta.conversationId,
    });
  }

  /**
   * Erkin matndan berilgan JSON sxemasiga mos strukturani ajratadi.
   * @returns sxemaga mos obyekt yoki null (o'chiq/xato/refusal/parse xatosi)
   *
   * ⚠️ MAXFIYLIK: userText mijoz PII'sini (ism/telefon/manzil) o'z ichiga oladi
   * va Anthropic (AQSh) API'ga yuboriladi. Bosqich 4 (hardening): Anthropic bilan
   * DPA + qisqa retention, va imkon boricha PII maskalash kerak.
   */
  async extractJson<T = unknown>(opts: {
    system: string;
    userText: string;
    schema: Record<string, unknown>;
    model?: string;
    maxTokens?: number;
    meta?: ClaudeUsageMeta;
  }): Promise<T | null> {
    if (!this.client) return null;

    const model = opts.model || config.AI_ORDER_MODEL || 'claude-haiku-4-5';
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        // Manzil/mijoz matni DATA sifatida — instruksiya emas (prompt-injection):
        messages: [
          {
            role: 'user',
            content: `<user_message>\n${opts.userText}\n</user_message>`,
          },
        ],
        output_config: {
          format: { type: 'json_schema', schema: opts.schema },
        },
      });

      // Tokenlar sarflandi (natija valid bo'lmasa ham) — xarajatni yozamiz.
      this.recordUsage(response, model, opts.meta);

      // Refusal yoki max_tokens — chiqish to'liq/valid bo'lmasligi mumkin
      if (response.stop_reason === 'refusal') {
        this.logger.log('Claude refused extraction request', 'ClaudeService');
        return null;
      }
      // max_tokens: JSON kesilib qolgan — parse xato beradi. Log qoldiramiz
      // (matn juda katta — foydalanuvchi partiyani bo'lishi kerak).
      if (response.stop_reason === 'max_tokens') {
        this.logger.log(
          'Claude output truncated (max_tokens) — matn juda katta',
          'ClaudeService',
        );
        return null;
      }

      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      if (!textBlock?.text) return null;

      return JSON.parse(textBlock.text) as T;
    } catch (err) {
      this.logger.log(
        `Claude extractJson error: ${(err as Error).message}`,
        'ClaudeService',
      );
      return null;
    }
  }

  /**
   * Erkin matn (proza) javob — moliyaviy narrativ hisobot / izoh uchun.
   * userText — BIZ hisoblagan agregat/raqamlar (ishonchli, PII yo'q), shuning
   * uchun to'g'ridan uzatiladi. Xato/refusal bo'lsa null qaytaradi (throw yo'q).
   * ⚠️ Model matematika QILMAYDI — faqat berilgan raqamlarni izohlaydi.
   */
  async ask(opts: {
    system: string;
    userText: string;
    model?: string;
    maxTokens?: number;
    meta?: ClaudeUsageMeta;
  }): Promise<string | null> {
    if (!this.client) return null;
    const model =
      opts.model ||
      config.AI_FINANCE_MODEL ||
      config.AI_ORDER_MODEL ||
      'claude-opus-4-8';
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 2048,
        system: opts.system,
        messages: [{ role: 'user', content: opts.userText }],
      });
      this.recordUsage(response, model, opts.meta);
      if (response.stop_reason === 'refusal') {
        this.logger.log('Claude refused ask request', 'ClaudeService');
        return null;
      }
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      return textBlock?.text?.trim() || null;
    } catch (err) {
      this.logger.log(
        `Claude ask error: ${(err as Error).message}`,
        'ClaudeService',
      );
      return null;
    }
  }

  /**
   * Tool-use (function calling) tsikli — model kerakli "asbob"larni O'ZI chaqiradi,
   * biz runTool bilan haqiqiy funksiyani bajaramiz, natijani modelga qaytaramiz;
   * model yakuniy matn javob bergunча (yoki maxSteps'gача) davom etadi.
   * Xato/refusal bo'lsa null. Raqamlar ASBOBlardan keladi — model to'qimaydi.
   */
  async askWithTools(opts: {
    system: string;
    userText?: string;
    // Multimodal (rasm+matn) uchun — berilsa userText o'rniga ishlatiladi.
    content?: Anthropic.ContentBlockParam[];
    tools: Anthropic.Tool[];
    runTool: (name: string, input: unknown) => Promise<unknown>;
    model?: string;
    maxTokens?: number;
    maxSteps?: number;
    meta?: ClaudeUsageMeta;
  }): Promise<{ text: string; toolsUsed: string[] } | null> {
    if (!this.client) return null;
    const model =
      opts.model ||
      config.AI_FINANCE_MODEL ||
      config.AI_ORDER_MODEL ||
      'claude-opus-4-8';
    const maxSteps = opts.maxSteps ?? 8;
    const toolsUsed: string[] = [];
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: opts.content ?? opts.userText ?? '' },
    ];
    // Barcha qadamlar usage'i BITTA jurnal qatoriga yig'iladi (foydalanuvchiga
    // ko'rinadigan bitta savol = bitta xarajat). finally'da yoziladi — xato/
    // erta chiqishda ham sarflangan token yo'qolmaydi.
    let inTok = 0;
    let outTok = 0;
    let cacheC = 0;
    let cacheR = 0;
    let steps = 0;

    try {
      for (let step = 0; step < maxSteps; step++) {
        const response = await this.client.messages.create({
          model,
          max_tokens: opts.maxTokens ?? 1500,
          system: opts.system,
          tools: opts.tools,
          messages,
        });
        steps++;
        inTok += response.usage?.input_tokens ?? 0;
        outTok += response.usage?.output_tokens ?? 0;
        cacheC += response.usage?.cache_creation_input_tokens ?? 0;
        cacheR += response.usage?.cache_read_input_tokens ?? 0;

        if (response.stop_reason === 'refusal') {
          this.logger.log('Claude refused askWithTools', 'ClaudeService');
          return null;
        }

        const toolUses = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        // Model asbob chaqirdi — bajarib, natijani qaytaramiz va davom etamiz.
        if (response.stop_reason === 'tool_use' && toolUses.length) {
          messages.push({ role: 'assistant', content: response.content });
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            toolsUsed.push(tu.name);
            let result: unknown;
            try {
              result = await opts.runTool(tu.name, tu.input);
            } catch (e) {
              result = { error: (e as Error).message };
            }
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result ?? null),
            });
          }
          messages.push({ role: 'user', content: results });
          continue;
        }

        // Yakuniy matn javob.
        const textBlock = response.content.find(
          (b): b is Anthropic.TextBlock => b.type === 'text',
        );
        return { text: textBlock?.text?.trim() || '', toolsUsed };
      }
      // maxSteps tugadi — ko'p qadam.
      return {
        text: "Savolga to'liq javob berib bo'lmadi (juda ko'p qadam). Savolni aniqroq bering.",
        toolsUsed,
      };
    } catch (err) {
      this.logger.log(
        `Claude askWithTools error: ${(err as Error).message}`,
        'ClaudeService',
      );
      return null;
    } finally {
      // Sarflangan token — muvaffaqiyat/xato/erta chiqishdan qat'i nazar yoziladi.
      if (opts.meta && this.aiUsage && steps > 0) {
        this.aiUsage.record({
          feature: opts.meta.feature,
          requestArea: opts.meta.requestArea,
          model,
          inputTokens: inTok,
          outputTokens: outTok,
          cacheCreationTokens: cacheC,
          cacheReadTokens: cacheR,
          steps,
          orderId: opts.meta.orderId,
          userId: opts.meta.userId,
          conversationId: opts.meta.conversationId,
        });
      }
    }
  }
}
