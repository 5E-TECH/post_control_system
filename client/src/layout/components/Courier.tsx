import { memo } from "react";
import { NavLink } from "react-router-dom";
import logo from "../../shared/assets/logo.svg";
import {
  FileText,
  House,
  MailOpen,
  SquareDashedMousePointer,
} from "lucide-react";

const Sidebar = () => {
  return (
    <div className="bg-gray-200 dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5]">
      <div className="h-16 flex justify-center items-center">
        <NavLink to={"/"} className={"flex items-center gap-3"}>
          <div>
            <img src={logo} alt="" />
          </div>
          <span className="text-xl font-semibold">Beepost</span>
        </NavLink>
      </div>
      <ul className="w-65 flex flex-col gap-1.5 mr-4">
        <li>
          <NavLink
            to={"/"}
            end={true}
            className={({ isActive }) =>
              `flex gap-2 pl-5.5 py-2 ${
                isActive
                  ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]"
                  : ""
              }`
            }
          >
            <House />
            
            <span>Dashboard</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to={"/mails"}
            className={({ isActive }) =>
              `flex gap-2 pl-5.5 py-2 ${
                isActive
                  ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]"
                  : ""
              }`
            }
          >
            <MailOpen />
            <span>Pochta</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to={"/payments"}
            className={({ isActive }) =>
              `flex gap-2 pl-5.5 py-2 ${
                isActive
                  ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]"
                  : ""
              }`
            }
          >
            <FileText />
            <span>To'lovlar</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to={"/logs"}
            className={({ isActive }) =>
              `flex gap-2 pl-5.5 py-2 ${
                isActive
                  ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]"
                  : ""
              }`
            }
          >
            <SquareDashedMousePointer />
            <span>Hududlarim</span>
          </NavLink>
        </li>
      </ul>
    </div>
  );
};

export default memo(Sidebar);
