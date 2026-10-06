import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * TARJIMA TO'LIQLIGI — QULFLANGAN.
 *
 * ⚠️ NEGA KERAK. i18next yetishmagan kalit uchun KALIT NOMINI ko'rsatadi
 * (`marketTitle` deb chiqadi) — xato bermaydi, jimgina buziladi. Shuning
 * uchun uz/ru/en o'rtasidagi farqni faqat test ushlaydi.
 *
 * Loyihada bu nomuvofiqlik allaqachon bo'lgan (masalan `status.json` da
 * `created` kaliti yo'q edi), shu sabab tekshiruv BARCHA namespace'ga
 * qo'llanadi — faqat yangi sahifaga emas.
 */
const LOCALES_DIR = join(process.cwd(), "public", "locales");

const languages = readdirSync(LOCALES_DIR).filter((d) => !d.startsWith("."));
/** `uz` — `fallbackLng` (i18n.ts), ya'ni kalit to'plamining ETALONI. */
const BASE = "uz";

type Json = Record<string, unknown>;

const read = (lng: string, ns: string): Json =>
  JSON.parse(readFileSync(join(LOCALES_DIR, lng, ns), "utf8")) as Json;

/** Ichma-ich obyektlarni `a.b.c` ko'rinishiga yoyadi. */
const flatten = (obj: Json, prefix = ""): string[] =>
  Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v as Json, key)
      : [key];
  });

describe("i18n — tarjima fayllari", () => {
  it("uchala til mavjud", () => {
    expect(languages.sort()).toEqual(["en", "ru", "uz"]);
  });

  const baseFiles = readdirSync(join(LOCALES_DIR, BASE))
    .filter((f) => f.endsWith(".json"))
    .sort();

  it("namespace fayllari barcha tilda bir xil", () => {
    for (const lng of languages) {
      const files = readdirSync(join(LOCALES_DIR, lng))
        .filter((f) => f.endsWith(".json"))
        .sort();
      expect(files, `${lng} da namespace fayllari farq qiladi`).toEqual(
        baseFiles,
      );
    }
  });

  it.each(baseFiles)("%s — kalitlar uchala tilda to'liq", (ns) => {
    const base = flatten(read(BASE, ns)).sort();
    for (const lng of languages.filter((l) => l !== BASE)) {
      const other = flatten(read(lng, ns)).sort();
      const missing = base.filter((k) => !other.includes(k));
      const extra = other.filter((k) => !base.includes(k));
      expect(missing, `${lng}/${ns} da YETISHMAYDI`).toEqual([]);
      expect(extra, `${lng}/${ns} da ORTIQCHA (uz da yo'q)`).toEqual([]);
    }
  });

  it.each(baseFiles)("%s — bo'sh qiymat yo'q", (ns) => {
    for (const lng of languages) {
      const data = read(lng, ns);
      const empties = flatten(data).filter((key) => {
        const value = key
          .split(".")
          .reduce<unknown>(
            (acc, part) => (acc as Json | undefined)?.[part],
            data,
          );
        return typeof value === "string" && value.trim() === "";
      });
      expect(empties, `${lng}/${ns} da bo'sh matn`).toEqual([]);
    }
  });

  it("bekor-qaytarish namespace'i mavjud va to'liq", () => {
    // Yangi tab uchun maxsus tekshiruv: fayl yaratilmay qolsa yoki bir tilda
    // yangilanmasa, ekranlar kalit nomini ko'rsatib qo'yadi.
    for (const lng of languages) {
      const data = read(lng, "marketReturns.json");
      expect(Object.keys(data).length, `${lng} marketReturns`).toBeGreaterThan(
        50,
      );
      expect(data.marketTitle).toBeTruthy();
      expect(data.consentCta).toBeTruthy();
      expect(data.handoverTitle).toBeTruthy();
    }
  });

  it("bosqich yorliqlari `status` namespace'ida barcha tilda bor", () => {
    // `returnStage.ts` AYNAN shu kalitlarni qaytaradi.
    const required = [
      "returnStageCourier",
      "returnStageCenter",
      "returnStageMarket",
      "returnStageCourierHint",
      "returnStageCenterHint",
      "returnStageMarketHint",
      // Bazadagi HAQIQIY status qiymati (`cancelled_sent` emas).
      "cancelled (sent)",
      "created",
    ];
    for (const lng of languages) {
      const data = read(lng, "status.json");
      for (const key of required) {
        expect(data[key], `${lng}/status.json → ${key}`).toBeTruthy();
      }
    }
  });
});

