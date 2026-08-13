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
  }): Promise<string | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.create({
        model:
          opts.model ||
          config.AI_FINANCE_MODEL ||
          config.AI_ORDER_MODEL ||
          'claude-opus-4-8',
        max_tokens: opts.maxTokens ?? 2048,
        system: opts.system,
        messages: [{ role: 'user', content: opts.userText }],
      });
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
    userText: string;
    tools: Anthropic.Tool[];
    runTool: (name: string, input: unknown) => Promise<unknown>;
    model?: string;
    maxTokens?: number;
    maxSteps?: number;
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
      { role: 'user', content: opts.userText },
    ];

    try {
      for (let step = 0; step < maxSteps; step++) {
        const response = await this.client.messages.create({
          model,
          max_tokens: opts.maxTokens ?? 1500,
          system: opts.system,
          tools: opts.tools,
          messages,
        });

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
    }
  }
}
