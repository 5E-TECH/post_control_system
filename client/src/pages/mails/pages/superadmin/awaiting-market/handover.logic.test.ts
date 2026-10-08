import { describe, expect, it } from "vitest";
import {
  buildManualOverrides,
  canHandOverManual,
  isValidManualReason,
  missingReasonIds,
} from "./handover.logic";
import { MANUAL_OVERRIDE_REASONS } from "../../../../../shared/api/hooks/useMarketHandover";

const REASON = MANUAL_OVERRIDE_REASONS[0];

describe("qo'lda belgilash qoidasi — sabab MAJBURIY", () => {
  it("qo'lda belgilangan posilka SABABSIZ o'tmaydi", () => {
    expect(missingReasonIds(["b"], {})).toEqual(["b"]);
  });

  it("sabab tanlangach o'tadi", () => {
    expect(missingReasonIds(["b"], { b: REASON })).toEqual([]);
  });

  it("bir nechtasidan faqat sababsizlari qoladi", () => {
    expect(missingReasonIds(["a", "b", "c"], { a: REASON, c: REASON })).toEqual([
      "b",
    ]);
  });
});

describe("sabab — YOPIQ ro'yxat (backend @IsIn bilan bir xil)", () => {
  it("ro'yxatdagi qiymat qabul qilinadi", () => {
    for (const r of MANUAL_OVERRIDE_REASONS) {
      expect(isValidManualReason(r)).toBe(true);
    }
  });

  it("erkin matn QABUL QILINMAYDI", () => {
    expect(isValidManualReason("qr yo'q edi")).toBe(false);
    expect(isValidManualReason("")).toBe(false);
    expect(isValidManualReason(undefined)).toBe(false);
  });

  it("TARJIMA qilingan yorliq rad etiladi (backend 422 beradi)", () => {
    // Elchi'da aynan shu tuzoq bor: client tarjimani yuborib 400 olardi.
    expect(isValidManualReason("QR торн")).toBe(false);
    expect(isValidManualReason("QR torn")).toBe(false);
  });

  it("yukka FAQAT yaroqli sabablar tushadi", () => {
    expect(
      buildManualOverrides(["a", "b"], { a: REASON, b: "erkin matn" }),
    ).toEqual([{ order_id: "a", reason: REASON }]);
  });

  it("yukdagi sabab AYNAN backend qiymati (tarjima emas)", () => {
    const payload = buildManualOverrides(["a"], { a: REASON });
    expect(payload[0].reason).toBe(REASON);
    expect(MANUAL_OVERRIDE_REASONS).toContain(payload[0].reason);
  });
});

/**
 * ⚠️ SKAN = TOPSHIRISH (2026-10-07 qarori).
 *
 * Avval skanerlangani to'planib, oxirida «Marketga topshirish (N)»
 * bosilardi. Bu ortiqcha qadam va XATOGA joy edi: xodim tugmani
 * bosmasdan chiqib ketsa yoki ruxsat oynasi tugasa, o'nlab skan
 * bekorga ketardi. Endi har skan o'zi topshiradi, QO'LDA belgilangan
 * qator esa O'Z sababi bilan ALOHIDA tasdiqlanadi.
 */
describe("canHandOverManual — qo'lda topshirish darvozasi", () => {
  it("ruxsat bor va sabab YOPIQ ro'yxatdan bo'lsa — ha", () => {
    expect(
      canHandOverManual({ authorized: true, reason: REASON }),
    ).toBe(true);
  });

  it("sabab yo'q bo'lsa — yo'q", () => {
    expect(canHandOverManual({ authorized: true, reason: undefined })).toBe(
      false,
    );
    expect(canHandOverManual({ authorized: true, reason: "" })).toBe(false);
  });

  it("YOPIQ ro'yxatdan TASHQARI sabab — yo'q (server 422 berardi)", () => {
    expect(
      canHandOverManual({ authorized: true, reason: "o'zim yozdim" }),
    ).toBe(false);
    // Tarjima qilingan yorliq ham RAD etiladi — server `@IsIn` qiymatni
    // kutadi, yorliqni emas.
    expect(canHandOverManual({ authorized: true, reason: "QR torn" })).toBe(
      false,
    );
  });

  it("ruxsat yo'q bo'lsa sabab to'g'ri bo'lsa ham — yo'q", () => {
    expect(canHandOverManual({ authorized: false, reason: REASON })).toBe(
      false,
    );
  });
});
