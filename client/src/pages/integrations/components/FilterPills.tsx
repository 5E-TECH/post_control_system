import type { ReactNode } from "react";

export interface PillOption {
  value: string;
  label: string;
  count?: number | null;
  icon?: ReactNode;
  /** active holatdagi rang (tailwind sinflari) */
  activeClass?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: PillOption[];
}

/**
 * Filtr "pill"lari — har birida ixtiyoriy sanoq (badge). Admin/dasturchi bir
 * qarashda qaysi guruhda nechta yozuv borligini ko'radi. Segmented'dan ko'ra
 * boyroq va tushunarliroq.
 */
export const FilterPills = ({ value, onChange, options }: Props) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((o) => {
        const active = value === o.value;
        const activeCls =
          o.activeClass ?? "bg-violet-600 text-white border-violet-600";
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
              active
                ? `${activeCls} shadow-sm`
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400"
            }`}
          >
            {o.icon}
            <span>{o.label}</span>
            {o.count != null && (
              <span
                className={`inline-flex min-w-[20px] justify-center rounded-full px-1.5 text-xs font-semibold ${
                  active
                    ? "bg-white/25 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 group-hover:bg-violet-100 group-hover:text-violet-700"
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default FilterPills;
