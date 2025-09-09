import { memo, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Moon, Search, Sun } from "lucide-react";
import logo from "../../shared/assets/logo.svg";

const Header = () => {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    return stored ? JSON.parse(stored) : false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", JSON.stringify(dark));
  }, [dark]);

  const navigate = useNavigate();
  return (
    <div className="w-full h-16 px-8 flex justify-between items-center sticky top-0 left-0 z-50 bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)]">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3">
        <NavLink to={"/"} className="flex items-center gap-3">
          <div>
            <img src={logo} alt="logo" className="h-8" />
          </div>
          <span className="text-xl font-semibold">Beepost</span>
        </NavLink>
      </div>

      {/* Search */}
      <label
        htmlFor="search"
        className="flex items-center gap-3 w-full max-w-xl mx-12">
        <Search className="text-gray-500" />
        <input
          className="w-full bg-white dark:bg-gray-800 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          type="text"
          id="search"
          placeholder="Search"
        />
      </label>

      {/* Actions */}
      <div className="flex gap-6">
        <button onClick={() => setDark(!dark)} className="cursor-pointer">
          {dark ? <Sun /> : <Moon />}
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="cursor-pointer font-medium">
          Profile
        </button>
      </div>
    </div>
  );
};

export default memo(Header);
