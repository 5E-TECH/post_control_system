import React from "react";
import ChooseMail from "./components/choose-mail";
import { Outlet } from "react-router-dom";

const Mails = () => {
  return (
    <div className="h-[800px] p-5">
      <ChooseMail />
      <div>
        <Outlet />
      </div>
    </div>
  );
};

export default React.memo(Mails);
