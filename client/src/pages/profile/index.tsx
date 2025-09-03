import { memo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Users, Wallet, Package, FileText, ShoppingCart } from 'lucide-react';

const Profil = () => {
  const linkClasses = (isActive: boolean) =>
    `flex items-center gap-2 px-6 py-2 rounded-lg  transition 
     ${isActive ? 'bg-purple-500  text-white w-[136px] h-[38px]' : ''}`;

  return (
    <div className="">
      <ul className="flex gap-5 bg-[#f4f5fa] dark:text-white dark:bg-[#28243d] pb-[24px]">
        <li>
          <NavLink
            to={''}
            end
            className={({ isActive }) => linkClasses(isActive)}
          >
            <Users className=" w-5 h-5" />
            Profil
          </NavLink>
        </li>
        <li>
          <NavLink
            to={'profil-maosh'}
            end
            className={({ isActive }) => linkClasses(isActive)}
          >
            <Wallet className="w-5 h-5" />
            Maosh
          </NavLink>
        </li>
        <li>
          <NavLink
            to={'profil-products'}
            className={({ isActive }) => linkClasses(isActive)}
          >
            <Package className="w-5 h-5" />
            Products
          </NavLink>
        </li>
        <li>
          <NavLink
            to={'profil-logs'}
            className={({ isActive }) => linkClasses(isActive)}
          >
            <FileText className="w-5 h-5" />
            Logs
          </NavLink>
        </li>
        <li>
          <NavLink
            to={'profil-orders'}
            className={({ isActive }) => linkClasses(isActive)}
          >
            <ShoppingCart className="w-5 h-5" />
            Orders
          </NavLink>
        </li>
      </ul>

      <Outlet />
    </div>
  );
};

export default memo(Profil);
