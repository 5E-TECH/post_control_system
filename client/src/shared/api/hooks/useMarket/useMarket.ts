import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const market = "market";

export const useMarket = () => {
  const client = useQueryClient();

  const createMarket = useMutation({
    mutationFn: (data: any) => api.post(`market`, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [market] }),
  });
  return {
    createMarket,
  };
};
