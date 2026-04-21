import { memo, useEffect, useRef, useState } from "react";
import { useLoginTelegran } from "./service/useTelelgram";
import { useDispatch } from "react-redux";
import { removeToken, setToken } from "../../shared/lib/features/login/authSlice";
import { useNavigate } from "react-router-dom";
import Suspensee from "../../shared/ui/Suspensee";
import { buildAdminPath } from "../../shared/const";

type BotState =
  | { status: "loading" }
  | { status: "outside-telegram" }
  | { status: "error"; message: string }
  | { status: "ready" };

const TelegramBot = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { signinUser } = useLoginTelegran();

  const [state, setState] = useState<BotState>({ status: "loading" });
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    dispatch(removeToken());

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;

    const handleLoad = () => {
      const telegram = (window as any).Telegram?.WebApp;
      if (!telegram || !telegram.initData) {
        setState({ status: "outside-telegram" });
        return;
      }

      try {
        telegram.ready();
        telegram.expand();
      } catch (_) {
        /* ignore */
      }

      signinUser.mutate(
        { data: telegram.initData },
        {
          onSuccess: (res: any) => {
            const accessToken = res?.data?.data?.access_token;
            if (!accessToken) {
              setState({
                status: "error",
                message:
                  "Kirish tokenini olib bo'lmadi. Iltimos, botda tokenni yuborib ro'yxatdan o'ting.",
              });
              return;
            }
            dispatch(setToken({ access_token: accessToken }));
            setState({ status: "ready" });
            navigate(buildAdminPath("authtelegram"), { replace: true });
          },
          onError: (err: any) => {
            const message =
              err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              "Siz botda ro'yxatdan o'tmagansiz. Iltimos, @bot chatiga kirib market tokeningizni yuboring.";
            setState({ status: "error", message });
          },
        }
      );
    };

    const handleError = () => {
      setState({
        status: "error",
        message:
          "Telegram skriptini yuklab bo'lmadi. Internetni tekshirib qayta urinib ko'ring.",
      });
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [dispatch, navigate, signinUser]);

  if (state.status === "loading" || state.status === "ready") {
    return <Suspensee />;
  }

  if (state.status === "outside-telegram") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2">Telegram WebApp topilmadi</h2>
          <p className="text-gray-600">
            Ushbu sahifa faqat Telegram ilovasi ichidagi bot WebApp tugmasi
            orqali ochilishi kerak.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold mb-2">Kirish amalga oshmadi</h2>
        <p className="text-gray-600 whitespace-pre-line">{state.message}</p>
      </div>
    </div>
  );
};

export default memo(TelegramBot);
