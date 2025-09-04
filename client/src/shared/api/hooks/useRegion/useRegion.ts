import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const region = "region";

export const useRegion = () => {
  const getRegions = () =>
    useQuery({
      queryKey: [region],
      queryFn: () => api.get("region").then((res) => res.data),
    });
  return { getRegions };
};
