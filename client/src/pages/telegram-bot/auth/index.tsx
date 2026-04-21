import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Outlet } from "react-router-dom";
import type { RootState } from "../../../app/store";
import { api } from "../../../shared/api";
import {
  setId,
  setRole,
  setName,
  setMarketId,
} from "../../../shared/lib/features/roleSlice";
import Suspensee from "../../../shared/ui/Suspensee";
import { setTarif } from "../../../shared/lib/features/login/authSlice";

const AuthTelegram = () => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.authSlice.token);

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMsg(
        "Tokeningiz topilmadi. Iltimos, bot WebApp tugmasi orqali qayta oching."
      );
      setLoading(false);
      return;
    }

    api
      .get("user/profile")
      .then((res) => {
        const data = res?.data?.data;
        setValid(true);
        if (data?.default_tariff) dispatch(setTarif(data.default_tariff));
        if (data?.role) dispatch(setRole(data.role));
        if (data?.id) dispatch(setId(data.id));
        if (data?.name) dispatch(setName(data.name));
        if (data?.market_id) dispatch(setMarketId(data.market_id));
      })
      .catch((err) => {
        const message =
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "Sessiya tekshiruvi amalga oshmadi. Qaytadan urinib ko'ring.";
        setErrorMsg(message);
        setValid(false);
      })
      .finally(() => setLoading(false));
  }, [token, dispatch]);

  if (loading) return <Suspensee />;

  if (valid) return <Outlet />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold mb-2">Kirish amalga oshmadi</h2>
        <p className="text-gray-600">
          {errorMsg || "Iltimos, botga qaytib qayta ochishga urinib ko'ring."}
        </p>
      </div>
    </div>
  );
};

export default memo(AuthTelegram);
