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
  const [sidebar, setSidebar] = useState(true);
  const dispatch = useDispatch();

  const sidebarRedux = useSelector((state: RootState) => state.sidebar);

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
    const handleResize = () => setIsMobile(window.innerWidth < 700);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <footer className="px-6 fixed bottom-0 w-full left-0 bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)] flex items-center justify-between shadow-md max-[650px]:py-4 max-[650px]:hidden">
      <div className="flex items-center gap-2">
        {!isMobile && (
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
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 max-[1050px]:hidden">
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
