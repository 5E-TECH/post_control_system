import React from "react";
import ChooseMail from "./components/choose-mail";
import { Outlet } from "react-router-dom";

const Mails = () => {
  return (
    <div className="p-5 flex flex-col gap-12">
      <ChooseMail />
      <div>
        <Outlet />
      </div>
    </div>
  );
};

export default React.memo(Mails);
