import { describe, expect, it } from "vitest";
import {
  buildManualOverrides,
  canSubmitBatch,
  isValidManualReason,
  manualSelection,
  missingReasonIds,
} from "./handover.logic";
import { MANUAL_OVERRIDE_REASONS } from "../../../../../shared/api/hooks/useMarketHandover";

const REASON = MANUAL_OVERRIDE_REASONS[0];

describe("topshirish tanlovi — qo'lda belgilash qoidasi", () => {
  it("skanerlangan posilka qo'lda belgilangan deb sanalmaydi", () => {
    expect(manualSelection(["a", "b"], new Set(["a", "b"]))).toEqual([]);
  });

  it("skanerlanmagan (qo'lda bosilgan) posilka ajratiladi", () => {
    expect(manualSelection(["a", "b", "c"], new Set(["a"]))).toEqual([
      "b",
      "c",
    ]);
  });

  it("qo'lda belgilangan posilka SABABSIZ o'tmaydi", () => {
    expect(missingReasonIds(["b"], {})).toEqual(["b"]);
    expect(
      canSubmitBatch({
        authorized: true,
        selectedIds: ["a", "b"],
        scannedIds: new Set(["a"]),
        reasons: {},
      }),
    ).toBe(false);
  });

  it("sabab tanlangach o'tadi", () => {
    expect(missingReasonIds(["b"], { b: REASON })).toEqual([]);
    expect(
      canSubmitBatch({
        authorized: true,
        selectedIds: ["a", "b"],
        scannedIds: new Set(["a"]),
        reasons: { b: REASON },
      }),
    ).toBe(true);
  });

  it("RUXSATSIZ topshirib bo'lmaydi (hammasi skanerlangan bo'lsa ham)", () => {
    expect(
      canSubmitBatch({
        authorized: false,
        selectedIds: ["a"],
        scannedIds: new Set(["a"]),
        reasons: {},
      }),
    ).toBe(false);
  });

  it("hech narsa tanlanmasa topshirish faol bo'lmaydi", () => {
    expect(
      canSubmitBatch({
        authorized: true,
        selectedIds: [],
        scannedIds: new Set(),
        reasons: {},
      }),
    ).toBe(false);
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
