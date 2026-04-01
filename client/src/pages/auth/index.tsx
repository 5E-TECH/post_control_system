import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import type { RootState } from "../../app/store";
import { api } from "../../shared/api";
import { buildAdminPath } from "../../shared/const";
import {
  setTarif,
  setToken,
  setUserData,
} from "../../shared/lib/features/login/authSlice";
import { setId, setRegion, setRole, setName, setMarketId } from "../../shared/lib/features/roleSlice";
import Suspensee from "../../shared/ui/Suspensee";
const Auth = () => {
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
      .get("user/profile") // 🔑 backendda token tekshirish
      .then((res) => {
        setValid(true); // token to‘g‘ri bo‘lsa
        dispatch(setRole(res.data.data.role));
        dispatch(setId(res.data.data.id));
        dispatch(setName(res.data.data.name));
        {
          res?.data?.data?.role === "market" &&
            dispatch(setTarif(res?.data?.data?.default_tariff));
        }
        {
          res?.data?.data?.role === "market" &&
            dispatch(
              setUserData({
                name: res?.data?.data?.name,
                phone_number: res?.data?.data?.phone_number,
                require_operator_phone: res?.data?.data?.require_operator_phone || false,
                default_operator_phone: res?.data?.data?.default_operator_phone || "",
              }),
            );
        }
        {
          res?.data?.data?.region?.name
            ? dispatch(setRegion(res?.data?.data?.region?.name))
            : "";
        }
        // Operator uchun market_id va market ma'lumotlarini saqlash
        if (res?.data?.data?.market_id) {
          dispatch(setMarketId(res.data.data.market_id));
          // Operator uchun market ning require_operator_phone sozlamasini saqlash
          if (res?.data?.data?.market) {
            dispatch(
              setUserData({
                name: res.data.data.market.name,
                phone_number: res.data.data.market.phone_number,
                require_operator_phone: res.data.data.market.require_operator_phone || false,
                default_operator_phone: res.data.data.market.default_operator_phone || "",
              }),
            );
          }
        }
      })
      .catch(() => {
        dispatch(setToken(null)); // ❌ noto‘g‘ri token → localStorage va reduxdan o‘chir
        setValid(false);
      })
      .finally(() => setLoading(false));
  }, [token, dispatch]);

  if (loading)
    return (
      <div>
        <Suspensee />
      </div>
    );

  return valid ? (
    <Outlet />
  ) : (
    <Navigate replace to={buildAdminPath("login")} />
  );
};
// test

export default memo(Auth);
