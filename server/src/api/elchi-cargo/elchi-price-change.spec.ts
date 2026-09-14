/// <reference types="jest" />
import { OrderService } from '../order/order.service';

/**
 * ELCHI NARXNI O'ZGARTIRGANDA.
 *
 * Elchi kuryeri buyurtmani boshqa narxga sotishi mumkin — masalan mijoz bilan
 * kelishib 500 000 lik narsani 450 000 ga. Ilgari PCS bundan BEXABAR qolardi:
 * `sellOrder` o'zining eski narxi (500 000) bilan hisoblab, kuryer kassasiga
 * 485 000 yozardi, Elchi esa faqat 435 000 qarzdor bo'lardi — farq 50 000 har
 * buyurtmada jimgina yo'qolardi.
 *
 * Endi narx QABUL QILINADI (ham pasayish, ham ko'tarilish) va o'zgarish
 * buyurtma izohiga avtomatik yoziladi, ya'ni jimgina o'tmaydi.
 */
function buildSvc(orderPrice: number) {
  const updates: any[] = [];
  const svc: any = Object.create(OrderService.prototype);
  svc.orderRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'o-1', total_price: orderPrice }),
    update: jest.fn((where: any, patch: any) => {
      updates.push({ where, patch });
      return Promise.resolve({ affected: 1 });
    }),
  };
  svc.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  return { svc, updates };
}

const accept = (svc: any, remote: unknown) =>
  svc.acceptElchiPriceChange('o-1', remote);

/**
 * `toLocaleString('uz-UZ')` mingliklarni UZILMAS bo'shliq (U+00A0) bilan
 * ajratadi — ko'zga oddiy bo'shliqdek ko'rinadi, lekin `toContain` topmaydi.
 * Solishtirishdan oldin normallashtiriladi.
 */
const norm = (v: string) => v.replace(/\u00a0/g, ' ');

describe('Elchi narx o‘zgarishini qabul qilish', () => {
  it('TC1: PASAYISH qabul qilinadi va izohga yoziladi', async () => {
    const { svc, updates } = buildSvc(500000);

    const note = await accept(svc, 450000);

    expect(updates[0].patch).toEqual({ total_price: 450000 });
    // Operator buyurtmani ochganda kassadagi summa nega boshqacha ekanini
    // ko'rishi kerak — shuning uchun IKKI raqam ham izohda.
    expect(norm(note)).toContain('500 000');
    expect(norm(note)).toContain('450 000');
    expect(note).toMatch(/Elchi narxni o'zgartirdi/);
  });

  it('TC2: KO‘TARILISH ham qabul qilinadi', async () => {
    const { svc, updates } = buildSvc(500000);

    const note = await accept(svc, 550000);

    expect(updates[0].patch).toEqual({ total_price: 550000 });
    expect(norm(note)).toContain('550 000');
  });

  it('TC3: narx bir xil -> hech narsa yozilmaydi, izoh BO‘SH', async () => {
    const { svc, updates } = buildSvc(500000);

    const note = await accept(svc, 500000);

    expect(updates).toHaveLength(0);
    expect(note).toBe('');
  });

  it('TC4: Elchi narx bermasa -> tegilmaydi', async () => {
    const { svc, updates } = buildSvc(500000);

    expect(await accept(svc, undefined)).toBe('');
    expect(await accept(svc, null)).toBe('');
    expect(await accept(svc, NaN)).toBe('');
    expect(updates).toHaveLength(0);
  });

  it('TC5: MANFIY narx qabul QILINMAYDI (buzilgan ma‘lumot)', async () => {
    const { svc, updates } = buildSvc(500000);

    expect(await accept(svc, -1)).toBe('');
    expect(updates).toHaveLength(0);
  });

  it('TC6: 0 narx qabul qilinadi — oldindan to‘langan posilka haqiqiy holat', async () => {
    const { svc, updates } = buildSvc(500000);

    const note = await accept(svc, 0);

    expect(updates[0].patch).toEqual({ total_price: 0 });
    expect(note).toContain('0');
  });

  it('TC7: buyurtma topilmasa yiqilmaydi', async () => {
    const { svc, updates } = buildSvc(500000);
    svc.orderRepo.findOne = jest.fn().mockResolvedValue(null);

    expect(await accept(svc, 450000)).toBe('');
    expect(updates).toHaveLength(0);
  });
});
