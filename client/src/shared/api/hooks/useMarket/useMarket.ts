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

  const getMarkets = (enabled = true, params?: { search: string }) =>
    useQuery({
      queryKey: [market, params],
      queryFn: () =>
        api.get("user/markets", { params }).then((res) => res.data),
      enabled,
    });

  const getMarketByid = (id: string) =>
    useQuery({
      queryKey: [market],
      queryFn: () => api.get(`user/${id}`).then((res) => res.data),
    });

  const getMarketsNewOrder = (enabled = true) =>
  useQuery({
    queryKey: [market],
    queryFn: () =>
      api.get("order/markets/new-orders").then((res) => res.data),
    enabled,
  });
  return {
    createMarket,
    getMarkets,
    getMarketsNewOrder,
    getMarketByid,
  };
};
