import { describe, expect, it } from "vitest";
import {
  formatMoment,
  resolveReturnStage,
  returnStageDisplay,
} from "./returnStage";

/**
 * ⚠️ Bu yorliq foydalanuvchi e'tirozidan tug'ildi: markazga qabul qilingan
 * posilkaning statusi `cancelled (sent)` da qolardi va ekranda «Bekor
 * (yuborilgan)» — ya'ni YO'LDA — deb turardi. "Kuryerdan olganimizni
 * qayerdan bilamiz?" degan savolning javobi shu yerda hisoblanadi, shuning
 * uchun mantiq test bilan qulflangan.
 */
describe("resolveReturnStage", () => {
  it("kuryerda: pochtaga topshirilgan, markaz qabul qilmagan", () => {
    expect(resolveReturnStage({ status: "cancelled (sent)" })).toBe("courier");
  });

  it("markazda: center_received_at bor", () => {
    expect(
      resolveReturnStage({
        status: "cancelled (sent)",
        center_received_at: 1_760_000_000_000,
      }),
    ).toBe("center");
  });

  it("marketda: market_handover_at bor", () => {
    expect(
      resolveReturnStage({
        status: "closed",
        center_received_at: 1,
        market_handover_at: 2,
      }),
    ).toBe("market");
  });

  it("server bergan return_stage ustun turadi", () => {
    expect(
      resolveReturnStage({ status: "cancelled (sent)", return_stage: "center" }),
    ).toBe("center");
  });

  it("noto'g'ri return_stage qiymati e'tiborga olinmaydi (zaxira ishlaydi)", () => {
    expect(
      resolveReturnStage({
        status: "cancelled (sent)",
        return_stage: "allaqanday",
        center_received_at: 5,
      }),
    ).toBe("center");
  });

  it("ALMASHTIRISH qatori: statusi SOTILGAN, lekin dalil bo'yicha markazda", () => {
    expect(
      resolveReturnStage({ status: "sold", center_received_at: 7 }),
    ).toBe("center");
  });

  it("LEGACY: dalilsiz closed ham 'marketda' deb ko'rsatiladi", () => {
    expect(resolveReturnStage({ status: "closed" })).toBe("market");
  });

  it("zanjirda emas: oddiy statuslar", () => {
    for (const status of ["new", "received", "on the road", "waiting", "sold", "paid"]) {
      expect(resolveReturnStage({ status })).toBeNull();
    }
    // `cancelled` — kuryerda, LEKIN hali pochtaga topshirilmagan: zanjir
    // boshlanmagan, shuning uchun mavjud «Bekor qilingan» yorlig'i qoladi.
    expect(resolveReturnStage({ status: "cancelled" })).toBeNull();
  });

  it("bo'sh qiymatlarda yiqilmaydi", () => {
    expect(resolveReturnStage(null)).toBeNull();
    expect(resolveReturnStage(undefined)).toBeNull();
    expect(resolveReturnStage({})).toBeNull();
  });

  it("bigint SATR bo'lib kelsa ham ishlaydi", () => {
    expect(
      resolveReturnStage({
        status: "cancelled (sent)",
        center_received_at: "1760000000000",
      }),
    ).toBe("center");
  });
});

describe("returnStageDisplay — yorliq matni", () => {
  it("markazda yorlig'i «kuryerdan olindi» ni AYTADI", () => {
    const badge = returnStageDisplay({
      status: "cancelled (sent)",
      center_received_at: 1,
    });
    expect(badge?.label).toBe("Markazda");
    // Savolning javobi hover izohida ham bo'lishi kerak.
    expect(badge?.title).toContain("Kuryerdan olindi");
  });

  it("kuryerda yorlig'i «yo'lda» ma'nosini beradi", () => {
    expect(returnStageDisplay({ status: "cancelled (sent)" })?.label).toBe(
      "Kuryerda",
    );
  });

  it("topshirilgani aniq aytiladi", () => {
    expect(
      returnStageDisplay({ status: "closed", market_handover_at: 1 })?.label,
    ).toBe("Marketga topshirildi");
  });

  it("zanjirda bo'lmagan buyurtma uchun null (mavjud yorliq ishlatiladi)", () => {
    expect(returnStageDisplay({ status: "waiting" })).toBeNull();
  });

  it("rang sinflari LITERAL (Tailwind shablondan sinf yasamaydi)", () => {
    const badge = returnStageDisplay({
      status: "cancelled (sent)",
      center_received_at: 1,
    });
    expect(badge?.tone).toContain("bg-sky-100");
    expect(badge?.tone).not.toContain("${");
  });
});

describe("formatMoment", () => {
  it("bo'sh qiymat uchun chiziqcha", () => {
    expect(formatMoment(null)).toBe("—");
    expect(formatMoment(undefined)).toBe("—");
    expect(formatMoment(0)).toBe("—");
  });

  /**
   * ⚠️ AJRATGICHGA BOG'LANMAYMIZ. Node'ning ICH ma'lumotlarida `uz-UZ`
   * bo'lmasa `toLocaleString` boshqa ajratgich beradi (CI'da `09/10/2025`,
   * brauzerda `09.10.2025`). Test faqat MA'NONI tekshiradi: sana va vaqt
   * chiqdi va "—" emas.
   */
  it("epoch-ms ni sana-vaqtga aylantiradi", () => {
    const out = formatMoment(1_760_000_000_000);
    expect(out).not.toBe("—");
    expect(out).toMatch(/2025/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });

  it("satr bo'lib kelgan bigint ham ishlaydi", () => {
    expect(formatMoment("1760000000000")).toBe(
      formatMoment(1_760_000_000_000),
    );
  });

  it("son bo'lmagan qiymatda chiziqcha", () => {
    expect(formatMoment("allaqanday")).toBe("—");
  });
});
