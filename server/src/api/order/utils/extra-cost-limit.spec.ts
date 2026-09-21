/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { Where_deliver } from 'src/common/enums';
import {
  assertExtraCostWithinLimit,
  cancelExtraCostLimit,
  sellExtraCostLimit,
} from './extra-cost-limit.util';

/**
 * QO'SHIMCHA XARAJAT CHEGARASI.
 *
 * Bu pul chegarasi: buzilsa kuryer market kassasidan ortiqcha pul yechib
 * oladi. Tekshiruvda uchta teshik topilgan edi — Elchi'da sotuv/bekor
 * qilishda chegara YO'Q, ikkala tizimda qisman sotuvda YO'Q.
 */
const sell = (whereDeliver: Where_deliver, center: number, home: number) =>
  sellExtraCostLimit({ whereDeliver, tariffCenter: center, tariffHome: home });

describe("Qo'shimcha xarajat chegarasi — SOTUV", () => {
  it('TC1: uyga yetkazishda UMUMAN mumkin emas', () => {
    const limit = sell(Where_deliver.ADDRESS, 15000, 25000);
    expect(limit.max).toBe(0);
    expect(limit.forbiddenReason).toMatch(/Uyga/);
    expect(() => assertExtraCostWithinLimit(1, limit)).toThrow(
      BadRequestException,
    );
  });

  it('TC2: markazga — maksimum uy va markaz tarifi FARQI', () => {
    // 15000 + xarajat <= 25000  ->  maksimum 10000
    const limit = sell(Where_deliver.CENTER, 15000, 25000);
    expect(limit.max).toBe(10000);
    expect(() => assertExtraCostWithinLimit(10000, limit)).not.toThrow();
    expect(() => assertExtraCostWithinLimit(10001, limit)).toThrow(
      BadRequestException,
    );
  });

  it("TC3: tariflar TENG bo'lsa — o'z tarifining 50%i", () => {
    // ⭐ O'ZGARISH: avval TO'LIQ tarifgacha (20000) ruxsat berilardi, ya'ni
    // kuryer xizmat haqini ikki baravar qilib olishi mumkin edi.
    const limit = sell(Where_deliver.CENTER, 20000, 20000);
    expect(limit.max).toBe(10000);
    expect(() => assertExtraCostWithinLimit(10000, limit)).not.toThrow();
    expect(() => assertExtraCostWithinLimit(10001, limit)).toThrow(
      BadRequestException,
    );
  });

  it("TC4: uy tarifi markazdan KICHIK bo'lsa ham 50% qoidasi", () => {
    // Buzilgan sozlama (uy < markaz) -> diff manfiy -> 50% ga tushadi.
    // Manfiy chegara berib qo'yish xavfli bo'lardi.
    const limit = sell(Where_deliver.CENTER, 20000, 10000);
    expect(limit.max).toBe(10000);
  });

  it("TC5: kasrli farq — butun so'mga yaxlitlanadi (pastga)", () => {
    const limit = sell(Where_deliver.CENTER, 15001, 15001);
    expect(limit.max).toBe(7500); // 15001/2 = 7500.5 -> 7500
  });

  it('TC6: tarif 0 -> chegara 0, hech narsa yozilmaydi', () => {
    const limit = sell(Where_deliver.CENTER, 0, 0);
    expect(limit.max).toBe(0);
    expect(() => assertExtraCostWithinLimit(1, limit)).toThrow(
      BadRequestException,
    );
  });

  it('TC7: null/undefined tarif xatoga aylanmaydi', () => {
    const limit = sellExtraCostLimit({
      whereDeliver: Where_deliver.CENTER,
      tariffCenter: null,
      tariffHome: undefined,
    });
    expect(limit.max).toBe(0);
  });

  it("TC8: xarajat 0 yoki manfiy bo'lsa tekshiruv o'tkazib yuboriladi", () => {
    const limit = sell(Where_deliver.ADDRESS, 15000, 25000);
    // Uyga taqiq bo'lsa ham, xarajat yozilmasa xato bermaydi.
    expect(() => assertExtraCostWithinLimit(0, limit)).not.toThrow();
    expect(() => assertExtraCostWithinLimit(-5, limit)).not.toThrow();
  });
});

describe("Qo'shimcha xarajat chegarasi — BEKOR QILISH", () => {
  it('TC9: maksimum = kuryer tarifi (sotuvdan BOSHQA qoida)', () => {
    // Kuryer borib qaytdi, vaqt-yoqilg'i sarfladi — shu bois to'liq tarif.
    const limit = cancelExtraCostLimit({ courierTariff: 15000 });
    expect(limit.max).toBe(15000);
    expect(limit.forbiddenReason).toBeNull();
  });

  it('TC10: bekor qilishda uyga yetkazish TAQIQLANMAYDI', () => {
    // Sotuvdan farqi shu: yetkazilmagan buyurtmada xarajat ikki holatda ham
    // real, shuning uchun uyga/markazga ajratilmaydi.
    const limit = cancelExtraCostLimit({ courierTariff: 25000 });
    expect(limit.forbiddenReason).toBeNull();
    expect(() => assertExtraCostWithinLimit(25000, limit)).not.toThrow();
  });
});
