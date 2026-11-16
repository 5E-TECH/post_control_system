/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';

/**
 * SHTRAF ULANISHI — REGRESSIYA QULFI.
 *
 * ⚠️ NEGA MANBA MATNINI O'QIYMIZ. Shtraf hisobi `OrderService` ning uchta
 * ULKAN metodi ichida bitta qatordan iborat. Bu qator tasodifan o'chirilsa
 * yoki yangi belgilash yo'li qo'shilib unga ulanmasa, `tsc` ham, boshqa
 * testlar ham MIQ etmaydi: tizim shunchaki jim ishlashda davom etadi va
 * shtraf hech kimdan undirilmaydi. Nuqson faqat oylar o'tib, «nega
 * daftar bo'sh» degan savol bilan topilardi.
 *
 * Shu sababli bu test KODNI ISHLATMAYDI, uni O'QIYDI.
 */
const SERVICE = path.resolve(__dirname, 'order.service.ts');

function source(): string {
  return fs.readFileSync(SERVICE, 'utf8');
}

/** `async <nom>(` dan keyingi, keyingi metod boshlanishigacha bo'lgan matn. */
function methodBody(src: string, name: string): string {
  const start = src.indexOf(`  async ${name}(`);
  if (start === -1) throw new Error(`metod topilmadi: ${name}`);
  const next = src.indexOf('\n  async ', start + 10);
  return src.slice(start, next === -1 ? src.length : next);
}

const CALL = 'this.courierPenalty.recordForOrder(';

describe('kechikkan belgilash — shtraf ulanishi', () => {
  const src = source();

  /**
   * Uchala BELGILASH yo'li. Kuryer buyurtmani «hal qilgan» deb e'lon
   * qiladigan har bir yo'l shtraf hisobini chaqirishi SHART — biri
   * ulanmasa kuryer eng bo'sh yo'lni topib ishlatardi.
   */
  it.each(['sellOrder', 'partlySold', 'cancelOrder'])(
    '%s shtraf hisobini chaqiradi',
    (method) => {
      expect(methodBody(src, method)).toContain(CALL);
    },
  );

  /**
   * ⚠️ CHAQIRUV `save(order)` DAN KEYIN bo'lishi kerak: hisob
   * `order.courier_tariff` va `sold_at`/`cancelled_at` ning YANGI
   * qiymatlariga tayanadi. Oldin chaqirilsa tarif `null` bo'lib,
   * shtraf chegarasi noto'g'ri olinardi.
   */
  it.each(['sellOrder', 'partlySold', 'cancelOrder'])(
    "%s da chaqiruv save(order) dan KEYIN turadi",
    (method) => {
      const body = methodBody(src, method);
      const save = body.indexOf('await queryRunner.manager.save(order);');
      const call = body.indexOf(CALL);
      expect(save).toBeGreaterThan(-1);
      expect(call).toBeGreaterThan(save);
    },
  );

  /**
   * ⚠️ TRANZAKSIYA ICHIDA. Chaqiruv `queryRunner.manager` ni berishi
   * kerak, o'z repozitoriysini EMAS: sotuv rollback bo'lsa shtraf yozuvi
   * ham yo'qolishi shart, aks holda bajarilmagan sotuv uchun kuryerda
   * shtraf qolib ketardi.
   */
  it('chaqiruvlar tranzaksiya managerini uzatadi', () => {
    const calls = src.split(CALL).slice(1);
    /**
     * TO'RTTA chaqiruv: `sellOrder`, `cancelOrder`, `partlySold` va
     * `rollbackOrderToWaiting` ning TERMINAL nishoni (`cancelled` /
     * `cancelled_sent`). To'rtinchisi 2026-10-15 da qo'shildi: terminal
     * nishonga rollback ham BELGILASH, lekin u shtraf moduliga ulanmagan
     * edi va «1-kuni sotildi → 30 kun → cancelled ga rollback» qochish
     * yo'lini ochib turgandi.
     */
    expect(calls).toHaveLength(4);
    for (const after of calls) {
      expect(after.slice(0, 40)).toContain('queryRunner.manager');
    }
  });

  /**
   * ⚠️ `await` SHART. `await`siz qoldirilsa yozuv tranzaksiya yopilgandan
   * KEYIN bajarilib, «tranzaksiya allaqachon tugagan» xatosiga tushardi —
   * va u sotuv javobidan keyin chiqib, hech kim ko'rmasdi.
   */
  it('chaqiruvlar await bilan', () => {
    const occurrences = src.split(CALL).length - 1;
    const awaited = src.split(`await ${CALL}`).length - 1;
    expect(awaited).toBe(occurrences);
  });
});

/**
 * YANGI BELGILASH YO'LI QO'SHILSA USHLAYDI.
 *
 * ⚠️ NEGA SANOQ. Shtraf tizimining eng xavfli nuqsoni — «eng bo'sh yo'l».
 * Agar kelajakda `sold_at` yoki `cancelled_at` yozadigan YANGI yo'l
 * qo'shilib, unga shtraf hisobi ulanmasa, kuryerlar o'sha yo'lni topib
 * ishlatardi va modul jimgina ma'nosini yo'qotardi. Statik sanoq buni
 * ushlaydi: son o'zgarsa, dasturchi yo ulashi, yo istisnoni shu yerda
 * sabab bilan yozib qoldirishi kerak.
 */
