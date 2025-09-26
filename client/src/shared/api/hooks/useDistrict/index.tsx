import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const district = "district";

export const useDistrict = () => {
  const getDistricts = () =>
    useQuery({
      queryKey: [district],
      queryFn: () => api.get("district").then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getDistrictById = (id:string) =>
    useQuery({
      queryKey: [district],
      queryFn: () => api.get(`district/${id}`).then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });
  return { getDistricts, getDistrictById };
};
