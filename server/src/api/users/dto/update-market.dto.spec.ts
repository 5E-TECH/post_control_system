/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateMarketDto } from './update-market.dto';

/**
 * QO'SHIMCHA XARAJAT NAZORATI — market sozlamasi DTO'si.
 *
 * NEGA TEST KERAK. Ikkala maydon ham PULNI boshqaradi:
 *
 *   `extra_cost_proof_required`     — yoqilgan bo'lsa kuryer xarajati market
 *                                     tasdig'igacha kassaga YOZILMAYDI
 *   `extra_cost_auto_approve_under` — shu summadan kichik so'rovlar tasdiqsiz
 *                                     o'tadi, ya'ni to'g'ridan-to'g'ri kassaga
 *
 * Ikkita aniq tuzoq bor va ikkalasi ham jimgina buziladi:
 *
 *   1. `forbidNonWhitelisted` yoqilgan (`app.service.ts`). Maydon DTO'da
 *      bo'lmasa, uni yuborgan so'rov BUTUNLAY 422 bo'ladi — ya'ni market
 *      tahriri umuman ishlamay qoladi, faqat bitta toggle emas.
 *
 *   2. Chegara `bigint` ustunga yoziladi. Kasrli qiymat INSERT xatosi beradi
 *      va butun tranzaksiyani rollback qiladi — aynan `extraCost` da mavjud
 *      bo'lgan nuqson (`@IsNumber` kasrga ruxsat berardi).
 */
const parse = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(UpdateMarketDto, payload, {
    enableImplicitConversion: false,
  });
  return { dto, errors: validateSync(dto, { whitelist: true }) };
};

describe("Market sozlamasi DTO — qo'shimcha xarajat nazorati", () => {
  it('TC1: bayroq DTO tomonidan QABUL QILINADI (aks holda 422 va butun tahrir buziladi)', () => {
    const { dto, errors } = parse({ extra_cost_proof_required: true });
    expect(errors).toHaveLength(0);
    expect(dto.extra_cost_proof_required).toBe(true);
  });

  it('TC2: bayroq o‘chirish ham o‘tadi (false — "yuborilmagan" emas)', () => {
    const { dto, errors } = parse({ extra_cost_proof_required: false });
    expect(errors).toHaveLength(0);
    expect(dto.extra_cost_proof_required).toBe(false);
  });

  it('TC3: bayroq faqat boolean — satr rad etiladi', () => {
    const { errors } = parse({ extra_cost_proof_required: 'ha' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('extra_cost_proof_required');
  });

  it('TC4: chegara raqam sifatida o‘tadi', () => {
    const { dto, errors } = parse({ extra_cost_auto_approve_under: 5000 });
    expect(errors).toHaveLength(0);
    expect(dto.extra_cost_auto_approve_under).toBe(5000);
  });

  it('TC5: telefon brauzeridan kelgan "5 000" / "5,000" formatlari parse qilinadi', () => {
    expect(parse({ extra_cost_auto_approve_under: '5 000' }).dto
      .extra_cost_auto_approve_under).toBe(5000);
    expect(parse({ extra_cost_auto_approve_under: '5,000' }).dto
      .extra_cost_auto_approve_under).toBe(5000);
  });

  it('TC6: KASRLI qiymat RAD ETILADI — bigint ustunga tushsa INSERT yiqiladi', () => {
    const { errors } = parse({ extra_cost_auto_approve_under: 5000.5 });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('extra_cost_auto_approve_under');
    expect(errors[0].constraints).toHaveProperty('isInt');
  });

  it('TC7: MANFIY chegara rad etiladi', () => {
    const { errors } = parse({ extra_cost_auto_approve_under: -1 });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it("TC8: 0 — ruxsat etilgan (o'chiq holat), rad etilmasin", () => {
    const { dto, errors } = parse({ extra_cost_auto_approve_under: 0 });
    expect(errors).toHaveLength(0);
    expect(dto.extra_cost_auto_approve_under).toBe(0);
  });

  it("TC9: bo'sh satr — maydon YUBORILMAGAN deb qabul qilinadi (0 ga tushmasin)", () => {
    // Bo'sh inputni 0 deb talqin qilish "chegarani o'chirish" bo'lardi —
    // foydalanuvchi esa shunchaki maydonga tegmagan bo'lishi mumkin.
    const { dto, errors } = parse({ extra_cost_auto_approve_under: '' });
    expect(errors).toHaveLength(0);
    expect(dto.extra_cost_auto_approve_under).toBeUndefined();
  });

  it('TC10: ikkala maydon ixtiyoriy — ularsiz ham DTO haqiqiy', () => {
    const { errors } = parse({ name: 'Test Market' });
    expect(errors).toHaveLength(0);
  });
});
