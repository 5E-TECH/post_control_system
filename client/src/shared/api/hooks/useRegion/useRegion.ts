import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const region = "region";

export const useRegion = () => {
  const getRegions = (enabled = true) =>
    useQuery({
      queryKey: [region],
      queryFn: () => api.get("region").then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getRegionsById = (id: string, bool?:boolean) =>
    useQuery({
      queryKey: [region, id],
      queryFn: () => api.get(`region/${id}`).then((res) => res.data),
      enabled: bool,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });
  return { getRegions, getRegionsById };
};
