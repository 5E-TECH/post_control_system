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
import { setId, setRegion, setRole } from "../../shared/lib/features/roleSlice";
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
              })
            );
        }
        {
          res?.data?.data?.region?.name
            ? dispatch(setRegion(res?.data?.data?.region?.name))
            : "";
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

  return valid ? <Outlet /> : <Navigate replace to={buildAdminPath("login")} />;
};

export default memo(Auth);
