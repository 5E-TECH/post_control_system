/**
 * BEKOR QAYTARISHNI MARKETGA TOPSHIRISH — sessiya va rejim qiymatlari.
 *
 * Alohida faylda, chunki `src/core/entity/market-return-handover-session.entity.ts`
 * ham import qiladi (entity → modul enum yo'nalishi marketplace moduli bilan
 * ayni: marketplace-scan-session.entity.ts → marketplace.enums.ts).
 */

/**
 * Sessiya holati.
 *
 *   PENDING — market QR/PIN yaratdi, xodim hali skanerlamagan.
 *   ACTIVE  — xodim skanerladi; 10 daqiqalik topshirish oynasi OCHIQ.
 *   CLOSED  — yakunlandi, sahifadan chiqildi, heartbeat uzildi yoki
 *             muddati tugadi. Yopilgan sessiya BOSHQA ishlatilmaydi.
 */
export enum MarketHandoverSessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

/** Sessiya qaysi yo'l bilan ochilgan. */
export enum MarketHandoverChannel {
  /** Market o'z kabinetida QR/PIN ko'rsatdi. */
  WEB = 'web',
  /** Market panelga kira olmadi — vakil akti bilan topshirildi. */
  OFFLINE = 'offline',
}

/** Sessiya NEGA yopilgani (audit + nosozlikni tushunish uchun). */
export enum MarketHandoverCloseReason {
  /** Xodim «Yakunlash» bosdi. */
  FINISHED = 'finished',
  /** Xodim topshirish sahifasidan chiqdi (release chaqirig'i). */
  LEFT_PAGE = 'left_page',
  /** Heartbeat uzildi — brauzer qulashi / tarmoq yo'qolishi. */
  HEARTBEAT_LOST = 'heartbeat_lost',
  /** 10 daqiqalik oyna tugadi. */
  EXPIRED = 'expired',
  /** Market yangi QR so'radi — eski PENDING sessiya bekor qilindi. */
  SUPERSEDED = 'superseded',
  /** PIN urinishlari chegarasidan oshdi — sessiya bloklandi. */
  PIN_BLOCKED = 'pin_blocked',
  /** Offline akt bilan bir martalik yopilgan sessiya. */
  OFFLINE_ACT = 'offline_act',
}

/**
 * Buyurtma QANDAY ruxsat bilan marketga topshirilgani
 * (`order.market_handover_mode`).
 *
 * ⚠️ Hisobotda market tasdig'i bilan yopilgan va CHETLAB O'TILGAN
 * holatlarni ajratish uchun kerak. `null` + status CLOSED = legacy qator
 * (oqim joriy etilishidan oldin yopilgan — unga soxta dalil yozilmaydi).
 */
export enum MarketHandoverMode {
  /** Market o'z kabinetida QR/PIN ko'rsatdi — eng ishonchli yo'l. */
  MARKET_WEB = 'market_web',
  /** Market vakili jismonan keldi, akt imzolandi (ism+telefon+sabab). */
  OFFLINE_SIGNED = 'offline_signed',
  /** Admin qaroriga ko'ra yopildi (sabab majburiy). */
  ADMIN_OVERRIDE = 'admin_override',
  /** Marketplace vakil-market: panelga kirmaydi, hamkorga signal yuboriladi. */
  PARTNER_AUTO = 'partner_auto',
}

/** Market QR'i / PIN'i amal qiladigan vaqt — 2 daqiqa. */
export const MARKET_HANDOVER_QR_TTL_MS = 2 * 60 * 1000;

/**
 * Skan qilingandan keyingi topshirish oynasi — 10 daqiqa.
 *
 * Elchi'da bu 5 daqiqa va sessiya BIR MARTALIK. BeePost hajmida (market bir
 * kelganda 100–200 posilka olib ketadi) bu yetmaydi: xodim yarmini
 * topshirib qolib ketardi. Shuning uchun oyna uzaytirildi VA oyna ichida
 * partiya-partiya topshirishga ruxsat berildi.
 */
export const MARKET_HANDOVER_AUTH_TTL_MS = 10 * 60 * 1000;

/**
 * Heartbeat yo'qolishiga beriladigan muhlat — 60 s.
 *
 * Ruxsat topshirish SAHIFASIGA bog'langan: sahifadan chiqilsa `release`
 * chaqirig'i sessiyani yopadi. Lekin brauzer qulasa yoki tarmoq uzilsa
 * `release` KELMAYDI — shuning uchun sahifa har 30 s da `heartbeat` yuboradi
 * va bu muhlatdan uzoq jim qolgan sessiya o'lik hisoblanadi.
 */
export const MARKET_HANDOVER_HEARTBEAT_GRACE_MS = 60 * 1000;

/** Sahifa heartbeat yuborish davri (client uchun; javobda qaytariladi). */
export const MARKET_HANDOVER_HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** PIN'ni topishga urinishlar chegarasi — keyin sessiya yopiladi. */
export const MARKET_HANDOVER_PIN_MAX_ATTEMPTS = 5;

/**
 * Shikastlangan posilka yorlig'i uchun YOPIQ sabab ro'yxati.
 *
 * Market QR'i bilan ochilgan sessiya ICHIDA, posilkaning o'z QR'i
 * o'qilmasa — xodim uni qo'lda belgilaydi. Bu market ruxsatini EMAS,
 * faqat posilka yorlig'ini chetlab o'tadi.
 *
 * ⚠️ Ro'yxat YOPIQ (`@IsIn`) — erkin matn bo'lsa "sabab" maydoni
 * ma'nosini yo'qotadi va hisobotda guruhlab bo'lmaydi. Client AYNAN shu
 * qiymatlarni yuboradi (tarjima qilingan yorliqni EMAS).
 */
export const MARKET_HANDOVER_MANUAL_REASONS = [
  'QR yirtilgan',
  "QR o'qilmayapti",
  "Yorliq yo'qolgan",
  'QR namlangan yoki xiralashgan',
] as const;

export const MARKET_HANDOVER_MANUAL_REASON_MAX_LENGTH = 80;