/**
 * ⚠️ KOD BILAN TARJIMA MOSLIGI.
 *
 * Yuqoridagi testlar fayllar o'zaro to'liqligini tekshiradi, LEKIN kodda
 * yozilgan kalit xato bo'lsa (`t("marketTitl")`) ularning hech biri
 * ushlamaydi — ekranda shunchaki kalit nomi chiqadi. Shu sabab yangi
 * tabning MANBA fayllaridagi har bir `t("…")` kaliti namespace'da bor-yo'qligi
 * tekshiriladi.
 */
describe("i18n — koddagi kalitlar namespace'da bor", () => {
  const files = [
    "src/pages/market-returns/index.tsx",
    "src/pages/market-returns/ConsentModal.tsx",
    "src/pages/mails/pages/superadmin/awaiting-market/index.tsx",
    "src/pages/mails/pages/superadmin/awaiting-market/HandoverSession.tsx",
    // Topshirilganlar tarixi (partiya ro'yxati va partiya ichi).
    "src/pages/handovers/index.tsx",
    "src/pages/handovers/BatchList.tsx",
    "src/pages/handovers/BatchDetail.tsx",
  ];

  const marketReturns = read(BASE, "marketReturns.json");

  it.each(files)("%s — barcha t() kaliti mavjud", (rel) => {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    // `t("kalit")` va `t("kalit", { … })` shakllari.
    const keys = [...src.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(keys.length, `${rel} da t() chaqirig'i yo'q`).toBeGreaterThan(0);

    const missing = keys.filter((k) => !(k in marketReturns));
    expect(missing, `${rel} — marketReturns.json da yo'q`).toEqual([]);
  });

  /**
   * Kalit `t("…")` dan tashqari XARITA orqali ham ishlatiladi: qo'lda
   * topshirish sabablari server qiymati bo'lgani uchun tarjima qilinmaydi,
   * faqat yorlig'i — `MANUAL_OVERRIDE_REASON_KEYS` xaritasi bilan. Shu
   * fayldagi xom satr kalitlari ham "ishlatilgan" hisoblanadi.
   */
  const indirect = ["src/shared/api/hooks/useMarketHandover/index.ts"];

  it("namespace'da ISHLATILMAYDIGAN kalit qolmadi", () => {
    const used = new Set<string>();
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) used.add(m[1]);
    }
    for (const rel of indirect) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      for (const m of src.matchAll(/"([A-Za-z][A-Za-z0-9_]*)"/g)) {
        if (m[1] in marketReturns) used.add(m[1]);
      }
    }
    const unused = Object.keys(marketReturns).filter((k) => !used.has(k));
    // O'lik kalitlar tarjimonni bekorga ishlatadi va fayl o'sib boradi.
    expect(unused, "marketReturns.json da o'lik kalitlar").toEqual([]);
  });
});

/**
 * ⚠️ QO'LDA TOPSHIRISH SABABLARI — QIYMAT ≠ YORLIQ.
 *
 * Sabab matni serverga AYNAN ketadi (`@IsIn` tekshiradi), shuning uchun
 * qiymatni tarjima qilish MUMKIN EMAS — faqat ko'rinadigan yorliq
 * tarjima qilinadi. Agar yopiq ro'yxatga yangi sabab qo'shilsa va kalit
 * yozilmasa, Select'da KALIT NOMI chiqardi — shu test ushlaydi.
 */
