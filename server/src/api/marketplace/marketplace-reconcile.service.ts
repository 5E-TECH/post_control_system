import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { pgReturningNumber } from 'src/common/database/pg-returning.util';
import { In, IsNull, Not, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceSellerEntity } from 'src/core/entity/marketplace-seller.entity';
import { MarketplaceOutboxEntity } from 'src/core/entity/marketplace-outbox.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceApiService } from './marketplace-api.service';
import { MarketplaceLedgerService } from './marketplace-ledger.service';
import {
  MarketplaceAggregateType,
  MarketplaceEventType,
  MarketplaceOutboxStatus,
  MarketplaceParcelStatus,
  MarketplaceScanState,
} from './marketplace.enums';
import { buildEventEnvelope } from './utils/marketplace-event.util';

/** Bir siklda nechta posilka solishtiriladi. */
const BATCH = 100;

/**
 * Terminal holatlar — bular uchun solishtiruv KERAK EMAS.
 * ⚠️ `DELIVERED` va `CANCELLED` ham terminal, LEKIN rollback ularni
 * qaytarishi mumkin. Shu bois ular ro'yxatda YO'Q: rollback'dan keyingi
 * holat ham tekshirilishi kerak.
 */
const TERMINAL_REMOTE = new Set<string>([
  MarketplaceParcelStatus.RETURNED,
  MarketplaceParcelStatus.VOIDED,
  MarketplaceParcelStatus.REJECTED_BY_BEEPOST,
]);

/**
 * Terminal statuslarning HAMKOR tilidagi ko'rinishi + kanonik nomlar.
 *
 * Ikkalasi ham kerak: xarita sozlanmagan bo'lsa kanonik, sozlangan bo'lsa
 * ularning qiymati `remote_status` da turadi.
 */
function terminalValues(map: Record<string, string> | null): string[] {
  const out = new Set<string>(TERMINAL_REMOTE);
  for (const canonical of TERMINAL_REMOTE) {
    const theirs = map?.[canonical];
    if (theirs) out.add(String(theirs));
  }
  return [...out];
}

/**
 * SOLISHTIRUV — ikki tizim ajralib ketmasligining oxirgi himoyasi.
 *
 * ⚠️ NEGA KERAK. Kontraktda yetkazish kafolati halol yozilgan: hodisalar
 * **kamida bir marta** yuboriladi va **yo'qolishi ham mumkin**. Outbox
 * buni kamaytiradi, lekin nolga tushirmaydi:
 *
 *   · 8 urinish ~7.75 soatda tugaydi — marketplace undan uzoq o'chsa,
 *     hodisa `failed` bo'lib qoladi;
 *   · ular `200` qaytarib, ichkarida qo'llamasligi mumkin;
 *   · bizning daftarimiz kassadan ajralib qolishi mumkin (ilgak
 *     qo'yilmagan kassa nuqtasi yoki qo'lda SQL).
 *
 * Bu servis har uchala holatni ham TOPADI.
 */
@Injectable()
export class MarketplaceReconcileService {
  private readonly logger = new Logger(MarketplaceReconcileService.name);
  private running = false;

  constructor(
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    @InjectRepository(MarketplaceSellerEntity)
    private readonly sellerRepo: Repository<MarketplaceSellerEntity>,
    @InjectRepository(MarketplaceParcelEntity)
    private readonly parcelRepo: Repository<MarketplaceParcelEntity>,
    @InjectRepository(MarketplaceOutboxEntity)
    private readonly outboxRepo: Repository<MarketplaceOutboxEntity>,
    private readonly api: MarketplaceApiService,
    private readonly ledger: MarketplaceLedgerService,
  ) {}

  // ═══════════════════ POSILKA SOLISHTIRUVI ═══════════════════

