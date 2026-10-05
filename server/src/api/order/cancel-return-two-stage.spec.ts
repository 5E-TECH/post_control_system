/// <reference types="jest" />
import { OrderService } from './order.service';
import { CancelReturnStage, Order_status } from 'src/common/enums';
import { HttpException } from '@nestjs/common';

/**
 * BEKOR QAYTARISH — IKKI BOSQICHLI TASDIQ (skaner yo'li + provayder simmetriyasi).
 *
 * ⚠️ NEGA BU TEST MAJBURIY.
 *
 * 1) `receiveWithScaner` — bekor posilkani POCHTADAN MUSTAQIL yopadigan "orqa
 *    eshik": filtri faqat `qr_code_token` + status + market. Market ruxsati
 *    darvozasi faqat `receiveCanceledPost` ga qo'yilsa, bu yo'l uni butunlay
 *    chetlab o'tadi. Shuning uchun skaner ham ikki bosqichli bo'lishi SHART.
 *
 * 2) Elchi/LDG qaytarishlari `canceled_post_id` NULL bilan keladi (ular
 *    qaytarish-pochtasi oqimida qatnashmaydi) — ya'ni ular YAGONA shu
 *    skaner yo'lidan o'tadi. `markReturnedByElchi` esa ilgari `CANCELLED` da
 *    TO'XTAB qolardi va skaner filtri (NEW | CANCELLED_SENT) ularni
 *    KO'RMASDI: Elchi qaytargan posilkalar oylab qotib qolardi.
 */

const now = () => Date.now();

function buildScanerSvc(order: Record<string, any> | null) {
  const svc: any = Object.create(OrderService.prototype);
  const updated: { criteria: any; partial: any }[] = [];

  const manager = {
    findOne: jest.fn().mockResolvedValue(order),
    update: jest.fn((_Entity: any, criteria: any, partial: any) => {
      updated.push({ criteria, partial });
      return Promise.resolve({ affected: 1 });
    }),
    save: jest.fn((e: any) => Promise.resolve(e)),
  };
  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
  svc.dataSource = { createQueryRunner: jest.fn(() => qr) };
  svc.activityLog = { log: jest.fn() };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.orderBotService = { syncStatusButton: jest.fn() };
  return { svc, qr, manager, updated };
}

