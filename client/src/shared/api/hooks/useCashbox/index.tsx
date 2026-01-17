import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const cashbox = "cashbox";
export const shift = "shift";

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

  const getCashBoxById = (id: string | undefined, bool: boolean = true, params?:any) =>
    useQuery({
      queryKey: [cashbox, id, params],
      queryFn: () => api.get(`cashbox/user/${id}`, {params}).then((res) => res.data),
      enabled: bool,
    });

  const getCashBoxHistoryById = (id: string | null, bool: boolean = true) =>
    useQuery({
      queryKey: [cashbox, id],
      queryFn: () => api.get(`cashbox-history/${id}`).then((res) => res.data),
      enabled: bool,
    });

  const getCashboxMyCashbox = (params?:any) =>
    useQuery({
      queryKey: [cashbox, params],
      queryFn: () => api.get("cashbox/my-cashbox", {params}).then((res) => res.data),
    });

  const getCashBoxInfo = (bool: boolean = true, params?: any) =>
    useQuery({
      queryKey: [cashbox, params],
      queryFn: () =>
        api.get(`cashbox/all-info`, { params }).then((res) => res.data),
      enabled: bool,
    });

  const getCashBoxMain = (params?:any) =>
    useQuery({
      queryKey: [cashbox, params],
      queryFn: () => api.get(`cashbox/main`, {params}).then((res) => res.data),
    });

  const cashboxSpand = useMutation({
    mutationFn: ({ data }: { data: any }) => api.patch(`cashbox/spend`, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [cashbox] });
    },
  });

  const cashboxFill = useMutation({
    mutationFn: ({ data }: { data: any }) => api.patch(`cashbox/fill`, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["cashbox"] });
    },
  });

  // ==================== SHIFT (SMENA) HOOKS ====================

  const getCurrentShift = () =>
    useQuery({
      queryKey: [shift, "current"],
      queryFn: () => api.get("cashbox/shift/current").then((res) => res.data),
    });

  const openShift = useMutation({
    mutationFn: () => api.post("cashbox/shift/open"),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [shift] });
    },
  });

  const closeShift = useMutation({
    mutationFn: (comment?: string) =>
      api.post("cashbox/shift/close", { comment }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [shift] });
      client.invalidateQueries({ queryKey: [cashbox] });
    },
  });

  const getShiftHistory = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: [shift, "history", params],
      queryFn: () =>
        api.get("cashbox/shift/history", { params }).then((res) => res.data),
    });

  return {
    getCashBoxById,
    getCashBoxInfo,
    getCashboxMyCashbox,
    getCashBoxHistoryById,
    getCashBoxMain,
    createPaymentCourier,
    createPaymentMarket,
    cashboxSpand,
    cashboxFill,
    // Shift hooks
    getCurrentShift,
    openShift,
    closeShift,
    getShiftHistory,
  };
};
