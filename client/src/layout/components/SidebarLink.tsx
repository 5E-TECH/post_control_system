import { NavLink } from "react-router-dom";
import type { RootState } from "../../app/store";
import { useSelector } from "react-redux";

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label }) => {

  const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  return (
    <NavLink
      to={to}
      // end={end}
      className={({ isActive }) =>
        `flex gap-2 pl-5.5 py-2 ${
          isActive
            ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]"
            : "hover:bg-gray-300 dark:hover:bg-gray-700 rounded-r-full"
        }`
      }>
      {icon}
      {
        sidebarRedux.isOpen && 
      <span>{label}</span>
      }
    </NavLink>
  );
};

export default SidebarLink;
