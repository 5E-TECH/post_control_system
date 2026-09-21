import { EntityManager } from 'typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { Operation_type, PaymentMethod, Source_type } from 'src/common/enums';

/**
 * KASSA BALANSINI ATOMIK O'ZGARTIRISH — LOST UPDATE ga qarshi.
 *
 * ⚠️ MUAMMO (bloker B1). Bugungi kod hamma joyda shunday yozadi:
 *
 *     cashbox.balance += delta;
 *     await manager.save(cashbox);      // SET balance = <XOTIRADAGI qiymat>
 *
 * Bu «o'qi-o'zgartir-yoz» va u ATOMIK EMAS. Ikki kuryer bitta marketning
 * ikki BOSHQA buyurtmasini bir vaqtda sotsa:
 *
 *     A: balance o'qidi = 1 000 000        B: balance o'qidi = 1 000 000
 *     A: SET balance = 1 150 000           B: SET balance = 1 200 000
 *                                          → A ning 150 000 i YO'QOLDI
 *
 * ⚠️ NEGA MAVJUD LOCK YETARLI EMAS. `sellOrder` `pessimistic_write` ni faqat
 * BUYURTMA qatoriga qo'yadi. Ikki turli buyurtma — ikki turli qulf, kassa
 * esa umumiy. Kod izohlarida «kassa lock ostida» deyilgan, lekin kassa
 * `findOne` da hech qanday `lock` yo'q — tekshirildi.
 *
 * YECHIM: balansni DB hisoblaydi va `balance_after` AYNAN shu
 * `RETURNING` dan olinadi — ya'ni tarixdagi raqam xotiradagi taxmin emas,
 * DB tasdiqlagan haqiqiy qiymat.
 *
 * Ayni naqsh `ExtraCostApplierService.writeOneAtomic` da allaqachon bor;
 * bu util uni UMUMIY qiladi va qolgan barcha nuqtalarga tarqatadi.
 */

export interface CashboxDeltaInput {
  /** Kassa yozuvi. Xotiradagi `balance` ham yangilanadi (eskirib qolmasin). */
  cashbox: CashEntity;
  /** ISHORALI o'zgarish: musbat = kirim, manfiy = chiqim. */
  delta: number;
  operation: Operation_type;
  source_type: Source_type;
  /** Tarixdagi ko'rinish uchun MUSBAT summa. */
  amount: number;
  source_id?: string | null;
  source_user_id?: string | null;
  comment?: string | null;
  created_by: string;
  payment_method?: PaymentMethod | null;
  /** `date` ustuni — allaqachon `YYYY-MM-DD` ko'rinishida bo'lishi kerak. */
  payment_date?: string | null;
}

export interface CashboxDeltaResult {
  /** DB TASDIQLAGAN yangi balans. */
  balance_after: number;
  history_id: string;
}

/**
 * TypeORM `query()` `UPDATE ... RETURNING` uchun ikki xil shakl qaytaradi:
 * `rows` yoki `[rows, affectedCount]`. Ikkalasini ham tushunamiz.
 *
 * ⚠️ Bu tekshiruvsiz `rows[0].balance` `undefined` bo'lib,
 * `Number(undefined) = NaN` orqali `balance_after` ga NaN yozilardi va
 * bigint ustunga INSERT yiqilardi.
 */
function normalizeReturning(raw: unknown): Array<{ balance: string }> {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[0] as Array<{ balance: string }>;
  }
  return raw as Array<{ balance: string }>;
}

export async function applyCashboxDelta(
  manager: EntityManager,
  input: CashboxDeltaInput,
): Promise<CashboxDeltaResult> {
  const delta = Math.trunc(Number(input.delta) || 0);
  const now = Date.now();

  const raw = await manager.query(
    `UPDATE "cash_box"
        SET "balance" = "balance" + $1, "updated_at" = $2
      WHERE "id" = $3
      RETURNING "balance"`,
    [delta, now, input.cashbox.id],
  );
  const rows = normalizeReturning(raw);
  if (!rows.length) {
    throw new Error(`applyCashboxDelta: kassa topilmadi (${input.cashbox.id})`);
  }

  const balanceAfter = Number(rows[0].balance);
  if (!Number.isFinite(balanceAfter)) {
    throw new Error(
      `applyCashboxDelta: balans o'qilmadi (${input.cashbox.id}) — RETURNING shakli kutilmagan`,
    );
  }

  // Xotiradagi obyektni ham yangilaymiz: chaqiruvchi keyin uni o'qisa
  // (masalan qarz hisobi) eskirgan qiymat olmasin.
  input.cashbox.balance = balanceAfter;

  const history = manager.create(CashboxHistoryEntity, {
    operation_type: input.operation,
    cashbox_id: input.cashbox.id,
    source_type: input.source_type,
    source_id: input.source_id ?? null,
    source_user_id: input.source_user_id ?? null,
    amount: Math.trunc(Math.abs(Number(input.amount) || 0)),
    // ⚠️ DB tasdiqlagan qiymat — xotiradagi taxmin emas.
    balance_after: balanceAfter,
    comment: input.comment ?? undefined,
    created_by: input.created_by,
    ...(input.payment_method ? { payment_method: input.payment_method } : {}),
    ...(input.payment_date ? { payment_date: input.payment_date } : {}),
  });
  const savedHistory = await manager.save(CashboxHistoryEntity, history);

  return { balance_after: balanceAfter, history_id: savedHistory.id };
}
