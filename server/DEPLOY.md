# Deploy Procedure (Xavfsiz Deploy Tartibi)

> **Sabab:** 2026-04-02 da `synchronize: true` orqali ustun tipi o'zgarganda
> butun cashbox balanslari `0` ga tushib qolgan. Bu hujjat shu kabi
> incident takrorlanmasligi uchun.

---

## ❗ HAR DOIM AMAL QILING

1. **`synchronize: false`** — `app.module.ts:35` da hardcode qilingan.
   Hech qachon `true` qilmang. Schema o'zgarishi → faqat **migration**.
2. **`NODE_ENV=production`** — production .env da bo'lishi shart.
3. **`TYPEORM_SYNCHRONIZE` env hech qachon `true`** — server ko'tarilmaydi
   (`app.service.ts` da assert bor).

---

## 📋 Deploy oldidan (LOCAL/STAGING)

```bash
# 1. Lokal DB ga oxirgi prod backup tiklang yoki test ma'lumotlar bilan
# 2. Build & lint
npm run build

# 3. Migration ko'rib chiqish (qaysilari hali ishlamagan)
npm run migration:show

# 4. Cashbox invariant — DEPLOY OLDIDAN
npm run db:check-cashbox

# 5. Migrationni lokal/staging da sinab ko'ring
npm run migration:run

# 6. Yana cashbox tekshiruvi — DEPLOY KEYIN
npm run db:check-cashbox
```

Agar invariant farq ko'rsatsa — **deploy QILMANG**, sababini toping.

---

## 🚀 Production Deploy

```bash
# 1. ⚠️  AVTO BACKUP (AWS 7-kunlik backup ham bor, lekin lokal nusxa zarur)
npm run db:backup
# → server/backups/db-backup-YYYYMMDD-HHMMSS.sql.gz

# 2. Cashbox invariant — backup oldidan holatni saqlab qo'ying
npm run db:check-cashbox > backups/invariant-before-$(date +%Y%m%d-%H%M%S).log

# 3. Code deploy (git pull, install, build)
git pull
npm ci
npm run build

# 4. Migration ishga tushirish
npm run migration:run

# 5. App restart (pm2 yoki systemd)
pm2 restart beepost-server  # yoki sizning komanda

# 6. Cashbox invariant — keyin tekshiring
npm run db:check-cashbox
```

---

## 🔁 Rollback (xato bo'lsa)

```bash
# 1. Migration ni qaytaring
npm run migration:revert

# 2. Agar ma'lumot buzilgan bo'lsa — backupdan tiklang
gunzip -c backups/db-backup-YYYYMMDD-HHMMSS.sql.gz | psql "$DB_URL"

# 3. AWS backup oxirgi chora
```

---

## 📝 Yangi schema o'zgarish qo'shish

```bash
# Avtomatik migration generatsiya (entity o'zgartirgandan keyin)
npm run migration:generate --name=AddSomeColumn

# YOKI bo'sh migration faylini yaratish (qo'lda SQL yozish uchun)
npm run migration:create --name=ManualSqlChange
```

**Eslatma:** Pul/balans ustunlari **HAR DOIM `bigint` + `bigintTransformer`**
ishlatilishi kerak. `int` ishlatmang — overflow xavfli (max 2.14 mlrd).

---

## ✅ Deploy tekshirish ro'yxati (Checklist)

- [ ] `npm run db:backup` muvaffaqiyatli
- [ ] `npm run db:check-cashbox` farq yo'q (deploy oldidan)
- [ ] `npm run db:check-extra-cost` 7/7 invariant o'tdi
- [ ] `npm run build` xatosiz
- [ ] `npm run migration:run` xatosiz
- [ ] App qayta ishga tushdi
- [ ] `npm run db:check-cashbox` farq yo'q (deploy keyin)
- [ ] Manual smoke test: kassa kirim/chiqim qiling, balans to'g'ri

---

## 🧾 Qo'shimcha xarajat isbotlari — BIR MARTALIK INFRA

Kuryer qo'shimcha xarajat yozganda foto **isbot** biriktiradi. Bu fayl market
bilan kuryer o'rtasidagi **pul nizosining yagona dalili**, shuning uchun u
oddiy statik rasm kabi emas, backup qilinadigan ma'lumot sifatida
muomala qilinadi.

