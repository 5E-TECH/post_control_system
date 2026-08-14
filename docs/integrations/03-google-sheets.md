# Google Sheets integratsiyasi — To'liq joriy etish rejasi (Post Control System)

> Hujjat maqsadi: NestJS + TypeORM + Postgres asosidagi buyurtma/yetkazib berish tizimini **Google Sheets API v4** bilan ishonchli, bosqichma-bosqich integratsiya qilish. Barcha qaror mavjud kodbazaga (`ldg-cargo`, `external-integration`, `integration-sync`) moslashtirilgan.
>
> **INPUT B tuzatishi qo'llanildi:** `googleapis` npm paketining joriy major versiyasi **v173.x** (v14x EMAS), hamrohi `google-auth-library` **v10.9.1**. Rejaning hamma joyida shu versiyalar ko'rsatilgan.

> ## ✅ QARORLAR QO'LLANILDI (2026-07-25)
> - **Q1 Tenancy = PER-MARKET** — har market o'z jadvaliga yozadi. §4.2'dagi singleton qarori **per-market'ga o'zgardi**: `gsheets_config` endi `market_id` FK + `spreadsheet_id` per-market (yoki `gsheets_market_target` jadvali). Amaliy model: **bitta platforma service-account bo'ladi**, har market o'z jadvalini shu SA email'ga **Editor** qilib ulashadi va `spreadsheet_id` beradi (SA bitta, jadval per-market). Xohlasa market o'z SA JSON'ini ham berishi mumkin.
> - **Q2 Yo'nalish = FAQAT OUTBOUND** — bu Sheets uchun allaqachon yagona variant edi (webhook yo'q). → **"Faza 3 (Drive files.watch / ikki tomonlama)" butunlay OLIB TASHLANADI**. Reja Faza 0→1→2 bilan tugaydi.
> - **Q3a Bosqichlar = TO'LIQ 6 BOSQICH** — barcha status yangilanishlari (`F` ustuni) yoziladi; Faza 2 hook'larining barchasi yoqiladi.
> - **Q3b Maydonlar = BARCHASI** (§5.1) — mijoz ism+telefon, manzil+tuman, summa+№, kuryer, mahsulotlar. Ustunlar to'liq to'ldiriladi.
> - **Q4 Maxfiylik:** to'liq PII jadvalga chiqadi → jadval **faqat o'sha market + minimal odam** bilan ulashiladi (har market o'z jadvalini ko'radi); jadval odamlar uchun **read-only** (protected range) tavsiya etiladi.

---

## 1. Maqsad va yo'nalish

### Nimani integratsiya qilamiz

Har bir buyurtmaning hayotiy sikli (yaratildi → yetkazildi → sotildi/bekor qilindi) **Google Sheets jadvaliga** avtomatik ko'chib boradi. Sheet — biznes uchun **jonli, o'qish uchun mo'ljallangan oyna** (marketlar/menejerlar Excel-ko'rinishida buyurtmalarni kuzatadi, filtrlaydi, hisobot chiqaradi), bizning Postgres bazamiz esa **yagona haqiqat manbai** (source of truth) bo'lib qoladi.

### Yo'nalish qarori: **bizdan → Sheets (outbound / write-only mirror)**

```
┌─────────────────────────┐         push (bir tomonlama)        ┌──────────────────┐
│  Post Control System     │  ───────────────────────────────▶  │  Google Sheets    │
│  (Postgres = HAQIQAT)    │        append + update              │  (ko'zgu / oyna)  │
└─────────────────────────┘                                     └──────────────────┘
        ▲                                                                 │
        │  Inbound (Sheetdan → bizga) — TAVSIYA ETILMAYDI (3-fazagacha yopiq)
        └─────────────────────────  X  ──────────────────────────────────┘
                          (Sheets API webhook bermaydi; §2, §6, §8 ga qarang)
```

**Nega bir tomonlama (outbound)?** — INPUT B dan tasdiqlangan uchta qattiq fakt:

| Sabab | Manba (INPUT B) | Xulosa |
|---|---|---|
| Sheets API'da **webhook / event stream YO'Q** | `events_webhooks` (confirmed) | Sheet o'zgarganini bizga "push" qilib bo'lmaydi |
| Yagona inbound yo'l — **Drive `files.watch`**, u faqat **fayl darajasida** ("nimadir o'zgardi"), qaysi katak/qator o'zgarganini AYTMAYDI + kanal **1 kunda** eskiradi, auto-renew yo'q | `events_webhooks` (confirmed) | Ikki tomonlama sync qimmat va nozik |
| Sheets — **query'siz do'kon**: server-side WHERE/index yo'q, faqat A1 range bo'yicha o'qiladi | `read_search`, `overview` (confirmed) | Sheetni haqiqat manbai qilib bo'lmaydi |

Shuning uchun: **bizning buyurtma state-machine'imiz Sheetni boshqaradi**, aksincha emas. Bu tizimning mavjud outbound konvensiyasi (`queueStatusSync`, `ldgShipmentService.createShipmentForOrder`) bilan to'liq mos.

### Qaysi buyurtma hodisalari trigger bo'ladi

Buyurtma hayotiy siklidagi (INPUT A, "ORDER Lifecycle" xaritasi) muhim commit nuqtalari:

