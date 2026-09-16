import { NavLink } from "react-router-dom";
import {
  Apple,
  Calendar1,
  Receipt,
  CreditCard,
  FileText,
  House,
  MailOpen,
  QrCode,
  Scale,
  ShoppingBag,
  UserRound,
  MapPin,
  Zap,
} from "lucide-react";
import { buildAdminPath } from "../../const";
import { useExtraCost } from "../../api/hooks/useExtraCost";

// Umumiy nav container stili - barcha rollar uchun
const navContainerClass = `
  fixed bottom-0 left-0 right-0 w-full min-[650px]:hidden z-50
  bg-[#1e1e2d]/95 backdrop-blur-md
  border-t border-gray-800/50
  pb-[env(safe-area-inset-bottom,0px)]
`;

/**
 * Ikonka ustidagi qizil raqam.
 *
 * ⚠️ Mobil navda YOZUV yo'q — faqat ikonka. Raqamsiz kuryer/market "ish
 * kutmoqda"ni umuman ko'rmaydi va sahifani ochish xayoliga kelmaydi.
 */
const NavBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-[#1e1e2d]">
      {count > 99 ? "99+" : count}
    </span>
  );
};

/**
 * Nav item uchun umumiy stil.
 *
 * ⚠️ O'LCHAM TASODIFIY EMAS. Kuryer navida endi 6 ta ikonka va markazdagi
 * skaner bor:
 *
 *   48px bo'lsa:  6×48 + 56 + 16 = 376px  → 360px telefonda SIG'MAYDI
 *   44px bo'lsa:  6×44 + 56 + 16 = 336px  → 360px da sig'adi
 *   40px (<380):  6×40 + 48 + 16 = 304px  → 320px ekranda ham sig'adi
 *
 * 44px — barmoq uchun qabul qilingan eng kichik o'lcham; undan pastga
 * FAQAT juda tor ekranlarda tushamiz, chunki u yerda gorizontal skroll
 * yoki ikonkalarning bir-biriga kirib ketishi bundan ham yomon.
 */
const getNavItemClass = (isActive: boolean) => `
  flex items-center justify-center w-11 h-11 max-[380px]:w-10 rounded-xl transition-all duration-200
  ${isActive
    ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] text-white shadow-lg shadow-purple-500/30"
    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
  }
`;

const Navbar = ({ role }: { role: string }) => {
  // ⚠️ Hook'lar SHU YERDA — `renderNav` ichida chaqirilsa ular rolga bog'liq
  // bo'lib qolardi (React qoidasi buziladi). `enabled` bayrog'i keraksiz
  // so'rovni to'sadi.
  const { getMarketCounts, getCourierCounts } = useExtraCost();
  const { data: marketCounts } = getMarketCounts(role === "market");
  const { data: courierCounts } = getCourierCounts(role === "courier");

  const marketExtraCost = Number(marketCounts?.open ?? 0);
  const courierExtraCost =
    Number(courierCounts?.awaiting_proof ?? 0) +
    Number(courierCounts?.unseen ?? 0);

  const renderNav = () => {
    switch (role) {
      case "superadmin":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("all-users")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <UserRound className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("payments")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("m-balance")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Scale className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("logs")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <FileText className="w-6 h-6" />
            </NavLink>
            </div>
          </div>
        );
      case "admin":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("all-users")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <UserRound className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("payments")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("m-balance")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Scale className="w-6 h-6" />
            </NavLink>
            </div>
          </div>
        );
      case "registrator":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("order/markets/new-orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Calendar1 className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("mails")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <MailOpen className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("products")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Apple className="w-6 h-6" />
            </NavLink>
            </div>
          </div>
        );
      case "courier":
        return (
          <div className={navContainerClass}>
            {/* ⚠️ 3 + SKANER + 3. Avval chapda 2 ta, o'ngda 3 ta ikonka bor
                edi va markazdagi skaner o'rtada turmasdi — nav ko'zga
                qiyshiq ko'rinardi. "Tezkor amal" shu yerga qo'shildi:
                u kuryer kuniga bir necha marta ochadigan sahifa, lekin
                telefonda unga yo'l UMUMAN yo'q edi (sidebar <650px da
                ko'rinmaydi). */}
            <div className="flex justify-between items-center px-2 py-2 relative">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("courier-orders/orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("courier-bulk")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Zap className="w-6 h-6" />
            </NavLink>

            {/* QR Scanner - Markazda va yuqoriga chiqib turadi */}
            <NavLink
              to={buildAdminPath("scan")}
              className="flex items-center justify-center w-14 h-14 max-[380px]:w-12 max-[380px]:h-12 shrink-0 rounded-full bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] text-white shadow-lg shadow-purple-500/40 -mt-8 border-4 border-[#1e1e2d]"
            >
              <QrCode className="w-7 h-7 max-[380px]:w-6 max-[380px]:h-6" />
            </NavLink>

            <NavLink
              to={buildAdminPath("courier-mails")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <MailOpen className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("cash-box")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-6 h-6" />
            </NavLink>
            {/* Kuryer telefonda ishlaydi — mobil nav uning YAGONA yo'li. */}
            <NavLink
              to={buildAdminPath("my-extra-cost")}
              className={({ isActive }) =>
                `relative ${getNavItemClass(isActive)}`
              }
            >
              <Receipt className="w-6 h-6" />
              <NavBadge count={courierExtraCost} />
            </NavLink>
            </div>
          </div>
        );
      case "market":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("order/markets/new-orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Calendar1 className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("products")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Apple className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("cash-box")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-6 h-6" />
            </NavLink>
            {/* ⚠️ Mobil nav SHART: market <650px da faqat shu ikonkalar
                orqali harakatlanadi — sidebar umuman ko'rinmaydi. Bu yerga
                qo'shilmasa, market telefonda sahifani OCHOLMAYDI. */}
            <NavLink
              to={buildAdminPath("extra-cost")}
              className={({ isActive }) =>
                `relative ${getNavItemClass(isActive)}`
              }
            >
              <Receipt className="w-6 h-6" />
              <NavBadge count={marketExtraCost} />
            </NavLink>
            </div>
          </div>
        );
      case "logist":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("mails")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <MailOpen className="w-6 h-6" />
            </NavLink>
            <NavLink
              to={buildAdminPath("regions")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <MapPin className="w-6 h-6" />
            </NavLink>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return <>{renderNav()}</>;
};

export default Navbar;
