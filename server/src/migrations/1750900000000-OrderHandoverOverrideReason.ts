import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QO'LDA TOPSHIRISH SABABI — BUYURTMA QATORIDA.
 *
 * ── NEGA ────────────────────────────────────────────────────────────────
 *
 * Posilka ikki yo'l bilan topshirilishi mumkin:
 *   · yorliq SKANERLANDI — dalil skanning o'zi;
 *   · yorliq o'qilmadi (yirtilgan/namlangan) va xodim uni QO'LDA
 *     belgilab, YOPIQ ro'yxatdan sabab tanladi.
 *
 * Ikkinchisi — chetlab o'tish, ya'ni aynan NAZORAT qilinishi kerak
 * bo'lgan hodisa. Lekin sabab faqat `activity_log` ga yozilardi:
 * `applyHandover` buyurtmaga `market_handover_mode/by/session_id` ni
 * yozadi, `overrides` xaritasi esa faqat `logHandover` ga ketadi.
 *
 * Natijada buyurtma qatoriga qarab «bu skanerlanganmi yoki qo'lda
 * o'tganmi?» degan savolga JAVOB BO'LMASDI. Partiya ichini ochgan
 * odam (xodim ham, market ham) buni ko'ra olmasdi, hisobot esa
 * chetlab o'tish ulushini sanay olmasdi — holbuki ikki bosqichli
 * tasdiqning butun ma'nosi shu nazoratda.
 *
 * `activity_log` dan o'qish yaramaydi: u izoh MATNI, sxemasi
 * kafolatlanmagan va ro'yxat so'rovida join qilish qimmat.
 *
 * ── NEGA MODE EMAS ──────────────────────────────────────────────────────
 *
 * `market_handover_mode` SESSIYA darajasidagi faktni bildiradi (market
 * QR'i / offline akt / admin qarori). Qo'lda belgilash esa POSILKA
 * darajasidagi alohida fakt: sessiya market QR'i bilan ochilgan
 * bo'lsa ham, ayrim posilkalar yorliqsiz o'tishi mumkin. Ikkisini
 * bitta ustunga siqsak, «market tasdiqladi, lekin yorliq o'qilmadi»
 * holati yo'qolardi.
 *
 * NULL = yorliq skanerlangan (odatdagi yo'l).
 */
export class OrderHandoverOverrideReason1750900000000
  implements MigrationInterface
{
  name = 'OrderHandoverOverrideReason1750900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order"
        ADD COLUMN IF NOT EXISTS "market_handover_override_reason" varchar(64)
    `);

    /**
     * ⚠️ BACKFILL YO'Q — ATAYLAB. Eski topshirishlarda bu fakt hech
     * qayerda ishonchli saqlanmagan (`activity_log` matnidan ajratib
     * olish taxminga asoslanardi). NULL — «ma'lum emas», va u
     * «skanerlangan» degan yolg'on da'vodan YAXSHIROQ.
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order" DROP COLUMN IF EXISTS "market_handover_override_reason"
    `);
  }
}
