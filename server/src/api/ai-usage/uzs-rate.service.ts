import { Injectable } from '@nestjs/common';
import { MyLogger } from 'src/logger/logger.service';
import config from 'src/config';

/**
 * USD -> UZS kursi. Manba: O'zbekiston Markaziy banki (CBU) ochiq API'si
 * (auth talab qilmaydi). Kuniga bir marta olinadi va kesh qilinadi; CBU
 * ishlamay qolsa yoki javob buzuq bo'lsa `AI_USD_UZS_RATE` (env/default)
 * fallback bo'ladi. Shu tariqa kursni qo'lda yangilash shart emas, lekin
 * tashqi API AI xarajat yozuvini hech qachon buzmaydi.
 */
const CBU_USD_URL = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/';
const FETCH_TIMEOUT_MS = 4000;

@Injectable()
export class UzsRateService {
  constructor(private readonly logger: MyLogger) {}

  // Kunlik kesh: { rate, day } — day = Toshkent kalendar kuni (YYYY-MM-DD).
  private cached: { rate: number; day: string } | null = null;
  // Bir vaqtda faqat bitta so'rov ketsin (bir necha chaqiruv CBU'ni bombardimon
  // qilmasligi uchun — in-flight promise'ni ulashamiz).
  private inFlight: Promise<number> | null = null;

  /** Toshkent kalendar kuni (UTC+5), Date.now dan. */
  private todayTashkent(): string {
    const ms = Date.now() + 5 * 3600 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  private fallbackRate(): number {
    return Number(config.AI_USD_UZS_RATE) || 0;
  }

  /**
   * Amaldagi USD->UZS kursi. Bugungi kesh bo'lsa — o'shani, bo'lmasa CBU'dan
   * oladi. Har qanday xatolikda: eski kesh bor bo'lsa uni, aks holda env/default.
   * Hech qachon throw qilmaydi.
   */
  async getRate(): Promise<number> {
    const day = this.todayTashkent();
    if (this.cached && this.cached.day === day && this.cached.rate > 0) {
      return this.cached.rate;
    }
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.fetchAndCache(day).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async fetchAndCache(day: string): Promise<number> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let data: unknown;
      try {
        const res = await fetch(CBU_USD_URL, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`CBU HTTP ${res.status}`);
        data = await res.json();
      } finally {
        clearTimeout(timer);
      }
      const rate = UzsRateService.parseRate(data);
      if (rate > 0) {
        this.cached = { rate, day };
        return rate;
      }
      throw new Error('CBU javobidan kurs topilmadi');
    } catch (err) {
      this.logger.log(
        `CBU kurs olinmadi (${(err as Error).message}) — fallback ishlatildi`,
        'UzsRateService',
      );
      // Eski kesh env'dan yaxshiroq (yaqinroq) — bor bo'lsa uni saqlaymiz.
      if (this.cached && this.cached.rate > 0) return this.cached.rate;
      return this.fallbackRate();
    }
  }

  /**
   * CBU javobidan USD kursini ajratadi. Javob massiv:
   * `[{ "Ccy":"USD", "Rate":"11789.33", "Date":"08.09.2026" }]`.
   * Sof funksiya — testlanadi. Topilmasa 0 qaytaradi.
   */
  static parseRate(data: unknown): number {
    const arr = Array.isArray(data) ? data : [data];
    const usd = arr.find((x) => {
      const ccy = (x as { Ccy?: string; ccy?: string })?.Ccy ??
        (x as { ccy?: string })?.ccy;
      return typeof ccy === 'string' && ccy.toUpperCase() === 'USD';
    }) as { Rate?: string; rate?: string } | undefined;
    const raw = usd?.Rate ?? usd?.rate;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}
