import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Outlet } from "react-router-dom";
import type { RootState } from "../../../app/store";
import { api } from "../../../shared/api";
import { setId, setRole } from "../../../shared/lib/features/roleSlice";
import Suspensee from "../../../shared/ui/Suspensee";

const AuthTelegram = () => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.authSlice.token);

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);

  const [errorData, setErrorData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorData("TOKEN YO‘Q");
      return;
    }

    api
      .get("user/profile")
      .then((res) => {
        setValid(true);

        dispatch(setRole(res.data.data.role));
        dispatch(setId(res.data.data.id));
      })
      .catch((err) => {
        setValid(false);

        if (err?.response) setErrorData(err.response.data);
        else if (err?.message) setErrorData(err.message);
        else setErrorData("Unknown error");
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
      <h2 className="text-lg font-bold mb-2">Auth ERROR</h2>

      <pre className="bg-red-100 p-2 rounded text-sm">
        {JSON.stringify(errorData, null, 2)}
      </pre>
    </div>
  );
};

export default memo(AuthTelegram);
