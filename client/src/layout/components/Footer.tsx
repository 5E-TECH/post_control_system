import { memo, useEffect, useState } from "react";
import { FaInstagram, FaLinkedin, FaTelegram } from "react-icons/fa";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import {
  closeSidebar,
  openSidebar,
} from "../../shared/lib/features/sidebarSlice";
import { ArrowLeft } from "lucide-react";

const Footer = () => {
  useTranslation();
  const dispatch = useDispatch();
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);
  const [sidebar, setSidebar] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Ekran kattaligini kuzatish
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 768 dan past bo‘lsa sidebar yopiladi
  useEffect(() => {
    if (windowWidth <= 768 && sidebarRedux.isOpen) {
      dispatch(closeSidebar());
      setSidebar(true);
    }
  }, [windowWidth, sidebarRedux.isOpen, dispatch]);

  // 649 dan past bo‘lsa footer umuman chiqmasin
  if (windowWidth <= 649) return null;

  const handleDispatch = () => {
    if (sidebar) {
      dispatch(openSidebar());
      setSidebar(false);
    } else {
      dispatch(closeSidebar());
      setSidebar(true);
    }
  };

  return (
    <footer
      className="
        fixed bottom-0 left-0 w-full 
        flex items-center justify-between
        bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)]
        shadow-md
        h-[48px] px-6
      "
    >
      <div className="flex items-center gap-2">
        {/* ArrowLeft faqat 768 dan katta bo‘lsa chiqadi */}
        {windowWidth > 768 && (
          <button
            onClick={handleDispatch}
            className="shadow-md px-2 py-1.5 rounded-md transition-transform duration-300 cursor-pointer absolute bottom-5 left-4"
          >
            <ArrowLeft
              className={`transition-transform duration-300 ${
                !sidebarRedux.isOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
        )}
      </div>

      {/* Footer yozuvlari va iconlar */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
        <span>
          <Trans
            i18nKey="footer.madeWith"
            components={{ bold: <span className="font-semibold" /> }}
          >
            © 2025, Made with ❤️ by{" "}
            <span className="font-semibold">Ye77i group</span>
          </Trans>
        </span>
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

      <div className="w-[72px]" />
    </footer>
  );
};

export default memo(Footer);
