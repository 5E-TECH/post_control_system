import { memo, useEffect, useRef, useState } from "react";
import { useLoginTelegran } from "./service/useTelelgram";
import { useDispatch } from "react-redux";
import { removeToken, setToken } from "../../shared/lib/features/login/authSlice";
import { useNavigate } from "react-router-dom";
import Suspensee from "../../shared/ui/Suspensee";
import { buildAdminPath } from "../../shared/const";
import { useLogin } from "../../shared/api/hooks/useLogin";
import { Button, Input, message } from "antd";

type BotState =
  | { status: "loading" }
  | { status: "outside-telegram" }
  | { status: "need-login"; reason?: string }
  | { status: "error"; message: string }
  | { status: "ready" };

const TelegramBot = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { signinUser, linkTelegram } = useLoginTelegran();
  const { signinUser: signinPassword } = useLogin();

  const [state, setState] = useState<BotState>({ status: "loading" });
  const [initData, setInitData] = useState<string>("");
  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

      setInitData(telegram.initData);

      signinUser.mutate(
        { data: telegram.initData },
        {
          onSuccess: (res: any) => {
            const accessToken = res?.data?.data?.access_token;
            if (!accessToken) {
              setState({
                status: "need-login",
                reason:
                  "Avval telefon raqam va parolingiz orqali kiring. Keyingi safar avtomatik kirasiz.",
              });
              return;
            }
            dispatch(setToken({ access_token: accessToken }));
            setState({ status: "ready" });
            navigate(buildAdminPath("authtelegram"), { replace: true });
          },
          onError: () => {
            setState({
              status: "need-login",
              reason:
                "Telegram hisobingiz hali platformaga bog'lanmagan. Telefon raqam va parolingizni kiriting — keyingi safar avtomatik kirasiz.",
            });
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

  const handlePasswordLogin = () => {
    if (!/^\+998\d{9}$/.test(phone)) {
      message.error("Telefon raqamini to'g'ri kiriting (+998XXXXXXXXX)");
      return;
    }
    if (!password || password.length < 4) {
      message.error("Parol kamida 4 ta belgi bo'lishi kerak");
      return;
    }

    setSubmitting(true);
    signinPassword.mutate(
      { phone_number: phone, password },
      {
        onSuccess: (res: any) => {
          const accessToken = res?.data?.data?.access_token;
          if (!accessToken) {
            setSubmitting(false);
            message.error("Kirish tokenini olib bo'lmadi");
            return;
          }
          dispatch(setToken(res.data.data));
          if (res?.data?.data?.refresh_token_expires_at) {
            localStorage.setItem(
              "refresh_token_expires_at",
              String(res.data.data.refresh_token_expires_at)
            );
          }

          if (initData) {
            linkTelegram.mutate(
              { data: initData },
              {
                onSettled: () => {
                  setSubmitting(false);
                  navigate(buildAdminPath("authtelegram"), { replace: true });
                },
              }
            );
          } else {
            setSubmitting(false);
            navigate(buildAdminPath("authtelegram"), { replace: true });
          }
        },
        onError: (err: any) => {
          setSubmitting(false);
          const errorMsg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message;
          if (errorMsg === "Phone number or password incorrect") {
            message.error("Telefon raqam yoki parol noto'g'ri");
          } else if (errorMsg === "You have been blocked by superadmin") {
            message.error("Siz superadmin tomonidan bloklangansiz");
          } else {
            message.error(errorMsg || "Kirish amalga oshmadi");
          }
        },
      }
    );
  };

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

  if (state.status === "need-login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="w-full max-w-md">
          <h2 className="text-xl font-semibold mb-2 text-center">Tizimga kirish</h2>
          <p className="text-gray-600 text-sm mb-5 text-center">
            {state.reason}
          </p>

          <div className="mb-4">
            <Input
              size="large"
              placeholder="+998 90 123 45 67"
              value={(function () {
                if (!phone) return "+998 ";
                let digits = phone.replace(/\D/g, "");
                if (digits.startsWith("998")) digits = digits.slice(3);
                let formatted = "+998 ";
                if (digits.length > 0) {
                  formatted += digits
                    .replace(
                      /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
                      (_: any, a: any, b: any, c: any, d: any) =>
                        [a, b, c, d].filter(Boolean).join(" ")
                    )
                    .trim();
                }
                return formatted;
              })()}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                if (val.startsWith("998")) val = val.slice(3);
                setPhone("+998" + val);
              }}
            />
          </div>

          <div className="mb-4">
            <Input.Password
              size="large"
              placeholder="Parol"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={handlePasswordLogin}
            />
          </div>

          <Button
            type="primary"
            size="large"
            loading={submitting}
            onClick={handlePasswordLogin}
            className="!bg-[#8C57FF] !w-full"
          >
            Kirish
          </Button>
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
