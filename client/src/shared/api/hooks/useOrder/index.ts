import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const order = "order";

export const useOrder = () => {
  const client = useQueryClient();

  const createOrder = useMutation({
    mutationFn: (data: any) => api.post("order", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [order] }),
  });

  const getOrders = () =>
    useQuery({
      queryKey: [order],
      queryFn: () => api.get("order").then((res) => res.data),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

  const getOrderMyMarkets = () =>
    useQuery({
      queryKey: [order],
      queryFn: () => api.get("order/market/my-new-orders"),
    });
  return {
    createOrder,
    getOrders,
    getOrderMyMarkets,
  };
};
