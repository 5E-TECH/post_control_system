import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../..", () => ({ api: apiMock }));

const {
  CARRIER_LIST_REFETCH_MS,
  useCarrierAccountActivity,
  useCarrierAccountList,
  useCarrierAccounts,
} = await import(".");

const KEY = "bpc_3f9a1c7e5b20d84f6a1e9c3b7d052f8e4a6c1b9d3e7f205a8c4e6b1d9f37c91f";

const view = {
  id: "8b0f5d8e-0000-4000-8000-000000000001",
  name: "FastPost Logistics",
  courier_user_id: "c-1",
  courier: { id: "c-1", name: "[Carrier] FastPost", phone_number: "+998901234567", status: "active" },
  api_key_masked: "bpc_…c91f",
  ip_allowlist: null,
  is_active: true,
  last_used_at: null,
  created_at: 1,
  updated_at: 1,
};

/** Server qobig'i: `successRes(data, code, message)`. */
const ok = (data: unknown) => ({ data: { statusCode: 200, message: "ok", data } });

const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

/** Kesh ichida ochiq kalit bormi — query VA mutation keshi. */
const cacheHasKey = (client: QueryClient) =>
  JSON.stringify([
    client.getQueryCache().getAll().map((q) => q.state.data),
    client.getMutationCache().getAll().map((m) => m.state.data),
  ]).includes(KEY);

afterEach(() => {
  vi.clearAllMocks();
});

