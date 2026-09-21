import { NavLink } from "react-router-dom";
import type { RootState } from "../../app/store";
import { useSelector } from "react-redux";

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  /**
   * Qizil bildirishnoma raqami (0 yoki `undefined` bo'lsa ko'rinmaydi).
   *
   * ⚠️ Yopiq menyuda YOZUV yo'q, faqat belgi qoladi — shuning uchun raqam
   * belgining ustiga chiqariladi, aks holda "3 ta ish kutmoqda" degani
   * butunlay ko'rinmay qolardi.
   */
  badge?: number;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({
  to,
  icon,
  label,
  badge = 0,
}) => {
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);
  const show = badge > 0;
  const text = badge > 99 ? "99+" : String(badge);

  return (
    <NavLink
      to={to}
      // end={end}
      className={({ isActive }) =>
        `relative flex items-center gap-2 pl-5.5 py-2 ${
          isActive
            ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]"
            : "hover:bg-gray-300 dark:hover:bg-gray-700 rounded-r-full"
        }`
      }
    >
      <span className="relative shrink-0">
        {icon}
        {show && !sidebarRedux.isOpen && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {text}
          </span>
        )}
      </span>
      {sidebarRedux.isOpen && (
        <>
          <span>{label}</span>
          {show && (
            <span className="ml-auto mr-4 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white">
              {text}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

export default SidebarLink;
