import { memo, type FC } from "react";
import { NavLink } from "react-router-dom";

interface Props {
  role: string;
}

const ChooseMail: FC<Props> = ({ role }) => {
  const links =
    role === "superadmin"
      ? [
          { to: "", label: "Bugungi pochtalar" },
          { to: "refused", label: "Qaytgan pochtalar" },
          { to: "old", label: "Eski pochtalar" },
        ]
      : role === "courier"
      ? [
          { to: "", label: "Yangi pochtalar" },
          { to: "/courier/refused", label: "Qaytgan pochtalar" },
          { to: "/courier/old", label: "Eski pochtalar" },
        ]
      : [];

  return (
    <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-15">
      {links.map((link) => (
        <NavLink
          key={link.to}
          end={link.to === ""}
          to={link.to}
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