| # | Hodisa | Sheets amali | Priyoritet |
|---|---|---|---|
| 1 | Buyurtma yaratildi (NEW) | **append** (yangi qator) | Faza 1 |
| 2 | RECEIVED (qabul qilindi) | **update** (status ustuni) | Faza 2 |
| 3 | ON_THE_ROAD (yo'lga chiqdi) | update | Faza 2 |
| 4 | WAITING (kuryer qabul qildi) | update | Faza 2 |
| 5 | SOLD / PAID / PARTLY_PAID (sotildi) | update (+ summa, sold_at) | Faza 1 |
| 6 | CANCELLED (bekor) | update (+ rang) | Faza 1 |
| 7 | CANCELLED_SENT → CLOSED | update | Faza 2 |
| 8 | rollback (qaytarish) | update | Faza 2 |

> **Faza 1 (MVP):** yaratildi + sotildi + bekor = 3 ta eng muhim hodisa. Qolganlari Faza 2.

---

## 2. Maʼlumot oqimi (diagramma)

### Umumiy arxitektura oqimi

```
  ORDER SERVICE (mavjud)                  YANGI MODUL: gsheets/                    GOOGLE
 ┌──────────────────────┐        ┌──────────────────────────────────────┐    ┌──────────┐
 │ createOrder   :505   │        │                                        │    │          │
 │ sellOrder     :2754  │ commit │  GsheetsSyncService.enqueue(...)        │    │          │
 │ cancelOrder   :3025  │───────▶│         │                              │    │          │
 │ partlySold    :3532  │ (fire  │         ▼                              │    │  Sheets  │
 │ rollback      :4099  │ &forget│  ┌──────────────────┐                  │    │  API v4  │
 └──────────────────────┘        │  │ gsheets_sync_queue│  (durable)      │    │          │
                                 │  │ status/attempts/  │                 │    │ append   │
    @Cron('*/30 * * * * *')      │  │ next_retry_at     │                 │    │ update   │
         drainer  ───────────────┼─▶│ FOR UPDATE        │                 │    │ batch    │
                                 │  │ SKIP LOCKED       │                 │    │          │
                                 │  └────────┬─────────┘                  │    └────┬─────┘
                                 │           │ claimJobs(batch)           │         │
                                 │           ▼                            │         │
                                 │  ┌──────────────────┐   Bearer token   │         │
                                 │  │ GsheetsApiService │─────────────────┼────────▶│
                                 │  │ (googleapis v173) │◀────updatedRange─┼─────────│
                                 │  └────────┬─────────┘                  │         │
                                 │           │ updatedRange="Orders!A42"  │         │
                                 │           ▼                            │         │
                                 │  ┌──────────────────┐                  │         │
                                 │  │ gsheets_row_map   │  order_id→row 42 │        │
                                 │  │ (idempotentlik)   │  (O(1) update)   │        │
                                 │  └──────────────────┘                  │         │
                                 └────────────────────────────────────────┘         │
                                     Singleton config: gsheets_config              │
                                     (SA JSON shifrlangan, is_active, toggles)      │
```

### Hodisa → Google Sheets amali (jadval)

| Buyurtma hodisasi | Bizning holat (Order_status) | Sheets API amali | Qaysi katak/qator | Idempotentlik kaliti |
|---|---|---|---|---|
| Yaratildi | `created`→`new` | `values.append` | jadval oxiri, yangi qator | `order_id` yo'q → yangi qator; bor → skip |
| Qabul qilindi | `received` | `values.update` | `Orders!<status_col><row>` | `gsheets_row_map`dan `row` |
| Yo'lda | `on the road` | `values.update` | status ustuni | row_map |
| Kutilmoqda | `waiting` | `values.update` | status ustuni | row_map |
| Sotildi | `sold`/`paid`/`partly_paid` | `values.batchUpdate` (status+summa+sana) | bir nechta ustun, bir qator | row_map |
| Bekor qilindi | `cancelled` | `values.update` (+ `batchUpdate` rang) | status ustuni | row_map |
| Yuborildi/Yopildi | `cancelled (sent)`/`closed` | `values.update` | status ustuni | row_map |
| Rollback | oldingi→`waiting` | `values.update` | status ustuni | row_map |

---

## 3. Autentifikatsiya va dastlabki sozlash

### 3.1 Google tomonidagi qadamlar (bir martalik, qo'lda)

```
1. Google Cloud Console → loyiha yarating (yoki mavjudini oling)
2. "APIs & Services" → Sheets API'ni YOQING
      └─ Drive API'ni YOQING FAQAT agar backend yangi jadval yaratsa/share qilsa (Faza 3)
3. "IAM & Admin" → "Service Accounts" → Create service account
      └─ nom: post-control-sheets@<project-id>.iam.gserviceaccount.com
4. Service account → "Keys" → Add key → Create new key → JSON → yuklab oling
      └─ Google nusxa saqlamaydi; bir marta yuklanadi, xavfsiz saqlang
5. ⚠️ ENG MUHIM (ko'pincha unutiladi):
      Maqsadli jadvalni brauzerda oching → "Share" → SA emailini
      Editor sifatida qo'shing, "Notify" ni O'CHIRING (SA'da inbox yo'q)
      └─ Bu share'siz SA valid kalit bilan ham 403/404 oladi (INPUT B: auth)
```

### 3.2 Scope (least-privilege, §9 ga bog'liq)

| Scope | Nima uchun | Bizda ishlatiladimi |
|---|---|---|
| `https://www.googleapis.com/auth/spreadsheets` | o'qish + yozish (qator qo'shish, status yangilash) | **HA** (asosiy) |
| `.../auth/spreadsheets.readonly` | faqat o'qish | yo'q |
| `.../auth/drive.file` | faqat ilova yaratgan fayllar | Faza 3 (jadval avto-yaratish) |
| `.../auth/drive` | butun Drive | **YO'Q** (ortiqcha huquq) |

### 3.3 Sirlarni qayerda saqlaymiz (env vs DB)

INPUT A "config-infra" xaritasidagi sanksiyalangan pattern: **infra-darajali yagona master kalit → env; runtime-tunable + per-tenant + audit kerak bo'lgan hamma narsa → DB config entity**.

| Sir / sozlama | Joy | Sabab |
|---|---|---|
| `SHEETS_ENC_KEY` (AES-256-GCM master kalit) | **env** (`src/config/index.ts`) | Deploy-baked, hamma uchun bir xil, admin-invisible. `.env.example`ga bo'sh qiymat bilan |
| Service Account JSON (`private_key`, `client_email`, ...) | **DB, shifrlangan** (`gsheets_config.sa_json_enc`) | Admin runtime'da almashtira olishi kerak; redeploysiz; audit; §9 crypto-transformer |
| `spreadsheet_id`, tab nomi | **DB** (`gsheets_config` yoki per-market map) | Runtime o'zgaradi, marketga qarab farq qiladi |
| `is_active`, `sync_enabled`, `auto_retry_enabled` | **DB** (`gsheets_config`) | Admin kill-switch/toggle (§8) |

> **Muhim:** SA `private_key` env orqali kelsa, `key.replace(/\\n/g, '\n')` bilan qator ko'chirishlarni tiklash kerak (INPUT B: node_library). Bizda esa u DB'da shifrlangan `text` sifatida yotadi — transformer dekript qilganda to'g'ri PEM qaytaradi.

### 3.4 Token-refresh sikli

