import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Eski investor tizimidan (investor_deposit/earning/payout) yangi ledger'ga
 * ma'lumot ko'chirish:
 *   investor_deposit            → investor_capital_contribution
 *   investor_payout             → investor_distribution
 *   investor_earning.effective_percent → investor_ownership_stake (bitta ochiq versiya)
 *
 * Foyda YANGI (buyurtma-asosli) dvigatel bilan qayta hisoblanadi — eski
 * per-order earning'lar ko'chirilmaydi (faqat foiz o'qiladi).
 *
 * Idempotent (WHERE NOT EXISTS) + eski jadval mavjud bo'lmasa o'tkazib yuboradi.
 * effective_from = eng erta deposit sanasi → foyda o'sha kundan hisoblanadi.
 */
export class InvestorLegacyDataMigration1748800000000
  implements MigrationInterface
{
  private async tableExists(qr: QueryRunner, name: string): Promise<boolean> {
    const r = await qr.query(`SELECT to_regclass('public.${name}') AS r`);
    return r?.[0]?.r != null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Depozitlar → kapital hissalari.
    if (await this.tableExists(queryRunner, 'investor_deposit')) {
      await queryRunner.query(`
        INSERT INTO "investor_capital_contribution"
          ("id","created_at","updated_at","investor_id","amount","contributed_at","note","created_by")
        SELECT gen_random_uuid(), d.created_at, d.updated_at, d.investor_id,
               round(d.amount)::bigint, d.effective_date, d.note, d.recorded_by
        FROM "investor_deposit" d
        JOIN "users" u ON u.id = d.investor_id AND u.role = 'investor'
        WHERE d.amount > 0
          AND NOT EXISTS (
            SELECT 1 FROM "investor_capital_contribution" c WHERE c.investor_id = d.investor_id
          )
      `);
    }

    // 2) To'lovlar → taqsimotlar.
    if (await this.tableExists(queryRunner, 'investor_payout')) {
      await queryRunner.query(`
        INSERT INTO "investor_distribution"
          ("id","created_at","updated_at","investor_id","amount","distributed_at","note","created_by")
        SELECT gen_random_uuid(), p.created_at, p.updated_at, p.investor_id,
               round(p.amount)::bigint, p.created_at, p.note, p.paid_by_id
        FROM "investor_payout" p
        JOIN "users" u ON u.id = p.investor_id AND u.role = 'investor'
        WHERE p.amount > 0
          AND NOT EXISTS (
            SELECT 1 FROM "investor_distribution" di WHERE di.investor_id = p.investor_id
          )
      `);
    }

    // 3) Earning.effective_percent → egalik ulushi (bitta ochiq versiya).
    if (await this.tableExists(queryRunner, 'investor_earning')) {
      await queryRunner.query(`
        INSERT INTO "investor_ownership_stake"
          ("id","created_at","updated_at","investor_id","ownership_bps","profit_basis","effective_from","effective_to","note","created_by")
        SELECT gen_random_uuid(),
               (EXTRACT(EPOCH FROM now())*1000)::bigint,
               (EXTRACT(EPOCH FROM now())*1000)::bigint,
               e.investor_id,
               LEAST(GREATEST(round(MAX(e.effective_percent) * 100)::int, 0), 10000),
               'net',
               COALESCE(
                 (SELECT MIN(dd.effective_date) FROM "investor_deposit" dd WHERE dd.investor_id = e.investor_id),
                 MIN(e.created_at)
               ),
               NULL,
               'Eski tizimdan ko''chirildi',
               NULL
        FROM "investor_earning" e
        JOIN "users" u ON u.id = e.investor_id AND u.role = 'investor'
        WHERE e.effective_percent > 0
          AND NOT EXISTS (
            SELECT 1 FROM "investor_ownership_stake" os WHERE os.investor_id = e.investor_id
          )
        GROUP BY e.investor_id
      `);
    }
  }

  public async down(): Promise<void> {
    // Data migration — teskari qilinmaydi (ko'chirilgan qatorlar qoladi).
    // Kerak bo'lsa qo'lda: note = 'Eski tizimdan ko''chirildi' bo'yicha topib o'chiring.
  }
}
