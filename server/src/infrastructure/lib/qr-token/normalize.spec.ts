/// <reference types="jest" />
import { normalizeQrToken } from './normalize';

describe('normalizeQrToken', () => {
  it('normal lowercase hex tokenni o\'zgartirmaydi', () => {
    const t = 'a1b2c3d4e5f60708';
    expect(normalizeQrToken(t)).toBe(t);
  });

  it('Caps Lock yoqiq holati uchun: uppercase ni lowercase ga keltiradi', () => {
    expect(normalizeQrToken('A1B2C3D4E5F60708')).toBe('a1b2c3d4e5f60708');
    expect(normalizeQrToken('ABCDEF0123456789')).toBe('abcdef0123456789');
  });

  it('RU layout: Cyrillic harflarini Latin hex ga konvert qiladi', () => {
    // a→ф, b→и, c→с, d→в, e→у, f→а
    expect(normalizeQrToken('фисвуа0123456789')).toBe('abcdef0123456789');
  });

  it('RU layout + Caps Lock: katta Cyrillic ham ishlaydi', () => {
    expect(normalizeQrToken('ФИСВУА0123456789')).toBe('abcdef0123456789');
  });

  it('aralash kirill+latin holati', () => {
    // RU: фис | EN: def | RU: вуа
    expect(normalizeQrToken('фисdefвуа123')).toBe('abcdefdef123');
  });

  it('tashqi bo\'shliqlarni olib tashlaydi', () => {
    expect(normalizeQrToken('  a1b2c3  ')).toBe('a1b2c3');
    expect(normalizeQrToken('\tabc123\n')).toBe('abc123');
  });

  it('null/undefined/bo\'sh string xavfsiz ishlanadi', () => {
    expect(normalizeQrToken(null)).toBe('');
    expect(normalizeQrToken(undefined)).toBe('');
    expect(normalizeQrToken('')).toBe('');
    expect(normalizeQrToken('   ')).toBe('');
  });

  it('raqamlar layout/caps dan mustaqil — har doim bir xil', () => {
    expect(normalizeQrToken('0123456789')).toBe('0123456789');
  });

  it('idempotent: ikki marta normalize qilish bir xil natija', () => {
    const raw = 'ФисDEFвуа0123';
    const once = normalizeQrToken(raw);
    const twice = normalizeQrToken(once);
    expect(once).toBe(twice);
  });

  it('mavjud (saqlangan) hex token bilan to\'liq mos keladi', () => {
    // Postgres saqlangan token — randomBytes(12).toString('hex') natijasi
    const stored = 'd3a8f1e9b2c40567a8b9d0e1';
    // Skaner foydalanuvchining OS sozlamasi bilan emit qilgan variantlari:
    expect(normalizeQrToken('D3A8F1E9B2C40567A8B9D0E1')).toBe(stored); // Caps
    expect(normalizeQrToken('в3ф8а1у9и2с40567ф8и9в0у1')).toBe(stored); // RU layout
    expect(normalizeQrToken('В3Ф8А1У9И2С40567Ф8И9В0У1')).toBe(stored); // RU + Caps
  });
});
