import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { pgReturningNumber } from 'src/common/database/pg-returning.util';
import { EntityManager, Repository } from 'typeorm';
import { Cashbox_type } from 'src/common/enums';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceLedgerEntryEntity } from 'src/core/entity/marketplace-ledger-entry.entity';
import { MarketplaceLedgerEntryType } from './marketplace.enums';

export interface AppendEntryInput {
  integration_id: string;
  entry_type: MarketplaceLedgerEntryType;
  /** ISHORALI summa. MANFIY bo'lishi mumkin (prepaid, bekor, korreksiya). */
  amount: number;
  seller_id?: string | null;
  order_id?: string | null;
  external_parcel_id?: string | null;
  /**
   * Bog'langan kassa yozuvi — IDEMPOTENTLIK LANGARI.
   * Bo'lsa: ayni yozuv ikkinchi marta daftar qatori YARATMAYDI.
   */
  cashbox_history_id?: string | null;
  /** Teskari yozuv aynan qaysi qatorni qaytargani (rollback, korreksiya). */
  reverses_entry_id?: string | null;
  tariff_version?: number | null;
  note?: string | null;
}

/**
 * HAR-SOTUVCHI YORDAMCHI DAFTAR (qaror P1).
 *
 * Siz «bitta market ochib biriktiramiz» dedingiz — shunday qilingan. Lekin
 * bitta market = `cash_box.balance` = BITTA SON. 40 sotuvchi savdo qilgandan
 * keyin u bitta butun son bo'lib turadi va uni bo'lib bo'lmaydi.
 *
 * Bu servis o'sha sonni sotuvchilar bo'yicha AJRATADI — kassani ikkiga
 * bo'lmasdan.
 *
 * ⚠️ MUHIM ANIQLIK. Daftar BIZNING tarifimiz bo'yicha attributsiya qiladi
 * (`COD − beepost_fee`), marketplace'ning sotuvchiga to'lovini EMAS.
 * Ikkalasi HECH QACHON teng bo'lmaydi va bu TO'G'RI — farq ularning
 * marjasi (reja §7.1).
 *
 * ⚠️ INVARIANT: `SUM(amount) WHERE integration_id = X` ==
 * o'sha marketplace marketining `cash_box.balance`.
 * Bu PCS'da allaqachon isbotlangan naqsh: asosiy kassada
 * `SUM(cashbox_card) == balance_card`.
 */
@Injectable()
export class MarketplaceLedgerService {
  private readonly logger = new Logger(MarketplaceLedgerService.name);

  constructor(
    @InjectRepository(MarketplaceLedgerEntryEntity)
    private readonly ledgerRepo: Repository<MarketplaceLedgerEntryEntity>,
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    @InjectRepository(CashEntity)
    private readonly cashRepo: Repository<CashEntity>,
  ) {}

  /**
   * Daftarga yozuv qo'shadi. CHAQIRUVCHINING tranzaksiya manageri bilan —
   * ya'ni kassa yozuvi bilan BITTA tranzaksiyada.
   */
  async appendEntry(
    manager: EntityManager,
    input: AppendEntryInput,
  ): Promise<MarketplaceLedgerEntryEntity> {
    // ── 1. IDEMPOTENTLIK ─────────────────────────────────────────────
    // ⚠️ Avval TEKSHIRAMIZ, keyin yozamiz. Unique cheklovga tayanib
    // «INSERT va xatoni ushlash» MUMKIN EMAS: Postgres'da unique buzilishi
    // butun tranzaksiyani «aborted» holatiga o'tkazadi va chaqiruvchining
    // KASSA yozuvi ham yo'qolardi.
    if (input.cashbox_history_id) {
      const existing = await manager.findOne(MarketplaceLedgerEntryEntity, {
        where: { cashbox_history_id: input.cashbox_history_id },
      });
      if (existing) {
        this.logger.debug(
          `daftar: takroriy chaqiruv o'tkazib yuborildi (${input.cashbox_history_id})`,
        );
        return existing;
      }
    }

    // ── 2. SEQ + QULF ────────────────────────────────────────────────
    // Bu `UPDATE` integratsiya qatoriga qulf qo'yadi va tranzaksiya
    // oxirigacha ushlab turadi. Shu sabab quyidagi «oldingi balans»
    // hisobi POYGASIZ: ikki parallel sotuv bir xil qiymatni o'qiy olmaydi.
    const seq = await this.allocateSeq(manager, input.integration_id);

    // ── 3. UMUMIY BALANS — DB TASDIQLAGAN qiymat ─────────────────────
    const balanceAfter = await this.resolveBalanceAfter(
      manager,
      input.integration_id,
      input.cashbox_history_id ?? null,
      Math.trunc(input.amount),
    );

    // ── 4. SOTUVCHI JAMLANMASI ───────────────────────────────────────
    const prevSeller = await this.lastSellerBalance(
      manager,
      input.integration_id,
      input.seller_id ?? null,
    );
    const amount = Math.trunc(input.amount);

    const row = manager.create(MarketplaceLedgerEntryEntity, {
      integration_id: input.integration_id,
      seller_id: input.seller_id ?? null,
      order_id: input.order_id ?? null,
      external_parcel_id: input.external_parcel_id ?? null,
      cashbox_history_id: input.cashbox_history_id ?? null,
      entry_type: input.entry_type,
      amount,
      balance_after: balanceAfter,
      seller_balance_after: prevSeller + amount,
      seq,
      reverses_entry_id: input.reverses_entry_id ?? null,
      tariff_version: input.tariff_version ?? null,
      note: input.note ?? null,
    });

    const saved = await manager.save(MarketplaceLedgerEntryEntity, row);
    this.logger.log(
      `📒 daftar seq=${seq} ${input.entry_type} ${amount > 0 ? '+' : ''}${amount} ` +
        `sotuvchi=${input.seller_id ?? '—'} balans=${balanceAfter}`,
    );
    return saved;
  }

