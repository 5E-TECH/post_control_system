import { memo, useId } from "react";

interface Props {
  value: string;
  onChange: (digits: string) => void;
  /**
   * To'liq to'lganda chaqiriladi — xodim tugmani bosmasin.
   *
   * ⚠️ Raqamlar ARGUMENT bilan uzatiladi: `onChange` dan keyin `value`
   * propi hali YANGILANMAGAN (React holati keyingi renderda keladi), ya'ni
   * chaqiruvchi `value` ga tayansa ESKI qiymatni yuborardi.
   */
  onComplete?: (digits: string) => void;
  length?: number;
  disabled?: boolean;
  /** Server rad etgandan keyin qizil holat. */
  invalid?: boolean;
  label?: string;
  className?: string;
}

/**
 * 6 XONALI KOD INPUTI (market PIN'i).
 *
 * ⚠️ AUTOFOCUS YO'Q — VA BU ATAYLAB. Shu sahifada APPARAT SKANERI doim
 * aktiv turadi va u klaviatura hodisalari bilan ishlaydi; `useMarketQrScanner`
 * esa fokus `INPUT`/`TEXTAREA` da bo'lsa hodisani O'TKAZIB YUBORADI
 * (useMarketQrScanner.ts:54). Ya'ni bu maydonni avtomatik fokuslasak,
 * sahifaga kirgan xodim QR'ni skanerlay OLMAY qolardi — asosiy yo'l
 * buzilardi. PIN — QR o'qilmagandagi ZAXIRA, shuning uchun fokus faqat
 * xodim o'zi bosganda beriladi.
 *
 * ⚠️ BITTA `<input>`, 6 ta alohida emas. Alohida kataklar chiroyli
 * ko'rinadi, lekin: (a) nusxa-joylashtirish buziladi, (b) brauzerning
 * `one-time-code` avto-to'ldirishi ishlamaydi, (c) backspace mantiqini
 * qo'lda yozish kerak. Shuning uchun bitta maydon — ustiga katak
 * chiziqlari CHIZILADI (fon gradienti), qiymat esa `tracking` bilan
 * kataklarga tushadi.
 *
 * ⚠️ `inputMode="numeric"` — telefonda RAQAMLI klaviatura chiqadi;
 * `autoComplete="one-time-code"` — brauzer SMS/parol menejeridan taklif
 * qiladi. Ikkisi ham bo'lmasa xodim harfli klaviaturada raqam qidirardi.
 */
function PinInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  label,
  className = "",
}: Props) {
  const id = useId();

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    // To'lgan zahoti yuboriladi — «Tasdiqlash» tugmasi faqat zaxira.
    if (digits.length === length) onComplete?.(digits);
  };

  const filled = value.length === length;

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
        >
          {label}
        </label>
      )}

      <input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => handle(e.target.value)}
        onPaste={(e) => {
          // Qo'lda ushlab olinadi: `onChange` joylashtirilgan matnni
          // qiymatga QO'SHIB yuborardi (eski raqamlar oldinda qolardi).
          e.preventDefault();
          handle(e.clipboardData.getData("text"));
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        // `type="text"` — `number` bo'lsa yo'q strelkalar chiqadi va
        // `maxLength` ishlamaydi.
        type="text"
        maxLength={length}
        placeholder={"•".repeat(length)}
        aria-label={label}
        aria-invalid={invalid}
        className={`h-11 w-[9.5rem] rounded-xl border-2 bg-white text-center font-mono text-lg font-bold tabular-nums tracking-[0.35em] text-gray-800 transition-all placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-gray-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2A263D] dark:text-white dark:placeholder:text-gray-600 ${
          invalid
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700"
            : filled
              ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-emerald-600"
              : "border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 dark:border-gray-700"
        }`}
      />
    </div>
  );
}

export default memo(PinInput);
