import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../..';

export const user = 'user';

export const useProfile = () => {
  const client = useQueryClient();

  const getUser = () => {
    return useQuery({
      queryKey: [user],
      queryFn: () => api.get('user/profile').then((res) => res.data),
    });
  };

  const updateProfil = useMutation({
    mutationFn: ({data }: { id: string; data: any }) =>
      api.patch(`user/self`, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user] });
    },
  });
  return { getUser, updateProfil };
};
