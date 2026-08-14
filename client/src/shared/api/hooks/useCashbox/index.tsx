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
      queryKey: [cashbox, "user", id, params],
      queryFn: () => api.get(`cashbox/user/${id}`, {params}).then((res) => res.data),
      enabled: bool,
    });

  const getCashBoxHistoryById = (id: string | null, bool: boolean = true) =>
    useQuery({
      queryKey: [cashbox, "history", id],
      queryFn: () => api.get(`cashbox-history/${id}`).then((res) => res.data),
      enabled: bool,
    });

  const getCashboxMyCashbox = (params?:any) =>
    useQuery({
      queryKey: [cashbox, "my-cashbox", params],
      queryFn: () => api.get("cashbox/my-cashbox", {params}).then((res) => res.data),
    });

  const getCashBoxInfo = (bool: boolean = true, params?: any) =>
    useQuery({
      queryKey: [cashbox, "all-info", params],
      queryFn: () =>
        api.get(`cashbox/all-info`, { params }).then((res) => res.data),
      enabled: bool,
    });

  const getCashBoxMain = (params?:any) =>
    useQuery({
      queryKey: [cashbox, "main", params],
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

  // ==================== VIRTUAL KARTA HOOKLARI ====================

  const getCards = (params?: { includeInactive?: boolean }) =>
    useQuery({
      queryKey: [cashbox, "cards", params],
      queryFn: () =>
        api.get("cashbox/cards", { params }).then((res) => res.data),
    });

  const getCardMovements = (params?: {
    cardId?: string;
    page?: number;
    limit?: number;
  }) =>
    useQuery({
      queryKey: [cashbox, "card-movements", params],
      queryFn: () =>
        api
          .get("cashbox/cards/movements", { params })
          .then((res) => res.data),
    });

  const getCardLedger = (
    id: string | null,
    params?: { fromDate?: string; toDate?: string; page?: number; limit?: number },
    bool: boolean = true,
  ) =>
    useQuery({
      queryKey: [cashbox, "card-ledger", id, params],
      queryFn: () =>
        api.get(`cashbox/cards/${id}/ledger`, { params }).then((res) => res.data),
      enabled: bool && !!id,
    });

  const invalidateCards = () => {
    client.invalidateQueries({ queryKey: [cashbox] });
  };

  const createCard = useMutation({
    mutationFn: (data: { name: string; sort_order?: number }) =>
      api.post("cashbox/cards", data),
    onSuccess: invalidateCards,
  });

  const renameCard = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`cashbox/cards/${id}`, { name }),
    onSuccess: invalidateCards,
  });

  const setCardActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`cashbox/cards/${id}/status`, { is_active }),
    onSuccess: invalidateCards,
  });

  const transferCards = useMutation({
    mutationFn: (data: {
      from_card_id: string;
      to_card_id: string;
      amount: number;
      comment?: string;
    }) => api.post("cashbox/cards/transfer", data),
    onSuccess: invalidateCards,
  });

  const convertCard = useMutation({
    mutationFn: (data: {
      type: "card_to_cash" | "cash_to_card";
      card_id: string;
      amount: number;
      comment?: string;
    }) => api.post("cashbox/cards/convert", data),
    onSuccess: invalidateCards,
  });

  // ==================== FINANCIAL BALANCE HOOKS ====================

  const getFinancialBalanceHistory = (params?: {
    fromDate?: string;
    toDate?: string;
    sourceType?: string;
    page?: number;
    limit?: number;
  }) =>
    useQuery({
      queryKey: [cashbox, "financial-history", params],
      queryFn: () =>
        api
          .get("cashbox/financial-balanse/history", { params })
          .then((res) => res.data),
    });

  const getFinancialBalanceAnalytics = (params?: {
    fromDate?: string;
    toDate?: string;
  }) =>
    useQuery({
      queryKey: [cashbox, "financial-analytics", params],
      queryFn: () =>
        api
          .get("cashbox/financial-balanse/analytics", { params })
          .then((res) => res.data),
    });

  const getFinancialBalanceTopImpacts = (params?: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) =>
    useQuery({
      queryKey: [cashbox, "financial-top-impacts", params],
      queryFn: () =>
        api
          .get("cashbox/financial-balanse/top-impacts", { params })
          .then((res) => res.data),
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

  const paySalary = useMutation({
    mutationFn: (data: { user_id: string; amount: number; type?: string; comment?: string; card_id?: string }) =>
      api.post("cashbox/salary", data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [cashbox] });
      client.invalidateQueries({ queryKey: ["user"] });
      client.invalidateQueries({ queryKey: ["salary-history"] });
    },
  });

  // Kassadan investorga foyda taqsimoti
  const payInvestor = useMutation({
    mutationFn: (data: { investor_id: string; amount: number; type?: string; comment?: string; card_id?: string; note?: string }) =>
      api.post("cashbox/pay-investor", data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [cashbox] });
      client.invalidateQueries({ queryKey: ["investor"] });
      client.invalidateQueries({ queryKey: ["investor-admin"] });
    },
  });

  // Admin: tanlangan ishchining maosh to'lovlari tarixi
  const getSalaryHistory = (
    userId: string | undefined,
    params?: { fromDate?: string; toDate?: string; page?: number; limit?: number },
    bool: boolean = true,
  ) =>
    useQuery({
      queryKey: ["salary-history", userId, params],
      queryFn: () =>
        api
          .get(`cashbox/salary/history/${userId}`, { params })
          .then((res) => res.data),
      enabled: bool && !!userId,
    });

  // Ishchi: o'zining maosh to'lovlari tarixi
  const getMySalaryHistory = (
    params?: { fromDate?: string; toDate?: string; page?: number; limit?: number },
    bool: boolean = true,
  ) =>
    useQuery({
      queryKey: ["salary-history", "my", params],
      queryFn: () =>
        api
          .get("cashbox/salary/my-history", { params })
          .then((res) => res.data),
      enabled: bool,
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
    paySalary,
    payInvestor,
    // Virtual karta hooklari
    getCards,
    getCardMovements,
    getCardLedger,
    createCard,
    renameCard,
    setCardActive,
    transferCards,
    convertCard,
    getSalaryHistory,
    getMySalaryHistory,
    // Financial balance hooks
    getFinancialBalanceHistory,
    getFinancialBalanceAnalytics,
    getFinancialBalanceTopImpacts,
    // Shift hooks
    getCurrentShift,
    openShift,
    closeShift,
    getShiftHistory,
  };
};
