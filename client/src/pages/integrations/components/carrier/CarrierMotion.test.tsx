import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { CarrierAccount } from "../../../../shared/api/hooks/useCarrierAccounts";

/**
 * ⚠️ HAQIQIY ANIMATSIYA BILAN. rc-motion animatsiyani modul yuklanganda
 * yoqadi — faqat `window.AnimationEvent` va `TransitionEvent` bo'lsa. jsdom'da
 * ular yo'q: boshqa testlarda yopilgan oyna DOM'dan DARHOL yo'qoladi.
 * Brauzerda esa oyna ~200 ms yopilish animatsiyasida turadi — fokus ichida
 * qoladi va klaviatura ishlayveradi (`pointer-events: none` faqat
 * sichqonchani to'sadi). Shu farq tufayli testlardan o'tib, haqiqiy ilovada
 * buziladigan xatolar shu faylda ushlanadi. Animatsiya oxiri — brauzer
 * beradigan `animationend` hodisasi (`finishLeave`).
 */
vi.hoisted(() => {
  class MotionEvent extends Event {}
  Object.assign(window, { AnimationEvent: MotionEvent, TransitionEvent: MotionEvent });
});

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../../shared/api", () => ({ api: apiMock }));

const { CarrierCargoTab } = await import("./CarrierCargoTab");

const KEY_1 = "bpc_1111111111111111111111111111111111111111111111111111111111111111";
const KEY_2 = "bpc_2222222222222222222222222222222222222222222222222222222222222222";

const FASTPOST: CarrierAccount = {
  id: "acc-fast",
  name: "FastPost Logistics",
  courier_user_id: "c-fast",
  courier: { id: "c-fast", name: "[Carrier] FastPost Logistics", phone_number: "+998901234567", status: "active" },
  api_key_masked: "bpc_…a1b2",
  ip_allowlist: ["203.0.113.10"],
  is_active: true,
  last_used_at: null,
  created_at: Date.UTC(2026, 10, 2, 6, 2),
  updated_at: Date.UTC(2026, 10, 10, 4, 15),
};
const CREATED: CarrierAccount = {
  ...FASTPOST,
  id: "acc-new",
  name: "Yo'ldosh Kargo",
  courier_user_id: "c-new",
  courier: { id: "c-new", name: "[Carrier] Yo'ldosh Kargo", phone_number: "+998934107705", status: "active" },
  api_key_masked: "bpc_…1111",
  ip_allowlist: null,
};
const COURIERS = [
  { id: "c-new", name: "[Carrier] Yo'ldosh Kargo", phone_number: "+998934107705", cashbox: { balance: 0 } },
];

const ok = (data: unknown, statusCode = 200) => ({ data: { statusCode, message: "ok", data } });
const serverError = (message: string, status = 400) => ({
  response: { status, data: { statusCode: status, message, error: message } },
});

let accounts: CarrierAccount[];

