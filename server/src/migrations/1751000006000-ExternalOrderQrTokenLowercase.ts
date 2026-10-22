import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TASHQI BUYURTMA QR TOKENI — KICHIK HARFGA.
 *
 * ── MUAMMO ──────────────────────────────────────────────────────────────
 *
 * `receiveExternalOrders` tashqi QR qiymatini xom saqlardi. Ichki skan
 * qidiruvlari (`findByQrCode`, kuryer skaneri, `receiveWithScaner`) esa
 * kirishni `normalizeQrToken` bilan kichik harfga o'tkazib, ANIQ TENGLIK
 * bilan izlaydi. Adosh (raqam) va Inhayat (kichik hex) tokenlarida farq
 * yo'q edi; Butsy (`pc_17zVBH...`, aralash registr) buyurtmasi esa ichki
 * skanerda HECH QACHON topilmasdi.
 *
 * Kod endi yangi buyurtmani normallashtirib saqlaydi. Bu migratsiya
 * avval saqlangan qatorlarni (masalan «topilmadi → baribir qo'shilsin»
 * yo'li bilan kirgan) shu shaklga keltiradi. Qator bo'lmasa — no-op.
 *
 * Xavfsiz: tashqi QR bilan solishtiradigan har bir joy (`checkDuplicateOrder`,
 * `receiveExternalOrders` dublikat tekshiruvi) allaqachon `LOWER(...)`
 * ishlatadi; status sync esa `external_id` bilan ishlaydi, QR bilan emas.
 */
export class ExternalOrderQrTokenLowercase1751000006000
  implements MigrationInterface
{
  name = 'ExternalOrderQrTokenLowercase1751000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "order"
         SET "qr_code_token" = LOWER("qr_code_token")
       WHERE "operator" LIKE 'external\\_%'
         AND "qr_code_token" <> LOWER("qr_code_token")
    `);
  }

  public async down(): Promise<void> {
    // Asl registr saqlanmagan — qaytarib bo'lmaydi va kerak ham emas:
    // ichki qidiruvlar baribir kichik harf bilan izlaydi.
  }
}
