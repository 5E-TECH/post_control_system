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
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getPostById = (id: string) =>
    useQuery({
      queryKey: [post],
      queryFn: () => api.get(`post/${id}`).then((res) => res.data),
    });
  return {
    createPost,
    getAllPosts,
    getPostById,
  };
};
