import { exportToExcel } from "./export-download-excel-with-courier";

export interface PostExcelMeta {
  qrCodeToken?: string;
  regionName?: string;
  courierName?: string;
  totalOrders?: number | string;
  date?: string | number;
}

// Pochta buyurtmalaridan Excel qatorlarini quradi. Mapping pochta jo'natish
// paytidagi eksport bilan AYNAN bir xil (mail-detail handleClick) — eski
// pochtadan olingan Excel jo'natish paytidagi fayl bilan mos bo'lishi uchun.
export const buildPostOrderRows = (orders: any[]) =>
  (orders || []).map((order: any, inx: number) => ({
    N: inx + 1,
    Mijoz: order?.customer?.name || "",
    "Telefon raqam": order?.customer?.phone_number,
    Firma: order?.market?.name,
    Narxi: Number((order?.total_price ?? 0) / 1000),
    Manzil: order?.where_deliver === "center" ? "Markazgacha" : "Uygacha",
    Tuman: order?.district?.name || order?.customer?.district?.name,
    Izoh: order?.comment || "",
  }));

// Pochta buyurtmalarini Excel'ga eksport qiladi (eski pochta kartasidagi
// "Excel" tugmasi uchun). Sarlavha ma'lumotlari kartada mavjud post obyektidan
// olinadi; buyurtmalar esa alohida so'rov bilan yuklanadi.
export const exportPostOrdersToExcel = (
  orders: any[],
  meta: PostExcelMeta = {},
) =>
  exportToExcel(buildPostOrderRows(orders), "pochtalar", {
    qrCodeToken: meta.qrCodeToken,
    regionName: meta.regionName,
    courierName: meta.courierName,
    totalOrders: meta.totalOrders ?? (orders?.length || 0),
    date: meta.date as string | undefined,
  });
