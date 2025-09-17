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

  const getAllPosts = (path?: string) =>
    useQuery({
      queryKey: [post, path],
      queryFn: () => api.get(`post/${path}`).then((res) => res.data),
    });

  const getPostById = (id: string, path: string) =>
    useQuery({
      queryKey: [post, id, path],
      queryFn: () => api.get(`post/${path}/${id}`).then((res) => res.data),
    });

  const getOldPostsCourier = () =>
    useQuery({
      queryKey: [post],
      queryFn: () => api.get("post/courier/old-posts").then((res) => res.data),
    });

  const getRejectedPostsCourier = () =>
    useQuery({
      queryKey: [post],
      queryFn: () => api.get("post/rejected").then((res) => res.data),
    });

  const getRejectedPostsByPostId = (id: string) =>
    useQuery({
      queryKey: [post, id],
      queryFn: () =>
        api.get(`post/orders/rejected/${id}`).then((res) => res.data),
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
      onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
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
  return {
    createPost,
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
  };
};
