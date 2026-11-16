/**
 * Tashqi integratsiya `api_url` qiymatidan so'rov manzillarini yig'ish.
 *
 * `api_url` hujjatga ko'ra BAZA manzil (masalan `https://api.adosh.uz`) —
 * `/qrorder/find` ham, status endpoint ham unga qo'shiladi. Lekin amalda admin
 * ba'zan to'liq QR manzilini kiritadi (Butsy: `.../post-control/qrorder/find`).
 * QR proxy buni avvaldan ko'tarardi, status sync esa yo'q edi —
 * `.../qrorder/find/orders/{id}/status` ga ketib 404 olardi. Endi ikkalasi ham
 * shu bir joydan hisoblanadi.
 */

const QR_FIND_PATH = '/qrorder/find';

const trimTrailingSlashes = (url: string): string => url.replace(/\/+$/, '');

/** `api_url` dan oxiridagi `/` va `/qrorder/find` olib tashlangan baza manzil. */
export function integrationBaseUrl(apiUrl: string): string {
  const trimmed = trimTrailingSlashes(apiUrl.trim());
  return trimmed.toLowerCase().endsWith(QR_FIND_PATH)
    ? trimTrailingSlashes(trimmed.slice(0, -QR_FIND_PATH.length))
    : trimmed;
}

/** QR qidiruv manzili. `api_url` da `/qrorder/find` bo'lsa, qayta qo'shilmaydi. */
export function qrFindUrl(apiUrl: string): string {
  const trimmed = trimTrailingSlashes(apiUrl.trim());
  return trimmed.includes(QR_FIND_PATH) ? trimmed : trimmed + QR_FIND_PATH;
}

/**
 * Status sync manzili: baza + endpoint (`{id}` o'rniga tashqi buyurtma ID).
 * ID URL-kodlanadi — tashqi ID'da `/`, `?`, `#` bo'lsa yo'l buzilmasin.
 */
export function statusSyncUrl(
  apiUrl: string,
  endpointTemplate: string,
  externalOrderId: string,
): string {
  let endpoint = endpointTemplate.replace(
    '{id}',
    encodeURIComponent(externalOrderId),
  );
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }
  return integrationBaseUrl(apiUrl) + endpoint;
}