**Biz hech narsa yozmaymiz.** `google-auth-library` (v10.9.1) `GoogleAuth`/`JWT` obyekti JWT'ni self-sign qiladi, `https://oauth2.googleapis.com/token`ga POST qiladi, 1 soatlik (`expires_in: 3600`) access-token oladi va **avtomatik yangilaydi**. Biz DI-provider'da `GoogleAuth`ni **bir marta** yaratamiz (u token'ni keshlaydi/yangilaydi).

```
  GsheetsApiService (singleton provider)
        │  ilk chaqiruv
        ▼
  GoogleAuth(credentials from gsheets_config, scopes)
        │  → self-signed JWT → oauth2.googleapis.com/token
        ▼
  access_token (1 soat) ── keshlanadi ──▶ har API chaqiruvda Bearer sifatida
        │
        └─ 55-daqiqada / muddat tugashidan oldin kutubxona O'ZI yangilaydi
```

> ⚠️ **Qo'lda JWT imzolamang** — Google crypto xatolari jiddiy muammo tug'diradi (INPUT B). `ldg-api.service.ts`dagi `X-API-Key` header pattern'idan farqli o'laroq, bu yerda auth'ni kutubxona boshqaradi.

---

## 4. Arxitekturaga ulanish

### 4.1 Asosiy qaror: YANGI maxsus modul (`ldg-cargo` uslubida), generic engine'ni EMAS

INPUT A "engine" xaritasi mavjud `external-integration` + `integration-sync` mexanizmini generic-vs-hardcoded jihatdan tahlil qilib, aynan CRM/Sheets uchun **"yangi maxsus modul afzal"** degan xulosaga kelgan. Quyida shu qaror THIS tizim uchun asoslanadi:

| Talab | `external-integration` engine buni bera oladimi? | Xulosa |
|---|---|---|
| **Auth: SA JWT (service-account)** | Yo'q — faqat `api_key` \| `login` (`external-integration.entity.ts:105`); Bearer-only push (`:359`) | ✗ yangi auth strategiyasi kerak |
| **To'liq qator body** (raqam, ism, telefon, region, summa) | Yo'q — body faqat `{ status_field: mappedStatus }` (`integration-sync.service.ts:126-133`); `field_mapping` push'da ishlatilmaydi | ✗ full-body builder kerak |
| **Korrelyatsiya: `{id}` yo'q, qator raqamini eslash** | Yo'q — templating faqat `{id}` (`:340`), external_id kutadi | ✗ `row_map` jadvali kerak |
| **Barcha manbalar** (bot/AI/operator, `external_id`siz) | Yo'q — `queueStatusSync` `order.external_id` + `operator='external_'` bo'lmasa **jim qaytadi** (`:78-97`) | ✗ bot/AI/web buyurtmalar Sheetga tushmaydi |
| **Integratsiyani topish** | Faqat inbound-tagged orderlar orqali (`operator='external_<slug>'`) | ✗ Sheet'da bunday order yo'q → hech qachon enqueue bo'lmaydi |
| **Durable queue + atomik claim + retry + stale recovery** | **HA** — bu qism generic va ajoyib (`claimJobs` `FOR UPDATE SKIP LOCKED`, `RETRY_DELAYS`, `reclaimStaleProcessing`) | ✓ **shu pattern'ni takrorlaymiz** |

**Yakuniy qaror:**
- **Yangi `src/api/gsheets/` moduli** — `ldg-cargo` skeletini nusxalaymiz (INPUT A "ldg-pattern" cheklisti 1-19).
- **Queue engine — mafkurani takrorlaymiz** (o'z `gsheets_sync_queue` jadvali bilan): atomik claim, backoff, stale reclaim, cron+on-demand. `integration_sync_queue`ni to'g'ridan qayta ishlatmaymiz, chunki uning `SyncAction` lug'ati (`'sold'|'canceled'|...`) va enqueue shakli order-centric va `external_id`ga bog'langan.

### 4.2 Yangi entity'lar (3 ta, `ldg-cargo` uslubida)

```
src/core/entity/
├── gsheets-config.entity.ts     ← SINGLETON (getOrCreate), ldg_config uslubida
├── gsheets-sync-queue.entity.ts ← durable queue, integration_sync_queue uslubida
└── gsheets-row-map.entity.ts    ← order_id ↔ (spreadsheet, tab, row) — idempotentlik yadrosi
```

#### `gsheets_config` (singleton)

| Ustun | Tur | Izoh |
|---|---|---|
| `id`, `created_at`, `updated_at` | BaseEntity | uuid + bigint ms |
| `sa_json_enc` | `text` (crypto-transformer) | SA JSON, AES-256-GCM shifrlangan (§9) |
| `spreadsheet_id` | `varchar` | Platforma-darajali standart jadval |
| `sheet_tab` | `varchar` default `'Orders'` | Tab nomi |
| `status_column` | `varchar` default `'F'` | Status qaysi ustunda |
| `is_active` | `boolean` default `false` | **master kill-switch** (§8) |
| `sync_enabled` | `boolean` default `true` | outbound push toggle |
| `auto_retry_enabled` | `boolean` default `true` | cron retry toggle |
| `header_written` | `boolean` default `false` | header qatori bir marta yozilganini belgilash |
| `total_synced` / `last_error` / `last_synced_at` | bigint/text/bigint | telemetriya |

> **Tenancy qarori:** Platformada **bitta service account bitta jadvalga** yozadi (INPUT B'dagi "one platform-wide SA" ssenariysi) → **singleton** (`ldg_config` uslubi). Agar keyinchalik har market o'z jadvaliga yozishi kerak bo'lsa, `gsheets_market_target(market_id, spreadsheet_id, tab)` per-market jadvalini qo'shamiz (Faza 3, ochiq savol §12).

#### `gsheets_sync_queue` (durable)

| Ustun | Tur | Izoh |
|---|---|---|
| `id`, timestamps | BaseEntity | |
| `order_id` | uuid, indexed | qaysi buyurtma |
| `operation` | `varchar` | `'append'` \| `'update_status'` \| `'update_full'` |
| `status` | `varchar` default `'pending'` | `pending`/`processing`/`success`/`failed` |
| `attempts` / `max_attempts` | int / int default 3 | |
| `next_retry_at` | **bigint nullable** — `bigintTransformer` (NonNull EMAS!) | INDEXED; backoff (§8 tuzoq) |
| `payload` | `jsonb` | qator qiymatlari (append) yoki yangi status |
| `processing_started_at` | bigint nullable | stale reclaim uchun |
| `last_error` / `last_response` / `synced_at` | text/text/bigint | |

#### `gsheets_row_map` (idempotentlik)

| Ustun | Tur | Izoh |
|---|---|---|
| `order_id` | uuid **PRIMARY KEY** | 1 order = 1 qator (dedup yadrosi) |
| `spreadsheet_id` | varchar | |
| `sheet_tab` | varchar | |
| `row_number` | int | `updates.updatedRange`dan olingan (masalan 42) |
| `a1_range` | varchar | `"Orders!A42:G42"` to'liq range |
| `created_at` | bigint | |

> **bigint transformer tuzog'i (INPUT A + MEMORY):** `next_retry_at` — DB-default/sequence EMAS, nullable, shuning uchun **`bigintTransformer`** (nullable-safe). `bigintTransformerNonNull` ISHLATMANG — u `null→0` yozadi va `IS NOT NULL` filtrni zaharlaydi (aynan `mismatch_at` va `order_number=0` buglari). `created_at`/`updated_at` esa `BaseEntity`'da NonNull.

### 4.3 Migratsiya

INPUT A "config-infra" §3 uslubi: hozirgi eng yuqori raqam `1748400000000-LdgMismatchAtZeroFix.ts`. Keyingisi:

```
src/migrations/1748500000000-GsheetsIntegration.ts
  class GsheetsIntegration1748500000000 implements MigrationInterface
  up():   CREATE TABLE IF NOT EXISTS gsheets_config / gsheets_sync_queue / gsheets_row_map
          + CREATE INDEX (order_id, status, next_retry_at)
  down(): DROP TABLE IF EXISTS ... (teskari tartibda)
  → idempotent, IF NOT EXISTS / IF EXISTS, real down()
```

Ishlab chiqish oqimi: entity yozish → `npm run migration:generate --name=GsheetsIntegration` → idempotentligini + `down()`ni tekshirish → `migration:run`. `synchronize:false` (majburiy).

### 4.4 Modul strukturasi (fayl-reja, `ldg-cargo` konvensiyasi)

```
src/api/gsheets/
├── gsheets.module.ts            ← wiring (pastda)
├── gsheets-api.service.ts       ← TRANSPORT: googleapis client, backoff, write-queue
├── gsheets-sync.service.ts      ← OUTBOUND domain: order→row DTO, enqueue, processJob
├── gsheets-config.service.ts    ← CONFIG CRUD: getOrCreate, secret masking, getSafe
├── gsheets-admin.service.ts     ← OPS: health, paginated queue list, manual retry, @Cron
├── gsheets-config.controller.ts ← JWT + ADMIN: GET(masked)/PATCH, test-connection
├── gsheets-admin.controller.ts  ← JWT + ADMIN: queue list, retry, automation toggles
├── dto/
│   ├── gsheets-config.dto.ts     ← update DTO (validated)
│   ├── gsheets-row.dto.ts        ← order→row mapping shape
│   └── gsheets-column-map.ts     ← ustun tartibi (A=order_number, B=..., F=status)
└── utils/
    ├── gsheets-column.util.ts    ← A1 helper: (col,row)→"Orders!F42", 1-based
    └── gsheets-status.mapper.ts  ← Order_status → Sheet label (uzbekcha), pure fn
```

> **E'tibor:** `ldg-cargo`da webhook bor edi (3 controller), bizda **outbound-only** — shuning uchun `WebhookController`/`WebhookService`/`signature.util` **Faza 3 gacha yo'q** (Sheets webhook bermaydi). Bu modulni soddalashtiradi.

#### Module wiring (`gsheets.module.ts`)

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([GsheetsConfigEntity, GsheetsSyncQueueEntity,
                              GsheetsRowMapEntity, OrderEntity, UserEntity, DistrictEntity]),
    // HttpModule KERAK EMAS — googleapis o'z HTTP-stack'iga ega; agar
    // "plain axios + faqat token" varianti tanlansa, HttpModule qo'shiladi.
    forwardRef(() => OrderModule),   // enqueue OrderService'dan chaqiriladi
  ],
  controllers: [GsheetsConfigController, GsheetsAdminController],
  providers:   [GsheetsApiService, GsheetsSyncService, GsheetsConfigService, GsheetsAdminService],
  exports:     [GsheetsSyncService],   // OrderService faqat shuni inject qiladi
})
export class GsheetsModule {}
```

Ro'yxatga olish: `src/api/app.module.ts` `imports` massiviga `GsheetsModule` qo'shiladi (yagona joy). `ScheduleModule.forRoot()` allaqachon global. `ActivityLogModule` `@Global` — inject qilish yetarli.

---

## 5. Field & status mapping

### 5.1 Buyurtma maydonlari → Sheet ustunlari

Manba: INPUT A "ORDER Lifecycle" §3 (order shape + relations). E'tibor: ism/telefon/region **relation orqali** olinadi.

| Ustun | Sarlavha (uzbek) | Manba maydon | Yo'l |
|---|---|---|---|
| A | Buyurtma № | `order.order_number` | to'g'ridan (bigint `#100000+`) |
| B | Sana | `order.created_at` | ISO string (ms→ISO) |
| C | Mijoz | `order.customer.name` | `order.customer` (relation `:230`) |
| D | Telefon | `order.customer.phone_number` | relation |
| E | Region/Tuman | `order.district.region` / `.sato_code` | `order.district` (relation `:236`) |
| **F** | **Holat** | `order.status` | **status ustuni — update shu yerga** |
| G | Summa | `order.total_price` | to'g'ridan (raqam) |
| H | To'langan | `order.paid_amount` | sotuvda yangilanadi |
| I | Manzil | `order.address` | to'g'ridan |
| J | Operator | `order.operator` | snapshot maydon `:90` |
| K | Sotilgan sana | `order.sold_at` | sotuvda to'ladi |
| L | Bekor sana | `order.cancelled_at` | bekorda to'ladi |

