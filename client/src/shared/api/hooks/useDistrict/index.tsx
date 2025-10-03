import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

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

  const getDistrictById = (id:string, enabled = true) =>
    useQuery({
      queryKey: [district],
      queryFn: () => api.get(`district/${id}`).then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

   const updateDistrict = useMutation({
  mutationFn: ({ id, data }: { id: string; data: any }) =>
    api.patch(`district/${id}`, data).then((res) => res.data), // 👈 faqat data qaytarayapmiz
  onSuccess: () => {
    client.invalidateQueries({ queryKey: [district] });
  },
});
  return { getDistricts, getDistrictById, updateDistrict };
};
