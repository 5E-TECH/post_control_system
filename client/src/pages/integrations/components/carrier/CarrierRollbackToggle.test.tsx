import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { CarrierAccount } from "../../../../shared/api/hooks/useCarrierAccounts";

/**
 * YASHIRIN ROLLBACK TUGMASI — Sozlamalar → «Rollback (natijani bekor
 * qilish)». Sukut o'chiq; admin tasdiq oynasi orqali yoqadi/o'chiradi
 * (`PATCH carrier-accounts/:id {rollback_enabled}`), javob ro'yxat keshiga
 * darhol yoziladi. Kompaniyaga beriladigan «Kalit» bo'limidagi ro'yxatda
 * rollback YO'Q.
 */

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../../shared/api", () => ({ api: apiMock }));

const { CarrierCargoTab } = await import("./CarrierCargoTab");

const SWITCH_LABEL = "Rollback (natijani bekor qilish)";
const HELP_TEXT =
  "O'chiq bo'lsa kompaniya yuborgan rollback rad etiladi; xato natijani BeePost operatori tuzatadi. Bu imkoniyat kompaniyaga hujjatlarda ko'rsatilmaydi.";

const acc = (over: Partial<CarrierAccount>): CarrierAccount => ({
  id: "id",
  name: "name",
  courier_user_id: "c",
  courier: { id: "c", name: "courier", phone_number: "+998900000000", status: "active" },
  api_key_masked: "bpc_…0000",
  ip_allowlist: null,
  is_active: true,
  rollback_enabled: false,
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
});
const KARVON = acc({
  id: "acc-karvon",
  name: "Karvon Delivery",
  courier_user_id: "c-karvon",
  courier: { id: "c-karvon", name: "[Carrier] Karvon Delivery", phone_number: "+998712003344", status: "active" },
  api_key_masked: "bpc_…7f3c",
  rollback_enabled: true,
});

const ok = (data: unknown, statusCode = 200) => ({ data: { statusCode, message: "ok", data } });
const serverError = (message: string, status = 400) => ({
  response: { status, data: { statusCode: status, message, error: message } },
});

let accounts: CarrierAccount[];
let activity: unknown[];

/** Server kabi: PATCH qabul qilingach keyingi GET yangi qiymatni beradi. */
const serverPatched = (id: string, rollback_enabled: boolean) => {
  accounts = accounts.map((a) => (a.id === id ? { ...a, rollback_enabled } : a));
  return accounts.find((a) => a.id === id);
};
/** O'rnatilsa — `GET carrier-accounts` shu promise'gacha kutadi (sekin tarmoq). */
let listGate: Promise<unknown> | null;

