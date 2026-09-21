import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceTariffEntity } from 'src/core/entity/marketplace-tariff.entity';
import { Where_deliver } from 'src/common/enums';
import { feeBasis } from './utils/marketplace-money.util';
import { MarketplaceLedgerService } from './marketplace-ledger.service';
import { buildEventStatus } from './utils/marketplace-status.util';
import { MarketplaceOutboxService } from './marketplace-outbox.service';
import {
  MarketplaceEventType,
  MarketplaceLedgerEntryType,
} from './marketplace.enums';
import { EventMoney } from './utils/marketplace-event.util';

export interface RecordMoneyEventInput {
  order: OrderEntity;
  event_type: MarketplaceEventType;
  entry_type: MarketplaceLedgerEntryType;
  /** MARKET kassasidagi ISHORALI o'zgarish — daftar aynan shuni yozadi. */
  ledger_amount: number;
  /** Bog'langan kassa yozuvi — idempotentlik langari. */
  cashbox_history_id?: string | null;
  money?: EventMoney;
  status?: { from: string | null; to: string };
  actor?: { type: string; name?: string | null };
  reverses_entry_id?: string | null;
  items_delivered?: Array<{ sku: string | null; quantity: number }>;
  items_returned?: Array<{ sku: string | null; quantity: number }>;
  note?: string | null;
}

/**
 * MARKETPLACE SINXRON FASADI — buyurtma hayotiy sikli uchun YAGONA nuqta.
 *
 * ⚠️ NEGA FASAD. `OrderService` ga to'g'ridan-to'g'ri daftar + outbox + ikki
 * repozitoriy qo'shsak, uning konstruktoriga TO'RT yangi bog'liqlik tushardi.
 * Har biri `DashboardModule` ga ham import qilinishi kerak bo'lardi (bloker
 * B10: u `OrderService` ni o'z provideri sifatida qayta e'lon qiladi va
 * NestJS u yerda ikkinchi nusxasini quradi). Bitta fasad = bitta bog'liqlik.
 *
 * ⚠️ TEZ YO'L. Metod `order.integration_id` NULL bo'lsa DARHOL chiqadi —
 * hech qanday so'rov yubormaydi. Bu muhim: u HAR SOTUVDA chaqiriladi va
 * oddiy marketlar uchun narxi nolga teng bo'lishi kerak.
 */
@Injectable()
export class MarketplaceSyncService {
  private readonly logger = new Logger(MarketplaceSyncService.name);

  constructor(
    @InjectRepository(MarketplaceParcelEntity)
    private readonly parcelRepo: Repository<MarketplaceParcelEntity>,
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    private readonly ledger: MarketplaceLedgerService,
    private readonly outbox: MarketplaceOutboxService,
  ) {}

  /** Buyurtma marketplace'nikimi (tez tekshiruv, so'rovsiz). */
  isMarketplaceOrder(order: Pick<OrderEntity, 'integration_id'>): boolean {
    return !!order.integration_id;
  }