> `valueInputOption=USER_ENTERED` (INPUT B): raqamlar/sanalar tiplangan qiymat bo'ladi. Telefon `+998...` — old nolni yo'qotmaslik uchun matn sifatida yuboriladi (yoki `'` prefiks).

### 5.2 Order_status → Sheet holat yorlig'i (uzbekcha, `status-label.util` uslubida)

| Order_status (enum `:46`) | Sheet yorlig'i (F ustuni) | Rang (Faza 2, `batchUpdate`) |
|---|---|---|
| `created` | Yaratilgan | — |
| `new` | Yangi | oq |
| `received` | Qabul qilingan | ko'k |
| `on the road` | Yo'lda | sariq |
| `waiting` | Kutilmoqda | to'q sariq |
| `sold` | Sotildi | yashil |
| `paid` | To'langan | yashil |
| `partly_paid` | Qisman to'langan | och yashil |
| `cancelled` | Bekor qilindi | qizil |
| `cancelled (sent)` | Bekor (yuborildi) | to'q qizil |
| `closed` | Yopildi | kulrang |

> Mapping `gsheets-status.mapper.ts`da **static `Record<Order_status, {label, color}>`** — `ldg-status.mapper.ts`dagi module-load invariant uslubi (noma'lum status → log, hech narsa o'zgarmaydi).

