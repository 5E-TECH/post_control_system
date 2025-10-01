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

  const getUserById = (id: string | undefined, params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params, id],
      queryFn: () => api.get(`user/${id}`, { params }).then((res) => res.data),
    });

  const getAdminAndRegister = (enabled = true, params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () =>
        api
          .get("user/registrator-and-admin", { params })
          .then((res) => res.data),
      enabled,
    });

  const updateUser = useMutation({
    mutationFn: ({ role, id, data }: { role: string; id: string; data: any }) =>
      api.patch(`user/${role}/${id}`, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
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
    getAdminAndRegister,
    getUserById,
    updateUser,
  };
};
