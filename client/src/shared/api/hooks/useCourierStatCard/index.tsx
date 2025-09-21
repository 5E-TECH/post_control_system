import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

interface IParams {
  startDate?: string;
  endDate?: string;
}

export const chart = "chart";

export const useCourierStatCard = () => {
  const getChart = (params: IParams) => {
    return useQuery({
      queryKey: [chart, params],
      queryFn: () =>
        api
          .get("dashboard/overview", { params: { ...params } })
          .then((res) => res.data),
    });
  };
  return { getChart };
};
