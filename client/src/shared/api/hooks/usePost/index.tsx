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

  const createThermalPrint = useMutation({
    mutationFn: (data: any) => api.post("printer/thermal-receipt", data),
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
      staleTime: 1000 * 60 * 3, // 3 daqiqa fresh
      gcTime: 1000 * 60 * 15,   // 15 daqiqa cache
    });

  const getOldPostsCourier = (params: any) =>
    useQuery({
      queryKey: [post, params],
      queryFn: () => api.get("post/courier/old-posts", params).then((res) => res.data),
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
  return {
    createPost,
    createPrint,
    createBrowserPrint,
    createThermalPrint,
    createThermalPdf,
    getAllPosts,
    getPostById,
    sendAndGetCouriersByPostId,
    getOldPostsCourier,
    getRejectedPostsCourier,
    getRejectedPostsByPostId,
    sendPost,
    receivePost,
    canceledPost,
    receiveCanceledPost,
    checkPost,
    checkRefusedPost
  };
};
