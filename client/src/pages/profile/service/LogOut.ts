import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api";
import { buildAdminPath } from "../../../shared/const";

export const useSignOut = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => api.post("user/signout"),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["user"], refetchType: "active" });

      localStorage.removeItem("x-auth-token");

      window.location.href = buildAdminPath("login", { absolute: true });
    },
    onError: () => {
      localStorage.removeItem("x-auth-token");
      window.location.href = buildAdminPath("login", { absolute: true });
    },
  });
};
