import React from "react";
import ChooseMail from "./components/choose-mail";
import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

const Mails = () => {
  const { t } = useTranslation("mails");
  const role = useSelector((state: RootState) => state.roleSlice.role);

  const isCourier = role === "courier";
  const isSuperadmin = role === "superadmin" || role === "admin" || role === "registrator";

  if (!isCourier && !isSuperadmin) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                {t("title") || "Pochtalar"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
                {isCourier ? "Sizga tayinlangan pochtalar" : "Viloyatlar bo'yicha pochtalar"}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 mb-4">
          <ChooseMail role={isCourier ? "courier" : "superadmin"} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default React.memo(Mails);
