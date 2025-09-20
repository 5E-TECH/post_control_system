import { useQuery} from '@tanstack/react-query';
import { api } from '../..';

export const chart = 'chart';

export const useHistory = () => {

  const getHistory = () => {
    return useQuery({
      queryKey: [chart],
      queryFn: () => api.get('cashbox/financial-balanse').then((res) => res.data),
    });
  };
  return { getHistory };
};
