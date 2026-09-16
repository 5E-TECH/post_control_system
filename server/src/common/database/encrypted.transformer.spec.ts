import { encryptedTransformer } from './encrypted.transformer';

/**
 * SEKRET SHIFRLASH TESTLARI.
 *
 * Nega bu fayl bor: bu transformer marketplace API kaliti va imzo sekretini
 * saqlaydi. U jimgina buzilsa — yo sekretlar ochiq matn bo'lib qoladi, yo
 * mavjud qatorlar o'qilmay qoladi va integratsiya 401 bilan to'xtaydi.
 * Ikkala holat ham ko'zga darrov tashlanmaydi, shuning uchun qulflab qo'yamiz.
 */

const KEY = 'test-encryption-key-at-least-16-chars';

/**
 * ⚠️ Modul kalitni CHAQIRUV paytida o'qiydi (modul yuklanganda emas), shuning
 * uchun ENV ni test ichida o'zgartirish yetarli. Agar kalit modul darajasida
 * cache qilinsa, bu testlar buni darhol ko'rsatadi.
 */
describe('encryptedTransformer', () => {
  const original = process.env.MARKETPLACE_SECRET_KEY;

  beforeEach(() => {
    process.env.MARKETPLACE_SECRET_KEY = KEY;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.MARKETPLACE_SECRET_KEY;
    else process.env.MARKETPLACE_SECRET_KEY = original;
  });

  it('shifrlangan qiymatni asl holiga qaytaradi', () => {
    const plain = "mock-secret-v1 o'zbekcha ham";
    const stored = encryptedTransformer.to(plain) as string;

    expect(stored).not.toBe(plain);
    expect(stored.startsWith('v1:')).toBe(true);
    expect(encryptedTransformer.from(stored)).toBe(plain);
  });

  it('bir xil matnni har safar BOSHQACHA shifrlaydi (IV tasodifiy)', () => {
    const a = encryptedTransformer.to('bir xil') as string;
    const b = encryptedTransformer.to('bir xil') as string;

    expect(a).not.toBe(b);
    // Lekin ikkalasi ham ayni matnga ochiladi.
    expect(encryptedTransformer.from(a)).toBe('bir xil');
    expect(encryptedTransformer.from(b)).toBe('bir xil');
  });

  it('buzilgan shifrmatnda XATO tashlaydi (GCM autentifikatsiyasi)', () => {
    const stored = encryptedTransformer.to('sekret') as string;
    const tampered = stored.slice(0, -4) + 'AAAA';

    // ⚠️ Nega muhim: CBC bo'lganda bu jimgina AXLAT qaytarardi va o'sha axlat
    // kalit sifatida ishlatilib, sababi tushunarsiz 401 larga olib kelardi.
    expect(() => encryptedTransformer.from(tampered)).toThrow();
  });

  it('shifrlanmagan ESKI qiymatni o\'zgartirmasdan qaytaradi', () => {
    // Migratsiyadan oldin yozilgan ochiq matn qatorlari o'qilishi kerak —
    // aks holda mavjud ulanishlar birdan ishlamay qolardi.
    expect(encryptedTransformer.from('ochiq-matn-eski')).toBe('ochiq-matn-eski');
  });

  it('null va bo\'sh satrni shifrlamaydi', () => {
    // ⚠️ Aks holda "sekret yo'q" holati "sekret bor, lekin bo'sh" ga aylanib,
    // `api_key IS NOT NULL` kabi sozlash tekshiruvlari noto'g'ri ishlardi.
    expect(encryptedTransformer.to(null)).toBeNull();
    expect(encryptedTransformer.to('')).toBeNull();
    expect(encryptedTransformer.from(null)).toBeNull();
    expect(encryptedTransformer.from('')).toBeNull();
  });

  it('kalit YO\'Q bo\'lsa ochiq matn saqlaydi (server yiqilmaydi)', () => {
    delete process.env.MARKETPLACE_SECRET_KEY;
    delete process.env.SECRET_ENC_KEY;

    // Ataylab: kalitsiz butun serverni yiqitish bitta integratsiya uchun
    // juda qattiq jazo. Kamchilik sozlash ekranida ko'rsatiladi.
    expect(encryptedTransformer.to('sekret')).toBe('sekret');
  });

  it('kalit YO\'Q, lekin qiymat SHIFRLANGAN bo\'lsa — ochiq xato', () => {
    const stored = encryptedTransformer.to('sekret') as string;
    delete process.env.MARKETPLACE_SECRET_KEY;
    delete process.env.SECRET_ENC_KEY;

    // Jimgina axlat qaytarishdan ko'ra ochiq xato yaxshi: aks holda 401
    // sababini hech kim topa olmasdi.
    expect(() => encryptedTransformer.from(stored)).toThrow(
      /MARKETPLACE_SECRET_KEY/,
    );
  });

  it('juda qisqa kalitni ISHONCHSIZ deb hisoblaydi', () => {
    process.env.MARKETPLACE_SECRET_KEY = 'qisqa';
    delete process.env.SECRET_ENC_KEY;

    expect(encryptedTransformer.to('sekret')).toBe('sekret');
  });
});
