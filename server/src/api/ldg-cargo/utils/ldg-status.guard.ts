import { Order_status } from 'src/common/enums';

/**
 * LDG bilan sinxronlashda "yakunlangan" (terminal) deb hisoblanadigan bizning
 * order statuslari. Ikki yo'nalishda ham ishlatiladi:
 *
 *   1. JO'NATISH (dispatch): bu holatdagi buyurtmalar LDG'ga JO'NATILMAYDI
 *      (ldg-shipment.service.ts → createShipmentForOrder). Yakunlangan buyurtma
 *      LDG'da qayta yaratilsa, LDG o'z statusini qaytarib keraksiz mismatch beradi.
 *
 *   2. QABUL (webhook/reconcile): LDG'dan kelgan ORALIQ statuslar (RECEIVED,
 *      IN_TRANSIT, OUT_FOR_DELIVERY, "8" va h.k.) bu holatdagi buyurtmani ORQAGA
 *      qaytara olmasligi kerak (masalan SOLD → WAITING, CLOSED → WAITING). Terminal
 *      status esa o'z oqimidagi maxsus guardlar bilan (mark*ByLdg) boshqariladi.
 *
 * Yagona manba — shu ro'yxat ikkiga bo'linib "drift" qilmasligi uchun.
 */
export const LDG_FINAL_ORDER_STATUSES: readonly Order_status[] = [
  Order_status.SOLD,
  Order_status.PAID,
  Order_status.PARTLY_PAID,
  Order_status.CANCELLED,
  Order_status.CANCELLED_SENT,
  Order_status.CLOSED,
];

/**
 * CLOSED ("Yopilgan") — buyurtmaning eng yakuniy holati. Uni FAQAT skaner oqimi
 * qo'ya oladi (receiveWithScaner / receiveCanceledPost), chunki CLOSED "mahsulot
 * jismonan bizga qaytib keldi va skaner bilan tasdiqlandi" degan invariantni
 * bildiradi. LDG hech qachon CLOSED yoza olmaydi — u eng ko'pi bilan buyurtmani
 * CANCELLED_SENT ("Bekor (yuborilgan)" — qaytish yo'lida, skaner kutilmoqda)
 * holatiga o'tkaza oladi.
 *
 * Bu funksiya LDG kelib chiqishli har qanday status yozuvida chaqiriladi va
 * taqiqni buzadigan yozuvni darhol to'xtatadi (regressiyaga qarshi qo'riqchi).
 */
export function assertLdgMayNotClose(status: Order_status): void {
  if (status === Order_status.CLOSED) {
    throw new Error(
      "LDG buyurtmani CLOSED (Yopilgan) qila olmaydi — CLOSED faqat skaner oqimidan qo'yiladi",
    );
  }
}

/** LDG kelib chiqishli status yozuvi shu statusni orqaga qaytara olmaydimi? */
export function isLdgFinalStatus(status: Order_status): boolean {
  return LDG_FINAL_ORDER_STATUSES.includes(status);
}
