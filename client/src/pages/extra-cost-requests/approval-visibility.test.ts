import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * KURYER «QANDAY TASDIQLANDI» NI KO'RADI — REGRESSIYA QULFI.
 *
 * ⚠️ NEGA BU TEST BOR. Kuryer ekranida izoh (`review_note`) AVVAL
 * faqat `status === "rejected"` holatida ko'rsatilardi. Natijada
 * market 14 kun javob bermagani uchun AVTOMATIK tasdiqlangan xarajat
 * kuryerga oddiy «tasdiqlandi» bo'lib ko'rinardi — u market ko'rib
 * tasdiqladi deb o'ylardi va nega ikki hafta kutganini bilmasdi.
 *
 * Test komponentni ishlatmaydi, manbani o'qiydi: bu shart bitta
 * qatorda yashaydi va olib tashlansa `tsc` ham, boshqa testlar ham
 * sezmaydi — nuqson faqat ekranda, jim.
 */
const PAGE = path.resolve(__dirname, "courier/index.tsx");
const src = fs.readFileSync(PAGE, "utf8");

/** Izohlarni tashlaydi — test matnni emas, KODNI tekshiradi. */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

describe("kuryer ekrani tasdiq turini ko'rsatadi", () => {
  it("avtomatik tasdiq alohida ko'rsatiladi", () => {
    expect(code).toContain('r.decision_mode === "auto_backstop"');
  });

  it("admin tasdig'i ham alohida ko'rsatiladi", () => {
    expect(code).toContain('r.decision_mode === "admin_override"');
  });

  /**
   * ⚠️ `review_note` BO'SH bo'lsa ham xabar chiqishi kerak: eski
   * yozuvlarda izoh yo'q, lekin `decision_mode` bor — kuryer baribir
   * nega avtomatik o'tganini bilishi kerak.
   */
  it("izoh bo'sh bo'lsa ham zaxira matn bor", () => {
    expect(code).toMatch(/review_note \|\|[\s\S]{0,120}avtomatik tasdiqlandi/);
  });

  /** Rad etish sababi ham joyida qolgan. */
  it("rad etish sababi ham ko'rsatiladi", () => {
    expect(code).toContain('r.status === "rejected" && r.review_note');
  });
});
