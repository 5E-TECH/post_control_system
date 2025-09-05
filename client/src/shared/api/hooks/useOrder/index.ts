import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const order = "order";

export const useOrder = () => {
  const getOrders = () =>
    useQuery({
      queryKey: [order],
      queryFn: () => api.get("order").then((res) => res.data),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  return {
    getOrders,
  };
};
