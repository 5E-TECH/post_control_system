import { useEffect } from "react";
import { useApiNotification } from "../../hooks/useApiNotification";
import { useLocation } from "react-router-dom";
import { usePost } from "../../api/hooks/usePost";

export function usePostScanner(refetch?: () => void) {
  const { handleApiError, handleSuccess } = useApiNotification();
  const { checkPost } = usePost()

  const location = useLocation();

  // URL dan marketId ni ajratib olish
  const pathParts = location.pathname.split("/");
  const postId = pathParts[pathParts.length - 1];

  console.log(postId)

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

          await checkPost.mutateAsync({
            id: token as string,
            data: { postId },
          });

          handleSuccess("Buyurtma muvaffaqiyatli qabul qilindi ✅");
          refetch?.();
        } catch (err: any) {
          handleApiError(err, "Buyurtma qabul qilishda xatolik!");

          // 🔊 Error tovushni o‘ynatish
          try {
            const errorSound = new Audio("/sound/error.mp3");
            errorSound.play().catch((e) => console.error("Ovoz chiqmadi:", e));
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
    checkPost,
    handleApiError,
    handleSuccess,
    refetch,
    postId,
  ]);
}