  @Cron('0 */15 * * * *', { timeZone: 'Asia/Tashkent' })
  async reconcileParcelsCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const integrations = await this.integrationRepo.find({
        where: { is_active: true },
      });
      for (const integration of integrations) {
        await this.reconcileParcels(integration).catch((e) =>
          this.logger.error(
            `solishtiruv xatosi (${integration.slug}): ${e instanceof Error ? e.message : e}`,
          ),
        );
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Ochiq posilkalarni ularning holati bilan solishtiradi.
   *
   * ⚠️ `last_synced_at ASC NULLS FIRST` tartibi — hech qachon
   * solishtirilmagan posilkalar birinchi navbatda. Aks holda eski
   * posilkalar doim oxirida qolib, hech qachon tekshirilmasdi.
   */
  async reconcileParcels(integration: MarketplaceIntegrationEntity) {
    const parcels = await this.parcelRepo
      .createQueryBuilder('p')
      .where('p.integration_id = :iid', { iid: integration.id })
      .andWhere('p.scan_state = :accepted', {
        accepted: MarketplaceScanState.ACCEPTED,
      })
      /**
       * ⚠️ TERMINAL ro'yxati XARITA orqali hamkor qiymatlariga ham
       * kengaytiriladi. `remote_status` da ULARNING xom qiymati turadi
       * (`7`, `"vozvrat"`), kanonik nomlar bilan solishtirsak terminal
       * posilkalar hech qachon ro'yxatdan chiqmasdi va CRON ularni
       * abadiy so'rab turardi.
       */
      .andWhere(
        '(p.remote_status IS NULL OR p.remote_status NOT IN (:...terminal))',
        { terminal: terminalValues(integration.status_map) },
      )
      .orderBy('p.last_synced_at', 'ASC', 'NULLS FIRST')
      .take(BATCH)
      .getMany();

    if (parcels.length === 0) return { checked: 0, mismatches: 0, requeued: 0 };

    const byExternalId = new Map(parcels.map((p) => [p.external_parcel_id, p]));
    const remote = await this.api.fetchParcelStatuses(integration, {
      ids: [...byExternalId.keys()],
    });

    let mismatches = 0;
    let requeued = 0;
    const now = Date.now();
    const seen = new Set<string>();

    for (const item of remote.items ?? []) {
      const parcel = byExternalId.get(item.external_parcel_id);
      if (!parcel) continue;
      seen.add(item.external_parcel_id);

      const problems: string[] = [];

      // ── 1. SEQ UZILISHI — eng muhim tekshiruv ──
      // Ular bizdan orqada qolgan bo'lsa, hodisalar yetib bormagan.
      const theirSeq = Number(item.last_applied_seq ?? 0);
      const ourSeq = Number(parcel.last_sent_seq);
      if (theirSeq < ourSeq) {
        problems.push(`seq orqada: ularda ${theirSeq}, bizda ${ourSeq}`);
        requeued += await this.requeueMissingEvents(parcel.id, theirSeq);
      }

      // ── 2. STATUS MOS KELMASLIGI ──
      if (
        parcel.remote_status &&
        item.status &&
        item.status !== parcel.remote_status
      ) {
        problems.push(
          `status farq: ularda «${item.status}», bizda «${parcel.remote_status}»`,
        );
      }

      if (problems.length > 0) {
        mismatches++;
        parcel.mismatch_at = now;
        parcel.mismatch_reason = problems.join(' · ');
        this.logger.warn(
          `⚠️ nomuvofiqlik ${parcel.external_parcel_id}: ${parcel.mismatch_reason}`,
        );
      } else if (parcel.mismatch_at) {
        // O'z-o'zidan tuzalgan — belgini olib tashlaymiz.
        parcel.mismatch_at = null;
        parcel.mismatch_reason = null;
      }

      /**
       * ⚠️ NISHONLI `update`, `save(parcel)` EMAS.
       *
       * `parcel` obyekti HTTP so'rovidan OLDIN yuklangan (15 soniyagacha
       * oldin). TypeORM `save()` butun qatorni diff qilib yozadi — ya'ni
       * shu oynada kuryer sotgan bo'lsa, `next_seq` va `last_sent_seq`
       * ESKI qiymatga QAYTARILADI. Oqibati og'ir:
       *   · keyingi hodisa allaqachon band `seq` ni oladi →
       *     `UQ_MP_OUTBOX_SEQ` buziladi → Postgres tranzaksiyani abort
       *     qiladi → KURYERNING SOTUVI kassa yozuvi bilan birga yiqiladi;
       *   · `last_sent_seq` orqaga surilsa worker'ning eskirgan-hodisa
       *     qo'riqchisi teshiladi.
       *
       * Solishtiruv FAQAT o'z uch ustunini yozishi kerak.
       */
      await this.parcelRepo.update(
        { id: parcel.id },
        {
          mismatch_at: parcel.mismatch_at,
          mismatch_reason: parcel.mismatch_reason,
          last_synced_at: now,
          updated_at: Date.now(),
        },
      );
    }

    // ── 3. ULARDA UMUMAN YO'Q POSILKALAR ──
    // Biz qabul qilganmiz, ular bilmaydi — qabul hodisasi yetib bormagan
    // yoki ular yozuvni yo'qotgan.
    for (const [extId, parcel] of byExternalId) {
      if (seen.has(extId)) continue;
      mismatches++;
      // ⚠️ Yuqoridagi bilan bir xil sabab — nishonli `update`.
      await this.parcelRepo.update(
        { id: parcel.id },
        {
          mismatch_at: now,
          mismatch_reason: "Marketplace javobida bu posilka YO'Q",
          last_synced_at: now,
          updated_at: Date.now(),
        },
      );
      requeued += await this.requeueMissingEvents(parcel.id, 0);
      this.logger.warn(`⚠️ ularda topilmadi: ${extId}`);
    }

    if (mismatches > 0 || requeued > 0) {
      this.logger.log(
        `🔍 ${integration.slug}: ${parcels.length} tekshirildi, ` +
          `${mismatches} nomuvofiqlik, ${requeued} hodisa qayta navbatga qo'yildi`,
      );
    }
    return { checked: parcels.length, mismatches, requeued };
  }

  /**
   * Yetib bormagan hodisalarni QAYTA NAVBATGA qo'yadi.
   *
   * ⚠️ Xavfsiz: hodisalar `event_id` bo'yicha idempotent, ya'ni ular
   * allaqachon qo'llagan bo'lsa `applied: false` qaytaradi. Qayta
   * yuborish zarar keltirmaydi, yubormaslik esa jimgina desinxronizatsiya.
   *
   * ⚠️ `superseded` qatorlar TEGILMAYDI — ular ataylab yuborilmagan.
   */
  private async requeueMissingEvents(
    parcelId: string,
    fromSeq: number,
  ): Promise<number> {
    /**
     * ⚠️ AVVAL `last_sent_seq` NI TUSHIRAMIZ — busiz butun tiklash yo'li
     * O'LIK edi.
     *
     * Worker'da seq qo'riqchisi bor: `job.seq <= parcel.last_sent_seq`
     * bo'lsa hodisa `superseded` deb belgilanadi. Qayta navbatga
     * qo'yilayotgan hodisalarning seq'i aynan shu chegaradan PAST —
     * ya'ni ular navbatga qaytgan zahoti «eskirgan» deb tashlanardi va
     * marketplace yo'qotgan hodisalarni HECH QACHON olmasdi.
     *
     * Bu yerda belgi HAQIQATGA keltiriladi: ular faqat `fromSeq` gacha
     * qo'llagan, demak bizning «yuborilgan» chegaramiz ham shu.
     * `LEAST` — faqat TUSHIRAMIZ, hech qachon ko'tarmaymiz.
     */
    await this.parcelRepo.query(
      `UPDATE "marketplace_parcel"
          SET "last_sent_seq" = LEAST("last_sent_seq", $2), "updated_at" = $3
        WHERE "id" = $1`,
      [parcelId, Math.max(0, Math.trunc(fromSeq)), Date.now()],
    );

    const res = await this.outboxRepo
      .createQueryBuilder()
      .update(MarketplaceOutboxEntity)
      .set({
        status: MarketplaceOutboxStatus.PENDING,
        attempts: 0,
        next_retry_at: Date.now(),
        status_reason: 'Solishtiruv: marketplace bu hodisani qo\'llamagan',
        updated_at: Date.now(),
      })
      .where('aggregate_type = :t', { t: MarketplaceAggregateType.PARCEL })
      .andWhere('aggregate_id = :id', { id: parcelId })
      .andWhere('seq > :seq', { seq: fromSeq })
      .andWhere('status IN (:...st)', {
        st: [MarketplaceOutboxStatus.SENT, MarketplaceOutboxStatus.FAILED],
      })
      .execute();
    return res.affected ?? 0;
  }

  // ═══════════════════ DAFTAR SOLISHTIRUVI ═══════════════════

  @Cron('0 30 3 * * *', { timeZone: 'Asia/Tashkent' })
  async reconcileLedgerCron(): Promise<void> {
    const integrations = await this.integrationRepo.find({
      where: { is_active: true },
    });
    for (const integration of integrations) {
      await this.reconcileLedger(integration).catch((e) =>
        this.logger.error(
          `daftar solishtiruvi xatosi (${integration.slug}): ${e instanceof Error ? e.message : e}`,
        ),
      );
    }
  }

  /**
   * Kunlik daftar tekshiruvi — UCH qatlam.
   *
   *   1. ICHKI invariant: `SUM(daftar) == market kassasi balansi`.
   *      Buzilsa — daftar yozuvi tushib qolgan (ilgak qo'yilmagan kassa
   *      nuqtasi) yoki kassa daftarsiz o'zgartirilgan (qo'lda SQL).
   *   2. TASHQI solishtiruv: ularning balansi bizникiga teng emasmi.
   *   3. `ledger.snapshot` hodisasi — ular o'zini tekshirib olsin.
   */
  async reconcileLedger(integration: MarketplaceIntegrationEntity) {
    const invariant = await this.ledger.verifyInvariant(integration.id);
    if (!invariant.ok) {
      // ⚠️ Bu JIDDIY: daftar va kassa ajralgan. Avtomatik tuzatilmaydi —
      // qaysi tomoni to'g'ri ekanini faqat odam aniqlay oladi.
      this.logger.error(
        `🔴 ${integration.slug}: DAFTAR INVARIANTI BUZILGAN — ` +
          `daftar ${invariant.ledger_sum}, kassa ${invariant.cashbox_balance}, ` +
          `farq ${invariant.diff}`,
      );
    }

    const sellers = await this.ledger.balancesBySeller(integration.id);

    let remoteBalance: number | null = null;
    let remoteDiff: number | null = null;
    try {
      const remote = await this.api.fetchLedgerBalance(integration);
      remoteBalance = Number(remote.total_receivable ?? 0);
      remoteDiff = invariant.cashbox_balance - remoteBalance;
      if (remoteDiff !== 0) {
        this.logger.warn(
          `⚠️ ${integration.slug}: daftar farqi — bizda ${invariant.cashbox_balance}, ` +
            `ularda ${remoteBalance} (farq ${remoteDiff})`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `${integration.slug}: ularning balansi olinmadi — ${e instanceof Error ? e.message : e}`,
      );
    }

    await this.emitSnapshot(integration, invariant.cashbox_balance, sellers);
    await this.integrationRepo.update(
      { id: integration.id },
      { last_reconcile_at: Date.now(), updated_at: Date.now() },
    );

    return { invariant, remote_balance: remoteBalance, diff: remoteDiff, sellers };
  }

  /**
   * `ledger.snapshot` — kunlik to'liq holat.
   *
   * ⚠️ Bu uchinchi himoya qatlami: `balance_after` bitta yo'qolgan hodisani
   * tuzatadi, `seq` uzilishi qaysi biri yo'qolganini aytadi, snapshot esa
   * ikkalasi ham yiqilgan holatni ushlaydi.
   */
  private async emitSnapshot(
    integration: MarketplaceIntegrationEntity,
    balance: number,
    sellers: Array<{ seller_id: string | null; balance: number }>,
  ): Promise<void> {
    // ⚠️ `pgReturningNumber` SHART — TypeORM `UPDATE ... RETURNING` uchun
    // `[rows, count]` tuple qaytaradi (batafsil: `pg-returning.util.ts`).
    const raw = await this.integrationRepo.query(
      `UPDATE "marketplace_integration"
          SET "next_ledger_seq" = "next_ledger_seq" + 1, "updated_at" = $2
        WHERE "id" = $1
        RETURNING "next_ledger_seq"`,
      [integration.id, Date.now()],
    );
    const seq = pgReturningNumber(
      raw,
      'next_ledger_seq',
      `snapshot seq (${integration.slug})`,
    );
    const eventId = randomUUID();

    const payload = buildEventEnvelope({
      event_id: eventId,
      seq,
      event_type: MarketplaceEventType.LEDGER_SNAPSHOT,
      occurred_at: Date.now(),
      integration_slug: integration.slug,
      parcel: { external_parcel_id: '', external_order_id: '', seller_id: null },
    });
    delete (payload as Record<string, unknown>).parcel;
    (payload as Record<string, unknown>).snapshot = {
      currency: 'UZS',
      balance,
      sellers: sellers
        .filter((s) => s.seller_id)
        .map((s) => ({ seller_id: s.seller_id, balance: s.balance })),
    };

    await this.outboxRepo.save(
      this.outboxRepo.create({
        integration_id: integration.id,
        event_id: eventId,
        event_type: MarketplaceEventType.LEDGER_SNAPSHOT,
        aggregate_type: MarketplaceAggregateType.LEDGER,
        aggregate_id: integration.id,
        seq,
        payload,
        attempts: 0,
        next_retry_at: Date.now(),
      }),
    );
  }

  // ═══════════════════ PANEL UCHUN ═══════════════════

  /** Nomuvofiqlik kartasi — admin panelida ko'rinadi. */
  async listMismatches(integrationId: string, limit = 50) {
    return this.parcelRepo.find({
      where: { integration_id: integrationId, mismatch_at: Not(IsNull()) },
      order: { mismatch_at: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  // ═══════════════════ SOTUVCHILAR REESTRI ═══════════════════

  /**
   * SOTUVCHILARNI KUNLIK KO'ZGU QILISH.
   *
   * ⚠️ Nega kerak. Reestr hozircha faqat SKAN paytida to'ldiriladi va
   * o'shanda ham posilkadagi nom bilan. Natijada hisob-kitob ekranida
   * sotuvchi faqat `SLR-77` bo'lib ko'rinadi — admin kimga to'layotganini
   * bilmaydi. Nomi o'zgargan yoki yopilgan sotuvchi ham eskirgan holda
   * qolaveradi.
   *
   * Kuniga bir marta — hamkorning API'siga yuk bermaydi.
   */
  @Cron('0 0 4 * * *', { timeZone: 'Asia/Tashkent' })
  async syncSellersCron(): Promise<void> {
    const integrations = await this.integrationRepo.find({
      where: { is_active: true },
    });
    for (const integration of integrations) {
      await this.syncSellers(integration).catch((e) =>
        this.logger.error(
          `sotuvchilar sinxroni yiqildi (${integration.slug}): ${e instanceof Error ? e.message : e}`,
        ),
      );
    }
  }

  /**
   * REESTRNI AVTOMATIK YANGILASH — skan yo'lidan chaqiriladi.
   *
   * ⚠️ Nega kerak: sotuvchi reestri kechasi 04:00 da yangilanardi. Yangi
   * sotuvchi kun davomida paydo bo'lsa, ertaga tonggacha uning HAR
   * posilkasi «Sotuvchi reestrda yo'q» bilan belgilanardi. Kuniga 1000
   * posilkada buni qo'lda tuzatib bo'lmaydi.
   *
   * ⚠️ Kontraktda (§4.6) bitta sotuvchini so'rash YO'Q — faqat to'liq
   * reestr. Shuning uchun:
   *   · BIRLASHTIRILGAN (single-flight): 50 ta skan bir vaqtda noma'lum
   *     sotuvchi ko'rsa ham reestr BIR MARTA tortiladi;
   *   · DEBOUNCE: bir integratsiya uchun `SELLER_REFRESH_MS` da bir marta
   *     — ularning reestrida haqiqatan yo'q sotuvchi har skanda
   *     so'rov yubormaydi;
   *   · VAQT CHEGARASI: skan reestrni kutib QOTIB QOLMAYDI. Ulgurmasa
   *     ogohlantirish chiqadi, yangilash fonda tugaydi va keyingi skan toza.
   */
  private static readonly SELLER_REFRESH_MS = 60_000;
  private readonly sellerRefresh = new Map<
    string,
    { at: number; inflight: Promise<unknown> | null }
  >();

  async refreshSellersIfStale(
    integration: MarketplaceIntegrationEntity,
    waitMs = 3_000,
  ): Promise<void> {
    const key = integration.id;
    const now = Date.now();
    let st = this.sellerRefresh.get(key);
    if (!st) {
      st = { at: 0, inflight: null };
      this.sellerRefresh.set(key, st);
    }

    if (!st.inflight) {
      if (now - st.at < MarketplaceReconcileService.SELLER_REFRESH_MS) return;
      st.at = now;
      st.inflight = this.syncSellers(integration)
        .catch((e) => {
          // Reestr yangilanmasa skan TO'XTAMAYDI — ogohlantirish qoladi.
          this.logger.warn(
            `Sotuvchi reestrini yangilab bo'lmadi (${integration.slug}): ${
              (e as Error)?.message ?? e
            }`,
          );
        })
        .finally(() => {
          const cur = this.sellerRefresh.get(key);
          if (cur) cur.inflight = null;
        });
    }

    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      st.inflight,
      new Promise<void>((res) => {
        timer = setTimeout(res, waitMs);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  async syncSellers(integration: MarketplaceIntegrationEntity) {
    let cursor: string | null | undefined;
    let total = 0;
    let pages = 0;

    do {
      const res = await this.api.fetchSellers(integration, {
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      const items = res?.items ?? [];

      for (const it of items) {
        const externalId = String(it?.seller_id ?? '').trim();
        if (!externalId) continue;

        /**
         * ⚠️ `upsert` EMAS, nishonli `update` + zaxira `insert`.
         * Skan paytida yaratilgan qator `is_unknown: true` bilan turadi —
         * reestrdan kelgan yozuv uni TASDIQLAYDI.
         */
        const patch = {
          name: it?.name ?? null,
          phone: it?.phone ?? null,
          is_active: it?.is_active !== false,
          is_unknown: false,
          synced_at: Date.now(),
          updated_at: Date.now(),
        };
        const res2 = await this.sellerRepo.update(
          { integration_id: integration.id, external_seller_id: externalId },
          patch,
        );
        if (!res2.affected) {
          await this.sellerRepo
            .save(
              this.sellerRepo.create({
                integration_id: integration.id,
                external_seller_id: externalId,
                ...patch,
              }),
            )
            // Poygada ikkinchi INSERT — muhim emas.
            .catch(() => undefined);
        }
        total++;
      }

      cursor = res?.next_cursor ?? null;
      pages++;
      // Cheksiz sahifalashdan himoya (ularning `next_cursor` i qotib qolsa).
    } while (cursor && pages < 50);

    this.logger.log(`👥 ${integration.slug}: ${total} sotuvchi ko'zgu qilindi`);
    return { synced: total, pages };
  }

  /** Operator nomuvofiqlikni hal qildi — belgini olib tashlash. */
  async clearMismatch(parcelId: string, integrationId?: string) {
    const res = await this.parcelRepo.update(
      // ⚠️ `integration_id` shartga KIRADI: boshqa ulanishning posilkasini
      // tozalab bo'lmaydi.
      integrationId ? { id: parcelId, integration_id: integrationId } : { id: parcelId },
      { mismatch_at: null, mismatch_reason: null, updated_at: Date.now() },
    );
    if (!res.affected) {
      throw new NotFoundException('Posilka topilmadi yoki bu ulanishga tegishli emas');
    }
    return { ok: true };
  }
}
