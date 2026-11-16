import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * MENYU PARITETI — REGRESSIYA QULFI.
 *
 * ⚠️ NEGA BU TEST BOR. Loyihada IKKITA admin menyusi bor va ular
 * `DashboardLayout.tsx` da ROL bo'yicha tanlanadi:
 *
 *     superadmin → Sidebar.tsx
 *     admin      → AdminSidebar.tsx
 *
 * Nomlari buni ochiq aytmaydi: «Sidebar» umumiy ko'rinadi, aslida u
 * FAQAT superadmin uchun. Shu sabab yangi sahifa odatda bittasiga
 * qo'shiladi-yu, ikkinchisi esdan chiqadi — va nuqson JIM: `tsc` ham,
 * boshqa testlar ham ko'rmaydi, sahifa route orqali ochiladi, faqat
 * MENYUDA yo'q. Aynan shu «Shtraflar» bilan sodir bo'ldi: admin
 * ko'rardi, superadmin ko'rmasdi.
 *
 * Shuning uchun: superadmin+admin ga ochiq har bir sahifa IKKALA
 * menyuda ham bo'lishi kerak.
 */
const LAYOUT = path.resolve(__dirname, "components");

const read = (f: string) =>
  fs.readFileSync(path.join(LAYOUT, f), "utf8");

/** `to: "/yo'l"` qiymatlarini ajratadi. */
function links(file: string): string[] {
  return [...read(file).matchAll(/to:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("superadmin va admin menyulari", () => {
  const superadmin = links("Sidebar.tsx");
  const admin = links("AdminSidebar.tsx");

  /**
   * Ikkala rol ham ko'rishi SHART bo'lgan sahifalar. Bu ro'yxat
   * `routes.tsx` da `RequireRole roles={["superadmin", "admin"]}`
   * bilan himoyalangan sahifalardan kelib chiqadi — ya'ni ruxsati bor,
   * demak menyusi ham bo'lishi kerak.
   */
  const MUST_BE_IN_BOTH = ["/courier-penalty"];

  it.each(MUST_BE_IN_BOTH)("%s superadmin menyusida bor", (route) => {
    expect(superadmin).toContain(route);
  });

  it.each(MUST_BE_IN_BOTH)("%s admin menyusida bor", (route) => {
    expect(admin).toContain(route);
  });

  /**
   * ⚠️ MA'LUM FARQLAR — ataylab ro'yxatga olingan.
   *
   * Bu ikki sahifa superadmin menyusida YO'Q va bu MENING ishim emas:
   * ular shu nuqson topilgunga qadar ham shunday edi. Ro'yxatga
   * olinmasa quyidagi test ularni ham ushlab, har ishda qizil chiroq
   * yoqib turardi. Ro'yxatga olinsa esa — ular ko'rinmay qolgani
   * YOZIB QO'YILGAN bo'ladi va kimdir qaror qabul qilishi mumkin.
   */
  const KNOWN_GAPS = ["/replacement-returns", "/marketplace-intake"];

  it("admin menyusidagi sahifa superadminda ham bor (ma'lum farqlardan tashqari)", () => {
    const missing = admin
      .filter((r) => !superadmin.includes(r))
      .filter((r) => !KNOWN_GAPS.includes(r));
    expect(missing).toEqual([]);
  });

  /**
   * Ma'lum farqlar HAQIQATAN mavjudligini ham tekshiramiz: agar kimdir
   * ularni qo'shsa, ro'yxatdan o'chirish kerak — aks holda ro'yxat
   * vaqt o'tib yolg'on bo'lib qoladi.
   */
  it("ma'lum farqlar ro'yxati eskirmagan", () => {
    const stillMissing = KNOWN_GAPS.filter((r) => !superadmin.includes(r));
    expect(stillMissing).toEqual(KNOWN_GAPS);
  });
});
