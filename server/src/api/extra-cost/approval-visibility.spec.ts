/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';

/**
 * «QANDAY TASDIQLANDI» KO'RINISHI — REGRESSIYA QULFI.
 *
 * ⚠️ NEGA MUHIM. Qo'shimcha xarajat uch xil yo'l bilan tasdiqlanishi
 * mumkin:
 *
 *   market          — market kirib «Tasdiqlash» bosdi
 *   admin_override  — admin arbitraj qildi
 *   auto_backstop   — market 14 kun JAVOB BERMADI, tizim o'zi o'tkazdi
 *
 * Uchalasi ham kuryer kassasiga AYNI summani yozadi. Avval kassa izohi
 * ham bir xil edi — «Qo'shimcha xarajat tasdiqlandi». Ya'ni nizo
 * chiqqanda «buni kim tasdiqlagan» degan savolga kassa tarixidan javob
 * YO'Q edi: `decision_mode` faqat so'rov jadvalida qolib ketardi.
 *
 * Ayniqsa `auto_backstop` muhim — u market qarori EMAS, market
 * javob bermaganining oqibati.
 *
 * Bu test kodni ISHLATMAYDI, O'QIYDI: izoh bitta satrga qaytarilsa
 * `tsc` ham, boshqa testlar ham sezmaydi.
 */
const SERVICE = path.resolve(__dirname, 'extra-cost-decision.service.ts');
const src = fs.readFileSync(SERVICE, 'utf8');

/** Izohlarni tashlaydi — test matnni emas, KODNI tekshiradi. */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

describe('kassa izohi tasdiq turini aytadi', () => {
  it.each([
    ['avtomatik', /AVTOMATIK tasdiqlandi/],
    ['admin', /admin tomonidan tasdiqlandi/],
    ['market', /market tomonidan tasdiqlandi/],
  ])('%s tasdiq alohida matn bilan yoziladi', (_name, re) => {
    expect(code).toMatch(re);
  });

  /**
   * ⚠️ Avtomatik tasdiq matni SABABINI ham aytishi kerak. «Avtomatik
   * tasdiqlandi» o'zi yetarli emas — kuryer ham, market ham NEGA
   * shunday bo'lganini bilishi kerak.
   */
  it('avtomatik tasdiq sababini ham yozadi', () => {
    expect(code).toMatch(/AVTOMATIK tasdiqlandi \(market javob bermadi\)/);
  });

  /**
   * ⚠️ IZOH `applyAtomic` GA UZATILISHI SHART. Yorliq hisoblanib,
   * lekin kassaga uzatilmasa — hech narsa o'zgarmaydi.
   */
  it('yorliq kassa yozuviga uzatiladi', () => {
    const idx = code.indexOf('applyAtomic');
    expect(idx).toBeGreaterThan(-1);
    expect(code.slice(idx, idx + 600)).toContain('approvalLabel');
  });

  /**
   * `auto_backstop` holatida so'rovga ham izoh yoziladi — kuryer
   * ekranida ko'rsatiladigan matn aynan shu.
   */
  it('avtomatik tasdiqda so‘rovga review_note yoziladi', () => {
    expect(code).toMatch(/review_note:[\s\S]{0,120}avtomatik tasdiqlandi/);
  });
});
