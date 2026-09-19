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

  /**
   * Buyurtma formasi uchun operatorlar (faqat `id` + `name`).
   *
   * ⚠️ `getMyOperators` dan farqi — u FAQAT market roli uchun ochiq,
   * buyurtmani esa operator, registrator va admin ham yaratadi.
   * `marketId` faqat admin/registrator uchun kerak (market va operator
   * o'z marketini serverdan oladi).
   */
  const getSelectableOperators = (
    marketId?: string | null,
    enabled = true,
  ) =>
    useQuery({
      queryKey: [user, "selectable-operators", marketId ?? "self"],
      queryFn: () =>
        api
          .get(
            `user/operators/selectable${marketId ? `?market_id=${marketId}` : ""}`,
          )
          .then((res) => res.data),
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
  /**
   * Operatorni tahrirlash / bloklash (market).
   * Telefon va parol ATAYLAB yo'q — ular egasining o'zi orqali.
   */
  const updateOperator = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; status?: "active" | "inactive" };
    }) => api.patch(`user/operator/${id}`, data).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user, "operators"] }),
  });

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
    params: {
      page?: number;
      limit?: number;
      status?: string;
      /** `pending` — boshqa odam biriktirgan, hali qabul qilinmaganlar. */
      assignment?: "pending" | "accepted";
    } = {},
    enabled = true,
  ) =>
    useQuery({
      // ⚠️ `assignment` KALITGA kiradi — aks holda filtr almashganda
      // eski ro'yxat keshdan qaytardi.
      queryKey: [
        user,
        "my-orders",
        params.page,
        params.status,
        params.assignment,
      ],
      queryFn: () => {
        const query = new URLSearchParams();
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));
        if (params.status) query.set("status", params.status);
        if (params.assignment) query.set("assignment", params.assignment);
        return api
          .get(`user/my-orders?${query.toString()}`)
          .then((res) => res.data);
      },
      enabled,
      staleTime: 1000 * 60,
    });

  /** Biriktiruvni qabul qilish / rad etish (operator). */
  const acceptMyOrder = useMutation({
    mutationFn: (id: string) =>
      api.patch(`user/my-orders/${id}/accept`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user, "my-orders"] });
      client.invalidateQueries({ queryKey: [user, "my-earnings"] });
    },
  });

  const rejectMyOrder = useMutation({
    mutationFn: (id: string) =>
      api.patch(`user/my-orders/${id}/reject`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user, "my-orders"] });
      client.invalidateQueries({ queryKey: [user, "my-earnings"] });
    },
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
    getSelectableOperators,
    deleteOperator,
    acceptMyOrder,
    rejectMyOrder,
    getOperatorStats,
    updateOperator,
    updateOperatorCommission,
    getOperatorBalance,
    payOperator,
    getMyEarnings,
    getMyOrders,
  };
};
