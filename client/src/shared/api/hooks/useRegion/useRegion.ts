import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const region = "region";

export const useRegion = () => {
  const getRegions = () =>
    useQuery({
      queryKey: [region],
      queryFn: () => api.get("region").then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });
  return { getRegions };
};
