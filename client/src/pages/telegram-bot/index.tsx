import { memo, useState, useEffect } from "react";
import { useLoginTelegran } from "./service/useTelelgram";
import { useDispatch } from "react-redux";
import { setToken } from "../../shared/lib/features/login/authSlice";
import { useNavigate } from "react-router-dom";
import Suspensee from "../../shared/ui/Suspensee";
import { buildAdminPath } from "../../shared/const";

const TelegramBot = () => {
  const [tg, setTg] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { signinUser } = useLoginTelegran();

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;

    script.onload = () => {
      const telegram = (window as any).Telegram?.WebApp;
      if (!telegram) return;

      setTg(telegram);
      telegram.ready();
      telegram.expand();

      const data = { data: telegram.initData };

      signinUser.mutate(data, {
        onSuccess: (res: any) => {
          dispatch(setToken({ access_token: res?.data?.data?.access_token }));
          navigate(buildAdminPath("authtelegram", { absolute: true }));
        },
      });

      setIsLoading(false);
    };

    script.onerror = () => {
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []); // <-- faqat bir marta ishlasin

  if (isLoading) {
    return (
      <div>
        <Suspensee />
      </div>
    );
  }

  if (!tg) {
    return (
      <div className="bg-white p-4">
        <h2>Telegram WebApp not available</h2>
        <p>Please open this page in Telegram app</p>
      </div>
    );
  }

  return (
    <div>
      <Suspensee />
    </div>
  );
};

export default memo(TelegramBot);
