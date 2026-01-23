import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

interface IParams {
  period?: "daily" | "weekly" | "monthly" | "yearly";
  startDate?: string;
  endDate?: string;
}

export const revenueKey = "revenue";

export const useRevenue = () => {
  const getRevenue = (params: IParams) => {
    return useQuery({
      queryKey: [revenueKey, params],
      queryFn: () =>
        api
          .get("dashboard/revenue", { params: { ...params } })
          .then((res) => res.data),
    });
  };
  return { getRevenue };
};
