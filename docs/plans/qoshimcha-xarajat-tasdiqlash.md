# YAKUNIY IMPLEMENTATSIYA REJASI — Qo'shimcha xarajat: isbot + market tasdig'i

<!-- Tuzilgan: 2026-09-15. 18 agentli tahlil (9 soha + 3 dizayn + 5 baho + sintez). -->

> **Mustaqil tekshirilgan faktlar** (rejaga tayanadigan eng muhim 6 da'vo qo'lda o'qib tasdiqlandi):
> 1. `partly-sold.dto.ts:44-49` — `totalPrice` da faqat `@Min(0)`, YUQORI CHEGARA YO'Q. `order.service.ts:3292` `const price = Number(totalPrice)`, dona esa faqat `totalNewQty < totalOldQty` bo'lsagina kamayadi (`:3311`) → **aylanma yo'l REAL**.
> 2. `generate-comment.ts:4` — 4-parametr `notes: string[] = []` allaqachon bor, fayl o'zgartirilmaydi.
> 3. `enums/index.ts:45` — `Source_type.EXTRA_COST` mavjud, `ALTER TYPE` kerak emas.
> 4. `users.entity.ts:50` — `external_provider` ustuni mavjud (Elchi/LDG ajratish uchun).
> 5. `cashbox-history.entity.ts:35,75` — `source_user_id` va `payment_date` ustunlari mavjud.
> 6. `order.service.ts:3700-3745` — `reverseExtraCostForCashbox` net-balans (`SUM(EXTRA_COST) − SUM(CORRECTION)`) bo'yicha ishlaydi → pending kassaga yozilmasa rollback xavfsiz.
>
> Frontend limit nomuvofiqligi ham tasdiqlandi: `all-orders/index.tsx:950` tariflar teng bo'lganda `Math.max(0, courierTariff)` ko'rsatadi, server esa `Math.floor(center/2)` (`extra-cost-limit.util.ts:61`) — kuryerga **2 barobar katta** maksimum ko'rinadi.


---

## ✅ QAROR QILINDI (2026-09-15, foydalanuvchi)

| # | Savol | QAROR | Rejaga ta'siri |
|---|---|---|---|
| 1 | Kuryer naqdni ushlab qoladimi? | **Kassaga TO'LIQ topshiradi**, tasdiqlangach hisobiga qaytariladi | Modal/banner matni: «Naqdni kassaga to'liq topshirasiz». Rad etilganda undirish mexanizmi KERAK EMAS |
| 4 | Qisman sotuv orqali narx pasaytirish | **Chegara + majburiy sabab/kategoriya + isbot + alohida audit tabi.** Pul kechiktirilmaydi | 5.5b bo'limi o'z holicha bajariladi. Butunlay taqiq YO'Q |
| 9 | Video isbot | **v1 da FAQAT FOTO.** Video — v2 | MIME oq ro'yxati: jpeg/png/webp/heic. Hajm 8 MB. nginx 12m yetarli |
| 5 | Bayroqni kim yoqadi / kim tasdiqlaydi | **Bayroqni FAQAT ADMIN yoqadi. Tasdiqlashni FAQAT MARKET roli qiladi** | ⚠️ Rejadan OLIB TASHLANADI: `PATCH user/market/settings/self` endpointi, market `/profile` sozlama kartasi, `extra_cost_operator_can_approve` ustuni va OPERATOR rolining tasdiqlash huquqi. Bayroq mavjud admin naqshi bilan (`PATCH user/market/:id` + `require_operator_phone` kartasi yonida) boshqariladi |

**Qolgan qarorlar tavsiya bo'yicha qabul qilinadi** (2, 3, 6, 7, 8, 10-13): kuryerga to'lov = kelgusi hisob-kitobda kamroq topshiradi · 7 kun eskalatsiya / 14 kun zaxira tasdiq · marketga to'lovda faqat ogohlantirish · admin arbitraji + 1 marta qayta yuborish · rad etilganini kuryer ko'taradi · isbot 12 oy saqlanadi · kunlik chegara = tarif × 3 · avto-tasdiq chegarasi default 0 (admin yoqadi) · pilot 1 market 1 hafta.

**Ustunlar soni 3 → 2 ga tushdi:** `extra_cost_proof_required` va `extra_cost_auto_approve_under` qoladi (ikkalasi ham admin tahrirlaydi), `extra_cost_operator_can_approve` olib tashlandi.

---
---

## ✅ BARCHA BOSQICHLAR BAJARILDI (2026-09-16)

**Holat:** 520 test PASS · server+client typecheck toza · ishlab chiqarish
fayllari lint toza · DI grafi to'liq · client build muvaffaqiyatli ·
rekonsiliatsiya 7/7 · **COMMIT QILINMAGAN**.

| Bosqich | Mazmun | Holat |
|---|---|---|
| 0 | Migration, 2 entity, 4 enum, market bayrog'i, admin UI | ✅ |
| 1 | `UPLOAD_ROOT`, path-traversal guard, backup arxivi, DEPLOY.md | ✅ |
| 2 | Yagona applier, siyosat util, yashirin chegirma darvozasi | ✅ |
| 3 | Isbot yuklash (magic-byte, sha256), himoyalangan ko'rish, orfan CRON | ✅ |
| 4 | Kechiktirish rejimi, so'rov yozuvi, rollback ilgaklari | ✅ |
| 5 | Tasdiqlash/rad etish/bulk/arbitraj, atomik pul, 7 invariant + CI | ✅ |
| 6 | 3 modal, market va kuryer sahifalari, kassa kartasi, banner, marshrutlar | ✅ |
| 7 | Marketga Telegram xabari, eskalatsiya + zaxira tasdiq CRON | ✅ |

### Haqiqiy bazada isbotlangan
- Migration `up` → `down` → qayta `up`: kassa balansi va `cashbox_history`
  soni **bayt-ma-bayt o'zgarmadi** (39 553 000 / 32 / 686)
- Backup → tiklash: 3 fayl, sha256 mos
- Tasdiqlash: ikkala kassadan aynan 12 345 ayirildi, `balance_after` DB
  qiymatiga teng, `payment_date` O'zbekiston sanasi (`2026-09-16`, UTC emas)
- 7/7 rekonsiliatsiya invarianti

### v1 ga KIRMAGAN (ataylab)
- **Qayta yuborish** (`resubmit`) — sxemada ustun bor, lekin oqim yozilmagan.
  O'rniga admin arbitraji (`admin-resolve`) ishlaydi.
- **Video isbot** — qaror №9 bo'yicha v2 ga.
- **Menyu badge** — market sahifasi 30 soniyada o'zi yangilanadi.
- **Kassir ekranlaridagi ogohlantirish** (`paymentsFromCourier` /
  `paymentsToMarket`) — kuryer kassasida ko'rsatkich bor, kassir tomonida yo'q.

### ⚠️ DEPLOY OLDIDAN SHART
1. `UPLOAD_ROOT=/var/beepost/uploads` `.env` ga qo'shilsin va papka yaratilsin
   (aks holda isbot yuklash rad etiladi — sayt ishlaydi, lekin funksiya yo'q)
2. nginx: `client_max_body_size 26m` + `client_body_timeout 120s`
3. `npm run db:backup && npm run migration:run`
4. `npm run db:check-extra-cost` — 7/7 o'tishi shart
5. Pilot: **bitta market**, 1 hafta (bayroq default `false`, admin yoqadi)

---

## 📦 BOSQICHMA-BOSQICH TAFSILOT (2026-09-16)

### Bosqich 0 — Poydevor ✅
Migration `1749700000000-ExtraCostApproval` (2 jadval + `users` ga 2 ustun + 11 indeks),
2 entity, 4 enum, `UpdateMarketDto` + `logExtraCostSettingChange`, admin UI kartasi.
**Isbotlandi:** migration `up`/`down`/qayta-`up` haqiqiy bazada, kassa balansi va
`cashbox_history` soni bayt-ma-bayt o'zgarmadi (39 553 000 / 32 / 686).

### Bosqich 1 — Infra ✅
`proof-storage.const.ts` (mutlaq `UPLOAD_ROOT`, path-traversal guard, MIME oq ro'yxati),
boot guard, `db-backup.sh` ga isbot arxivi, `toUzbekistanDateString`, DEPLOY.md.
**Isbotlandi:** backup → tiklash bayt-ma-bayt (3 fayl, sha256 mos).

### Bosqich 2 — Yagona applier + aylanma yo'l ✅
`ExtraCostApplierService` (uch nusxa → bitta), `extra-cost-policy.util.ts`,
yashirin chegirma darvozasi, `Math.trunc` + `@IsInt`, sotuv/qisman sotuv
activity-logiga `extra_cost`.

### ⚠️ ADVERSARIAL TEKSHIRUV — 41 topilma, 3 ta JIDDIY xato tuzatildi

| # | Xato | Oqibati | Tuzatish |
|---|---|---|---|
| 1 | **DashboardModule `OrderService` ni qayta provider qiladi** | Yangi konstruktor bog'liqligi → `Nest can't resolve dependencies` → **server umuman ko'tarilmaydi**. `tsc` ham, 443 test ham buni ko'rmaydi | `ExtraCostModule` import qilindi + `order-service-di.spec.ts` doimiy qulfi (rekursiv skaner, so'z-chegarasi bilan) |
| 2 | **`deferred` shoxi hech qayerga ulanmagan** | Admin bayroqni yoqsa: pul kassaga ham, so'rov jadvaliga ham yozilmaydi — **kuryer pulini jimgina yo'qotadi**, buyurtma izohida esa "ushlab qolingan" deb turadi | `EXTRA_COST_APPROVAL_FLOW_READY = false` — Bosqich 4 gacha `deferred` YETIB BO'LMAYDI. Test barcha kirishlar bo'ylab qulflaydi |
| 3 | **Yashirin chegirma darvozasi qonuniy oqimni bloklaydi** | `sellExtraCostLimit` uyga yetkazishda HAR QANDAY summani taqiqlaydi → mijoz bilan narx kelishilgan har bir uyga yetkazish rad etilardi. Loyiha esa «Buyurtma arzonroqqa sotildi!» ni ATAYLAB qo'llab-quvvatlaydi | Darvoza siyosat orqali o'tkazildi (market bayrog'iga bog'liq, bayroq o'chiqda 0% o'zgarish); `sellExtraCostLimit` chegirmaga QO'LLANMAYDI; `price-cut-gate.spec.ts` ikkala tuzoqni qulfladi |

Qo'shimcha tuzatishlar: boot guard endi prod'da serverni o'ldirmaydi (`PROOF_UPLOAD_ENABLED`
bilan bosqichma-bosqich qat'iylashadi); `tar` ning "file changed" ogohlantirishi butun
backup'ni yiqitmaydi (exit 1 = ogohlantirish, ≥2 = xato); `quantity` satr/manfiy
koersiyasi (darvoza aynan shu yig'indiga tayanadi).

**Holat:** 456 test PASS · typecheck toza · lint toza · DI grafi to'liq kompilyatsiya.

---

> Asos: **Taklif 1** (kechiktirilgan EXTRA_COST — pul yo'li o'zgarmaydi, faqat kechikadi).
> Qo'shilgan: Taklif 2 dan **yagona applier + policy + resubmit + audit qatori**, Taklif 3 dan **`reversed` statusi + rekonsiliatsiya darvozasi + `payment_date` + mutlaq `UPLOAD_ROOT`**.
> Uchala tanqidchi topgan **4 ta blocker** yopildi (quyida har biri alohida belgilangan).

---

## 1. Muammo va yechim qisqacha

Hozir kuryer buyurtmani sotganda/bekor qilganda `extraCost` yozadi va u **darhol** market kassasidan chiqim, kuryer kassasidan chiqim sifatida yoziladi (`order.service.ts:2786-2803`, `:3019-3049`, `:3487-3508`). Market bu pulni ko'rmaydi, tasdiqlamaydi — shikoyat aynan shundan. Yechim: har-market `extra_cost_proof_required` bayrog'i; yoqilgan bo'lsa xarajat pulini **kassaga umuman yozmaymiz**, balki yangi `extra_cost_request` jadvaliga foto isbot bilan `pending` qator yozamiz; market tasdiqlaganda AYNAN hozirgi ikki `EXTRA_COST` kassa yozuvi yaratiladi. Bu xavfsiz, chunki `extraCost` moliyaviy tarozi uchun neytral (`main + Σcourier − Σmarket` formulasida `(−X)−(−X)=0`, `financial-balance.util.ts:32`) va MAIN kassaga hech qachon tegmaydi, ya'ni smena/karta invariantlari buzilmaydi.

Kritik jihat: **pending holat `cashbox_history`ga BIR QATOR HAM yozilmasligi shart** — `reverseExtraCostForCashbox` (`order.service.ts:3700-3745`) idempotentlikni `SUM(EXTRA_COST expense) − SUM(CORRECTION income)` net-hisobi bilan quradi; pending u yerga tushsa rollback yo'qdan pul yaratadi.

Tanqidchilar topgan eng katta teshik — **kodda tasdiqlandi**: kuryer `extraCost` o'rniga `POST order/partly-sell/:id` ga mahsulot sonini o'zgartirmasdan pasaytirilgan `totalPrice` yuborsa (`partly-sold.dto.ts:44-49` da faqat `@Min(0)`, yuqori chegara YO'Q; `order.service.ts:3292` `const price = Number(totalPrice)`), AYNAN o'sha pul natijasiga chegarasiz, isbotsiz, tasdiqsiz erishadi. Bu yopilmasa butun ish bir `if` bilan aylanib o'tiladi — shuning uchun reja bu yo'lni ham qamraydi.

Ikkinchi kritik jihat: kuryer xarajat pulini mijoz naqdidan **jismonan ushlab qoladi**, shuning uchun "kassaga yozmaymiz" qarori kassa stolida kuryer kamomadiga aylanadi (`paymentsFromCourier` summani DTO'dan oladi, `cash-box.service.ts:1174`). Reja buni UI (kutilayotgan summa ko'rsatkichi) + aniq biznes qarori bilan yopadi.

v1 da **faqat FOTO** (video 2-relizga) — bu nginx `client_max_body_size`, disk o'sishi va backup xavflarining katta qismini bir qarorda yo'q qiladi.

---

## 2. Ma'lumot modeli

### 2.1 `users` jadvaliga 3 ta ustun (har-market sozlamasi)

Naqsh: `require_operator_phone` (`users.entity.ts:119-120`). Barchasi **additiv**, DEFAULT qiymatlar mavjud xulqni 0% o'zgartirmaydi.

| Ustun | Tur | Default | Izoh |
|---|---|---|---|
| `extra_cost_proof_required` | `boolean NOT NULL` | `false` | Asosiy bayroq: isbot + tasdiq majburiy |
| `extra_cost_auto_approve_under` | `bigint NOT NULL` | `0` | Shu summadan kichik so'rovlar avtomatik tasdiqlanadi (0 = o'chiq). Marketning kunlik ish yukini keskin kamaytiradi |
| `extra_cost_operator_can_approve` | `boolean NOT NULL` | `false` | Market operatoriga tasdiqlash huquqi (amalda egasi panelga kamdan-kam kiradi) |

### 2.2 Yangi jadval: `extra_cost_request` (ECR)

`extends BaseEntity` → `id uuid PK DEFAULT gen_random_uuid()`, `created_at`/`updated_at` **bigint epoch ms** + `bigintTransformerNonNull` (`BaseEntity.ts:12-26`).

| Ustun | Tur | Transformer / Izoh |
|---|---|---|
| `order_id` | `uuid NOT NULL` FK `order(id)` **ON DELETE RESTRICT** | Buyurtma soft-delete qilinadi (`order.service.ts:5096`), CASCADE hech qachon ishlamaydi — RESTRICT kelajakdagi hard-delete'dan himoya |
| `post_id` | `uuid NULL` | Qaysi reys — qayta jo'natishda ajratish |
| `courier_id` | `uuid NOT NULL` FK `users(id)` | So'rovchi / pul oluvchi |
| `market_id` | `uuid NOT NULL` FK `users(id)` | Tasdiqlovchi. So'rov paytida `order.user_id` dan **SNAPSHOT** |
| `action_type` | enum `sell` \| `cancel` \| `partly_sold` \| `price_cut` NOT NULL | `price_cut` = yashirin chegirma (aylanma yo'l auditi) |
| `amount` | `bigint NOT NULL` + `CHECK ("amount" > 0)` | `bigintTransformerNonNull`. **`Math.trunc()` servisda**, DTO'da `@IsInt()` |
| `limit_max` | `bigint NOT NULL DEFAULT 0` | So'rov paytidagi `sellExtraCostLimit`/`cancelExtraCostLimit` natijasi SNAPSHOT'i — tarif keyin o'zgarsa tasdiq buzilmasin |
| `courier_tariff_snapshot` | `bigint NOT NULL DEFAULT 0` | Nizo/audit uchun |
| `order_number` | `bigint NOT NULL` | **Denormalizatsiya** — market sahifasi `GET order/:id` ga tegmasin (u market egaligini tekshirmaydi, `order.service.ts:1140` faqat kuryerni tekshiradi = mavjud IDOR) |
| `order_total_price` | `bigint NOT NULL DEFAULT 0` | Karta konteksti |
| `where_deliver` | `varchar NULL` | `center`/`home` — market qaror uchun ko'radi |
| `district_name` | `varchar NULL` | Konteks: qayerga borgan |
| `order_action_at` | `bigint NOT NULL` | Sotuv/bekor bo'lgan payt → tasdiqda `cashbox_history.payment_date` ga yoziladi |
| `category` | enum `taxi` \| `lift` \| `loading` \| `revisit` \| `customer_request` \| `other` NOT NULL | **MAJBURIY** — marketga qaror uchun eng kerakli maydon |
| `reason` | `text NULL` | `category='other'` bo'lsa **majburiy** (servis darajasida) |
| `proof_ids` | `jsonb NOT NULL DEFAULT '[]'::jsonb` | `extra_cost_proof.id` massivi (uuid). Xom fayl nomi/URL bu yerda ham, DTO'da ham CHIQMAYDI |
| `status` | enum `awaiting_proof` \| `pending` \| `approved` \| `rejected` \| `void` \| `reversed` NOT NULL DEFAULT `pending` | 3-bo'limga qarang |
| `decision_mode` | enum `market` \| `operator` \| `admin_override` \| `auto_rule` \| `auto_backstop` \| `external_auto` \| `system_void` NULL | Kelajakdagi qoidalar uchun yagona kengaytirish nuqtasi |
| `reviewed_by` | `uuid NULL` FK `users(id)` ON DELETE SET NULL | |
| `reviewed_at` | `bigint NULL` | ⚠️ **null-saqlovchi `bigintTransformer`** (`bigint.transformer.ts:12`). `bigintTransformerNonNull` bu yerda LDG `mismatch_at=0` xatosini takrorlaydi |
| `review_note` | `text NULL` | Rad etish sababi — rad etishda **majburiy** |
| `settled_at` | `bigint NULL` | `bigintTransformer`. Pul kassaga qachon tushdi |
| `market_history_id` | `uuid NULL` FK `cashbox_history(id)` ON DELETE SET NULL | Idempotentlik langari |
| `courier_history_id` | `uuid NULL` FK `cashbox_history(id)` ON DELETE SET NULL | Idempotentlik langari |
| `escalated_at` | `bigint NULL` | `bigintTransformer`. TTL o'tdi → admin navbati |
| `voided_at` | `bigint NULL` | `bigintTransformer` |
| `seen_by_courier_at` | `bigint NULL` | `bigintTransformer`. Kuryer qarorni ko'rdimi (banner uchun) |
| `resubmit_of` | `uuid NULL` FK `extra_cost_request(id)` ON DELETE SET NULL | Qayta yuborish zanjiri |
| `dup_proof_count` | `int NOT NULL DEFAULT 0` | Shu isbot (sha256) yana nechta so'rovda ishlatilgan — market kartasida qizil signal |

### 2.3 Yangi jadval: `extra_cost_proof` (isbot fayllari)

Alohida jadval kerak, chunki fayl **so'rovdan OLDIN** yuklanadi va orfan fayllarni tozalash kerak.

| Ustun | Tur | Izoh |
|---|---|---|
| `id` | `uuid PK gen_random_uuid()` | Bu id klientga qaytadi; fayl nomi HECH QACHON chiqmaydi |
| `created_at`/`updated_at` | `bigint NOT NULL` | BaseEntity |
| `courier_id` | `uuid NOT NULL` FK `users(id)` | Egalik |
| `stored_name` | `varchar NOT NULL` | Diskdagi nom: `randomUUID() + oq-ro'yxatdan-olingan-kengaytma` |
| `rel_path` | `varchar NOT NULL` | `PROOF_DIR` ga nisbatan: `YYYY/MM/<stored_name>` |
| `mime` | `varchar NOT NULL` | **Serverda aniqlangan** (magic-byte), klient MIME'ga ishonilmaydi |
| `size_bytes` | `int NOT NULL` | |
| `sha256` | `char(64) NOT NULL` | Dublikat aniqlash |
| `request_id` | `uuid NULL` FK `extra_cost_request(id)` ON DELETE SET NULL | `NULL` = hali bog'lanmagan |
| `bound_at` | `bigint NULL` | `bigintTransformer`. Bog'langan payt |

### 2.4 Indekslar

```sql
-- Bir buyurtmada bir vaqtda faqat BITTA ochiq so'rov (poyga DB darajasida to'siladi)
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ECR_ORDER_OPEN"
  ON "extra_cost_request" ("order_id")
  WHERE "status" IN ('awaiting_proof','pending');

-- Bitta kassa yozuvi ikki so'rovga bog'lanmasin (ikkinchi devor)
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ECR_MARKET_HIST"
  ON "extra_cost_request" ("market_history_id")  WHERE "market_history_id"  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ECR_COURIER_HIST"
  ON "extra_cost_request" ("courier_history_id") WHERE "courier_history_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_ECR_MARKET_STATUS"  ON "extra_cost_request" ("market_id","status","created_at");
CREATE INDEX IF NOT EXISTS "IDX_ECR_COURIER_STATUS" ON "extra_cost_request" ("courier_id","status","created_at");
CREATE INDEX IF NOT EXISTS "IDX_ECR_ORDER"          ON "extra_cost_request" ("order_id");
CREATE INDEX IF NOT EXISTS "IDX_ECR_ESCALATED"      ON "extra_cost_request" ("escalated_at") WHERE "escalated_at" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_ECP_COURIER_HASH"   ON "extra_cost_proof" ("courier_id","sha256");
CREATE INDEX IF NOT EXISTS "IDX_ECP_UNBOUND"        ON "extra_cost_proof" ("created_at") WHERE "request_id" IS NULL;
```

Partial-unique naqshi repoda bor: `1748000000000-OrderReplacement.ts:64`.

### 2.5 Migration

**Fayl:** `server/src/migrations/1749700000000-ExtraCostApproval.ts`, klass `ExtraCostApproval1749700000000`.
(Oxirgi mavjud — `1749600004000-ElchiRealMoneyFields.ts`; `1749700000000` Elchi blokidan tashqarida, parallel branch to'qnashuvi bo'lmasin.)

Mazmuni: (1) `users` ga 3 ustun `ADD COLUMN IF NOT EXISTS`; (2) 3 enum turi `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;`; (3) `CREATE TABLE IF NOT EXISTS extra_cost_request` + FK'lar; (4) `CREATE TABLE IF NOT EXISTS extra_cost_proof`; (5) indekslar. To'liq `down()`.

`gen_random_uuid()` ishlatiladi (`uuid_generate_v4()` EMAS — `CREATE EXTENSION "uuid-ossp"` repo migrationlarida hech qayerda yo'q).
**`Source_type.EXTRA_COST` allaqachon mavjud** (`enums/index.ts:45`) → `cashbox_history_source_type_enum` ga `ALTER TYPE` KERAK EMAS.
Kassa balansiga tegmaydi → CI `db:check-cashbox --compare` darvozasi (`deploy.yml:172`) muammosiz o'tadi.

---

## 3. Status mashinasi

```
                        isbot 24 soatda biriktirildi
   awaiting_proof ──────────────────────────────────────▶ pending
   (tarmoq uzilgan,      │
    sotuv YIQILMADI)     └── 24 soat o'tdi (CRON) ──────▶ void

                    ┌── market/operator TASDIQLADI ─────▶ approved ──rollback──▶ reversed
                    │        (pul kassaga yoziladi)                   (pul qaytarildi)
                    │
   pending ─────────┼── market/operator RAD ETDI ───────▶ rejected
   (pul kassada     │        (kassaga 0 yozuv)               │
    YO'Q)           │                                        └─ resubmit ─▶ YANGI pending qator
                    │                                           (eng ko'pi 1 marta)
                    ├── summa < auto_approve_under ─────▶ approved (decision_mode='auto_rule')
                    │
                    ├── rollback / qayta jo'natish /
                    │   kuryer almashtirildi ───────────▶ void
                    │
                    └── TTL(7 kun) → escalated_at qo'yiladi (STATUS O'ZGARMAYDI)
                              │
                              ├── admin force_approve ──▶ approved (decision_mode='admin_override')
                              ├── admin force_reject ───▶ rejected (decision_mode='admin_override')
                              └── +7 kun hech kim tegmadi (jami 14) ─▶ approved
                                                  (decision_mode='auto_backstop', ovozli log)
```

**YAKUNIY holatlar:** `approved` (faqat `reversed` ga o'tadi), `rejected`, `void`, `reversed`.
**Yagona idempotentlik nuqtasi:** `UPDATE extra_cost_request SET status='approved' ... WHERE id=$1 AND status='pending'` → `affected === 0` bo'lsa **409** va pul yozilmaydi (naqsh: `processOrderAction`, `order-bot.service.ts:611-628`).

---

## 4. Pul oqimi

### 4.1 Bayroq **O'CHIQ** market (bugungi 100% xulq — o'zgarmaydi)

| Hodisa | Kassa | Yo'nalish | `cashbox_history` yozuvi |
|---|---|---|---|
| Sotuv/bekor/qisman sotuv, `extraCost > 0` | `FOR_MARKET` (market) | `balance −= X` | `EXPENSE`, `source_type=extra_cost`, `source_id=order.id` |
| ″ | `FOR_COURIER` (kuryer) | `balance −= X` | `EXPENSE`, `source_type=extra_cost`, `source_id=order.id` |
| ″ | — | — | **Qo'shimcha:** commit'dan KEYIN, `try/catch` ichida ECR audit qatori (`approved` + `auto_rule`) — pulga ta'sir NOL |

Semantika: market kassasi = pochta marketga qarzi (kamayadi = market to'laydi). Kuryer kassasi = kuryer pochtaga qarzi (kamayadi = kuryer naqdni o'zida qoldiradi = kuryerga to'lov). Tarozi ta'siri: `(−X) − (−X) = 0` → `financial_balance_history`ga **YOZILMAYDI** (hozirgi holat saqlanadi).

### 4.2 Bayroq **YOQIQ** market

| # | Hodisa | Market kassasi | Kuryer kassasi | MAIN kassa | `cashbox_history` | ECR |
|---|---|---|---|---|---|---|
| 1 | Kuryer sotadi/bekor qiladi, isbot bor | **tegilmaydi** | **tegilmaydi** | — | **0 qator** | `pending` yaratiladi (SHU tranzaksiyada) |
| 2 | Kuryer sotadi, isbot yuklanmadi (tarmoq) | tegilmaydi | tegilmaydi | — | 0 qator | `awaiting_proof` (24 soat) |
| 3 | Market **tasdiqlaydi** | `balance −= X` (atomik SQL) | `balance −= X` (atomik SQL) | — | 2 qator `EXPENSE`/`extra_cost`, `source_id=order.id`, `payment_date = order_action_at` | `approved`, `settled_at`, `*_history_id` |
| 4 | Market **rad etadi** | tegilmaydi | tegilmaydi | — | **0 qator** (⚠️ `CORRECTION+INCOME` HECH QACHON yozilmaydi — u juftlik faqat `reverseExtraCostForCashbox` uchun band) | `rejected` + `review_note` |
| 5 | Summa `auto_approve_under` dan kichik | 3-qator bilan bir xil | ″ | — | ″ | `approved` + `auto_rule` |
| 6 | Rollback, ECR `pending` | tegilmaydi | tegilmaydi | — | 0 qator | `void` |
| 7 | Rollback, ECR `approved` | `+X` (mavjud `reverseExtraCostForCashbox`) | `+X` | — | `CORRECTION`/`INCOME` × 2 (mavjud kod) | `approved → reversed` |
| 8 | Elchi/LDG yetkazdi (tashqi aktor) | `−X` **darhol** | `−X` **darhol** | — | 2 qator `extra_cost` | `approved` + `external_auto` (audit) |

**Sana:** `cashbox_history.created_at` = **tasdiq vaqti** (hisobot davri shu bo'yicha: `cash-box.service.ts:1029-1032`); `payment_date` = **buyurtma sanasi**.
⚠️ **Halol ogohlantirish:** `payment_date` butun hisobot mantiqida WHERE/ORDER BY da **ishlatilmaydi** — u faqat ekranda ko'rsatish uchun. Ya'ni hisobotda xarajat baribir tasdiq kunida chiqadi. Bu qabul qilingan narx; market va kuryer sahifalarida **ikkala sana ham** ko'rsatiladi.

**Smena:** `closeShift` faqat `cashbox_id = mainCashbox.id` yozuvlarini sanaydi (`cash-box.service.ts:4046-4053`), `EXTRA_COST` esa MAIN'ga hech qachon yozilmaydi → smenaga ta'sir NOL, `requireOpenShift()` CHAQIRILMAYDI, market kechqurun/smena yopiq paytda ham tasdiqlay oladi. `applyCardDelta` invarianti (`SUM(card)==balance_card`) ham tegilmaydi.

---

## 5. Backend o'zgarishlari

### 5.1 Yangi fayllar

| Fayl | Mazmun |
|---|---|
| `src/migrations/1749700000000-ExtraCostApproval.ts` | 2.5-bo'lim |
| `src/core/entity/extra-cost-request.entity.ts` | 2.2. Nullable bigint'larga **`bigintTransformer`**, `amount`/`limit_max`/`order_action_at` ga `bigintTransformerNonNull`. Barcha ustunlar snake_case (`isDeleted` tuzog'i takrorlanmasin). Yozish **faqat `manager.save()`** — `insert()`/QueryBuilder `@BeforeInsert` ni chaqirmaydi va `created_at=0` yozadi |
| `src/core/entity/extra-cost-proof.entity.ts` | 2.3 |
| `src/api/order/utils/extra-cost-policy.util.ts` | `resolveExtraCostPolicy({amount, market, courier, actionType})` → `{mode:'immediate'\|'deferred', requireProof, decisionMode}`. Qoida tartibi: `amount<=0` → chiqish (**LDG `extraCost:0` va bulk butunlay xavfsiz qoladi**); `courier.external_provider != null` → `immediate` + `external_auto`; `market.extra_cost_proof_required !== true` → `immediate` + `auto_rule`; aks holda `deferred`. **Kelajakdagi barcha qoidalar FAQAT shu faylga tushadi** |
| `src/api/extra-cost/extra-cost.module.ts` | `TypeOrmModule.forFeature([ExtraCostRequestEntity, ExtraCostProofEntity, CashEntity, CashboxHistoryEntity, OrderEntity, UserEntity])`, `exports: [ExtraCostService, ExtraCostApplierService]` |
| `src/api/extra-cost/extra-cost-applier.service.ts` | **Pul yozuvchi YAGONA funksiya** — 5.3 |
| `src/api/extra-cost/extra-cost.service.ts` | create / approve / reject / resubmit / list / void / escalate |
| `src/api/extra-cost/extra-cost.controller.ts` | 5.4 |
| `src/api/extra-cost/extra-cost.cron.ts` | 5.6 |
| `src/api/extra-cost/proof-storage.const.ts` | **`PROOF_DIR = path.resolve(process.env.UPLOAD_ROOT ?? '/var/beepost/uploads', 'extra-cost-proofs')`** — yuklash VA o'chirish yo'li BITTA konstantadan (mavjud `product.service.ts:343` xatosi takrorlanmasin) |
| `server/scripts/check-extra-cost.ts` | 5.7 rekonsiliatsiya |

### 5.2 Mavjud fayllarga o'zgarishlar

| Fayl / joy | Nima qilinadi |
|---|---|
| `src/core/entity/users.entity.ts:119` yoniga | 3 ta yangi ustun (`@Column({type:'boolean', default:false})` / `bigint` + `bigintTransformerNonNull`) |
| `src/api/users/dto/update-market.dto.ts` | 3 ta yangi ixtiyoriy maydon. **Bu qatorsiz `PATCH user/market/:id` 422 beradi** (`app.service.ts:127` `forbidNonWhitelisted`) |
| `src/api/users/users.controller.ts` | **YANGI:** `@Patch('market/settings/self')`, `@AcceptRoles(Roles.MARKET)`, `MarketSelfSettingsDto` (faqat shu 3 bayroq). Market id **tokendan**, param YO'Q. Sabab: talab №1 «market sozlamasida» — hozirgi `PATCH user/market/:id` faqat ADMIN/SUPERADMIN (`:874`), `UpdateSelfDto` esa 8 ta rolga ochiq (`:888-902`) va u yerga market bayrog'ini qo'shish boshqa rollarga ham yo'l ochadi |
| `src/api/users/users.service.ts` | `marketSelfSettings(user, dto)` + activity-log (bayroq o'zgarishi loglansin) |
| `src/api/order/dto/sellCancel-order.dto.ts`<br>`src/api/order/dto/partly-sold.dto.ts` | `@IsOptional() @IsArray() @IsUUID('4',{each:true}) @ArrayMaxSize(3) extra_cost_proof_ids?: string[]`;<br>`@IsOptional() @IsEnum(ExtraCostCategory) extra_cost_category?: ...`;<br>`@IsOptional() @IsBoolean() extra_cost_proof_deferred?: boolean`;<br>`extraCost` ga `@IsInt()` qo'shiladi (hozir `@IsNumber()` kasrga ruxsat beradi va `5000.5` bigint INSERT xatosi berib **butun sotuvni rollback qiladi**) |
| `src/api/order/dto/bulk-order-action.dto.ts` | **TEGILMAYDI** — `extraCost` maydoni yo'q (`:15` izohi ataylab), bulk orqali aylanib o'tish yo'li mavjud emas |
| `order.service.ts:2763-2804` (`sellOrder`) | `extraCost` bloki `settleExtraCost(...)` chaqiruviga almashtiriladi. `sellExtraCostLimit` + `assertExtraCostWithinLimit` (`:2773-2785`) **o'z o'rnida qoladi**, natija `limitMax` sifatida uzatiladi |
| `order.service.ts:2598` (`finalComment`) | `generateComment(order.comment, dto.comment, deferred ? 0 : extraCost, deferred ? ['Qo'shimcha xarajat N so'm — market tasdig'iga yuborildi'] : [])`. **`generate-comment.ts` O'ZGARTIRILMAYDI** — 4-parametr `notes: string[] = []` allaqachon mavjud (`:4`, `!!! ${note}` formatida chiqaradi, tekshirildi) |
| `order.service.ts:2989-3049` (`cancelOrder`) | Qo'lda yozilgan 45 qatorlik kassa bloki butunlay `settleExtraCost(...)` ga almashtiriladi (`market` va `courier` allaqachon `:2961-2966` da yuklangan). Inline chegara tekshiruvi (`:2998-3003`) `assertExtraCostWithinLimit(extraCost, cancelExtraCostLimit({courierTariff}))` ga birlashtiriladi — hozir u yagona util'dan ajralib chiqqan |
| `order.service.ts:3483-3508` (`partlySold`) | `settleExtraCost(...)`. So'rov **faqat OTA** buyurtmaga bog'lanadi (`source_id=order.id`, `:3494`); ajralib chiqadigan CANCELLED bola (`:3567-3581`) hech qanday kassa yozuvi olmaydi |
| **`order.service.ts:3316-3340` (`partlySold`) — AYLANMA YO'L TO'SIG'I** | **BLOCKER FIX.** `oldTotalPrice` (`:3220`) va `price` (`:3292`) mavjud; `totalOldQty`/`totalNewQty` (`:3306-3311`) mavjud. Yangi mantiq: `const hiddenCut = (totalNewQty === totalOldQty) ? Math.max(0, oldTotalPrice − price) : 0;` — 5.5-bo'limga qarang |
| `order.service.ts:3841+` (`rollbackOrderToWaiting`) | Lock va egalikdan KEYIN, **kassa bloklaridan OLDIN**: `voidOpenRequests(qr, order.id, 'Buyurtma orqaga qaytarildi')`. ⚠️ Tartib muhokamasiz: agar void `reverseExtraCostForCashbox` dan KEYIN qo'yilsa, commit qilinmagan approve bilan poyga oynasi ochiladi (reverse hali ko'rinmagan `EXTRA_COST` qatorlarini ko'rmaydi → `net=0`, keyin void 0 affected qaytaradi → **pul yozilgan, lekin qaytarilmagan**). Void avval bo'lsa, ECR satri erta lock'lanadi va approve darvozasi `void` ni ko'rib 409 beradi.<br>Kassa bloklaridan **KEYIN** esa: `markReversed(qr, order.id)` — `approved → reversed` (uchala shoxda: `:3975`, `:4033`, `:4058`) |
| `order.service.ts:3768` (`mergePartialChildrenBack`) | Bola order'lar bo'yicha ham `voidOpenRequests` |
| Qayta jo'natish / kuryer almashtirish oqimi (`post` o'zgarishi) | `voidOpenRequests(..., 'Buyurtma boshqa reysga/kuryerga o'tkazildi')` — aks holda `UQ_ECR_ORDER_OPEN` yangi kuryerning sotuvini **500 bilan yiqitadi** |
| `order.service.ts:2836` va `:3646` (activity-log) | `new_value` ga `extra_cost` qo'shiladi. Hozir u faqat bekor qilish logida bor (`:3122`) — aynan shu foydalanuvchi shikoyat qilayotgan kuzatuvni imkonsiz qilgan (2 qatorlik bepul g'alaba) |
| `src/api/cash-box/cash-box.service.ts` — `myCashbox` / `getCashboxByUserId` | Javobga `pending_extra_cost: number` (`SUM(amount) WHERE courier_id=? AND status IN ('awaiting_proof','pending')`) |
| `src/api/cash-box/cash-box.service.ts:1137` (`paymentsFromCourier`) | Javob/DTO'ga tegilmaydi, LEKIN yangi `GET cash-box/courier/:id/pending-extra-cost` endpointi — **kassir ekrani** uchun |
| `src/api/cash-box/cash-box.service.ts:1395` (`paymentsToMarket`) | To'lovdan oldin `SUM(pending)` hisoblanadi va javobga `pending_extra_cost_warning` qo'shiladi (kassir ekranida ogohlantirish). **Qattiq cheklov v1 da YO'Q** — qonuniy to'lovni bloklab qo'ymaslik uchun (biznes qarori №6) |
| `src/api/app.module.ts` | `ExtraCostModule` |
| `src/api/app.service.ts` | **TEGILMAYDI** — isbotlar `/uploads` static'dan BERILMAYDI (u authsiz va helmet'dan OLDIN ro'yxatdan o'tgan: `:95` vs `:104`, ya'ni `nosniff` qo'llanmaydi, CSP esa o'chiq `:106`) |

### 5.3 `ExtraCostApplierService.applyToCashboxes()` — pul yozuvchi YAGONA funksiya

Hozir bu mantiq **3 nusxada**: `sellOrder` closure (`:2477-2501`), `partlySold` closure (`:3162-3185` — aynan nusxa), `cancelOrder` qo'lda yozilgan (`:3019-3049`). To'rtinchi nusxa yozilmasin.

```ts
// IMMEDIATE yo'l (sotuv tranzaksiyasi ichida) — entity obyektlar bilan
applyInline(qr, { marketCashbox, courierCashbox, order, amount, comment, courierId, marketId })

// APPROVE yo'l (alohida tranzaksiya) — ATOMIK SQL
applyAtomic(qr, { marketCashboxId, courierCashboxId, orderId, amount, paymentDate, ... })
//   UPDATE cash_box SET balance = balance - $1, updated_at = $2 WHERE id = $3 RETURNING balance
//   balance_after RETURNING'dan olinadi
```

⚠️ **Nega ikki variant.** `sellOrder` da `marketCashbox`/`courierCashbox` allaqachon `:2560-2572` da yuklangan, `marketBalanceBefore` `:2581` da snapshot olingan va SELL yozuvlari bilan balans o'zgartirilgan. Agar applier shu tranzaksiya ichida `findOne` bilan **yangi obyekt** olsa, xotirada ikki `CashEntity` nusxasi paydo bo'ladi va biri ikkinchisining `balance` ini eskisi bilan qayta yozadi → **bir tranzaksiya ichida SELL yoki EXTRA_COST yozuvi "yo'qoladi"**. Shuning uchun inline yo'l mavjud obyektlarni **parametr sifatida oladi**, applier ularni hech qachon qayta yuklamaydi.

`applyAtomic` da `Promise.all` **ISHLATILMAYDI** — hozirgi kod ikkala `updateCashbox`ni bitta `queryRunner` (bitta pg ulanishi) ustida parallel chaqiradi (`:2786`) va `balance_after` snapshotlari almashib qolishi mumkin. Ketma-ket `await`.

**Cheklov (ochiq qoldiriladi, sababi bilan):** mavjud inline yo'ldagi kassa qatorining lock'siz o'qilishi (`findOne` + xotirada `balance -=` + `save`) **v1 da tuzatilmaydi** — u butun `sellOrder`/`cancelOrder`/`paymentsFromCourier` bo'ylab tarqalgan va uni yangi funksional doirasida o'zgartirish 100% marketning jonli pul yo'lini refaktor qilish demak (eng katta portlash radiusi). Bu xotiradagi `courier-bulk-tezkor-amal-audit` topshirig'ining ochiq bandi bo'lib qoladi. **Yangi approve yo'li esa boshidan atomik.**

### 5.4 Endpointlar

Barchasi `@UseGuards(JwtGuard, RolesGuard)` + `@AcceptRoles(...)` (RolesGuard fail-closed, `roles.guard.ts:24`; ⚠️ `@UseGuards` **hech qachon izohga olinmasin** — `order.controller.ts:356` dagi xato takrorlanmasin).

| Endpoint | Rol | Izoh |
|---|---|---|
| `POST extra-cost/proof` | `COURIER` + `ThrottlerGuard` + `@Throttle({limit:6, ttl:60000})` | `FilesInterceptor('files', 3)`; `PROOF_DIR` **mutlaq yo'l**; nom `randomUUID()+ext`; `fileFilter`: **v1 da faqat** `image/jpeg`, `image/png`, `image/webp`, `image/heic` (SVG/GIF/HTML **QAT'IY RAD** — saqlangan XSS vektori); `limits:{fileSize: 8MB, files: 3}`; yozilgandan keyin **magic-byte** tekshiruvi + `sha256`. Javob: `[{proof_id, size, dup_count}]` — **fayl nomi/URL CHIQMAYDI** |
| `GET extra-cost/:id/proof/:proofId` | `COURIER`/`MARKET`/`OPERATOR`/`ADMIN`/`SUPERADMIN` | Egalik: so'rov egasi kuryer \| `market_id === effectiveMarketId` \| admin. `createReadStream`, `Content-Type` **DB'dagi tasdiqlangan MIME'dan**, `X-Content-Type-Options: nosniff` **QO'LDA**, `Accept-Ranges: bytes` |
| `GET extra-cost/market/me?status=&page=&limit=` | `MARKET` (+ `OPERATOR` agar `extra_cost_operator_can_approve`) | `market_id` **TOKENDAN** (`ai-balance.controller.ts:30` + `resolveOwnMarket` naqshi). `:marketId` param YO'Q — `GET order/market/:id` (`order.controller.ts:281`) dagi mavjud IDOR takrorlanmasin |
| `GET extra-cost/market/me/counts` | ″ | Badge |
| `GET extra-cost/market/me/courier-stats` | ″ | Kuryer kesimida 30 kunlik: so'ralgan / tasdiqlangan / rad etilgan / rad foizi |
| `POST extra-cost/:id/approve` | ″ | 5.5 |
| `POST extra-cost/:id/reject` | ″ | Body `{review_note}` — **majburiy** |
| `POST extra-cost/bulk-approve` | ″ | Body `{ids: string[]}` (maks 50). Serverda **KETMA-KET** (parallel EMAS), har biri o'z atomik darvozasi + `applyAtomic` bilan. Javob `{approved: n, skipped: [{id, reason}]}`. Atomik SQL tufayli lost-update xavfi yo'q; marketning 30 ta kartani bittalab bosishi realistik emas |
| `GET extra-cost/courier/me?status=` | `COURIER` | `WHERE courier_id = user.id` (scope so'rov ICHIDA) + `pending_total` |
| `GET extra-cost/courier/me/counts` | `COURIER` | Badge + o'qilmagan qarorlar soni |
| `POST extra-cost/:id/attach-proof` | `COURIER` | `awaiting_proof → pending` (24 soat ichida) |
| `POST extra-cost/:id/seen` | `COURIER` | `seen_by_courier_at` — banner yopilishi |
| `POST extra-cost/:id/resubmit` | `COURIER` | Rad etilgandan keyin **eng ko'pi 1 marta** (`resubmit_of` zanjiri uzunligi 1). Yangi `pending` qator |
| `GET extra-cost/admin?status=&escalated=&market_id=&courier_id=` | `ADMIN`,`SUPERADMIN` | Arbitraj navbati |
| `POST extra-cost/:id/admin-resolve` | `ADMIN`,`SUPERADMIN` | `{decision:'approve'\|'reject', review_note}` → `decision_mode='admin_override'` + alohida activity-log |

### 5.5 `approve` tranzaksiyasining aniq tartibi

```
1. Atomik darvoza:
   UPDATE extra_cost_request
      SET status='approved', reviewed_by=$1, reviewed_at=$2, decision_mode=$3, updated_at=$2
    WHERE id=$4 AND status='pending' AND market_id=$5
   → affected === 0  ⇒  rollback + 409 "So'rov allaqachon ko'rib chiqilgan"

2. Buyurtma statusi qayta tekshiriladi (SOLD/PAID/PARTLY_PAID/CANCELLED/CLOSED)
   → WAITING bo'lsa 409 (void allaqachon to'sishi kerak edi — ikkinchi devor)

3. Chegara QAYTA tekshiriladi: amount <= limit_max  (JONLI tarifdan EMAS — snapshot bo'yicha)

4. Kuryer holati: courier.is_deleted === false && status === active
   → aks holda: rollback + 409 + escalated_at qo'yiladi (admin hal qiladi)
      ⚠️ Sabab: kuryerga to'lov endpointi tizimda umuman yo'q; o'chirilgan kuryer
      kassasiga yozilgan pul abadiy osilib qoladi va hech kimga berilmaydi

5. Ikkala kassa MAJBURIY yuklanadi (FOR_MARKET + FOR_COURIER)
   → topilmasa: rollback + 409 + escalated_at (market o'chirilgan/kassasi yo'q holati)

6. applyAtomic():  UPDATE cash_box SET balance = balance - $x WHERE id=$y RETURNING balance   (× 2, ketma-ket)

7. 2 ta cashbox_history: EXPENSE / extra_cost / source_id=order.id / payment_date=order_action_at
   / source_user_id = (market yozuvida courier_id, kuryer yozuvida market_id)   ← hozir bu maydon bo'sh qolyapti

8. market_history_id, courier_history_id, settled_at yoziladi

9. financial_balance_history ga YOZILMAYDI (ta'sir NOL)

10. commit → keyin: activity-log + kuryerga in-app belgisi (await'siz)
```

### 5.5b `partlySold` yashirin chegirma to'sig'i (BLOCKER FIX)

```ts
const hiddenCut = (totalNewQty === totalOldQty) ? Math.max(0, oldTotalPrice - price) : 0;

if (hiddenCut > 0) {
  // 1) Chegara — extraCost bilan BIR XIL (hozir umuman yo'q edi)
  assertExtraCostWithinLimit(hiddenCut, sellExtraCostLimit({...}), {...});

  // 2) Bayroq yoqilgan marketda: sabab + kategoriya + isbot MAJBURIY
  //    (pul mantiqiga TEGILMAYDI — market baribir kamroq oladi, hozirgidek)
  if (policy.requireProof) assertProofProvided(dto);

  // 3) Har doim: ECR audit qatori action_type='price_cut', status='approved',
  //    decision_mode='auto_rule' — commit'dan KEYIN, try/catch ichida
  //    → market sahifasida alohida «Narx pasaytirilgan sotuvlar» tabida ko'rinadi
}
```

**Nega pul kechiktirilmaydi:** yashirin chegirmani kechiktirish uchun to'liq narxni kassaga yozib, keyin farqni alohida qaytarish kerak bo'lardi — bu `to_be_paid`, `paid_amount`, `autoPay`, `SELL_PROFIT` va operator earning hisobini butunlay o'zgartiradi (`order.service.ts:3411-3440`), ya'ni jonli sotuv matematikasini buzish xavfi. v1 da **ko'rinmas + chegarasiz + isbotsiz** uchligining uchalasi ham yopiladi — bu xavfning ~90% i. To'liq kechiktirish yoki qat'iy taqiq — **biznes qarori №4**.

### 5.6 CRON (`extra-cost.cron.ts`)

| Jadval | Ish | Pul harakati |
|---|---|---|
| Har soat | `awaiting_proof` + `created_at < now − 24h` → `void` | YO'Q |
| Har soat | Bog'lanmagan `extra_cost_proof` (`request_id IS NULL`, `created_at < now − 24h`) → diskdan + DB'dan o'chirish | YO'Q |
| Kuniga 1 (03:00) | `pending` + `created_at < now − 7 kun` → `escalated_at = now` + marketga eslatma | **YO'Q** |
| Kuniga 1 (03:10) | `pending` + `escalated_at < now − 7 kun` (jami 14) → `approved` + `decision_mode='auto_backstop'` + ovozli activity-log + adminga xabar | HA (oxirgi zaxira) |

### 5.7 Rekonsiliatsiya darvozasi (`npm run db:check-extra-cost`)

CI `deploy.yml` da `db:check-cashbox --compare` (`:172`) yonida. Invariantlar:

| # | Invariant |
|---|---|
| I1 | `status='approved'` → `market_history_id` va `courier_history_id` NOT NULL, ikkala `cashbox_history.amount` = `ecr.amount` |
| I2 | Migration sanasidan keyingi har bir `EXTRA_COST` `cashbox_history` qatori **aniq bitta** ECR ga bog'langan (yetim yozuv yo'q) |
| I3 | Har `order_id` uchun `SUM(market EXTRA_COST) == SUM(courier EXTRA_COST)` — simmetriya (bittasi yozilib qolsa moliyaviy tarozi jimgina siljiydi) |
| I4 | Har `order_id` uchun `status IN ('awaiting_proof','pending')` soni ≤ 1 |
| I5 | Har `order_id` uchun `SUM(amount WHERE status IN ('pending','approved')) <= limit_max` |
| I6 | `status='rejected'` yoki `'void'` → `market_history_id`/`courier_history_id` **NULL** (rad etish hech qachon kassaga yozmaydi) |

### 5.8 Activity-log

Yangi amallar: `extra_cost_requested`, `extra_cost_proof_attached`, `extra_cost_approved`, `extra_cost_rejected`, `extra_cost_voided`, `extra_cost_escalated`, `extra_cost_admin_resolved`, `extra_cost_price_cut`, `extra_cost_proof_flag_changed`.

**HAMMASI `entity_type:'order'`, `entity_id: order.id`** (so'rov id → `metadata.extra_cost_request_id`) — aks holda `enrichLogs` (`activity-log.service.ts:187, 358`) turni tanimaydi va `#100042` qidiruvi (`:404-410`) ishlamaydi.
Tavsif o'zbekcha + `#order_number` (`status-label.util.ts`).
⚠️ **Fayl yo'li va mijoz PII `new_value`ga YOZILMAYDI** — faqat `proof_count`, `category`, `dup_proof_count` (masked_fields konvensiyasi ruhi).

### 5.9 Bildirishnoma

- **Marketga:** commit'dan KEYIN, `try/catch` ichida, `await`siz → `botService.sendMessageToGroup(cancelGroup?.group_id ?? null, text)` (`order.service.ts:2869-2890` naqshi) + `BotNotifyService` ga generik `notifyMarketUsers(marketId, text)` (mavjud `notifyBalanceTopup:36-79` ni umumlashtirib — guruhga ulanmagan marketlar ham xabar oladi). ⚠️ `Group_type.CANCEL || null` xatosi (`bot.service.ts:50`) **KO'CHIRILMAYDI**.
  **Telegram tugmasi BERILMAYDI** — `isCallbackAuthorized` (`order-bot.service.ts:560`) faqat `chat_id` ni tekshiradi, tugmani bosgan odamni EMAS; guruhdagi har kim (jumladan kuryerning o'zi) pul qarorini qabul qilardi. Xabarda faqat matn + panelga havola.
- **Kuryerga:** Telegram YO'Q — `telegram_id` kuryerga hech qachon to'ldirilmaydi (`order-bot.service.ts:443`, `users.service.ts:1860` kuryerni ochiq rad etadi). O'rniga **3 kanal**: (a) kuryerning asosiy ekranida (`waiting-orders`, skan) yopilmaydigan banner «N ta so'rovingiz bo'yicha qaror bor — ko'rish» (`seen_by_courier_at` bilan boshqariladi); (b) kassa sahifasida «Kutilayotgan xarajat: X so'm» kartasi (kuryer kuniga bir necha marta kassasini ochadi — polling'dan ishonchliroq kanal); (c) `refetchInterval: 60000`.

---

## 6. Frontend o'zgarishlari

### 6.1 Kuryer modallari — **UCHALASI** (boshqa joy yo'q)

`courier/waiting-orders/index.tsx:819-906`, `courier/all-orders/index.tsx:927-1014`, **`scanAndOrder.tsx:937-969`**.
⚠️ Uchinchisi (QR-skan) unutilsa — kuryerlar isbotsiz yozish uchun aynan shu yo'ldan foydalanadi (u yerda hozir limit ogohlantirishi ham, `where_deliver` guard'i ham YO'Q).

- Mavjud naqsh davom ettiriladi: antd `Form.Item` EMAS, alohida `useState` (`extraCostValue` naqshi — `waiting:92`, `all-orders:167`, `scan:72`). `const [proofFiles, setProofFiles] = useState<File[]>([])` + `<input type="file" accept="image/*" capture="environment" multiple>`.
- **Kategoriya `Select`** (Taksi / Lift / Yuk ortish / Qayta borish / Mijoz talabi / Boshqa) — majburiy; «Boshqa» tanlansa sabab matni majburiy.
- **Klient siqish MAJBURIY:** canvas orqali maks 1280px (`ai-create-order/index.tsx:82` dagi `downscaleImage` naqshi tayyor) → ~200-400 KB. Bu nginx 1 MB devorini ham, disk o'sishini ham deyarli yo'q qiladi.
- **Ikki bosqichli yuborish:** (1) `POST extra-cost/proof` FormData bilan → `proof_ids`; (2) mavjud `sellOrder.mutate`/`cancelOrder.mutate`/`partlySellOrder.mutate` JSON body'siga `extra_cost_proof_ids` + `extra_cost_category` qo'shiladi. Axios FormData'ga xalaqit bermaydi (`shared/api/index.ts:30` faqat `Authorization` + `X-Device-Id` qo'yadi); tayyor namuna `useProduct/index.tsx:9-14`.
- **Yuklash yiqilsa:** «Isbotsiz davom etish» tugmasi → `extra_cost_proof_deferred: true` → sotuv o'tadi, ECR `awaiting_proof`, kuryerga «24 soat ichida isbot biriktiring» ogohlantirishi. **Sotuv hech qachon yo'qolmaydi.**
- **Banner:** bayroq yoqiq bo'lsa sariq — «Bu xarajat market tasdiqlagandan keyin hisobingizga o'tkaziladi. Naqdni kassaga **to'liq** topshirasiz» (matn biznes qarori №1 ga qarab yoziladi).
- **Limit hisobi tuzatiladi:** hozir frontend tariflar teng bo'lganda `Math.max(0, courierTariff)` ko'rsatadi (`all-orders:950`, `waiting:842`), server esa `Math.floor(center/2)` (`extra-cost-limit.util.ts:61`) — kuryerga **2 barobar katta** maksimum ko'rsatiladi va u 400 oladi. Chegara backend javobidan olinadi: `GET order/:id` / kuryer ro'yxatiga `extra_cost_limit_max` qo'shiladi (server util'i yagona manba bo'lib qoladi).
- **Skan sahifasiga** limit hinti + `where_deliver` guard'i ham qo'shiladi (hozir yo'q).

### 6.2 Market sahifasi — `client/src/pages/extra-cost-requests/market/index.tsx`

Shablon: `replacement-returns/index.tsx` (`STATE_TABS` `:20-27`, `stateChip` `:49`, `ConfirmPopup`, `useApiNotification`).

Tablar: **Kutilmoqda** / Tasdiqlangan / Rad etilgan / **Narx pasaytirilgan sotuvlar** (`price_cut`) / **Tashqi kargo — avtomatik** (`external_auto`).

Har kartada: `#order_number` · «Markazga yetkazish · 120 000 so'mlik buyurtma · kuryer tarifi 20 000 · **ruxsat etilgan maksimum 10 000** · so'ralgan 10 000 ⚠️ *maksimumga teng*» · kategoriya chipi · sabab · **isbot thumbnail'i** (bosilganda lightbox) · sotuv sanasi **va** so'rov sanasi · kuryer nomi yonida **«30 kunda 40 so'rov, 25 rad etilgan (62%)»**.
Dublikat isbot bo'lsa: 🔴 «Bu isbot yana N ta so'rovda ishlatilgan» + havolalar.
Tugmalar: «Tasdiqlash» / «Rad etish (sabab majburiy)» + yuqorida «Belgilanganlarni tasdiqlash» (checkbox + `bulk-approve`).
`refetchInterval: 30000`.

### 6.3 Kuryer sahifasi — `client/src/pages/extra-cost-requests/courier/index.tsx`

Kuryer buyurtmalar qobig'iga **4-tab** sifatida (`pages/orders/pages/courier/index.tsx:105` `tabs` massivi + badge).
Holat chiplari: Isbot kutilmoqda (to'q sariq, taymer bilan) / Kutilmoqda (sariq) / **Tasdiqlandi — hisobingizga o'tkazildi** (yashil) / Rad etildi + sabab (qizil, «Qayta yuborish» tugmasi) / Bekor bo'ldi — buyurtma qaytarildi (kulrang) / **Teskari qaytarildi** (kulrang, `reversed`).
Yuqorida: «Kutilayotgan jami: X so'm» kartasi.
`refetchInterval: 60000` + o'qilmagan qarorlar uchun asosiy ekrandagi banner.

### 6.4 Kassa sahifalari

- Kuryer `/cash-box`: balans yonida **«Tasdiq kutilmoqda: X so'm»** qatori + «Bugun topshirish kutilmoqda: balans − pending» (biznes qarori №1 ga qarab matn).
- Kassir `paymentsFromCourier` ekrani: kuryer tanlanganda **«Bu kuryerda tasdiq kutilayotgan xarajat: X so'm»**.
- Kassir `paymentsToMarket` ekrani: **«Bu marketda tasdiq kutilayotgan xarajat: X so'm»** ogohlantirishi.
- Admin dashboard/kassa: **«Kutilayotgan qo'shimcha xarajatlar: X so'm (N ta)»** kartasi (balansga qo'shilmaydi, ko'rinmas majburiyat ko'rinadigan bo'ladi).

### 6.5 Sozlama UI

- **Market o'zi:** `/profile` (`profile/overview/overview.tsx`) ga yangi «Qo'shimcha xarajat nazorati» kartasi — 3 ta boshqaruv (Switch + summa inputi + operator Switch'i) → `PATCH user/market/settings/self`. Yonida aniq matn: **«Bu sozlama tashqi kargo (Elchi/LDG) orqali yetkazilgan buyurtmalarga QO'LLANMAYDI»**.
- **Admin:** `profile/pages/user-profile/index.tsx:690-728` dagi `require_operator_phone` kartasidan 1:1 nusxa. ⚠️ Bu marshrut `routes.tsx:374` da `RequireRole`siz — **`<RequireRole roles={["admin","superadmin"]}>` qo'shiladi** (1 qator).
- `auth/index.tsx:41-71` — market/operator uchun reduxga ko'chiriladigan maydonlar ro'yxatiga 3 bayroq qo'shiladi (sanab o'tilganlargina ko'chadi).
- Kuryerga bayroq: `allCouriersOrders` da `o.market` allaqachon `leftJoinAndSelect` bilan qo'shilgan (`:2233`) → yangi boolean **avtomatik keladi**. Bayroq noma'lum bo'lsa modal isbot maydonini **KO'RSATADI** (fail-safe).

### 6.6 Marshrut va menyu

- `routes.tsx`: `lazy()` + `<RequireRole roles={["market","operator"]}>` / `roles={["courier"]}`. ⚠️ Market sahifalarining ko'pchiligi hozir `RequireRole`siz (`:361`, `:362`, `:459`) — bu xato takrorlanmaydi.
- **3 ta menyu fayli:** `MarketSidebar.tsx:11-27` (7→8, badge bilan), `Courier.tsx:12-19`, **`RenderMediaSidebar.tsx` mobil nav** (`case "market"` `:194-230` → 5 dan 6 ikonka; `case "courier"` `:154-193`). ⚠️ Market mobil navida «Operatorlar»/«AI balans» umuman yo'q va market `<650px` da ularni ocha olmaydi (`DashboardLayout.tsx:70`) — yangi sahifa shu tuzoqqa tushmasin.
- `logs-page/index.tsx:355-404` yorliqlar xaritasi: `extra_cost_request_id`, `proof_count`, `category`, `review_note`, `decision_mode`, `extra_cost_proof_required`, `dup_proof_count` (`extra_cost: "Qo'shimcha xarajat"` `:365` allaqachon bor).
- `vite.config.ts` — **o'zgarish kerak emas**: isbotlar `/api/v1/extra-cost/...` orqali beriladi va mavjud `/api` proxy'ga tushadi (bu ham `/uploads` static'dan voz kechishning foydasi — hozir `/uploads` dev'da 404 beradi).

---

## 7. Chekka holatlar

| # | Holat | Qanday hal qilinadi |
|---|---|---|
| 1 | **Isbot yo'q / tarmoq uzildi** | Sotuv **HECH QACHON yiqilmaydi**. Frontend tugmani oldindan disabled qiladi; server tomonda isbotsiz + `proof_deferred` bo'lsa ECR `awaiting_proof` (24 soat), aks holda 400. Elchi tamoyili: yetkazish fakti pul qaydi uchun bloklanmaydi |
| 2 | **Eski keshlangan frontend** | Bosqichma-bosqich yoqish (avval isbot maydoni deploy, gate O'CHIQ — 1 hafta; keyin gate). 400 matnida: «Ilovani yangilang — sahifani tortib qayta yuklang» |
| 3 | **Buyurtma rollback** | `pending`/`awaiting_proof` → `void` (rollback'ning **ENG BOSHIDA**, kassa bloklaridan OLDIN); `approved` → `reversed` (kassa bloklaridan KEYIN, mavjud `reverseExtraCostForCashbox` pulni o'zi qaytaradi) |
| 4 | **Qayta jo'natish / kuryer almashtirish** | `voidOpenRequests` — aks holda `UQ_ECR_ORDER_OPEN` yangi kuryerning sotuvini 500 bilan yiqitadi |
| 5 | **Unique violation (`23505`)** | So'rov yaratishdan oldin kod darajasida tekshiriladi + INSERT `try/catch` bilan: `error.code === '23505'` → o'zbekcha 400 «Bu buyurtmada allaqachon tasdiq kutilayotgan so'rov bor». Indeks — oxirgi devor, birinchi to'siq emas |
| 6 | **Ikki marta tasdiqlash / double-click** | Atomik status darvozasi (`affected===0` → 409) + `UQ_ECR_*_HIST` unique indekslari |
| 7 | **Kuryer ishdan bo'shagan / o'chirilgan** | `approve` bloklanadi → `escalated_at`, admin hal qiladi. Sabab: kuryerga to'lov endpointi yo'q, o'chirilgan kuryer kassasidagi pul hech kimga berilmaydi |
| 8 | **Market/kuryer kassasi topilmadi** | `approve` rollback + 409 + `escalated_at`. Status `pending` da qoladi (tranzaksiya to'liq orqaga qaytadi) |
| 9 | **Kuryer allaqachon hisob-kitob qilgan** | Kuryer balansi manfiy bo'lishi mumkin (pochta kuryerga qarzdor) — bu xavfsiz, keyingi kunlik yig'imda netlashadi. UI'da «kuryerga to'landi» EMAS, **«kuryer hisobiga o'tkazildi»** |
| 10 | **Smena yopiq** | Muammo yo'q — `EXTRA_COST` MAIN kassaga hech qachon yozilmaydi, `requireOpenShift()` chaqirilmaydi. Market kechqurun ham tasdiqlay oladi |
| 11 | **Bayroq o'chirilsa** | Ochiq `pending`lar **kutib turadi**, sahifa va badge `pending > 0` bo'lgunga qadar **ko'rinib turadi**. O'chirish paytida ogohlantirish: «Sizda N ta ochiq so'rov bor» |
| 12 | **Kasrli summa** | `Math.trunc()` servisda + DTO'da `@IsInt()`. Mavjud nuqson ham yopiladi (`5000.5` bigint INSERT xatosi butun sotuvni rollback qilardi) |
| 13 | **Tarif o'zgarsa** | Tasdiqda chegara **jonli tarifdan emas**, `limit_max` snapshot'idan tekshiriladi |
| 14 | **Bir buyurtmada bir nechta so'rov** | 1:N model (sotildi→rollback→bekor sikli). Bir vaqtda faqat bitta ochiq (partial unique). Jami chegara: `SUM(amount WHERE status IN ('pending','approved')) + yangi <= limit_max`; `void`/`rejected`/`reversed` **sanalmaydi** (rollback qilingan buyurtma qayta sotilganda kuryer yana yoza olsin) |
| 15 | **Bulk sotuv/bekor** | **Hech qanday o'zgarish.** `BulkOrderActionDto` da `extraCost` YO'Q (`:15` izohi ataylab), `bulkSellOrders:6824` / `bulkCancelOrders:7170` faqat `comment` uzatadi → `extraCost=0` → policy umuman ishga tushmaydi |
| 16 | **LDG** | **Hech qanday o'zgarish.** Uchala yo'l (`:6149`, `:6226`, `:6292`) `extraCost: 0` uzatadi; gate `amount > 0` dan KEYIN turadi |
| 17 | **Elchi** | `immediate` + audit izi. `markDeliveredByElchi:6429 → remoteExtra:6509 → sellOrder(elchiActor, {extraCost}, {bypassControlGuard:true}):6521`. Elchi kuryeri bizning UI'dan foydalanmaydi → foto biriktira olmaydi. Gate uni qamrasa: yetkazilgan posilkalar WAITING'da qotardi yoki `:6528-6552` retry mantiqi xarajatni jimgina yo'qotardi. **Market bundan XABARDOR qilinadi** (toggle matni + alohida tab) |
| 18 | **`external_provider` suiiste'moli** | `external_provider` o'zgarishi alohida activity-log amali; policy `external_auto` qarori ham har safar loglanadi |
| 19 | **Dublikat isbot** | `sha256` bo'yicha 24 soatlik hisoblagich → `dup_proof_count` + market kartasida qizil banner. **Qattiq taqiq YO'Q** (bitta reysda bitta chek bir nechta buyurtmaga tegishli bo'lishi mumkin) — lekin KO'RINADI |
| 20 | **Soxta `proof_id`** | Fayl nomi DTO'da umuman qabul qilinmaydi. `proof_ids` uuid → `WHERE id IN (...) AND courier_id = user.id AND request_id IS NULL` + `fs.existsSync` |
| 21 | **Orfan fayllar** | `request_id IS NULL` + 24 soat → CRON diskdan va DB'dan o'chiradi. Yo'l konstantasi yagona (`PROOF_DIR`) — `product.service.ts:343` xatosi takrorlanmaydi |
| 22 | **Kunlik spam (80 ta so'rov)** | Kuryer bo'yicha **kunlik jami chegara**: `SUM(amount) bugun IN ('pending','approved') > (kunlik tarif × N)` → 400. Market kartasida «Bu kuryer bugun M ta so'rov yubordi» |
| 23 | **Rad etilgandan keyin** | `resubmit` — **eng ko'pi 1 marta**, yangi isbot bilan. Ikkinchi rad etish yakuniy → admin arbitraji |
| 24 | **Market javob bermasa** | 7 kun → `escalated_at` + admin navbati (**pul harakat qilmaydi**); +7 kun (jami 14) → `auto_backstop` tasdiq + ovozli log. Kichik summalar esa `auto_approve_under` bilan darhol tasdiqlanadi |
| 25 | **`order.comment` matni** | Kechiktirilgan holatda matn: «Qo'shimcha xarajat N so'm — market tasdig'iga **yuborildi**» — bu jumla qaror qanday bo'lishidan qat'i nazar **abadiy haqiqat** bo'lib qoladi, shuning uchun keyin yangilash kerak emas. Haqiqiy holat ECR sahifasida |
| 26 | **Bola (partial) buyurtma** | Hisobga olinmaydi — `partlySold` xarajatni faqat otaga yozadi (`source_id=order.id`, `:3487-3508`), bola CANCELLED (`:3567-3581`) hech qanday kassa yozuvi olmaydi |
| 27 | **EXIF / `capture` kafolati** | ⚠️ **Ochiq qoldiriladi, sababi bilan:** `capture` atributi brauzerlar uchun maslahat, majburiy emas; klient siqish esa EXIF'ni yo'q qiladi. v1 da o'rniga: `uploaded_at` va `order_action_at` farqi > 30 daqiqa bo'lsa market kartasida sariq belgi «Surat amaldan ancha keyin yuklangan» + `dup_proof_count`. To'liq EXIF/GPS tekshiruvi yangi kutubxona talab qiladi (`sharp`/`exifr` — loyihada yo'q) → v2 |

---

## 8. Bosqichlar (har biri mustaqil deploy qilinadi)

| # | Bosqich | Mazmun | Kun |
|---|---|---|---|
| **0** | **Poydevor — xulq 0% o'zgaradi** | Migration `1749700000000`; 2 ta entity; `users` 3 ustun; `update-market.dto`; `PATCH user/market/settings/self` + market `/profile` kartasi + admin toggle + `RequireRole` tuzatish; `auth/index.tsx` redux maydonlari. **Deploy xavfsiz: DEFAULT false** | 1.5 |
| **1** | **Infra — BLOKER, koddan oldin** | `UPLOAD_ROOT` env + **deploy papkasidan TASHQARIDAGI mutlaq yo'l**; `db-backup.sh` ga isbot papkasi (`tar`/`rsync` + S3); nginx `client_max_body_size 12m` + `client_body_timeout 120s` + `proxy_request_buffering off`. **Chiqish mezoni: backup'dan fayl tiklanishi sinovdan o'tgan** | 1.5 |
| **2** | **Yagona applier + aylanma yo'l to'sig'i** | `ExtraCostApplierService` (inline + atomik); uchala nusxa (`:2477`, `:3162`, `:3019-3049`) shu funksiyaga ko'chiriladi — hamon `immediate`, tashqi xulq bir xil; `cancelOrder` chegarasi util'ga birlashtiriladi; **`partlySold` yashirin chegirma chegarasi + audit** (5.5b); `Math.trunc` + `@IsInt`; sotuv/qisman sotuv activity-log'iga `extra_cost`; `policy.util`. **Regressiya testlari: pul yo'llari bayt-ma-bayt bir xil** | 2 |
| **3** | **Isbot infratuzilmasi** | `POST extra-cost/proof` (fileFilter oq ro'yxati, limits 8MB/3, `randomUUID`, magic-byte, sha256, Throttle 6/min); himoyalangan `GET .../proof/:proofId` (egalik + qo'lda `nosniff` + Range); orfan tozalash CRON | 1.5 |
| **4** | **`deferred` rejim + rollback ilgaklari** | `settleExtraCost` ikki shoxli; `awaiting_proof` oqimi; `finalComment` notes varianti; `voidOpenRequests` (rollback **boshida**, merge, qayta jo'natish) + `markReversed` (uchala shox); DTO maydonlari. **E2E: bayroq yoqiq marketda sotuv YOPILADI, kassa TEGILMAYDI, ECR `pending`** | 2 |
| **5** | **Tasdiqlash / rad etish / arbitraj + rekonsiliatsiya** | `approve` (5.5 tartibi), `reject`, `bulk-approve`, `resubmit`, `admin-resolve`, `auto_approve_under`; `check-extra-cost.ts` (I1–I6) + `npm run` + CI darvozasi. **Testlar:** ikki marta approve → 409 + bitta yozuv; reject → 0 kassa yozuvi; approve→rollback→balans boshlang'ich holatga; pending→rollback→void→approve 409; 10 parallel approve → balans aniq; IDOR | 2.5 |
| **6** | **Frontend** | 3 modal (skan sahifasi ham!) + kategoriya + klient siqish + `proof_deferred`; market sahifasi (5 tab, isbot lightbox, bulk, kuryer statistikasi); kuryer sahifasi + banner + `seen`; kassa sahifalari (kuryer / kassir × 2 / admin); marshrutlar + 3 menyu fayli; limit hisobini serverga moslash; log yorliqlari. **REAL telefonda sinov** | 3 |
| **7** | **Bildirishnoma, CRON, pilot** | Marketga Telegram (guruh + DM, `\|\| null` xatosisiz, tugmasiz); eskalatsiya + backstop CRON; admin «Muddati o'tgan» ko'rinishi; **pilot: 1 market, 1 hafta**, keyin bosqichma-bosqich | 2 |

**Jami: ~16 kun.**

**Qisqartirilgan MVP (agar tezlik kerak bo'lsa, ~9 kun):** 0 + 1 + 2 + 3 + 4 + 5 + 6-ning faqat kuryer modallari va market sahifasi. Tashlab turiladi: `bulk-approve`, `resubmit`, kuryer statistikasi, admin arbitraj ko'rinishi, `auto_approve_under`, kassir ekranlari. ⚠️ **Kassir ekranlari va `price_cut` to'sig'ini tashlab bo'lmaydi** — birinchisisiz kassa stolida har kuni nizo, ikkinchisisiz butun ish aylanib o'tiladi.

---

## 9. Xavflar va yumshatish choralari

| Daraja | Xavf | Yumshatish |
|---|---|---|
| 🔴 | **Rad etish `CORRECTION+INCOME` yozib qo'yilishi** — bu juftlik butun kod bazasida faqat `reverseExtraCostForCashbox` (`:3732-3745`) uchun band; yozilsa keyingi rollback xarajatni qaytarmay qo'yadi | Rad etish HECH QANDAY kassa yozuvi yaratmaydi. Kod-review checklisti + I6 invarianti + jest test |
| 🔴 | **Pending `cashbox_history`ga sizib kirishi** — `reverseExtraCostForCashbox` SUM'i, `getCashboxByUserId` (`:1046`) va `allCashboxesTotal` (`:1991`) ifloslanadi | Qattiq chegara: pending kassa jadvallariga mutlaqo tegmaydi. Test: pending yaratilgach `count(*) FROM cashbox_history WHERE source_id=$order` o'zgarmagan |
| 🔴 | **Rollback'da void unutilishi yoki noto'g'ri tartibda** → yo'qolgan qaytarish | Void **rollback'ning eng boshida**; uchala shox uchun bitta chaqiruv; E2E test (poyga stsenariysi bilan) |
| 🔴 | **Yashirin chegirma aylanma yo'li** (`partlySold` `totalPrice`) | Bosqich 2 da chegara + isbot + audit. **Bosqich 2 dan keyin deploy qilinmasin** — aks holda kuryerlar birinchi haftada o'sha yo'lga o'tadi |
| 🔴 | **Isbot fayllari backup'ga kirmasligi** — `db-backup.sh` faqat `pg_dump` qiladi; isbot pul nizosining yagona dalili | Bosqich 1 ning **chiqish mezoni**, keyinga surilmaydi |
| 🟠 | **Kuryer kamomadi (jismoniy naqd)** | Kassir/kuryer ekranlarida `pending_extra_cost`; biznes qarori №1 hujjatlashtiriladi va modal matniga yoziladi |
| 🟠 | **Market pending turganda to'liq to'lovni olib ketishi** → pochta kreditorga aylanadi | Kassir ekranida ogohlantirish + I3/I5 rekonsiliatsiyasi + biznes qarori №6 |
| 🟠 | **Elchi oqimining jimgina buzilishi** | `policy`: `courier.external_provider != null` → `immediate`. Test: `external_provider='elchi'` kuryer + bayroq yoqiq market + `extraCost>0` + isbotsiz → **darhol yoziladi** |
| 🟠 | **Skan sahifasi unutilishi** | Uchala modal bitta checklist bandi; server gate qat'iy bo'lgani uchun eng yomon holat — kuryer 400 oladi (pul sizmaydi) |
| 🟠 | **Bir tranzaksiya ichida ikki `CashEntity` nusxasi** (Taklif 1 ning helper dizayni) | Inline applier kassalarni **hech qachon qayta yuklamaydi**, parametr sifatida oladi |
| 🟡 | **Mavjud lost-update** (`findOne` + xotirada `balance -=`) | **v1 da tuzatilmaydi** — 100% marketning jonli pul yo'lini refaktor qilish eng katta portlash radiusi. Yangi approve yo'li boshidan atomik. Alohida topshiriq sifatida qayd etiladi |
| 🟡 | **Market so'rovlar ostida ko'milishi** | `auto_approve_under`, `bulk-approve`, kategoriya filtri, kuryer statistikasi, kunlik chegara |
| 🟡 | **Disk o'sishi** | v1 faqat foto + klient siqish (1280px, ~300 KB) → kuniga 200 isbot ≈ 60 MB/kun ≈ 1.8 GB/oy. Retention CRON — biznes qarori №8 |
| 🟡 | **`POST /user/telegram/signin` initData hash tekshirilmasligi** (`users.service.ts:1891`) — auth bypass | Bu dizayn Telegram'ga **tayanmaydi** (tasdiqlash faqat web-panelda) → bloker emas, lekin **alohida xavfsizlik topshirig'i** sifatida qayd etiladi |
| 🟢 | **Migration raqami to'qnashuvi** | Merge oldidan `ls src/migrations \| tail` (repoda commit qilinmagan ish bor: `MARKETPLACE_PARTNER_API.md`) |
| 🟢 | **`Group_type.CANCEL \|\| null` xatosini nusxalash** | Yangi bildirishnoma kodida takrorlanmaydi + `notifyMarketUsers` guruhsiz marketlarni ham qamraydi |

---

## 10. FOYDALANUVCHIDAN SO'RALADIGAN BIZNES QARORLARI

> Bular **ishni bloklamaydi** (hammasi konstanta/sozlama), lekin tasdiqlansa reja aniq bo'ladi. **№1, №4 va №5** eng muhimi.

**1. ⭐ Kuryer qo'shimcha xarajat pulini mijoz naqdidan ushlab qoladimi, yoki o'z cho'ntagidan to'laydimi?**
Butun dizayn shunga bog'liq. (a) Ushlab qolsa — tasdiqqacha kuryer kassaga kam pul topshiradi va balansida «tushunarsiz qarz» qoladi. (b) O'z cho'ntagidan to'lasa — kassaga to'liq topshiradi, tasdiqlangach pul qaytariladi.
**Tavsiya: (b) — kuryer kassaga TO'LIQ topshiradi.** Shunda «tasdiqqacha hisobga olinmaydi» jumlasi jismonan ham haqiqat bo'ladi, rad etilganda hech narsani undirish kerak emas, kassir bilan nizo bo'lmaydi. Kuryer o'z pulini eng ko'pi bir necha kun kreditlaydi (`auto_approve_under` bilan kichik summalar darhol qaytariladi). Bu **modal matniga** va kuryerlarga e'lon qilinishi shart.

**2. «Kuryerga to'lanadi» nimani anglatadi?**
(a) kelgusi hisob-kitobda kamroq topshiradi (hozirgi model), (b) kassadan real naqd beriladi (yangi to'lov endpointi kerak), (c) oylik bilan.
**Tavsiya: (a)** — tizimda kuryerga to'lov endpointi umuman yo'q (`cash-box.controller.ts` da faqat `payment/courier` = kuryerDAN) va uni qo'shish alohida katta ish. UI'da matn «kuryer hisobiga o'tkazildi» bo'ladi, «to'landi» emas.

**3. Market javob bermasa nima bo'lsin va necha kunda?**
**Tavsiya: 7 kun → admin navbatiga (pul harakat qilmaydi); +7 kun (jami 14) → avtomatik tasdiq (`auto_backstop`, ovozli log).** Sabab: 7-kunda jim avto-tasdiq kuryerga «baribir o'tib ketadi» strategiyasini beradi va butun loyihaning maqsadini bekor qiladi; lekin cheksiz muzlatish ham kuryerni pulsiz qoldiradi. Ikkala raqam ham konstanta. Qo'shimcha: market `auto_approve_under` bilan kichik summalarni darhol tasdiqlashni yoqishi mumkin.

**4. ⭐ `partlySold` orqali narxni pasaytirish (mahsulot soni kamaymasdan) nima bo'lsin?**
Bu AYNAN o'sha pul natijasini beradi va hozir chegarasiz/isbotsiz/tasdiqsiz.
**Tavsiya (rejaga kiritilgan): chegara + majburiy sabab/kategoriya + isbot + market sahifasida alohida tab**, lekin **pul kechiktirilmaydi** (kechiktirish sotuv matematikasini buzadi). Agar bu yetarli bo'lmasa — 2-variant: bayroq yoqilgan marketda son kamaymasdan narx pasaytirishni **butunlay taqiqlash** (kuryer `extraCost` ishlatishga majbur bo'ladi). 2-variant kuchliroq, lekin «mijoz bilan narx kelishildi» holatini yopadi.

**5. ⭐ Bayroqni kim yoqadi va kim tasdiqlaydi?**
Talabda «market sozlamasida» deyilgan, lekin hozirgi tizimda market o'z sozlamalarini umuman o'zgartira olmaydi.
**Tavsiya: market O'ZI yoqadi** (yangi `PATCH user/market/settings/self`, rejaga kiritilgan) + admin ham yoqa oladi (qo'llab-quvvatlash uchun).
**Tasdiqlash: v1 da `Roles.MARKET`**, lekin market `extra_cost_operator_can_approve` bayrog'ini yoqsa **OPERATOR ham** tasdiqlaydi (amalda market egasi panelga kamdan-kam kiradi — usiz so'rovlar qotib qoladi). `decision_mode` da kim tasdiqlagani qayd etiladi.

**6. Tasdiq kutayotgan xarajati bor market to'liq to'lovni (`paymentToMarket`) olib keta olsinmi?**
**Tavsiya: v1 da faqat kassir ekranida ogohlantirish, qattiq cheklov YO'Q** — cheklov qonuniy to'lovni bloklab qo'yishi mumkin. Agar amalda muammo chiqsa, `balance − pending` cheklovi 1 qatorda qo'shiladi.

**7. Market rad etgan, lekin kuryerda haqiqiy chek bor holatda kim hakam?**
**Tavsiya: admin/superadmin `admin-resolve` bilan yakuniy qaror qabul qiladi** (alohida activity-log amali bilan), va rad etilgan so'rovga kuryer **1 marta** qayta yubora oladi. Marketning rad etish foizi admin panelida ko'rinadi — 80% rad etadigan market bayroqni suiiste'mol qilayotgan bo'ladi.

**8. Rad etilgan xarajatni kim ko'taradi?**
Hozirgi implitsit javob — kuryer. Bu hech kim bilan kelishilmagan.
**Tavsiya: kuryer** (chunki u isbot yetarli bo'lishini ta'minlashi kerak), lekin **admin arbitraji orqali pochta zimmasiga olish imkoni bo'lsin**. Kuryerga takroriy rad etishlar uchun avtomatik jarima v1 da **YO'Q** — o'rniga rad foizi ko'rsatkichi va admin qarori.

**9. VIDEO haqiqatan kerakmi?**
**Tavsiya: v1 da FAQAT FOTO.** Video nginx sozlamasi, disk (~24 GB/oy), backup va Range-stream murakkabligini keltiradi; foto + klient siqish (1280px ≈ 300 KB) 2G'da ham 10 soniyada ketadi. Video — v2, alohida infra tasdig'idan keyin.

**10. Isbot fayllari qancha saqlansin (retention)?**
**Tavsiya: qaror sanasidan +12 oy**, keyin CRON o'chiradi. Bu javob berilmasa avtomatik tozalash yozilmaydi va disk cheksiz o'sadi.

**11. Kuryer uchun kunlik jami xarajat chegarasi qancha bo'lsin?**
**Tavsiya: kunlik kuryer tarifi × 3** (sozlanuvchi konstanta). Bitta kuryer bir reysda 80 ta so'rov yuborib marketni ko'mib tashlamasligi uchun.

**12. `auto_approve_under` uchun boshlang'ich tavsiya?**
**Tavsiya: 0 (o'chiq) — market o'zi yoqadi.** Amaliyotda 5 000 so'm yaxshi boshlang'ich: market faqat shubhalilarni ko'radi.

**13. Pilot: qaysi market va muvaffaqiyat mezoni?**
**Tavsiya:** eng ko'p shikoyat qilgan 1 market, 1 hafta. Mezonlar: (a) o'rtacha xarajat summasi kamaydimi; (b) rad etish foizi (>50% = market suiiste'mol qilyapti yoki kuryerlar haqiqatan sababsiz yozgan); (c) kuryerlarning o'sha market buyurtmalarini olishdan bosh tortishi bo'ldimi; (d) `price_cut` audit tabida keskin o'sish bo'ldimi (= kuryerlar aylanma yo'lga o'tdi). (c) yoki (d) ko'rinsa — bayroq o'chiriladi va qoidalar qayta ko'riladi.