---

## 6. API chaqiruvlari (tasdiqlangan endpointlar)

Barcha endpointlar INPUT B "VERIFICATION" bo'limida tasdiqlangan. `googleapis` v173.x client orqali.

### 6.1 CREATE — yangi buyurtma qatori (`values.append`)

```
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}
       /values/Orders!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS
```
```ts
const res = await sheets.spreadsheets.values.append({
  spreadsheetId, range: 'Orders!A1',
  valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
  requestBody: { values: [[ '100042','2026-07-25T10:15:00Z','Ali Valiyev',
                            "'+998901234567",'Toshkent','Yangi',150000 ]] },
});
// res.data.updates.updatedRange === "Orders!A42:G42"  ← BU MUHIM
```
**Javobdan `updates.updatedRange`ni oling** → `gsheets_row_map`ga saqlang: `order_id=... → row 42, a1_range="Orders!A42:G42"`. Shu mapping keyingi update'larni **O(1)** qiladi va nozik "o'qi-keyin-skan" pattern'idan qutqaradi (INPUT B: create_record).

### 6.2 UPDATE STATUS — mavjud qator (`values.update`)

```
PUT https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}
     /values/Orders!F42?valueInputOption=USER_ENTERED
```
```ts
await sheets.spreadsheets.values.update({
  spreadsheetId, range: 'Orders!F42',   // row_map'dan row=42, status_column='F'
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [['Sotildi']] },
});
```

### 6.3 SOTUV — bir necha ustunni bir chaqiruvda (`values.batchUpdate`)

```
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values:batchUpdate
```
```ts
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: { valueInputOption: 'USER_ENTERED', data: [
    { range: 'Orders!F42', values: [['Sotildi']] },     // status
    { range: 'Orders!H42', values: [[150000]] },        // to'langan
    { range: 'Orders!K42', values: [['2026-07-25T12:00:00Z']] }, // sold_at
  ]},
});
```
> Bir buyurtma o'zgarishida bir nechta katakni **bitta HTTP** bilan yangilash — kvota tejaydi (§8 rate-limit).

### 6.4 RANG/FORMAT (Faza 2, `spreadsheets.batchUpdate`, 0-based!)

```
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}:batchUpdate
  requests: [{ repeatCell: { range: {sheetId, startRowIndex:41, endRowIndex:42, ...},
               cell: {userEnteredFormat:{backgroundColor:{red:0.9,...}}}, fields:"..." }}]
```
> ⚠️ Bu API **0-based `GridRange`** ishlatadi (A1 1-based emas). 42-qator = `startRowIndex:41`. Buni `gsheets-column.util.ts`da izolyatsiya qilamiz.

### 6.5 IDEMPOTENTLIK LOOKUP (fallback, `values.get`)

Sheet'da server-side query YO'Q (INPUT B: read_search). Idempotentlik asosan **bizning `gsheets_row_map`** orqali. Faqat map buzilgan/yo'qolgan holatda fallback: butun `Orders!A:A` (order_number ustuni) o'qib, client-side qidiramiz — sekin, faqat recovery uchun.

### 6.6 WEBHOOK RECEIVE — Faza 3 (Drive `files.watch`, ixtiyoriy)

```
POST https://www.googleapis.com/drive/v3/files/{fileId}/watch
  { "id":"<uuid ≤64>", "type":"web_hook", "address":"https://<domain>/api/v1/gsheets/webhook" }
```
> Faqat "nimadir o'zgardi" (fayl-daraja); qaysi katak — bilinmaydi → Sheet o'qib **diff** qilinadi. Kanal **≤86400s** yashaydi, auto-renew yo'q → `@Cron` bilan qayta chaqirish. **Faza 3 gacha ochiq** (§10, §12).

---

## 7. Hodisa nuqtalari (kod)

Mavjud konvensiya (INPUT A §5, "Hook Points"): **`commitTransaction`dan KEYIN, fire-and-forget (await QILINMAYDI)**, `activityLog.log(...)` va `orderBotService.syncStatusButton(...)` yonida. Biz `GsheetsSyncService.enqueue(orderId, operation)`ni shu joylarga qo'shamiz.

> **Muhim farq `queueStatusSync`dan:** bizning `enqueue` **`external_id` ga BOG'LANMAYDI** — u barcha manbalarni (bot/AI/operator/web) qabul qiladi, chunki Sheet hamma buyurtmani ko'rsatishi kerak. Bu INPUT A §5'dagi "external_id requirement ... needs a firing path that does not gate on external_id" tavsiyasiga to'g'ridan javob.

