import { DECORATORS } from '@nestjs/swagger/dist/constants';
import {
  CarrierCashboxDataDto,
  CarrierCashboxEntryDto,
} from './dto/carrier-public.dto';
import {
  toCarrierCashboxEntry,
  toCarrierCashboxView,
} from './carrier-cashbox-view';

/**
 * Kassa ko'rinishi — tashqi kompaniyaga xodim ma'lumoti (ism, telefon,
 * `created_by`, karta) chiqmasligi va BeePost manba turlari kontraktga
 * to'g'ri moslanishi.
 */

const ORDER_ID = '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90';

const swaggerKeys = (dto: { prototype: object }): string[] =>
  (
    Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES_ARRAY,
      dto.prototype,
    ) as string[]
  )
    .map((key) => key.replace(/^:/, ''))
    .sort();

const row = (over: Record<string, unknown> = {}) => ({
  id: 'h-1',
  operation_type: 'income',
  source_type: 'sell',
  source_id: ORDER_ID,
  amount: 125000,
  balance_after: 125000,
  payment_method: null,
  comment: 'Sotuv',
  created_at: Date.UTC(2026, 10, 9, 12, 30, 0),
  // Ichki maydonlar — chiqmasligi kerak.
  created_by: 'admin-uuid',
  source_user_id: 'market-uuid',
  card_id: 'card-1',
  createdByUser: { name: 'Xodim', phone_number: '+998900000000' },
  sourceUser: { name: 'Market egasi', phone_number: '+998911111111' },
  ...over,
});

describe('toCarrierCashboxEntry', () => {
  it('faqat kontrakt maydonlari — xodim ismi/telefoni, karta chiqmaydi', () => {
    const entry = toCarrierCashboxEntry(row());
    expect(Object.keys(entry).sort()).toEqual(
      swaggerKeys(CarrierCashboxEntryDto),
    );
    const json = JSON.stringify(entry);
    expect(json).not.toContain('Xodim');
    expect(json).not.toContain('+998900000000');
    expect(json).not.toContain('admin-uuid');
    expect(json).not.toContain('card-1');
    expect(entry).toEqual({
      id: 'h-1',
      type: 'income',
      source_type: 'sell',
      amount: 125000,
      balance_after: 125000,
      order_id: ORDER_ID,
      payment_method: null,
      comment: 'Sotuv',
      created_at: '2026-11-09T12:30:00.000Z',
    });
  });

  it('rollback_correction → kontraktdagi `correction`, buyurtma id saqlanadi', () => {
    const entry = toCarrierCashboxEntry(
      row({ source_type: 'rollback_correction', operation_type: 'expense' }),
    );
    expect(entry.source_type).toBe('correction');
    expect(entry.type).toBe('expense');
    expect(entry.order_id).toBe(ORDER_ID);
  });

  it("buyurtmaga bog'liq turlarda order_id; kechikish shtrafida ham", () => {
    for (const type of [
      'sell',
      'extra_cost',
      'correction',
      'courier_penalty',
    ]) {
      expect(toCarrierCashboxEntry(row({ source_type: type })).order_id).toBe(
        ORDER_ID,
      );
    }
  });

  it("topshirilgan naqd va qo'lda yozuvda order_id YO'Q, tur o'zgarmaydi", () => {
    const payment = toCarrierCashboxEntry(
      row({
        source_type: 'courier_payment',
        operation_type: 'expense',
        source_id: ORDER_ID,
        payment_method: 'cash',
      }),
    );
    expect(payment.source_type).toBe('courier_payment');
    expect(payment.order_id).toBeNull();
    expect(payment.payment_method).toBe('cash');

    const manual = toCarrierCashboxEntry(
      row({ source_type: 'manual_income', source_id: null }),
    );
    expect(manual.source_type).toBe('manual_income');
    expect(manual.order_id).toBeNull();
  });

  it("source_id UUID bo'lmasa order_id chiqmaydi", () => {
    expect(
      toCarrierCashboxEntry(row({ source_id: 'not-a-uuid' })).order_id,
    ).toBeNull();
  });

  it('bigint satr qiymatlar songa aylanadi', () => {
    const entry = toCarrierCashboxEntry(
      row({ amount: '5000', balance_after: '-2500', created_at: '0' }),
    );
    expect(entry.amount).toBe(5000);
    expect(entry.balance_after).toBe(-2500);
    expect(entry.created_at).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('toCarrierCashboxView', () => {
  it("balans joriy kassadan; kirim/chiqim — oynadagi qatorlar yig'indisi", () => {
    const view = toCarrierCashboxView({
      balance: 75000,
      history: [
        row({ id: 'h-3', operation_type: 'expense', amount: 100000 }),
        row({ id: 'h-2', operation_type: 'income', amount: 50000 }),
        row({ id: 'h-1', operation_type: 'income', amount: 125000 }),
      ],
    });
    expect(view.balance).toBe(75000);
    expect(view.income).toBe(175000);
    expect(view.outcome).toBe(100000);
    // Tartib o'zgarmaydi (servis yangidan eskiga o'qiydi).
    expect(view.history.map((h) => h.id)).toEqual(['h-3', 'h-2', 'h-1']);
  });

  it("kassa yo'q / tarix bo'sh → nollar", () => {
    expect(toCarrierCashboxView({ balance: null, history: [] })).toEqual({
      balance: 0,
      income: 0,
      outcome: 0,
      history: [],
    });
  });

  it('javob maydonlari Swagger sxemasi bilan bir xil (from/to servisda qo‘shiladi)', () => {
    const keys = [
      'from',
      'to',
      ...Object.keys(toCarrierCashboxView({ balance: 0, history: [] })),
    ].sort();
    expect(keys).toEqual(swaggerKeys(CarrierCashboxDataDto));
  });
});
