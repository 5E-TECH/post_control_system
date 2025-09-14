import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const order = "order";

export const useOrder = () => {
  const client = useQueryClient();

  const createOrder = useMutation({
    mutationFn: (data: any) => api.post("order", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [order] }),
  });

  const sellOrder = useMutation({
    mutationFn: (id: string, data?: any) =>
      api.post(`order/sell/${id}`, data).then((res) => res.data),
  });

  const cancelOrder = useMutation({
    mutationFn: (id: string, data?: any) =>
      api.post(`order/cancel/${id}`, data).then((res) => res.data),
  });

  const getOrders = () =>
    useQuery({
      queryKey: [order],
      queryFn: () => api.get("order").then((res) => res.data),
    });

  const getOrderByMarket = (marketId: string) =>
    useQuery({
      queryKey: [order, marketId],
      queryFn: () =>
        api.get(`order/market/${marketId}`).then((res) => res.data),
    });

  const getCourierOrders = () =>
    useQuery({
      queryKey: [order],
      queryFn: () => api.get("order/courier/orders").then((res) => res.data),
    });

  return {
    createOrder,
    sellOrder,
    cancelOrder,
    getOrders,
    getOrderByMarket,
    getCourierOrders,
  };
};
