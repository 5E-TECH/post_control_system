import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const order = "order";

export const useOrder = () => {
  const client = useQueryClient();

  const createOrder = useMutation({
    mutationFn: (data: any) => api.post("order", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [order] }),
  });

  const sellOrder = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(`order/sell/${id}`, data).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [order], refetchType: "active" }),
  });

  const cancelOrder = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(`order/cancel/${id}`, data).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [order], refetchType: "active" }),
  });

  const rollbackOrder = useMutation({
    mutationFn: (id: string) =>
      api.post(`order/rollback/${id}`).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [order] }),
  });
  const partlySellOrder = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`order/partly-sell/${id}`, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [order] }),
  });

  const receiveOrderByScanerById = useMutation({
    mutationFn: (id: string) =>
      api.post(`order/receive/${id}`).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [order] }),
  });

  const courierReceiveOrderByScanerById = useMutation({
    mutationFn: (id: string) =>
      api.patch(`post/receive/order/${id}`).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [order] }),
  });

  const getOrders = (params?: any) =>
    useQuery({
      queryKey: [order, params],
      queryFn: () => api.get("order", { params }).then((res) => res.data),
    });

  const getOrderById = (id: string | undefined, params?: any) =>
    useQuery({
      queryKey: [order, params],
      queryFn: () => api.get(`order/${id}`, { params }).then((res) => res.data),
    });

  const getOrderByMarket = (marketId: string | undefined, params?: any) =>
    useQuery({
      queryKey: [order, marketId, params],
      queryFn: () =>
        api.get(`order/market/${marketId}`, { params }).then((res) => res.data),
    });

  const getOrdersByToken = (token: string) =>
    useQuery({
      queryKey: [order, token],
      queryFn: () => api.get(`order/qr-code/${token}`).then((res) => res.data),
    });

  const getMarketsByMyNewOrders = (params?: any) =>
    useQuery({
      queryKey: [order, params],
      queryFn: () =>
        api
          .get("order/market/my-new-orders", { params })
          .then((res) => res.data),
    });

  const getCourierOrders = (params?: any) =>
    useQuery({
      queryKey: [order, params],
      queryFn: () =>
        api.get("order/courier/orders", { params }).then((res) =>  {
          const orders = res.data;
         return orders}),
      
    });

  const deleteOrders = useMutation({
    mutationFn: (id: string) =>
      api.delete(`order/${id}`).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [order], refetchType: "active" }),
  });

  const updateOrders = useMutation({
    mutationFn: ({ id, data }: { id: string | undefined; data: any }) =>
      api.patch(`order/${id}`, data).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [order], refetchType: "active" }),
  });

  const updateOrdersUserAddress = useMutation({
    mutationFn: ({ id, data }: { id: string | undefined; data: any }) =>
      api.patch(`user/customer/address/${id}`, data).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [order], refetchType: "active" }),
  });

  const updateOrdersUserPhoneAndName = useMutation({
    mutationFn: ({ id, data }: { id: string | undefined; data: any }) =>
      api.patch(`user/customer/name-phone/${id}`, data).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [order], refetchType: "active" }),
  });

  return {
    createOrder,
    updateOrders,
    sellOrder,
    cancelOrder,
    rollbackOrder,
    partlySellOrder,
    receiveOrderByScanerById,
    getOrders,
    getOrderByMarket,
    getCourierOrders,
    getMarketsByMyNewOrders,
    getOrdersByToken,
    deleteOrders,
    getOrderById,
    updateOrdersUserAddress,
    updateOrdersUserPhoneAndName,
    courierReceiveOrderByScanerById,
  };
};
