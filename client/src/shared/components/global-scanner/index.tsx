import { useEffect } from "react";
import { useApiNotification } from "../../hooks/useApiNotification";
import { useOrder } from "../../api/hooks/useOrder";

export function useGlobalScanner(refetch?: () => void) {
  const { handleApiError, handleSuccess } = useApiNotification();
  const { receiveOrderByScanerById } = useOrder();

  useEffect(() => {
    let scanned = "";
    let timer: any = null;

    const handleKeyPress = async (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const tokenValue = scanned.trim();
        scanned = "";

        if (!tokenValue) return;

        try {
          // Agar URL bo‘lsa faqat token qismini olamiz
          const token = tokenValue.startsWith("http")
            ? tokenValue.split("/").pop()
            : tokenValue;

          await receiveOrderByScanerById.mutateAsync(token as string);
          handleSuccess("Buyurtma muvaffaqiyatli qabul qilindi ✅");
          refetch?.();
        } catch (err: any) {
          handleApiError(err, "Buyurtma qabul qilishda xatolik!");
        }
      } else {
        scanned += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => {
          scanned = "";
        }, 1500);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [receiveOrderByScanerById, handleApiError, handleSuccess, refetch]);
}
