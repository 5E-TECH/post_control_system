import { EntityManager, IsNull } from 'typeorm';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { Group_type } from 'src/common/enums';

/**
 * MARKETNING TELEGRAM GURUHLARINI TOPISH — ESKI QATORLARNI HAM QAMRAB.
 *
 * ── MUAMMO ──────────────────────────────────────────────────────────────
 *
 * `group_type` ustuni keyinroq qo'shilgan (fed3c39c, 2025-11-25). Undan
 * OLDIN ulangan guruhlarda bu ustun BO'SH (NULL).
 *
 * Xabar yuborish esa doim aniq turni qidiradi:
 *     where: { market_id, group_type: Group_type.CREATE }
 * NULL hech qachon mos kelmaydi — ya'ni eski qatorli marketlar botni
 * ulagan, "ishlayapti" deb o'ylagan, lekin AMALDA hech qanday xabar
 * olmagan. Xato ham chiqmagan, log ham yozilmagan.
 *
 * Lokal bazada shunday 2 ta jonli market bor: `market1` (2025-10-09 dan)
 * va `Tedbook` (2025-11-26 dan).
 *
 * ── NEGA `IN (tur, NULL)` EMAS ──────────────────────────────────────────
 *
 * ⚠️ Eng oddiy yechim — shartga NULL ni QO'SHIB yuborish — XATO bo'lardi.
 *
 * `8810` marketida HAM eski NULL qator, HAM yangi `create`/`cancel`
 * qatorlar bor. Ikkalasi ham mos kelsa, u BITTA buyurtma uchun IKKI
 * guruhga xabar olardi — ya'ni tuzatish o'rniga takrorlanish bug'i.
 *
 * Shu sabab bu yerda ZAXIRA (fallback) mantig'i:
 *     · avval ANIQ turdagi qatorlar qidiriladi;
 *     · FAQAT ular topilmasa, eski NULL qatorlarga tushiladi.
 *
 * Natija:
 *     market1 / Tedbook  -> `create` yo'q  -> eski qator ishlatiladi ✅
 *     8810               -> `create` bor   -> eski qator E'TIBORSIZ ✅
 *
 * ── ESKI `|| null` YOZUVI ───────────────────────────────────────────────
 *
 * Kodda `group_type: Group_type.CANCEL || null` ko'rinishidagi yozuv bor
 * edi (order.service.ts:3644, :4362). Muallif aynan shu NULL qatorlarni
 * qamrab olmoqchi bo'lgan, lekin bu O'LIK shart: `Group_type.CANCEL`
 * bo'sh bo'lmagan satr, shuning uchun `||` hech qachon o'ng tomonga
 * o'tmaydi. Ya'ni niyat to'g'ri edi, bajarilishi ishlamagan.
 */
export async function findMarketGroups(
  manager: EntityManager,
  marketId: string,
  type: Group_type,
): Promise<TelegramEntity[]> {
  if (!marketId) return [];

  const typed = await manager.find(TelegramEntity, {
    where: { market_id: marketId, group_type: type },
  });
  if (typed.length > 0) return typed;

  /**
   * ⚠️⚠️ ZAXIRA FAQAT `cancel` UCHUN — `create` UCHUN EMAS.
   *
   * Bu shart olib tashlansa jiddiy REGRESSIYA bo'ladi. Sabab:
   *
   * 1. `cancel` — sof XABARNOMA. Guruhga xabar boradi, tamom. Eski
   *    qatorga tushish zararsiz: market ilgari olmagan xabarni oladi.
   *
   * 2. `create` — XABARNOMA EMAS, DARVOZA. Guruh topilsa buyurtma
   *    `CREATED` holatiga o'tadi va marketning ✅ tugmasini KUTADI
   *    (order.service.ts:721-730). Tugma bosilganda ruxsat
   *    `order-bot.service.ts:591-597` da tekshiriladi va u QAT'IY
   *    `group_type: CREATE` qidiradi. Eski (NULL) qator bu tekshiruvdan
   *    O'TMAYDI — ya'ni tugma ishlamaydi va buyurtma `CREATED` da
   *    QOTIB QOLADI. Bunday buyurtma esa default ro'yxatda
   *    KO'RSATILMAYDI (order.service.ts:249-254) — ya'ni u jimgina
   *    yo'qoladi. Bazada 8810 da aynan shunday 2 ta qator bor.
   *
   * 3. Tarix ham buni tasdiqlaydi: eski NULL qatorlar 2025-10-09 va
   *    2025-11-26 sanali, `order_create-bot` moduli esa 2025-11-25 da
   *    yaratilgan va unga `Group_type.CREATE` faqat 2025-12-03 da
   *    (c4962715) qo'shilgan. Ya'ni bu qatorlar notify-bot (bekor
   *    qilish) guruhlari — order-bot ularda a'zo ham emas.
   *
   * `create` uchun bo'sh massiv qaytarish ESKI, ISHLAYDIGAN xatti-
   * harakatni saqlaydi: guruh topilmaydi -> buyurtma to'g'ridan-to'g'ri
   * `NEW` ga o'tadi (order.service.ts:721) va normal ishlaydi.
   */
  if (type !== Group_type.CANCEL) return [];

  // Zaxira: turi belgilanmagan eski qatorlar (faqat `cancel` yo'lida).
  return manager.find(TelegramEntity, {
    where: { market_id: marketId, group_type: IsNull() },
  });
}

/**
 * `findMarketGroups` ning bitta qator qaytaradigan ko'rinishi —
 * `findOne` ishlatilgan joylar uchun. Topilmasa `null`.
 */
export async function findMarketGroup(
  manager: EntityManager,
  marketId: string,
  type: Group_type,
): Promise<TelegramEntity | null> {
  const rows = await findMarketGroups(manager, marketId, type);
  return rows[0] ?? null;
}
