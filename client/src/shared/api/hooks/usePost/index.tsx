import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const post = "post";

export const usePost = () => {
  const client = useQueryClient();

  const createPost = useMutation({
    mutationFn: (data: any) => api.post("order/receive", data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [post], refetchType: "active" }),
  });

  const createPrint = useMutation({
    mutationFn: (data: any) => api.post("printer/print", data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [post], refetchType: "active" }),
  });

  const createBrowserPrint = useMutation({
    mutationFn: (data: any) => api.post("printer/receipt", data),
  });

  const createThermalPdf = useMutation({
    mutationFn: (data: any) =>
      api.post("printer/thermal-pdf", data, { responseType: "blob" }),
  });

  const getAllPosts = (path?: string, params?: any) =>
    useQuery({
      queryKey: [post, path, params],
      queryFn: () => api.get(`post/${path}`, { params }).then((res) => res.data),
    });

  const getPostById = (id: string, path: string, bool: boolean = true, params?: any) =>
    useQuery({
      queryKey: [post, id, path, params],
      queryFn: () =>
        api.get(`post/orders/${path}${id}`, params).then((res) => res.data),
      enabled: bool,
      // Skaner manifesti yangi turishi uchun: operator tabga qaytganda ro'yxat
      // qayta yuklanadi → sahifa ochilgandan keyin qo'shilgan buyurtmalar manifestga
      // kiradi, skaner "miss"lari kamayadi. staleTime qisqartirildi (30s) — fokusda
      // refetch samarali bo'lsin (faqat shu sahifalar getPostById ishlatadi).
      refetchOnWindowFocus: true,
      staleTime: 1000 * 30,   // 30 soniya fresh
      gcTime: 1000 * 60 * 15, // 15 daqiqa cache
    });

  // Eski pochtalar filtri uchun (admin): viloyat↔kuryer juftliklari.
  const getOldPostsFilterOptions = (enabled = true) =>
    useQuery({
      queryKey: [post, "old-filter-options"],
      queryFn: () =>
        api.get("post/old/filter-options").then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 5,
    });

  const getOldPostsCourier = (params: any) =>
    useQuery({
      queryKey: [post, "courier-old", params],
      queryFn: () =>
        api
          .get("post/courier/old-posts", { params })
          .then((res) => res.data),
    });

  const getRejectedPostsCourier = () =>
    useQuery({
      queryKey: [post],
      queryFn: () => api.get("post/courier/rejected").then((res) => res.data),
    });

  const getRejectedPostsByPostId = (id: string) =>
    useQuery({
      queryKey: [post, "rejected", id],
      queryFn: () =>
        api.get(`post/orders/rejected/${id}`).then((res) => res.data),
      staleTime: 1000 * 60 * 3, // 3 daqiqa fresh
      gcTime: 1000 * 60 * 15,   // 15 daqiqa cache
    });

  const sendAndGetCouriersByPostId = () =>
    useMutation({
      mutationFn: (id: string) =>
        api.post(`/post/courier/${id}`).then((res) => res.data),
    });

  const sendPost = () =>
    useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) =>
        api.patch(`post/${id}`, data).then((res) => res.data),
      onSuccess: () =>
        client.invalidateQueries({
          queryKey: [post],
          refetchType: "active",
        }),
    });

  const receivePost = () =>
    useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) =>
        api.patch(`post/receive/${id}`, data).then((res) => res.data),
      onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
    });

  const canceledPost = () =>
    useMutation({
      mutationFn: (data: any) =>
        api.post("post/cancel", data).then((res) => res.data),
      onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
    });

  // Kuryerning BARCHA bekor qilingan buyurtmalarini bir martada yuborish
  // (sahifalashdan qat'i nazar — 10 talab alohida yuborish muammosini hal qiladi)
  const canceledPostAll = () =>
    useMutation({
      mutationFn: () => api.post("post/cancel/all").then((res) => res.data),
      onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
    });

  const receiveCanceledPost = () =>
    useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) =>
        api.post(`post/cancel/receive/${id}`, data).then((res) => res.data),
      onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
    });

  const checkPost = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) =>
      api.post(`post/check/${id}`, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  const checkRefusedPost = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) =>
      api.post(`post/check/cancel/${id}`, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  const getReturnRequests = () =>
    useQuery({
      queryKey: [post, "return-requests"],
      queryFn: () => api.get("post/return-requests/list").then((res) => res.data),
    });

  const approveReturnRequests = useMutation({
    mutationFn: (data: { order_ids: string[] }) =>
      api.post("post/return-requests/approve", data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  const rejectReturnRequests = useMutation({
    mutationFn: (data: { order_ids: string[] }) =>
      api.post("post/return-requests/reject", data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  const reassignPost = useMutation({
    mutationFn: ({ id, courier_id }: { id: string; courier_id: string }) =>
      api.patch(`post/reassign/${id}`, { courier_id }).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  // Kuryer post ichidagi bitta buyurtmani QR token orqali skaner bilan qabul qiladi
  const receiveOrderByToken = useMutation({
    mutationFn: (token: string) =>
      api
        .patch(`post/receive/order/scan/token/${token}`)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  // Kuryer pochta qabul qilingach, biror buyurtma kelmagan deb qaytarish
  // so'rovini yuboradi
  const requestOrderReturnByCourier = useMutation({
    mutationFn: (orderId: string) =>
      api
        .patch(`post/order/${orderId}/request-return`)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  return {
    createPost,
    createPrint,
    createBrowserPrint,
    createThermalPdf,
    getAllPosts,
    getPostById,
    sendAndGetCouriersByPostId,
    getOldPostsCourier,
    getOldPostsFilterOptions,
    getRejectedPostsCourier,
    getRejectedPostsByPostId,
    sendPost,
    receivePost,
    canceledPost,
    canceledPostAll,
    receiveCanceledPost,
    checkPost,
    checkRefusedPost,
    getReturnRequests,
    approveReturnRequests,
    rejectReturnRequests,
    reassignPost,
    receiveOrderByToken,
    requestOrderReturnByCourier,
  };
};
