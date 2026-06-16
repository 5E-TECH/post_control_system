import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../";

export const login = "login";

export const useLogin = () => {
  const client = useQueryClient();

  // Login bo'lganda butun query cache'ni tozalaymiz — aks holda oldingi
  // akkountning (yoki sessiyaning) keshlangan buyurtma/kassa/foydalanuvchi
  // ma'lumotlari yangi akkountga ko'rinib qolishi mumkin (noto'g'ri attributatsiya
  // xavfi). Login'dan keyin ma'lumot baribir qaytadan yuklanadi.
  const signinUser = useMutation({
    mutationFn: (data: any) => api.post("user/signin", data),
    onSuccess: () => client.clear(),
  });

  const signinMarket = useMutation({
    mutationFn: (data: any) => api.post("market/signin", data),
    onSuccess: () => client.clear(),
  });

  return {
    signinMarket,signinUser
  };
};
