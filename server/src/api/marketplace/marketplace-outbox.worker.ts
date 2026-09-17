import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceOutboxEntity } from 'src/core/entity/marketplace-outbox.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceApiService } from './marketplace-api.service';
import {
  MarketplaceAggregateType,
  MarketplaceOutboxStatus,
} from './marketplace.enums';
import { nextRetryDelayMs } from './utils/marketplace-event.util';
import { classifyMarketplaceError } from './utils/marketplace-error.util';

/** Bir siklda nechta hodisa yuboriladi. */
const BATCH_SIZE = 25;
/** `processing` da shuncha turgan qator qotib qolgan deb hisoblanadi. */
const STALE_MS = 5 * 60_000;
/** HA uchun maslahatli qulf kaliti (ixtiyoriy raqam, faqat shu worker uchun). */
const ADVISORY_LOCK_KEY = 874_412_001;

/**
 * OUTBOX WORKER — navbatdagi hodisalarni marketplace'ga yuboradi.
 *
 * Mavjud `integration-sync` worker'idan TO'RT farq:
 *
 *   1. **HA qulfi.** Mavjud worker faqat jarayon ichidagi `isProcessing`
 *      boolean bilan himoyalangan — ikki instans bir vaqtda ishlasa ikkalasi
 *      ham yuboradi. Bu yerda `pg_try_advisory_lock`.
 *
 *   2. **Posilka bo'yicha serializatsiya.** Bir posilka uchun bir vaqtda
 *      BITTA hodisa yo'lda bo'ladi. Aks holda `sold` 502 olib kutayotganda
 *      `rollback` o'tib ketadi, keyin eskirgan `sold` yetib boradi va
 *      marketplace NOTO'G'RI terminal holatda qoladi (reja §6.2).
 *
 *   3. **`seq` qo'riqchisi.** `parcel.last_sent_seq` dan past hodisa
 *      YUBORILMAYDI — `superseded` bo'ladi.
 *
 *   4. **4xx qayta urinilmaydi.** Mavjud worker HAR qanday muvaffaqiyatsiz
 *      javobni qayta uradi, shu jumladan 400/422 ni — ular hech qachon
 *      o'zgarmaydi va urinishlar behuda sarflanadi.
 */
@Injectable()
export class MarketplaceOutboxWorker {
  private readonly logger = new Logger(MarketplaceOutboxWorker.name);
  private running = false;

  constructor(
    @InjectRepository(MarketplaceOutboxEntity)
    private readonly outboxRepo: Repository<MarketplaceOutboxEntity>,
    @InjectRepository(MarketplaceParcelEntity)
    private readonly parcelRepo: Repository<MarketplaceParcelEntity>,
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    private readonly dataSource: DataSource,
    private readonly api: MarketplaceApiService,
  ) {}