  /**
   * Pul hodisasini qayd etadi: daftar yozuvi + chiquvchi hodisa.
   *
   * ⚠️ CHAQIRUVCHINING tranzaksiya manageri bilan — ya'ni kassa yozuvi,
   * daftar qatori va outbox qatori BITTA tranzaksiyada. Bloker B3 shu
   * bilan yopiladi: commit'dan keyin `await`siz chaqirish yo'q.
   *
   * ⚠️ XATO YUTILMAYDI. Muammo bo'lsa butun tranzaksiya qaytariladi.
   * Sabab: daftarsiz pul harakati — ikki daftarning jimgina ajralishi
   * demak, va uni keyin topib bo'lmaydi. Ochiq xato yaxshiroq.
   */
  async recordOrderMoneyEvent(
    manager: EntityManager,
    input: RecordMoneyEventInput,
  ): Promise<void> {
    const order = input.order;
    if (!order.integration_id) return; // tez yo'l — oddiy market

    const [integration, parcel] = await Promise.all([
      manager.findOne(MarketplaceIntegrationEntity, {
        where: { id: order.integration_id },
      }),
      manager.findOne(MarketplaceParcelEntity, { where: { order_id: order.id } }),
    ]);

    if (!integration) {
      // Buyurtmada `integration_id` bor, lekin ulanish yo'q — sozlash xatosi.
      throw new Error(
        `Marketplace ulanishi topilmadi (order ${order.id}, integration ${order.integration_id})`,
      );
    }
    if (!parcel) {
      // Buyurtma marketplace deb belgilangan, lekin qabul oqimidan
      // o'tmagan. Daftarni baribir yozamiz (pul haqiqatda harakat qilgan),
      // lekin hodisa yuborib bo'lmaydi.
      this.logger.error(
        `⚠️ posilka topilmadi (order ${order.id}) — daftar yoziladi, hodisa YUBORILMAYDI`,
      );
    }

    /**
     * TARIF VERSIYASI — kontrakt §12 talabi: u HAR HODISADA bo'lishi shart
     * («qaysi tarif qo'llandi» bahsi chiqmasin).
     *
     * ⚠️ Sotuv paytida biz faqat muzlatilgan SUMMANI bilamiz
     * (`order.market_tariff`), versiyani emas — u buyurtmada saqlanmaydi.
     * Shuning uchun posilka QABUL QILINGAN paytdagi amaldagi versiyani
     * qidiramiz: summa aynan o'sha versiyadan muzlatilgan.
     *
     * Avval bu maydon sotuv/bekor hodisalarida umuman YO'Q edi (faqat
     * qabulda bor edi) — uchdan-uchga sinov shuni ushladi.
     */
    const tariffVersion =
      input.money?.tariff_version ??
      (await this.resolveTariffVersion(
        manager,
        integration.id,
        parcel?.accepted_at ?? null,
      ));

    const money = input.money
      ? { ...input.money, tariff_version: tariffVersion ?? undefined }
      : input.money;

    const entry = await this.ledger.appendEntry(manager, {
      integration_id: integration.id,
      entry_type: input.entry_type,
      amount: input.ledger_amount,
      seller_id: order.external_seller_id ?? parcel?.seller_id ?? null,
      order_id: order.id,
      external_parcel_id: parcel?.external_parcel_id ?? null,
      cashbox_history_id: input.cashbox_history_id ?? null,
      reverses_entry_id: input.reverses_entry_id ?? null,
      tariff_version: tariffVersion,
      note: input.note ?? null,
    });

    if (!parcel) return;

    await this.outbox.enqueueParcelEvent(manager, {
      integration: { id: integration.id, slug: integration.slug },
      parcel,
      event_type: input.event_type,
      // ⚠️ HAMKOR TILIGA o'giriladi: (1) PCS ichki statusi → kanonik,
      // (2) kanonik → sozlangan xarita. Xom `waiting`/`on the road`
      // kontrakt lug'atida YO'Q — hamkor ularni tushunmaydi.
      status: buildEventStatus(integration.status_map, input.status),
      money,
      ledger: {
        entry_id: entry.id,
        seq: Number(entry.seq),
        balance_after: entry.balance_after,
      },
      actor: input.actor,
      order: { id: order.id, order_number: Number(order.order_number) },
      items_delivered: input.items_delivered,
      items_returned: input.items_returned,
      note: input.note,
    });
  }

