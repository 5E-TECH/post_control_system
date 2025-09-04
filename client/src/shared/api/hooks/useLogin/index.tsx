import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../";

export const login = "login";

export const useLogin = () => {
  const client = useQueryClient();

  const signinUser = useMutation({
    mutationFn: (data: any) => api.post("user/signin", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [login] }),
  });

  const signinMarket = useMutation({
    mutationFn: (data: any) => api.post("market/signin", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [login] }),
  });

  // const myProfile = useQuery({
  //   queryKey: []
  // })

  return {
    signinMarket,signinUser
  };
};
