import { useEffect } from "react";
import { useApiNotification } from "../../hooks/useApiNotification";
import { useLocation } from "react-router-dom";
import { usePost } from "../../api/hooks/usePost";

export function useRefusedPostScanner(
  refetch?: () => void,
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>
) {
  const { handleApiError, handleSuccess } = useApiNotification();
  const { checkRefusedPost } = usePost()
  const location = useLocation();

  // URL dan marketId ni ajratib olish
  const pathParts = location.pathname.split("/");
  const postId = pathParts[pathParts.length - 1];

  useEffect(() => {
    let scanned = "";
    let timer: any = null;

    const handleKeyPress = async (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const tokenValue = scanned.trim();
        scanned = "";

        if (!tokenValue) return;

        // Agar URL bo‘lsa faqat token qismini olamiz
        const token = tokenValue.startsWith("http")
          ? tokenValue.split("/").pop()
          : tokenValue;

        console.log(setSelectedIds);


        checkRefusedPost.mutate(
          {
            id: token as string,
            data: { postId },
          },
          {
            onSuccess: (res) => {
              console.log(res);

              const orderId = res.data.order?.id;
              console.log("✅ Order ID:", orderId);

              if (setSelectedIds) {
                setSelectedIds((prev) =>
                  prev.includes(orderId) ? prev : [...prev, orderId]
                );
              }

              handleSuccess("Buyurtma topildi ✅");
              refetch?.();
            },
            onError: (err) => {
              console.log(err);

              handleApiError(err, "Buyurtma pochtada topolmadi!");
              const errorSound = new Audio("/sound/error.mp3");
              errorSound.play().catch(() => { });
            },
          }
        );
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
    checkRefusedPost,
    handleApiError,
    handleSuccess,
    refetch,
    postId,
    setSelectedIds
  ]);
}
