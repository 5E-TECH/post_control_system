import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Outlet } from "react-router-dom";
import type { RootState } from "../../../app/store";
import { api } from "../../../shared/api";
import {
  setId,
  setRole,
  setName,
} from "../../../shared/lib/features/roleSlice";
import Suspensee from "../../../shared/ui/Suspensee";
import { setTarif } from "../../../shared/lib/features/login/authSlice";

const AuthTelegram = () => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.authSlice.token);

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);


  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("user/profile")
      .then((res) => {
        setValid(true);
        dispatch(setTarif(res?.data?.data?.default_tariff));
        dispatch(setRole(res.data.data.role));
        dispatch(setId(res.data.data.id));
        dispatch(setName(res?.data?.data?.name));
      })
      .catch(() => {
        setValid(false);
      })
      .finally(() => setLoading(false));
  }, [token, dispatch]);

  // ⏳ Loading
  if (loading) return <Suspensee />;

  // 🟢 SUCCESS → Outlet
  if (valid) return <Outlet />;

  // 🔴 ERROR → xato UI
  return (
    <div className="p-3 bg-white">
      <Suspensee />
    </div>
  );
};

export default memo(AuthTelegram);
