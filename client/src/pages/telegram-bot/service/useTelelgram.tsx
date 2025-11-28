import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/index";

export const loginTelegram = "loginTelegram";

export const useLoginTelegran = () => {
  const client = useQueryClient();

  const signinUser = useMutation({
    mutationFn: (data: any) => api.post("user/telegram/signin", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [loginTelegram] }),
  });

//   const signinMarket = useMutation({
//     mutationFn: (data: any) => api.post("market/signin", data),
//     onSuccess: () => client.invalidateQueries({ queryKey: [login] }),
//   });

  return {
    signinUser
  };
};
