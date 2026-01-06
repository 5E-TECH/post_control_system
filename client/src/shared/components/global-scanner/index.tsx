import { useEffect } from "react";
import { useApiNotification } from "../../hooks/useApiNotification";
import { useOrder } from "../../api/hooks/useOrder";
import { useLocation } from "react-router-dom";

export function useGlobalScanner(refetch?: () => void) {
  const { handleApiError, handleSuccess } = useApiNotification();
  const { receiveOrderByScanerById } = useOrder();

  const location = useLocation();

  // URL dan marketId ni ajratib olish
  const pathParts = location.pathname.split("/");
  const marketId = pathParts[pathParts.length - 1];

  useEffect(() => {
    let scanned = "";
    let timer: any = null;
    const errorSound = new Audio(`${import.meta.env.BASE_URL}sound/error.mp3`);

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

          await receiveOrderByScanerById.mutateAsync({
            id: token as string,
            data: { marketId },
          });

          handleSuccess("Buyurtma muvaffaqiyatli qabul qilindi ✅");
          refetch?.();
        } catch (err: any) {
          handleApiError(err, "Buyurtma qabul qilishda xatolik!");

          // 🔊 Error tovushni o‘ynatish
          try {
            errorSound.currentTime = 0;
            errorSound
              .play()
              .catch((e) => console.error("Ovoz chiqmadi:", e));
          } catch (e) {
            console.error("Ovoz ijrosida xatolik:", e);
          }
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
  }, [
    receiveOrderByScanerById,
    handleApiError,
    handleSuccess,
    refetch,
    marketId,
  ]);
}
