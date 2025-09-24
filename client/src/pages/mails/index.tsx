import React from "react";
import ChooseMail from "./components/choose-mail";
import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const Mails = () => {
  const role = useSelector((state: RootState) => state.roleSlice.role);

  if (role === "courier") {
    return (
      <div className="p-5 flex flex-col gap-12">
        <ChooseMail role="courier" />
        <div>
          <Outlet />
        </div>
      </div>
    );
  }

  if (role === "superadmin" || role === "admin") {
    return (
      <div className="p-5 flex flex-col gap-12">
        <ChooseMail role="superadmin" />
        <div>
          <Outlet />
        </div>
      </div>
    );
  }
};

export default React.memo(Mails);
