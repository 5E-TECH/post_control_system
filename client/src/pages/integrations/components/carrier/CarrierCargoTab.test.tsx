import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { CarrierAccount } from "../../../../shared/api/hooks/useCarrierAccounts";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../../shared/api", () => ({ api: apiMock }));

const { CarrierCargoTab } = await import("./CarrierCargoTab");

const KEY = "bpc_3f9a1c7e5b20d84f6a1e9c3b7d052f8e4a6c1b9d3e7f205a8c4e6b1d9f37c91f";
const NEW_KEY = "bpc_99999999999999999999999999999999999999999999999999999999999900aa";

const acc = (over: Partial<CarrierAccount>): CarrierAccount => ({
  id: "id",
  name: "name",
  courier_user_id: "c",
  courier: { id: "c", name: "courier", phone_number: "+998900000000", status: "active" },
  api_key_masked: "bpc_…0000",
  ip_allowlist: null,
  is_active: true,
  last_used_at: null,
  created_at: Date.UTC(2026, 10, 2, 6, 2),
  updated_at: Date.UTC(2026, 10, 10, 4, 15),
  ...over,
});

const FASTPOST = acc({
  id: "acc-fast",
  name: "FastPost Logistics",
  courier_user_id: "c-fast",
  courier: { id: "c-fast", name: "[Carrier] FastPost Logistics", phone_number: "+998901234567", status: "active" },
  api_key_masked: "bpc_…a1b2",
  ip_allowlist: ["203.0.113.10", "198.51.100.0/24", "2001:db8::25"],
  last_used_at: Date.UTC(2026, 10, 10, 9, 32, 5),
});
const KARVON = acc({
  id: "acc-karvon",
  name: "Karvon Delivery",
  courier_user_id: "c-karvon",
  courier: { id: "c-karvon", name: "[Carrier] Karvon Delivery", phone_number: "+998712003344", status: "active" },
  api_key_masked: "bpc_…7f3c",
  is_active: false,
  last_used_at: Date.UTC(2026, 9, 28, 13, 47, 12),
});
const TEZKOR = acc({
  id: "acc-tezkor",
  name: "Tezkor Kargo",
  courier_user_id: "c-tezkor",
  courier: { id: "c-tezkor", name: "[Carrier] Tezkor Kargo", phone_number: "+998935551234", status: "inactive" },
  api_key_masked: "bpc_…09de",
  ip_allowlist: ["185.74.5.18"],
});
const IPAK = acc({
  id: "acc-ipak",
  name: "Ipak Yo'li Express",
  courier_user_id: "c-ipak",
  api_key_masked: "bpc_…5e80",
});

/** `GET /user/couriers` — faol kuryerlar, `cashbox` bilan. */
const COURIERS = [
  { id: "c-new", name: "[Carrier] Yo'ldosh Kargo", phone_number: "+998934107705", cashbox: { balance: 0, balance_cash: 0, balance_card: 0 } },
  { id: "c-bek", name: "Bekzod Yusupov", phone_number: "+998907772110", cashbox: null },
  { id: "c-fast", name: "[Carrier] FastPost Logistics", phone_number: "+998901234567", cashbox: { balance: 0 } },
  { id: "c-dil", name: "Dilshod Rahimov", phone_number: "+998998124560", cashbox: { balance: 350000, balance_cash: 350000, balance_card: 0 } },
];

const ok = (data: unknown, statusCode = 200) => ({ data: { statusCode, message: "ok", data } });
const serverError = (message: string, status = 400) => ({
  response: { status, data: { statusCode: status, message, error: message } },
});

let accounts: CarrierAccount[];
let activity: unknown[];
let couriers: typeof COURIERS;
/**
 * Sekin tarmoq: o'rnatilsa, `GET carrier-accounts` javobi shu promise'gacha
 * kutadi (ma'lumot so'rov kelgan paytdagi holat).
 */
let listGate: Promise<unknown> | null;

/** jsdom'da `navigator.clipboard` yo'q — test o'rnatgan stub keyingilarga o'tmasin. */
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const stubClipboard = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
};

beforeEach(() => {
  accounts = [FASTPOST, KARVON, TEZKOR, IPAK];
  activity = [];
  couriers = COURIERS;
  listGate = null;
  apiMock.get.mockImplementation((url: string) => {
    if (url === "carrier-accounts") {
      const res = ok(accounts);
      return listGate ? listGate.then(() => res) : Promise.resolve(res);
    }
    if (url === "user/couriers") return Promise.resolve(ok(couriers));
    if (url.startsWith("activity-log/CarrierAccount/"))
      return Promise.resolve(ok({ logs: activity, total: activity.length, page: 1, limit: 50 }));
    return Promise.reject(new Error(`kutilmagan GET ${url}`));
  });
});

afterEach(() => {
  vi.clearAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else delete (navigator as { clipboard?: unknown }).clipboard;
});

/**
 * ⚠️ `app/provider.tsx` dagi QueryClient bilan bir xil (retry'dan tashqari —
 * testlar tez): `staleTime` 2 daqiqa. Oddiy `new QueryClient()` da u 0 — kesh
 * hech qachon "yangi" bo'lmaydi va eskirgan kesh xatolari testda ko'rinmasdi.
 */
const appQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });

const renderPanel = (client: QueryClient = appQueryClient()) => {
  // ⚠️ `main.tsx` bilan bir xil — StrictMode: dev'dagi effektlarni
  // "o'chirib-yoqish" xatolari (masalan, forma qiymati yo'qolishi) shu yerda
  // ushlanadi.
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CarrierCargoTab />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
  return client;
};

