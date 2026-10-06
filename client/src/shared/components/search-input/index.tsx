import { memo, useRef } from "react";
import { Loader2, Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Debounce ishlayotganini ko'rsatadi — ikonka spinnerga aylanadi. */
  loading?: boolean;
  /** Tashqi o'ram sinflari (kenglik/flex) — ko'rinish o'zgarmaydi. */
  className?: string;
  /** Enter bosilganda (ba'zi sahifalarda darhol qo'llash kerak). */
  onEnter?: () => void;
  "aria-label"?: string;
}

/**
 * QIDIRUV INPUTI — loyihaning XOM `<input>` dialekti.
 *
 * ⚠️ NEGA antd `Input` EMAS. Kod bazasida qidiruv inputi hamma joyda xom
 * `<input>` + absolyut ikonka naqshida yozilgan (`today-orders`,
 * `logs-page`, `marketplace-intake`, `users/*`, `market-operators`) va
 * antd `Input` dan vizual jihatdan sezilarli farq qiladi: balandlik 10
 * (40px) emas, radius `rounded-xl` emas, fokus halqasi binafsha emas.
 * antd variantini ishlatgan sahifa qolganlardan ajralib turardi.
 *
 * ⚠️ NEGA KOMPONENT, NUSXA EMAS. Ayni input ikki sahifada kerak (market
 * ro'yxati va admin navbati) va uchinchisi ham qo'shilishi mumkin. Sinf
 * ro'yxati 9 ta modifikatorli — nusxalansa biri jimgina orqada qolardi
 * (loyihada `pl-9` va `pl-10` variantlari allaqachon ajralib ketgan).
 *
 * ⚠️ TOZALASH TUGMASI o'ngda: antd `allowClear` o'rnini bosadi, LEKIN
 * teginish nishoni kattaroq (36px) — telefonda antd'ning 14px ikonkasiga
 * tegish qiyin edi.
 */
function SearchInput({
  value,
  onChange,
  placeholder,
  loading = false,
  className = "",
  onEnter,
  "aria-label": ariaLabel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`relative ${className}`}>
      {/* `pointer-events-none` — ikonka ustiga bosilganda ham input fokuslanadi. */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
        ) : (
          <Search className="h-4 w-4 text-gray-400" />
        )}
      </span>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.();
          // Escape — tozalash (brauzer `type=search` da o'zi qiladi, lekin
          // nazoratli inputda holat yangilanmay qolardi).
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 transition-all placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-[#2A263D] dark:text-white [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value && (
        <button
          type="button"
          // Tozalagandan keyin fokus inputda qolsin — yozishni davom etish uchun.
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="clear"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default memo(SearchInput);
