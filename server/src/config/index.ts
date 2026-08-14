import { config } from 'dotenv';
config();

export default {
  PORT: Number(process.env.PORT),
  PORT_PRINT: Number(process.env.PORT_PRINT),
  PROD_HOST: String(process.env.PROD_HOST),
  DB_URL: String(process.env.DB_URL),
  HOST_URL: String(process.env.HOST_URL),
  ADMIN_NAME: String(process.env.SUPERADMIN_NAME),
  ADMIN_PHONE_NUMBER: String(process.env.SUPERADMIN_PHONE_NUMBER),
  ADMIN_PASSWORD: String(process.env.SUPERADMIN_PASSWORD),

  ACCESS_TOKEN_KEY: String(process.env.ACCESS_TOKEN_KEY),
  ACCESS_TOKEN_TIME: String(process.env.ACCESS_TOKEN_TIME),
  REFRESH_TOKEN_KEY: String(process.env.REFRESH_TOKEN_KEY),
  REFRESH_TOKEN_TIME: String(process.env.REFRESH_TOKEN_TIME),

  BOT_TOKEN: String(process.env.BOT_TOKEN),
  BOT_NAME: String(process.env.BOT_NAME),
  ORDER_BOT_TOKEN: String(process.env.ORDER_BOT_TOKEN),
  ORDER_BOT_NAME: String(process.env.ORDER_BOT_NAME),
  NGROK_AUTHTOKEN: String(process.env.NGROK_AUTHTOKEN),
  PRINTER_LOCAL_URL: String(process.env.PRINTER_LOCAL_URL),
  UPLOAD_URL: String(process.env.UPLOAD_URL),
  WEB_APP_URL: String(
    process.env.WEB_APP_URL || 'https://beepost.uz/admin/bot',
  ),

  // AI (Claude) — bo'sh bo'lsa AI oqimi o'chiriladi, WebApp forma ishlayveradi
  ANTHROPIC_API_KEY: String(process.env.ANTHROPIC_API_KEY || ''),
  // Ekstraksiya sifati "haqiqiy AI" hissi uchun kritik — kuchli model tanlanadi.
  // Opus 4.8 aralash o'zbek/rus matn, noaniq manzil (Toshkent shahri/viloyati) va
  // narx×son hisobida Haiku'dan sezilarli aniqroq. Structured output (json_schema)
  // qo'llanadi; thinking default o'chiq (tez, arzon ekstraksiya). Har buyurtma AI
  // xarajati ~185 so'm (sen 300 olasan) — foyda saqlanadi.
  AI_ORDER_MODEL: String(process.env.AI_ORDER_MODEL || 'claude-opus-4-8'),
  // Moliyaviy AI (xarajat hisoboti, savol-javob, insight) modeli — sifat uchun
  // Opus 4.8. Faqat superadmin/admin ishlatadi (ichki asbob, charj yo'q).
  AI_FINANCE_MODEL: String(process.env.AI_FINANCE_MODEL || 'claude-opus-4-8'),
  // Bir AI buyurtma narxi (so'm) — market ai_price_per_order null bo'lsa shu
  // global default ishlatiladi. Har market uchun UI'da alohida belgilanadi.
  AI_PRICE_PER_ORDER: Number(process.env.AI_PRICE_PER_ORDER || 300),
};
