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

  // Statistika
  const getAllRegionsStats = (
    startDate?: string,
    endDate?: string,
    enabled = true
  ) =>
    useQuery({
      queryKey: [region, "stats", "all", startDate, endDate],
      queryFn: () =>
        api
          .get("region/stats/all", { params: { startDate, endDate } })
          .then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 5, // 5 daqiqa
      refetchOnWindowFocus: false,
    });

  const getRegionDetailedStats = (
    id: string,
    startDate?: string,
    endDate?: string,
    enabled = true
  ) =>
    useQuery({
      queryKey: [region, "stats", id, startDate, endDate],
      queryFn: () =>
        api
          .get(`region/stats/${id}`, { params: { startDate, endDate } })
          .then((res) => res.data),
      enabled: enabled && !!id,
      staleTime: 1000 * 60 * 5, // 5 daqiqa
      refetchOnWindowFocus: false,
    });

  // Logist bilan ishlash
  const getRegionsWithLogist = (enabled = true) =>
    useQuery({
      queryKey: [region, "with-logist"],
      queryFn: () => api.get("region/with-logist").then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    });

  const assignMainCourier = useMutation({
    mutationFn: ({ regionId, courier_id }: { regionId: string; courier_id: string | null }) =>
      api.patch(`region/main-courier/${regionId}`, { courier_id }).then((res) => res.data),
    onSuccess: (_, { regionId }) => {
      client.invalidateQueries({ queryKey: [region, "stats", regionId] });
      client.invalidateQueries({ queryKey: [region, "stats"] });
    },
  });

  const assignLogist = useMutation({
    mutationFn: ({ regionId, logist_id }: { regionId: string; logist_id: string | null }) =>
      api.patch(`region/logist/${regionId}`, { logist_id }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "with-logist"] });
    },
  });

  const bulkAssignLogist = useMutation({
    mutationFn: ({ logist_id, region_ids }: { logist_id: string; region_ids: string[] }) =>
      api.post("region/logist/bulk-assign", { logist_id, region_ids }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "with-logist"] });
    },
  });

  return {
    getRegions,
    getRegionsById,
    getSatoMatchPreview,
    applySatoCodes,
    updateRegionSatoCode,
    updateRegionName,
    getAllRegionsStats,
    getRegionDetailedStats,
    getRegionsWithLogist,
    assignMainCourier,
    assignLogist,
    bulkAssignLogist,
  };
};