beforeEach(() => {
  accounts = [FASTPOST];
  apiMock.get.mockImplementation((url: string) => {
    if (url === "carrier-accounts") return Promise.resolve(ok(accounts));
    if (url === "user/couriers") return Promise.resolve(ok(COURIERS));
    if (url.startsWith("activity-log/CarrierAccount/"))
      return Promise.resolve(ok({ logs: [], total: 0, page: 1, limit: 50 }));
    return Promise.reject(new Error(`kutilmagan GET ${url}`));
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/** `app/provider.tsx` dagi QueryClient sozlamalari (retry'dan tashqari — testlar tez). */
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

/** Oynaning yopilish animatsiyasini tugatadi — brauzer ~200 ms dan keyin shuni qiladi. */
const finishLeave = async (modal: HTMLElement) => {
  await waitFor(() => expect(modal).toHaveClass("ant-zoom-leave-active"));
  const mask = modal.closest(".ant-modal-root")?.querySelector(".ant-modal-mask");
  fireEvent(modal, new Event("animationend"));
  if (mask?.classList.contains("ant-fade-leave-active")) fireEvent(mask, new Event("animationend"));
};

/** Klaviatura foydalanuvchisi: fokusdagi tugmada Enter. */
const pressEnterOn = async (user: ReturnType<typeof userEvent.setup>, el: HTMLElement) => {
  await waitFor(() => expect(el).toHaveFocus());
  await user.keyboard("{Enter}");
};

/** So'rov yuborilgan bo'lsa, javob va qayta render ulguradigan pauza. */
const settle = () => new Promise((r) => setTimeout(r, 50));

const openKeySection = async () => {
  fireEvent.click(await findButton("FastPost Logistics"));
  await screen.findByText("Akkaunt yoqilgan");
  fireEvent.click(button("Kalit"));
  return findButton("Kalitni yangilash");
};

const startRotate = async (user: ReturnType<typeof userEvent.setup>) => {
  const rotate = await openKeySection();
  rotate.focus();
  await user.keyboard("{Enter}");
  const confirm = await findDialog("Kalitni yangilaysizmi?");
  const okBtn = button("Ha, yangilash", confirm);
  // `autoFocusButton: "ok"` — tasdiq OK tugmasi fokusda.
  await pressEnterOn(user, okBtn);
  expect(await screen.findByLabelText("Yangi API kalit")).toHaveValue(KEY_1);
  return { rotate, confirm, okBtn };
};

const fillCreate = async () => {
  fireEvent.click(await findButton("Yangi akkaunt"));
  const dialog = await findDialog("Yangi carrier akkaunt");
  fireEvent.change(within(dialog).getByLabelText("Kompaniya nomi"), {
    target: { value: "Yo'ldosh Kargo" },
  });
  fireEvent.mouseDown(dialog.querySelector(".ant-select-selector") as HTMLElement);
  fireEvent.click(await screen.findByText("[Carrier] Yo'ldosh Kargo — +998934107705"));
  await waitFor(() =>
    expect(dialog.querySelector(".ant-select-selection-item")).not.toBeNull(),
  );
  return dialog;
};

describe("Carrier API paneli — haqiqiy animatsiya bilan", () => {
  it("kalitni yangilash: yopilish animatsiyasida ikkinchi Enter kalitni qayta yangilamaydi", async () => {
    apiMock.post
      .mockResolvedValueOnce(ok({ account: FASTPOST, api_key: KEY_1 }))
      .mockResolvedValueOnce(ok({ account: FASTPOST, api_key: KEY_2 }));
    const user = userEvent.setup();
    renderPanel();
    const { confirm, okBtn } = await startRotate(user);

    // Tasdiq hali yopilish animatsiyasida, fokus — uning OK tugmasida.
    expect(confirm).toHaveClass("ant-zoom-leave");
    expect(okBtn).toHaveFocus();
    await user.keyboard("{Enter}");
    await settle();

    expect(apiMock.post).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Yangi API kalit")).toHaveValue(KEY_1);
  });

  it("to'xtatish va o'chirish: yopilish animatsiyasida ikkinchi Enter so'rovni takrorlamaydi", async () => {
    apiMock.post.mockResolvedValue(ok({ ...FASTPOST, is_active: false }));
    apiMock.delete
      .mockResolvedValueOnce(ok({ id: "acc-fast", deleted: true, courier_released: true }))
      .mockRejectedValueOnce(serverError("Carrier akkaunt topilmadi", 404));
    const user = userEvent.setup();
    renderPanel();
    fireEvent.click(await findButton("FastPost Logistics"));
    await screen.findByText("Akkaunt yoqilgan");

    const toggle = document.querySelector<HTMLButtonElement>('[aria-label="Akkaunt holati"]');
    toggle?.focus();
    await user.keyboard("{Enter}");
    let confirm = await findDialog("FastPost Logistics akkauntini to'xtatasizmi?");
    await pressEnterOn(user, button("Ha, to'xtatish", confirm));
    await screen.findByText("Akkaunt to'xtatildi");
    expect(confirm).toHaveClass("ant-zoom-leave");
    await user.keyboard("{Enter}");
    await settle();
    expect(apiMock.post).toHaveBeenCalledTimes(1);
    await finishLeave(confirm);

    const del = button(/^O'chirish$/);
    del.focus();
    await user.keyboard("{Enter}");
    confirm = await findDialog("FastPost Logistics akkauntini butunlay o'chirasizmi?");
    await pressEnterOn(user, button("Ha, o'chirish", confirm));
    await screen.findByText("Akkaunt o'chirildi — kuryer provayderdan bo'shatildi");
    expect(confirm).toHaveClass("ant-zoom-leave");
    await user.keyboard("{Enter}");
    await settle();
    expect(apiMock.delete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Carrier akkaunt topilmadi")).toBeNull();
  });

  it("yaratish: yopilish animatsiyasida «Yaratish» da ikkinchi Enter yana POST yubormaydi", async () => {
    apiMock.post
      .mockImplementationOnce(() => {
        accounts = [CREATED, ...accounts];
        return Promise.resolve(ok({ account: CREATED, api_key: KEY_1 }, 201));
      })
      .mockRejectedValueOnce(
        serverError("Bu kuryer allaqachon carrier akkauntiga bog'langan. Kalit yo'qolgan bo'lsa — kalitni yangilang", 409),
      );
    const user = userEvent.setup();
    renderPanel();
    const dialog = await fillCreate();

    const create = button("Yaratish", dialog);
    create.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByLabelText("Yangi API kalit")).toHaveValue(KEY_1);
    expect(dialog).toHaveClass("ant-zoom-leave");
    expect(create).toHaveFocus();
    await user.keyboard("{Enter}");
    await settle();

    expect(apiMock.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/allaqachon carrier akkauntiga bog'langan/)).toBeNull();
  });

  it("yaratish: oyna qayta ochilsa, yangi akkaunt yana yaratiladi (qulf ochiladi)", async () => {
    apiMock.post.mockImplementation(() => Promise.resolve(ok({ account: CREATED, api_key: KEY_1 }, 201)));
    renderPanel();
    let dialog = await fillCreate();
    fireEvent.click(button("Yaratish", dialog));
    await screen.findByLabelText("Yangi API kalit");
    await finishLeave(dialog);
    const keyModal = await findDialog("API kalit — faqat shu yerda");
    fireEvent.click(button("Nusxaladim, yopish"));
    await finishLeave(keyModal);

    dialog = await fillCreate();
    fireEvent.click(button("Yaratish", dialog));
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(2));
  });

  it("tahrirlash: yopilish animatsiyasida «Saqlash» da ikkinchi Enter PATCH ni takrorlamaydi", async () => {
    apiMock.patch.mockResolvedValue(ok({ ...FASTPOST, ip_allowlist: [] }));
    const user = userEvent.setup();
    renderPanel();
    fireEvent.click(await findButton("FastPost Logistics"));
    fireEvent.click(await findButton("O'zgartirish"));
    const dialog = await findDialog("Akkauntni tahrirlash — FastPost Logistics");
    fireEvent.change(within(dialog).getByLabelText("IP cheklovi"), { target: { value: "" } });

    const save = button("Saqlash", dialog);
    save.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Carrier akkaunt yangilandi");
    expect(dialog).toHaveClass("ant-zoom-leave");
    expect(save).toHaveFocus();
    await user.keyboard("{Enter}");
    await settle();

    expect(apiMock.patch).toHaveBeenCalledTimes(1);
  });

  it("kalit oynasi yopilgach fokus «Kalitni yangilash» ga qaytadi (body'ga tushmaydi)", async () => {
    apiMock.post.mockResolvedValue(ok({ account: FASTPOST, api_key: KEY_1 }));
    const user = userEvent.setup();
    renderPanel();
    const { rotate, confirm } = await startRotate(user);

    // Tasdiq yopilib DOM'dan chiqadi (useModal afterClose).
    await finishLeave(confirm);
    await waitFor(() => expect(confirm.isConnected).toBe(false));

    const keyModal = await findDialog("API kalit — faqat shu yerda");
    const close = button("Nusxaladim, yopish", keyModal);
    close.focus();
    await user.keyboard("{Enter}");
    await finishLeave(keyModal);

    await waitFor(() => expect(rotate).toHaveFocus());
  });

  it("yaratilgach kalit oynasi yopilsa fokus «Yangi akkaunt» ga qaytadi", async () => {
    apiMock.post.mockImplementation(() => {
      accounts = [CREATED, ...accounts];
      return Promise.resolve(ok({ account: CREATED, api_key: KEY_1 }, 201));
    });
    const user = userEvent.setup();
    renderPanel();
    const trigger = await findButton("Yangi akkaunt");
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = await findDialog("Yangi carrier akkaunt");
    fireEvent.change(within(dialog).getByLabelText("Kompaniya nomi"), {
      target: { value: "Yo'ldosh Kargo" },
    });
    fireEvent.mouseDown(dialog.querySelector(".ant-select-selector") as HTMLElement);
    fireEvent.click(await screen.findByText("[Carrier] Yo'ldosh Kargo — +998934107705"));
    const create = button("Yaratish", dialog);
    create.focus();
    await user.keyboard("{Enter}");
    const keyModal = await findDialog("API kalit — faqat shu yerda");

    await finishLeave(dialog);
    const close = button("Nusxaladim, yopish", keyModal);
    close.focus();
    await user.keyboard("{Enter}");
    await finishLeave(keyModal);

    await waitFor(() => expect(button("Yangi akkaunt")).toHaveFocus());
  });

  it("bo'sh holatdan yaratilsa (tugma yo'qoladi) — fokus joriy bo'lim tugmasiga", async () => {
    accounts = [];
    apiMock.post.mockImplementation(() => {
      accounts = [CREATED];
      return Promise.resolve(ok({ account: CREATED, api_key: KEY_1 }, 201));
    });
    const user = userEvent.setup();
    renderPanel();
    const trigger = await findButton("Akkaunt yaratish");
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = await findDialog("Yangi carrier akkaunt");
    fireEvent.change(within(dialog).getByLabelText("Kompaniya nomi"), {
      target: { value: "Yo'ldosh Kargo" },
    });
    fireEvent.mouseDown(dialog.querySelector(".ant-select-selector") as HTMLElement);
    fireEvent.click(await screen.findByText("[Carrier] Yo'ldosh Kargo — +998934107705"));
    fireEvent.click(button("Yaratish", dialog));
    const keyModal = await findDialog("API kalit — faqat shu yerda");
    await finishLeave(dialog);
    await waitFor(() => expect(trigger.isConnected).toBe(false));

    const close = button("Nusxaladim, yopish", keyModal);
    close.focus();
    await user.keyboard("{Enter}");
    await finishLeave(keyModal);

    await waitFor(() => expect(button("Akkauntlar")).toHaveFocus());
  });
});