| CRM hodisasi | Fayl:metod:qator (commit) | `enqueue` chaqiruvi | Faza |
|---|---|---|---|
| Yaratildi (web/AI) | `order.service.ts` `createOrder` commit **:505** | `enqueue(order.id, 'append')` | 1 |
| Yaratildi (bot) | `createOrderByBot` commit **:871** | `enqueue(order.id, 'append')` | 1 |
| Yaratildi (external) | `receiveExternalOrders` commit **:5885** | `enqueue(order.id, 'append')` | 1 |
| Sotildi | `sellOrder` commit **:2754** | `enqueue(order.id, 'update_full')` | 1 |
| Qisman sotildi | `partlySold` commit **:3532** | `enqueue(order.id, 'update_full')` | 1 |
| Bekor qilindi | `cancelOrder` commit **:3025** | `enqueue(order.id, 'update_status')` | 1 |
| Rollback | `rollbackOrderToWaiting` commit **:4099** | `enqueue(order.id, 'update_status')` | 2 |
| NEW→RECEIVED | `receiveNewOrders` **:1853** / `receiveWithScaner` **:1974** | `enqueue(..., 'update_status')` | 2 |
| RECEIVED→ON_THE_ROAD | `post.service.ts` `sendPost` **:929** | `enqueue(..., 'update_status')` | 2 |
| ON_THE_ROAD→WAITING | `post.service.ts` receivePost oilasi (**:1059/1159/1224/1329**) | `enqueue(..., 'update_status')` | 2 |
| CANCELLED_SENT→CLOSED | `receiveWithScaner` **:1907/:1910** | `enqueue(..., 'update_status')` | 2 |
| Group approval CREATED→NEW | `order-bot.service.ts` `processOrderAction` **:632** | `enqueue(..., 'update_status')` | 2 |

**Inject qilish:** `OrderService` konstruktoriga `private readonly gsheetsSyncService: GsheetsSyncService` (`:123` yonida, `integrationSyncService` singari). `post.service.ts` va `order-bot.service.ts`ga ham (Faza 2).

```
  createOrder(...) {
     ...await queryRunner.commitTransaction();          // :505
     this.activityLog.log({...});                        // mavjud
     this.gsheetsSyncService.enqueue(order.id,'append'); // YANGI — await EMAS
  }
```

---

## 8. Ishonchlilik

### 8.1 Navbat va qayta urinish (queue engine — `integration-sync` mafkurasi)

```
  enqueue(orderId, op) ──▶ gsheets_sync_queue INSERT (pending) ──▶ triggerWorker()
                                        │
                       @Cron('*/30 * * * * *')  ← 30s backstop drainer
                                        ▼
   ┌────────────────────────── processQueue() ──────────────────────────┐
   │ 1) reclaimStaleProcessing()  — processing > 10min → pending/failed  │
   │ 2) claimJobs(BATCH=10)       — FOR UPDATE SKIP LOCKED, →processing,  │
   │                                attempts++  (ko'p-instance xavfsiz)  │
   │ 3) har birini ketma-ket, 500ms interval bilan processJob()          │
   └─────────────────────────────────────────────────────────────────────┘
```

**Retry/backoff (ikki qatlam):**

| Qatlam | Mexanizm | Manba |
|---|---|---|
| Queue-level | `RETRY_DELAYS = [60s, 5min, 15min]`, `max_attempts=3`; `next_retry_at` orqali qayta claim | `integration-sync` pattern |
| HTTP-level | Faqat **429 / 500 / 503** + tarmoq xatosi → truncated exponential backoff `min((2^n)+jitter, 32s)`, `Retry-After` hurmat qilinadi | INPUT B: rate_limits (tasdiqlangan) |

> **Biznes xatolari (masalan 403 share yo'q, 400 noto'g'ri range) retry QILINMAYDI** — darhol `failed`, `last_error`ga yoziladi (LDG `success:false` uslubi).

### 8.2 Idempotentlik strategiyasi (Sheets lookup cheklovi hisobga olingan)

Sheet'da index/WHERE yo'q (INPUT B), shuning uchun **idempotentlik butunlay bizning tomonda**:

```
  append (yaratish):
     ┌─ gsheets_row_map'da order_id BORmi?
     │     HA  → skip (qator allaqachon bor, dublikat oldini olindi)
     │     YO'Q→ values.append → javobdan updatedRange → row_map'ga INSERT
     └─ INSERT ... ON CONFLICT (order_id) DO NOTHING  ← poyga xavfsizligi

  update (status):
     ┌─ gsheets_row_map'dan row olamiz
     │     BOR → values.update Orders!F<row>
     │     YO'Q→ avval 'append' enqueue (qator hali yaratilmagan), keyin update
     └─ update tabiatan idempotent (bir xil qiymat qayta yozilsa ham zararsiz)
```

| Xavf | Yechim |
|---|---|
| Bir order ikki marta append | `gsheets_row_map.order_id` **PRIMARY KEY** + append oldidan tekshirish |
| Poyga (ikki worker bir vaqtda) | `claimJobs` `SKIP LOCKED` + `row_map` `ON CONFLICT DO NOTHING` |
| append muvaffaqiyatli, lekin `updatedRange` parse bo'lmadi | LDG uslubi: **throw** (null saqlamaslik), idempotency kaliti retry'ni xavfsiz qiladi |
| Update keldi, lekin qator hali yo'q (append navbatda) | update jobni append'dan keyin ishlash: append muvaffaqiyatsiz bo'lsa update `pending` qoladi (order bo'yicha tartib) |

### 8.3 Rate-limit muvofiqligi (tasdiqlangan limitlar)

| Limit (INPUT B, confirmed) | Bizning javob |
|---|---|
| Write **300/min loyiha**, **60/min per-user (SA=1 user)** | `enqueueWrite` serialized promise-queue + **1s gap** (LDG `LDG_WRITE_GAP_MS` uslubi) → 60/min ostida |
| Read/Write **alohida** buketlar | Biz asosan write; idempotentlik DB'da → read minimal |
| Bir so'rov **≤180s** | Har chaqiruvda timeout; batch bilan chaqiruvlar soni kam |
| Sheet **10M katak / 18278 ustun** | **Rotatsiya rejasi:** tab to'lganda yangi tabga o'tish (`gsheets_config.sheet_tab` + `header_written`), §12 ochiq savol |
| Burst status o'zgarishlari | `values.batchUpdate` bilan bir chaqiruvga yig'ish |
| 2026 oxiridan kvota oshib ketsa billing | Monitoring; kvota ogohlantirish (§12) |

### 8.4 Kill-switch (LDG toggle iyerarxiyasi)

```
  is_active (master, default false) ──── OFF ──▶ na enqueue, na processJob (butun integratsiya to'xtaydi)
       │ ON
       ├─ sync_enabled=false      → yangi enqueue to'xtaydi (mavjud queue drenaj bo'ladi)
       └─ auto_retry_enabled=false→ @Cron retry loop erta return
```
Har worker/cron boshida: `if (!config?.is_active || !config?.sync_enabled) return;` (INPUT A "config-infra" §5.2).

