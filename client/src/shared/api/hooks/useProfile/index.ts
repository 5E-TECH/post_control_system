import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const user = "user";

export const useProfile = () => {
  const client = useQueryClient();

  const getUser = (bool: boolean = true) => {
    return useQuery({
      queryKey: [user],
      queryFn: () => api.get("user/profile").then((res) => res.data),
      enabled: bool,
    });
  };

  const updateProfil = useMutation({
    mutationFn: ({ data }: { id: string; data: any }) =>
      api.patch(`user/self`, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user] });
    },
  });

  const updateAvatar = useMutation({
    mutationFn: (avatar_id: string) =>
      api.patch(`user/self`, { avatar_id }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user] });
    },
  });

  return { getUser, updateProfil, updateAvatar };
};
