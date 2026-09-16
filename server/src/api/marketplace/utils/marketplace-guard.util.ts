import { BadRequestException } from '@nestjs/common';
import { Where_deliver } from 'src/common/enums';

/**
 * MARKETPLACE BUYURTMASINI QO'LDA O'ZGARTIRISHDAN HIMOYA (bloker B8).
 *
 * ⚠️ MUAMMO. `PATCH order/:id` (`UpdateOrderDto`) da `market_tariff`,
 * `courier_tariff` va `where_deliver` OCHIQ turibdi. Bitta operator
 * kelishilgan 50 000 ni 30 000 qilib qo'ysa:
 *
 *   · `sellOrder` `order.market_tariff` ni USTUN ko'radi va 30 000 yechadi;
 *   · marketplace esa hodisada 30 000 ni ko'radi va o'z daftariga yozadi;
 *   · ikki daftar MOS keladi — lekin ikkalasi ham SHARTNOMADAN chetlashgan.
 *
 * Ya'ni bu jimgina kelishuv buzilishi: hech qayerda xato chiqmaydi.
 *
 * ⚠️ NEGA `courier_tariff` BLOKLANMAYDI. U bizning KURYERGA to'lovimiz va
 * `net_to_marketplace = COD − beepost_fee − extra_cost` formulasiga UMUMAN
 * kirmaydi. Marketplace daftariga ta'siri yo'q — ichki operatsion qaror,
 * cheklab qo'yish noto'g'ri bo'lardi.
 */

export interface TariffOverrideCheckInput {
  market_tariff?: number | null;
  courier_tariff?: number | null;
  where_deliver?: Where_deliver | null;
}

/**
 * `market_tariff` ni qo'lda o'zgartirishni RAD ETADI.
 *
 * @throws BadRequestException marketplace buyurtmasida tarif berilgan bo'lsa.
 */
export function assertMarketplaceTariffNotOverridden(
  order: { integration_id: string | null; market_tariff: number | null },
  dto: TariffOverrideCheckInput,
): void {
  if (!order.integration_id) return; // oddiy market — cheklov yo'q

  if (dto.market_tariff === undefined || dto.market_tariff === null) return;

  // Ayni qiymat qayta yuborilsa — bu o'zgartirish emas, xato ham emas.
  if (
    order.market_tariff !== null &&
    Math.trunc(dto.market_tariff) === Math.trunc(order.market_tariff)
  ) {
    return;
  }

  throw new BadRequestException(
    'Marketplace buyurtmasida yetkazish tarifini qo\'lda o\'zgartirib bo\'lmaydi. ' +
      'Tarif marketplace bilan kelishilgan va qabul paytida muzlatilgan. ' +
      'O\'zgartirish kerak bo\'lsa — integratsiya sozlamasidagi tarif ' +
      'shartnomasini yangilang (u versiyalanadi).',
  );
}

/**
 * `where_deliver` o'zgaryaptimi — va bu tarifni o'zgartiradimi.
 *
 * ⚠️ Bu BLOKLANMAYDI: mijoz «uyga olib keling» deyishi normal operatsion
 * holat. Lekin u BeePost haqqini 50 000 dan 70 000 ga ko'taradi, ya'ni
 * marketplace darhol xabardor bo'lishi kerak (`parcel.fee_changed`).
 * Aks holda ular eski tarif bo'yicha hisoblab, daftar ajralardi.
 */
export function detectFeeBasisChange(
  order: { integration_id: string | null; where_deliver: Where_deliver },
  dto: TariffOverrideCheckInput,
): { changed: boolean; from: Where_deliver; to: Where_deliver } {
  const to = dto.where_deliver ?? order.where_deliver;
  return {
    changed: !!order.integration_id && to !== order.where_deliver,
    from: order.where_deliver,
    to,
  };
}
