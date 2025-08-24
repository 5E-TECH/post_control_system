import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../";

export const login = "login";

export const useLogin = () => {
  const client = useQueryClient();

  const createUser = useMutation({
    mutationFn: (data: any) => api.post("users/login", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [login] }),
  });

  return {
    createUser,
  };
};
