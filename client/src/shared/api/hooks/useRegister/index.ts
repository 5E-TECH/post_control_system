import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const user = "user";

export interface IUserFilter {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export const useUser = (path?: string) => {
  const client = useQueryClient();

  const createUser = useMutation({
    mutationFn: (data: any) => api.post(`user/${path}`, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const getUser = (params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () => api.get("user", { params }).then((res) => res.data),
    });

  const getUserById = (id: string | undefined, params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params, id],
      queryFn: () => api.get(`user/${id}`, { params }).then((res) => res.data),
    });

  const getAdminAndRegister = (enabled = true, params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () =>
        api
          .get("user/registrator-and-admin", { params })
          .then((res) => res.data),
      enabled,
    });

  const updateUser = useMutation({
    mutationFn: ({ role, id, data }: { role: string; id: string; data: any }) =>
      api.patch(`user/${role}/${id}`, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const removeUser = useMutation({
    mutationFn: (id: string) =>
      api.delete(`user/${id}`).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [user] }),
  });

  const getUsersExceptMarket = (params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () =>
        api.get("user/except-market", { params }).then((res) => res.data),
    });

  // Customer suggestion by phone number
  const suggestCustomer = (phone: string, market_id?: string) =>
    useQuery({
      queryKey: ["customer-suggest", phone, market_id],
      queryFn: () =>
        api
          .get("user/customer/suggest", { params: { phone, market_id } })
          .then((res) => res.data),
      enabled: !!phone && phone.replace(/\D/g, "").length >= 9,
      staleTime: 30000,
      retry: false,
    });

  // Get customer order history
  const getCustomerOrderHistory = (
    customerId: string,
    market_id?: string,
    enabled = true
  ) =>
    useQuery({
      queryKey: ["customer-history", customerId, market_id],
      queryFn: () =>
        api
          .get(`user/customer/${customerId}/history`, { params: { market_id } })
          .then((res) => res.data),
      enabled: enabled && !!customerId,
    });

  // Get all logists
  const getLogists = (search?: string, enabled = true) =>
    useQuery({
      queryKey: [user, "logists", search],
      queryFn: () =>
        api
          .get("user/logists", { params: search ? { search } : {} })
          .then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 5,
    });

