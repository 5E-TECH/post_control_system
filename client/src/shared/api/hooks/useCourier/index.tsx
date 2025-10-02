import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const courier = "courier";

export const useCourier = () => {

  const getCourier = (enabled = true, params?:any) =>
    useQuery({
      queryKey: [courier, params],
      queryFn: () => api.get("user/couriers", {params}).then((res) => res.data),
      enabled
    });
  return {
    getCourier,
  };
};
