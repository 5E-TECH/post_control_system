/// <reference types="jest" />
import { TERMINAL_ELCHI_STATUSES } from './elchi-reconcile.service';

/**
 * RECONCILE TERMINAL RO'YXATI — `sold`/`partly_paid` TERMINAL EMAS (E2E Andijon P0).
 *
 * findOpenShipments `LOWER(elchi_status) NOT IN (terminal)` bilan ochiq
 * posilkalarni tanlaydi. Agar `sold` terminal bo'lsa, webhooksiz muhitda
 * sotilgan posilka boshqa hech qachon so'ralmaydi va `paid` o'tishi (pul
 * maydonlari) yo'qoladi. Shu bois `sold`/`partly_paid` ro'yxatda BO'LMASLIGI,
 * `paid`/`cancelled`/`closed` esa BO'LISHI shart.
 */
describe('reconcile TERMINAL_ELCHI_STATUSES', () => {
  it('`sold` va `partly_paid` TERMINAL EMAS (qayta so`raladi)', () => {
    expect(TERMINAL_ELCHI_STATUSES).not.toContain('sold');
    expect(TERMINAL_ELCHI_STATUSES).not.toContain('partly_paid');
  });

  it('`paid`/`cancelled`/`closed` TERMINAL (qayta so`ralmaydi)', () => {
    expect(TERMINAL_ELCHI_STATUSES).toContain('paid');
    expect(TERMINAL_ELCHI_STATUSES).toContain('cancelled');
    expect(TERMINAL_ELCHI_STATUSES).toContain('returned_to_market');
    expect(TERMINAL_ELCHI_STATUSES).toContain('closed');
  });
});
