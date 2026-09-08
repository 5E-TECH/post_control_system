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
  // Ekstraksiya modeli. Sonnet 4.6 aralash o'zbek/rus matn, noaniq manzil va
  // narx×son hisobida yetarli aniq VA Opus'dan ~1.7x arzon (marja saqlanadi:
  // prompt caching bilan ~1 buyurtma ~120-160 so'm, 300 olasan). Aniqlik
  // pasaymasligi uchun tuman/viloyat rezolyutsiyasi kuchaytirildi (viloyat
  // cheklovi + LLM xavfsizlik to'ri). Structured output (json_schema); thinking
  // default o'chiq. Kerak bo'lsa .env orqali Opus'ga ko'tarish mumkin.
  AI_ORDER_MODEL: String(process.env.AI_ORDER_MODEL || 'claude-sonnet-4-6'),
  // Rasm orqali buyurtma (vision) ekstraksiya modeli — rasmдаги matnни o'qib
  // buyurtма ma'lumotini ajratadi. Aniqlik/narx muvozanati uchun Sonnet 4.6.
  // Vision qo'llaydigan model bo'lishi SHART (Opus/Sonnet; Haiku ham vision).
  AI_ORDER_VISION_MODEL: String(
    process.env.AI_ORDER_VISION_MODEL || 'claude-sonnet-4-6',
  ),
  // Moliyaviy AI (Elchin: xarajat hisoboti, savol-javob, fayl tahlili) modeli.
  // Sonnet 4.6 — matematikani KOD qiladi, model faqat tayyor raqamlarni izohlaydi
  // (til vazifasi), shuning uchun Sonnet Opus bilan deyarli teng VA ~1.7x arzon;
  // prompt caching bilan yana arzon. Kerak bo'lsa .env orqali Opus'ga ko'tariladi.
  AI_FINANCE_MODEL: String(
    process.env.AI_FINANCE_MODEL || 'claude-sonnet-4-6',
  ),
  // MEXANIK/mayda AI vazifalari modeli — tuman indeks tanlash, mahsulot
  // moslashtirish, izoh kategoriyalash (yopiq ro'yxatdan RAQAM tanlash). Bular
  // oddiy klassifikatsiya, arzon model (Haiku 4.5) bemalol uddalaydi va ~5
  // barobar arzon. Ekstraksiya + chat/tahlil baribir AI_ORDER/FINANCE_MODEL
  // (Opus) da qoladi. Bo'sh bo'lsa Haiku 4.5.
  AI_CLASSIFY_MODEL: String(
    process.env.AI_CLASSIFY_MODEL || 'claude-haiku-4-5',
  ),
  // Bir AI buyurtma narxi (so'm) — market ai_price_per_order null bo'lsa shu
  // global default ishlatiladi. Har market uchun UI'da alohida belgilanadi.
  AI_PRICE_PER_ORDER: Number(process.env.AI_PRICE_PER_ORDER || 300),
  // USD -> so'm kursi — AI real xarajatini (Anthropic hisobi USD'да) so'mga
  // aylantirish uchun (ai_usage_log + AI dashboard). Kurs o'zgarsa .env'дан
  // yangilanadi; eski yozuvlar o'z kursini saqlaydi (audit uchun qatorда yoziladi).
  AI_USD_UZS_RATE: Number(process.env.AI_USD_UZS_RATE || 12800),
};
