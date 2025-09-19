import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Search, Sun, User, X } from 'lucide-react';
import logo from '../../shared/assets/logo.svg';
import { useSignOut } from '../../pages/profile/service/LogOut';

const Header = () => {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  });

  const { mutate: signOut } = useSignOut();

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(dark));
  }, [dark]);

  const navigate = useNavigate();

  const [burger, setBurger] = useState(false);

  return (
    <div className="w-full h-16 px-8 flex justify-between items-center sticky top-0 left-0 z-50 bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)]">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3">
        <NavLink to={'/'} className="flex items-center gap-3">
          <div>
            <img src={logo} alt="logo" className="h-8" />
          </div>
          <span className="text-xl font-semibold">Beepost</span>
        </NavLink>
      </div>

      {/* Search */}
      <label
        htmlFor="search"
        className="flex items-center gap-3 w-full max-w-xl mx-12 max-[960px]:hidden"
      >
        <Search className="text-gray-500" />
        <input
          className="w-full bg-white dark:bg-gray-800 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          type="text"
          id="search"
          placeholder="Search"
        />
      </label>

      {/* Actions */}
      <div className="flex gap-6 max-[960px]:hidden">
        <button onClick={() => setDark(!dark)} className="cursor-pointer">
          {dark ? <Sun /> : <Moon />}
        </button>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="p-2 cursor-pointer rounded-full border border-gray-400 dark:border-gray-600 
               bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
               hover:bg-gray-200 dark:hover:bg-gray-700 
               hover:scale-105 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <User size={20} />
          </button>
        </div>

        <div className="flex justify-center items-center">
          <button
            onClick={() => signOut()}
            className="flex items-center cursor-pointer justify-center rounded-full border border-red-500 w-10 h-10 text-red-500 transition hover:bg-red-500 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      <Menu
        className="min-[960px]:hidden transition-all"
        onClick={() => setBurger((p) => !p)}
      />

      {burger && (
        <>
          <div
            className="fixed top-0 left-0 w-full h-full bg-black/30 z-40 transition-all"
            onClick={() => setBurger(false)}
          ></div>

          <div className="fixed top-0 right-0 w-[350px] h-screen bg-white transition-all dark:bg-[#000000] z-50 min-[960px]:hidden p-6 shadow-lg">
            <button
              className="mb-4 text-right w-full text-gray-800 dark:text-gray-200"
              onClick={() => setBurger(false)}
            >
              <X className="absolute top-4 right-4 w-[20px] h-[20px] dark:text-[var(--color-py)] dark:transition-all transition-all" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default memo(Header);
