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

  const getMarkets = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: [market, params],
      queryFn: () =>
        api.get("user/markets", { params }).then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getMarketByid = (id: string) =>
    useQuery({
      queryKey: [market, id],
      queryFn: () => api.get(`user/${id}`).then((res) => res.data),
    });

  const getMarketsNewOrder = (enabled: boolean = true, params?:any) =>
    useQuery({
      queryKey: [market, params],
      queryFn: () =>
        api.get("order/markets/new-orders", { params }).then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

      const getMarketsAllNewOrder = (params?:any, enabled: boolean = true,) =>
    useQuery({
      queryKey: [market, params],
      queryFn: () =>
        api.get("order/market/all-orders", { params }).then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });
  return {
    createMarket,
    getMarkets,
    getMarketsNewOrder,
    getMarketByid,
    getMarketsAllNewOrder
  };
};
