import { Logger } from '@nestjs/common';
import type { Telegraf } from 'telegraf';

/**
 * BOTLARNI JIMLATISH — lokal ishga tushirish uchun.
 *
 * ── MUAMMO ──────────────────────────────────────────────────────────────
 *
 * `npm run start:dev` ni lokal yurgizganda Telegraf `.env` dagi token
 * bilan Telegram'ga POLLING ochadi. Agar o'sha token ishlab turgan bot
 * tokeni bo'lsa, lokal nusxa prod botiga kelayotgan mijoz xabarlarini
 * O'ZIGA TORTIB oladi — prod bot ularni ko'rmaydi (Telegram bitta
 * `getUpdates` oqimini faqat bitta iste'molchiga beradi).
 *
 * Shu sabab bu loyihada lokal E2E sinov umuman qilinmasdi va har bir
 * tekshiruv faqat baza + unit testlar bilan cheklanardi.
 *
 * ── YECHIM: IKKI QATLAM ─────────────────────────────────────────────────
 *
 * 1. `launchOptions: false` — `bot.launch()` chaqirilmaydi, ya'ni
 *    POLLING umuman boshlanmaydi (nestjs-telegraf
 *    `create-bot-factory.util.js:11`). Bu KIRUVCHI tomonni yopadi.
 *
 * 2. Bu util — CHIQUVCHI tomonni yopadi. Polling yo'q bo'lsa ham bot
 *    obyekti yaratiladi va `bot.telegram.sendMessage(...)` baribir
 *    Telegram'ga ketadi. Lokal bazadagi `group_id` lar esa HAQIQIY
 *    guruhlarga ishora qilishi mumkin.
 *
 * ⚠️ NEGA `callApi`. Telegraf'da HAR BIR API metodi (`sendMessage`,
 * `editMessageText`, `sendPhoto`, `getMe` ...) yakunda `telegram.callApi`
 * ga boradi (`telegraf/lib/telegram.js`). Ya'ni bu YAGONA chokepoint —
 * 17 ta chaqiruv joyini alohida qo'riqlash shart emas va yangi chaqiruv
 * qo'shilsa u ham avtomatik qamrab olinadi.
 *
 * ⚠️ NEGA XATO OTADI, `undefined` QAYTARMAYDI. Ba'zi chaqiruvchilar
 * javobdan `message_id` ni olib bazaga yozadi (`create_bot_messages`).
 * Soxta id yozilsa keyinchalik `editMessageText` tushunarsiz xato
 * berardi va ma'lumot iflos bo'lardi. Xato otish esa mavjud
 * `try/catch` larga TARMOQ UZILISHI bilan bir xil ko'rinadi — bu
 * yo'llar allaqachon shunga moslashgan (masalan `order.service.ts`
 * dagi `!messageRefs.length` -> buyurtma `NEW` ga o'tadi).
 *
 * ⚠️ Ishga tushishda hech narsa buzilmaydi: `launchOptions: false`
 * bo'lgani uchun nestjs-telegraf `getMe` ni ham chaqirmaydi.
 */
export function muteBotOutbound(bot: Telegraf<any>, label: string): void {
  const logger = new Logger('BotMute');

  type ApiClient = { callApi: (...args: unknown[]) => Promise<unknown> };
  const telegram = bot?.telegram as unknown as ApiClient | undefined;
  if (!telegram || typeof telegram.callApi !== 'function') {
    logger.warn(`${label}: callApi topilmadi — jimlatish o'tkazib yuborildi.`);
    return;
  }

  /** ⚠️ Ikki marta jimlatishdan saqlanish (modul qayta yuklanishi). */
  const flag = '__muted__';
  if ((telegram as unknown as Record<string, unknown>)[flag]) return;
  (telegram as unknown as Record<string, unknown>)[flag] = true;

  telegram.callApi = (...args: unknown[]) => {
    const method = String(args[0] ?? 'unknown');
    return Promise.reject(
      new Error(
        `BOTS_ENABLED=false — Telegram '${method}' chaqiruvi yuborilmadi (${label}).`,
      ),
    );
  };

  logger.warn(
    `🔇 ${label}: botlar O'CHIRILGAN (BOTS_ENABLED=false). ` +
      'Polling yo\'q, chiquvchi xabarlar ham yuborilmaydi.',
  );
}
