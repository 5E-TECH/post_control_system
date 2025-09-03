import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const user = "user";

export const useUser = (path: string) => {
  const client = useQueryClient();

  const createUser = useMutation({
    mutationFn: (data: any) => api.post(`${path}`, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [user] }),
  });
  return {
    createUser,
  };
};
