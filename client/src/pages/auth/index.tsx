import { memo } from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import type { RootState } from "../../app/store";

const Auth = () => {
  const token = useSelector((state: RootState) => state.authSlice.token);
  
//   const token = true;
  return token ? <Outlet /> : <Navigate replace to={"/login"} />;
};

export default memo(Auth);
