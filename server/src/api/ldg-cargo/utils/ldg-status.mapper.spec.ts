/// <reference types="jest" />
import { mapLdgStatus, ldgStatusLabel } from './ldg-status.mapper';
import { Order_status } from 'src/common/enums';

/**
 * LDG status → Order_status xaritalash testlari.
 *
 * ASOSIY INVARIANT: LDG hech qanday statusi buyurtmani CLOSED ("Yopilgan") qila
 * olmaydi — CLOSED faqat skaner oqimidan qo'yiladi. `RETURNED` esa CANCELLED_SENT
 * ("Bekor (yuborilgan)" — qaytish yo'lida) bo'lishi kerak.
 */
describe('ldg-status.mapper', () => {
  it('RETURNED → CANCELLED_SENT (CLOSED EMAS)', () => {
    const m = mapLdgStatus('RETURNED');
    expect(m).not.toBeNull();
    expect(m!.order_status).toBe(Order_status.CANCELLED_SENT);
    expect(m!.order_status).not.toBe(Order_status.CLOSED);
    // Terminal oqim hamon 'return' (markReturnedByLdg) — u CANCELLED_SENT yozadi.
    expect(m!.terminal_action).toBe('return');
  });

  it('CANCELLED → CANCELLED (bekor qilish oqimi)', () => {
    const m = mapLdgStatus('CANCELLED');
    expect(m!.order_status).toBe(Order_status.CANCELLED);
    expect(m!.terminal_action).toBe('cancel');
  });

  it('DELIVERED → SOLD (sotuv oqimi)', () => {
    const m = mapLdgStatus('DELIVERED');
    expect(m!.order_status).toBe(Order_status.SOLD);
    expect(m!.terminal_action).toBe('sell');
  });

  it("oraliq statuslar terminal EMAS va terminal_action=null", () => {
    for (const code of [
      'CREATED',
      'NEW',
      'RECEIVED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      '8',
    ]) {
      const m = mapLdgStatus(code);
      expect(m).not.toBeNull();
      expect(m!.is_terminal).toBe(false);
      expect(m!.terminal_action).toBeNull();
    }
  });

  it('kichik harf / probel / raqamli kod normalizatsiya qilinadi', () => {
    expect(mapLdgStatus('returned')!.order_status).toBe(
      Order_status.CANCELLED_SENT,
    );
    expect(mapLdgStatus('  delivered  ')!.order_status).toBe(Order_status.SOLD);
    expect(mapLdgStatus('8')!.order_status).toBe(Order_status.WAITING);
  });

  it("noma'lum kod uchun null", () => {
    expect(mapLdgStatus('SOMETHING_NEW')).toBeNull();
    expect(mapLdgStatus('')).toBeNull();
  });

  it("HECH BIR LDG statusi CLOSED bermaydi (asosiy invariant)", () => {
    const codes = [
      'CREATED',
      'NEW',
      'RECEIVED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      '8',
      'DELIVERED',
      'RETURNED',
      'CANCELLED',
    ];
    for (const code of codes) {
      const m = mapLdgStatus(code);
      if (m) {
        expect(m.order_status).not.toBe(Order_status.CLOSED);
      }
    }
  });

  it("ldgStatusLabel o'zbekcha yorliq beradi", () => {
    expect(ldgStatusLabel('RETURNED')).toBe('Qaytarildi');
    expect(ldgStatusLabel('CANCELLED')).toBe('Bekor qilindi');
    expect(ldgStatusLabel('DELIVERED')).toBe('Yetkazildi');
  });
});
