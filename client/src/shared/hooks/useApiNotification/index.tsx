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

    let errorMessage =
      defaultMsg || "Serverda nosozlik, keyinroq urinib ko‘ring.";

    switch (status) {
      case 400:
        errorMessage = "Noto‘g‘ri so‘rov yuborildi.";
        break;
      case 401:
        errorMessage = "Avtorizatsiya xatosi. Iltimos, tizimga qayta kiring.";
        break;
      case 403:
        errorMessage = "Sizda bu amalni bajarishga ruxsat yo‘q.";
        break;
      case 404:
        errorMessage = "Ma’lumot topilmadi.";
        break;
      case 409:
        errorMessage = "Ma’lumot allaqachon mavjud yoki mos emas.";
        break;
      case 500:
        errorMessage = "Serverda nosozlik, keyinroq urinib ko‘ring.";
        break;
      default:
        errorMessage = "Serverda nosozlik, keyinroq urinib ko‘ring.";
        break;
    }

    api.error({
      message: title,
      description: errorMessage,
      placement: "topRight",
    });
  };

  const handleSuccess = (
    title: string = "✅ Amaliyot muvaffaqiyatli bajarildi",
    description: string = ""
  ) => {
    api.success({
      message: title,
      description,
      placement: "topRight",
    });
  };

  return {
    handleApiError,
    handleSuccess,
  };
};
