import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

// Investor (ulushdor) faqat-o'qish aggregat endpointlari uchun React Query hooklar.
// Barcha so'rov `api` orqali (baseURL /api/v1/, Bearer avto). Javob envelope:
// { statusCode, message, data } — iste'molchi `res.data?.data` o'qiydi.
export const investorKey = "investor";

interface RangeParams {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}
interface RevenueParams extends RangeParams {
  period?: "daily" | "weekly" | "monthly" | "yearly";
}

export const useInvestor = () => {
  const getOverview = (params: RangeParams = {}) =>
    useQuery({
      queryKey: [investorKey, "overview", params],
      queryFn: () =>
        api.get("investor/overview", { params }).then((res) => res.data),
    });

  const getRevenue = (params: RevenueParams = {}) =>
    useQuery({
      queryKey: [investorKey, "revenue", params],
      queryFn: () =>
        api.get("investor/revenue", { params }).then((res) => res.data),
    });

  const getOrderFlow = (params: RangeParams = {}) =>
    useQuery({
      queryKey: [investorKey, "order-flow", params],
      queryFn: () =>
        api.get("investor/order-flow", { params }).then((res) => res.data),
    });

  const getRegions = (params: RangeParams = {}) =>
    useQuery({
      queryKey: [investorKey, "regions", params],
      queryFn: () =>
        api.get("investor/regions", { params }).then((res) => res.data),
    });

  const getLeaderboards = () =>
    useQuery({
      queryKey: [investorKey, "leaderboards"],
      queryFn: () =>
        api.get("investor/leaderboards").then((res) => res.data),
    });

  const getCashPosition = () =>
    useQuery({
      queryKey: [investorKey, "cash-position"],
      queryFn: () =>
        api.get("investor/cash-position").then((res) => res.data),
    });

  return {
    getOverview,
    getRevenue,
    getOrderFlow,
    getRegions,
    getLeaderboards,
    getCashPosition,
  };
};