  /**
   * TESKARI YOZUV (rollback) — asl yozuvni topib, unga BOG'LAYDI.
   *
   * ⚠️ NEGA BOG'LASH KERAK. Faqat `entry_type` bo'yicha hisoblash yetarli
   * emas: `CORRECTION` juftligi ham sotuv reversali, ham ortiqcha xarajat
   * reversali uchun ishlatiladi. Sodda so'rov ularni ikki marta sanardi va
   * har-sotuvchi jamlanma jimgina siljirdi.
   *
   * ⚠️ Summani QAYTA HISOBLAMAYMIZ — asl yozuvning teskarisini olamiz.
   * Bloker B5: `rollbackOrderToWaiting` tariflarni JORIY foydalanuvchi
   * qatoridan o'qiydi; tarif o'zgargandan keyin rollback asl sotuvdan
   * BOSHQA summani qaytarardi va daftar abadiy siljirdi.
   */
  async recordReversal(
    manager: EntityManager,
    input: {
      order: OrderEntity;
      event_type: MarketplaceEventType;
      /** MARKET kassasidagi ISHORALI o'zgarish (odatda manfiy). */
      ledger_amount: number;
      cashbox_history_id?: string | null;
      status?: { from: string | null; to: string };
      actor?: { type: string; name?: string | null };
      note?: string | null;
    },
  ): Promise<void> {
    if (!input.order.integration_id) return;

    // Shu buyurtmaning hali QAYTARILMAGAN oxirgi pul yozuvi.
    const rows: Array<{ id: string; tariff_version: number | null }> =
      await manager.query(
        `SELECT le."id", le."tariff_version"
           FROM "marketplace_ledger_entry" le
          WHERE le."order_id" = $1
            AND le."entry_type" IN ('sale', 'cancel')
            AND NOT EXISTS (
              SELECT 1 FROM "marketplace_ledger_entry" r
               WHERE r."reverses_entry_id" = le."id"
            )
          ORDER BY le."seq" DESC
          LIMIT 1`,
        [input.order.id],
      );
    const original = rows?.[0] ?? null;

    await this.recordOrderMoneyEvent(manager, {
      order: input.order,
      event_type: input.event_type,
      entry_type: MarketplaceLedgerEntryType.CORRECTION,
      ledger_amount: input.ledger_amount,
      cashbox_history_id: input.cashbox_history_id ?? null,
      reverses_entry_id: original?.id ?? null,
      money: {
        currency: 'UZS',
        net_to_marketplace: input.ledger_amount,
        tariff_version: original?.tariff_version ?? undefined,
      },
      // ⚠️ Xaritalash `recordOrderMoneyEvent` ichida — bu yerda XOM
      // qiymat uzatiladi, aks holda ikki marta o'girilardi.
      status: input.status,
      actor: input.actor,
      note: input.note ?? 'Ortga qaytarildi',
    });

    if (!original) {
      // Asl yozuv topilmadi — daftar baribir to'g'ri qoladi (summa
      // kassadan olingan), lekin bog'lanish yo'q. Panelda ko'rinadi.
      this.logger.warn(
        `⚠️ teskari yozuv uchun asl qator topilmadi (order ${input.order.id})`,
      );
    }
  }

  /**
   * YETKAZISH TURI O'ZGARDI → tarifni QAYTA MUZLATADI va hodisa yuboradi.
   *
   * ⚠️ NEGA BLOKLAMAYMIZ. Mijoz «uyga olib keling» deyishi normal operatsion
   * holat — uni taqiqlash operatorni ishdan to'xtatardi. Lekin u BeePost
   * haqqini 50 000 dan 70 000 ga ko'taradi, ya'ni marketplace DARHOL
   * xabardor bo'lishi kerak. Aks holda ular eski tarif bo'yicha hisoblab
   * yuradi va daftar jimgina ajraladi.
   *
   * ⚠️ Yangi tarif AMALDAGI shartnoma versiyasidan olinadi — qo'lda
   * kiritilgan raqamdan emas (bloker B8).
   *
   * Buyurtma SAQLANMAYDI — chaqiruvchi uni o'z tranzaksiyasida saqlaydi.
   */
  async applyFeeBasisChange(
    manager: EntityManager,
    input: {
      order: OrderEntity;
      new_where_deliver: Where_deliver;
      actor?: { type: string; name?: string | null };
      note?: string | null;
    },
  ): Promise<{ applied: boolean; fee_before: number; fee_after: number }> {
    const order = input.order;
    const feeBefore = Number(order.market_tariff ?? 0);
    if (!order.integration_id) {
      return { applied: false, fee_before: feeBefore, fee_after: feeBefore };
    }

    const [integration, parcel, tariff] = await Promise.all([
      manager.findOne(MarketplaceIntegrationEntity, {
        where: { id: order.integration_id },
      }),
      manager.findOne(MarketplaceParcelEntity, { where: { order_id: order.id } }),
      manager.findOne(MarketplaceTariffEntity, {
        where: { integration_id: order.integration_id, effective_to: IsNull() },
      }),
    ]);

    if (!integration || !tariff) {
      throw new Error(
        `Marketplace tarifi sozlanmagan (order ${order.id}) — yetkazish turini o'zgartirib bo'lmaydi`,
      );
    }

    const feeAfter =
      input.new_where_deliver === Where_deliver.CENTER
        ? Number(tariff.tariff_center)
        : Number(tariff.tariff_home);

    // Tarifni QAYTA MUZLATAMIZ — sotuvda `sellOrder` shuni ustun ko'radi.
    order.market_tariff = feeAfter;

    if (parcel) {
      await this.outbox.enqueueParcelEvent(manager, {
        integration: { id: integration.id, slug: integration.slug },
        parcel,
        event_type: MarketplaceEventType.PARCEL_FEE_CHANGED,
        money: {
          currency: 'UZS',
          beepost_fee: feeAfter,
          beepost_fee_basis: feeBasis(input.new_where_deliver),
          tariff_version: tariff.version,
        },
        order: { id: order.id, order_number: Number(order.order_number) },
        actor: input.actor,
        note:
          input.note ??
          `Yetkazish turi o'zgardi: ${feeBasis(order.where_deliver)} → ` +
            `${feeBasis(input.new_where_deliver)} (haq ${feeBefore} → ${feeAfter})`,
      });
    }

    this.logger.log(
      `💱 tarif qayta muzlatildi (order ${order.id}): ${feeBefore} → ${feeAfter}`,
    );
    return { applied: true, fee_before: feeBefore, fee_after: feeAfter };
  }

