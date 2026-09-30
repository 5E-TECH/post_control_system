/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ElchiWebhookService } from './elchi-webhook.service';

/**
 * `settlement.payment` webhooki — Elchi bizga to'lagan pulni AVTOMATIK
 * `elchi_settlement_payment` daftariga yozadi (ilgari faqat qo'lda edi).
 *
 * MUHIM: daftar kassa EMAS — faqat "Elchi qancha to'ladi" solishtirish yozuvi.
 * Idempotentlik `external_payment_id` NOYOB indeksiga tayanadi.
 */
function buildSvc(saveImpl?: jest.Mock) {
  const svc: any = Object.create(ElchiWebhookService.prototype);
  const save = saveImpl ?? jest.fn((x: any) => ({ id: 'sp-1', ...x }));
  svc.settlementRepo = {
    create: jest.fn((x: any) => x),
    save,
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  // Webhook servisdagi haqiqiy yordamchi bilan bir xil xulq.
  svc.isUniqueViolation = (e: any) =>
    e?.code === '23505' || /duplicate key/i.test(String(e?.message ?? ''));
  return svc;
}

describe('ElchiWebhookService — recordSettlementPayment (settlement.payment)', () => {
  it('to`g`ri to`lov -> daftarga yoziladi (success) va external_payment_id saqlanadi', async () => {
    const svc = buildSvc();
    const res = await svc.recordSettlementPayment({
      event: 'settlement.payment',
      amount: 1100000,
      paid_at: 1750000000000,
      payment_id: 'mk121:epoch-abc',
    });
    expect(res.status).toBe('success');
    const saved = svc.settlementRepo.save.mock.calls[0][0];
    expect(saved.amount).toBe('1100000.00');
    expect(saved.paid_at).toBe(1750000000000);
    expect(saved.external_payment_id).toBe('mk121:epoch-abc');
  });

  it('TAKROR (external_payment_id unique buzildi) -> success, YIQILMAYDI', async () => {
    const dup = jest.fn(async () => {
      const e: any = new Error(
        'duplicate key value violates unique constraint',
      );
      e.code = '23505';
      throw e;
    });
    const svc = buildSvc(dup);
    const res = await svc.recordSettlementPayment({
      event: 'settlement.payment',
      amount: 650000,
      paid_at: 1750000000000,
      payment_id: 'mk121:epoch-abc',
    });
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/[Tt]akror/);
  });

  it('summa <= 0 -> failed, daftarga TEGILMAYDI', async () => {
    const svc = buildSvc();
    const res = await svc.recordSettlementPayment({
      event: 'settlement.payment',
      amount: 0,
      payment_id: 'x',
    });
    expect(res.status).toBe('failed');
    expect(svc.settlementRepo.save).not.toHaveBeenCalled();
  });

  it('kelajak sana -> failed (qarzni yolg`on kamaytirmasin)', async () => {
    const svc = buildSvc();
    const res = await svc.recordSettlementPayment({
      event: 'settlement.payment',
      amount: 1000,
      paid_at: Date.now() + 10 * 60_000,
      payment_id: 'x',
    });
    expect(res.status).toBe('failed');
    expect(svc.settlementRepo.save).not.toHaveBeenCalled();
  });

  it('boshqa xato (unique emas) -> qayta tashlanadi (500 -> outbox retry)', async () => {
    const boom = jest.fn(async () => {
      throw new Error('db down');
    });
    const svc = buildSvc(boom);
    await expect(
      svc.recordSettlementPayment({
        event: 'settlement.payment',
        amount: 1000,
        paid_at: 1750000000000,
        payment_id: 'x',
      }),
    ).rejects.toThrow(/db down/);
  });
});