  @Cron('*/30 * * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reclaimStale();
      await this.processBatch();
    } catch (e) {
      this.logger.error(`outbox sikli xatosi: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Crash'dan keyin `processing` da qotib qolgan qatorlarni tiklaydi.
   * Ularsiz hodisa abadiy osilib qolardi va hech kim sezmasdi.
   */
  private async reclaimStale(): Promise<void> {
    const res = await this.outboxRepo
      .createQueryBuilder()
      .update(MarketplaceOutboxEntity)
      .set({
        status: MarketplaceOutboxStatus.PENDING,
        processing_started_at: null,
        updated_at: Date.now(),
      })
      .where('status = :st', { st: MarketplaceOutboxStatus.PROCESSING })
      .andWhere('processing_started_at < :cut', { cut: Date.now() - STALE_MS })
      .execute();
    if (res.affected) {
      this.logger.warn(`♻️ ${res.affected} ta qotib qolgan hodisa tiklandi`);
    }
  }

  private async processBatch(): Promise<void> {
    const jobs = await this.claim();
    if (jobs.length === 0) return;

    /**
     * ⚠️ BIR POSILKANING hodisasi yiqilsa, SHU SIKLDA keyingilarini
     * umuman urinib ko'rmaymiz.
     *
     * Aks holda: `seq 5` tarmoq xatosi bilan yiqiladi, `seq 6` o'tib
     * ketadi va `last_sent_seq` 6 bo'ladi — keyingi urinishda `seq 5`
     * «eskirgan» deb ABADIY tashlanadi. Agar 5 da PUL hodisasi bo'lsa
     * (yetkazildi + summa), 6 esa faqat status bo'lsa — hamkor pulni
     * HECH QACHON ko'rmaydi va daftar abadiy ajraladi.
     *
     * Bloklangan hodisa `pending` ga qaytariladi: keyingi sikl uni
     * TARTIB BILAN qaytadan oladi.
     */
    const blocked = new Set<string>();

    for (const job of jobs) {
      const key = `${job.aggregate_type}:${job.aggregate_id}`;
      if (blocked.has(key)) {
        await this.finish(job, MarketplaceOutboxStatus.PENDING, {
          nextRetryAt: Date.now(),
          reason: 'Oldingi hodisa yiqildi — tartib saqlanmoqda',
        });
        continue;
      }

      const ok = await this.deliver(job).catch((e) => {
        this.logger.error(
          `hodisa yuborishda kutilmagan xato (${job.event_id}): ${e instanceof Error ? e.message : e}`,
        );
        return false;
      });
      if (!ok) blocked.add(key);
    }
  }

  /**
   * Yuborishga tayyor hodisalarni ATOMIK olib, `processing` ga o'tkazadi.
   *
   * ⚠️ `NOT EXISTS` sharti — posilka bo'yicha serializatsiya: agar shu
   * posilkaning boshqa hodisasi allaqachon yo'lda bo'lsa, bu sikl uni
   * olmaydi. Tartib kafolatining asosi shu.
   */
  private async claim(): Promise<MarketplaceOutboxEntity[]> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [{ locked }] = await qr.query(
        `SELECT pg_try_advisory_xact_lock($1) AS locked`,
        [ADVISORY_LOCK_KEY],
      );
      if (!locked) {
        await qr.rollbackTransaction();
        return [];
      }

      const now = Date.now();
      const rows: MarketplaceOutboxEntity[] = await qr.query(
        `SELECT o.* FROM "marketplace_outbox" o
          WHERE o."status" IN ('pending','failed')
            AND (o."next_retry_at" IS NULL OR o."next_retry_at" <= $1)
            AND o."attempts" < o."max_attempts"
            AND NOT EXISTS (
              SELECT 1 FROM "marketplace_outbox" x
               WHERE x."aggregate_type" = o."aggregate_type"
                 AND x."aggregate_id"   = o."aggregate_id"
                 AND x."status" = 'processing'
            )
          ORDER BY o."aggregate_id", o."seq" ASC
          LIMIT $2
          FOR UPDATE OF o SKIP LOCKED`,
        [now, BATCH_SIZE],
      );

      if (rows.length > 0) {
        await qr.query(
          `UPDATE "marketplace_outbox"
              SET "status" = 'processing', "processing_started_at" = $2, "updated_at" = $2
            WHERE "id" = ANY($1::uuid[])`,
          [rows.map((r) => r.id), now],
        );
      }
      await qr.commitTransaction();
      return rows;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** `true` — yakuniy holat (yuborildi/o'tkazildi); `false` — qayta urinish kerak. */
  private async deliver(job: MarketplaceOutboxEntity): Promise<boolean> {
    const integration = await this.integrationRepo.findOne({
      where: { id: job.integration_id },
    });

    // ── KILL-SWITCH ────────────────────────────────────────────────────
    // ⚠️ Mavjud kill-switch'lar faqat YANGI hodisani to'sadi, navbatdagilar
    // baribir ketaveradi (reja §12). Bu yerda navbat ham to'xtaydi.
    if (!integration || !integration.is_active) {
      await this.finish(job, MarketplaceOutboxStatus.SKIPPED, {
        reason: "Ulanish o'chirilgan — hodisa yuborilmadi",
      });
      return true;
    }

    // ── SEQ QO'RIQCHISI ────────────────────────────────────────────────
    if (job.aggregate_type === MarketplaceAggregateType.PARCEL) {
      const parcel = await this.parcelRepo.findOne({ where: { id: job.aggregate_id } });
      if (parcel && Number(job.seq) <= Number(parcel.last_sent_seq)) {
        // Yangiroq hodisa allaqachon yetib borgan — bu eskirgan.
        await this.finish(job, MarketplaceOutboxStatus.SUPERSEDED, {
          reason: `Eskirgan: seq ${job.seq} <= yuborilgan ${parcel.last_sent_seq}`,
        });
        return true;
      }
    }

    const envelope = { ...(job.payload as Record<string, unknown>), sent_at: Date.now() };

    try {
      const res = await this.api.sendEvent(integration, envelope);

      // Ular `applied: false` qaytarsa ham bu MUVAFFAQIYAT: dublikat yoki
      // eskirgan seq — ikkalasi ham to'g'ri xulq (kontrakt §4.4).
      await this.finish(job, MarketplaceOutboxStatus.SENT, {
        httpStatus: res.http_status,
        response: res as unknown as Record<string, unknown>,
        reason: res.applied === false ? `Qo'llanmadi: ${res.reason ?? '—'}` : null,
      });

