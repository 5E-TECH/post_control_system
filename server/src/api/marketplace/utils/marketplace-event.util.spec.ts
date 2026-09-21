import {
  buildEventEnvelope,
  computeNetToMarketplace,
  nextRetryDelayMs,
} from './marketplace-event.util';
import { MarketplaceEventType } from '../marketplace.enums';

const base = () => ({
  event_id: 'e-1',
  seq: 5,
  event_type: MarketplaceEventType.PARCEL_DELIVERED,
  occurred_at: 1_789_500_000_000,
  integration_slug: 'uzum',
  parcel: {
    external_parcel_id: 'PCL-1',
    external_order_id: 'ORD-1',
    seller_id: 'SLR-77',
  },
});

describe('buildEventEnvelope', () => {
  it('kontraktdagi shaklni quradi', () => {
    const e = buildEventEnvelope(base());
    expect(e).toMatchObject({
      event_id: 'e-1', seq: 5,
      event_type: 'parcel.delivered',
      integration: 'uzum',
      parcel: { external_parcel_id: 'PCL-1', seller_id: 'SLR-77' },
    });
    // `sent_at` ATAYLAB yo'q — uni worker yuborish paytida qo'yadi.
    expect(e).not.toHaveProperty('sent_at');
  });

  it("bo'sh maydonlarni TASHLAYDI", () => {
    const e = buildEventEnvelope({ ...base(), parcel: { ...base().parcel, seller_id: null } });
    expect(e.parcel).not.toHaveProperty('seller_id');
    expect(e).not.toHaveProperty('money');
    expect(e).not.toHaveProperty('status');
  });

  it('pul blokini qo\'shadi, MANFIY net ham o\'tadi', () => {
    const e = buildEventEnvelope({
      ...base(),
      money: {
        currency: 'UZS', collected_from_customer: 0, beepost_fee: 50000,
        prepaid: true, net_to_marketplace: -50000,
      },
    });
    // ⚠️ Manfiy summa `prune` tomonidan TASHLANMASLIGI shart — prepaid
    // posilkada butun ma'no shunda.
    expect((e.money as any).net_to_marketplace).toBe(-50000);
    expect((e.money as any).prepaid).toBe(true);
  });

  it('0 qiymatni ham saqlaydi (faqat null/undefined tashlanadi)', () => {
    const e = buildEventEnvelope({
      ...base(),
      money: { currency: 'UZS', extra_cost: 0, collected_from_customer: 0 },
    });
    expect((e.money as any).extra_cost).toBe(0);
    expect((e.money as any).collected_from_customer).toBe(0);
  });
});

describe('computeNetToMarketplace', () => {
  it('kontrakt formulasini bajaradi', () => {
    expect(computeNetToMarketplace({
      collected_from_customer: 200000, beepost_fee: 50000, extra_cost: 5000,
    })).toBe(145000);
  });

  it('PREPAID da MANFIY qaytaradi (nolga qirqmaydi)', () => {
    // ⚠️ `Math.max(0, ...)` qo'yilsa prepaid yo'li jimgina buzilardi:
    // marketplace bizga qarzdor bo'lishi kerak, 0 emas.
    expect(computeNetToMarketplace({
      collected_from_customer: 0, beepost_fee: 50000,
    })).toBe(-50000);
    expect(computeNetToMarketplace({
      collected_from_customer: 30000, beepost_fee: 50000,
    })).toBe(-20000);
  });

  it('bekorda faqat ortiqcha xarajat yechiladi', () => {
    // Qaror P4: bekorda yetkazish haqqi OLINMAYDI.
    expect(computeNetToMarketplace({
      collected_from_customer: 0, beepost_fee: 0, extra_cost: 5000,
    })).toBe(-5000);
  });
});

describe('nextRetryDelayMs', () => {
  it('8 urinishda ~4 soatgacha cho\'ziladi', () => {
    // ⚠️ Mavjud navbat 3 urinish × (1m/5m/15m) = ~6 daqiqa. Marketplace
    // deployi shundan uzoq bo'lsa BUTUN OYNA yo'qolardi.
    expect(nextRetryDelayMs(1)).toBe(60_000);
    expect(nextRetryDelayMs(4)).toBe(30 * 60_000);
    expect(nextRetryDelayMs(7)).toBe(4 * 60 * 60_000);
    const total = [1, 2, 3, 4, 5, 6, 7].reduce((a, i) => a + nextRetryDelayMs(i), 0);
    expect(total).toBeGreaterThan(7 * 60 * 60_000 / 2); // ~7.75 soat
  });

  it('jadvaldan oshib ketsa oxirgi qiymatda qoladi', () => {
    expect(nextRetryDelayMs(99)).toBe(4 * 60 * 60_000);
  });
});