  /**
   * Pulsiz holat hodisasi (jo'natildi, qaytish yo'lida, qaytarildi).
   * Daftarga TEGMAYDI — qaror P7: qaytarish bepul.
   */
  async recordStatusEvent(
    manager: EntityManager,
    input: {
      order: OrderEntity;
      event_type: MarketplaceEventType;
      status?: { from: string | null; to: string };
      actor?: { type: string; name?: string | null };
      note?: string | null;
    },
  ): Promise<void> {
    if (!input.order.integration_id) return;

    const [integration, parcel] = await Promise.all([
      manager.findOne(MarketplaceIntegrationEntity, {
        where: { id: input.order.integration_id },
      }),
      manager.findOne(MarketplaceParcelEntity, {
        where: { order_id: input.order.id },
      }),
    ]);
    if (!integration || !parcel) return;

    await this.outbox.enqueueParcelEvent(manager, {
      integration: { id: integration.id, slug: integration.slug },
      parcel,
      event_type: input.event_type,
      // ⚠️ HAMKOR TILIGA o'giriladi: (1) PCS ichki statusi → kanonik,
      // (2) kanonik → sozlangan xarita. Xom `waiting`/`on the road`
      // kontrakt lug'atida YO'Q — hamkor ularni tushunmaydi.
      status: buildEventStatus(integration.status_map, input.status),
      actor: input.actor,
      order: {
        id: input.order.id,
        order_number: Number(input.order.order_number),
      },
      note: input.note,
    });
  }
  /**
   * Posilka QABUL QILINGAN paytda amalda bo'lgan tarif versiyasi.
   *
   * Tarif jadvali versiyalangan (`effective_from` / `effective_to`), shuning
   * uchun vaqt bo'yicha aniq topiladi. `accepted_at` yo'q bo'lsa — joriy
   * versiya (qabul qilinmagan posilka uchun pul hodisasi bo'lmasligi kerak,
   * lekin jimgina `null` qoldirmaymiz).
   */
  private async resolveTariffVersion(
    manager: EntityManager,
    integrationId: string,
    acceptedAt: number | null,
  ): Promise<number | null> {
    const at = Number(acceptedAt ?? Date.now());
    const rows: Array<{ version: number }> = await manager.query(
      `SELECT "version" FROM "marketplace_tariff"
        WHERE "integration_id" = $1
          AND "effective_from" <= $2
          AND ("effective_to" IS NULL OR "effective_to" > $2)
        ORDER BY "version" DESC
        LIMIT 1`,
      [integrationId, at],
    );
    return rows?.length ? Number(rows[0].version) : null;
  }

}
