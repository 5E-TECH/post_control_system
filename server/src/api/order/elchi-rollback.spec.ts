/// <reference types="jest" />
import { OrderService } from './order.service';
import { Order_status } from 'src/common/enums';

/**
 * ELCHI ROLLBACK — ENG XAVFLI SHOX (qabul mezoni №5).
 *
 * ⚠️ NEGA BU TEST MAJBURIY. `waiting` statusi IKKI XIL ma'noda keladi:
 *
 *   OLDINGA — kuryer pochtani qabul qildi, sotuv kutilmoqda (kunda o'nlab
 *             marta yuz beradi, mutlaqo normal);
 *   ORQAGA  — Elchi sotilgan buyurtmani qaytardi (kamdan-kam).
 *
 * Statusning o'zi ikkisini AJRATMAYDI. Agar ajratish ishlamasa, har bir
 * "kuryer pochtani qabul qildi" hodisasi ROLLBACK ni ishga tushirardi:
 * sotilmagan buyurtma qaytarilishga urinilardi, kassa harakatlari teskari
 * yozilardi. Bu integratsiyadagi eng qimmat xato bo'lardi va hech qanday
 * ogohlantirish bermasdi.
 *
 * Shu bois ajratish `markRolledBackByElchi` ichida: FAQAT bizda sotilgan
 * bo'lsa qaytariladi.
 */
function buildSvc(status: Order_status | null, rollbackImpl?: jest.Mock) {
  const svc: any = Object.create(OrderService.prototype);
  svc.orderRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        status === null ? null : { id: 'o-1', order_number: 42, status },
      ),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.activityLog = { log: jest.fn() };
  svc.rollbackOrderToWaiting =
    rollbackImpl ?? jest.fn().mockResolvedValue(undefined);
  return svc;
}

describe('OrderService — markRolledBackByElchi', () => {
  describe('⭐ OLDINGA OQIM — hech narsa qilinmaydi', () => {
    /**
     * Bu holatlarning HAMMASIDA `waiting` webhooki normal oqim. Rollback
     * chaqirilsa tizim buzilardi.
     */
    const forward: Order_status[] = [
      Order_status.NEW,
      Order_status.RECEIVED,
      Order_status.ON_THE_ROAD,
      Order_status.WAITING,
      Order_status.CANCELLED,
      Order_status.CLOSED,
    ];

    it.each(forward)('%s -> skipped, qaytarish CHAQIRILMAYDI', async (st) => {
      const rollback = jest.fn();
      const svc = buildSvc(st, rollback);

      const res = await svc.markRolledBackByElchi('o-1', 'courier-1');

      expect(res.kind).toBe('skipped');
      expect(rollback).not.toHaveBeenCalled();
    });
  });

  describe('SOTILGAN — qaytarish bajariladi', () => {
    const sold: Order_status[] = [
      Order_status.SOLD,
      Order_status.PAID,
      Order_status.PARTLY_PAID,
    ];

    it.each(sold)('%s -> applied va qaytarish chaqiriladi', async (st) => {
      const rollback = jest.fn().mockResolvedValue(undefined);
      const svc = buildSvc(st, rollback);

      const res = await svc.markRolledBackByElchi('o-1', 'courier-1');

      expect(res.kind).toBe('applied');
      expect(rollback).toHaveBeenCalledTimes(1);
    });

    it('⭐ nazorat guardi CHETLAB O`TILADI (busiz qaytarish bloklanardi)', async () => {
      /**
       * `assertControlAllowed` tashqi tizim nazoratidagi buyurtmani
       * qaytarishni to'sadi. Lekin bu yerda buyruq o'sha tashqi tizimning
       * O'ZIDAN keladi, shu bois `bypassControlGuard` shart.
       */
      const rollback = jest.fn().mockResolvedValue(undefined);
      const svc = buildSvc(Order_status.SOLD, rollback);

      await svc.markRolledBackByElchi('o-1', 'courier-1');

      const options = rollback.mock.calls[0]?.[3];
      expect(options).toEqual({ bypassControlGuard: true });
    });

    it('tizim nomidan bajariladi — SUPERADMIN roli', async () => {
      /**
       * Kuryer roli bo'lsa egalik va status tekshiruvlari noto'g'ri
       * ishlardi (bu odam emas, tizim amali).
       */
      const rollback = jest.fn().mockResolvedValue(undefined);
      const svc = buildSvc(Order_status.SOLD, rollback);

      await svc.markRolledBackByElchi('o-1', 'courier-1');

      const user = rollback.mock.calls[0]?.[0];
      expect(String(user?.role).toLowerCase()).toContain('admin');
    });
  });

  it('⭐ qaytarish YIQILSA nomuvofiqlik qaytariladi, xato YUTILMAYDI', async () => {
    /**
     * Jim `catch` eng yomon variant bo'lardi: pul kassada, Elchi'da esa
     * WAITING, va farq hech qayerda ko'rinmasdi. Nomuvofiqlik admin
     * panelidagi filtrga tushadi.
     */
    const rollback = jest.fn().mockRejectedValue(new Error('kassa yopiq'));
    const svc = buildSvc(Order_status.SOLD, rollback);

    const res = await svc.markRolledBackByElchi('o-1', 'courier-1');

    expect(res.kind).toBe('mismatch');
    expect(res.reason).toMatch(/kassa yopiq/);
    expect(svc.activityLog.log).toHaveBeenCalled();
  });

  it('buyurtma topilmasa skipped — yiqilmaydi', async () => {
    const svc = buildSvc(null);
    const res = await svc.markRolledBackByElchi('yoq', 'courier-1');
    expect(res).toEqual({ kind: 'skipped', reason: 'order_not_found' });
  });
});
