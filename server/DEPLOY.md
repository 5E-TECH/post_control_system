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
- [ ] `npm run build` xatosiz
- [ ] `npm run migration:run` xatosiz
- [ ] App qayta ishga tushdi
- [ ] `npm run db:check-cashbox` farq yo'q (deploy keyin)
- [ ] Manual smoke test: kassa kirim/chiqim qiling, balans to'g'ri