beforeEach(() => {
  accounts = [FASTPOST, KARVON];
  activity = [];
  listGate = null;
  apiMock.get.mockImplementation((url: string) => {
    if (url === "carrier-accounts") {
      const res = ok(accounts);
      return listGate ? listGate.then(() => res) : Promise.resolve(res);
    }
    if (url === "user/couriers") return Promise.resolve(ok([]));
    if (url.startsWith("activity-log/CarrierAccount/"))
      return Promise.resolve(ok({ logs: activity, total: activity.length, page: 1, limit: 50 }));
    return Promise.reject(new Error(`kutilmagan GET ${url}`));
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/** `app/provider.tsx` dagi QueryClient bilan bir xil (retry'siz). */
const renderPanel = () =>
  render(
    <StrictMode>
      <QueryClientProvider
        client={
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
          })
        }
      >
        <MemoryRouter>
          <CarrierCargoTab />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );

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

const findDialog = async (title: string | RegExp) => {
  const [el] = await screen.findAllByText(title);
  const modal = el.closest(".ant-modal");
  if (!modal) throw new Error(`oyna topilmadi: ${String(title)}`);
  return modal as HTMLElement;
};

const queryDialog = (title: string) =>
  screen.queryAllByText(title)[0]?.closest(".ant-modal") ?? null;

const rollbackSwitch = () =>
  document.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${SWITCH_LABEL}"]`);

/** Rollback kartasi — "Yoqilgan" matni holat kartasida ham bor. */
const rollbackCard = () => {
  const card = rollbackSwitch()?.closest(".ant-card");
  if (!card) throw new Error("rollback kartasi topilmadi");
  return card as HTMLElement;
};

const openSection = (label: string) => fireEvent.click(button(label));

const openAccount = async (name: string) => {
  fireEvent.click(await findButton(name));
  await screen.findByText(/^Akkaunt (yoqilgan|to'xtatilgan)$/);
  expect(rollbackSwitch()).not.toBeNull();
};

const ENABLE_TITLE = "FastPost Logistics uchun rollback'ni yoqasizmi?";
const DISABLE_TITLE = "Karvon Delivery uchun rollback'ni o'chirasizmi?";

describe("Sozlamalar → yashirin rollback tugmasi", () => {
  it("holat: sukut o'chiq, yordam matni bog'langan; yoqilgani «Yoqilgan»", async () => {
    renderPanel();
    await openAccount("FastPost Logistics");

    const sw = rollbackSwitch() as HTMLButtonElement;
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).not.toBeDisabled();
    expect(screen.getByText(SWITCH_LABEL)).toBeInTheDocument();
    expect(within(rollbackCard()).getByText("O'chiq")).toBeInTheDocument();
    const help = screen.getByText(HELP_TEXT);
    expect(sw.getAttribute("aria-describedby")).toBe(help.id);

    // Akkaunt tanlagich (Segmented) — boshqa akkauntning holati.
    fireEvent.click(screen.getByText("Karvon Delivery"));
    await waitFor(() => expect(rollbackSwitch()).toHaveAttribute("aria-checked", "true"));
    expect(within(rollbackCard()).getByText("Yoqilgan")).toBeInTheDocument();
  });

  it("akkauntlar jadvali: faqat yoqilgan akkauntda «rollback yoqilgan» (o'chiqlarda hech narsa)", async () => {
    renderPanel();
    await findButton("FastPost Logistics");
    const notes = screen.getAllByText("rollback yoqilgan");
    expect(notes).toHaveLength(1);
    expect(notes[0].closest("tr")).toHaveTextContent("Karvon Delivery");
  });

  it("⭐ yoqish: tasdiq → PATCH faqat {rollback_enabled:true} → toast; ekran mutatsiya javobidan (GET kechiksa ham)", async () => {
    apiMock.patch.mockImplementation(() => {
      listGate = new Promise(() => {});
      return Promise.resolve(ok({ ...FASTPOST, rollback_enabled: true }));
    });
    renderPanel();
    await openAccount("FastPost Logistics");

    fireEvent.click(rollbackSwitch() as HTMLElement);
    const confirm = await findDialog(ENABLE_TITLE);
    expect(within(confirm).getByText(/kompaniyaga o'zingiz xabar bering/)).toBeInTheDocument();
    // Tasdiqsiz hech narsa yuborilmaydi.
    expect(apiMock.patch).not.toHaveBeenCalled();
    fireEvent.click(button("Ha, yoqish", confirm));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledTimes(1));
    expect(apiMock.patch).toHaveBeenCalledWith("carrier-accounts/acc-fast", {
      rollback_enabled: true,
    });
    const toast = await screen.findByText("Rollback yoqildi");
    expect(toast.closest(".ant-message")).not.toBeNull();
    expect(rollbackSwitch()).toHaveAttribute("aria-checked", "true");
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it("o'chirish: xavfli tasdiq, PATCH {rollback_enabled:false}, toast", async () => {
    apiMock.patch.mockImplementation(() =>
      Promise.resolve(ok(serverPatched("acc-karvon", false))),
    );
    renderPanel();
    await openAccount("Karvon Delivery");

    fireEvent.click(rollbackSwitch() as HTMLElement);
    const confirm = await findDialog(DISABLE_TITLE);
    expect(within(confirm).getByText(/noma'lum status kabi 400/)).toBeInTheDocument();
    const okButton = button("Ha, o'chirish", confirm);
    expect(okButton).toHaveClass("ant-btn-dangerous");
    fireEvent.click(okButton);

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith("carrier-accounts/acc-karvon", {
        rollback_enabled: false,
      }),
    );
    expect(await screen.findByText("Rollback o'chirildi")).toBeInTheDocument();
    await waitFor(() => expect(rollbackSwitch()).toHaveAttribute("aria-checked", "false"));
  });

  it("bekor qilinsa so'rov yuborilmaydi, holat o'zgarmaydi", async () => {
    renderPanel();
    await openAccount("FastPost Logistics");

    fireEvent.click(rollbackSwitch() as HTMLElement);
    const confirm = await findDialog(ENABLE_TITLE);
    fireEvent.click(button("Bekor qilish", confirm));
    await waitFor(() => expect(queryDialog(ENABLE_TITLE)).toBeNull());

    expect(apiMock.patch).not.toHaveBeenCalled();
    expect(rollbackSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("server rad etsa — matni message.error da aynan, holat o'zgarmaydi", async () => {
    apiMock.patch.mockRejectedValue(serverError("Carrier akkaunt topilmadi", 404));
    renderPanel();
    await openAccount("FastPost Logistics");

    fireEvent.click(rollbackSwitch() as HTMLElement);
    fireEvent.click(button("Ha, yoqish", await findDialog(ENABLE_TITLE)));

    const toast = await screen.findByText("Carrier akkaunt topilmadi");
    expect(toast.closest(".ant-message")).not.toBeNull();
    expect(rollbackSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Rollback yoqildi")).toBeNull();
  });

  it("javob matnsiz bo'lsa — zaxira xato matni", async () => {
    apiMock.patch.mockRejectedValue(new Error("Network Error"));
    renderPanel();
    await openAccount("FastPost Logistics");

    fireEvent.click(rollbackSwitch() as HTMLElement);
    fireEvent.click(button("Ha, yoqish", await findDialog(ENABLE_TITLE)));

    expect(await screen.findByText("Rollback sozlamasini o'zgartirib bo'lmadi")).toBeInTheDocument();
  });

  it("⭐ so'rov ketayotganda tugma o'chiq (loading) — ikkinchi tasdiq ochilmaydi; javobdan keyin yana faol", async () => {
    let release: (value: unknown) => void = () => {};
    apiMock.patch.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    renderPanel();
    await openAccount("FastPost Logistics");

    fireEvent.click(rollbackSwitch() as HTMLElement);
    const confirm = await findDialog(ENABLE_TITLE);
    fireEvent.click(button("Ha, yoqish", confirm));

    await waitFor(() => expect(rollbackSwitch()).toBeDisabled());
    expect(rollbackSwitch()).toHaveClass("ant-switch-loading");
    // Tasdiq oynasi qulflangan: «Bekor qilish» bosilmaydi.
    expect(button("Bekor qilish", confirm)).toBeDisabled();

    fireEvent.click(rollbackSwitch() as HTMLElement);
    expect(apiMock.patch).toHaveBeenCalledTimes(1);

    release(ok(serverPatched("acc-fast", true)));
    await screen.findByText("Rollback yoqildi");
    await waitFor(() => expect(rollbackSwitch()).not.toBeDisabled());
    expect(rollbackSwitch()).toHaveAttribute("aria-checked", "true");
    expect(apiMock.patch).toHaveBeenCalledTimes(1);
  });

  it("faollik: tarixda «rollback: o'chiq → yoqilgan»", async () => {
    activity = [
      {
        id: "log-1",
        action: "updated",
        description: "Carrier akkaunt yangilandi: FastPost Logistics — rollback yoqildi",
        old_value: { rollback_enabled: false },
        new_value: { rollback_enabled: true },
        user_name: "Admin",
        user_role: "superadmin",
        created_at: Date.UTC(2026, 10, 14, 9, 0),
      },
    ];
    renderPanel();
    await openAccount("FastPost Logistics");
    openSection("Faollik");
    expect(await screen.findByText("rollback: o'chiq → yoqilgan")).toBeInTheDocument();
  });

  it("«Kalit» bo'limidagi kompaniya dasturchisi ro'yxatida rollback YO'Q", async () => {
    renderPanel();
    await openAccount("FastPost Logistics");
    openSection("Kalit");
    expect(
      await screen.findByText("sold · partly_sold · cancelled; Idempotency-Key majburiy"),
    ).toBeInTheDocument();
    const developerCard = screen.getByText("Kompaniya dasturchisi uchun").closest(".ant-card");
    expect(developerCard).not.toBeNull();
    expect(developerCard?.textContent?.toLowerCase()).not.toContain("rollback");
  });
});
