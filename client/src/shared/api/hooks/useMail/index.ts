import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const post = "post";

export const usePost = () => {
  const getAllPosts = () =>
    useQuery({
      queryKey: [post],
      queryFn: () => api.get("post").then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });
  return { getAllPosts };
};
