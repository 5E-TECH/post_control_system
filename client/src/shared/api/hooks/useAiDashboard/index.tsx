import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const aiDashboardKey = "ai-usage";

// AI dashboard — real xarajat + AI buyurtma analitikasi (superadmin/admin).
export const useAiDashboard = () => {
  // To'liq agregat: xarajat (USD/so'm), feature/model kesimlari, kunlik trend,
  // AI buyurtma soni, o'rtacha xarajat, Elchin prompt narxi.
  const getDashboard = (
    params?: { fromDate?: string; toDate?: string },
    enabled: boolean = true,
  ) =>
    useQuery({
      queryKey: [aiDashboardKey, "dashboard", params],
      queryFn: () =>
        api.get("ai-usage/dashboard", { params }).then((res) => res.data),
      enabled,
    });

  // AI orqali yaratilgan buyurtmalar ro'yxati (davr bo'yicha).
  const getAiOrders = (
    params?: { fromDate?: string; toDate?: string; limit?: number },
    enabled: boolean = true,
  ) =>
    useQuery({
      queryKey: [aiDashboardKey, "ai-orders", params],
      queryFn: () =>
        api.get("ai-usage/ai-orders", { params }).then((res) => res.data),
      enabled,
    });

  return { getDashboard, getAiOrders };
};
