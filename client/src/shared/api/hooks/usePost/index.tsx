import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const post = "post";

export const usePost = () => {
  const client = useQueryClient();

  const createPost = useMutation({
    mutationFn: (data: any) => api.post("order/receive", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [post] }),
  });

  return {
    createPost,
  };
};
