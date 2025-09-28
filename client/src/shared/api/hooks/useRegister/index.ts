import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const user = "user";

export interface IUserFilter {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export const useUser = (path?: string) => {
  const client = useQueryClient();

  const createUser = useMutation({
    mutationFn: (data: any) => api.post(`user/${path}`, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const getUser = (params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () => api.get("user", { params }).then((res) => res.data),
    });

  const getUsersExceptMarket = (params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () =>
        api.get("user/except-market", { params }).then((res) => res.data),
    });

  return {
    createUser,
    getUser,
    getUsersExceptMarket,
  };
};
