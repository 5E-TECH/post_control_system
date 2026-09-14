import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tumanlarga HAQIQIY SOATO kodlarini to'ldirish.
 *
 * MUAMMO. 184 tumandan faqat 71 tasida SOATO bor edi. Qolgan 113 tasi bo'sh —
 * ya'ni ular hech qanday tashqi tizimga (LDG, Elchi) avtomatik moslana
 * olmasdi. Elchi integratsiyasini jonli sozlashda aynan shu chiqdi:
 * `syncDistricts` 184 tumandan NOLTASINI mosladi.
 *
 * MANBA: github.com/MIMAXUZ/uzbekistan-regions-data (rasmiy SOATO
 * klassifikatori asosida, 14 viloyat / 210 tuman).
 *
 * ISHONCHLILIK TEKSHIRUVI: bazadagi mavjud 71 kodning HAMMASI shu manbada
 * topildi (0 ta chetlashish), 68 tasida nom ham aynan mos. Qolgan 3 tasi —
 * imlo varianti (`Shaxrixon`/`Shahrixon`, `x`/`h`).
 *
 * NEGA NOM BO'YICHA, ID BO'YICHA EMAS: tuman UUID'lari har muhitda boshqacha.
 * Nom solishtiruvi normallashtirilgan holda bajariladi — qo'shimchalar
 * (`tumani`/`shahri`) olib tashlanadi, apostrof variantlari va `x`/`h`
 * tenglashtiriladi.
 *
 * SHAHAR/TUMAN AJRATIMI: manbada 17 ta nom ham tuman, ham shahar sifatida
 * bor (masalan `Qarshi tumani` 1710224 va `Qarshi` 1710401). Ajratish bazaning
 * O'Z uslubiga tayanadi: nomida "shahri" bo'lsa shahar kodi, aks holda tuman
 * kodi olinadi.
 *
 * XAVFSIZLIK: faqat `sato_code IS NULL` bo'lgan qatorlar yangilanadi —
 * mavjud kodlar USTIDAN YOZILMAYDI. Kod allaqachon boshqa qatorda band
 * bo'lsa ham o'tkazib yuboriladi (`sato_code` UNIQUE).
 *
 * ⚠️ TOPILGAN DUBLIKATLAR (bu migratsiya tuzatmaydi, faqat chetlab o'tadi):
 * bazada uchta tuman IKKI MARTA yozilgan —
 *   Buvaida / Buvayda      (Farg'ona, 1730212)
 *   Dostlik / Dustlik      (Jizzax,  1708215)
 *   Akaltyn / Oqoltin      (Sirdaryo, 1724206)
 * Har juftlikdan faqat BITTASIGA kod beriladi (rasmiy nomga yaqini yoki
 * buyurtmasi bori). Ikkinchisi `sato_code = NULL` bo'lib qoladi va uni
 * birlashtirish alohida ma'lumot tozalash ishi.
 */
export class DistrictSatoBackfill1749600002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH source(region_sato, district_name, sato) AS (VALUES
    ('1708', 'Baxmal', '1708204'),
    ('1708', 'Dostlik', '1708215'),
    ('1708', 'Forish', '1708235'),
    ('1708', 'G''allaorol', '1708209'),
    ('1708', 'Mirzacho''l', '1708223'),
    ('1708', 'Paxtakor', '1708228'),
    ('1708', 'Yangiobod', '1708237'),
    ('1708', 'Zafarobod', '1708225'),
    ('1708', 'Zarbdor', '1708220'),
    ('1710', 'Chiroqchi', '1710242'),
    ('1710', 'Dehqonobod', '1710212'),
    ('1710', 'G''uzor', '1710207'),
    ('1710', 'Kamashi', '1710220'),
    ('1710', 'Karshi', '1710224'),
    ('1710', 'Kasbi', '1710237'),
    ('1710', 'Kitob', '1710232'),
    ('1710', 'Koson', '1710229'),
    ('1710', 'Mirishkor', '1710233'),
    ('1710', 'Muborak', '1710234'),
    ('1710', 'Nishon', '1710235'),
    ('1710', 'Yakkabog''', '1710250'),
    ('1712', 'Xatirchi', '1712251'),
    ('1714', 'Chortoq', '1714236'),
    ('1714', 'Chust', '1714237'),
    ('1714', 'Kosonsoy', '1714207'),
    ('1714', 'Mingbuloq', '1714204'),
    ('1714', 'Namangan', '1714212'),
    ('1714', 'Norin', '1714216'),
    ('1714', 'Pop', '1714219'),
    ('1714', 'To''raqo''rg''on', '1714224'),
    ('1714', 'Uchqo''rg''on', '1714234'),
    ('1714', 'Yangiqo''rg''on', '1714242'),
    ('1722', 'Angor', '1722202'),
    ('1722', 'Bandixon', '1722203'),
    ('1722', 'Boysun', '1722204'),
    ('1722', 'Denov', '1722210'),
    ('1722', 'Jarqo''rg''on', '1722212'),
    ('1722', 'Muzrabot', '1722207'),
    ('1722', 'Oltinsoy', '1722201'),
    ('1722', 'Qiziriq', '1722215'),
    ('1722', 'Qumqo''rg''on', '1722214'),
    ('1722', 'Sariosiyo', '1722217'),
    ('1722', 'Sherobod', '1722223'),
    ('1722', 'Sho''rchi', '1722226'),
    ('1722', 'Termiz', '1722220'),
    ('1722', 'Uzun', '1722221'),
    ('1724', 'Boyovut', '1724212'),
    ('1724', 'Guliston', '1724220'),
    ('1724', 'Mirzaobod', '1724228'),
    ('1724', 'Oqoltin', '1724206'),
    ('1724', 'Sardoba', '1724226'),
    ('1724', 'Sayxunobod', '1724216'),
    ('1724', 'Shirin', '1724410'),
    ('1724', 'Sirdaryo', '1724231'),
    ('1724', 'Xovos', '1724235'),
    ('1724', 'Yangier', '1724413'),
    ('1727', 'Angren', '1727407'),
    ('1727', 'Bekobod', '1727220'),
    ('1727', 'Bo''ka', '1727228'),
    ('1727', 'Bo''stonliq', '1727224'),
    ('1727', 'Chinoz', '1727256'),
    ('1727', 'Chirchiq', '1727419'),
    ('1727', 'Ohangaron', '1727212'),
    ('1727', 'Olmaliq', '1727404'),
    ('1727', 'Oqqo''rg''on', '1727206'),
    ('1727', 'Parkent', '1727249'),
    ('1727', 'Piskent', '1727250'),
    ('1727', 'Qibray', '1727248'),
    ('1727', 'Quyichirchiq', '1727233'),
    ('1727', 'Yangiyo''l', '1727259'),
    ('1727', 'Yuqorichirchiq', '1727239'),
    ('1727', 'Zangiota', '1727237'),
    ('1730', 'Beshariq', '1730215'),
    ('1730', 'Bog''dod', '1730209'),
    ('1730', 'Buvayda', '1730212'),
    ('1730', 'Dang''ara', '1730236'),
    ('1730', 'Farg''ona', '1730233'),
    ('1730', 'Furqat', '1730238'),
    ('1730', 'Marg''ilon', '1730412'),
    ('1730', 'Oltiariq', '1730203'),
    ('1730', 'Qo''qon', '1730405'),
    ('1730', 'Quva', '1730218'),
    ('1730', 'Rishton', '1730224'),
    ('1730', 'So''x', '1730226'),
    ('1730', 'Toshloq', '1730227'),
    ('1730', 'Uchko''prik', '1730221'),
    ('1730', 'Yozyovon', '1730242'),
    ('1733', 'Bog''ot', '1733204'),
    ('1733', 'Gurlan', '1733208'),
    ('1733', 'Hazorasp', '1733220'),
    ('1733', 'Khiva', '1733226'),
    ('1733', 'Qo''shko''pir', '1733212'),
    ('1733', 'Shovot', '1733230'),
    ('1733', 'Urganch', '1733217'),
    ('1733', 'Yangiariq', '1733233'),
    ('1733', 'Yangibozor', '1733236'),
    ('1735', 'Amudaryo', '1735204'),
    ('1735', 'Beruniy', '1735207'),
    ('1735', 'Chimboy', '1735240'),
    ('1735', 'Ellikqal''a', '1735250'),
    ('1735', 'Kegeyli', '1735212'),
    ('1735', 'Mo''ynoq', '1735222'),
    ('1735', 'Nukus', '1735225'),
    ('1735', 'Qanliko''l', '1735218'),
    ('1735', 'Qo''ng''irot', '1735215'),
    ('1735', 'Qorao''zak', '1735211'),
    ('1735', 'Shumanay', '1735243'),
    ('1735', 'Taxtako''pir', '1735230'),
    ('1735', 'To''rtko''l', '1735233'),
    ('1735', 'Xo''jayli', '1735236')
      ),
      norm AS (
        SELECT
          s.sato,
          s.region_sato,
          -- Normallashtirish: kichik harf -> x/h tenglashtirish -> faqat
          -- harf va raqam qoldirish. Apostrofning barcha varianti shu oxirgi
          -- bosqichda birdek tushib ketadi.
          regexp_replace(replace(lower(s.district_name), 'x', 'h'), '[^a-z0-9]', '', 'g') AS key
        FROM source s
      ),
      target AS (
        SELECT
          d.id,
          regexp_replace(
            replace(
              regexp_replace(
                lower(d.name),
                '(tumani|shahri|shahar)', ' ', 'g'
              ),
              'x', 'h'
            ),
            '[^a-z0-9]', '', 'g'
          ) AS key,
          r.sato_code AS region_sato
        FROM district d
        JOIN region r ON r.id = d.region_id
        WHERE d.sato_code IS NULL
      )
      UPDATE district d
      SET sato_code = n.sato
      FROM target t
      JOIN norm n ON n.key = t.key AND n.region_sato = t.region_sato
      WHERE d.id = t.id
        AND d.sato_code IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM district x WHERE x.sato_code = n.sato
        );
    `);
  }

  public async down(): Promise<void> {
    /**
     * ATAYLAB BO'SH. Qaytarish uchun "qaysi kod shu migratsiya qo'ygan" degan
     * ma'lumot kerak, u esa saqlanmaydi. Kodlarni ommaviy tozalash esa
     * qo'lda kiritilganlarini ham o'chirib yuborardi — bu ma'lumot yo'qotish.
     */
  }
}
