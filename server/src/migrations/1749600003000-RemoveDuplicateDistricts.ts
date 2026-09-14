import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bazadagi TAKRORIY tuman yozuvlarini tozalash.
 *
 * MUAMMO. Uchta tuman ikki marta yozilgan edi — biri to'g'ri o'zbekcha nom
 * va SOATO kodi bilan, ikkinchisi eski ruscha/xato imlo va KODSIZ:
 *
 *   Farg'ona  : "Buvayda"  (1730212)  va  "Buvaida"  (kodsiz)
 *   Jizzax    : "Dostlik"  (1708215)  va  "Dustlik"  (kodsiz)
 *   Sirdaryo  : "Oqoltin"  (1724206)  va  "Akaltyn"  (kodsiz)
 *
 * Kodsiz nusxa hech qanday tashqi tizimga moslana olmaydi. Elchi darvozasi
 * esa "hammasi yoki hech biri" ishlaydi: viloyatda bitta moslanmagan tuman
 * qolsa, o'sha viloyat pochtasini BUTUNLIGICHA jo'natib bo'lmaydi. Ya'ni bu
 * uchta o'lik yozuv uchta viloyatni to'sib turardi.
 *
 * ⚠️ HIMOYA: yozuv O'CHIRILADI faqat
 *   1. to'g'ri juftligi SOATO bilan mavjud bo'lsa (aks holda bu yagona
 *      yozuv bo'lardi va o'chirish tumanni yo'qotardi), VA
 *   2. unga hech narsa bog'lanmagan bo'lsa — buyurtma, foydalanuvchi,
 *      kuryer biriktiruvi, Elchi moslamasi.
 *
 * Bog'langan bo'lsa TEGILMAYDI: bog'lanishlarni ko'chirish yetkazish
 * manzillariga daxl qiladi va uni ko'r-ko'rona qilib bo'lmaydi.
 *
 * Qayta ishga tushirishga chidamli: o'chiradigan narsa qolmasa jimgina
 * o'tadi.
 */
export class RemoveDuplicateDistricts1749600003000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM district d
      WHERE d.sato_code IS NULL
        AND d.name IN ('Buvaida', 'Dustlik', 'Akaltyn')
        -- 1) To'g'ri juftligi SHU viloyatda, SOATO bilan turibdimi?
        AND EXISTS (
          SELECT 1 FROM district t
          WHERE t.region_id = d.region_id
            AND t.id <> d.id
            AND t.sato_code IS NOT NULL
            AND regexp_replace(
                  replace(lower(t.name), 'x', 'h'), '[^a-z0-9]', '', 'g'
                ) = regexp_replace(
                  replace(lower(
                    CASE d.name
                      WHEN 'Buvaida' THEN 'Buvayda'
                      WHEN 'Dustlik' THEN 'Dostlik'
                      WHEN 'Akaltyn' THEN 'Oqoltin'
                    END
                  ), 'x', 'h'), '[^a-z0-9]', '', 'g'
                )
        )
        -- 2) Hech narsa bog'lanmaganmi?
        AND NOT EXISTS (SELECT 1 FROM "order" o WHERE o.district_id = d.id)
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.district_id = d.id)
        AND NOT EXISTS (
          SELECT 1 FROM district_courier dc WHERE dc.district_id = d.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM elchi_district_map m WHERE m.district_id = d.id
        );
    `);
  }

  public async down(): Promise<void> {
    /**
     * ATAYLAB BO'SH. Takroriy yozuvni qayta yaratish boshidanoq xato bo'lgan
     * holatni tiklardi — va yangi id bilan tiklangani uchun hech qanday eski
     * bog'lanishni ham qaytarmasdi.
     */
  }
}