### 8.5 Xato ishlanishi

- `enqueue` — best-effort; xato `last_error`ga tushadi, **asosiy order oqimini hech qachon buzmaydi** (fire-and-forget, LDG `createShipmentForOrder` uslubi).
- `activityLog.log` — `@Global`, o'z xatolarini yutadi (`activity-log.service.ts:98`), await qilib rethrow qilmaymiz.
- Doimiy `failed` joblar — admin panelda ko'rinadi, `retry`/`bulkRetry` bilan tiklanadi.

---

## 9. Xavfsizlik

### 9.1 Sirlarni saqlash va maskalash

INPUT A "config-infra" §2 — hozirgi holat: sirlar plaintext varchar. SA JSON juda nozik (private_key) shuning uchun **shifrlab saqlaymiz** (mavjud tavsiya etilgan best-practice):

```
  gsheets_config.sa_json_enc  (text)
        │  o'qishda                    │  yozishda
        ▼                              ▼
  AES-256-GCM ValueTransformer  ◀──── SHEETS_ENC_KEY (env, ideal KMS-derived)
        │  bigint.transformer.ts uslubidagi TypeORM ValueTransformer slotiga tushadi
        ▼
  dekript qilingan PEM → GoogleAuth
```

| Qatlam | Amal |
|---|---|
| At-rest | `sa_json_enc` — AES-256-GCM, env master kalit `SHEETS_ENC_KEY` |
| Activity-log | `GSHEETS_CONFIG_SECRET_FIELDS = {'sa_json_enc'}` — hech qachon raw yozilmaydi, faqat `masked_fields: ['sa_json_enc']` (`LDG_CONFIG_SECRET_FIELDS` uslubi) |
| Read-back | `getSafe()` — raw qaytarmaydi, faqat `sa_json_set: !!sa_json_enc`, `spreadsheet_id`, toggle flag'lar (LDG `*_set` konvensiyasi) |

### 9.2 Webhook imzo / IP (Faza 3)

Faza 0–2 da **inbound webhook YO'Q** → bu bo'lim faqat Faza 3 (Drive `files.watch`) uchun:
- Drive push HMAC bermaydi; o'rniga `X-Goog-Channel-Token` (biz `watch`da o'rnatgan maxfiy token) + `X-Goog-Resource-State` header'larini tekshiramiz.
- Endpoint bizning `X-Goog-Channel-Id`ni DB'dagi faol kanal bilan solishtiradi (spoofing himoyasi).
- LDG uslubidagi raw-body + `@HttpCode(200)` (retry-storm oldini olish).

### 9.3 Least-privilege

| Amal | Beriladigan huquq |
|---|---|
| Qator o'qish/yozish | `auth/spreadsheets` (Drive YO'Q) |
| SA jadval egasi emas | Faqat maqsadli jadval Editor sifatida ulashilgan (butun Drive emas) |
| Jadval avto-yaratish (Faza 3) | `auth/drive.file` (faqat ilova yaratganlari, butun `auth/drive` emas) |
| SA JSON | Faqat backend server; git'ga hech qachon; `.env`da faqat master kalit |

---

## 10. Bosqichma-bosqich joriy etish

```
Faza 0 ──▶ Faza 1 ──▶ Faza 2 ──▶ Faza 3
skeleton   MVP mirror  to'liq LC  ikki tomon
```

### Bosqich 0 — Poydevor (skeleton, hech narsa yubormaydi)
**Deliverables:**
- `gsheets` moduli + 3 entity + migratsiya (`1748500000000-GsheetsIntegration.ts`)
- `gsheets_config` singleton (`getOrCreate`), `is_active=false` (o'chiq holatda tug'iladi)
- `GsheetsApiService` — `googleapis` v173.x + `google-auth-library` v10.9.1, `test-connection` (`spreadsheets.get` bilan ping, hech narsa yozmaydi)
- Config controller: `GET`(masked)/`PATCH`, SA JSON yuklash + AES shifrlash
- **Test:** `POST /gsheets/admin/test-connection` yashil bo'lishi (share + scope to'g'ri)

### Bosqich 1 — MVP: bir tomonlama status ko'zgu (3 hodisa)
**Deliverables:**
- `gsheets_sync_queue` + `gsheets_row_map` ishlaydigan queue (claim/retry/stale)
- `enqueue` + `processJob`: **append** (yaratildi) + **update_full** (sotildi) + **update_status** (bekor)
- Hook nuqtalari: `createOrder:505`, `createOrderByBot:871`, `sellOrder:2754`, `partlySold:3532`, `cancelOrder:3025`
- Header qatori bir marta yoziladi (`header_written`)
- `enqueueWrite` 1s gap (rate-limit); HTTP backoff (429/500/503)
- Kill-switch (`is_active`, `sync_enabled`)
- **Deliverable natijasi:** yangi buyurtma → Sheet'da qator paydo bo'ladi; sotilsa/bekor bo'lsa status yangilanadi

### Bosqich 2 — To'liq hayotiy sikl + admin ops
**Deliverables:**
- Qolgan hook'lar: RECEIVED, ON_THE_ROAD, WAITING, CLOSED, rollback, group-approval (§7, Faza 2 qatorlar) — `post.service.ts`, `order-bot.service.ts`ga inject
- Rang formatlash (`spreadsheets.batchUpdate`, 0-based) — bekor=qizil, sotildi=yashil
- `GsheetsAdminService`: `@Cron` auto-retry (2 daq), health/checklist, paginated queue list, manual retry, automation toggles
- Tab rotatsiyasi (10M katak limitiga yaqinlashganda yangi tab)
- **Deliverable:** to'liq buyurtma yo'li Sheet'da real vaqt rejimida ko'rinadi

### Bosqich 3 — Ikki tomonlama (ixtiyoriy, biznes talab qilsa)
**Deliverables:**
- Drive `files.watch` webhook + `@Cron` kanal-renew (≤86400s)
- Raw-body webhook controller (`X-Goog-Channel-Token` tekshiruvi)
- "Nimadir o'zgardi" → Sheet o'qib diff → reconcile (lekin **Sheet hech qachon status'ni bizga majburlamaydi** — faqat operator uchun ogohlantirish/log)
- Per-market jadval (`gsheets_market_target`) agar kerak bo'lsa
- **Ogohlantirish:** bu faza eng nozik; biznes aniq talab qilmasa qilinmaydi (§12)

