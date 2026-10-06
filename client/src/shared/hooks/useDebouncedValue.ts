import { useEffect, useMemo, useState } from "react";
import debounce from "lodash/debounce";

/**
 * QIDIRUV KIRITMASINI KECHIKTIRISH.
 *
 * ⚠️ NEGA KERAK. Qidiruv qiymati to'g'ridan-to'g'ri so'rov parametriga
 * ulansa, HAR HARFDA serverga so'rov ketadi — «Anvar» so'zi 5 ta so'rov
 * beradi va ro'yxat ko'z oldida bir necha marta sakraydi. Hajm o'lchovi
 * kuniga ~150 qaytarish, navbatda 450–2000 qator — bu bekorga yuk.
 *
 * Loyihada bu naqsh allaqachon bor (`refused-mail-detail`: `lodash/debounce`
 * + alohida `debouncedSearch` holati). Shu yerda ayni mantiq bitta hookka
 * yig'ilgan, shuning uchun uchta sahifada takrorlanmaydi.
 *
 * ⚠️ `cancel()` unmount'da chaqiriladi: aks holda sahifa yopilgandan keyin
 * kechikkan `setState` ishga tushib, React ogohlantirish berardi.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState<T>(value);

  const apply = useMemo(
    () => debounce((next: T) => setDebounced(next), delayMs),
    [delayMs],
  );

  useEffect(() => {
    apply(value);
  }, [value, apply]);

  useEffect(() => {
    return () => {
      apply.cancel();
    };
  }, [apply]);

  return debounced;
}