describe('receiveWithScaner — bekor posilka IKKI BOSQICHDA', () => {
  const user = { id: 'staff-1', role: 'registrator' } as any;
  const marketId = 'market-1';

  it('1-BOSQICH: markazga qabul qilinadi, CLOSED BO‘LMAYDI', async () => {
    const { svc, qr, updated } = buildScanerSvc({
      id: 'o-1',
      order_number: 777,
      status: Order_status.CANCELLED_SENT,
      center_received_at: null,
      total_price: 50000,
    });

    const res: any = await svc.receiveWithScaner(
      'token-1',
      { marketId } as any,
      user,
    );

    expect(updated).toHaveLength(1);
    // Dalil yoziladi, STATUS tegilmaydi.
    expect(updated[0].partial.center_received_at).toBeGreaterThan(0);
    expect(updated[0].partial.center_received_by).toBe('staff-1');
    expect(updated[0].partial.status).toBeUndefined();
    // Poyga guardi: faqat hamon qaytish yo'lidagi qatorga yoziladi.
    expect(updated[0].criteria.status).toBe(Order_status.CANCELLED_SENT);
    expect(res.data.return_stage).toBe(CancelReturnStage.AT_CENTER);
    expect(qr.commitTransaction).toHaveBeenCalled();
  });

  it('2-BOSQICH skanerda BAJARILMAYDI — market ruxsatiga yo‘naltiradi', async () => {
    const { svc, updated } = buildScanerSvc({
      id: 'o-1',
      order_number: 777,
      status: Order_status.CANCELLED_SENT,
      center_received_at: now() - 3600_000,
      total_price: 50000,
    });

    // ⚠️ `receiveWithScaner` xatolarni `catchError` orqali qaytaradi, ya'ni
    // tashqariga `HttpException` (400) chiqadi — xabar esa xodimni market
    // ruxsati oynasiga yo'naltiradi.
    await expect(
      svc.receiveWithScaner('token-1', { marketId } as any, user),
    ).rejects.toThrow(HttpException);
    await expect(
      svc.receiveWithScaner('token-1', { marketId } as any, user),
    ).rejects.toThrow(/market ruxsatini/i);

    // Hech narsa yozilmadi — bir urishda yopish yo'li YO'Q.
    expect(updated).toHaveLength(0);
  });

  it('qator QULFLANADI (ikki registrator poygasi)', async () => {
    const { svc, manager } = buildScanerSvc({
      id: 'o-1',
      order_number: 777,
      status: Order_status.CANCELLED_SENT,
      center_received_at: null,
      total_price: 1,
    });

    await svc.receiveWithScaner('token-1', { marketId } as any, user);

    expect(manager.findOne.mock.calls[0][1]).toEqual(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('market_id majburiy', async () => {
    const { svc } = buildScanerSvc(null);
    await expect(
      svc.receiveWithScaner('token-1', {} as any, user),
    ).rejects.toThrow(/Market id is required/);
  });
});

/**
 * ELCHI ↔ LDG SIMMETRIYASI (memory: pcs-elchi-ldg-simmetriya).
 *
 * LDG `RETURNED` → `CANCELLED_SENT` yozadi. Elchi `returned` ilgari faqat
 * `cancelOrder` chaqirib `CANCELLED` da to'xtardi — holbuki
 * `elchi-status.mapper.ts` uni `CANCELLED_SENT` deb da'vo qiladi.
 */
function buildReturnedSvc(status: Order_status, affected = 1) {
  const svc: any = Object.create(OrderService.prototype);
  const updates: { criteria: any; partial: any }[] = [];
  svc.orderRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 'o-1', order_number: 42, status }),
    update: jest.fn((criteria: any, partial: any) => {
      updates.push({ criteria, partial });
      return Promise.resolve({ affected });
    }),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.cancelOrder = jest.fn().mockResolvedValue(undefined);
  svc.activityLog = { log: jest.fn() };
  svc.logElchiMismatch = jest.fn();
  svc.logLdgMismatch = jest.fn();
  svc.elchiActor = jest.fn(() => ({ id: 'elchi-courier', role: 'courier' }));
  return { svc, updates };
}

describe('markReturnedByElchi — LDG bilan simmetriya', () => {
  it('cancelOrder dan KEYIN CANCELLED_SENT yozadi', async () => {
    const { svc, updates } = buildReturnedSvc(Order_status.WAITING);

    const res = await svc.markReturnedByElchi('o-1', 'elchi-courier');

    expect(svc.cancelOrder).toHaveBeenCalled();
    const promote = updates.find(
      (u) => u.partial?.status === Order_status.CANCELLED_SENT,
    );
    expect(promote).toBeTruthy();
    expect(res).toEqual({ kind: 'applied' });
  });

  it('atomik UPDATE faqat CANCELLED va markazga qabul qilinmagan qatorga tegadi', async () => {
    const { svc, updates } = buildReturnedSvc(Order_status.WAITING);
    await svc.markReturnedByElchi('o-1', 'elchi-courier');

    const promote = updates.find(
      (u) => u.partial?.status === Order_status.CANCELLED_SENT,
    );
    // Kechikkan/takroriy webhook markazdagi posilkani ORQAGA qaytarmasin.
    expect(promote?.criteria).toEqual(
      expect.objectContaining({
        id: 'o-1',
        center_received_at: expect.anything(),
      }),
    );
  });

  it('poyga: 0 qator ta’sirlansa skipped qaytaradi', async () => {
    const { svc } = buildReturnedSvc(Order_status.WAITING, 0);
    const res: any = await svc.markReturnedByElchi('o-1', 'elchi-courier');
    expect(res.kind).toBe('skipped');
  });

  it('allaqachon CANCELLED_SENT bo‘lsa tegilmaydi (idempotent)', async () => {
    const { svc } = buildReturnedSvc(Order_status.CANCELLED_SENT);
    const res: any = await svc.markReturnedByElchi('o-1', 'elchi-courier');
    expect(res.kind).toBe('skipped');
    expect(svc.cancelOrder).not.toHaveBeenCalled();
  });

  it('SOTILGAN bo‘lsa mismatch — pul kassada, qo‘lda tekshiriladi', async () => {
    const { svc } = buildReturnedSvc(Order_status.SOLD);
    const res: any = await svc.markReturnedByElchi('o-1', 'elchi-courier');
    expect(res.kind).toBe('mismatch');
  });
});

describe('markReturnedByLdg — markazdagi posilka orqaga qaytmaydi', () => {
  it('atomik UPDATE shartida center_received_at ham bor', async () => {
    const { svc, updates } = buildReturnedSvc(Order_status.CANCELLED);
    await svc.markReturnedByLdg('o-1', 'ldg-courier');

    const promote = updates.find(
      (u) => u.partial?.status === Order_status.CANCELLED_SENT,
    );
    expect(promote?.criteria).toEqual(
      expect.objectContaining({ center_received_at: expect.anything() }),
    );
  });
});
