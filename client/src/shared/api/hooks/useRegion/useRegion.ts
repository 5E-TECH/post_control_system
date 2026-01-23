import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const region = "region";

export const useRegion = () => {
  const client = useQueryClient();

  const getRegions = (enabled = true) =>
    useQuery({
      queryKey: [region],
      queryFn: () => api.get("region").then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getRegionsById = (id: string, bool?: boolean) =>
    useQuery({
      queryKey: [region, id],
      queryFn: () => api.get(`region/${id}`).then((res) => res.data),
      enabled: bool,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  // SATO code bilan ishlash
  const getSatoMatchPreview = () =>
    useQuery({
      queryKey: [region, "sato-match"],
      queryFn: () => api.get("region/sato-match/preview").then((res) => res.data),
      staleTime: 0,
      refetchOnWindowFocus: false,
    });

  const applySatoCodes = useMutation({
    mutationFn: () => api.post("region/sato-match/apply").then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  const updateRegionSatoCode = useMutation({
    mutationFn: ({ id, sato_code }: { id: string; sato_code: string }) =>
      api.patch(`region/sato/${id}`, { sato_code }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  const updateRegionName = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`region/name/${id}`, { name }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  return {
    getRegions,
    getRegionsById,
    getSatoMatchPreview,
    applySatoCodes,
    updateRegionSatoCode,
    updateRegionName,
  };
};
