import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { Operation_type, Source_type } from 'src/common/enums';
import { toUzbekistanDateString } from 'src/common/utils/date.util';

/**
 * QO'SHIMCHA XARAJAT — KASSAGA YOZUVCHI YAGONA JOY.
 *
 * NEGA KERAK. Ayni bir pul harakati hozir UCH NUSXADA yozilgan:
 *
 *   `sellOrder`    — `updateCashbox` closure (order.service.ts:2477)
 *   `partlySold`   — o'sha closure AYNAN NUSXALANGAN (:3162)
 *   `cancelOrder`  — qo'lda, 45 qator (:3019-3049)
 *
 * Uchtasi hozir bir xil natija beradi, lekin ular ajralib ketishi vaqt
 * masalasi: kimdir bittasiga tuzatish kiritsa, qolgan ikkitasi eski qoladi.
 * Pul mantiqida bunday ajralish "kuryer eng bo'sh yo'lni topib ishlatadi"
 * degani (aynan `extra-cost-limit.util.ts` da qayd etilgan tarix).
 *
 * ===================== SEMANTIKA =====================
 *
 * Ikkala kassa ham CHIQIM (EXPENSE) oladi, va bu ataylab:
 *
 *   market kassasi  = pochtaning marketga QARZI  → kamaysa, market to'ladi
 *   kuryer kassasi  = kuryerning pochtaga QARZI  → kamaysa, kuryer naqdni
 *                                                  o'zida qoldiradi (= to'lov)
 *
 * Shu sababli moliyaviy taroziga ta'siri NOL: `main + Σcourier − Σmarket`
 * formulasida `(−X) − (−X) = 0`. Ya'ni `financial_balance_history` ga
 * YOZILMAYDI va MAIN kassaga hech qachon tegilmaydi (smena/karta
 * invariantlari buzilmaydi).
 */

/**
 * `UPDATE ... RETURNING` natijasini bitta shaklga keltiradi.
 *
 * TypeORM postgres drayveri bu turdagi so'rov uchun `[[qatorlar], affected]`
 * qaytaradi, `SELECT` uchun esa `[qatorlar]`. Farqni hisobga olmaslik
 * `rows[0].balance` ni `undefined` qilib, `Number(undefined) = NaN` orqali
 * bigint INSERT xatosiga olib keladi.
 */
function normalizeReturning(raw: unknown): Array<{ balance: string }> {
  if (!Array.isArray(raw)) return [];
  // `[[rows], affected]` shakli
  if (raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[0] as Array<{ balance: string }>;
  }
  return raw as Array<{ balance: string }>;
}

