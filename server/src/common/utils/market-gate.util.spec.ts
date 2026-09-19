import { Status } from 'src/common/enums';
import { isMarketUsable } from './market-gate.util';

/**
 * ⚠️ NEGA SOF FUNKSIYA ALOHIDA SINALADI.
 *
 * Bu funksiya to'qqizta joyda chaqiriladi (login, refresh, Telegram
 * kirish, buyurtma yaratish, bot oqimi...). Uning xatosi «bloklangan
 * market ishlayveradi» yoki aksincha «faol market to'silib qoladi»
 * degani — ikkalasi ham jimgina sodir bo'ladi. Shu bois qoidaning
 * o'zi manbadan alohida qo'riqlanadi.
 */
const market = (over: Partial<{ status: Status; is_deleted: boolean }> = {}) =>
  ({ status: Status.ACTIVE, is_deleted: false, ...over }) as never;

describe('isMarketUsable', () => {
  it('faol va o\'chirilmagan market — ISHLAYDI', () => {
    expect(isMarketUsable(market())).toBe(true);
  });

  it('bloklangan market — RAD', () => {
    expect(isMarketUsable(market({ status: Status.INACTIVE }))).toBe(false);
  });

  it("yumshoq o'chirilgan market — RAD", () => {
    expect(isMarketUsable(market({ is_deleted: true }))).toBe(false);
  });

  /**
   * ⚠️ ENG MUHIM HOLAT. `users.market` munosabati `onDelete: SET NULL` —
   * market QATTIQ o'chirilsa operatorning `market_id` si NULL bo'ladi va
   * market qatori topilmaydi. «Topilmadi = ruxsat» degan talqin marketni
   * o'chirishni operatorni OZOD QILISHGA aylantirardi.
   */
  it('market topilmadi (null / undefined) — RAD', () => {
    expect(isMarketUsable(null)).toBe(false);
    expect(isMarketUsable(undefined)).toBe(false);
  });

  it("bloklangan VA o'chirilgan — RAD", () => {
    expect(
      isMarketUsable(market({ status: Status.INACTIVE, is_deleted: true })),
    ).toBe(false);
  });
});
