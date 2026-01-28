import {
  ChevronLeft,
  ChevronRight,
  Languages,
  LogOut,
  Moon,
  QrCode,
  Search,
  Sun,
  X,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import logo from "../../shared/assets/logo.svg";
import { useSignOut } from "../../pages/profile/service/LogOut";
import { useTranslation } from "react-i18next";
import { memo, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaInstagram, FaLinkedin, FaTelegram } from "react-icons/fa";
import { buildAdminPath } from "../../shared/const";
import { useProfile } from "../../shared/api/hooks/useProfile";
import { AvatarDisplay } from "../../shared/components/AvatarSelector";

const Header = () => {
  const { t, i18n } = useTranslation(["header"]);
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    return stored ? JSON.parse(stored) : false;
  });

  const { mutate: signOut } = useSignOut();
  const { getUser } = useProfile();
  const { data: userData } = getUser();
  const user = userData?.data;

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", JSON.stringify(dark));
  }, [dark]);

  const navigate = useNavigate();

  const [burger, setBurger] = useState(false);

  // Burger menu ochilganda body scroll ni bloklash
  useEffect(() => {
    if (burger) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [burger]);

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 700);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Navigation link bosilganda menuni yopish
  const handleNavClick = (to: string) => {
    navigate(to);
    setBurger(false);
  };

  return (
    <div className="w-full h-16 pl-4 sm:pl-8 pr-3 flex justify-between items-center sticky top-0 left-0 z-50 bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)]">
      {/* Logo */}
      <div className="h-16 flex items-center gap-30">
        <NavLink to={buildAdminPath()} className="flex items-center gap-2 sm:gap-3">
          <div>
            <img src={logo} alt="logo" className="h-7 sm:h-8" />
          </div>
          <span className="text-lg sm:text-xl font-semibold max-[400px]:hidden">Beepost</span>
        </NavLink>
        {!isMobile && (
          // <button
          //   onClick={handleDispatch}
          //   className="shadow-md px-2 py-1.5 rounded-md transition-transform duration-300 cursor-pointer absolute left-70"
          // >
          //   <ArrowLeft
          //     className={`transition-transform duration-300 ${
          //       !sidebarRedux.isOpen ? "rotate-180" : "rotate-0"
          //     }`}
          //   />
          // </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-full border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={() => navigate(1)}
              className="p-2 rounded-full border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <label
        htmlFor="search"
        className="flex items-center gap-3 w-full max-w-xl mx-12 max-[1400px]:hidden">
        <Search className="text-gray-500" />
        <input
          className="w-full bg-white dark:bg-gray-800 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          type="text"
          id="search"
          placeholder={t("search.placeholder")}
        />
      </label>

      {/* Actions */}
      <div className="flex gap-3 sm:gap-6 items-center">
        <div
          onClick={() => navigate(buildAdminPath("scan"))}
          className="cursor-pointer max-[650px]:hidden">
          <QrCode className="h-[25px] w-[25px]" />
        </div>
        {/* Language selector - hidden on mobile, shown in burger menu instead */}
        <div className="max-[650px]:hidden flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[
            { value: "uz", label: "Uz" },
            { value: "ru", label: "Ру" },
            { value: "en", label: "En" },
          ].map((lang) => (
            <button
              key={lang.value}
              onClick={() => handleChange(lang.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                i18n.language === lang.value
                  ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <div className="flex gap-6 max-[650px]:hidden">
          <button onClick={() => setDark(!dark)} className="cursor-pointer">
            {dark ? <Sun /> : <Moon />}
          </button>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate(buildAdminPath("profile"))}
              className="cursor-pointer hover:scale-105 transition-transform">
              <AvatarDisplay
                avatarId={user?.avatar_id}
                role={user?.role}
                size="sm"
              />
            </button>
          </div>

          <div className="flex justify-center items-center">
            <button
              onClick={() => signOut()}
              className="flex items-center cursor-pointer justify-center rounded-full border border-red-500 w-10 h-10 text-red-500 transition hover:bg-red-500 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Burger Button - Animated */}
        <button
          className="min-[650px]:hidden relative w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300"
          onClick={() => setBurger((p) => !p)}
          aria-label="Menu"
        >
          <div className="relative w-5 h-4 flex flex-col justify-between">
            <span className={`block h-0.5 w-5 bg-gray-700 dark:bg-gray-300 rounded-full transition-all duration-300 origin-center ${burger ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block h-0.5 w-5 bg-gray-700 dark:bg-gray-300 rounded-full transition-all duration-300 ${burger ? 'opacity-0 scale-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-gray-700 dark:bg-gray-300 rounded-full transition-all duration-300 origin-center ${burger ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </div>
        </button>

        {/* Mobile Sidebar Overlay */}
        <div
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 min-[650px]:hidden transition-opacity duration-300 ${
            burger ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setBurger(false)}
        />

        {/* Mobile Sidebar */}
        <div className={`fixed top-0 right-0 w-[280px] sm:w-[320px] h-full bg-white dark:bg-[#1e1e2d] min-[650px]:hidden z-50 shadow-2xl transition-transform duration-300 ease-out ${
          burger ? 'translate-x-0' : 'translate-x-full'
        }`}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <img src={logo} alt="logo" className="h-7" />
              <span className="text-lg font-bold text-gray-800 dark:text-white">Beepost</span>
            </div>
            <button
              onClick={() => setBurger(false)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex flex-col h-[calc(100%-65px)] overflow-hidden">
            {/* User Profile Section */}
            <div className="p-4">
              <button
                type="button"
                onClick={() => handleNavClick(buildAdminPath("profile"))}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 hover:from-purple-500/20 hover:to-indigo-500/20 transition-all"
              >
                <AvatarDisplay
                  avatarId={user?.avatar_id}
                  role={user?.role}
                  size="sm"
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user?.name || "Profile"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Quick Actions */}
            <div className="p-4 space-y-3">
              {/* Language Selector for Mobile */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Languages className="w-4 h-4" />
                  <span className="text-sm font-medium">Til</span>
                </div>
                <div className="flex gap-1">
                  {[
                    { value: "uz", label: "Uz" },
                    { value: "ru", label: "Ру" },
                    { value: "en", label: "En" },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => handleChange(lang.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        i18n.language === lang.value
                          ? "bg-purple-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleNavClick(buildAdminPath("scan"));
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  <QrCode className="w-4 h-4" />
                  <span className="text-sm font-medium">QR Scan</span>
                </button>
                <button
                  onClick={() => setDark(!dark)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all"
                >
                  {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span className="text-sm font-medium">{dark ? "Light" : "Dark"}</span>
                </button>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Chiqish</span>
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-center gap-5 mb-3">
                <a
                  href="https://www.instagram.com/ye77i.tech?igsh=eHpwaDVhb2R5dWtq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-all"
                >
                  <FaInstagram size={18} />
                </a>
                <a
                  href="https://t.me/yetti_tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all"
                >
                  <FaTelegram size={18} />
                </a>
                <a
                  href="https://linkedin.com/in/faxriddin_maripov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <FaLinkedin size={18} />
                </a>
              </div>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                © 2025 <span className="font-semibold">YE77I Tech</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Header);