@Injectable()
export class ExtraCostApplierService {
  /**
   * INLINE yo'l — sotuv/bekor/qisman sotuv tranzaksiyasi ICHIDA.
   *
   * ⚠️ KASSA OBYEKTLARI PARAMETR SIFATIDA OLINADI, qayta yuklanmaydi.
   *
   * Chaqiruvchi (masalan `sellOrder`) kassalarni allaqachon yuklagan va SELL
   * yozuvlari bilan `balance` ni xotirada o'zgartirgan bo'ladi. Agar bu yerda
   * `findOne` bilan YANGI obyekt olinsa, xotirada bitta kassa qatorining IKKI
   * nusxasi paydo bo'ladi va biri ikkinchisining balansini ESKI qiymat bilan
   * qayta yozadi — natijada bitta tranzaksiya ichida SELL yoki EXTRA_COST
   * yozuvi jimgina yo'qoladi.
   *
   * ⚠️ `Promise.all` ATAYLAB ISHLATILMAYDI. Mavjud kod ikkala yozuvni bitta
   * `queryRunner` (ya'ni bitta pg ulanishi) ustida parallel chaqiradi. pg
   * ularni baribir navbatga qo'yadi, lekin `balance_after` snapshotlari
   * qachon olinishi noaniq bo'lib qoladi. Ketma-ket `await` — bir xil
   * natija, aniq tartib.
   */
  async applyInline(
    queryRunner: QueryRunner,
    params: {
      marketCashbox: CashEntity;
      courierCashbox: CashEntity;
      orderId: string;
      amount: number;
      comment: string;
      /** Yozuvni kim yaratdi (odatda kuryer). */
      createdBy: string;
      marketId: string;
      courierId: string;
      /**
       * Kassa yozuvi qaysi kungi buyurtmaga tegishli (epoch ms). Tasdiqlash
       * yo'lida bu sotuv sanasi bo'ladi — yozuvning o'zi keyinroq tug'iladi.
       */
      paymentDate?: number | null;
    },
  ): Promise<{ marketHistoryId: string; courierHistoryId: string }> {
    const amount = Math.trunc(Number(params.amount) || 0);
    if (amount <= 0) {
      throw new Error(
        `ExtraCostApplier: summa musbat butun son bo'lishi shart (${params.amount})`,
      );
    }

    /**
     * ⚠️ ATOMIK YO'L (bloker B1) — «o'qi-o'zgartir-yoz» EMAS.
     *
     * Avval bu yerda `cashbox.balance -= amount; save(cashbox)` turardi.
     * Ikki kuryer bir marketning ikki BOSHQA buyurtmasiga bir vaqtda
     * xarajat yozsa, biri ikkinchisining yozuvini JIMGINA o'chirardi.
     * Undan ham yomoni: `balance_after` xotiradagi TAXMIN edi, marketplace
     * daftari esa aynan o'sha qatordan o'qiydi — ikki tomon balansi
     * ajralib ketardi.
     *
     * Tasdiqlash yo'li (`applyApproved`) allaqachon `writeOneAtomic`
     * ishlatardi; endi ikkala yo'l ham DB tasdiqlagan bitta yo'ldan o'tadi.
     */
    const marketHistory = await this.writeOneAtomic(queryRunner, {
      cashboxId: params.marketCashbox.id,
      amount,
      orderId: params.orderId,
      comment: params.comment,
      createdBy: params.createdBy,
      // Kassa yozuvida "narigi tomon" kim ekani ko'rinsin: market yozuvida
      // kuryer, kuryer yozuvida market. Hozir bu maydon bo'sh qolyapti va
      // kassa tarixida "kim bilan" ma'lumoti yo'qoladi.
      sourceUserId: params.courierId,
      paymentDate: params.paymentDate,
    });

    // KURYER kassasi — kuryerning pochtaga qarzi kamayadi (= kuryerga to'lov).
    const courierHistory = await this.writeOneAtomic(queryRunner, {
      cashboxId: params.courierCashbox.id,
      amount,
      orderId: params.orderId,
      comment: params.comment,
      createdBy: params.createdBy,
      sourceUserId: params.marketId,
      paymentDate: params.paymentDate,
    });

    // ⚠️ XARAJAT BUYURTMAGA HAM YOZILADI — busiz market bilan hisob-kitob
    // buziladi (quyidagi `bumpOrderExtraCostNet` izohiga qarang).
    await this.bumpOrderExtraCostNet(queryRunner, params.orderId, amount);

    // ⚠️ Xotiradagi nusxalarni DB tasdiqlagan qiymatga keltiramiz —
    // chaqiruvchi shu obyektlarni keyin ishlatishi mumkin.
    params.marketCashbox.balance = Number(marketHistory.balance_after);
    params.courierCashbox.balance = Number(courierHistory.balance_after);

    return {
      marketHistoryId: marketHistory.id,
      courierHistoryId: courierHistory.id,
    };
  }

  /**
   * TASDIQLASH yo'li — ATOMIK SQL.
   *
   * ⚠️ NEGA `applyInline` DAN FARQLI. Inline yo'l sotuv tranzaksiyasi ichida
   * ishlaydi: kassa qatori allaqachon yuklangan va `pessimistic_write` lock
   * ostida. Tasdiqlash esa MUSTAQIL so'rov — ikki market xodimi bir vaqtda
   * "Tasdiqlash" bosishi mumkin, kassa esa boshqa sotuvlar tomonidan ham
   * yangilanib turadi.
   *
   * Shu sababli bu yerda balans XOTIRADA hisoblanmaydi:
   *
   *   ✗ findOne → cashbox.balance -= X → save     (lost update: oradagi
   *                                                sotuv jimgina yo'qoladi)
   *   ✓ UPDATE ... SET balance = balance - $1 ... RETURNING balance
   *
   * `balance_after` ham AYNAN shu `RETURNING` dan olinadi — ya'ni kassa
   * tarixidagi raqam DB tasdiqlagan haqiqiy balans bo'ladi.
   *
   * ⚠️ `Promise.all` ISHLATILMAYDI: ikkala UPDATE bitta `queryRunner` (bitta
   * pg ulanishi) ustida ketadi, parallel chaqiruv ularni baribir navbatga
   * qo'yadi-yu, xato holatida qaysi biri bajarilganini aniqlash qiyinlashadi.
   */
  async applyAtomic(
    queryRunner: QueryRunner,
    params: {
      marketCashboxId: string;
      courierCashboxId: string;
      orderId: string;
      amount: number;
      comment: string;
      createdBy: string;
      marketId: string;
      courierId: string;
      /** Buyurtma sanasi — kassa yozuvi keyinroq tug'ilsa ham ko'rinsin. */
      paymentDate?: number | null;
    },
  ): Promise<{ marketHistoryId: string; courierHistoryId: string }> {
    const amount = Math.trunc(Number(params.amount) || 0);
    if (amount <= 0) {
      throw new Error(
        `ExtraCostApplier: summa musbat butun son bo'lishi shart (${params.amount})`,
      );
    }

    const marketHistory = await this.writeOneAtomic(queryRunner, {
      cashboxId: params.marketCashboxId,
      amount,
      orderId: params.orderId,
      comment: params.comment,
      createdBy: params.createdBy,
      sourceUserId: params.courierId,
      paymentDate: params.paymentDate,
    });

    const courierHistory = await this.writeOneAtomic(queryRunner, {
      cashboxId: params.courierCashboxId,
      amount,
      orderId: params.orderId,
      comment: params.comment,
      createdBy: params.createdBy,
      sourceUserId: params.marketId,
      paymentDate: params.paymentDate,
    });

    // ⚠️ XARAJAT BUYURTMAGA HAM YOZILADI (applyInline bilan bir xil sabab).
    await this.bumpOrderExtraCostNet(queryRunner, params.orderId, amount);

    return {
      marketHistoryId: marketHistory.id,
      courierHistoryId: courierHistory.id,
    };
  }

