import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Search, Sun } from "lucide-react";

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
        <button onClick={() => navigate("/profile")} className="cursor-pointer">Profile</button>
      </div>
    </div>
  );
};

export default memo(Header);
