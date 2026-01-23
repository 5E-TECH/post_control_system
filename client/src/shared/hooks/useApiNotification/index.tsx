import { useNotificationApi } from "../../components/notification-provider";

type ApiError = any;

export const useApiNotification = () => {
  const api = useNotificationApi();

  const handleApiError = (
    err: ApiError,
    title: string,
    defaultMsg?: string
  ) => {
    const status = err?.response?.status;

    // 🔥 Backend dan kelgan error messageni olish
    const backendMessage =
      err?.response?.data?.message || // Direct message field
      err?.response?.data?.error?.message || // Error object ichidagi message
      err?.response?.data?.error || // Error string sifatida
      err?.message; // Axios error message

    // Agar backend dan tushunarli xabar kelgan bo'lsa, uni ishlatamiz
    let errorMessage = backendMessage;

    // Agar backend message bo'lmasa, status code ga qarab default message beramiz
    if (!errorMessage || typeof errorMessage !== 'string') {
      switch (status) {
        case 400:
          errorMessage = defaultMsg || "Noto'g'ri so'rov yuborildi. Ma'lumotlarni tekshiring.";
          break;
        case 401:
          errorMessage = defaultMsg || "Avtorizatsiya xatosi. Iltimos, tizimga qayta kiring.";
          break;
        case 403:
          errorMessage = defaultMsg || "Sizda bu amalni bajarishga ruxsat yo'q.";
          break;
        case 404:
          errorMessage = defaultMsg || "Ma'lumot topilmadi.";
          break;
        case 409:
          errorMessage = defaultMsg || "Ma'lumot allaqachon mavjud yoki mos emas.";
          break;
        case 422:
          errorMessage = defaultMsg || "Ma'lumotlar validatsiyadan o'tmadi. Iltimos, tekshiring.";
          break;
        case 500:
          errorMessage = defaultMsg || "Serverda nosozlik, keyinroq urinib ko'ring.";
          break;
        default:
          errorMessage = defaultMsg || "Serverda nosozlik, keyinroq urinib ko'ring.";
          break;
      }
    }

    // Agar error message array bo'lsa (validation errors), uni string ga aylantiramiz
    if (Array.isArray(errorMessage)) {
      errorMessage = errorMessage.join(', ');
    }

    api.error({
      message: title,
      description: errorMessage,
      placement: "topRight",
    });
  };

  const handleSuccess = (
    title: string = "Amaliyot muvaffaqiyatli bajarildi",
    description: string = ""
  ) => {
    api.success({
      message: title,
      description,
      placement: "topRight",
    });
  };

  const handleWarning = (
    title: string = "⚠️ Diqqat",
    description: string = "E'tibor bering, biror muammo yuz berdi."
  ) => {
    api.warning({
      message: title,
      description,
      placement: "topRight",
    });
  };
  return {
    handleApiError,
    handleSuccess,
    handleWarning,
  };
};
