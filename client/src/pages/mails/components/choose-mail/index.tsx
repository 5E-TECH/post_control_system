import { memo, type FC } from "react";
import { NavLink } from "react-router-dom";

interface Props {
  role: string;
}

const ChooseMail: FC<Props> = ({ role }) => {
  const links =
    role === "superadmin"
      ? [
          { to: "/mails", label: "Bugungi pochtalar" },
          { to: "/mails/refused", label: "Qaytgan pochtalar" },
          { to: "/mails/old", label: "Eski pochtalar" },
        ]
      : role === "courier"
      ? [
          { to: "/courier-mails", label: "Yangi pochtalar" },
          { to: "/courier-mails/refused", label: "Qaytgan pochtalar" },
          { to: "/courier-mails/old", label: "Eski pochtalar" },
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
            `${
              isActive
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
