import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

// Admin equity boshqaruvi: investor yaratish + kapital/ulush/taqsimot yozish.
export const investorAdminKey = "investor-admin";

export const useInvestorAdmin = () => {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [investorAdminKey] });

  const getInvestors = () =>
    useQuery({
      queryKey: [investorAdminKey, "list"],
      queryFn: () => api.get("investor-admin/list").then((r) => r.data),
    });

  const getInvestorSummary = (id?: string) =>
    useQuery({
      queryKey: [investorAdminKey, "summary", id],
      queryFn: () =>
        api.get(`investor-admin/${id}/summary`).then((r) => r.data),
      enabled: !!id,
    });

  const getInvestorLedger = (
    id?: string,
    params: { page?: number; limit?: number } = {},
  ) =>
    useQuery({
      queryKey: [investorAdminKey, "ledger", id, params],
      queryFn: () =>
        api.get(`investor-admin/${id}/ledger`, { params }).then((r) => r.data),
      enabled: !!id,
    });

  const getInvestorDaily = (
    id?: string,
    params: { startDate?: string; endDate?: string } = {},
  ) =>
    useQuery({
      queryKey: [investorAdminKey, "daily", id, params],
      queryFn: () =>
        api.get(`investor-admin/${id}/daily`, { params }).then((r) => r.data),
      enabled: !!id,
    });

  const createInvestor = useMutation({
    mutationFn: (body: { name: string; phone_number: string; password: string }) =>
      api.post("user/investor", body),
    onSuccess: invalidate,
  });

  const recordCapital = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api.post(`investor-admin/${id}/capital`, body),
    onSuccess: invalidate,
  });

  const setOwnership = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api.post(`investor-admin/${id}/ownership`, body),
    onSuccess: invalidate,
  });

  const recordDistribution = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api.post(`investor-admin/${id}/distribution`, body),
    onSuccess: invalidate,
  });

  const recordWithdrawal = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api.post(`investor-admin/${id}/capital-withdrawal`, body),
    onSuccess: invalidate,
  });

  return {
    getInvestors,
    getInvestorSummary,
    getInvestorLedger,
    getInvestorDaily,
    createInvestor,
    recordCapital,
    setOwnership,
    recordDistribution,
    recordWithdrawal,
  };
};
