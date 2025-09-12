import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const post = "post";

export const usePost = () => {
  const client = useQueryClient();

  const createPost = useMutation({
    mutationFn: (data: any) => api.post("order/receive", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  const getAllPosts = () =>
    useQuery({
      queryKey: [post],
      queryFn: () => api.get("post").then((res) => res.data),
    });

  const getPostById = (id: string) =>
    useQuery({
      queryKey: [post],
      queryFn: () => api.get(`post/orders/${id}`).then((res) => res.data),
    });
  return {
    createPost,
    getAllPosts,
    getPostById,
  };
};
