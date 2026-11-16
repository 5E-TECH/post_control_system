import {
  integrationBaseUrl,
  qrFindUrl,
  statusSyncUrl,
} from './integration-url.util';

/**
 * ⚠️ PRODUCTION NUQSONI (2026-10-22, Butsy integratsiyasi).
 *
 * Admin `api_url` ga to'liq QR manzilini kiritgan
 * (`.../post-control/qrorder/find`). QR proxy buni ko'tarardi, status sync esa
 * `api_url + endpoint` ni yig'ib `.../qrorder/find/orders/{id}/status` ga
 * yuborardi — Butsy 404, buyurtma holati u yoqqa hech qachon yetmasdi.
 */
describe('integration-url.util', () => {
  const BUTSY_BASE = 'https://api.butsy.uz/integrations/post-control';
  const BUTSY_FULL = `${BUTSY_BASE}/qrorder/find`;

  describe('integrationBaseUrl', () => {
    it.each([
      [BUTSY_BASE, BUTSY_BASE],
      [`${BUTSY_BASE}/`, BUTSY_BASE],
      [BUTSY_FULL, BUTSY_BASE],
      [`${BUTSY_FULL}/`, BUTSY_BASE],
      [`  ${BUTSY_FULL}  `, BUTSY_BASE],
      ['https://api.adosh.uz', 'https://api.adosh.uz'],
      [
        'https://api.inhayat.com/api/v1/delivery-point',
        'https://api.inhayat.com/api/v1/delivery-point',
      ],
    ])('%s -> %s', (input, expected) => {
      expect(integrationBaseUrl(input)).toBe(expected);
    });
  });

  describe('qrFindUrl', () => {
    it('baza manzilga /qrorder/find qo\'shadi', () => {
      expect(qrFindUrl(BUTSY_BASE)).toBe(BUTSY_FULL);
      expect(qrFindUrl('https://api.adosh.uz/')).toBe(
        'https://api.adosh.uz/qrorder/find',
      );
    });

    it("api_url da allaqachon bo'lsa, qayta qo'shmaydi", () => {
      expect(qrFindUrl(BUTSY_FULL)).toBe(BUTSY_FULL);
      expect(qrFindUrl(`${BUTSY_FULL}/`)).toBe(BUTSY_FULL);
    });
  });

  describe('statusSyncUrl', () => {
    const ID = 'pcd_01M5BZXEB6JXW3MYB1MFWRQ4M5';

    it("api_url to'liq QR manzil bo'lsa ham baza manzilga ulanadi (Butsy)", () => {
      expect(statusSyncUrl(BUTSY_FULL, '/orders/{id}/status', ID)).toBe(
        `${BUTSY_BASE}/orders/${ID}/status`,
      );
    });

    it("mavjud integratsiyalar o'zgarmaydi", () => {
      expect(
        statusSyncUrl('https://api.adosh.uz', '/orders/{id}/status', '12345'),
      ).toBe('https://api.adosh.uz/orders/12345/status');
      expect(
        statusSyncUrl('https://api.adosh.uz/', 'orderstatus/update', '12345'),
      ).toBe('https://api.adosh.uz/orderstatus/update');
    });

    it('tashqi ID URL-kodlanadi', () => {
      expect(statusSyncUrl(BUTSY_BASE, '/orders/{id}/status', 'a/b?c')).toBe(
        `${BUTSY_BASE}/orders/a%2Fb%3Fc/status`,
      );
    });
  });
});
