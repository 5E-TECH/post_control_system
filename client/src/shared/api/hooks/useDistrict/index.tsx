import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";
import { region } from "../useRegion/useRegion";

export const district = "district";

export const useDistrict = () => {
  const client = useQueryClient();

  const getDistricts = () =>
    useQuery({
      queryKey: [district],
      queryFn: () => api.get("district").then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const createDistrict = useMutation({
    mutationFn: (data: any) => api.post(`district`, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [district], refetchType: "active" });
      client.invalidateQueries({ queryKey: [district, "sato-match"] });
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  const getDistrictById = (id: string | undefined | null, enabled = true) =>
    useQuery({
      queryKey: [district, id],
      queryFn: () => api.get(`district/${id}`).then((res) => res.data),
      // ID mavjud va valid UUID bo'lgandagina so'rov yuborilsin
      enabled: enabled && !!id && id !== 'undefined' && id !== 'null',
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const updateDistrict = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`district/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [district] });
      client.invalidateQueries({ queryKey: [district, "sato-match"] });
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  const updateDistrictName = useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: any }) =>
      api.patch(`district/name/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [district] });
      client.invalidateQueries({ queryKey: [district, "sato-match"] });
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  // SATO code bilan ishlash
  const getSatoMatchPreview = () =>
    useQuery({
      queryKey: [district, "sato-match"],
      queryFn: () => api.get("district/sato-match/preview").then((res) => res.data),
      staleTime: 0,
      refetchOnWindowFocus: false,
    });

  const applySatoCodes = useMutation({
    mutationFn: () => api.post("district/sato-match/apply").then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [district] });
      client.invalidateQueries({ queryKey: [district, "sato-match"] });
      client.invalidateQueries({ queryKey: [region] });
    },
  });

  const updateDistrictSatoCode = useMutation({
    mutationFn: ({ id, sato_code }: { id: string; sato_code: string }) =>
      api.patch(`district/sato/${id}`, { sato_code }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [district] });
      client.invalidateQueries({ queryKey: [district, "sato-match"] });
      client.invalidateQueries({ queryKey: [region] });
    },
  });

  const deleteDistrict = useMutation({
    mutationFn: (id: string) => api.delete(`district/${id}`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [district] });
      client.invalidateQueries({ queryKey: [district, "sato-match"] });
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  const mergeDistricts = useMutation({
    mutationFn: (data: { source_district_ids: string[]; target_district_id: string }) =>
      api.post("district/merge", data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [district] });
      client.invalidateQueries({ queryKey: [district, "sato-match"] });
      client.invalidateQueries({ queryKey: [region] });
      client.invalidateQueries({ queryKey: [region, "sato-match"] });
    },
  });

  return {
    getDistricts,
    getDistrictById,
    createDistrict,
    updateDistrictName,
    updateDistrict,
    getSatoMatchPreview,
    applySatoCodes,
    updateDistrictSatoCode,
    deleteDistrict,
    mergeDistricts,
  };
};
