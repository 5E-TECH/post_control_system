import { useQuery } from "@tanstack/react-query";
import { api } from "../..";

export const financialAiKey = "financial-ai";

// Moliyaviy AI — faqat-o'qish analitik surface (superadmin/admin).
export const useFinancialAI = () => {
  // AI xarajat hisoboti (kunlik/haftalik/oylik/yillik)
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

  return { getExpenseReport };
};