### 1. Papka (serverda bir marta)

```bash
sudo mkdir -p /var/beepost/uploads/extra-cost-proofs
sudo chown -R ubuntu:ubuntu /var/beepost/uploads
```

`.env` ga qo'shing:

```
UPLOAD_ROOT=/var/beepost/uploads
```

> ⚠️ **Deploy papkasidan TASHQARIDA bo'lishi shart.** Ilova papkasi ichida
> tursa, har `git pull` / `rsync --delete` / yangi relizda isbotlar o'chib
> ketadi.
>
> **Sozlanmagan bo'lsa nima bo'ladi.** Server ISHLAYVERADI (sayt o'chmaydi) —
> faqat ishga tushishda ogohlantirish beradi va **isbot yuklash rad etiladi**:
> kuryer aniq o'zbekcha xabar oladi, sotuvi esa "isbot keyin biriktiriladi"
> holatida yopilaveradi. Ya'ni sozlamaslikning narxi — funksiya ishlamaydi,
> lekin hech narsa yo'qolmaydi va hech narsa buzilmaydi.

### 2. nginx (kod emas, infra)

Isbot yuklash `multipart/form-data` bilan ketadi: **5 tagacha fayl, bitta
so'rovda**. Chegaralar (`proof-storage.const.ts`):

| Nima | Chegara |
|---|---|
| Bitta rasm | 8 MB (klientda 1280px gacha siqiladi, odatda ~300 KB) |
| Bitta video | **80 MB** (~35-45 s telefon videosi; serverda siqiladi) |
| **Bitta so'rovdagi JAMI** | **120 MB** |
| Fayl soni | 5 |

> **Jami byudjet nega alohida.** Faqat "bitta faylga 80 MB" qo'yilsa, 5 ta
> video 400 MB bo'lardi. Byudjet shuni anglatadi: bitta to'la video olinsa,
> qolganiga 40 MB joy qoladi va ikkinchi **to'la** video **sig'maydi**.

> **Bu QABUL chegarasi, saqlash chegarasi emas.** Video serverda `ffmpeg`
> bilan 720p/H.264 ga o'tkaziladi va odatda **2-5 MB** qoladi — pastdagi
> "ffmpeg" bo'limiga qarang.

Standart nginx chegarasi 1 MB, ya'ni **sozlanmasa yuklash 413 bilan
yiqiladi va xato xabari o'zbekcha bo'lmaydi** (nginx so'rovni Nest'gacha
yetkazmaydi).

`/api/` blokiga qo'shing:

```nginx
client_max_body_size   128m;  # jami byudjet 120 MB + multipart ortiqchasi
client_body_timeout    300s;  # sekin mobil internetda 120 MB uzoq ketadi
proxy_read_timeout     300s;
proxy_request_buffering off;  # katta faylni diskka buferlab o'tirmasin
```

### 2b. ffmpeg — VIDEO SIQISH (SHART)

```bash
sudo apt-get install -y ffmpeg
ffmpeg -version   # tekshirish
```

Video yuklangach **fonda** 720p/H.264 (CRF 28, audio 64 kbit/s mono) ga
o'tkaziladi. 80 MB lik telefon videosi odatda **2-5 MB** bo'lib qoladi,
asl fayl esa o'chiriladi.

| Holat | Nima bo'ladi |
|---|---|
| ffmpeg bor | video siqiladi, `transcode_status = done` |
| ffmpeg yo'q | **server ishlayveradi**, video ASL hajmda qoladi (`skipped`), logda ogohlantirish |
| ffmpeg yiqildi | **asl fayl joyida qoladi** (`failed`), isbot baribir ko'rinadi |

> **Nega yo'qligi fatal emas.** Siqish — diskni tejash, dalilning o'zi emas.
> `UPLOAD_ROOT` bilan bir xil printsip: sozlash kamchiligi saytni o'chirmaydi.

Boshqa yo'ldagi ffmpeg uchun `.env`: `FFMPEG_PATH=/usr/local/bin/ffmpeg`.

**Ishlayotganini tekshirish** (video yuklangandan ~1 daqiqa keyin):

```sql
SELECT transcode_status, COUNT(*),
       pg_size_pretty(SUM(original_size_bytes)::bigint) AS asl,
       pg_size_pretty(SUM(size_bytes)::bigint)          AS saqlangan
  FROM extra_cost_proof
 WHERE mime LIKE 'video/%'
 GROUP BY transcode_status;
```

`pending` uzoq turib qolsa — server qayta ishga tushgan bo'lishi mumkin;
har 10 daqiqada ishlaydigan CRON (`sweepPendingTranscodes`) ularni o'zi
qaytadan navbatga qo'yadi.

### 3. Backup

`npm run db:backup` endi **ikkita** arxiv yaratadi:

> ⚠️ **Video bilan disk o'sishi.** Faqat foto bo'lganda ~1.8 GB/oy edi.
> Serverda siqish qo'shilgach video ~2-5 MB bo'lib qoladi: kuniga 200
> isbotning 20% i video bo'lsa ~1.2 GB/oy, eng yomon holatda (hammasi
> video) ~30 GB/oy. **ffmpeg o'rnatilmasa bu raqamlar 10-15 barobar
> yuqori bo'ladi.** Isbot saqlash muddati (retention) hali YO'Q — bu
> **ochiq band**, pilotdan keyin hal qilinadi.

