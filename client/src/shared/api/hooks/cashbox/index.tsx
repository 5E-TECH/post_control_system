import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const cashbox = "cashbox";

export const useCashBox = () => {
  const getCashBoxById = (id: string) =>
    useQuery({
      queryKey: [cashbox],
      queryFn: () => api.get(`cashbox/user/${id}`).then((res) => res.data),
    });

  return { getCashBoxById };
};
