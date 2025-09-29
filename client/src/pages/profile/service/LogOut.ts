import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api";

export const useSignOut = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => api.post("user/signout"),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["user"], refetchType: "active" });

      localStorage.removeItem("x-auth-token");

      window.location.href = "/login";
    },
    onError: () => {
      localStorage.removeItem("x-auth-token");
      window.location.href = "/login";
    },
  });
};
