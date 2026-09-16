import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceLedgerEntryEntity } from 'src/core/entity/marketplace-ledger-entry.entity';
import { MarketplaceOutboxEntity } from 'src/core/entity/marketplace-outbox.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceOutboxStatus } from './marketplace.enums';

const MAX_LIMIT = 200;

/**
 * MARKETPLACE O'QIY OLADIGAN MA'LUMOT (kontrakt §5).
 *
 * ⚠️ HAR SO'ROV `integration_id` BILAN CHEKLANADI. Slug URL'da, integratsiya
 * esa qo'riqchi tomonidan aniqlanadi — ya'ni bir marketplace boshqasining
 * ma'lumotini so'ray olmaydi. Filtr har metodda MAJBURIY parametr sifatida
 * turadi (ixtiyoriy emas) — unutib qoldirish imkoni bo'lmasin.
 *
 * ⚠️ YOZUV YO'Q (qaror O5). Qabuldan keyin posilkaning holati ham, puli ham
 * faqat BeePost tomonidan o'zgaradi.
 */
@Injectable()
export class MarketplacePublicService {
  constructor(
    @InjectRepository(MarketplaceParcelEntity)
    private readonly parcelRepo: Repository<MarketplaceParcelEntity>,
    @InjectRepository(MarketplaceLedgerEntryEntity)
    private readonly ledgerRepo: Repository<MarketplaceLedgerEntryEntity>,
    @InjectRepository(MarketplaceOutboxEntity)
    private readonly outboxRepo: Repository<MarketplaceOutboxEntity>,
  ) {}

  /** §5.1 — bizdagi posilka holati va puli. */
  async getParcel(integration: MarketplaceIntegrationEntity, externalParcelId: string) {
    const parcel = await this.parcelRepo.findOne({
      where: {
        integration_id: integration.id,
        external_parcel_id: externalParcelId,
      },
      relations: { order: true },
    });
    if (!parcel) {
      throw new NotFoundException(`Posilka topilmadi: ${externalParcelId}`);
    }

    // Oxirgi pul hodisasidan summalarni olamiz — daftar emas, hodisa
    // kontraktdagi shaklni saqlaydi.
    const lastMoney = await this.outboxRepo.findOne({
      where: { aggregate_id: parcel.id },
      order: { seq: 'DESC' },
    });
    const money =
      (lastMoney?.payload as Record<string, any> | undefined)?.money ?? null;

    return {
      external_parcel_id: parcel.external_parcel_id,
      external_order_id: parcel.external_order_id,
      seller_id: parcel.seller_id,
      beepost_order_number: parcel.order
        ? Number(parcel.order.order_number)
        : null,
      status: parcel.remote_status,
      status_at: parcel.remote_status_at,
      last_sent_seq: Number(parcel.last_sent_seq),
      accepted_at: parcel.accepted_at,
      money,
    };
  }

  /** §5.2 — bizdagi daftar. */
  async getLedger(
    integration: MarketplaceIntegrationEntity,
    q: { seller_id?: string; from?: number; to?: number; limit?: number; cursor?: string },
  ) {
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), MAX_LIMIT);
    const qb = this.ledgerRepo
      .createQueryBuilder('le')
      // ⚠️ Bu shart HAR DOIM birinchi — boshqa marketplace ma'lumoti
      // chiqib ketishining yagona yo'li shu filtrni unutish bo'lardi.
      .where('le.integration_id = :iid', { iid: integration.id });

    if (q.seller_id) qb.andWhere('le.seller_id = :sid', { sid: q.seller_id });
    if (q.from) qb.andWhere('le.created_at >= :from', { from: Number(q.from) });
    if (q.to) qb.andWhere('le.created_at <= :to', { to: Number(q.to) });
    if (q.cursor) qb.andWhere('le.seq < :cur', { cur: Number(q.cursor) });

    const rows = await qb.orderBy('le.seq', 'DESC').take(limit + 1).getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const [{ balance }]: Array<{ balance: string | null }> =
      await this.ledgerRepo.query(
        `SELECT COALESCE(SUM("amount"), 0) AS balance
           FROM "marketplace_ledger_entry" WHERE "integration_id" = $1`,
        [integration.id],
      );

    return {
      currency: 'UZS',
      balance: Number(balance ?? 0),
      as_of: Date.now(),
      entries: page.map((e) => ({
        entry_id: e.id,
        seq: Number(e.seq),
        seller_id: e.seller_id,
        external_parcel_id: e.external_parcel_id,
        type: e.entry_type,
        amount: Number(e.amount),
        balance_after: Number(e.balance_after),
        created_at: Number(e.created_at),
        note: e.note,
      })),
      next_cursor: hasMore ? String(page[page.length - 1].seq) : null,
    };
  }

  /**
   * §5.3 — yo'qolgan hodisani qayta olish.
   *
   * ⚠️ Faqat YUBORILGAN hodisalar qaytariladi. Navbatdagi (`pending`) yoki
   * tashlangan (`failed`) qatorlar ko'rsatilmaydi: marketplace ularni
   * «yetib kelgan» deb hisoblab, keyin haqiqiy yuborishda dublikat
   * sifatida rad etardi va hodisa jimgina yo'qolardi.
   */
  async getEvents(
    integration: MarketplaceIntegrationEntity,
    q: { since_seq?: number; external_parcel_id?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), MAX_LIMIT);
    const qb = this.outboxRepo
      .createQueryBuilder('o')
      .where('o.integration_id = :iid', { iid: integration.id })
      .andWhere('o.status = :sent', { sent: MarketplaceOutboxStatus.SENT });

    if (q.since_seq !== undefined) {
      qb.andWhere('o.seq > :since', { since: Number(q.since_seq) });
    }
    if (q.external_parcel_id) {
      qb.andWhere(
        `o.aggregate_id IN (
           SELECT p."id" FROM "marketplace_parcel" p
            WHERE p."integration_id" = :iid2
              AND p."external_parcel_id" = :pid
         )`,
        { iid2: integration.id, pid: q.external_parcel_id },
      );
    }

    const rows = await qb.orderBy('o.seq', 'ASC').take(limit + 1).getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      events: page.map((r) => r.payload),
      next_cursor: hasMore ? String(page[page.length - 1].seq) : null,
    };
  }
}
