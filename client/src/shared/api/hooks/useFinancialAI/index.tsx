import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

export const financialAiKey = "financial-ai";

// Moliyaviy AI — faqat-o'qish analitik surface (superadmin/admin).
export const useFinancialAI = () => {
  const client = useQueryClient();

  // Barcha davr snapshotlarini qo'lda qayta hisoblash (AI puli ketadi).
  const refreshExpenseReport = useMutation({
    mutationFn: () => api.post("financial-ai/expense-report/refresh"),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [financialAiKey] }),
  });

  // AI xarajat hisoboti (kunlik/haftalik/oylik/yillik) — saqlangan snapshot
  const getExpenseReport = (
    params?: {
      period?: "daily" | "weekly" | "monthly" | "yearly";
      fromDate?: string;
      toDate?: string;
    },
    enabled: boolean = true,
  ) =>
    useQuery({
      queryKey: [financialAiKey, "expense-report", params],
      queryFn: () =>
        api
          .get("financial-ai/expense-report", { params })
          .then((res) => res.data),
      enabled,
    });

  return { getExpenseReport, refreshExpenseReport };
};
