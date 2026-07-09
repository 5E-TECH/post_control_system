import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import config from 'src/config';
import { MyLogger } from 'src/logger/logger.service';

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

  constructor(private readonly logger: MyLogger) {
    const apiKey = (config.ANTHROPIC_API_KEY || '').trim();
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  isEnabled(): boolean {
    return this.client !== null;
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
  }): Promise<T | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.create({
        model: opts.model || config.AI_ORDER_MODEL || 'claude-haiku-4-5',
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
}