      if (job.aggregate_type === MarketplaceAggregateType.PARCEL) {
        /**
         * ⚠️ `remote_status` HAM yangilanadi — bu maydon «biz ularning
         * statusi nima deb bilamiz» degan NUSXA.
         *
         * Avval u faqat SKAN paytida yozilardi va keyin hech qachon
         * o'zgarmasdi. Natijada 15-daqiqalik solishtiruv ularning jonli
         * statusini («DELIVERED») bizning eskirgan nusxa bilan
         * («READY_FOR_PICKUP») taqqoslab, HAR BIR yetkazilgan posilkani
         * nomuvofiq deb belgilardi. Panel soxta ogohlantirishga to'lib,
         * HAQIQIY nomuvofiqlik ular orasida ko'rinmay ketardi —
         * monitoringning ma'nosi yo'qolardi.
         *
         * Statusni ular TASDIQLAGANDAN keyin yozamiz (bu shox faqat
         * muvaffaqiyatli javobdan keyin ishlaydi).
         *
         * ⚠️ Faqat OSHIRAMIZ — parallel yetkazishda kichikroq seq katta
         * raqamni orqaga surib yubormasin. `CASE` ESKI `last_sent_seq` ni
         * ko'radi (Postgres barcha `SET` ifodalarini eski qatordan hisoblaydi).
         */
        const payload = job.payload as { status?: { to?: string } };
        const nextStatus = payload?.status?.to ?? null;
        await this.parcelRepo.query(
          `UPDATE "marketplace_parcel"
              SET "last_sent_seq" = GREATEST("last_sent_seq", $2),
                  "last_synced_at" = $3,
                  "updated_at" = $3,
                  "remote_status" = CASE
                    WHEN $4::varchar IS NOT NULL AND $2 >= "last_sent_seq"
                      THEN $4::varchar ELSE "remote_status" END,
                  "remote_status_at" = CASE
                    WHEN $4::varchar IS NOT NULL AND $2 >= "last_sent_seq"
                      THEN $3 ELSE "remote_status_at" END
            WHERE "id" = $1`,
          [job.aggregate_id, Number(job.seq), Date.now(), nextStatus],
        );
      }
      return true;
    } catch (err) {
      const info = classifyMarketplaceError(err);
      const attempts = job.attempts + 1;

      // ⚠️ 4xx HECH QACHON o'zgarmaydi — qayta urinish behuda va urinish
      // byudjetini yeydi. Mavjud worker bu farqni ko'rmaydi.
      const retryable = info.retryable && attempts < job.max_attempts;

      // ⚠️ Bu yerda avval `retryable ? FAILED : FAILED` turardi — ikkala
      // shox ham bir xil. Natijada qayta urinilmaydigan hodisa `failed`
      // bo'lib, `next_retry_at = null` bilan qolardi; `claim()` esa
      // `next_retry_at IS NULL` ni «HOZIR tayyor» deb tushunadi va uni
      // har 30 soniyada qayta olardi.
      await this.finish(
        job,
        retryable
          ? MarketplaceOutboxStatus.FAILED
          : MarketplaceOutboxStatus.DROPPED,
        {
          attempts,
          httpStatus: info.httpStatus,
          error: info.message,
          /**
           * ⚠️ `Retry-After` USTUN. 429 da hamkor AYNAN qancha kutishni
           * aytadi — uni e'tiborsiz qoldirib o'z backoff'imiz bilan
           * yursak, limitni qayta-qayta urib urinish byudjetini yeymiz
           * va ular bizni butunlay bloklashi mumkin.
           */
          nextRetryAt: retryable
            ? Date.now() + (info.retryAfterMs ?? nextRetryDelayMs(attempts))
            : null,
          reason: retryable ? null : `Qayta urinilmaydi (${info.kind})`,
        },
      );

      if (!retryable) {
        this.logger.error(
          `☠️ hodisa tashlandi: ${job.event_type} ${job.event_id} — ${info.kind}: ${info.message}`,
        );
      }
      /**
       * ⚠️ Qayta urinilmaydigan (`dropped`) hodisa ham `false` qaytaradi:
       * u yetib BORMADI, demak shu posilkaning keyingi hodisalari uni
       * «eskirgan» qilib qo'ymasligi kerak. Odam aralashib hal qiladi.
       */
      return false;
    }
  }

  private async finish(
    job: MarketplaceOutboxEntity,
    status: MarketplaceOutboxStatus,
    extra: {
      attempts?: number;
      httpStatus?: number | null;
      error?: string | null;
      response?: Record<string, unknown> | null;
      nextRetryAt?: number | null;
      reason?: string | null;
    },
  ): Promise<void> {
    await this.outboxRepo.update(
      { id: job.id },
      {
        status,
        attempts: extra.attempts ?? job.attempts,
        last_http_status: extra.httpStatus ?? null,
        last_error: extra.error ?? null,
        last_response: (extra.response ?? null) as never,
        next_retry_at: extra.nextRetryAt ?? null,
        status_reason: extra.reason ?? null,
        processing_started_at: null,
        sent_at: status === MarketplaceOutboxStatus.SENT ? Date.now() : null,
        updated_at: Date.now(),
      },
    );
  }
}
