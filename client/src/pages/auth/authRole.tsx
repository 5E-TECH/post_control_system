import { memo } from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import type { RootState } from "../../app/store";

const Role = () => {
  const role = useSelector((state: RootState) => state.roleSlice.role);

  //   const token = true;
  return role ? <Outlet /> : <Navigate replace to={"/select-role"} />;
};

export default memo(Role);
