import { AiOrderService } from './ai-order.service';

/**
 * resolveDistrict — DETERMINISTIK tuman rezolyutsiyasi (DB'siz: districts cache
 * beriladi, claude chaqirilmaydi). Asosiy tekshiruv: ISHONCHLI VILOYAT bo'lsa
 * tuman FAQAT shu viloyat ichidan tanlansin — cross-region xato (Toshkent
 * Xonobod -> Andijon Xo'jaobod) qaytmasin; viloyatда mos yo'q bo'lsa tuman bo'sh,
 * viloyat SAQLANADI.
 */
type D = {
  id: string;
  name: string;
  region_id: string;
  region: { name: string };
};

const DISTRICTS: D[] = [
  // Toshkent shahri
  { id: 'tsh-chilonzor', name: 'Chilonzor', region_id: 'r-tsh', region: { name: 'Toshkent shahri' } },
  { id: 'tsh-yakkasaroy', name: 'Yakkasaroy', region_id: 'r-tsh', region: { name: 'Toshkent shahri' } },
  { id: 'tsh-sergeli', name: 'Sergeli', region_id: 'r-tsh', region: { name: 'Toshkent shahri' } },
  // Andijon
  { id: 'and-xojaobod', name: "Xo'jaobod", region_id: 'r-and', region: { name: 'Andijon' } },
  { id: 'and-xonobod', name: 'Xonobod', region_id: 'r-and', region: { name: 'Andijon' } },
  { id: 'and-asaka', name: 'Asaka', region_id: 'r-and', region: { name: 'Andijon' } },
  // Farg'ona
  { id: 'far-margilon', name: "Marg'ilon", region_id: 'r-far', region: { name: "Farg'ona" } },
];

// Konstruktorni chetlab o'tamiz — faqat prototip metodlari (resolveDistrict +
// sof helperlar: normGeo/simRatio/...) kerak, injected deplar ishlatilmaydi.
const svc = Object.create(AiOrderService.prototype) as AiOrderService;
const resolve = (draft: Record<string, unknown>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).resolveDistrict(draft, DISTRICTS as any) as Promise<void>;

describe('resolveDistrict — viloyat qulf (cross-region xatosi)', () => {
  it('Toshkent shahri + Xonobod: viloyat Toshkent qoladi, Andijonga KETMAYDI', async () => {
    const draft: Record<string, unknown> = {
      region_name: 'Toshkent shahri',
      district_name: 'Xonobod',
    };
    await resolve(draft);
    // KRITIK: viloyat Andijonga almashmadi
    expect(draft.region_id).toBe('r-tsh');
    // Toshkentda Xonobod yo'q — tuman avto-tanlanmadi (Andijon Xonobod EMAS)
    expect(draft.district_id).not.toBe('and-xonobod');
    expect(draft.district_id).toBeUndefined();
  });

  it('Andijon + Xonobod: to\'g\'ri viloyatda tuman aniqlanadi', async () => {
    const draft: Record<string, unknown> = {
      region_name: 'Andijon',
      district_name: 'Xonobod',
    };
    await resolve(draft);
    expect(draft.region_id).toBe('r-and');
    expect(draft.district_id).toBe('and-xonobod');
  });

  it('Viloyatsiz noyob tuman (Chilonzor): viloyat tuman orqali tiklanadi', async () => {
    const draft: Record<string, unknown> = { district_name: 'Chilonzor' };
    await resolve(draft);
    expect(draft.district_id).toBe('tsh-chilonzor');
    expect(draft.region_id).toBe('r-tsh');
  });

  it('Toshkent + Asaka (Andijon tumani): viloyatga xato yozilsa Andijonga tortmaydi', async () => {
    const draft: Record<string, unknown> = {
      region_name: 'Toshkent shahri',
      district_name: 'Asaka',
    };
    await resolve(draft);
    // Asaka Andijonda — lekin viloyat Toshkent deb aytilgan; Andijonga KETMAYDI
    expect(draft.region_id).toBe('r-tsh');
    expect(draft.district_id).toBeUndefined();
  });
});
