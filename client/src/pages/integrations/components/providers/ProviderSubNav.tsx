import type { ReactNode } from "react";

export interface SubNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  desc: string;
  content: ReactNode;
}

interface Props {
  items: SubNavItem[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Yetkazuvchi paneli ichidagi sub-tab navigatsiyasi.
 *
 * UMUMIY komponent — LDG va Elchi (va keyingi provayderlar) AYNI shu navni
 * ishlatadi. Har provayder uchun nusxa ko'chirilsa, uchinchisi kelganda
 * uchinchi nusxa paydo bo'lardi va ular asta bir-biridan farq qila boshlardi.
 */
export const ProviderSubNav = ({ items, active, onChange }: Props) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-1">
    {items.map((it) => {
      const on = it.key === active;
      return (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`group flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all cursor-pointer ${
            on
              ? "border-violet-500 bg-violet-50 dark:bg-violet-900/25 shadow-sm"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-violet-300 dark:hover:border-violet-700"
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              on
                ? "bg-violet-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 group-hover:text-violet-600"
            }`}
          >
            {it.icon}
          </span>
          <span className="hidden sm:block">
            <span
              className={`block text-sm font-semibold leading-tight ${
                on
                  ? "text-violet-700 dark:text-violet-300"
                  : "text-gray-700 dark:text-gray-200"
              }`}
            >
              {it.label}
            </span>
            <span className="block text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
              {it.desc}
            </span>
          </span>
          <span
            className={`text-sm font-semibold sm:hidden ${
              on
                ? "text-violet-700 dark:text-violet-300"
                : "text-gray-700 dark:text-gray-200"
            }`}
          >
            {it.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default ProviderSubNav;
