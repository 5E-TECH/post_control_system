import { MarketplaceParcelStatus } from '../marketplace.enums';

/**
 * STATUS XARITASI — bizning kanonik nom ↔ hamkorning qiymati.
 *
 * ⚠️ NEGA KERAK. Kontrakt bizning lug'atni taklif qiladi, lekin hamkor
 * tizimi allaqachon mavjud bo'lishi va butunlay boshqa qiymatlar
 * ishlatishi mumkin: `7`, `"dostavleno"`, `"ST-07"`. Buni koddan taxmin
 * qilib bo'lmaydi — admin panelidan QO'LDA kiritiladi.
 *
 * Xarita bo'sh bo'lsa hamma narsa kanonik nomlarda ishlaydi (bugungi xulq).
 */
export type MarketplaceStatusMap = Record<string, string>;

/** Barcha kanonik statuslar — UI jadvali shu ro'yxatdan quriladi. */
export const CANONICAL_STATUSES: MarketplaceParcelStatus[] = Object.values(
  MarketplaceParcelStatus,
);

const isCanonical = (v: string): v is MarketplaceParcelStatus =>
  (CANONICAL_STATUSES as string[]).includes(v);

/**
 * BIZDAN ULARGA — hodisada yuboriladigan qiymat.
 *
 * Xaritada yo'q bo'lsa kanonik nom ketadi: hamkor hali sozlamagan bo'lsa,
 * jimgina bo'sh satr yuborishdan ko'ra kanonik nom ancha yaxshi.
 */
export function toPartnerStatus(
  map: MarketplaceStatusMap | null | undefined,
  canonical: string | null | undefined,
): string | null {
  if (!canonical) return null;
  const mapped = map?.[canonical];
  return mapped != null && String(mapped).trim() !== ''
    ? String(mapped)
    : canonical;
}

/**
 * ULARDAN BIZGA — kanonik nomga qaytarish.
 *
 * ⚠️ Bu TO'G'RILIK uchun shart: `REFUSED_REMOTE_STATUSES` va terminal
 * ro'yxati kanonik nomlar bilan ishlaydi. Ularning `7` qiymati kanonikka
 * aylantirilmasa, ular BEKOR QILGAN posilkani jimgina qabul qilardik.
 *
 * Topilmasa `null` — chaqiruvchi «noma'lum status» deb ishlashi kerak,
 * taxmin qilmasligi.
 */
export function toCanonicalStatus(
  map: MarketplaceStatusMap | null | undefined,
  raw: string | null | undefined,
): MarketplaceParcelStatus | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (v === '') return null;

  // 1. Xaritada aniq mos kelish (ularning qiymati → bizning kanonik).
  if (map) {
    for (const [canonical, theirs] of Object.entries(map)) {
      if (theirs != null && String(theirs) === v && isCanonical(canonical)) {
        return canonical;
      }
    }
  }

  // 2. Xarita sozlanmagan yoki bu qiymat unda yo'q — kanonik nomning
  //    o'zimi? (registrga befarq: `delivered` ham `DELIVERED` ham).
  const upper = v.toUpperCase();
  if (isCanonical(upper)) return upper;

  return null;
}

/**
 * Xaritani tozalash: faqat KANONIK kalitlar, bo'sh qiymatlar tashlanadi.
 *
 * ⚠️ Noma'lum kalitni qabul qilsak, admin xato yozgan nomni hech narsa
 * ushlamaydi va status jimgina xaritalanmay qolardi.
 */
export function sanitizeStatusMap(
  raw: Record<string, unknown> | null | undefined,
): MarketplaceStatusMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: MarketplaceStatusMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isCanonical(k)) continue;
    const val = v == null ? '' : String(v).trim();
    if (val === '') continue;
    out[k] = val;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Xaritada IKKI kanonik status BIR qiymatga tushsa — teskari yo'nalish
 * noaniq bo'ladi. UI buni ogohlantirish sifatida ko'rsatadi.
 */
export function findStatusMapConflicts(
  map: MarketplaceStatusMap | null | undefined,
): Array<{ value: string; statuses: string[] }> {
  if (!map) return [];
  const byValue = new Map<string, string[]>();
  for (const [canonical, theirs] of Object.entries(map)) {
    const v = String(theirs);
    byValue.set(v, [...(byValue.get(v) ?? []), canonical]);
  }
  return [...byValue.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([value, statuses]) => ({ value, statuses }));
}

/**
 * PCS ICHKI STATUSI → KANONIK marketplace statusi.
 *
 * ⚠️ NEGA KERAK. `order.service.ts` hodisaga `status.from` sifatida
 * BIZNING ichki qiymatni beradi (`waiting`, `on the road`,
 * `cancelled (sent)`). Bular kontrakt §6.1 lug'atida YO'Q — hamkor
 * ularni tushunmaydi va o'z holatini noto'g'ri yangilaydi yoki umuman
 * e'tiborsiz qoldiradi.
 *
 * Kanonik qiymat kelsa — o'zgarishsiz qaytadi (ko'p joyda `to` allaqachon
 * kanonik).
 */
export function pcsStatusToCanonical(
  raw: string | null | undefined,
): MarketplaceParcelStatus | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (v === '') return null;

  const upper = v.toUpperCase();
  if (isCanonical(upper)) return upper;

  switch (v.toLowerCase()) {
    case 'created':
      return MarketplaceParcelStatus.CREATED;
    case 'new':
    case 'received':
      return MarketplaceParcelStatus.ACCEPTED_BY_BEEPOST;
    case 'on the road':
      return MarketplaceParcelStatus.IN_TRANSIT;
    case 'waiting':
      return MarketplaceParcelStatus.OUT_FOR_DELIVERY;
    case 'sold':
    case 'paid':
    case 'partly_paid':
      return MarketplaceParcelStatus.DELIVERED;
    case 'cancelled':
    case 'cancelled (sent)':
      return MarketplaceParcelStatus.CANCELLED;
    case 'closed':
      return MarketplaceParcelStatus.RETURNED;
    default:
      return null;
  }
}

/**
 * Hodisaning `status` blokini HAMKOR TILIGA o'girish.
 *
 * Ikki qadam: (1) PCS ichki qiymati → kanonik, (2) kanonik → hamkor
 * xaritasi. Ikkalasi ham topilmasa `null` — taxmin qilmaymiz.
 */
export function buildEventStatus<T extends { from?: string | null; to: string }>(
  map: MarketplaceStatusMap | null | undefined,
  status: T | null | undefined,
): { from: string | null; to: string } | undefined {
  if (!status) return undefined;
  /**
   * ⚠️ `to` HECH QACHON `null` bo'lmaydi. Kanonikka keltirib bo'lmasa
   * XOM qiymat yuboriladi: hamkor tushunmasligi mumkin, lekin `null`
   * yuborish undan ham yomon — hodisa ma'nosiz bo'lib qoladi va
   * nima bo'lganini keyin aniqlab ham bo'lmaydi.
   */
  const canonicalTo = pcsStatusToCanonical(status.to);
  return {
    from: toPartnerStatus(map, pcsStatusToCanonical(status.from)),
    to: toPartnerStatus(map, canonicalTo) ?? String(status.to),
  };
}
