import {
  awaitingMarketSql,
  awaitingMarketWhere,
  cancelReturnStage,
  withCourierWhere,
} from './cancel-return.util';
import { CancelReturnStage, Order_status } from 'src/common/enums';

/**
 * Ikki ma'noli `cancelled (sent)` statusining YAGONA talqini shu faylda
 * qulflanadi. Agar kimdir predikatni boshqa joyda qayta yozsa yoki bu
 * yerdagi ma'noni o'zgartirsa — navbat, hisobot va cron jimgina
 * bir-biridan ayrilib ketadi.
 */
describe('cancel-return bosqichi (yagona predikat)', () => {
  it('kuryerda: CANCELLED_SENT, markaz hali qabul qilmagan', () => {
    expect(
      cancelReturnStage({
        status: Order_status.CANCELLED_SENT,
        center_received_at: null,
        market_handover_at: null,
      }),
    ).toBe(CancelReturnStage.WITH_COURIER);
  });

  it('markazda: center_received_at bor, marketga topshirilmagan', () => {
    expect(
      cancelReturnStage({
        status: Order_status.CANCELLED_SENT,
        center_received_at: 1_760_000_000_000,
        market_handover_at: null,
      }),
    ).toBe(CancelReturnStage.AT_CENTER);
  });

  it('marketda: market_handover_at bor', () => {
    expect(
      cancelReturnStage({
        status: Order_status.CLOSED,
        center_received_at: 1_760_000_000_000,
        market_handover_at: 1_760_000_100_000,
      }),
    ).toBe(CancelReturnStage.WITH_MARKET);
  });

  it('LEGACY: dalilsiz CLOSED ham "marketda" deb ko\'rsatiladi (soxta "markazda" EMAS)', () => {
    // Oqim joriy etilishidan oldin yopilgan qatorlar: mol qayerda ekani
    // bizga ma'lum emas. Ularni "markazda" deb navbatga chiqarish —
    // yolg'on dalil bo'lardi.
    expect(
      cancelReturnStage({
        status: Order_status.CLOSED,
        center_received_at: null,
        market_handover_at: null,
      }),
    ).toBe(CancelReturnStage.WITH_MARKET);
  });

  it('zanjirda emas: bekor qilingan, lekin pochtaga topshirilmagan', () => {
    expect(
      cancelReturnStage({
        status: Order_status.CANCELLED,
        center_received_at: null,
        market_handover_at: null,
      }),
    ).toBeNull();
  });

  it('zanjirda emas: sotilgan buyurtma', () => {
    expect(cancelReturnStage({ status: Order_status.SOLD })).toBeNull();
  });

  it("ALMASHTIRISH qatori: status SOTILGAN qoladi, lekin dalil bo'yicha markazda", () => {
    // Kafolat-swap da eski buyurtma SOTILGAN qoladi (puli muzlatilgan).
    // Zanjir holatini faqat dalil ustunlari aytadi.
    expect(
      cancelReturnStage({
        status: Order_status.SOLD,
        center_received_at: 1_760_000_000_000,
        market_handover_at: null,
      }),
    ).toBe(CancelReturnStage.AT_CENTER);
  });

  it('ALMASHTIRISH qatori topshirilgach "marketda" bo\'ladi (status hamon SOTILGAN)', () => {
    expect(
      cancelReturnStage({
        status: Order_status.SOLD,
        center_received_at: 1,
        market_handover_at: 2,
      }),
    ).toBe(CancelReturnStage.WITH_MARKET);
  });

  it("bo'sh qiymatlarda yiqilmaydi", () => {
    expect(cancelReturnStage(null)).toBeNull();
    expect(cancelReturnStage(undefined)).toBeNull();
    expect(cancelReturnStage({})).toBeNull();
  });

  it("bigint SATR kelsa ham to'g'ri ishlaydi (transformer ulanmagan holat)", () => {
    // `pg` bigint'ni satr qaytaradi. `!= null` solishtiruvi satr uchun ham
    // to'g'ri — ya'ni bu predikat raqam/satr farqiga BOG'LIQ EMAS.
    expect(
      cancelReturnStage({
        status: Order_status.CANCELLED_SENT,
        center_received_at: '1760000000000',
        market_handover_at: null,
      }),
    ).toBe(CancelReturnStage.AT_CENTER);
  });

  it("market_handover_at status CLOSED bo'lmasa ham ustun turadi", () => {
    // Himoya: agar qandaydir yo'l statusni orqaga qaytarib dalilni
    // tozalamasa, buyurtma navbatga QAYTIB chiqmasligi kerak.
    expect(
      cancelReturnStage({
        status: Order_status.CANCELLED_SENT,
        center_received_at: 1,
        market_handover_at: 2,
      }),
    ).toBe(CancelReturnStage.WITH_MARKET);
  });
});

describe('cancel-return predikat shakllari', () => {
  it('awaitingMarketWhere har chaqiruvda YANGI obyekt qaytaradi', () => {
    const a = awaitingMarketWhere();
    const b = awaitingMarketWhere();
    expect(a).not.toBe(b);
  });

  it("awaitingMarketWhere STATUS shartini QO'SHMAYDI", () => {
    // Almashtirish qatorlari zanjirdan o'tadi-yu statusi SOTILGAN qoladi —
    // status sharti ularni navbatdan tushirib yuborardi.
    expect(awaitingMarketWhere()).not.toHaveProperty('status');
    expect(Object.keys(awaitingMarketWhere()).sort()).toEqual([
      'center_received_at',
      'market_handover_at',
    ]);
  });

  it('withCourierWhere markazga qabul qilinmaganlarni tanlaydi', () => {
    expect(withCourierWhere().status).toBe(Order_status.CANCELLED_SENT);
  });

  it('awaitingMarketSql ikki dalil ustunini tekshiradi, statusni emas', () => {
    const sql = awaitingMarketSql('o');
    expect(sql).toContain('o.center_received_at IS NOT NULL');
    expect(sql).toContain('o.market_handover_at IS NULL');
    expect(sql).not.toContain('status');
    // QueryBuilder soft-delete'ni o'zi qo'shadi — default'da yo'q.
    expect(sql).not.toContain('deleted_at');
  });

  it("xom SQL uchun soft-delete guardi qo'shiladi", () => {
    expect(awaitingMarketSql('o', true)).toContain('o.deleted_at IS NULL');
  });

  it("parametrsiz — boshqa so'rovdagi :status bilan urishish xavfi yo'q", () => {
    expect(awaitingMarketSql('o')).not.toContain(':');
  });
});
