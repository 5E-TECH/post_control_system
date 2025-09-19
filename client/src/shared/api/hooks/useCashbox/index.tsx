import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const cashbox = "cashbox";

export const useCashBox = () => {
  const client = useQueryClient();

  const createPaymentCourier = useMutation({
    mutationFn: (data: any) => api.post("cashbox/payment/courier", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [cashbox] }),
  });

  const createPaymentMarket = useMutation({
    mutationFn: (data: any) => api.post("cashbox/payment/market", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [cashbox] }),
  });

  const getCashBoxById = (id: string | undefined) =>
    useQuery({
      queryKey: [cashbox, id],
      queryFn: () => api.get(`cashbox/user/${id}`).then((res) => res.data),
    });

  const getCashBoxInfo = () =>
    useQuery({
      queryKey: [cashbox],
      queryFn: () => api.get(`cashbox/all-info`).then((res) => res.data),
    });

  const getCashBoxMain = () =>
    useQuery({
      queryKey: [cashbox],
      queryFn: () => api.get(`cashbox/main`).then((res) => res.data),
    });

  return {
    getCashBoxById,
    getCashBoxInfo,
    createPaymentCourier,
    createPaymentMarket,
    getCashBoxMain
  };
};
