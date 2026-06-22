import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Buyurtmaga `original_total_price` (qisman sotishdan oldingi asl summa)
 * ustunini qo'shadi.
 *
 * Sabab: `partlySold` buyurtma narxini kamaytirilgan summaga qayta yozadi.
 * Agar dona kamaymay FAQAT narx tushirilsa, "bola" (cancelled child) order
 * yaratilmaydi va asl summa hech qayerda saqlanmaydi — natijada rollback narxni
 * tiklay olmaydi. Bu ustun asl summani saqlaydi; rollback'da total_price aynan
 * shundan tiklanadi.
 *
 * Additive va nullable — eski buyurtmalar uchun NULL bo'lib qoladi (ularning
 * total_price'iga, statistikaga yoki boshqa hech narsaga ta'sir qilmaydi).
 * Hech qanday backfill yo'q, mavjud qatorlar o'zgarmaydi.
 *
 * Tip `double precision` — `order.total_price` (TypeORM `float`) bilan bir xil.
 */
export class OrderOriginalTotalPrice1747800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "original_total_price" double precision`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "original_total_price"`,
    );
  }
}
