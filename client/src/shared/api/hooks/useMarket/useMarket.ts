import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const market = "market";

export const useMarket = () => {
  const client = useQueryClient();

  const createMarket = useMutation({
    mutationFn: (data: any) => api.post(`user/market`, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [market], refetchType: "active" }),
  });

  const getMarkets = () =>
    useQuery({
      queryKey: [market],
      queryFn: () => api.get("user/markets").then((res) => res.data),
    });

  const getMarketsNewOrder = () =>
    useQuery({
      queryKey: [market],
      queryFn: () => api.get("order/markets/new-orders").then((res) => res.data),
    });
  return {
    createMarket,
    getMarkets,
    getMarketsNewOrder
  };
};