describe("i18n — qo'lda topshirish sabablari", () => {
  it("har sabab qiymati uchun kalit bor va uchala tilda tarjimasi bor", async () => {
    const { MANUAL_OVERRIDE_REASONS, MANUAL_OVERRIDE_REASON_KEYS } =
      await import("../shared/api/hooks/useMarketHandover");

    for (const reason of MANUAL_OVERRIDE_REASONS) {
      const key = MANUAL_OVERRIDE_REASON_KEYS[reason];
      expect(key, `"${reason}" uchun kalit yo'q`).toBeTruthy();
      for (const lng of languages) {
        const data = read(lng, "marketReturns.json");
        expect(data[key], `${lng}/marketReturns.json → ${key}`).toBeTruthy();
      }
    }
  });

  it("xaritada ORTIQCHA kalit yo'q (yopiq ro'yxatdan chiqib ketmagan)", async () => {
    const { MANUAL_OVERRIDE_REASONS, MANUAL_OVERRIDE_REASON_KEYS } =
      await import("../shared/api/hooks/useMarketHandover");
    expect(Object.keys(MANUAL_OVERRIDE_REASON_KEYS).sort()).toEqual(
      [...MANUAL_OVERRIDE_REASONS].sort(),
    );
  });
});

/**
 * ⚠️ YON MENYU YORLIQLARI.
 *
 * Menyu nomlari oldin to'g'ridan-to'g'ri o'zbekcha yozilgan edi («Market
 * kutilmoqda», «AI balans»…) — ruscha interfeysda ham o'zbekcha turardi.
 * Endi kalitga o'tkazildi; qaytib qotib qolmasligi uchun HAR BIR menyu
 * faylining `t("…")` kaliti o'z namespace'ida uchala tilda tekshiriladi.
 *
 * Namespace fayldan O'QILADI (`useTranslation(["sidebar"])`) — chunki
 * `InvestorSidebar` `investor` ns dan foydalanadi, `sidebar` dan emas.
 */
describe("i18n — menyu yorliqlari kalitga bog'langan", () => {
  const LAYOUT_DIR = join(process.cwd(), "src", "layout", "components");
  const layoutFiles = readdirSync(LAYOUT_DIR).filter((f) => f.endsWith(".tsx"));

  it.each(layoutFiles)("%s — kalitlari uchala tilda bor", (name) => {
    const raw = readFileSync(join(LAYOUT_DIR, name), "utf8");
    const nsMatch = raw.match(/useTranslation\(\s*\[?\s*["']([^"']+)["']/);
    if (!nsMatch) return; // tarjima ishlatmaydigan fayl

    // Izohga olingan satrlar hisobga olinmaydi (o'chirilgan menyu bandlari).
    const src = raw
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");

    const keys = [...src.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const lng of languages) {
      const data = flatten(read(lng, `${nsMatch[1]}.json`));
      const missing = keys.filter((k) => !data.includes(k));
      expect(missing, `${lng}/${nsMatch[1]}.json — ${name}`).toEqual([]);
    }
  });

  it("menyuda qotib qolgan o'zbekcha yorliq yo'q", () => {
    // `label:` doim `t(...)` bo'lishi kerak — xom satr bo'lsa tarjima yo'q.
    for (const name of layoutFiles) {
      const src = readFileSync(join(LAYOUT_DIR, name), "utf8");
      // Til tanlagich yorliqlari ATAYLAB tarjima qilinmaydi: "Ру" har
      // qanday interfeysda "Ру" bo'lib qolishi kerak, aks holda rus tilini
      // tanlashni istagan odam o'z tilini ro'yxatda topa olmaydi.
      const LANGUAGE_LABELS = ["Uz", "Ру", "En"];
      const hard = [...src.matchAll(/label:\s*"([^"]+)"/g)]
        .map((m) => m[1])
        .filter((l) => !LANGUAGE_LABELS.includes(l));
      expect(hard, `${name} da xom yorliq`).toEqual([]);
    }
  });
});
