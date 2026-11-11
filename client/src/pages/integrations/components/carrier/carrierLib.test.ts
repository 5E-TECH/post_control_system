import { describe, expect, it } from "vitest";
import type { CarrierAccount } from "../../../../shared/api/hooks/useCarrierAccounts";
import {
  accountState,
  activityDiff,
  apiPath,
  carrierApiBase,
  courierBlockReason,
  courierOptions,
  editPatch,
  errText,
  ipKind,
  parseIpLines,
  timeAgo,
  unwrapCourierList,
} from "./carrierLib";

const account = (over: Partial<CarrierAccount> = {}): CarrierAccount => ({
  id: "a-1",
  name: "FastPost Logistics",
  courier_user_id: "c-1",
  courier: { id: "c-1", name: "[Carrier] FastPost", phone_number: "+998901234567", status: "active" },
  api_key_masked: "bpc_…a1b2",
  ip_allowlist: null,
  is_active: true,
  last_used_at: null,
  created_at: 1_762_000_000_000,
  updated_at: 1_762_000_000_000,
  ...over,
});

describe("carrierLib", () => {
  describe("accountState — ro'yxatdagi holat", () => {
    it("to'xtatilgan akkaunt kuryer holatidan ustun", () => {
      expect(
        accountState(
          account({
            is_active: false,
            courier: { id: "c-1", name: "x", phone_number: "", status: "inactive" },
          }),
        ),
      ).toBe("stopped");
    });

    it("faol akkaunt + bloklangan kuryer → «Kuryer bloklangan»", () => {
      expect(
        accountState(
          account({ courier: { id: "c-1", name: "x", phone_number: "", status: "inactive" } }),
        ),
      ).toBe("courier_blocked");
    });

    it("faol akkaunt + faol kuryer → faol", () => {
      expect(accountState(account())).toBe("active");
    });
  });

  describe("parseIpLines — har qatorda bitta yozuv", () => {
    it("bo'sh qatorlar va chetdagi bo'shliqlar tashlanadi, MA'NO tekshirilmaydi", () => {
      expect(parseIpLines(" 203.0.113.10 \r\n\n2001:db8::/48\n  \n")).toEqual([
        "203.0.113.10",
        // Noto'g'ri yozuv ham yuboriladi — uni server rad etadi (400 matni toast'da).
        "2001:db8::/48",
      ]);
    });

    it("undefined/null — bo'sh ro'yxat", () => {
      expect(parseIpLines(undefined)).toEqual([]);
      expect(parseIpLines(null)).toEqual([]);
    });
  });

  it("ipKind — kanonik shakl bo'yicha", () => {
    expect(ipKind("203.0.113.10")).toBe("IPv4");
    expect(ipKind("198.51.100.0/24")).toBe("IPv4 diapazon");
    expect(ipKind("2001:db8::25")).toBe("IPv6");
  });

  describe("kuryer tanlash — faqat frontend biladigan sabablar", () => {
    const accounts = [{ name: "FastPost Logistics", courier_user_id: "bound" }];

    it("allaqachon bog'langan kuryer — akkaunt nomi bilan", () => {
      expect(courierBlockReason({ id: "bound" }, accounts)).toBe(
        "«FastPost Logistics» carrier akkauntiga bog'langan",
      );
    });

    it("kassasi 0 emas — balance, balance_cash yoki balance_card", () => {
      expect(courierBlockReason({ id: "x", cashbox: { balance: 350000 } }, accounts)).toBe(
        `Kassasi 0 emas: ${(350000).toLocaleString("ru-RU")} so'm`,
      );
      expect(
        courierBlockReason({ id: "x", cashbox: { balance: 0, balance_cash: "0", balance_card: -1500 } }, accounts),
      ).toMatch(/^Kassasi 0 emas: /);
    });

    it("kassasi nol yoki yo'q — tanlasa bo'ladi (qolganini server tekshiradi)", () => {
      expect(
        courierBlockReason({ id: "x", cashbox: { balance: 0, balance_cash: 0, balance_card: "0" } }, accounts),
      ).toBeNull();
      expect(courierBlockReason({ id: "x", cashbox: null }, accounts)).toBeNull();
    });

    it("tanlab bo'lmaydiganlar ro'yxat oxirida, sababi bilan", () => {
      const opts = courierOptions(
        [
          { id: "bound", name: "A", phone_number: "1" },
          { id: "ok", name: "B", phone_number: "2" },
          { id: "cash", name: "C", phone_number: "3", cashbox: { balance: 10 } },
        ],
        accounts,
      );
      expect(opts.map((o) => [o.value, o.disabled])).toEqual([
        ["ok", false],
        ["bound", true],
        ["cash", true],
      ]);
      expect(opts[0].label).toBe("B — 2");
    });

    it("javob qobig'i ochiladi", () => {
      expect(unwrapCourierList({ data: { data: [{ id: "1" }] } })).toEqual([{ id: "1" }]);
      expect(unwrapCourierList({ data: [{ id: "2" }] })).toEqual([{ id: "2" }]);
      expect(unwrapCourierList(undefined)).toEqual([]);
    });
  });

  describe("activityDiff — akkaunt tarixi", () => {
    it("holat o'zgarishi", () => {
      expect(
        activityDiff({ old_value: { is_active: true }, new_value: { is_active: false } }),
      ).toBe("is_active: true → false");
    });

    it("IP ro'yxati — soni va qo'shilgan/olib tashlangan yozuvlar", () => {
      expect(
        activityDiff({
          old_value: { ip_allowlist: ["203.0.113.10", "198.51.100.0/24"] },
          new_value: { ip_allowlist: ["203.0.113.10", "198.51.100.0/24", "2001:db8::25"] },
        }),
      ).toBe("ip_allowlist: 2 ta → 3 ta qoida (+ 2001:db8::25)");
      expect(
        activityDiff({ old_value: { ip_allowlist: ["1.1.1.1"] }, new_value: { ip_allowlist: null } }),
      ).toBe("ip_allowlist: 1 ta → 0 ta qoida (− 1.1.1.1)");
    });

    it("yaratish va kalit yangilashda farq yo'q (eski qiymat yo'q)", () => {
      expect(activityDiff({ old_value: null, new_value: { key_rotated: true } })).toBeNull();
    });
  });

  it("errText — server matni aynan, bo'lmasa zaxira", () => {
    expect(errText({ response: { data: { message: "Kuryer faol emas (bloklangan)" } } }, "x")).toBe(
      "Kuryer faol emas (bloklangan)",
    );
    expect(errText({ response: { data: { message: ["a", "b"] } } }, "x")).toBe("a. b");
    expect(errText(new Error("Network Error"), "zaxira")).toBe("zaxira");
  });

  it("carrierApiBase — nisbiy VITE_BASE_URL joriy domen bilan to'ldiriladi", () => {
    expect(carrierApiBase("/api/v1/", "https://beepost.uz")).toBe("https://beepost.uz/api/v1");
    expect(carrierApiBase("https://api.beepost.uz/api/v1/", "https://x.uz")).toBe(
      "https://api.beepost.uz/api/v1",
    );
    expect(apiPath("https://beepost.uz/api/v1")).toBe("/api/v1");
  });

  it("timeAgo", () => {
    const now = 1_762_000_000_000;
    expect(timeAgo(now - 20_000, now)).toBe("hozirgina");
    expect(timeAgo(now - 2 * 60_000, now)).toBe("2 daqiqa oldin");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 soat oldin");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2 kun oldin");
  });

  it("editPatch — faqat o'zgargan maydonlar, o'zgarishsiz — null", () => {
    const before = account({ ip_allowlist: ["203.0.113.10", "198.51.100.0/24"] });
    const ips = "203.0.113.10\n198.51.100.0/24";

    expect(editPatch(before, { name: " FastPost Logistics ", ip_allowlist: `\n${ips}\n` })).toBeNull();
    expect(editPatch(before, { name: "FastPost LLC", ip_allowlist: ips })).toEqual({
      name: "FastPost LLC",
    });
    // Bo'shatilsa — [] (server cheklovni olib tashlaydi).
    expect(editPatch(before, { name: "FastPost Logistics", ip_allowlist: "" })).toEqual({
      ip_allowlist: [],
    });
    // Tartib muhim (server `sameList` kabi).
    expect(
      editPatch(before, { name: "FastPost Logistics", ip_allowlist: "198.51.100.0/24\n203.0.113.10" }),
    ).toEqual({ ip_allowlist: ["198.51.100.0/24", "203.0.113.10"] });
    // Cheklovsiz akkauntda bo'sh maydon — o'zgarish emas.
    expect(editPatch(account(), { name: "FastPost Logistics" })).toBeNull();
  });
});