  /**
   * SOF XARAJATNI BUYURTMAGA YOZISH.
   *
   * ⚠️ NEGA KERAK. `extra_cost_net` ustuni bazada 2026-06 dan beri bor
   * (`1749800000000` migratsiyasi) va entity izohida maqsadi aniq
   * yozilgan — LEKIN unga hech qachon yozilmagan. Natijada xarajat
   * FAQAT market kassasida ko'rinardi, buyurtmada esa izi qolmasdi.
   *
   * Oqibati: `paymentsToMarket` to'lovni `to_be_paid` bo'yicha
   * tarqatadi, market kassasi esa xarajat qadar KAM. Ya'ni marketga
   * kassadagi HAMMA pulni bersangiz ham, xarajat qadar buyurtma
   * yopilmay qolardi — «hamma pulni to'ladim, baribir PAID bo'lmadi»
   * shikoyatining bevosita sababi.
   *
   * ⚠️ ATOMIK `UPDATE` — «o'qi-o'zgartir-yoz» EMAS. Bir buyurtmaga ikki
   * xarajat parallel tasdiqlansa, ikkinchisi birinchisini o'chirardi.
   *
   * @param delta musbat — xarajat qo'shildi; manfiy — teskari qaytarildi
   */
  async bumpOrderExtraCostNet(
    queryRunner: QueryRunner,
    orderId: string,
    delta: number,
  ): Promise<void> {
    const d = Math.trunc(Number(delta) || 0);
    if (d === 0) return;
    await queryRunner.manager.query(
      `UPDATE "order" SET "extra_cost_net" = "extra_cost_net" + $1 WHERE "id" = $2`,
      [d, orderId],
    );
  }

  /** Bitta kassaga ATOMIK chiqim + tarix yozuvi. */
  private async writeOneAtomic(
    queryRunner: QueryRunner,
    p: {
      cashboxId: string;
      amount: number;
      orderId: string;
      comment: string;
      createdBy: string;
      sourceUserId: string | null;
      paymentDate?: number | null;
    },
  ): Promise<CashboxHistoryEntity> {
    const raw: unknown = await queryRunner.manager.query(
      `UPDATE "cash_box"
          SET "balance" = "balance" - $1, "updated_at" = $2
        WHERE "id" = $3
        RETURNING "balance"`,
      [p.amount, Date.now(), p.cashboxId],
    );

    // ⚠️ TypeORM `query()` `UPDATE ... RETURNING` uchun `[[qatorlar], affected]`
    // qaytaradi, oddiy `SELECT` uchun esa to'g'ridan-to'g'ri `[qatorlar]`.
    // Ikkala shaklni ham qo'llab-quvvatlaymiz: birinchi shaklni hisobga
    // olmaslik `balance_after = NaN` berib, bigint ustunga INSERT'ni yiqitadi
    // (haqiqiy bazada sinovda aynan shu xato chiqdi).
    const rows = normalizeReturning(raw);

    if (!rows.length) {
      // Kassa topilmadi — tranzaksiya rollback bo'ladi va tasdiqlash 409
      // beradi. Jimgina o'tkazib yuborilsa, so'rov "tasdiqlangan" bo'lib
      // qolardi-yu pul hech qayerga yozilmagan bo'lardi.
      throw new Error(`ExtraCostApplier: kassa topilmadi (${p.cashboxId})`);
    }

    // `balance_after` — DB TASDIQLAGAN qiymat, xotiradagi taxmin emas.
    const balanceAfter = Number(rows[0].balance);
    if (!Number.isFinite(balanceAfter)) {
      throw new Error(
        `ExtraCostApplier: balansni o'qib bo'lmadi (${p.cashboxId})`,
      );
    }

    const history = queryRunner.manager.create(CashboxHistoryEntity, {
      operation_type: Operation_type.EXPENSE,
      cashbox_id: p.cashboxId,
      source_id: p.orderId,
      source_type: Source_type.EXTRA_COST,
      amount: p.amount,
      balance_after: balanceAfter,
      comment: p.comment,
      created_by: p.createdBy,
      ...(p.sourceUserId ? { source_user_id: p.sourceUserId } : {}),
      ...(p.paymentDate
        ? { payment_date: toUzbekistanDateString(p.paymentDate) }
        : {}),
    });
    await queryRunner.manager.save(history);
    return history;
  }

}
