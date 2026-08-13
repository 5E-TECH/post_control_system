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

  // AI savol-javob (tool-use) — tabiiy tilda moliyaviy savollar.
  const askFinance = useMutation({
    mutationFn: (body: {
      question: string;
      fromDate?: string;
      toDate?: string;
    }) => api.post("financial-ai/ask", body).then((res) => res.data),
  });

  // Rasm/Excel fayl tahlili (multipart) — Elchin faylni o'qib, platforma bilan
  // solishtirib nomuvofiqlik topadi.
  const analyzeFile = useMutation({
    mutationFn: (form: FormData) =>
      api.post("financial-ai/analyze", form).then((res) => res.data),
  });

  // Elchin bilan yozishmalar tarixi (DB'да saqlanadi — har qurilmada ko'rinadi).
  const getChatHistory = (enabled: boolean = true) =>
    useQuery({
      queryKey: [financialAiKey, "chat-history"],
      queryFn: () =>
        api.get("financial-ai/chat-history").then((res) => res.data),
      enabled,
    });

  const clearChatHistory = useMutation({
    mutationFn: () => api.delete("financial-ai/chat-history"),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [financialAiKey, "chat-history"],
      }),
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

  return {
    getExpenseReport,
    refreshExpenseReport,
    askFinance,
    analyzeFile,
    getChatHistory,
    clearChatHistory,
  };
};