---

## 11. Sinov strategiyasi

### 11.1 Test darajalari

| Daraja | Nimani sinaymiz | Qanday |
|---|---|---|
| **Unit** | `gsheets-column.util` (A1↔grid), `gsheets-status.mapper` (barcha enum→label), payload builder | jest, DI'siz pure fn |
| **Unit** | `enqueue` idempotentligi (row_map bor→skip), backoff hisobi, kill-switch gate | jest + mock repo |
| **Integration** | queue: `claimJobs` `SKIP LOCKED`, stale reclaim, retry o'tishlari | test Postgres |
| **Integration** | `GsheetsApiService` — `googleapis` client **mock** (nock/jest), append→`updatedRange` parse, 429→backoff | mock HTTP |
| **E2E (sandbox)** | Haqiqiy test jadval: order yaratish→qator; sotish→status; kvota xatti-harakati | test SA + test spreadsheet |

### 11.2 Sandbox / test-akkaunt sozlash

```
1. Alohida Google Cloud loyiha (test)
2. Alohida test service account + JSON kalit
3. Alohida "TEST Orders" jadvali, test SA'ga Editor share
4. gsheets_config.spreadsheet_id = test jadval ID (staging DB'da)
5. is_active=true faqat staging'da
```

### 11.3 Quruq yugurtirish (dry-run)

- `GsheetsConfigEntity`ga `dry_run` boolean (yoki `sync_enabled=false` + log-only rejim): `processJob` API'ni chaqirmasdan payload'ni `last_response`ga yozadi → operator qatorni ko'z bilan tekshiradi.
- `POST /gsheets/admin/test-connection` — `is_active`ni chetlab, faqat ping (LDG `test-connection` uslubi, hech narsa yaratmaydi).
- Bitta order bilan qo'lda: `POST /gsheets/admin/orders/:id/resync` → bitta qator, natijani `row_map`da tekshirish.

---

## 12. Xavflar va ochiq savollar

### 12.1 Xavflar

| Xavf | Ta'siri | Yumshatish |
|---|---|---|
| SA share unutildi | 403/404 barcha yozuvlarda | `test-connection` health-check majburiy; checklist `sender_complete` uslubi |
| 10M katak / tab to'ldi | append xatosi | Tab rotatsiyasi (Faza 2); monitoring |
| SA=1 user, 60/min limit | katta burst'da 429 | `enqueueWrite` 1s gap + batch + backoff; kerak bo'lsa ko'p SA |
| `row_map` DB'da yo'qolsa (recovery) | update qaysi qatorga bilmaydi | fallback `values.get` skan (sekin) + resync komandasi |
| Sheet'ni odam qo'lda tahrirlasa | ustun siljishi → noto'g'ri katak | Sheet **read-only** (protected range) tavsiya; odam faqat ko'radi |
| 2026 oxiridan kvota billing | kutilmagan xarajat | kvota monitoring; ogohlantirish |
| `googleapis` tez major bump (v173→...) | breaking change | aniq versiyaga pin (`~173.x`), CI'da lock |
| Concurrency: append poyga (INPUT B "missing/uncertain") | ikki qator yaqin vaqtda | `enqueueWrite` serialize + `insertDataOption=INSERT_ROWS` |

### 12.2 Ochiq savollar (biznesga / Google'ga)

1. **Tenancy:** bitta platforma jadvalimi yoki **har market o'z jadvaliga**? (singleton vs per-market map — §4.2 qarori shunga bog'liq)
2. **Ikki tomonlama kerakmi?** Operatorlar Sheet'da status'ni **o'zgartiradimi** (Faza 3 kerak) yoki faqat **ko'radimi** (outbound yetarli)? Kuchli tavsiya: faqat ko'rish.
3. **Qaysi ustunlar?** Biznes aynan qaysi maydonlarni xohlaydi (moliyaviy summalar, kuryer, mahsulot ro'yxati)? §5.1 taxminiy.
4. **Til/format:** status yorliqlari uzbekmi yoki inglizmi? Sana formati? Valyuta?
5. **Rotatsiya siyosati:** tab to'lganda oy/yil bo'yicha yangi tabmi (`Orders_2026_07`)?
6. **Tarixiy backfill:** mavjud buyurtmalar Sheet'ga bir marta ko'chirilsinmi yoki faqat yangilaridan boshlansinmi?
7. **GCP muhiti:** backend GCP'da ishlaydimi? Agar ha — JSON kalit o'rniga **Workload Identity** (kalit-siz, INPUT B: auth) afzal.
8. **Kim ko'radi?** Jadval kim bilan ulashiladi (huquq/maxfiylik — mijoz telefon raqamlari Sheet'da)?

---

## 13. Ish hajmi bahosi

| Bosqich | Ish hajmi | Dev-kun (taxminiy) | Asosiy qismlar |
|---|---|---|---|
| **Faza 0** (skeleton) | **S** | 2–3 kun | 3 entity + migratsiya, config CRUD + AES transformer, `googleapis` provider, test-connection |
| **Faza 1** (MVP mirror) | **M** | 4–6 kun | queue engine (claim/retry/stale), enqueue + processJob, 5 hook nuqta, append+update+batch, idempotentlik, rate-limit gap |
| **Faza 2** (to'liq LC + admin) | **M–L** | 5–8 kun | qolgan 7 hook (post/order-bot), rang format, admin service + cron + panel, tab rotatsiya |
| **Faza 3** (ikki tomonlama, ixtiyoriy) | **L** | 6–10 kun | Drive watch + renew cron, webhook controller, reconcile diff, (ixtiyoriy) per-market map |
| **Sinov** (barcha fazalarga taqsimlangan) | **M** | 3–4 kun | unit + integration + sandbox e2e + dry-run |

**Xulosa:** Faza 0+1 (ishlaydigan bir tomonlama MVP) ≈ **6–9 dev-kun**. To'liq (Faza 0–2 + test) ≈ **14–21 dev-kun**. Faza 3 faqat biznes aniq talab qilsa.

> **Tavsiya:** Faza 0+1'ni yetkazib, real jadvalda ko'rsatib, biznes fikrini olgandan keyin Faza 2'ni boshlash. Faza 3'ni faqat "operator Sheet'da o'zgartiradi" talabi tasdiqlansa qilish (§12.2 №2).