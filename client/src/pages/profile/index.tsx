import { memo } from 'react';
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useSignOut } from './service/LogOut';

const Profil = () => {
  const {mutate: signOut} = useSignOut()


  return (
    <div className="">
      <ul className="flex fixed justify-between gap-5 bg-[#f4f5fa] dark:text-white dark:bg-[#28243d] pb-[24px]">
        <li>
          <button
            onClick={() =>signOut() }
            className="flex items-center gap-2 
               w-[140px] h-9 px-3
               border border-red-500 text-red-600 
               rounded-lg font-medium
               dark:border-red-500 dark:text-red-500
               hover:bg-red-50 dark:hover:bg-red-900/20
               focus:outline-none focus:ring-1 focus:ring-red-400
               transition-colors  cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </li>
      </ul>

      <Outlet />
    </div>
  );
};

export default memo(Profil);
