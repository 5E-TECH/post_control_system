import {
  Order_status,
  Post_status,
  PaymentMethod,
  Cashbox_type,
  Where_deliver,
  Roles,
} from 'src/common/enums';

/**
 * Yagona status -> o'zbekcha yorliq manbai.
 *
 * Bazada statuslar inglizcha enum kodlari sifatida saqlanadi
 * (masalan: 'on the road', 'cancelled (sent)'). Loglar tavsifida yoki
 * foydalanuvchiga ko'rsatiladigan xabarlarda xom kodni emas, shu yerdagi
 * o'qiladigan o'zbekcha matnni ishlatish kerak.
 *
 * Noma'lum kod uchun kodning o'zi qaytadi (hech qachon throw qilmaydi).
 */

const ORDER_STATUS_UZ: Record<string, string> = {
  [Order_status.CREATED]: 'Yaratildi',
  [Order_status.NEW]: 'Yangi',
  [Order_status.RECEIVED]: 'Qabul qilindi',
  [Order_status.ON_THE_ROAD]: "Yo'lda",
  [Order_status.WAITING]: 'Kutilmoqda',
  [Order_status.SOLD]: 'Sotildi',
  [Order_status.CANCELLED]: 'Bekor qilindi',
  [Order_status.PAID]: "To'langan",
  [Order_status.PARTLY_PAID]: "Qisman to'langan",
  [Order_status.CANCELLED_SENT]: 'Bekor (yuborilgan)',
  [Order_status.CLOSED]: 'Yopilgan',
};

const POST_STATUS_UZ: Record<string, string> = {
  [Post_status.NEW]: 'Yangi',
  [Post_status.SENT]: "Jo'natildi",
  [Post_status.RECEIVED]: 'Qabul qilindi',
  [Post_status.CANCELED]: 'Bekor qilingan',
  [Post_status.CANCELED_RECEIVED]: 'Bekor qabul qilindi',
};

const PAYMENT_METHOD_UZ: Record<string, string> = {
  [PaymentMethod.CASH]: 'Naqd',
  [PaymentMethod.CLICK]: 'Karta (Click)',
  [PaymentMethod.CLICK_TO_MARKET]: 'Karta (Marketga)',
};

const CASHBOX_TYPE_UZ: Record<string, string> = {
  [Cashbox_type.MAIN]: 'Asosiy kassa',
  [Cashbox_type.FOR_COURIER]: 'Kuryerlar kassasi',
  [Cashbox_type.FOR_MARKET]: 'Marketlar kassasi',
};

const WHERE_DELIVER_UZ: Record<string, string> = {
  [Where_deliver.CENTER]: 'Markazga',
  [Where_deliver.ADDRESS]: 'Manzilga',
};

const ROLE_UZ: Record<string, string> = {
  [Roles.SUPERADMIN]: 'Super Admin',
  [Roles.ADMIN]: 'Admin',
  [Roles.COURIER]: 'Kuryer',
  [Roles.REGISTRATOR]: 'Registrator',
  [Roles.MARKET]: 'Market',
  [Roles.CUSTOMER]: 'Mijoz',
  [Roles.OPERATOR]: 'Operator',
  [Roles.LOGIST]: 'Logist',
};

/** Buyurtma statusi kodini o'zbekcha yorliqqa aylantiradi. */
export function orderStatusUz(code?: string | null): string {
  if (!code) return '-';
  return ORDER_STATUS_UZ[code] ?? code;
}

/** Pochta statusi kodini o'zbekcha yorliqqa aylantiradi. */
export function postStatusUz(code?: string | null): string {
  if (!code) return '-';
  return POST_STATUS_UZ[code] ?? code;
}

/** To'lov usuli kodini o'zbekcha yorliqqa aylantiradi. */
export function paymentMethodUz(code?: string | null): string {
  if (!code) return '-';
  return PAYMENT_METHOD_UZ[code] ?? code;
}

/** Kassa turini o'zbekcha yorliqqa aylantiradi. */
export function cashboxTypeUz(code?: string | null): string {
  if (!code) return '-';
  return CASHBOX_TYPE_UZ[code] ?? code;
}

/** Yetkazib berish joyini o'zbekcha yorliqqa aylantiradi. */
export function whereDeliverUz(code?: string | null): string {
  if (!code) return '-';
  return WHERE_DELIVER_UZ[code] ?? code;
}

/** Rol kodini o'zbekcha yorliqqa aylantiradi. */
export function roleUz(code?: string | null): string {
  if (!code) return '-';
  return ROLE_UZ[code] ?? code;
}