/** Kesh ichida ochiq kalit bormi — query VA mutation keshi. */
const cacheHas = (client: QueryClient, key: string) =>
  JSON.stringify([
    client.getQueryCache().getAll().map((q) => q.state.data),
    client.getMutationCache().getAll().map((m) => m.state.data),
  ]).includes(key);

/**
 * ⚠️ TEZ SO'ROVLAR. `getByRole(..., { name })` antd sahifasida har chaqiruvda
 * ~0.5 s (har tugmaning nomini hisoblaydi) — testlar 5 s chegarasidan
 * chiqib ketardi. Shu bois matn bo'yicha topib, eng yaqin tugma/oynaga
 * chiqamiz: tekshiruv mazmuni o'zgarmaydi.
 */
const button = (text: string | RegExp, root: HTMLElement = document.body) => {
  const el = within(root)
    .getAllByText(text)
    .map((n) => n.closest("button"))
    .find(Boolean);
  if (!el) throw new Error(`tugma topilmadi: ${String(text)}`);
  return el as HTMLButtonElement;
};

const findButton = async (text: string | RegExp, root: HTMLElement = document.body) => {
  await within(root).findAllByText(text);
  return button(text, root);
};

/** Oyna (Modal yoki tasdiq) — sarlavhasi bo'yicha. */
const findDialog = async (title: string | RegExp) => {
  const [el] = await screen.findAllByText(title);
  const modal = el.closest(".ant-modal");
  if (!modal) throw new Error(`oyna topilmadi: ${String(title)}`);
  return modal as HTMLElement;
};

const queryDialog = (title: string) =>
  screen.queryAllByText(title)[0]?.closest(".ant-modal") ?? null;

const statusSwitch = () =>
  document.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Akkaunt holati"]');

/** Har `aria-describedby` id'si DOM'da bor element bo'lishi shart. */
const expectDescribedByResolves = (el: HTMLElement) => {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(document.getElementById(id), `#${id}`).not.toBeNull();
};

/** ProviderSubNav — yorliq ikki marta (keng/tor ekran), tugma bitta. */
const openSection = (label: string) => fireEvent.click(button(label));

