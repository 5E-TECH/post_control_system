import { Telegraf } from 'telegraf';

const bot = new Telegraf('7736357866:AAGgYmK5mlNaqWWaFrozbRYXr4er6FYUvH4');

(async () => {
  await bot.telegram.getUpdates({ timeout: 0 });
  console.log('Old polling sessiyalari tozalandi.');
  process.exit(0);
})();
