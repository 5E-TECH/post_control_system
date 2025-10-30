import {
  ArrowLeft,
  Languages,
  LogOut,
  Menu,
  Moon,
  QrCode,
  Search,
  Sun,
  User,
  X,
} from "lucide-react";
import logo from "../../shared/assets/logo.svg";
import { useSignOut } from "../../pages/profile/service/LogOut";
import { useTranslation } from "react-i18next";
import { Select, Space } from "antd";
import { memo, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaInstagram, FaLinkedin, FaTelegram } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import {
  closeSidebar,
  openSidebar,
} from "../../shared/lib/features/sidebarSlice";
import type { RootState } from "../../app/store";

const Header = () => {
  const { t, i18n } = useTranslation(["header"]);
  const [sidebar, setSidebar] = useState(true);
  const dispatch = useDispatch();
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    return stored ? JSON.parse(stored) : false;
  });

  const { mutate: signOut } = useSignOut();
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  console.log(sidebarRedux.isOpen);

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

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const handleDispatch = () => {
    if (sidebar) {
      dispatch(openSidebar());
      setSidebar(false);
    } else {
      dispatch(closeSidebar());
      setSidebar(true);
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 650);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="w-full h-16 pl-8 pr-3 flex justify-between items-center sticky top-0 left-0 z-50 bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)]">
      {/* Logo */}
      <div className="h-16 flex items-center gap-30">
        <NavLink to={"/"} className="flex items-center gap-3">
          <div>
            <img src={logo} alt="logo" className="h-8" />
          </div>
          <span className="text-xl font-semibold">Beepost</span>
        </NavLink>
        {!isMobile && (
          <button
            onClick={handleDispatch}
            className="shadow-md px-2 py-1.5 rounded-md transition-transform duration-300 cursor-pointer absolute left-70"
          >
            <ArrowLeft
              className={`transition-transform duration-300 ${
                !sidebarRedux.isOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
        )}
      </div>

      {/* Search */}
      <label
        htmlFor="search"
        className="flex items-center gap-3 w-full max-w-xl mx-12 max-[1400px]:hidden"
      >
        <Search className="text-gray-500" />
        <input
          className="w-full bg-white dark:bg-gray-800 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          type="text"
          id="search"
          placeholder={t("search.placeholder")}
        />
      </label>

      {/* Actions */}
      <div className="flex gap-6 items-center">
        <div
          onClick={() => navigate("scan")}
          className="cursor-pointer max-[650px]:hidden"
        >
          <QrCode className="h-[25px] w-[25px]" />
        </div>
        <div className="max-[300px]:hidden">
          <Space wrap>
            <Select
              defaultValue={localStorage.getItem("i18nextLng")}
              style={{ width: 87 }}
              onChange={handleChange}
              options={[
                { value: "uz", label: "Uz" },
                { value: "ru", label: "Ру" },
                { value: "en", label: "En" },
              ]}
              prefix={<Languages />}
            />
          </Space>
        </div>
        <div className="flex gap-6 max-[650px]:hidden">
          <button onClick={() => setDark(!dark)} className="cursor-pointer">
            {dark ? <Sun /> : <Moon />}
          </button>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="p-2 cursor-pointer rounded-full border border-gray-400 dark:border-gray-600 
               bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
               hover:bg-gray-200 dark:hover:bg-gray-700 
                shadow-sm hover:shadow-md transition-all duration-200"
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
          className="min-[650px]:hidden transition-all"
          onClick={() => setBurger((p) => !p)}
        />

        {burger && (
          <>
            <div
              className="fixed top-0 left-0 w-full h-full bg-black/30 z-40 transition-all"
              onClick={() => setBurger(false)}
            ></div>

            <div className="fixed top-0 right-0 w-[300px] h-screen bg-white transition-all dark:bg-[#28243D] min-[650px]:hidden z-50 p-6 shadow-lg">
              <button
                className="mb-4 text-right w-full text-gray-800 dark:text-gray-200"
                onClick={() => setBurger(false)}
              >
                <X className="absolute top-4 right-4 w-[20px] h-[20px] dark:text-[var(--color-py)] dark:transition-all transition-all" />
              </button>
              <div className="flex flex-col h-[93vh] justify-between ">
                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => navigate("/profile")}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-400 dark:border-gray-600
       bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
       hover:bg-gray-200 dark:hover:bg-gray-700 
        shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <User className="w-5 h-5" />
                    <span className="text-sm font-medium">Profile</span>
                  </button>
                  <button
                    onClick={() => setDark(!dark)}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-400 dark:border-gray-600
       bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
       hover:bg-gray-200 dark:hover:bg-gray-700 
        shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {dark ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <Moon className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium">
                      {dark ? "Light Mode" : "Dark Mode"}
                    </span>
                  </button>
                  <button
                    onClick={() => navigate("/scan")}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-400 dark:border-gray-600
     bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
     hover:bg-gray-200 dark:hover:bg-gray-700 
     shadow-sm hover:shadow-md transition-all duration-200
     "
                  >
                    <QrCode className="w-5 h-5" />
                    <span className="text-sm font-medium">Scan QR</span>
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500 
       text-red-500 hover:bg-red-500 hover:text-white 
        shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>

                <div className="flex flex-col gap-4 justify-end">
                  <div className="flex items-center gap-7 text-sm text-gray-600 dark:text-gray-300">
                    <a
                      href="https://www.instagram.com/ye77i.tech?igsh=eHpwaDVhb2R5dWtq"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-pink-500"
                    >
                      <FaInstagram size={20} />
                    </a>
                    <a
                      href="https://t.me/yetti_tech"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-sky-500"
                    >
                      <FaTelegram size={20} />
                    </a>
                    <a
                      href="https://linkedin.com/in/faxriddin_maripov"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600"
                    >
                      <FaLinkedin size={20} />
                    </a>
                  </div>
                  <div className="">
                    <span className="text-[15px]">
                      © 2025, Made with ❤️ by{" "}
                      <span className="font-semibold">Ye77i grup</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(Header);
