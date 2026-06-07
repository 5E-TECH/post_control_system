import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `click_to_market` (kuryerdan to'g'ridan-to'g'ri marketga) o'tkazmalarida
 * ESKI yozuvlar uchun `source_user_id` ni tiklaydi (backfill):
 *   - Kuryer kassasi yozuviga  → market_id  (pul qaysi marketga ketgani)
 *   - Market kassasi yozuviga  → courier_id (pul qaysi kuryerdan tushgani)
 *
 * Manba — ASOSIY (MAIN) kassa yozuvlari: eski kodda ham MAIN kassada
 * kuryer (income) va market (expense) yozuvlari `source_user_id` bilan
 * saqlangan. Bitta o'tkazma 4 ta yozuv hosil qiladi va ular bir
 * tranzaksiyada ketma-ket yoziladi — shuning uchun ular bir xil
 * (created_by, amount) ga ega va `created_at` bir-biriga juda yaqin.
 *
 * XAVFSIZLIK: faqat ANIQ (noaniqmas) eventlarni tiklaymiz — guruhda
 * aynan 1 tadan (main income, main expense, kuryer kassasi, market kassasi)
 * yozuv bo'lsa. Aks holda (masalan, bir vaqtda bir xil summali ikki o'tkazma)
 * tegmaymiz. Faqat `source_user_id IS NULL` bo'lgan yozuvlar yangilanadi —
 * balanslarga umuman tegilmaydi (faqat ko'rsatiladigan bog'lanish yorlig'i).
 */
export class BackfillClickToMarketCounterparty1747300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const WINDOW_MS = 5000;

    const rows: Array<{
      id: string;
      created_by: string;
      amount: string;
      created_at: string;
      operation_type: string;
      source_type: string;
      source_user_id: string | null;
      cashbox_type: string;
      cashbox_user_id: string | null;
    }> = await queryRunner.query(`
      SELECT h.id, h.created_by, h.amount, h.created_at,
             h.operation_type, h.source_type, h.source_user_id,
             c.cashbox_type, c.user_id AS cashbox_user_id
      FROM cashbox_history h
      JOIN cash_box c ON c.id = h.cashbox_id
      WHERE h.payment_method = 'click_to_market'
      ORDER BY h.created_at ASC
    `);

    const used = new Set<string>();
    const updates: Array<{ id: string; sourceUserId: string }> = [];

    for (const base of rows) {
      if (used.has(base.id)) continue;

      // Shu eventga tegishli (yaqin vaqtdagi, bir xil admin/summa) yozuvlar
      const group = rows.filter(
        (r) =>
          !used.has(r.id) &&
          r.created_by === base.created_by &&
          r.amount === base.amount &&
          Math.abs(Number(r.created_at) - Number(base.created_at)) <= WINDOW_MS,
      );

      const mainIncome = group.filter(
        (r) =>
          r.cashbox_type === 'main' &&
          r.operation_type === 'income' &&
          r.source_type === 'courier_payment',
      );
      const mainExpense = group.filter(
        (r) =>
          r.cashbox_type === 'main' &&
          r.operation_type === 'expense' &&
          r.source_type === 'market_payment',
      );
      const courierRec = group.filter(
        (r) =>
          r.cashbox_type === 'couriers' && r.source_type === 'courier_payment',
      );
      const marketRec = group.filter(
        (r) =>
          r.cashbox_type === 'markets' && r.source_type === 'market_payment',
      );

      // Faqat to'liq va aniq event (har biridan 1 tadan)
      if (
        mainIncome.length === 1 &&
        mainExpense.length === 1 &&
        courierRec.length === 1 &&
        marketRec.length === 1
      ) {
        const courierId =
          mainIncome[0].source_user_id || courierRec[0].cashbox_user_id;
        const marketId =
          mainExpense[0].source_user_id || marketRec[0].cashbox_user_id;

        if (courierId && marketId) {
          if (!courierRec[0].source_user_id) {
            updates.push({ id: courierRec[0].id, sourceUserId: marketId });
          }
          if (!marketRec[0].source_user_id) {
            updates.push({ id: marketRec[0].id, sourceUserId: courierId });
          }
        }

        group.forEach((r) => used.add(r.id));
      }
      // Aks holda — noaniq/to'liqmas guruh, xavfsizlik uchun tegmaymiz.
    }

    for (const u of updates) {
      await queryRunner.query(
        `UPDATE cashbox_history SET source_user_id = $1 WHERE id = $2 AND source_user_id IS NULL`,
        [u.sourceUserId, u.id],
      );
    }
  }

  public async down(): Promise<void> {
    // Backfill orqaga qaytarilmaydi — qaysi qiymat backfill bilan
    // to'ldirilganini ajratib bo'lmaydi (yangi yozuvlar bilan aralashgan).
  }
}
