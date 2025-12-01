import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Outlet } from "react-router-dom";
import type { RootState } from "../../../app/store";
import { api } from "../../../shared/api";
import { setId, setRole } from "../../../shared/lib/features/roleSlice";
import Suspensee from "../../../shared/ui/Suspensee";
// import NotFound from "../../../shared/ui/NotFound";

// Test for deployment
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
      .get("user/profile") // 🔑 backendda token tekshirish
      .then((res) => {
        setValid(true);    // token to‘g‘ri bo‘lsa
        dispatch(setRole(res.data.data.role));
        dispatch(setId(res.data.data.id));
      })
      .catch(() => {
        // dispatch(setToken(null)); // ❌ noto‘g‘ri token → localStorage va reduxdan o‘chir
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

  return valid ? <Outlet /> : <h2>
    token:{token}
  </h2>;
};

export default memo(AuthTelegram);
