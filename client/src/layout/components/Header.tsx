import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Search, Sun, User } from 'lucide-react';

const Header = () => {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(dark));
  }, [dark]);

  const navigate = useNavigate();
  return (
    <div className="w-full h-16 px-6 flex justify-between items-center sticky top-0 left-0 z-50 bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)]">
      <label htmlFor="search" className="flex gap-4">
        <Search />
        <input
          className="outline-none"
          type="text"
          id="search"
          placeholder="Search"
        />
      </label>
      <div className="flex gap-4">
        <button onClick={() => setDark(!dark)} className="cursor-pointer">
          {dark ? <Sun /> : <Moon />}
        </button>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="p-2 rounded-full border border-gray-400 dark:border-gray-600 
               bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
               hover:bg-gray-200 dark:hover:bg-gray-700 
               hover:scale-105 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <User size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(Header);
