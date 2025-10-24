import { NavLink } from "react-router-dom";

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label }) => {
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
      <span>{label}</span>
    </NavLink>
  );
};

export default SidebarLink;
