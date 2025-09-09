import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const market = "market";

export const useMarket = () => {
  const client = useQueryClient();

  const createMarket = useMutation({
    mutationFn: (data: any) => api.post(`user/market`, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [market] }),
  });

  const getMarkets = () =>
    useQuery({
      queryKey: [market],
      queryFn: () => api.get("").then((res) => res.data),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  return {
    createMarket,
    getMarkets,
  };
};