describe("useCarrierAccounts", () => {
  it("ro'yxat: GET carrier-accounts, qobiq ochiladi", async () => {
    apiMock.get.mockResolvedValue(ok([view]));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCarrierAccounts(), { wrapper });

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(apiMock.get).toHaveBeenCalledWith("carrier-accounts");
    expect(result.current.list.data).toEqual([view]);
  });

  /**
   * ⚠️ ENG MUHIM SHART: ochiq kalit keshga tushmasin. Ro'yxat keshi javob
   * bilan yangilanmaydi (faqat invalidatsiya), mutatsiya esa `reset()` dan
   * keyin `gcTime: 0` bilan keshdan ham o'chadi.
   */
  it("yaratish: POST body, kalit faqat javobda — reset'dan keyin keshda qolmaydi", async () => {
    apiMock.get.mockResolvedValue(ok([]));
    apiMock.post.mockResolvedValue({
      data: { statusCode: 201, message: "yaratildi", data: { account: view, api_key: KEY } },
    });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCarrierAccounts(), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    let res: { api_key: string } | undefined;
    await act(async () => {
      res = await result.current.create.mutateAsync({
        name: "FastPost Logistics",
        courier_id: "c-1",
        ip_allowlist: ["203.0.113.10"],
      });
    });
    expect(apiMock.post).toHaveBeenCalledWith("carrier-accounts", {
      name: "FastPost Logistics",
      courier_id: "c-1",
      ip_allowlist: ["203.0.113.10"],
    });
    expect(res?.api_key).toBe(KEY);

    // Ro'yxat qayta so'raladi (invalidatsiya) — javob bilan to'ldirilmaydi.
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));

    act(() => result.current.create.reset());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    expect(cacheHasKey(client)).toBe(false);
  });

  it("kalitni yangilash: POST :id/rotate-key, keshda kalit qolmaydi", async () => {
    apiMock.get.mockResolvedValue(ok([view]));
    apiMock.post.mockResolvedValue(ok({ account: view, api_key: KEY }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCarrierAccounts(), { wrapper });

    await act(async () => {
      await result.current.rotateKey.mutateAsync(view.id);
    });
    expect(apiMock.post).toHaveBeenCalledWith(`carrier-accounts/${view.id}/rotate-key`);

    act(() => result.current.rotateKey.reset());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    expect(cacheHasKey(client)).toBe(false);
  });

  it("tahrirlash, holat va o'chirish — to'g'ri endpoint va body", async () => {
    apiMock.get.mockResolvedValue(ok([view]));
    apiMock.patch.mockResolvedValue(ok(view));
    apiMock.post.mockResolvedValue(ok({ ...view, is_active: false }));
    apiMock.delete.mockResolvedValue(ok({ id: view.id, deleted: true, courier_released: true }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCarrierAccounts(), { wrapper });

    await act(async () => {
      await result.current.update.mutateAsync({
        id: view.id,
        dto: { name: "Yangi nom", ip_allowlist: [] },
      });
      await result.current.setStatus.mutateAsync({ id: view.id, is_active: false });
    });
    let removed: unknown;
    await act(async () => {
      removed = await result.current.remove.mutateAsync(view.id);
    });

    expect(apiMock.patch).toHaveBeenCalledWith(`carrier-accounts/${view.id}`, {
      name: "Yangi nom",
      ip_allowlist: [],
    });
    expect(apiMock.post).toHaveBeenCalledWith(`carrier-accounts/${view.id}/status`, {
      is_active: false,
    });
    expect(apiMock.delete).toHaveBeenCalledWith(`carrier-accounts/${view.id}`);
    expect(removed).toEqual({ id: view.id, deleted: true, courier_released: true });
  });

  /**
   * Javob yo'qolgan bo'lsa ham (502/timeout — server esa yozgan) yoki boshqa
   * admin akkauntni o'zgartirgan bo'lsa (404) ro'yxat yangilansin:
   * niqoblangan kalit va holat eskirib qolmasin.
   */
  it("xatoda ham ro'yxat qayta so'raladi (onSettled)", async () => {
    apiMock.get.mockResolvedValue(ok([view]));
    apiMock.post.mockRejectedValue({ response: { status: 502, data: { message: "Bad Gateway" } } });
    apiMock.delete.mockRejectedValue({ response: { status: 404, data: { message: "Carrier akkaunt topilmadi" } } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCarrierAccounts(), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.rotateKey.mutateAsync(view.id).catch(() => undefined);
    });
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));

    await act(async () => {
      await result.current.remove.mutateAsync(view.id).catch(() => undefined);
    });
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(3));
  });

  it("ro'yxat har 60 s va oynaga qaytilganda yangilanadi («Oxirgi so'rov»)", async () => {
    apiMock.get.mockResolvedValue(ok([view]));
    const { client, wrapper } = setup();
    renderHook(() => useCarrierAccountList(), { wrapper });

    const query = client.getQueryCache().find({ queryKey: ["carrier-accounts"] });
    const options = query?.observers[0]?.options;
    expect(options?.refetchInterval).toBe(CARRIER_LIST_REFETCH_MS);
    expect(CARRIER_LIST_REFETCH_MS).toBe(60_000);
    expect(options?.refetchOnWindowFocus).toBe(true);
  });

  it("server xatosi chaqiruvchiga o'zgarmay yetadi (toast matni uchun)", async () => {
    apiMock.get.mockResolvedValue(ok([]));
    const err = { response: { status: 400, data: { message: "Kuryer faol emas (bloklangan)" } } };
    apiMock.post.mockRejectedValue(err);
    const { wrapper } = setup();
    const { result } = renderHook(() => useCarrierAccounts(), { wrapper });

    await expect(
      result.current.create.mutateAsync({ name: "X", courier_id: "c-1" }),
    ).rejects.toBe(err);
  });
});

describe("useCarrierAccountActivity", () => {
  it("tizim jurnali: GET activity-log/CarrierAccount/:id", async () => {
    apiMock.get.mockResolvedValue(ok({ logs: [{ id: "l1", action: "created" }], total: 1, page: 1, limit: 50 }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCarrierAccountActivity(view.id), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiMock.get).toHaveBeenCalledWith(`activity-log/CarrierAccount/${view.id}`, {
      params: { page: 1, limit: 50 },
    });
    expect(result.current.data?.logs).toHaveLength(1);
  });

  it("akkaunt tanlanmagan bo'lsa so'rov yuborilmaydi", () => {
    const { wrapper } = setup();
    renderHook(() => useCarrierAccountActivity(null), { wrapper });
    expect(apiMock.get).not.toHaveBeenCalled();
  });
});
