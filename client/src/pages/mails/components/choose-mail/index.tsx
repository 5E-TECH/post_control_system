import { memo, type FC } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

interface Props {
  role: string;
}

const ChooseMail: FC<Props> = ({ role }) => {
  const { t } = useTranslation("mails")
  const links =
    role === "superadmin"
      ? [
        { to: "/mails", label: t("todayMails") },
        { to: "/mails/refused", label: t("refusedMails") },
        { to: "/mails/old", label: t("oldMails") },
      ]
      : role === "courier"
        ? [
          { to: "/courier-mails", label: t("newMails") },
          { to: "/courier-mails/refused", label: t("refusedMails") },
          { to: "/courier-mails/old", label: t("oldMails") },
        ]
        : [];

  return (
    <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-15">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/mails" || link.to === "/courier-mails"}
          className={({ isActive }) =>
            `${isActive
              ? "bg-[var(--color-bg-sy)] text-[#ffffff]"
              : "dark:bg-[#312D48]"
            } min-h-[60px] flex items-center justify-center shadow-lg rounded-md text-[20px]`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </div>
  );
};

export default memo(ChooseMail);