describe("belgilash yo'llari ro'yxati — yangisi jim qo'shilmasin", () => {
  const src = source();

  /**
   * Hozirgi yozuv joylari (`order.service.ts`):
   *
   *   sellOrder     — `sold_at: Date.now()` + `cancelled_at: null`   → ULANGAN
   *   cancelOrder   — `cancelled_at: Date.now()`                      → ULANGAN
   *   partlySold    — `sold_at: ... ?? Date.now()` + `cancelled_at: null` → ULANGAN
   *   partlySold'ning BOLA buyurtmasi — `cancelled_at: Date.now()`    → ATAYLAB ULANMAGAN
   *       (hisob bo'linishi, ayni posilka — ikki marta jazolanmasin)
   *   bulkSellOrders — `sold_at: o.sold_at` faqat JAVOB shakli, yozuv emas
   *
   * Bulk yo'llari (`bulk/sell`, `bulk/cancel`) o'z mantiqini
   * TAKRORLAMAYDI — ular `sellOrder`/`cancelOrder` ni chaqiradi, shuning
   * uchun avtomatik qamralgan (TC: quyida).
   */
  const EXPECTED_WRITE_SITES = 7;

  it('sold_at / cancelled_at yozuv joylari soni o\'zgarmagan', () => {
    const sites = src.match(/\b(sold_at|cancelled_at): /g) ?? [];
    expect(sites).toHaveLength(EXPECTED_WRITE_SITES);
  });

  /**
   * ⚠️ IKKINCHI SHAKL — `order.cancelled_at = Date.now()`.
   *
   * Yuqoridagi regex faqat OBYEKT MAYDONI shaklini (`cancelled_at: `)
   * ko'radi. `rollbackOrderToWaiting` esa belgilashni TOPSHIRIQ shaklida
   * yozadi (`order.cancelled_at = Date.now()`) va aynan shu sababli
   * darvozadan JIM o'tib ketgan edi: terminal nishonga (`cancelled`,
   * `cancelled_sent`) rollback qilish BELGILASH bo'lsa-da, shtraf
   * moduliga ulanmagan edi va kuryer «1-kuni sotildi → 30 kun ushlab
   * turish → cancelled ga rollback» bilan shtrafdan qutulardi.
   *
   * Endi bu shakl ham sanaladi. Yangi joy qo'shilsa test yiqiladi va
   * uni shtrafga ulash kerakmi degan savol ochiq qo'yiladi.
   */
  const EXPECTED_ASSIGN_SITES = 5;

  it('order.sold_at / order.cancelled_at TOPSHIRIQ joylari soni o\'zgarmagan', () => {
    const sites = src.match(/\border\.(sold_at|cancelled_at)\s*=\s*/g) ?? [];
    expect(sites).toHaveLength(EXPECTED_ASSIGN_SITES);
  });

  /**
   * Terminal nishonga rollback — BELGILASH, shuning uchun qayd etilishi
   * SHART. Bu qator olib tashlansa qochish yo'li qayta ochiladi.
   */
  it('terminal nishonga rollback shtrafni QAYD ETADI', () => {
    const body = methodBody(src, 'rollbackOrderToWaiting');
    expect(body).toContain('RollbackTarget.CANCELLED');
    expect(body).toContain('this.courierPenalty.recordForOrder(');
    // Teskari qaytarish ham joyida qolsin (WAITING shoxi).
    expect(body).toContain('this.courierPenalty.reverseForOrder(');
  });

  /**
   * ⚠️ KAFOLAT-SWAP ISTISNOSI. Almashtirilayotgan ESKI buyurtma SOTILGAN
   * holatda qoladi — kuryer uni O'Z VAQTIDA yopgan. Oylar o'tib o'sha
   * sotuv bekor qilinsa, langar hamon dastlabki jo'natish bo'lgani uchun
   * to'liq tarif shtrafi yozilardi. Bayroqni kuryer o'zi qo'ya olmaydi
   * (faqat almashtirish buyurtmasi yaratilganda qo'yiladi), shuning uchun
   * bu qochish yo'li emas.
   */
  it('almashtirilayotgan ESKI buyurtma terminal rollbackda jazolanmaydi', () => {
    const body = methodBody(src, 'rollbackOrderToWaiting');
    expect(body).toContain('!order.is_replacement_return');
  });

  /**
   * Bulk yo'llari MANTIQNI TAKRORLAMASLIGI kerak. Agar kimdir ularni
   * «tezlik uchun» o'z kassa yozuvlariga ko'chirsa, shtraf chetlab
   * o'tilardi — shuning uchun delegatsiya shu yerda qulflangan.
   */
  it('bulk yo\'llari sellOrder/cancelOrder ni chaqiradi', () => {
    expect(methodBody(src, 'bulkSellOrders')).toContain('this.sellOrder(');
    expect(methodBody(src, 'bulkCancelOrders')).toContain('this.cancelOrder(');
  });
});
