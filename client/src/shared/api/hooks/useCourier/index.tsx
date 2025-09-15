import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const courier = "courier";

export const useCourier = () => {

  const getCourier = () =>
    useQuery({
      queryKey: [courier],
      queryFn: () => api.get("user/couriers").then((res) => res.data),
    });
  return {
    getCourier,
  };
};
