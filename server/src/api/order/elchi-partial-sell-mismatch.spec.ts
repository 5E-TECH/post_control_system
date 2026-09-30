/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { OrderService } from './order.service';
import { Order_status } from 'src/common/enums';

/**
 * QISMAN SOTUV — NARX PASAYISHI NOMUVOFIQLIK DEB BELGILANADI (vaqtinchalik chora).
 *
 * Elchi qisman sotuvda asl buyurtma narxini kamaytiradi va qolgan mol uchun
 * ALOHIDA bola buyurtma ochadi — PCS bola haqida bilmaydi. Ilgari narx
 * pasayishi JIMGINA qabul qilinardi (faqat izoh). Endi sotuv baribir o'tadi,
 * LEKIN `kind:'mismatch'` qaytariladi -> chaqiruvchi shipment.mismatch_at
 * qo'yadi -> admin "Nomuvofiqlik" filtrida ko'rinadi.
 */
function buildSvc(totalPrice: number) {
  const svc: any = Object.create(OrderService.prototype);
  svc.orderRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'o-1',
      order_number: 42,
      status: Order_status.WAITING,
      total_price: totalPrice,
    }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  // acceptElchiPriceChange o'z DB ishini qiladi — bu yerda qaror mantig'ini
  // sinaymiz, shuning uchun mock.
  svc.acceptElchiPriceChange = jest.fn().mockResolvedValue('');
  svc.sellOrder = jest.fn().mockResolvedValue(undefined);
  svc.logElchiMismatch = jest.fn();
  return svc;
}

describe('OrderService — Elchi qisman sotuv: narx pasayishi = mismatch', () => {
  it('narx PASAYDI (180000 -> 90000) -> sotiladi, LEKIN kind=mismatch', async () => {
    const svc = buildSvc(180000);
    const res = await svc.markDeliveredByElchi('o-1', 'courier-1', 90000, {
      totalPrice: 90000,
    });
    expect(svc.sellOrder).toHaveBeenCalledTimes(1); // sotuv baribir o'tadi
    expect(res.kind).toBe('mismatch');
    expect(res.reason).toMatch(/pasaytirdi/);
    expect(res.reason).toMatch(/kuzatilmagan/);
  });

  it('narx o`zgarmadi (180000 -> 180000) -> applied', async () => {
    const svc = buildSvc(180000);
    const res = await svc.markDeliveredByElchi('o-1', 'courier-1', 180000, {
      totalPrice: 180000,
    });
    expect(res.kind).toBe('applied');
  });

  it('narx KO`TARILDI (180000 -> 200000) -> applied (pasayish emas)', async () => {
    const svc = buildSvc(180000);
    const res = await svc.markDeliveredByElchi('o-1', 'courier-1', 200000, {
      totalPrice: 200000,
    });
    expect(res.kind).toBe('applied');
  });

  it('remote narx berilmagan -> applied (pasayish aniqlanmaydi)', async () => {
    const svc = buildSvc(180000);
    const res = await svc.markDeliveredByElchi('o-1', 'courier-1', 180000);
    expect(res.kind).toBe('applied');
  });
});
