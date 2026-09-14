# Elchi Pochta Integratsiyasi — PCS ↔ Elchi

> Hujjat turi: **implementatsiyadan oldingi imkoniyat tahlili + reja**
> Sana: 2026-09-07 · Til: O'zbek · Holat: **REJA (kod yozilmagan)**
> Maqsad: PCS'dan pochtani Elchi'ga jo'natish; Elchi kuryerlari uni olib **sotishi/bekor qilishi**;
> ikkala tizim **xatosiz sinxron** ishlashi.

---

## ⚠️ YANGILANDI (2026-09-08) — Elchi endi platformaning bir qismi

> Biznes talabi kengaydi: kelajakda **boshqa cargo va marketlar** ham ulanadi, va ular
> **hujjat berib, kodsiz** ulanishi kerak. Shu sababli Elchi endi LDG modulining
> **nusxasi sifatida EMAS**, umumiy **carrier qatlami** ustida yoziladi
> (platforma rejasining **C bosqichi**): [`06-platforma.md`](06-platforma.md).
>
> Quyidagi tahlil — nuqsonlar (§03), status moslashtirish (§04), pul modeli (§05),
> ishonchlilik (§06) — **to'liq kuchda qoladi**. Faqat §07 dagi bosqichlar
> platforma rejasining A va C bosqichlariga singdirildi.

---

## 0. Xulosa (30 soniyada)

**Javob: MUMKIN — va kutilganidan ancha oson.** Sababi: bu "noldan integratsiya" emas. **Ikkala tomonda ham kerakli infratuzilma allaqachon yozilgan va ishlab turibdi.**

| Tomon | Nima allaqachon bor | Bizga nima beradi |
|---|---|---|
| **Elchi** | To'liq **Partner API** (`/partner/*`) — API-key auth, shipment yaratish, bekor qilish, holat so'rash, HMAC-imzoli chiquvchi webhook + outbox/retry | PCS shunchaki **2-hamkor** bo'lib ulanadi. Elchi'ning order/logistics/finance yadrosiga TEGILMAYDI |
| **PCS** | To'liq **LDG Cargo** integratsiyasi (3538 qator, prod'da ishlayapti) — tashqi provayder = **virtual kuryer**, dispatch hook, webhook receiver, status mapper, kill-switch, admin UI | Elchi = **yangi tashqi provayder**. Aynan shu qolip nusxalanadi, order/kassa oqimiga TEGILMAYDI |

