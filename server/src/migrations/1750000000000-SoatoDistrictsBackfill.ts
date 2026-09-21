import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SOATO MA'LUMOTNOMASINI TO'LDIRISH — 26 ta yetishmayotgan tuman/shahar.
 *
 * MUAMMO. Bazada 181 ta yozuv bor edi, rasmiy SOATO tasnifida esa 210 ta.
 * Yetishmayotganlar orasida VILOYAT MARKAZLARI bor: Namangan, Termiz,
 * Urganch, Nukus, Guliston, Farg'ona shaharlari. Ya'ni marketplace shu
 * shaharlarga buyurtma yuborsa, posilka «Tuman topilmadi (SOATO ...)»
 * bilan RAD ETILARDI.
 *
 * NEGA XAVFSIZ:
 *   - FAQAT INSERT. Bitta ham mavjud qator O'ZGARTIRILMAYDI va
 *     O'CHIRILMAYDI. Nomlar 119 joyda tasnifdan farq qiladi, lekin
 *     ularga TEGILMAYDI: boshqa tizimlar (Elchi xaritasi, kuryer
 *     biriktiruvi) nom bo'yicha moslashtirilgan bo'lishi mumkin.
 *   - IDEMPOTENT: NOT EXISTS. Qayta ishga tushsa hech narsa qo'shmaydi.
 *   - assigned_region = region_id. Mavjud 181 qatorning HAMMASIDA bu
 *     maydon to'ldirilgan va qabul yo'li undan foydalanadi
 *     (district.assigned_region || district.region_id). Yangi qatorlar
 *     ham xuddi shunday, ya'ni xatti-harakat bir xil.
 *   - Viloyat sato_code bo'yicha topiladi, UUID qattiq yozilmagan.
 *
 * NIMA QILMAYDI: yangi tumanga KURYER biriktirmaydi. Migratsiya
 * posilkani QABUL QILISH imkonini beradi, yetkazishni avtomatlashtirmaydi.
 *
 * Manba: rasmiy SOATO/MHOBT tasnifi (210 yozuv). Bizdagi 181 kodning
 * HAMMASI tasnifda mavjudligi tekshirilgan - mos kelmaydigan kod yo'q.
 */
export class SoatoDistrictsBackfill1750000000000 implements MigrationInterface {
  name = 'SoatoDistrictsBackfill1750000000000';

  /** [sato_code, nom, viloyat_sato_code] */
  private readonly rows: Array<[string, string, string]> = [
    ['1708212', 'Sh.Rashidov tumani', '1708'],
    ['1708218', 'Zomin tumani', '1708'],
    ['1710245', 'Shahrisabz tumani', '1710'],
    ['1712244', 'Tomdi tumani', '1712'],
    ['1712248', 'Uchquduq tumani', '1712'],
    ['1712412', 'G\'ozg\'on tumani', '1712'],
    ['1714229', 'Uychi tumani', '1714'],
    ['1714401', 'Namangan shahri', '1714'],
    ['1722401', 'Termiz shahri', '1722'],
    ['1724401', 'Guliston shahri', '1724'],
    ['1724414', 'Baxt shahri', '1724'],
    ['1727253', 'O\'rtachirchiq tumani', '1727'],
    ['1727413', 'Bekobod shahri', '1727'],
    ['1727415', 'Ohangaron shahri', '1727'],
    ['1727424', 'Yangiyo\'l shahri', '1727'],
    ['1730206', 'Qo\'shtepa tumani', '1730'],
    ['1730230', 'O\'zbekiston tumani', '1730'],
    ['1730401', 'Farg\'ona shahri', '1730'],
    ['1730408', 'Quvasoy shahri', '1730'],
    ['1733221', 'Tuproqqal\'a tumani', '1733'],
    ['1733223', 'Xonqa tumani', '1733'],
    ['1733401', 'Urganch shahri', '1733'],
    ['1733406', 'Xiva shahri', '1733'],
    ['1735209', 'Bo\'zatov tumani', '1735'],
    ['1735228', 'Taxiatosh tumani', '1735'],
    ['1735401', 'Nukus shahri', '1735'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const now = Date.now();
    let added = 0;
    for (const [sato, name, regionSato] of this.rows) {
      const res: Array<{ id: string }> = await queryRunner.query(
        `INSERT INTO district (created_at, updated_at, name, region_id, assigned_region, sato_code)
         SELECT $1, $1, $2, r.id, r.id, $3::varchar
           FROM region r
          WHERE r.sato_code = $4
            AND NOT EXISTS (SELECT 1 FROM district d WHERE d.sato_code = $3::varchar)
         RETURNING id`,
        [now, name, sato, regionSato],
      );
      if (res.length) added++;
    }
    // eslint-disable-next-line no-console
    console.log(`[SOATO] ${added} ta yangi tuman/shahar qo'shildi`);
  }

  /**
   * ORTGA QAYTARISH - faqat HECH KIM ISHLATMAGAN qatorlar o'chiriladi.
   * Agar tumanga buyurtma, mijoz yoki kuryer biriktirilgan bo'lsa, qator
   * QOLDIRILADI: aks holda `down` haqiqiy ma'lumotni yo'q qilardi.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = this.rows.map((r) => r[0]);
    await queryRunner.query(
      `DELETE FROM district d
        WHERE d.sato_code = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM "order" o WHERE o.district_id = d.id)
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.district_id = d.id)
          AND NOT EXISTS (SELECT 1 FROM district_courier dc WHERE dc.district_id = d.id)
          AND NOT EXISTS (SELECT 1 FROM elchi_district_map em WHERE em.district_id = d.id)`,
      [codes],
    );
  }
}
