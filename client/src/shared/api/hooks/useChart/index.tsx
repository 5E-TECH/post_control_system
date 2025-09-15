import { useQuery} from '@tanstack/react-query';
import { api } from '../..';

export const chart = 'chart';

export const useChart = () => {

  const getChart = () => {
    return useQuery({
      queryKey: [chart],
      queryFn: () => api.get('dashboard/overview').then((res) => res.data),
    });
  };
  return { getChart };
};
