import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { pgReturningNumber } from 'src/common/database/pg-returning.util';
import { randomUUID } from 'node:crypto';
import { MarketplaceOutboxEntity } from 'src/core/entity/marketplace-outbox.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import {
  MarketplaceAggregateType,
  MarketplaceEventType,
  MarketplaceOutboxStatus,
} from './marketplace.enums';
import {
  buildEventEnvelope,
  EventMoney,
} from './utils/marketplace-event.util';

export interface EnqueueParcelEventInput {
  integration: { id: string; slug: string };
  parcel: MarketplaceParcelEntity;
  event_type: MarketplaceEventType;
  occurred_at?: number;
  status?: { from: string | null; to: string };
  money?: EventMoney;
  // `seq` — integratsiya bo'yicha GLOBAL daftar raqami; `balance_after`
  // faqat shu tartibda solishtiriladi (batafsil: `marketplace-event.util.ts`).
  ledger?: { entry_id: string; seq: number; balance_after: number };
  actor?: { type: string; name?: string | null };
  order?: { id: string; order_number: number } | null;
  items_delivered?: Array<{ sku: string | null; quantity: number }>;
  items_returned?: Array<{ sku: string | null; quantity: number }>;
  note?: string | null;
  reason?: string | null;
}

/**
 * TRANZAKSION OUTBOX — chiquvchi hodisalarni navbatga qo'yish.
 *
 * ⚠️ ENG MUHIM QOIDA: `enqueue` CHAQIRUVCHINING TRANZAKSIYA MANAGERINI
 * oladi, o'zi tranzaksiya ochmaydi. Ya'ni hodisa PUL BILAN BITTA
 * tranzaksiyada yoziladi.
 *
 * Bugungi `queueStatusSync` buning aksi: u `commitTransaction()` DAN KEYIN,
 * `await`siz, hamma narsani yutuvchi `try/catch` ichida chaqiriladi. Deploy
 * yoki crash aynan o'sha lahzada bo'lsa — hodisa UMUMAN TUG'ILMAYDI va buni
 * hech narsa sezmaydi (bloker B3). Mavjud backfill esa faqat `SOLD` va
 * `CANCELLED` ni tiklaydi — `PAID`, `PARTLY_PAID`, `CLOSED`, rollback
 * butunlay yo'qoladi.
 */
@Injectable()
export class MarketplaceOutboxService {
  private readonly logger = new Logger(MarketplaceOutboxService.name);

  /**
   * Posilka hodisasini navbatga qo'yadi.
   *
   * @param manager CHAQIRUVCHINING tranzaksiya manageri — shart.
   */
  async enqueueParcelEvent(
    manager: EntityManager,
    input: EnqueueParcelEventInput,
  ): Promise<MarketplaceOutboxEntity> {
    const seq = await this.allocateParcelSeq(manager, input.parcel.id);
    const eventId = randomUUID();
    const occurredAt = input.occurred_at ?? Date.now();

    const payload = buildEventEnvelope({
      event_id: eventId,
      seq,
      event_type: input.event_type,
      occurred_at: occurredAt,
      integration_slug: input.integration.slug,
      parcel: {
        external_parcel_id: input.parcel.external_parcel_id,
        external_order_id: input.parcel.external_order_id,
        seller_id: input.parcel.seller_id,
        beepost_order_id: input.order?.id ?? input.parcel.order_id,
        beepost_order_number: input.order?.order_number,
      },
      status: input.status,
      money: input.money,
      ledger: input.ledger,
      actor: input.actor,
      items_delivered: input.items_delivered,
      items_returned: input.items_returned,
      note: input.note,
      reason: input.reason,
    });

    const row = manager.create(MarketplaceOutboxEntity, {
      integration_id: input.integration.id,
      event_id: eventId,
      event_type: input.event_type,
      aggregate_type: MarketplaceAggregateType.PARCEL,
      aggregate_id: input.parcel.id,
      seq,
      seller_id: input.parcel.seller_id,
      payload,
      status: MarketplaceOutboxStatus.PENDING,
      attempts: 0,
      next_retry_at: Date.now(),
    });

    const saved = await manager.save(MarketplaceOutboxEntity, row);
    this.logger.log(
      `📤 navbatga: ${input.event_type} seq=${seq} ${input.parcel.external_parcel_id}`,
    );
    return saved;
  }

  /**
   * ATOMIK `seq` ajratish.
   *
   * ⚠️ NEGA `UPDATE ... RETURNING`, `MAX(seq)+1` EMAS. `MAX+1` ikki parallel
   * enqueue'da bir xil raqam berardi va `UQ_MP_OUTBOX_SEQ` ni buzardi.
   * Unique buzilishi esa Postgres'da butun tranzaksiyani «aborted» holatiga
   * o'tkazadi — ya'ni chaqiruvchining PUL yozuvi ham yo'qolardi. Bu yerda
   * poyga umuman yuzaga kelmaydi.
   */
  private async allocateParcelSeq(
    manager: EntityManager,
    parcelId: string,
  ): Promise<number> {
    // ⚠️ `pgReturningNumber` SHART — TypeORM `UPDATE ... RETURNING` uchun
    // `[rows, count]` tuple qaytaradi va `rows[0].next_seq` `undefined`
    // bo'lardi (batafsil: `pg-returning.util.ts`).
    const raw = await manager.query(
      `UPDATE "marketplace_parcel"
          SET "next_seq" = "next_seq" + 1, "updated_at" = $2
        WHERE "id" = $1
        RETURNING "next_seq"`,
      [parcelId, Date.now()],
    );
    return pgReturningNumber(raw, 'next_seq', `seq ajratish (posilka ${parcelId})`);
  }

  /**
   * Eskirgan hodisalarni `superseded` deb belgilaydi.
   *
   * ⚠️ `failed` DAN AJRATILGAN: `failed` — «yubora olmadik, muammo bor»,
   * `superseded` — «yuborish SHART EMAS». Ikkalasini aralashtirish monitorni
   * yolg'on ogohlantirishlar bilan to'ldirardi.
   */
  async markSupersededBelowSeq(
    manager: EntityManager,
    aggregateId: string,
    seqUpTo: number,
    reason: string,
  ): Promise<number> {
    const res = await manager
      .createQueryBuilder()
      .update(MarketplaceOutboxEntity)
      .set({
        status: MarketplaceOutboxStatus.SUPERSEDED,
        status_reason: reason,
        updated_at: Date.now(),
      })
      .where('aggregate_id = :aggregateId', { aggregateId })
      .andWhere('seq <= :seq', { seq: seqUpTo })
      .andWhere('status IN (:...open)', {
        open: [MarketplaceOutboxStatus.PENDING, MarketplaceOutboxStatus.FAILED],
      })
      .execute();
    return res.affected ?? 0;
  }
}
