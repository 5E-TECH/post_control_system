import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { FaInstagram, FaLinkedin, FaTelegram } from "react-icons/fa";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

const Footer = () => {
  useTranslation();
  const navigate = useNavigate();

  return (
    <footer className="px-6 fixed bottom-0 w-full left-0 bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)] flex items-center justify-between shadow-md max-[650px]:py-4 max-[650px]:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-full border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() => navigate(1)}
          className="p-2 rounded-full border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <ChevronRight size={20} />
        </button>
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
