/// <reference types="jest" />
import { OrderService } from './order.service';
import { Order_status } from 'src/common/enums';

/**
 * ELCHI TERMINAL STATUS — `new`/`created`dan kelgan buyurtma ham qo'llanadi.
 *
 * ⚠️ NEGA BU TEST MAJBURIY. Sotuv/bekor/qaytarish oqimlari `WAITING` statusni
 * talab qiladi (`sellOrder`/`cancelOrder` ichidagi filtr). Elchi terminal
 * webhooki (`sold`/`cancelled`/`returned`) kelganda buyurtma bizda oraliq
 * statusda bo'lishi mumkin, chunki oraliq webhooklar yo'qolgan yoki buyurtma
 * to'g'ridan-to'g'ri `new`dan dispatch qilingan (dispatch-retry yo'li) bo'lishi
 * mumkin. Ilgari transition FAQAT `ON_THE_ROAD`/`RECEIVED`ni `WAITING`ga
 * o'tkazardi — `new`/`created` esa qolib ketardi va terminal amal
 * "Order not found or not in waiting status" bilan ABADIY yiqilardi
 * (yetkazilgan posilka = pul, lekin PCS'da hech qachon sotilmasdi).
 *
 * Tuzatish: transition to'plamiga `CREATED` va `NEW` qo'shildi. Buyurtma
 * control_owner='elchi' bo'lgani uchun (bu metodlar faqat shunda chaqiriladi)
 * `new`->`WAITING` xavfsiz — tashqi tizim (Elchi) yakuniy hisoblanadi.
 */
function buildDeliveredSvc(status: Order_status) {
  const svc: any = Object.create(OrderService.prototype);
  svc.orderRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'o-1', order_number: 42, status }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.acceptElchiPriceChange = jest.fn().mockResolvedValue('');
  svc.sellOrder = jest.fn().mockResolvedValue(undefined);
  svc.logElchiMismatch = jest.fn();
  return svc;
}

function buildCancelledSvc(status: Order_status) {
  const svc: any = Object.create(OrderService.prototype);
  svc.orderRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'o-1', order_number: 42, status }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.cancelOrder = jest.fn().mockResolvedValue(undefined);
  svc.logElchiMismatch = jest.fn();
  return svc;
}

describe('OrderService — Elchi terminal: oraliq statusni WAITINGga normallashtirish', () => {
  /**
   * Bu statuslarning hammasi terminal EMAS va WAITING emas — demak sotishdan
   * OLDIN WAITINGga o'tkazilishi SHART. `new`/`created` — regressiya himoyasi.
   */
  const preWaiting: Order_status[] = [
    Order_status.CREATED,
    Order_status.NEW,
    Order_status.RECEIVED,
    Order_status.ON_THE_ROAD,
  ];

  describe('markDeliveredByElchi — sotuvdan oldin WAITINGga o`tadi', () => {
    it.each(preWaiting)(
      '%s -> WAITINGga o`tkaziladi va sotuv chaqiriladi (applied)',
      async (st) => {
        const svc = buildDeliveredSvc(st);

        const res = await svc.markDeliveredByElchi('o-1', 'courier-1', 100000);

        expect(svc.orderRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'o-1' }),
          { status: Order_status.WAITING },
        );
        expect(svc.sellOrder).toHaveBeenCalledTimes(1);
        expect(res.kind).toBe('applied');
      },
    );

    it('SOTILGAN (SOLD) -> skipped, WAITINGga TEGILMAYDI', async () => {
      const svc = buildDeliveredSvc(Order_status.SOLD);
      const res = await svc.markDeliveredByElchi('o-1', 'courier-1');
      expect(res.kind).toBe('skipped');
      expect(svc.orderRepo.update).not.toHaveBeenCalled();
      expect(svc.sellOrder).not.toHaveBeenCalled();
    });
  });

  describe('markCancelledByElchi — bekordan oldin WAITINGga o`tadi', () => {
    it.each(preWaiting)(
      '%s -> WAITINGga o`tkaziladi va bekor qilish chaqiriladi (applied)',
      async (st) => {
        const svc = buildCancelledSvc(st);

        const res = await svc.markCancelledByElchi('o-1', 'courier-1');

        expect(svc.orderRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'o-1' }),
          { status: Order_status.WAITING },
        );
        expect(svc.cancelOrder).toHaveBeenCalledTimes(1);
        expect(res.kind).toBe('applied');
      },
    );

    it('allaqachon CANCELLED -> skipped, tegilmaydi', async () => {
      const svc = buildCancelledSvc(Order_status.CANCELLED);
      const res = await svc.markCancelledByElchi('o-1', 'courier-1');
      expect(res.kind).toBe('skipped');
      expect(svc.orderRepo.update).not.toHaveBeenCalled();
      expect(svc.cancelOrder).not.toHaveBeenCalled();
    });
  });
});

/**
 * EGALIK GUARDI — Elchi vakil-kuryer istisnosi (LDG bilan simmetrik).
 *
 * `assertCourierOwnsOrder` faqat buyurtma postiga biriktirilgan kuryerga
 * sotuv/bekorga ruxsat beradi. Elchi buyurtmasi `new`dan dispatch qilinsa
 * (yoki oraliq webhook yo'qolsa) order POSTSIZ bo'ladi — post-egalik
 * tekshiruvidan o'tmaydi. LDG bunda `external_provider='ldg'` bo'yicha
 * o'tkazib yuboriladi; Elchi ham AYNAN shunday `'elchi'` bo'yicha o'tishi
 * kerak, aks holda yetkazilgan posilka (=pul) sotilmay qolardi.
 */
function ownMgr(post: any, actor: any) {
  return {
    findOne: jest.fn((Entity: any) => {
      const n = Entity?.name || '';
      if (n.includes('Post')) return Promise.resolve(post);
      if (n.includes('User')) return Promise.resolve(actor);
      return Promise.resolve(null);
    }),
  };
}

describe('OrderService — assertCourierOwnsOrder: Elchi vakil-kuryer istisnosi', () => {
  const svc: any = Object.create(OrderService.prototype);

  it('postsiz order + Elchi vakil-kuryer -> RUXSAT (throw YO`Q)', async () => {
    const m = ownMgr(null, { id: 'c', external_provider: 'elchi' });
    await expect(
      svc.assertCourierOwnsOrder(m, { post_id: null }, { id: 'c' }),
    ).resolves.toBeUndefined();
  });

  it('postsiz order + oddiy kuryer -> RAD (throw)', async () => {
    const m = ownMgr(null, { id: 'c', external_provider: null });
    await expect(
      svc.assertCourierOwnsOrder(m, { post_id: null }, { id: 'c' }),
    ).rejects.toThrow(/tegishli emas/);
  });

  it('LDG vakil-kuryer -> RUXSAT (regressiya himoyasi)', async () => {
    const m = ownMgr(null, { id: 'c', external_provider: 'ldg' });
    await expect(
      svc.assertCourierOwnsOrder(m, { post_id: null }, { id: 'c' }),
    ).resolves.toBeUndefined();
  });

  it('post aynan kuryerga biriktirilgan -> RUXSAT (external_provider shart emas)', async () => {
    const m = ownMgr({ id: 'p', courier_id: 'c' }, { id: 'c', external_provider: null });
    await expect(
      svc.assertCourierOwnsOrder(m, { post_id: 'p' }, { id: 'c' }),
    ).resolves.toBeUndefined();
  });
});
