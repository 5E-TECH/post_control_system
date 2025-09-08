import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const user = "user";

export const useUser = (path?: string) => {
  const client = useQueryClient();

  const createUser = useMutation({
    mutationFn: (data: any) => api.post(`user/${path}`, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [user] }),
  });

  const getUser = () =>
    useQuery({
      queryKey: [user],
      queryFn: () => api.get("user").then((res) => res.data),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  return {
    createUser,
    getUser,
  };
};
