import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Tezkor amal» — xato bergan amallardan keyingi belgilar (2026-11-22).
 *
 * Ilgari bekor qilish tugagach `cancelIds` butunlay tozalanardi: xato bergan buyurtma (hali WAITING) sukut
 * «sotiladi» ga o'tib, keyingi «Kun yakunlash» da kuryer bekor qilmoqchi bo'lgan posilka SOTILIB ketardi. Endi faqat
 * muvaffaqiyatli bekorlar ro'yxatdan chiqadi; xato bo'lsa «ertaga» belgilari ham qoladi (qayta urinishda ular
 * sotilmaydi).
 */

const ALI = "aaaaaaaa-0000-4000-8000-000000000001";
const VALI = "bbbbbbbb-0000-4000-8000-000000000002";

const mocks = vi.hoisted(() => ({
  bulkCancel: vi.fn(),
  bulkSell: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "uz" } }),
}));
vi.mock("../../shared/api/hooks/useOrder", () => ({
  useOrder: () => ({
    getCourierOrders: () => ({
      data: {
        data: {
          data: [
            { id: ALI, qr_code_token: "TOKENA1", total_price: 100000, status: "waiting", customer: { name: "Ali" } },
            { id: VALI, qr_code_token: "TOKENB2", total_price: 100000, status: "waiting", customer: { name: "Vali" } },
          ],
        },
      },
      isLoading: false,
      refetch: mocks.refetch,
    }),
    findOrderByQrToken: vi.fn(),
    bulkSellOrders: { mutateAsync: mocks.bulkSell },
    bulkCancelOrders: { mutateAsync: mocks.bulkCancel },
  }),
}));
vi.mock("../../shared/hooks/useApiNotification", () => ({ useApiNotification: () => ({ handleApiError: vi.fn() }) }));
vi.mock("../../shared/components/CourierDeadlineBanner", () => ({ default: () => null }));
vi.mock("../../shared/components/courier-camera-scanner", () => ({ default: () => null }));
vi.mock("../../shared/helpers/normalizeQrToken", () => ({ normalizeQrToken: (v: string) => v.trim() }));

import CourierBulkPage from "./index";

/** USB (HID) skaner: tugmalar + Enter. */
const scan = (value: string) =>
  act(() => {
    for (const key of value) window.dispatchEvent(new KeyboardEvent("keypress", { key }));
    window.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter" }));
  });

const cancelOnlyButton = () => screen.getByText("btn_cancel_only").closest("button") as HTMLButtonElement;

/** «Kun yakunlash» → xavfsizlik katagi → tasdiq. */
const finalize = async () => {
  fireEvent.click(screen.getByText("btn_finalize"));
  fireEvent.click(await screen.findByText("warning_checkbox"));
  fireEvent.click(screen.getAllByText("btn_confirm").at(-1)!);
};

const closeResult = async () => {
  fireEvent.click(await screen.findByText("result_close", {}, { timeout: 5000 }));
};

beforeEach(() => {
  localStorage.clear();
  mocks.refetch.mockReset();
  mocks.bulkCancel.mockReset().mockResolvedValue({
    data: { successful: [], totalSuccess: 0, failed: [{ id: ALI, reason: "Server xatosi" }], totalFailed: 1 },
  });
  mocks.bulkSell.mockReset().mockResolvedValue({ data: { successful: [VALI], totalSuccess: 1, failed: [] } });
});

describe("Tezkor amal — xato bergan amallardan keyin belgilar saqlanadi", () => {
  it("⭐ «Faqat bekorlar» xato bersa — «bekor» belgisi qoladi; «Kun yakunlash» uni yana BEKOR qiladi, sotmaydi", async () => {
    render(<CourierBulkPage />);
    await scan("TOKENA1");
    expect(cancelOnlyButton()).not.toBeDisabled();

    fireEvent.click(cancelOnlyButton());
    fireEvent.click(await screen.findByText("btn_confirm"));
    await waitFor(() => expect(mocks.bulkCancel).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(mocks.bulkCancel.mock.calls[0][0].order_ids).toEqual([ALI]);
    await closeResult();

    // Belgi joyida: «Faqat bekorlar» hali ham faol.
    await waitFor(() => expect(cancelOnlyButton()).not.toBeDisabled());

    mocks.bulkCancel.mockResolvedValue({ data: { successful: [ALI], totalSuccess: 1, failed: [], totalFailed: 0 } });
    await finalize();
    await waitFor(() => expect(mocks.bulkSell).toHaveBeenCalledTimes(1), { timeout: 5000 });

    // Ali qayta BEKORGA ketdi, sotuvga — faqat Vali.
    expect(mocks.bulkCancel).toHaveBeenCalledTimes(2);
    expect(mocks.bulkCancel.mock.calls[1][0].order_ids).toEqual([ALI]);
    expect(mocks.bulkSell.mock.calls[0][0].order_ids).toEqual([VALI]);
  }, 30_000);

  it("⭐ «Kun yakunlash» da xato bo'lsa — «ertaga» belgilari qoladi: qayta urinish ularni sotmaydi", async () => {
    mocks.bulkSell.mockResolvedValue({
      data: { successful: [], totalSuccess: 0, failed: [{ id: VALI, reason: "Server xatosi" }] },
    });
    render(<CourierBulkPage />);
    fireEvent.click(screen.getAllByText(/^mode_keep/)[0]);
    await scan("TOKENA1");

    await finalize();
    await waitFor(() => expect(mocks.bulkSell).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(mocks.bulkSell.mock.calls[0][0].order_ids).toEqual([VALI]);
    await closeResult();

    // Qayta urinish: Ali («ertaga») hali ham sotuvga kirmaydi.
    mocks.bulkSell.mockResolvedValue({ data: { successful: [VALI], totalSuccess: 1, failed: [] } });
    await finalize();
    await waitFor(() => expect(mocks.bulkSell).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(mocks.bulkSell.mock.calls[1][0].order_ids).toEqual([VALI]);
    expect(mocks.bulkCancel).not.toHaveBeenCalled();
  }, 30_000);

  it("hammasi muvaffaqiyatli — kun yopiladi: belgilar tozalanadi, saqlangan holat o'chiriladi", async () => {
    render(<CourierBulkPage />);
    fireEvent.click(screen.getAllByText(/^mode_keep/)[0]);
    await scan("TOKENA1");
    await waitFor(() => expect(localStorage.length).toBeGreaterThan(0));

    await finalize();
    await waitFor(() => expect(mocks.bulkSell).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(mocks.bulkSell.mock.calls[0][0].order_ids).toEqual([VALI]);
    await closeResult();

    // «Ertaga» belgisi tozalandi — keyingi yakunlashda Ali ham sukut «sotiladi».
    await finalize();
    await waitFor(() => expect(mocks.bulkSell).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(mocks.bulkSell.mock.calls[1][0].order_ids).toEqual([ALI, VALI]);
  }, 30_000);
});