| Fayl | Mazmun | S3 kaliti |
|---|---|---|
| `db-backup-*.sql.gz` | `pg_dump` | `db-backups/` |
| `proofs-backup-*.tar.gz` | isbot fayllari | `proof-backups/` |

> `pg_dump` **yetarli emas**: bazada faqat faylga havola
> (`extra_cost_proof.rel_path`) turadi. Faqat DB tiklansa, yozuv bor-u
> **fayl yo'q** bo'ladi.

Tiklash:

```bash
tar -xzf proofs-backup-YYYYMMDD-HHMMSS.tar.gz -C /var/beepost/uploads
```

`UPLOAD_ROOT` o'rnatilmagan bo'lsa skript ogohlantirish beradi va isbotlarni
arxivlamaydi (DB backup baribir bajariladi).

### 4. Checklist qo'shimchasi

- [ ] `UPLOAD_ROOT` `.env` da bor va deploy papkasidan tashqarida
- [ ] `/var/beepost/uploads/extra-cost-proofs` mavjud va yoziladigan
- [ ] nginx `client_max_body_size` ≥ 128m
- [ ] `ffmpeg -version` ishlaydi (bo'lmasa video siqilmaydi, disk tez to'ladi)
- [ ] `npm run db:backup` ikkita arxiv yaratdi
- [ ] Arxivdan bitta fayl tiklanib, ochilishi tekshirildi

---

## 🧾 Qo'shimcha xarajat rekonsiliatsiyasi

```bash
npm run db:check-extra-cost
```

Yetti invariantni tekshiradi. Buzilsa **exit 1** va deploy to'xtaydi.

| # | Invariant | Buzilsa nima bo'lgan |
|---|---|---|
| I1 | Tasdiqlangan so'rovda ikkala kassa langari bor | Market «tasdiqladim» deb ko'rsatgan, kuryerga pul yozilmagan |
| I2 | So'rov summasi kassa yozuvlariga mos | So'rovda bir raqam, kassada boshqa — qaysi biri to'g'ri ekanini keyin aniqlab bo'lmaydi |
| I3 | Rad etilgan/bekor qilingan so'rov kassaga yozmagan | Market rad etgan pulni baribir to'lagan |
| I4 | Bir buyurtmada bitta ochiq so'rov | Bitta xarajat ikki marta tasdiqlanishi mumkin edi |
| I5 | Bir kassa yozuvi bitta so'rovga bog'langan | Bitta to'lov ikki so'rovni «to'langan» qilib ko'rsatgan |
| I6 | Market va kuryer chiqimlari simmetrik | Moliyaviy tarozi jimgina siljigan |
| I7 | Ochiq so'rov kassaga tegmagan | **Eng xavflisi** — rollback yo'qdan pul yaratadi |

> **I7 nega eng xavfli.** `reverseExtraCostForCashbox` idempotentlikni
> `SUM(EXTRA_COST) − SUM(CORRECTION)` net-hisobi bilan quradi. Tasdiqlanmagan
> xarajat kassaga tushsa, keyingi rollback hech qachon berilmagan pulni
> «qaytaradi».