  // Delete logist (soft delete)
  const deleteLogist = useMutation({
    mutationFn: (id: string) =>
      api.delete(`user/logist/${id}`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user, "logists"] });
      client.invalidateQueries({ queryKey: [user] });
    },
  });

  // Create operator (for market)
  const createOperator = useMutation({
    mutationFn: (data: any) => api.post("user/operator", data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user, "operators"], refetchType: "active" }),
  });

  // Get my operators (market)
  const getMyOperators = (enabled = true) =>
    useQuery({
      queryKey: [user, "operators"],
      queryFn: () =>
        api.get("user/my-operators").then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 2,
    });

  // Delete operator
  const deleteOperator = useMutation({
    mutationFn: (id: string) =>
      api.delete(`user/operator/${id}`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user, "operators"] });
    },
  });

  // Get operator stats (orders, success rate)
  const getOperatorStats = (id: string | null, enabled = true) =>
    useQuery({
      queryKey: [user, "operator-stats", id],
      queryFn: () =>
        api.get(`user/operator/${id}/stats`).then((res) => res.data),
      enabled: enabled && !!id,
      staleTime: 1000 * 60 * 2,
    });

  // Update operator commission settings
  const updateOperatorCommission = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`user/operator/${id}/commission`, data).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user, "operators"] }),
  });

  // Get operator balance (earnings & payments)
  const getOperatorBalance = (id: string | null, enabled = true) =>
    useQuery({
      queryKey: [user, "operator-balance", id],
      queryFn: () =>
        api.get(`user/operator/${id}/balance`).then((res) => res.data),
      enabled: enabled && !!id,
      staleTime: 1000 * 60,
    });

  // Pay operator
  const payOperator = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`user/operator/${id}/pay`, data).then((res) => res.data),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({
        queryKey: [user, "operator-balance", variables.id],
      });
    },
  });

  // Get my earnings (operator role)
  const getMyEarnings = (
    params: { fromDate?: string; toDate?: string } = {},
    enabled = true,
  ) =>
    useQuery({
      queryKey: [user, "my-earnings", params.fromDate, params.toDate],
      queryFn: () => {
        const query = new URLSearchParams();
        if (params.fromDate) query.set("fromDate", params.fromDate);
        if (params.toDate) query.set("toDate", params.toDate);
        const qs = query.toString();
        return api.get(`user/my-earnings${qs ? `?${qs}` : ""}`).then((res) => res.data);
      },
      enabled,
      staleTime: 1000 * 60,
    });

  // Get my orders (operator role)
  const getMyOrders = (
    params: { page?: number; limit?: number; status?: string } = {},
    enabled = true,
  ) =>
    useQuery({
      queryKey: [user, "my-orders", params.page, params.status],
      queryFn: () => {
        const query = new URLSearchParams();
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));
        if (params.status) query.set("status", params.status);
        return api
          .get(`user/my-orders?${query.toString()}`)
          .then((res) => res.data);
      },
      enabled,
      staleTime: 1000 * 60,
    });

  // ==================== INVESTOR HOOKS ====================

  const createInvestor = useMutation({
    mutationFn: (data: any) => api.post("user/investor", data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user, "investors"] }),
  });

  const getInvestors = (enabled = true) =>
    useQuery({
      queryKey: [user, "investors"],
      queryFn: () => api.get("user/investors").then((res) => res.data),
      enabled,
      staleTime: 0,
    });

  const getInvestorDetail = (
    id: string | null,
    params: { fromDate?: string; toDate?: string } = {},
    enabled = true,
  ) =>
    useQuery({
      queryKey: [user, "investor-detail", id, params.fromDate, params.toDate],
      queryFn: () => {
        const q = new URLSearchParams();
        if (params.fromDate) q.set("fromDate", params.fromDate);
        if (params.toDate) q.set("toDate", params.toDate);
        const qs = q.toString();
        return api
          .get(`user/investor/${id}${qs ? `?${qs}` : ""}`)
          .then((res) => res.data);
      },
      enabled: enabled && !!id,
      staleTime: 1000 * 60,
    });

  const recordInvestorDeposit = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`user/investor/${id}/deposit`, data),
    onSuccess: (_d, v) => {
      client.invalidateQueries({ queryKey: [user, "investor-detail", v.id] });
      client.invalidateQueries({ queryKey: [user, "investors"] });
    },
  });

  const payInvestor = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`user/investor/${id}/pay`, data),
    onSuccess: (_d, v) => {
      client.invalidateQueries({ queryKey: [user, "investor-detail", v.id] });
      client.invalidateQueries({ queryKey: [user, "investors"] });
    },
  });

  const updateInvestor = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`user/investor/${id}`, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user, "investors"] }),
  });

  const deleteInvestor = useMutation({
    mutationFn: (id: string) =>
      api.delete(`user/investor/${id}`).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user, "investors"] }),
  });

  const addManualEarning = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`user/investor/${id}/manual-earning`, data),
    onSuccess: (_d, v) => {
      client.invalidateQueries({ queryKey: [user, "investor-detail", v.id] });
      client.invalidateQueries({ queryKey: [user, "investors"] });
    },
  });

  const refundInvestorDeposit = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`user/investor/${id}/refund`, data),
    onSuccess: (_d, v) => {
      client.invalidateQueries({ queryKey: [user, "investor-detail", v.id] });
      client.invalidateQueries({ queryKey: [user, "investors"] });
    },
  });

  const getMyInvestorDashboard = (
    params: { fromDate?: string; toDate?: string } = {},
    enabled = true,
  ) =>
    useQuery({
      queryKey: [user, "my-investor-dashboard", params.fromDate, params.toDate],
      queryFn: () => {
        const q = new URLSearchParams();
        if (params.fromDate) q.set("fromDate", params.fromDate);
        if (params.toDate) q.set("toDate", params.toDate);
        const qs = q.toString();
        return api
          .get(`user/my-investor-dashboard${qs ? `?${qs}` : ""}`)
          .then((res) => res.data);
      },
      enabled,
      staleTime: 1000 * 60,
    });

  return {
    createUser,
    getUser,
    getUsersExceptMarket,
    getAdminAndRegister,
    getUserById,
    updateUser,
    removeUser,
    suggestCustomer,
    getCustomerOrderHistory,
    getLogists,
    deleteLogist,
    createOperator,
    getMyOperators,
    deleteOperator,
    getOperatorStats,
    updateOperatorCommission,
    getOperatorBalance,
    payOperator,
    getMyEarnings,
    getMyOrders,
    // Investor hooks (superadmin)
    createInvestor,
    getInvestors,
    getInvestorDetail,
    recordInvestorDeposit,
    payInvestor,
    updateInvestor,
    deleteInvestor,
    refundInvestorDeposit,
    addManualEarning,
    // Investor hooks (investor own)
    getMyInvestorDashboard,
  };
};