/** Akkauntlar jadvalidagi kompaniya havolasi → shu akkauntning Sozlamalari. */
const openAccount = async (name: string) => {
  fireEvent.click(await findButton(name));
  await screen.findByText(/^Akkaunt (yoqilgan|to'xtatilgan)$/);
  expect(statusSwitch()).not.toBeNull();
};

describe("Carrier API paneli", () => {
  it("ro'yxat: holatlar backend maydonlaridan (to'xtatilgan, kuryer bloklangan, so'rov yo'q)", async () => {
    renderPanel();

    expect(await findButton("FastPost Logistics")).toBeInTheDocument();
    expect(screen.getByText("4 ta")).toBeInTheDocument();
    expect(screen.getByText("3 ta qoida")).toBeInTheDocument();
    expect(screen.getByText("To'xtatilgan")).toBeInTheDocument();
    expect(screen.getByText("Kuryer bloklangan")).toBeInTheDocument();
    expect(screen.getByText("so'rovlar 403 oladi")).toBeInTheDocument();
    expect(screen.getAllByText("Hali so'rov yo'q").length).toBeGreaterThan(0);
    // ≤900px kartochka ko'rinishi uchun har katakda yorliq.
    expect(screen.getByText("bpc_…a1b2").closest("td")).toHaveAttribute("data-cell", "Kalit");
    // Akkauntlar bo'limida akkaunt tanlagich yo'q.
    expect(document.querySelector(".ant-segmented")).toBeNull();
  });

  it("bo'sh holat: «Akkaunt yaratish» va ulanish tartibi", async () => {
    accounts = [];
    renderPanel();

    expect(await screen.findByText("Carrier akkauntlari hali yo'q")).toBeInTheDocument();
    expect(screen.getByText("Ulanish tartibi")).toBeInTheDocument();
    expect(button("Akkaunt yaratish")).toBeInTheDocument();
  });

  it("birinchi yuklash yiqilsa — xato va «Qayta urinish», sub-nav joyida", async () => {
    let fail = true;
    apiMock.get.mockImplementation((url: string) => {
      if (url === "carrier-accounts")
        return fail
          ? Promise.reject(serverError("Server vaqtincha ishlamayapti", 502))
          : Promise.resolve(ok(accounts));
      return Promise.reject(new Error(`kutilmagan GET ${url}`));
    });
    renderPanel();

    expect(await screen.findByText("Carrier akkauntlarini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Server vaqtincha ishlamayapti")).toBeInTheDocument();
    expect(button("Sozlamalar")).toBeInTheDocument();

    fail = false;
    fireEvent.click(button("Qayta urinish"));
    expect(await findButton("FastPost Logistics")).toBeInTheDocument();
    expect(screen.queryByText("Carrier akkauntlarini yuklab bo'lmadi")).toBeNull();
    expect(apiMock.get.mock.calls.filter(([u]) => u === "carrier-accounts")).toHaveLength(2);
  });

  describe("yaratish → kalit bir marta", () => {
    const openCreate = async () => {
      fireEvent.click(await findButton("Yangi akkaunt"));
      return findDialog("Yangi carrier akkaunt");
    };

    const openCourierPicker = async (dialog: HTMLElement) => {
      fireEvent.mouseDown(dialog.querySelector(".ant-select-selector") as HTMLElement);
      await screen.findByText("Bekzod Yusupov — +998907772110");
    };

    it("kuryer tanlovi: bog'langan va kassasi 0 emas — o'chiq, sababi bilan; qolganini server tekshiradi", async () => {
      renderPanel();
      const dialog = await openCreate();
      await openCourierPicker(dialog);

      const bound = screen.getByText("«FastPost Logistics» carrier akkauntiga bog'langan");
      expect(bound.closest(".ant-select-item-option")).toHaveClass("ant-select-item-option-disabled");
      const cash = screen.getByText(/^Kassasi 0 emas: /);
      expect(cash.closest(".ant-select-item-option")).toHaveClass("ant-select-item-option-disabled");
      expect(
        screen.getByText("Bekzod Yusupov — +998907772110").closest(".ant-select-item-option"),
      ).not.toHaveClass("ant-select-item-option-disabled");
      expect(screen.getByText(/server «Yaratish»da rad etadi/)).toBeInTheDocument();

      // O'chiq variantni bosish tanlamaydi.
      fireEvent.click(bound);
      expect(dialog.querySelector(".ant-select-selection-item")).toBeNull();
    });

    it("yaratish: body to'g'ri, kalit oynada — keshda yo'q, yopilganda xotiradan ham ketadi", async () => {
      const writeText = stubClipboard();
      const created = acc({
        id: "acc-new",
        name: "Yo'ldosh Kargo",
        courier_user_id: "c-new",
        courier: { id: "c-new", name: "[Carrier] Yo'ldosh Kargo", phone_number: "+998934107705", status: "active" },
        api_key_masked: "bpc_…c91f",
      });
      apiMock.post.mockImplementation(() => {
        accounts = [created, ...accounts];
        return Promise.resolve(ok({ account: created, api_key: KEY }, 201));
      });
      const client = renderPanel();
      const dialog = await openCreate();

      fireEvent.change(within(dialog).getByLabelText("Kompaniya nomi"), {
        target: { value: "  Yo'ldosh Kargo " },
      });
      await openCourierPicker(dialog);
      fireEvent.click(screen.getByText("[Carrier] Yo'ldosh Kargo — +998934107705"));
      fireEvent.change(within(dialog).getByLabelText(/IP cheklovi/), {
        target: { value: "203.0.113.10\n\n 198.51.100.0/24 " },
      });
      expect(within(dialog).getByText("2 / 50")).toBeInTheDocument();
      fireEvent.click(button("Yaratish", dialog));

      const keyBox = await screen.findByLabelText("Yangi API kalit");
      expect(apiMock.post).toHaveBeenCalledWith("carrier-accounts", {
        name: "Yo'ldosh Kargo",
        courier_id: "c-new",
        ip_allowlist: ["203.0.113.10", "198.51.100.0/24"],
      });
      expect(keyBox).toHaveValue(KEY);
      expect(screen.getByText(/ro'yxatda bpc_…c91f bo'lib ko'rinadi/)).toBeInTheDocument();

      // Kalit react-query keshida yo'q (na ro'yxatda, na mutatsiyada).
      await waitFor(() => expect(cacheHas(client, KEY)).toBe(false));

      fireEvent.click(document.querySelector('[aria-label="Kalitni nusxalash"]') as HTMLElement);
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(KEY));

      fireEvent.click(button("Nusxaladim, yopish"));
      // Yopilgach kalit hech bir maydonda (yashirin o'lchov textarea'si ham) qolmaydi.
      await waitFor(() => expect(screen.queryByDisplayValue(KEY)).toBeNull());
      expect(document.body.innerHTML).not.toContain(KEY);
      expect(JSON.stringify({ ...window.localStorage })).not.toContain(KEY);
      expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(KEY);
    });

    it("server rad etsa — matni message.error da aynan, oyna ochiq qoladi", async () => {
      apiMock.post.mockRejectedValue(
        serverError("Kuryerda 12 ta pochta bor — carrier uchun YANGI (pochtasiz) kuryer oching"),
      );
      renderPanel();
      const dialog = await openCreate();

      fireEvent.change(within(dialog).getByLabelText("Kompaniya nomi"), {
        target: { value: "Yo'ldosh Kargo" },
      });
      await openCourierPicker(dialog);
      fireEvent.click(screen.getByText("Bekzod Yusupov — +998907772110"));
      fireEvent.click(button("Yaratish", dialog));

      const toast = await screen.findByText(
        "Kuryerda 12 ta pochta bor — carrier uchun YANGI (pochtasiz) kuryer oching",
      );
      expect(toast.closest(".ant-message")).not.toBeNull();
      expect(queryDialog("Yangi carrier akkaunt")).not.toBeNull();
      expect(screen.queryByLabelText("Yangi API kalit")).toBeNull();
      // IP ro'yxati bo'sh — maydon umuman yuborilmaydi (server: cheklov yo'q).
      expect(apiMock.post).toHaveBeenCalledWith("carrier-accounts", {
        name: "Yo'ldosh Kargo",
        courier_id: "c-bek",
      });
    });

    it("so'rov ketayotganda oynani yopib bo'lmaydi (X, Esc, «Bekor qilish»)", async () => {
      apiMock.post.mockReturnValue(new Promise(() => {}));
      renderPanel();
      const dialog = await openCreate();
      expect(dialog.querySelector(".ant-modal-close")).not.toBeNull();

      fireEvent.change(within(dialog).getByLabelText("Kompaniya nomi"), {
        target: { value: "Yo'ldosh Kargo" },
      });
      await openCourierPicker(dialog);
      fireEvent.click(screen.getByText("Bekzod Yusupov — +998907772110"));
      fireEvent.click(button("Yaratish", dialog));

      await waitFor(() => expect(button("Bekor qilish", dialog)).toBeDisabled());
      expect(dialog.querySelector(".ant-modal-close")).toBeNull();
      const wrap = dialog.closest(".ant-modal-wrap") as HTMLElement;
      fireEvent.keyDown(wrap, { key: "Escape", keyCode: 27 });
      expect(queryDialog("Yangi carrier akkaunt")).not.toBeNull();
      // Enter bilan qayta yuborish ham ikkinchi so'rov bermaydi.
      fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
      await new Promise((r) => setTimeout(r, 50));
      expect(apiMock.post).toHaveBeenCalledTimes(1);
    });

    it("a11y: IP maydoni izoh va xatoga bog'langan, o'chiq kuryer sababi o'qiladi", async () => {
      renderPanel();
      const dialog = await openCreate();

      const ips = within(dialog).getByLabelText(/IP cheklovi/);
      expectDescribedByResolves(ips);
      expect(document.getElementById(ips.getAttribute("aria-describedby") as string)).toHaveTextContent(
        "Ko'pi bilan 50 ta",
      );
      fireEvent.change(ips, {
        target: { value: Array.from({ length: 51 }, (_, i) => `203.0.113.${i}`).join("\n") },
      });
      expect(await within(dialog).findByText("Ko'pi bilan 50 ta yozuv")).toBeInTheDocument();
      expect(ips).toHaveAttribute("aria-invalid", "true");
      expectDescribedByResolves(ips);
      expect(
        ips
          .getAttribute("aria-describedby")
          ?.split(" ")
          .map((id) => document.getElementById(id)?.textContent)
          .join(" "),
      ).toContain("Ko'pi bilan 50 ta yozuv");

      // Kuryer tanlovi qoidasi (izoh) kombobokska bog'langan.
      const combobox = within(dialog).getByRole("combobox");
      expectDescribedByResolves(combobox);
      await openCourierPicker(dialog);
      // O'chiq variant sababi bilan o'qiladi (faqat ko'rinadigan matn emas).
      expect(
        screen
          .getByText("«FastPost Logistics» carrier akkauntiga bog'langan")
          .closest(".ant-select-item-option"),
      ).toHaveAttribute(
        "aria-label",
        "[Carrier] FastPost Logistics — +998901234567 — «FastPost Logistics» carrier akkauntiga bog'langan",
      );
    });

    it("majburiy maydonlarsiz so'rov yuborilmaydi", async () => {
      renderPanel();
      const dialog = await openCreate();
      fireEvent.click(button("Yaratish", dialog));

      expect(await within(dialog).findByText("Kompaniya nomini kiriting")).toBeInTheDocument();
      expect(within(dialog).getByText("Kuryerni tanlang")).toBeInTheDocument();
      expect(apiMock.post).not.toHaveBeenCalled();
    });

    /**
     * Ulanish tartibi: kuryer yo'q → Foydalanuvchilar'da ochiladi → 2 daqiqa
     * ichida qaytiladi. Ilova keshi (`staleTime` 2 daqiqa) bilan tanlov
     * qayta so'ralmas va yangi kuryer ko'rinmasdi.
     */
    it("kuryer tanlovi har ochilishda yangidan — hozirgina ochilgan kuryer ko'rinadi", async () => {
      renderPanel();
      let dialog = await openCreate();
      await openCourierPicker(dialog);
      expect(screen.queryByText("[Carrier] Nilufar Kargo — +998901112233")).toBeNull();
      fireEvent.click(button("Bekor qilish", dialog));
      await waitFor(() => expect(queryDialog("Yangi carrier akkaunt")).toBeNull());

      couriers = [
        ...COURIERS,
        { id: "c-nil", name: "[Carrier] Nilufar Kargo", phone_number: "+998901112233", cashbox: { balance: 0, balance_cash: 0, balance_card: 0 } },
      ];
      dialog = await openCreate();
      await openCourierPicker(dialog);
      expect(
        await screen.findByText("[Carrier] Nilufar Kargo — +998901112233"),
      ).toBeInTheDocument();
      expect(apiMock.get.mock.calls.filter(([u]) => u === "user/couriers")).toHaveLength(2);
    });
  });

  describe("kalitni yangilash", () => {
    const openRotateConfirm = async (name: string) => {
      await openAccount(name);
      openSection("Kalit");
      fireEvent.click(await findButton("Kalitni yangilash"));
      return findDialog("Kalitni yangilaysizmi?");
    };

    it("tasdiqdan keyin yangi kalit bir marta ko'rsatiladi", async () => {
      apiMock.post.mockResolvedValue(ok({ account: FASTPOST, api_key: NEW_KEY }));
      const client = renderPanel();
      const confirm = await openRotateConfirm("FastPost Logistics");

      expect(within(confirm).getByText(/Eski kalit \(bpc_…a1b2\)/)).toBeInTheDocument();
      fireEvent.click(button("Ha, yangilash", confirm));

      expect(await screen.findByLabelText("Yangi API kalit")).toHaveValue(NEW_KEY);
      expect(apiMock.post).toHaveBeenCalledWith("carrier-accounts/acc-fast/rotate-key");
      await waitFor(() => expect(cacheHas(client, NEW_KEY)).toBe(false));
    });

    it("bekor qilinsa so'rov yuborilmaydi", async () => {
      renderPanel();
      const confirm = await openRotateConfirm("FastPost Logistics");
      fireEvent.click(button("Bekor qilish", confirm));

      expect(apiMock.post).not.toHaveBeenCalled();
    });

    it("so'rov ketgach tasdiqni bekor qilib bo'lmaydi", async () => {
      apiMock.post.mockReturnValue(new Promise(() => {}));
      renderPanel();
      const confirm = await openRotateConfirm("FastPost Logistics");
      expect(button("Bekor qilish", confirm)).not.toBeDisabled();

      fireEvent.click(button("Ha, yangilash", confirm));
      await waitFor(() => expect(button("Bekor qilish", confirm)).toBeDisabled());
      expect(apiMock.post).toHaveBeenCalledTimes(1);
    });

    /**
     * ⚠️ Kalit serverda almashgan (eski kalit o'lgan); keyingi ro'yxat
     * so'rovi yiqilsa ham yangi kalit oynasi turishi SHART — aks holda
     * kalit yo'qoladi va kompaniya qayta yangilashgacha uzilib qoladi.
     */
    it("kalit berilgach ro'yxat so'rovi yiqilsa ham kalit oynasi turadi", async () => {
      const writeText = stubClipboard();
      let fail = false;
      apiMock.get.mockImplementation((url: string) => {
        if (url === "carrier-accounts")
          return fail
            ? Promise.reject(serverError("Bad Gateway", 502))
            : Promise.resolve(ok(accounts));
        return Promise.reject(new Error(`kutilmagan GET ${url}`));
      });
      apiMock.post.mockImplementation(() => {
        fail = true;
        return Promise.resolve(ok({ account: FASTPOST, api_key: NEW_KEY }));
      });
      renderPanel();
      const confirm = await openRotateConfirm("FastPost Logistics");
      fireEvent.click(button("Ha, yangilash", confirm));

      expect(await screen.findByLabelText("Yangi API kalit")).toHaveValue(NEW_KEY);
      // Invalidatsiyadan keyingi GET yiqildi — panel almashtirilmaydi.
      expect(
        await screen.findByText(/^Ro'yxatni yangilab bo'lmadi/),
      ).toBeInTheDocument();
      expect(screen.queryByText("Carrier akkauntlarini yuklab bo'lmadi")).toBeNull();
      expect(screen.getByLabelText("Yangi API kalit")).toHaveValue(NEW_KEY);

      fireEvent.click(document.querySelector('[aria-label="Kalitni nusxalash"]') as HTMLElement);
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(NEW_KEY));
      fireEvent.click(button("Nusxaladim, yopish"));
      await waitFor(() => expect(screen.queryByDisplayValue(NEW_KEY)).toBeNull());
      // Kalit bo'limi joyida qoladi.
      expect(button("Kalitni yangilash")).toBeInTheDocument();
    });

    it("server rad etsa — xabari toast'da, kalit oynasi ochilmaydi", async () => {
      apiMock.post.mockRejectedValue(
        serverError(
          "Bog'langan kuryer faol emas (bloklangan, o'chirilgan yoki boshqa provayderga o'tkazilgan) — kalit berilmaydi",
        ),
      );
      renderPanel();
      const confirm = await openRotateConfirm("FastPost Logistics");
      fireEvent.click(button("Ha, yangilash", confirm));

      const toast = await screen.findByText(
        /^Bog'langan kuryer faol emas \(bloklangan, o'chirilgan/,
        { selector: ".ant-message *" },
      );
      expect(toast).toBeInTheDocument();
      expect(screen.queryByLabelText("Yangi API kalit")).toBeNull();
    });

    it("kuryer bloklangan — tugma o'chiq, sababi bog'langan", async () => {
      renderPanel();
      await openAccount("Tezkor Kargo");
      openSection("Kalit");

      const btn = await findButton("Kalitni yangilash");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-describedby", "carrier-key-blocked-reason");
      expect(document.getElementById("carrier-key-blocked-reason")).toHaveTextContent(
        "kalit berilmaydi",
      );
      // Faol akkaunt — kompaniya kuryer xabarini oladi.
      expect(document.getElementById("carrier-key-blocked-reason")).toHaveTextContent(
        "403 «Bog'langan kuryer faol emas — BeePost operatoriga murojaat qiling»",
      );
    });

    /**
     * Server guard'i avval `is_active` ni tekshiradi: to'xtatilgan akkaunt
     * (ogohlantirishdagi 1-qadamdan keyin ham) kompaniyaga 403 «Carrier
     * akkaunt faol emas» beradi — kuryer xabarini emas.
     */
    it("to'xtatilgan + kuryer bloklangan — ogohlantirish kompaniya oladigan 403 ni to'g'ri aytadi", async () => {
      accounts = [{ ...TEZKOR, is_active: false }];
      renderPanel();
      await openAccount("Tezkor Kargo");
      openSection("Kalit");

      await findButton("Kalitni yangilash");
      const alert = document.getElementById("carrier-key-blocked-reason");
      expect(alert).toHaveTextContent("403 «Carrier akkaunt faol emas»");
      expect(alert).not.toHaveTextContent("BeePost operatoriga murojaat qiling");
    });
  });

  describe("holat (kill switch)", () => {
    it("to'xtatish — tasdiq, POST status {is_active:false}, muvaffaqiyat xabari", async () => {
      apiMock.post.mockResolvedValue(ok({ ...FASTPOST, is_active: false }));
      renderPanel();
      await openAccount("FastPost Logistics");

      fireEvent.click(statusSwitch() as HTMLElement);
      const confirm = await findDialog("FastPost Logistics akkauntini to'xtatasizmi?");
      expect(within(confirm).getByText(/403 «Carrier akkaunt faol emas»/)).toBeInTheDocument();
      fireEvent.click(button("Ha, to'xtatish", confirm));

      await waitFor(() =>
        expect(apiMock.post).toHaveBeenCalledWith("carrier-accounts/acc-fast/status", {
          is_active: false,
        }),
      );
      expect(await screen.findByText("Akkaunt to'xtatildi")).toBeInTheDocument();
    });

    it("qayta yoqish — eski kalit haqida ogohlantirish bilan", async () => {
      apiMock.post.mockResolvedValue(ok({ ...KARVON, is_active: true }));
      renderPanel();
      await openAccount("Karvon Delivery");

      fireEvent.click(statusSwitch() as HTMLElement);
      const confirm = await findDialog("Karvon Delivery akkauntini qayta yoqasizmi?");
      expect(within(confirm).getByText(/kalit \(bpc_…7f3c\) yana ishlay/)).toBeInTheDocument();
      fireEvent.click(button("Ha, qayta yoqish", confirm));

      await waitFor(() =>
        expect(apiMock.post).toHaveBeenCalledWith("carrier-accounts/acc-karvon/status", {
          is_active: true,
        }),
      );
    });

    it("server rad etsa — matni toast'da, kalit holati o'zgarmaydi", async () => {
      apiMock.post.mockRejectedValue(
        serverError(
          "Bog'langan kuryer faol emas (bloklangan, o'chirilgan yoki boshqa provayderga o'tkazilgan) — akkauntni yoqib bo'lmaydi",
        ),
      );
      renderPanel();
      await openAccount("Karvon Delivery");
      expect(statusSwitch()).toHaveAttribute("aria-checked", "false");

      fireEvent.click(statusSwitch() as HTMLElement);
      const confirm = await findDialog("Karvon Delivery akkauntini qayta yoqasizmi?");
      fireEvent.click(button("Ha, qayta yoqish", confirm));

      const toast = await screen.findByText(/^Bog'langan kuryer faol emas .*akkauntni yoqib bo'lmaydi$/);
      expect(toast.closest(".ant-message")).not.toBeNull();
      expect(statusSwitch()).toHaveAttribute("aria-checked", "false");
      expect(screen.queryByText("Akkaunt qayta yoqildi")).toBeNull();
    });

    it("to'xtatilgan + kuryer bloklangan — qayta yoqib bo'lmaydi", async () => {
      accounts = [{ ...TEZKOR, is_active: false }];
      renderPanel();
      await openAccount("Tezkor Kargo");

      expect(statusSwitch()).toBeDisabled();
      expect(screen.getByText(/Qayta yoqib bo'lmaydi: bog'langan kuryer bloklangan/)).toBeInTheDocument();
    });
  });

  it("o'chirish — tasdiq, DELETE, Akkauntlar bo'limiga qaytadi", async () => {
    apiMock.delete.mockImplementation(() => {
      accounts = accounts.filter((a) => a.id !== "acc-karvon");
      return Promise.resolve(ok({ id: "acc-karvon", deleted: true, courier_released: true }));
    });
    renderPanel();
    await openAccount("Karvon Delivery");

    fireEvent.click(button(/^O'chirish$/));
    const confirm = await findDialog("Karvon Delivery akkauntini butunlay o'chirasizmi?");
    expect(within(confirm).getByText(/«\[Carrier\] Karvon Delivery» provayderdan/)).toBeInTheDocument();
    fireEvent.click(button("Ha, o'chirish", confirm));

    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith("carrier-accounts/acc-karvon"));
    expect(
      await screen.findByText("Akkaunt o'chirildi — kuryer provayderdan bo'shatildi"),
    ).toBeInTheDocument();
    expect(await findButton("Yangi akkaunt")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Karvon Delivery")).toBeNull());
  });

  it("o'chirish: server rad etsa — toast, Sozlamalar'da qoladi", async () => {
    apiMock.delete.mockRejectedValue(serverError("Carrier akkaunt topilmadi", 404));
    renderPanel();
    await openAccount("Karvon Delivery");

    fireEvent.click(button(/^O'chirish$/));
    const confirm = await findDialog("Karvon Delivery akkauntini butunlay o'chirasizmi?");
    fireEvent.click(button("Ha, o'chirish", confirm));

    const toast = await screen.findByText("Carrier akkaunt topilmadi");
    expect(toast.closest(".ant-message")).not.toBeNull();
    expect(statusSwitch()).not.toBeNull();
    expect(screen.getByText("Akkauntni butunlay o'chirish")).toBeInTheDocument();
    // Xatoda ham ro'yxat qayta so'raladi (boshqa admin o'chirgan bo'lishi mumkin).
    await waitFor(() =>
      expect(apiMock.get.mock.calls.filter(([u]) => u === "carrier-accounts")).toHaveLength(2),
    );
  });

  it("o'chirish: kuryer provayderi oldin o'zgargan bo'lsa — boshqa xabar", async () => {
    apiMock.delete.mockResolvedValue(
      ok({ id: "acc-karvon", deleted: true, courier_released: false }),
    );
    renderPanel();
    await openAccount("Karvon Delivery");

    fireEvent.click(button(/^O'chirish$/));
    const confirm = await findDialog("Karvon Delivery akkauntini butunlay o'chirasizmi?");
    fireEvent.click(button("Ha, o'chirish", confirm));

    expect(
      await screen.findByText(
        "Akkaunt o'chirildi. Kuryer provayderi oldinroq o'zgartirilgan edi — unga tegilmadi",
      ),
    ).toBeInTheDocument();
  });

  it("tahrirlash — IP ro'yxati qatorlab, bo'shatilsa [] yuboriladi", async () => {
    apiMock.patch.mockResolvedValue(ok(FASTPOST));
    renderPanel();
    await openAccount("FastPost Logistics");

    fireEvent.click(button("O'zgartirish"));
    const dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
    const ips = within(dialog).getByLabelText("IP cheklovi");
    expect(ips).toHaveValue("203.0.113.10\n198.51.100.0/24\n2001:db8::25");
    expect(within(dialog).getByText("3 / 50")).toBeInTheDocument();

    fireEvent.change(ips, { target: { value: "" } });
    fireEvent.click(button("Saqlash", dialog));

    // Faqat o'zgargan maydon: nom tegilmagan — yuborilmaydi.
    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith("carrier-accounts/acc-fast", {
        ip_allowlist: [],
      }),
    );
    expect(await screen.findByText("Carrier akkaunt yangilandi")).toBeInTheDocument();
  });

  it("tahrirlash — faqat nom o'zgarsa IP ro'yxati yuborilmaydi; o'zgarishsiz — so'rovsiz yopiladi", async () => {
    apiMock.patch.mockResolvedValue(ok(FASTPOST));
    renderPanel();
    await openAccount("FastPost Logistics");

    fireEvent.click(button("O'zgartirish"));
    let dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
    fireEvent.click(button("Saqlash", dialog));
    await waitFor(() => expect(queryDialog("Akkauntni tahrirlash — FastPost Logistics")).toBeNull());
    expect(apiMock.patch).not.toHaveBeenCalled();

    fireEvent.click(button("O'zgartirish"));
    dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
    fireEvent.change(within(dialog).getByLabelText("Kompaniya nomi"), {
      target: { value: " FastPost Logistics LLC " },
    });
    fireEvent.click(button("Saqlash", dialog));
    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith("carrier-accounts/acc-fast", {
        name: "FastPost Logistics LLC",
      }),
    );
  });

  it("tahrirlash — boshqa akkauntda o'sha akkauntning qiymatlari bilan ochiladi", async () => {
    renderPanel();
    await openAccount("FastPost Logistics");
    fireEvent.click(button("O'zgartirish"));
    let dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
    fireEvent.change(within(dialog).getByLabelText("IP cheklovi"), {
      target: { value: "10.0.0.1" },
    });
    fireEvent.click(button("Bekor qilish", dialog));
    await waitFor(() => expect(queryDialog("Akkauntni tahrirlash — FastPost Logistics")).toBeNull());

    fireEvent.click(screen.getByText("Ipak Yo'li Express"));
    await screen.findByText("Kalit berilgan (bpc_…5e80)");
    fireEvent.click(button("O'zgartirish"));
    dialog = await findDialog("Akkauntni tahrirlash — Ipak Yo'li Express");
    expect(within(dialog).getByLabelText("Kompaniya nomi")).toHaveValue("Ipak Yo'li Express");
    expect(within(dialog).getByLabelText("IP cheklovi")).toHaveValue("");
  });

  it("tahrirlashda 50 tadan ko'p yozuv — so'rov yuborilmaydi", async () => {
    renderPanel();
    await openAccount("FastPost Logistics");
    fireEvent.click(button("O'zgartirish"));
    const dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");

    const many = Array.from({ length: 51 }, (_, i) => `203.0.113.${i}`).join("\n");
    fireEvent.change(within(dialog).getByLabelText("IP cheklovi"), { target: { value: many } });
    fireEvent.click(button("Saqlash", dialog));

    expect(await within(dialog).findByText("Ko'pi bilan 50 ta yozuv")).toBeInTheDocument();
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it("tahrirlashda server 400 — IP xabari aynan toast'da", async () => {
    const msg =
      "ip_allowlist da tushunilmagan yozuv: 2001:db8::/48. Qabul qilinadi: IPv4 (203.0.113.10), IPv4 diapazon (203.0.113.0/24), IPv6 manzil (IPv6 diapazon yo'q)";
    apiMock.patch.mockRejectedValue(serverError(msg));
    renderPanel();
    await openAccount("FastPost Logistics");
    fireEvent.click(button("O'zgartirish"));
    const dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
    fireEvent.change(within(dialog).getByLabelText("IP cheklovi"), {
      target: { value: "2001:db8::/48" },
    });
    fireEvent.click(button("Saqlash", dialog));

    const toast = await screen.findByText(msg);
    expect(toast.closest(".ant-message")).not.toBeNull();
    expect(queryDialog("Akkauntni tahrirlash — FastPost Logistics")).not.toBeNull();
    expect(within(dialog).getByLabelText("IP cheklovi")).toHaveValue("2001:db8::/48");
    expect(apiMock.patch).toHaveBeenCalledWith("carrier-accounts/acc-fast", {
      ip_allowlist: ["2001:db8::/48"],
    });
  });

  it("faollik — oxirgi so'rov va tizim jurnalidagi tarix", async () => {
    activity = [
      {
        id: "l2",
        action: "deactivated",
        description: "Carrier akkaunt o'chirildi: FastPost Logistics",
        old_value: { is_active: true },
        new_value: { is_active: false },
        user_name: "Nodira Karimova",
        user_role: "admin",
        created_at: Date.UTC(2026, 10, 5, 11, 20),
      },
      {
        id: "l1",
        action: "key_rotated",
        description: "Carrier kaliti yangilandi: FastPost Logistics (eski kalit bekor)",
        old_value: null,
        new_value: { key_rotated: true },
        user_name: "Sardor Aliyev",
        user_role: "superadmin",
        created_at: Date.UTC(2026, 10, 10, 4, 15),
      },
    ];
    renderPanel();
    await openAccount("FastPost Logistics");
    openSection("Faollik");

    expect(await screen.findByText("To'xtatildi")).toBeInTheDocument();
    expect(screen.getByText("Kalit yangilandi")).toBeInTheDocument();
    expect(screen.getByText("is_active: true → false")).toBeInTheDocument();
    expect(screen.getByText("Nodira Karimova")).toBeInTheDocument();
    // Rol — "Tizim jurnallari" sahifasidagi o'zbekcha nomi bilan.
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith("activity-log/CarrierAccount/acc-fast", {
      params: { page: 1, limit: 50 },
    });
  });

  it("akkaunt tanlagich — Sozlamalar bo'limida akkauntni almashtiradi", async () => {
    renderPanel();
    await openAccount("FastPost Logistics");
    expect(screen.getByText("Kalit berilgan (bpc_…a1b2)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ipak Yo'li Express"));
    expect(await screen.findByText("Kalit berilgan (bpc_…5e80)")).toBeInTheDocument();
    expect(screen.getByText("IP cheklovi yo'q (ixtiyoriy)")).toBeInTheDocument();
  });

  /**
   * Foydalanuvchilar'da carrier kuryerini bloklab, 2 daqiqa ichida qaytgan
   * admin eski «Kuryer bloklanmagan» ni ko'rmasin (ilova keshi `staleTime`
   * 2 daqiqa — panel qayta ochilganda ro'yxat so'ralmasdi).
   */
  it("panel qayta ochilganda ro'yxat yangidan so'raladi (kesh 2 daqiqa «yangi» bo'lsa ham)", async () => {
    accounts = [FASTPOST];
    const client = renderPanel();
    await openAccount("FastPost Logistics");
    expect(screen.getByText("Kuryer bloklanmagan")).toBeInTheDocument();
    cleanup();

    accounts = [{ ...FASTPOST, courier: { ...FASTPOST.courier!, status: "inactive" } }];
    renderPanel(client);
    expect(await screen.findByText("Kuryer bloklangan")).toBeInTheDocument();
  });

  /**
   * ⚠️ Sekin tarmoq: mutatsiyadan keyingi `GET carrier-accounts` javob bermay
   * turadi. Toast chiqqan zahoti ekran yangi holatni ko'rsatishi shart —
   * aks holda qayta ochilgan «O'zgartirish» bekor qilingan IP'ni formaga
   * qaytarib, keyingi saqlash uni yana ruxsat etardi. jsdom'dagi darhol
   * javob beradigan mock bu oraliqni ko'rsatmaydi.
   */
  describe("ro'yxat GET'i kechiksa ham ekran mutatsiya javobidan yangilanadi", () => {
    const stallList = () => {
      listGate = new Promise(() => {});
    };
    const ipList = () =>
      document.querySelector('ul[aria-label="Ruxsat etilgan manzillar"]') as HTMLElement;

    it("tahrirlash: olib tashlangan IP darhol yo'qoladi, qayta ochilgan forma uni qaytarmaydi", async () => {
      const updated = { ...FASTPOST, ip_allowlist: ["198.51.100.0/24", "2001:db8::25"] };
      apiMock.patch
        .mockImplementationOnce(() => {
          stallList();
          return Promise.resolve(ok(updated));
        })
        .mockResolvedValueOnce(ok({ ...updated, ip_allowlist: [...updated.ip_allowlist, "192.0.2.7"] }));
      renderPanel();
      await openAccount("FastPost Logistics");
      expect(within(ipList()).getByText("203.0.113.10")).toBeInTheDocument();

      fireEvent.click(button("O'zgartirish"));
      let dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
      fireEvent.change(within(dialog).getByLabelText("IP cheklovi"), {
        target: { value: "198.51.100.0/24\n2001:db8::25" },
      });
      fireEvent.click(button("Saqlash", dialog));
      await screen.findByText("Carrier akkaunt yangilandi");

      expect(within(ipList()).queryByText("203.0.113.10")).toBeNull();
      await waitFor(() =>
        expect(queryDialog("Akkauntni tahrirlash — FastPost Logistics")).toBeNull(),
      );

      fireEvent.click(button("O'zgartirish"));
      dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
      const ips = within(dialog).getByLabelText("IP cheklovi");
      expect(ips).toHaveValue("198.51.100.0/24\n2001:db8::25");
      fireEvent.change(ips, { target: { value: "198.51.100.0/24\n2001:db8::25\n192.0.2.7" } });
      fireEvent.click(button("Saqlash", dialog));
      await waitFor(() =>
        expect(apiMock.patch).toHaveBeenLastCalledWith("carrier-accounts/acc-fast", {
          ip_allowlist: ["198.51.100.0/24", "2001:db8::25", "192.0.2.7"],
        }),
      );
    });

    it("to'xtatish: toast bilan birga kalit holati «To'xtatilgan»", async () => {
      apiMock.post.mockImplementation(() => {
        stallList();
        return Promise.resolve(ok({ ...FASTPOST, is_active: false }));
      });
      renderPanel();
      await openAccount("FastPost Logistics");

      fireEvent.click(statusSwitch() as HTMLElement);
      const confirm = await findDialog("FastPost Logistics akkauntini to'xtatasizmi?");
      fireEvent.click(button("Ha, to'xtatish", confirm));
      await screen.findByText("Akkaunt to'xtatildi");

      expect(statusSwitch()).toHaveAttribute("aria-checked", "false");
      expect(screen.getByText("Akkaunt to'xtatilgan")).toBeInTheDocument();
    });

    it("o'chirish: toast bilan birga akkaunt ro'yxatdan yo'qoladi", async () => {
      apiMock.delete.mockImplementation(() => {
        stallList();
        return Promise.resolve(ok({ id: "acc-karvon", deleted: true, courier_released: true }));
      });
      renderPanel();
      await openAccount("Karvon Delivery");

      fireEvent.click(button(/^O'chirish$/));
      const confirm = await findDialog("Karvon Delivery akkauntini butunlay o'chirasizmi?");
      fireEvent.click(button("Ha, o'chirish", confirm));
      await screen.findByText("Akkaunt o'chirildi — kuryer provayderdan bo'shatildi");

      expect(await findButton("Yangi akkaunt")).toBeInTheDocument();
      expect(screen.queryByText("Karvon Delivery")).toBeNull();
      expect(screen.getByText("3 ta")).toBeInTheDocument();
    });
  });
});
