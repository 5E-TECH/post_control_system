import { Repeat } from "lucide-react";

interface OrderLike {
  replacement_of_order_id?: string | null;
  is_replacement_return?: boolean;
  replacement_state?: string | null;
  replacementOf?: { order_number?: number } | null;
}

/**
 * Almashtirish (kafolat-swap) YORLIG'I — ixcham, ko'zga tashlanadigan pill:
 * to'ldirilgan amber fon + "Almashtirish" so'zi, bir qarashda tushunarli.
 * To'liq ma'lumot va havola order-detail sahifasida.
 *   - is_replacement_return   → ESKI (qaytarilayotgan) buyurtma
 *   - replacement_of_order_id → YANGI almashtirish buyurtmasi
 * Oddiy buyurtmada hech narsa ko'rsatmaydi.
 */
const ReplacementBadge = ({
  order,
  className = "",
}: {
  order?: OrderLike | null;
  className?: string;
}) => {
  if (!order) return null;

  const isReturn = !!order.is_replacement_return;
  const isNew = !isReturn && !!order.replacement_of_order_id;
  if (!isReturn && !isNew) return null;

  const oldNo = order.replacementOf?.order_number;
  const title = isReturn
    ? order.replacement_state === "old_returned"
      ? "Almashtirish: eski mahsulot marketga qaytarildi"
      : "Almashtirish: eski mahsulot marketga qaytmoqda"
    : oldNo
      ? `Almashtirish buyurtmasi — eski #${oldNo} o'rniga`
      : "Almashtirish buyurtmasi";

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white shadow ring-1 ring-amber-300/60 dark:ring-amber-400/30 flex-shrink-0 align-middle ${className}`}
    >
      <Repeat className="w-3 h-3" strokeWidth={3} />
    </span>
  );
};

export default ReplacementBadge;