  /** ATOMIK `seq` ajratish + integratsiya qatorini qulflash. */
  private async allocateSeq(
    manager: EntityManager,
    integrationId: string,
  ): Promise<number> {
    // ⚠️ `pgReturningNumber` SHART — TypeORM `UPDATE ... RETURNING` uchun
    // `[rows, count]` tuple qaytaradi (batafsil: `pg-returning.util.ts`).
    const raw = await manager.query(
      `UPDATE "marketplace_integration"
          SET "next_ledger_seq" = "next_ledger_seq" + 1, "updated_at" = $2
        WHERE "id" = $1
        RETURNING "next_ledger_seq"`,
      [integrationId, Date.now()],
    );
    return pgReturningNumber(
      raw,
      'next_ledger_seq',
      `daftar seq (integratsiya ${integrationId})`,
    );
  }

  /**
   * Yozuvdan keyingi UMUMIY balans.
   *
   * ⚠️ Kassa yozuvi bo'lsa — AYNAN uning `balance_after` i olinadi, ya'ni
   * DB tasdiqlagan qiymat. Xotiradagi taxmin ishlatilmaydi: mavjud kodda
   * aynan shu tuzoq («o'qib-yozish») parallel sotuvda balansni siljitardi.
   */
  private async resolveBalanceAfter(
    manager: EntityManager,
    integrationId: string,
    cashboxHistoryId: string | null,
    amount: number,
  ): Promise<number> {
    if (cashboxHistoryId) {
      const rows: Array<{ balance_after: string }> = await manager.query(
        `SELECT "balance_after" FROM "cashbox_history" WHERE "id" = $1`,
        [cashboxHistoryId],
      );
      if (rows?.length) return Number(rows[0].balance_after);
    }
    /**
     * Kassa qatoriga BOG'LANMAGAN yozuv — oldingi balansdan yuramiz.
     *
     * ⚠️ `amount` QO'SHILADI. Avval u qo'shilmasdi va izohda «texnik
     * yozuv, balans o'zgarmaydi» deb yozilgan edi — bu faqat summasi 0
     * bo'lgan yozuv uchun to'g'ri. Hisob-kitob endi har sotuvchiga
     * alohida yozuv yozadi va ularning faqat OXIRGISI kassa qatoriga
     * bog'lanadi; qolganlari uchun yugurib boruvchi balans kerak.
     */
    const prev = await manager.findOne(MarketplaceLedgerEntryEntity, {
      where: { integration_id: integrationId },
      order: { seq: 'DESC' },
    });
    return (prev ? Number(prev.balance_after) : 0) + amount;
  }

  private async lastSellerBalance(
    manager: EntityManager,
    integrationId: string,
    sellerId: string | null,
  ): Promise<number> {
    const rows: Array<{ seller_balance_after: string }> = await manager.query(
      `SELECT "seller_balance_after" FROM "marketplace_ledger_entry"
        WHERE "integration_id" = $1
          AND ${sellerId === null ? '"seller_id" IS NULL' : '"seller_id" = $2'}
        ORDER BY "seq" DESC LIMIT 1`,
      sellerId === null ? [integrationId] : [integrationId, sellerId],
    );
    return rows?.length ? Number(rows[0].seller_balance_after) : 0;
  }

  // ═══════════════════ HISOBOT VA INVARIANT ═══════════════════

  /**
   * INVARIANT TEKSHIRUVI: `SUM(daftar) == market kassasi balansi`.
   *
   * Solishtiruv CRON va `check-marketplace` skripti shuni chaqiradi.
   * Farq chiqsa — daftar yozuvi tushib qolgan (ilgak qo'yilmagan kassa
   * nuqtasi) yoki kassa daftarsiz o'zgartirilgan (masalan qo'lda SQL).
   */
  async verifyInvariant(integrationId: string): Promise<{
    ok: boolean;
    ledger_sum: number;
    cashbox_balance: number;
    diff: number;
  }> {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId },
    });
    if (!integration) throw new Error('Integratsiya topilmadi');

    const [{ sum }]: Array<{ sum: string | null }> = await this.ledgerRepo.query(
      `SELECT COALESCE(SUM("amount"), 0) AS sum
         FROM "marketplace_ledger_entry" WHERE "integration_id" = $1`,
      [integrationId],
    );
    const ledgerSum = Number(sum ?? 0);

    const cashbox = await this.cashRepo.findOne({
      where: { user_id: integration.market_id, cashbox_type: Cashbox_type.FOR_MARKET },
    });
    const balance = cashbox ? Number(cashbox.balance) : 0;

    return {
      ok: ledgerSum === balance,
      ledger_sum: ledgerSum,
      cashbox_balance: balance,
      diff: balance - ledgerSum,
    };
  }

  /** Sotuvchilar bo'yicha joriy jamlanma — panel va hisob-kitob uchun. */
  async balancesBySeller(integrationId: string): Promise<
    Array<{ seller_id: string | null; balance: number; entries: number }>
  > {
    const rows: Array<{ seller_id: string | null; balance: string; entries: string }> =
      await this.ledgerRepo.query(
        `SELECT "seller_id",
                COALESCE(SUM("amount"), 0) AS balance,
                COUNT(*) AS entries
           FROM "marketplace_ledger_entry"
          WHERE "integration_id" = $1
          GROUP BY "seller_id"
          ORDER BY balance DESC`,
        [integrationId],
      );
    return rows.map((r) => ({
      seller_id: r.seller_id,
      balance: Number(r.balance),
      entries: Number(r.entries),
    }));
  }
}