**Model (LDG bilan bir xil):** PCS — buyurtmaning **haqiqat manbai** (source of truth). Elchi — **yetkazish pudratchisi** (ko'zgu). Elchi PCS ichida **bitta virtual kuryer** (`external_provider='elchi'`) sifatida ko'rinadi. Operator buyurtmani shu kuryerga jo'natsa — u avtomatik Elchi'ga tushadi.

**Ish hajmi:** PCS tomoni ~7–9 dev-kun · Elchi tomoni ~3–4 dev-kun (gap-fix) · jami **~10–13 dev-kun**.

**Eng katta xavf — pul, kod emas.** Texnik qism qolipli; hal qilinishi kerak bo'lgan narsa: COD (naqd) pul kimning hisobida to'planadi va qanday hisob-kitob qilinadi (§8, §12).

---

## 1. Yo'nalish va rollar

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    POST CONTROL SYSTEM (PCS)                              │
│                    ◀── BUYURTMANING HAQIQAT MANBAI ──▶                    │
│                                                                           │
│   Buyurtma yaratiladi (operator/bot/AI/QR) → NEW → qabul → pochtaga       │
│                                                                           │
│   Operator kuryer tanlaydi:                                              │
│      ├── oddiy ichki kuryer  → hech narsa o'zgarmaydi                    │
│      ├── "LDG"  (virtual)    → LDG'ga ketadi   (MAVJUD)                  │
│      └── "ELCHI" (virtual)   → Elchi'ga ketadi (YANGI)                   │
└────────────────────────────────┬──────────────────────────────────────────┘
                                 │
        (1) OUTBOUND: shipment   │        (2) INBOUND: status webhook
        POST /partner/shipments  │        POST /api/v1/elchi/webhook
        X-Api-Key                │        X-Elchi-Signature (HMAC-SHA256)
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          ELCHI POCHTA                                     │
│                    ◀── YETKAZISH IJROCHISI ──▶                            │
│                                                                           │
│   Partner shipment → order.create (source=external, external_id=PCS UUID) │
│      → NEW → qabul → kuryerga biriktirish → KURYER SOTADI/BEKOR QILADI    │
│      → status o'zgarishi → partner_webhook_outbox → PCS'ga POST           │
│                                                                           │
│   ▲ Elchi'ning order/logistics/finance state machine'lariga TEGILMAYDI    │
└───────────────────────────────────────────────────────────────────────────┘
```

| Yo'nalish | Trigger | Nima bo'ladi | Davomiylik |
|---|---|---|---|
| **PCS → Elchi (shipment)** | Operator buyurtmani "Elchi" virtual kuryeriga jo'natadi (`sendPost`) | Elchi'da yangi buyurtma (`NEW`) tug'iladi, PCS `elchi_shipment` yozuvi saqlaydi | **Bir martalik** (idempotent) |
| **PCS → Elchi (cancel)** | PCS'da buyurtma bekor qilinadi/rollback | `POST /partner/shipments/:id/cancel` | Sotilgunga qadar |
| **Elchi → PCS (status)** | Elchi kuryeri sotadi/bekor qiladi | HMAC webhook → PCS status mapper → mavjud `sellOrder`/`cancelOrder` oqimi | Buyurtma hayoti davomida |
| **Elchi → PCS (boshqa o'zgarish)** | — | **YO'Q.** Elchi PCS'ning narx/mijoz/mahsulot ma'lumotini o'zgartira olmaydi | — |

> **Invariant:** PCS = pul va buyurtma avtoriteti. Elchi = yetkazish holati avtoriteti.
> Ikkalasi kesishgan yagona nuqta — **terminal status** (sotildi/bekor) va **yig'ilgan summa**.

---

## 2. Nima uchun aynan shu shakl (LDG precedenti)

PCS'da tashqi yetkazuvchini ulashning **isbotlangan qolipi** bor — LDG. Elchi undan farq qilmaydi:

| Jihat | LDG (mavjud, prod'da) | Elchi (yangi) |
|---|---|---|
| PCS ichida ko'rinishi | `users` yozuvi, `role=COURIER`, `external_provider='ldg'` | `external_provider='elchi'` |
| Dispatch hook | `post.service.ts:1006` — `courier.external_provider === 'ldg'` | shu yerga `'elchi'` shoxi |
| Bog'lanish jadvali | `ldg_shipment` (order ↔ package_id) | `elchi_shipment` (order ↔ shipment_id) |
| Sozlama | `ldg_config` (singleton, AES secret) | `elchi_config` (singleton) |
| Webhook | `POST /api/v1/ldg/webhook` + HMAC + `ldg_webhook_log` (replay PK) | `POST /api/v1/elchi/webhook` + HMAC + `elchi_webhook_log` |
| Terminal amallar | `markDeliveredByLdg` / `markCancelledByLdg` / `markReturnedByLdg` (`order.service.ts:5991+`) | `markDeliveredByElchi` / `...ByElchi` — **bir xil skelet** |
| Admin UI | `client/src/pages/integrations/` LDG tablari | shu sahifaga "Elchi" tabi |

**Xulosa:** yangi arxitektura ixtiro qilinmaydi. Bu — mavjud, sinovdan o'tgan qolipning ikkinchi nusxasi.

> **Muqobil ko'rib chiqildi va rad etildi:** LDG modulini "umumiy provayder abstraksiyasi"ga refaktor qilish.
> Sabab: LDG prod'da ishlayapti (memory: `ldg-returned-closed-fix`, 29 test). Uni refaktor qilish
> **ishlaydigan pul oqimini xavf ostiga qo'yadi**. Avval Elchi'ni alohida modul qilib yozamiz;
> ikkitasi barqaror ishlagach, umumiy qatlamni ajratish — keyingi (ixtiyoriy) bosqich.

---

## 3. Elchi tomonida ALLAQACHON tayyor narsalar (tekshirilgan)

Quyidagilar hujjatdan emas, **kod o'qib** tasdiqlangan:

| Komponent | Fayl | Holat |
|---|---|---|
| Partner HTTP kirish | `api-gateway/src/partner-gateway.controller.ts:76` | ✅ `@Controller('partner')` |
| `GET /partner/ping` | `partner-gateway.controller.ts:88` | ✅ kalit tekshiruvi |
| `GET /partner/regions` | `:98` | ✅ `[{id,name}]` |
| `GET /partner/districts` | `:111` | ✅ `[{id,name,region_id}]` — ⚠️ `sato_code` YO'Q (G1) |
| `GET /partner/tariff` | `:140` | ✅ market bo'yicha tarif |
| `POST /partner/markets` | `:193` | ✅ idempotent market provisioning |
| `POST /partner/shipments` | `:217` | ✅ → `order.create`, idempotent (`external_order_id`) |
| `GET /partner/shipments/:id` | `:239` | ✅ `{status, cod_amount, tracking}` — `:id` = **shipment_id** |
| `POST /partner/shipments/:id/cancel` | `:262` | ✅ SOLD bo'lsa **409** |
| API-key guard | `api-gateway/src/auth/partner-api-key.guard.ts` | ✅ hash solishtirish + IP allowlist |
| Per-hamkor rate limit | `auth/partner-throttler.guard.ts` | ✅ default 120/min (ENV) |
| Hamkor CRUD / kalit rotatsiyasi | `partner-admin-gateway.controller.ts:38` (`admin/partners`) | ✅ create/list/rotate-key/status |
| Shipment yaratish mantiqi | `integration-service.service.ts:483` | ✅ customer→order.create→ref saqlash |
| Chiquvchi webhook navbat | `integration-service.service.ts:752` | ✅ outbox + dedup |
| Webhook yuborish (HMAC) | `integration-service.service.ts:915` | ✅ `X-Elchi-Signature`, SSRF guard, 15s timeout |
| Retry/backoff | `partner-webhook-outbox.entity.ts` + `sync-queue.scheduler.ts` | ✅ 4 urinish, 1m/5m/15m |
| Status o'zgarishida emit | `order-service/src/lifecycle/order-lifecycle.service.ts:2672` | ✅ `queueExternalStatusSync` |

> Elchi'ning `docs/PARTNER_API.md` hujjati **eskirgan** — unda `GET /shipments/:id` va `cancel`
> "qolgan" deb yozilgan, aslida kodda **bor**. Kodga ishoning, hujjatga emas.

---

## 4. Topilgan KAMCHILIKLAR (sinxronlikni buzadi)

Bu bo'lim eng muhimi — "xatosiz sinxron" talabiga **to'g'ridan-to'g'ri tahdid** soladigan, kod o'qib topilgan aniq nuqsonlar.

### 🔴 G2 — Takroriy status webhook'i "dublikat" deb TASHLANADI

`partner-webhook-outbox.entity.ts:28`:
```ts
@Index('IDX_PWO_DEDUP', ['partner_id', 'order_id', 'new_status'], { unique: true })
```
`enqueuePartnerWebhook` unique-violation'ni **idempotentlik** deb qabul qilib jimgina tashlab yuboradi (`:812`).

**Buzilish sahnasi:** Elchi'da buyurtma `sold` → operator xato deb **rollback** qiladi → `waiting` → kuryer qayta **sotadi** → `sold`.
Ikkinchi `sold` webhook'i unique cheklovga tushadi va **hech qachon PCS'ga yetmaydi**.
Natija: Elchi'da sotilgan, PCS'da esa hamon kutilmoqda — **jimgina desinxronizatsiya**.

**Yechim:** dedup kalitiga hodisa ketma-ketligini qo'shish — `(partner_id, order_id, new_status, attempt_seq)` yoki dedup'ni "faqat `pending` qatorlar orasida" qilish (partial unique index `WHERE status='pending'`). Tavsiya: **partial index** — eng kam o'zgarish.

### 🔴 G3 — Rollback umuman webhook YUBORMAYDI

`order-lifecycle.service.ts:1200–1790` — `rollbackOrderToWaiting()` funksiyasi ichida `queueExternalStatusSync` chaqiruvi **umuman yo'q** (tekshirildi: 0 ta).

**Buzilish sahnasi:** Elchi operatori sotilgan buyurtmani rollback qiladi → PCS bilmaydi → PCS'da `sold`, kassaga pul kirgan; Elchi'da `waiting`. **Pul nomuvofiqligi.**

**Yechim:** `rollbackOrderToWaiting` oxiriga `queueExternalStatusSync(order, 'rollback', oldStatus, WAITING)` qo'shish. `resolveSyncAction` (`:2736`) allaqachon `rollback` shoxini qo'llab-quvvatlaydi — faqat chaqiruv yetishmaydi.

### 🟠 G4 — `returned_to_market` va `could_not_deliver` webhook chiqarmaydi

`resolveSyncAction` (`:2717`) bu ikki status uchun `null` qaytaradi → hech qanday signal ketmaydi.
`markReturnedToMarket` (`:1861`) va `couldNotDeliverOrder` (`:3761`) — ikkalasida ham 0 ta emit.

**Ta'siri:** "kuryer yetkaza olmadi" holati PCS'ga ko'rinmaydi. PCS buyurtmani cheksiz "kutilmoqda"da ushlab turadi.
**Yechim:** `resolveSyncAction`'ga bu ikkisini qo'shish + emit chaqiruvlari.

### 🟠 G1 — `/partner/districts` SOATO kodini qaytarmaydi

`partner-gateway.controller.ts:111` javobni `{id, name, region_id}` ga qirqadi. Holbuki Elchi `District` entity'sida `sato_code` **bor** (`logistics-service/src/entities/district.entity.ts:13`) va `logistics.district.find_by_sato` patterni ham bor (`logistics-service.controller.ts:446`).

**Ta'siri:** PCS o'z tumanini (SOATO) Elchi `district_id`'ga **avtomatik moslashtira olmaydi** → 200+ tumanni qo'lda moslash kerak bo'ladi.
**Yechim (1 qator):** mapper'ga `sato_code: d.sato_code` qo'shish. Shundan keyin PCS moslashtirishni **avtomatik** qiladi (ikkala tomonda ham `sato_code` bor).

### 🟡 G5 — Qisman sotish detali webhook payload'ida yo'q

Elchi `partlySellOrder` (`:3941`) webhook chiqaradi, lekin payload faqat `{status, cod_collected}` — **qaysi mahsulot, qancha qoldi** — yo'q.
PCS'ning `partlySold` esa item-darajali miqdor talab qiladi (memory: `partly-sold-remediation`).

**Yechim (MVP):** qisman sotishni PCS'da **summa bo'yicha** qabul qilish (`cod_collected < to_be_paid` → qisman) va operatorga qo'lda tekshirish uchun bayroq qo'yish. Item-darajali sinxronlik — keyingi bosqich.

### ⚪ G6 — PCS tomonida hech narsa yo'q (kutilgan)

`elchi_*` jadvallar, dispatch, webhook receiver — hammasi yozilishi kerak. Bu rejaning asosiy ish hajmi.

---

## 5. Status mapping

Ikkala tizimning `Order_status` enum'lari **deyarli bir xil** (umumiy ajdoddan) — bu mappingni juda soddalashtiradi.

| Elchi status (webhook `status`) | PCS `Order_status` | PCS'da chaqiriladigan oqim | Terminal? |
|---|---|---|---|
| `new` / `received` | `ON_THE_ROAD` | — (faqat status yangilanadi) | ❌ |
| `on the road` | `WAITING` | — | ❌ |
| `waiting` | `WAITING` | — | ❌ |
| `waiting_customer` *(Elchi-only)* | `WAITING` | — | ❌ |
| **`sold`** | **`SOLD`** | `markDeliveredByElchi` → `sellOrder` (**kassaga pul**) | ✅ |
| **`cancelled`** | **`CANCELLED`** | `markCancelledByElchi` → `cancelOrder` | ✅ |
| `cancelled (sent)` | `CANCELLED_SENT` | `markReturnedByElchi` (qaytish yo'lida) | ✅ |
| `returned_to_market` *(Elchi-only)* | `CANCELLED_SENT` | `markReturnedByElchi` | ✅ |
| `paid` / `partly_paid` | `SOLD` (+ qisman bayrog'i) | `markDeliveredByElchi`, `cod_collected` bilan | ✅ |
| `closed` | — | **E'TIBORGA OLINMAYDI** | — |

> **Invariant (LDG'dan meros):** Elchi hech qachon PCS buyurtmasini `CLOSED` qila **olmaydi**.
> `CLOSED` faqat PCS'ning o'z skaner oqimidan qo'yiladi. Bu qoidani LDG'dagidek modul yuklanishida
> **majburiy tekshiruv** bilan mustahkamlash kerak (`ldg-status.mapper.ts` oxiridagi guard naqshi).

---

## 6. Geo moslashtirish (SOATO orqali)

| | PCS | Elchi |
|---|---|---|
| ID turi | `uuid` | `bigint` |
| SOATO ustuni | `district.sato_code` (**UNIQUE**) | `districts.sato_code` (indeksli) |

**Yechim:** `sato_code` — ikkala tizim orasidagi **tabiiy kalit**. PCS ishga tushishda (yoki admin tugmasi bilan) `GET /partner/districts` ni chaqirib, `sato_code` bo'yicha o'z tumanlariga moslaydi va `elchi_district_map` jadvaliga yozadi.

```
PCS district (uuid, sato_code='1727401')
        │  sato_code bo'yicha JOIN
        ▼
Elchi district (bigint id=482, sato_code='1727401')
```

**Shart:** G1 tuzatilishi kerak (`/partner/districts` `sato_code` qaytarsin). Aks holda — 200+ tumanni qo'lda moslash.
**Zaxira:** mos kelmagan tumanlar uchun admin panelda qo'lda moslash jadvali + moslanmagan tumanga jo'natishni **bloklash** (jimgina noto'g'ri tumanga yuborishdan ko'ra ochiq xato yaxshi).

---

## 7. PCS → Elchi shipment payload mapping

`POST /partner/shipments` (`integration-service.service.ts:483` talablari):

| Elchi maydoni | PCS manbai | Majburiy | Izoh |
|---|---|---|---|
| `external_order_id` | `order.id` (UUID) | ✅ | **Idempotentlik kaliti**. LDG'dagidek — bizning UUID |
| `elchi_market_id` | `elchi_config.market_id` | ✅ | §8 qarori — bitta PCS market |
| `customer.name` | `order.customer.name` | ✅ | |
| `customer.phone` | `order.customer.phone_number` | ✅ | |
| `district_id` | `elchi_district_map` (§6) | ✅ | Moslanmasa — jo'natish bloklanadi |
| `region_id` | map orqali | ❌ | |
| `address` | `order.address` | ❌ | |
| `where_deliver` | `order.where_deliver` | ❌ | `center` \| `address` — enum bir xil |
| `items[]` | `order.items` → `{name, quantity}` | ❌ | Elchi katalog talab qilmaydi |
| `cod_amount` | `order.to_be_paid` | ✅ | **0 = prepaid** (kuryer pul yig'maydi) |
| `subtotal` | `order.total_price` | ❌ | |

**Javob:** `{ shipment_id, order_status, qr_code_token, to_be_paid }` → `elchi_shipment` jadvaliga saqlanadi.
`shipment_id` — keyingi `GET`/`cancel` chaqiruvlari uchun **shart** (`:id` = shipment_id, `external_order_id` emas).

---

## 8. Pul modeli — ⚠️ ASOSIY BIZNES QARORI

Bu — texnik emas, **biznes** savoli. Kod yozishdan oldin hal bo'lishi shart.

Elchi kuryeri COD (naqd) pulni yig'adi → u pul **Elchi'ning** settlement zanjiriga tushadi (`kuryer → filial → HQ → market`). "Market" = `POST /partner/markets` bilan ochilgan akkaunt.

| Variant | Qanday | Afzalligi | Kamchiligi |
|---|---|---|---|
| **A. Bitta PCS marketi** ✅ *tavsiya* | Elchi'da bitta "PCS" market akkaunti. Barcha COD shu yerga tushadi. PCS ichkarida o'z marketlariga taqsimlaydi | PCS pul avtoriteti bo'lib **qoladi**. Mavjud kassa/market hisobi o'zgarmaydi. **LDG bilan bir xil**. Bitta tarif kelishuvi | Elchi'da market-darajali detal ko'rinmaydi |
| B. Har PCS marketi uchun alohida Elchi marketi | Har market uchun `POST /partner/markets` | Elchi'da per-market hisob | **Pul avtoriteti ikkiga bo'linadi** → ikki manbadan hisob, rekonsiliatsiya kabusi. Har market uchun alohida tarif |

**Tavsiya: A.** Sabab — PCS'da to'liq kassa/market/investor hisobi allaqachon bor (memory: `cashbox-virtual-cards`, `main-shift-excel-rewrite`). Uni ikkinchi tizimga bo'lish moliyaviy invariantlarni buzadi. Elchi — LDG kabi **pudratchi**, hamkor-buxgalteriya emas.

**A variantida pul oqimi:**
```
Elchi kuryer COD yig'adi  →  Elchi settlement  →  Elchi'dagi "PCS" market balansi
                                                            │
                              webhook (sold, cod_collected) │
                                                            ▼
PCS: markDeliveredByElchi → sellOrder(virtual "Elchi" kuryer)  → PCS kassasiga kirim
                                                            │
                        davriy hisob-kitob (Elchi → PCS pul o'tkazmasi)
```

> **Ochiq savol (Q3, §12):** Elchi'ning yetkazish tarifi PCS'da qanday xarajat sifatida yoziladi —
> (a) buyurtma bo'yicha `extra_cost`, (b) virtual kuryer tarifi (`tariff_home`/`tariff_center` —
> LDG'dagidek), (c) davriy umumiy xarajat? **Tavsiya: (b)** — LDG bilan bir xil, kod tayyor.

---

## 9. Ishonchlilik — "xatosiz sinxron" qanday ta'minlanadi

Talab aynan shu bo'lgani uchun 5 qatlamli himoya:

| # | Qatlam | Mexanizm | Qaysi xatoni to'sadi |
|---|---|---|---|
| 1 | **Idempotentlik (chiqishda)** | `external_order_id = order.id` — Elchi bir xil UUID uchun ikkinchi shipment ochmaydi (`:513`) | Takroriy jo'natish → dublikat buyurtma |
| 2 | **Idempotentlik (kirishda)** | `elchi_webhook_log.delivery_id` PRIMARY KEY (LDG naqshi) | Takroriy webhook → ikki marta sotish |
| 3 | **Kafolatli yetkazish** | Elchi outbox + 4 urinish (1m/5m/15m) | Vaqtinchalik tarmoq uzilishi |
| 4 | **Rekonsiliatsiya (ZARUR)** | PCS CRON: ochiq `elchi_shipment`lar uchun `GET /partner/shipments/:id` → holat solishtirish | **Butunlay yo'qolgan webhook** (outbox 4 urinishdan keyin taslim bo'ladi) |
| 5 | **Mismatch jurnali** | Terminal status kelganda PCS'dagi status mos kelmasa → `mismatch_at` + admin kartasi (LDG naqshi) | Qo'lda va avtomatik amal to'qnashuvi |

> **4-qatlam majburiy.** Elchi outbox 4 urinishdan keyin `permanently_failed` qo'yadi va **qayta urinmaydi**.
> Rekonsiliatsiya CRON'isiz PCS bunday buyurtmani abadiy "kutilmoqda"da ushlab qoladi.
> LDG'da bu dars allaqachon o'rganilgan (memory: `ldg-returned-closed-fix` — soxta mismatch).

**Kill-switch (LDG'dan meros):** `elchi_config.is_active` master toggle + virtual kuryer bloklansa dispatch to'siladi + frontend'da master tugma.

---

## 10. Bosqichma-bosqich reja

| Bosqich | Ish | Natija | Baho |
|---|---|---|---|
| **0. Kelishuv** | Elchi'da PCS uchun hamkor ochish (`POST /admin/partners`) → API-key; PCS webhook URL + secret; **§8 va §12 qarorlari** | Kalitlar + qarorlar | 1 kun |
| **1. Elchi gap-fix** | **G1** (`sato_code`), **G3** (rollback emit), **G2** (dedup partial index), **G4** (returned/could-not-deliver emit) | Elchi tomoni sinxronga tayyor | 3–4 kun |
| **2. PCS poydevor** | `elchi_config` / `elchi_shipment` / `elchi_webhook_log` / `elchi_district_map` entity + migration; `elchi-api.service` (HTTP klient); admin config UI (Integrations sahifasiga "Elchi" tabi) | Sozlash mumkin, hali jo'natmaydi | 2–3 kun |
| **3. Geo moslash** | `GET /partner/districts` → `sato_code` bo'yicha avtomatik moslash + qo'lda tuzatish UI | Tumanlar moslangan | 1 kun |
| **4. Outbound dispatch** | Virtual "Elchi" kuryer yaratish; `post.service.ts:1006` ga `'elchi'` shoxi; `createShipmentForOrder` | **PCS'dan Elchi'ga jo'natish ISHLAYDI** | 2 kun |
| **5. Inbound webhook** | `POST /api/v1/elchi/webhook` + HMAC verify (raw body!) + replay guard; status mapper; `markDeliveredByElchi` / `markCancelledByElchi` / `markReturnedByElchi` | **Elchi kuryeri sotsa PCS'da sotiladi** | 2–3 kun |
| **6. Bekor qilish (PCS→Elchi)** | PCS'da bekor/rollback → `POST /partner/shipments/:id/cancel`; 409 (sotilgan) ishlanishi | Ikki tomonlama bekor | 1 kun |
| **7. Rekonsiliatsiya + hardening** | CRON holat solishtirish; mismatch kartasi; kill-switch; e2e testlar | **Xatosiz sinxron** | 2 kun |

**Kritik yo'l:** 0 → 1 (Elchi) ‖ 2 → 3 → 4 → 5 → 6 → 7.
Bosqich 1 va 2 **parallel** ketishi mumkin (turli repo, turli dasturchi).

**Birinchi ishlaydigan demo:** Bosqich 4 oxirida (PCS'dan Elchi'ga buyurtma tushadi).
**To'liq ikki tomonlama:** Bosqich 5 oxirida.

---

## 11. Xavflar

| # | Xavf | Ehtimol | Ta'sir | Yumshatish |
|---|---|---|---|---|
| R1 | **Pul ikki tizimda ikki xil** (G3 rollback, G2 dedup) | **Yuqori** (tuzatilmasa) | **Kritik** | Bosqich 1 majburiy + rekonsiliatsiya CRON (§9.4) |
| R2 | Tuman moslanmagan → buyurtma noto'g'ri tumanga | O'rta | Yuqori | Moslanmaganda dispatch'ni **bloklash** (jimgina o'tkazmaslik) |
| R3 | Elchi'da sotilgan, PCS'da bekor qilingan (qo'lda to'qnashuv) | O'rta | Yuqori | Mismatch jurnali + admin kartasi (LDG naqshi) |
| R4 | Elchi Partner API bizdan boshqa hamkor (Marketplace) uchun o'zgaradi | Past | O'rta | `GET /partner/ping` bilan health-check + versiyalash so'rash |
| R5 | Qisman sotish detali yo'qoladi (G5) | O'rta | O'rta | MVP: summa bo'yicha + operator bayrog'i |
| R6 | `POST /partner/shipments` 65s timeout'da qotishi | Past | O'rta | Fire-and-forget + `elchi_shipment.last_error` (LDG naqshi) |
| R7 | Ikki repo, ikki deploy — versiya nomuvofiqligi | O'rta | O'rta | Kontrakt testlari + `ping` da versiya |

---

## 12. Hal qilinishi kerak bo'lgan savollar (biznes)

| # | Savol | Variantlar | Tavsiya |
|---|---|---|---|
| **Q1** | COD pul kimning Elchi akkauntida to'planadi? | (a) bitta "PCS" marketi · (b) har PCS marketi uchun alohida | **(a)** — §8 |
| **Q2** | Elchi butun O'zbekiston bo'ylab yetkazadimi yoki faqat ayrim hududlarda? | to'liq / cheklangan ro'yxat | Cheklangan bo'lsa — `elchi_district_map`da `enabled` bayrog'i |
| **Q3** | Elchi tarifi PCS'da qanday xarajat? | (a) `extra_cost` · (b) virtual kuryer tarifi · (c) davriy | **(b)** — LDG bilan bir xil, kod tayyor |
| **Q4** | Elchi bekor qilgan pochta jismonan qayerga qaytadi? | PCS omboriga / Elchi filialida qoladi | Skaner oqimi (`CLOSED`) shunga bog'liq |
| **Q5** | PCS mijozining shaxsiy ma'lumoti (ism/telefon/manzil) Elchi'ga to'liq chiqadimi? | to'liq / maskalangan | Yetkazish uchun to'liq shart — lekin yozib qo'yilsin |
| **Q6** | Ikkala tizim bitta kompaniyaniki-mi? | ha / yo'q | "Ha" bo'lsa Q1/Q5 soddalashadi; "yo'q" bo'lsa shartnoma kerak |

---

## 13. Ish hajmi xulosasi

| Tomon | Bosqichlar | Baho |
|---|---|---|
| **Elchi-Backend** | 1 (gap-fix: G1, G2, G3, G4) | **3–4 dev-kun** |
| **PCS server** | 2, 3, 4, 5, 6, 7 | **7–9 dev-kun** |
| **PCS client** | Integrations sahifasiga Elchi tablari (config, shipments, webhook loglari, dashboard) | (yuqoridagiga kiritilgan) |
| **Kelishuv/test** | 0 + e2e | 1–2 kun |
| | **JAMI** | **~11–15 dev-kun** |

Taqqoslash uchun: 3 ta CRM integratsiyasi rejasi har biri ~9–14 kun edi (`README.md`) — **va ular noldan**.
Bu yerda ikkala tomonda ham qolip tayyor bo'lgani uchun murakkablik past, lekin **pul aniqligi talabi yuqori**.

---

## Havolalar

- Elchi Partner API kontrakti (eskirgan, kodga solishtiring): `Elchi-Backend/docs/PARTNER_API.md`
- Elchi ↔ PCS funksional taqqoslash (994 funksiya): `Elchi-Backend/docs/comparison/PCS_vs_ELCHI_FUNKSIONAL_TAQQOSLASH.md`
- PCS LDG moduli (nusxa olinadigan qolip): `server/src/api/ldg-cargo/README.md`
- PCS tashqi sayt integratsiya hujjati: `EXTERNAL_INTEGRATION_API.md`
- Umumiy integratsiya arxitekturasi: `docs/integrations/00-umumiy-arxitektura.md`
