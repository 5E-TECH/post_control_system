import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api';

export const user = 'user';

export const useProductss = () => {
  const getProduct = () => {
    return useQuery({
      queryKey: [user],
      queryFn: () => api.get('product').then((res) => res.data),
    });
  };
  return { getProduct };
};
