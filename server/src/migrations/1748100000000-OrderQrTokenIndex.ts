import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * qr_code_token uchun indeks.
 *
 * Muammo: QR skaner oqimlari (admin `checkPost`/`checkCancelPost` va kuryer
 * `receiveOrderByQrTokenForCourier`) buyurtmani qr_code_token bo'yicha izlaydi,
 * lekin bu ustunda indeks YO'Q edi — har bir token qidiruvi sequential scan
 * bo'lib, buyurtmalar soni o'sgani sayin sekinlashardi.
 *
 * Non-unique indeks: tokenlar amalda noyob, lekin DB darajasida hech narsa
 * buni majburlamaydi. Agar mavjud ma'lumotda dublikat token bo'lsa, UNIQUE
 * indeks migrationni buzardi — shuning uchun ataylab oddiy indeks.
 */
export class OrderQrTokenIndex1748100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_QR_TOKEN" ON "order" ("qr_code_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_QR_TOKEN"`);
  }
}
