import type { OrderProduct } from "../api/hooks/useMarketHandover";

/**
 * BUYURTMADAGI MAHSULOTLARNI RO'YXAT USTUNI UCHUN TAYYORLASH.
 *
 * ⚠️ NEGA KERAK. Market omborga kelishdan oldin NIMA olib ketishini
 * bilishi kerak: u posilkani «#100342» deb emas, «televizor» deb
 * eslaydi. Avval ro'yxatda faqat «2 dona» turardi — bu hech narsa
 * demaydi.
 *
 * ⚠️ MARKETPLACE BUYURTMALARIDA `items` BO'SH. `marketplace-intake`
 * ataylab `order_item` yaratmaydi (izoh o'sha faylda), ya'ni
 * `product_quantity > 0` bo'lsa ham mahsulot nomi YO'Q. Shu holat
 * qoplanmasa ustun bo'm-bo'sh chiqib, market «mahsulot yo'qolibdi»
 * deb o'ylardi — shuning uchun donaga qaytiladi.
 *
 * ⚠️ `item.product` NULL bo'lishi mumkin (mahsulot keyin o'chirilgan) —
 * server allaqachon `"—"` qaytaradi, bu yerda qo'shimcha himoya shart
 * emas, lekin bo'sh nom baribir filtrlanadi.
 */

/** Ustunda ko'rinadigan eng ko'p mahsulot nomi. */
const VISIBLE = 2;

export interface ProductSummary {
  /** Ustunda ko'rsatiladigan nomlar (`VISIBLE` tagacha). */
  visible: Array<{ name: string; quantity: number }>;
  /** Sig'magan mahsulotlar soni — `+N` yorlig'i uchun. */
  hiddenCount: number;
  /** Tooltip uchun TO'LIQ ro'yxat, bitta satrda. */
  fullText: string;
  /** Jami dona (items bo'sh bo'lsa `product_quantity` dan). */
  totalQuantity: number;
  /** `true` — nom yo'q, faqat dona ko'rsatiladi (marketplace holati). */
  nameless: boolean;
}

export function summarizeProducts(
  items: OrderProduct[] | null | undefined,
  productQuantity: number | null | undefined,
): ProductSummary {
  const list = (items ?? []).filter((i) => i && i.name && i.name.trim());

  if (!list.length) {
    return {
      visible: [],
      hiddenCount: 0,
      fullText: "",
      totalQuantity: Math.max(0, Number(productQuantity ?? 0)),
      nameless: true,
    };
  }

  const totalQuantity = list.reduce(
    (sum, i) => sum + Math.max(0, Number(i.quantity ?? 0)),
    0,
  );

  return {
    visible: list.slice(0, VISIBLE).map((i) => ({
      name: i.name,
      quantity: Math.max(0, Number(i.quantity ?? 0)),
    })),
    hiddenCount: Math.max(0, list.length - VISIBLE),
    // Loyihadagi naqsh: `nom x2, nom x1` (replacement-returns bilan ayni).
    fullText: list.map((i) => `${i.name} x${i.quantity}`).join(", "),
    totalQuantity,
    nameless: false,
  };
}
