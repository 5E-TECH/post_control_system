# 14 — Yangi Marketplace'ni BeePost'ga ulash (PCS tomoni)

> Hujjat turi: **implementatsiyadan oldingi to'liq reja**
> Sana: 2026-09-15 · Til: O'zbek · Holat: **REJA — kod yozilmagan, tasdiq kutilmoqda**
> Metodologiya: 14 ta agent kodbazani o'qidi (2.5M token, 798 tool chaqiruvi) →
> **116 ta topilma** (25 kritik · 59 yuqori · 31 o'rta). Har bir da'vo `fayl:satr` bilan tekshirilgan.
> Tayanch kod: `external-integration`, `external-proxy`, `integration-sync`, `elchi-cargo`, `ldg-cargo`, `cash-box`, `order`.

---

## 0. Xulosa (30 soniyada)

Yangi marketplace **bizga buyurtma beradi** (SOURCE roli), biz yetkazamiz, pulni yig'amiz
va ularga qarzdor bo'lamiz. Farqi — ular ichida **ko'p sotuvchi** bor va **kassa ikki
tomonda teng yurishi** shart.

**Eng muhim xabar:** bu "noldan integratsiya" emas, lekin **mavjud `external_integration`
yo'li bu ishga yaramaydi**. U faqat status matnini yuboradi — pul, sotuvchi, kassa, kiruvchi
webhook, idempotentlik, tartib kafolati — **hech biri yo'q**.

| Talabingiz | Hozir bormi | Izoh |
|---|:---:|---|
| Skan → ularning tizimidan buyurtma tortish | 🟡 **prototip** | `external-proxy/:slug/qrorder/find` ishlaydi, lekin serverda **hech narsa saqlanmaydi** |
| Qabul qilishda ikki tomonda status o'zgarishi | ❌ **yo'q** | Qabulda ularga **hech qanday so'rov ketmaydi** (`SyncAction`da `accepted` yo'q) |
| Sotuv/bekor/rollback statusi | 🟡 **chala** | Status ketadi, lekin **pulsiz**, **idempotentliksiz**, **tartibsiz** |
| Sotuv summasi, ortiqcha xarajat | ❌ **yo'q** | Chiquvchi payload **eng ko'pi 2 ta kalit**: `{status, order_id}` |
| Kassa sinxroni | ❌ **umuman yo'q** | `cash-box.service.ts`da HTTP klient yo'q, hodisa shinasi yo'q, subscriber yo'q |
| Qaysi sotuvchining buyurtmasi | ❌ **umuman yo'q** | Butun kodbazada `seller` tushunchasi yo'q |
| Ular bizga so'rov yuborishi | ❌ **yo'q** | Bu yo'lda **autentifikatsiya primitivi yo'q** — hamkor JWT ololmaydi |

**Qaror: alohida `marketplace` moduli** (LDG va Elchi qolipi), `external_integration`ga
tegmasdan. Sabab §3 da.

**Katta yutuq:** marketplace'da arxitektura **yo'q** — demak kontraktni **biz yozamiz**.
Bu ADAPTER emas, **SPEC** rejimi: moslashish shart emas, `field_mapping` kerak emas, qattiq
DTO yetadi. Va **ikkinchi marketplace kodsiz ulanadi** — faqat konfiguratsiya.

**Ish hajmi: 20–25 dev-kun** (PCS tomoni) + ular tomoni ~8–12 kun.
**Barcha biznes shartlari kelishilgan** (§19) — ochiq savol qolmadi.
**Birinchi ishlaydigan demo:** 3-bosqich oxirida (~14 kun).

---

## 1. Talabingiz → arxitekturaga tarjima

Siz aytgan har bir jumla qaysi texnik komponentga tushishi:

| # | Sizning talabingiz | Texnik ma'nosi | Bo'lim |
|---|---|---|---|
| 1 | «ular bizga buyurtmalarini olib keladi» | Jismoniy yetkazish. ⛔ Manifest (qop ro'yxati) **qurilmaydi** — har posilka skan paytida topiladi | §5.1 |
| 2 | «har scanerda ularning tizimiga so'rov jo'natadi, QR-token orqali» | `POST /marketplace/:slug/scan` — **server tomonda**, natija **bazaga yoziladi** | §5.2 |
| 3 | «bir nechta buyurtmalarni scanerlab qabul qilamiz» | **Skan sessiyasi** — server tomonda saqlanadi, brauzer yopilsa yo'qolmaydi | §5.3 |
| 4 | «Qabul qilishda ikkalasida ham status o'zgaradi» | `parcel.accepted` hodisasi + ularning `/parcels/accept` endpointi | §5.4 |
| 5 | «sotganda/bekor qilganda statuslar sinxron» | Hodisa oqimi (`outbox`) + `seq` + idempotentlik | §6 |
| 6 | «rollback qilinsa ham» | `parcel.rolled_back` + **rad etilish holatini ushlash** | §6.4 |
| 7 | «elchi kabi kassalar sinxron» | `cashbox_history` INSERT = **yagona tutash nuqta** → `ledger.entry` hodisasi | §7 |
| 8 | «bitta market ochib biriktiramiz» | `marketplace_integration.market_id` → `users(role=market)` | §7.1 |
| 9 | «ikkala kassaning teng yurishi» | `balance_after` har hodisada + kunlik `ledger.snapshot` + solishtiruv CRON | §7.4 |
| 10 | «qaysi buyurtma sotilganini ham jo'natishimiz» | `seller_id` har hodisada + **har-sotuvchi yordamchi daftar** | §7.2 |
| 11 | «ortiqcha xarajat/muammo shu orqali ajratiladi» | `extra_cost` alohida hodisa turi + daftarda alohida yozuv turi | §7.3 |
| 12 | «ularga documentatsiya berishimiz kerak» | `MARKETPLACE_PARTNER_API.md` — ular uchun to'liq kontrakt | §10 |

---

## 2. Kodbazaning HAQIQIY holati (tekshirilgan)

### 2.1 Nima BOR va qayta ishlatiladi

| Komponent | Fayl | Nima beradi |
|---|---|---|
| QR bo'yicha tashqi qidiruv | `external-proxy.service.ts:51` | `POST {api_url}/qrorder/find` — **g'oya to'g'ri**, implementatsiya qayta yoziladi |
| Skanerlab qabul qilish UI | `client/src/pages/today-orders/index.tsx:618,1319` | Operator oqimi — **shakl to'g'ri**, ichi qayta yoziladi |
| Tashqi buyurtmadan order yasash | `order.service.ts:5648` | Mijoz/tuman/pochta mantiqiy qismi qayta ishlatiladi |
| Navbat + worker + stale recovery | `integration-sync.service.ts:190-425` | `FOR UPDATE SKIP LOCKED` naqshi — **nusxa olinadi** |
| HMAC webhook qabuli | `ldg-signature.util.ts:52,86`, `elchi-webhook.controller.ts:20` | **LDG sxemasi** (`t=...,v1=...`) — kuchliroq, shu olinadi |
| Solishtiruv CRON + mismatch | `elchi-reconcile.service.ts:96,209,354` | 15-daqiqalik CRON, `last_synced_at ASC NULLS FIRST` — **nusxa olinadi** |
| Idempotentlik kaliti (chiqishda) | `ldg-api.service.ts:96-101` | `Idempotency-Key` — LDG'da bor, generikda yo'q |
| Boshqaruv egasi | `order.entity.ts:241` `control_owner` | Ikki daftarga pul yozilishini to'sadi |
| Pul tarixi | `cashbox_history` (`balance_after` bilan) | **Oltin manba** — har o'zgarish uchun 1 qator, balans bilan |

### 2.2 Nima YO'Q — qurilishi shart

> Quyidagilar taxmin emas: har biri kod o'qib, grep bilan tasdiqlangan.

| # | Yo'q narsa | Dalil |
|---|---|---|
| 1 | **Chiquvchi pul kanali** | `queueStatusSync` payload'i: `{[status_field]: status}` + ixtiyoriy `{order_id}` — **boshqa hech narsa** (`integration-sync.service.ts:119-133`) |
| 2 | **Sotuvchi o'lchovi** | `grep -r seller server/src/core/entity` → **0 natija**. `external_integration.market_id` — bitta market |
| 3 | **Kassa → tashqariga ilgak** | `cash-box.service.ts`: `HttpService` yo'q, axios yo'q, `EventEmitter` yo'q, repo'da 0 ta TypeORM subscriber |
| 4 | **Kiruvchi hamkor autentifikatsiyasi** | `external-integration`/`external-proxy`/`integration-sync` — 26 ta route, **hammasi** `JwtGuard + RolesGuard` (odam rollari) |
| 5 | **Tranzaksion outbox** | `queueStatusSync` `commitTransaction()`dan **keyin**, **`await`siz**, hamma narsani yutuvchi `try/catch` ichida |
| 6 | **Idempotentlik kaliti** | Chiquvchi sarlavhalar: faqat `Content-Type` va ixtiyoriy `Authorization` |
| 7 | **Tartib kafolati** | `seq` yo'q, versiya yo'q, per-order serializatsiya yo'q → **eskirgan `sold` muvaffaqiyatli `rollback`dan KEYIN yetib boradi** |
| 8 | **`accepted` hodisasi** | `SyncAction = 'sold'\|'canceled'\|'paid'\|'rollback'\|'waiting'` — yopiq ro'yxat |
| 9 | **`partly_sold` / `extra_cost` hodisasi** | Yuqoridagi ro'yxatda yo'q; qisman sotuv **to'liq sotuv kabi** yuboriladi |
| 10 | **Server tomonda skan saqlash** | Skanlar faqat React state'da (`today-orders/index.tsx:695`); yangilash = butun qop yo'qoladi |
| 11 | **`order.extra_cost` ustuni** | Yo'q. Ortiqcha xarajat = 2 ta `cashbox_history` qatori + `order.comment` ichidagi matn |
| 12 | **order ↔ integration FK** | Bog'lanish — `operator` matn ustunini `external_<slug>` deb parse qilish |
| 13 | **Noyoblik kafolati** | `order.external_id` — indekssiz nullable varchar; `IDX_ORDER_QR_TOKEN` **ataylab noyob emas** |
| 14 | **Solishtiruv (generik yo'lda)** | Elchi/LDG'da bor; bu yo'lda faqat `last_sync_at` hisoblagichi |
| 15 | **Sekretlarni shifrlash** | `api_key`, `password` — **ochiq matn** `varchar`, `GET /external-integration/active` ularni **to'liq qaytaradi** (REGISTRATOR ham ko'radi) |

---

## 3. Asosiy qaror — alohida `marketplace` moduli

### Uch variant ko'rib chiqildi

| Variant | Nima | Qaror |
|---|---|---|
| A. `external_integration`ni kengaytirish | Pul, sotuvchi, webhook, kassani generik yo'lga qo'shish | ❌ **rad** |
| B. **Alohida `marketplace` moduli** | LDG/Elchi qolipi: o'z jadvallari, o'z kontrakti, o'z panelida | ✅ **tanlandi** |
| C. Elchi platformasiga o'tkazish (06-platforma.md) | Butun ishni Elchi'da qurish | ❌ **bu ish uchun rad** |

### Nega B

1. **Adosh prod'da ishlayapti.** `external_integration` yo'liga pul/outbox/webhook qo'shish —
   ishlaydigan integratsiyani xavf ostiga qo'yish. LDG'ni refaktor qilmaslik qarori
   (`05-elchi.md §2`) aynan shu sabab bilan qabul qilingan edi.
2. **Kontrakt BIZNIKI.** Marketplace'da arxitektura yo'q → ular **bizning** API'ni bajaradi.
   Demak `field_mapping` (ularning maydon nomlariga moslashish) **kerak emas** — qattiq DTO,
   qattiq validatsiya, aniq xato. Bu generik adapter yo'lidan **butunlay boshqa shakl**.
3. **Repo qolipi shu.** `ldg-cargo` va `elchi-cargo` — har biri alohida modul. Jamoa buni biladi.
4. **Ikkinchi marketplace kodsiz ulanadi.** Kontrakt bizniki bo'lgani uchun modul ko'p-ijarali
   (`slug` bo'yicha): keyingi marketplace = bitta yangi qator + kalitlar. Kod yozilmaydi.

### Ataylab qayta ishlatilmaydigan narsa
Uchinchi marta yoziladigan ~200 qator HTTP klient (Elchi va LDG'da bor). **Hozircha nusxa
olinadi** — umumiy `PartnerHttpClient` ajratish keyingi (ixtiyoriy) bosqich. Sabab: uchta
ishlaydigan klientni bitta abstraksiyaga majburlash — pul oqimini xavf ostiga qo'yish.

---

## 4. Ma'lumot modeli

### 4.1 Yangi jadvallar (6 ta)

| Jadval | Vazifasi | Kalit cheklovlar |
|---|---|---|
| `marketplace_integration` | Ulanish konfiguratsiyasi (bitta marketplace = bitta qator) | `slug` UNIQUE; `market_id` FK → `users` |
| `marketplace_seller` | Sotuvchilar reestri | UNIQUE `(integration_id, external_seller_id)` |
| `marketplace_parcel` | **Posilka ko'zgusi + skan staging** — eng muhim jadval | UNIQUE `(integration_id, external_parcel_id)`; UNIQUE `(integration_id, qr_token_norm)`; UNIQUE `order_id` |
| `marketplace_scan_session` | Operator skan sessiyasi (server tomonda) | — |
| `marketplace_outbox` | **Tranzaksion outbox** — barcha chiquvchi hodisalar | `event_id` UNIQUE; UNIQUE `(aggregate_type, aggregate_id, seq)` |
| `marketplace_ledger_entry` | **Har-sotuvchi yordamchi daftar** | `cashbox_history_id` UNIQUE (idempotentlik langari) |
| `marketplace_settlement` | Marketplace'ga to'lovlar + sotuvchilar bo'yicha taqsimot | `(integration_id, external_settlement_id)` UNIQUE |

### 4.2 `marketplace_parcel` — batafsil (eng muhim jadval)

```
id                      uuid PK
integration_id          uuid FK
external_order_id       varchar   -- ularning buyurtma ID si
external_parcel_id      varchar   -- ularning POSILKA ID si (ko'p qutili buyurtma uchun)
parcel_index/parcel_count int     -- 2/3 — uchtadan ikkinchisi
qr_token_raw            varchar   -- yorliqdagi asl qiymat (ularga qaytarish uchun)
qr_token_norm           varchar   -- normalizatsiyalangan (PCS skanerlari uchun)  [UNIQUE]
seller_id               varchar   -- ularning sotuvchi ID si
raw_payload             jsonb     -- /parcels/lookup javobi TO'LIQ (audit + qayta tiklash)
declared_product_amount bigint
declared_delivery_amount bigint
cod_amount              bigint    -- mijozdan yig'iladigan summa (0 = oldindan to'langan)
scan_state              enum      -- scanned | accepted | rejected | expired | superseded
scan_session_id         uuid FK
scanned_by / scanned_at
order_id                uuid FK NULL  [UNIQUE]  -- qabuldan keyin to'ladi
accepted_at
remote_status           varchar   -- ularning oxirgi ma'lum statusi
remote_status_at        bigint
last_sent_seq           bigint    -- ularga yuborilgan oxirgi seq
last_synced_at          bigint
mismatch_at / mismatch_reason
```

**Nega bu jadval hal qiluvchi:** hozir skan natijasi **hech qayerda saqlanmaydi** —
brauzerdan serverga qaytib keladi. Ya'ni operator nimani skanerlaganini,
marketplace nima javob berganini, nega qabul qilinmaganini **hech kim bilmaydi**.
Bu jadval bir vaqtning o'zida: staging + audit + ko'zgu + solishtiruv manbai.

### 4.3 `marketplace_ledger_entry` — har-sotuvchi daftar

```
id                  uuid PK
integration_id      uuid FK
seller_id           varchar        -- NULL = umumiy (taqsimlanmagan)
order_id            uuid NULL
cashbox_history_id  uuid FK UNIQUE -- IDEMPOTENTLIK LANGARI
entry_type          enum  -- sale | extra_cost | cancel | correction | settlement | adjustment
amount              bigint  -- ISHORALI (+/-)
balance_after_seller bigint -- shu sotuvchining daftardagi balansi
reverses_entry_id   uuid NULL      -- rollback/teskari yozuv aniq nimani qaytargani
created_at
```

**Invariant:** `SUM(amount) WHERE integration_id = X` == `cash_box.balance`
(marketplace marketi kassasi). Bu **allaqachon mavjud naqsh** —
`SUM(cashbox_card) == balance_card` (`applyCardDelta`, xotira: `cashbox-virtual-cards`).
Jamoa uni biladi, solishtiruv CRON tekshiradi.

### 4.4 `order` jadvaliga qo'shiladigan ustunlar

| Ustun | Tur | Nega |
|---|---|---|
| `integration_id` | `uuid NULL` FK | `operator` matnini parse qilishni **tugatadi**. Hozir slug o'zgarsa barcha buyurtma sinxrondan chiqib ketadi |
| `external_seller_id` | `varchar(120) NULL` + indeks | Qaysi sotuvchi. **Bola buyurtmalarga nusxalanadi** (qisman sotuv, almashtirish) |
| `extra_cost_net` | `bigint DEFAULT 0` | Hozir ortiqcha xarajat faqat 2 ta kassa qatori + izoh matni. Skalyar bo'lmasa hodisaga yozib bo'lmaydi |

Qo'shimcha: `created_source` enumiga `'marketplace'` qiymati (hozir marketplace buyurtmasi
`'manual'` bo'lib ko'rinadi — statistikada ajratib bo'lmaydi).

---

## 5. Oqim 1 — Qabul (skan → lookup → accept)

### 5.1 ⛔ Manifest QURILMAYDI — va bu nimani anglatadi

Qaror (2026-09-15): marketplace qopni oldindan e'lon qilmaydi. Har posilka **skan
paytida** ularning API'sidan topiladi.

**Qabul qilingan oqibatlar — bilib turilsin:**

| Oqibat | Yumshatish |
|---|---|
| **Ularning API'si o'lsa qabul TO'XTAYDI** — zaxira yo'l yo'q | §5.2 dagi qat'iy xato tasnifi + circuit breaker: operator aniq xabar ko'radi va **bo'sh buyurtma yaratilmaydi**. Kontraktda `parcels/lookup` uchun SLA talab qilinadi |
| **Yo'qolgan posilkani aniqlab bo'lmaydi** — «45 tadan 43 keldi» tekshiruvi yo'q | Solishtiruv CRON ularning `updated_since` ro'yxatini davriy oladi va bizda yo'q, lekin ularda «BeePost'ga berilgan» deb turgan posilkalarni panelda ko'rsatadi |
| Ular API'si sekin bo'lsa skan sekinlashadi | Timeout 15s, p95 < 800ms talabi kontraktda |

⚠️ Kelajakda kerak bo'lsa manifest **qo'shimcha** sifatida ulanadi — `marketplace_parcel`
jadvali uni allaqachon qabul qila oladi (skan paytida topilgan posilka bilan bir xil
yozuv). Ya'ni bu qaror **qaytarib bo'lmaydigan emas**.

### 5.2 Har skan — server tomonda

```
Operator QR ni skanerlaydi
        │
        ▼
POST /api/v1/marketplace/:slug/scan   { qr_token, scan_session_id }
        │
        ├─ 1. Token normalizatsiya + shakl tekshiruvi (integratsiya sozlamasi bo'yicha)
        ├─ 2. LOKAL tekshiruv: bu token allaqachon qabul qilinganmi?
        │       ha → 409 "Bu posilka #100042 buyurtma sifatida qabul qilingan"
        ├─ 3. POST {api_url}/bp/v1/parcels/lookup  { qr_token }
        │       ├─ 404          → "ularning tizimida yo'q"  (aniq xabar)
        │       ├─ 401/403/5xx  → "MARKETPLACE API ISHLAMAYAPTI" (butunlay boshqa xabar)
        │       └─ 3 marta ketma-ket xato → NAVBAT TO'XTAYDI (circuit breaker)
        ├─ 4. marketplace_parcel qatori YOZILADI (scan_state = scanned, raw_payload)
        ├─ 5. Validatsiya: tuman topiladimi? narx to'g'rimi? telefon bormi? sotuvchi tanishmi?
        └─ 6. Operatorga normalizatsiyalangan posilka + ogohlantirishlar qaytadi
```

**Bugungi kodda tuzatiladigan 5 ta kritik xato** (§15 da to'liq):
1. Har qanday HTTP xatosi operatorga «ularning tizimida topilmadi» deb ko'rsatiladi, keyin UI
   «baribir qo'shaymi?» deb so'raydi → marketplace o'lganda **butun qop bo'sh buyurtma bo'ladi**.
2. Skan chaqiruvi umumiy axios klientidan **chetlab o'tadi** → sessiya tugasa har skan «topilmadi».
3. «Baribir qo'shish» → narxi 0, mijozi soxta, tumani tasodifiy **haqiqiy** buyurtma yaratadi.
4. Aralash registrli QR **o'zgartirilmasdan** saqlanadi, keyingi skanerlar lowercase qidiradi →
   posilka **abadiy skanerlanmaydigan** bo'lib qoladi.
5. Ko'p qutili buyurtma N ta **to'liq narxli** buyurtmaga aylanadi → mijozdan N marta undiriladi.

### 5.3 Skan sessiyasi — serverda

Hozir skanlar faqat brauzer xotirasida. Yangi model: `marketplace_scan_session`.

| Holat | Bugun | Yangi |
|---|---|---|
| Sahifa yangilandi | **Butun qop yo'qoladi** | Sessiya tiklanadi |
| Brauzer qulab tushdi | Butun qop yo'qoladi | Sessiya tiklanadi |
| Ikki operator bir posilkani skanerladi | **Ikkalasi ham muvaffaqiyatli** | Ikkinchisi 409 oladi |
| «Men nimani skanerladim?» | Javob yo'q | Sessiya tarixi + audit |

### 5.4 Qabul qilish (Qabul qilish tugmasi)

```
POST /api/v1/marketplace/:slug/accept   { scan_session_id, idempotency_key }
        │
        ├─ SERVER saqlagan posilkalardan buyurtma yaratiladi (brauzerdan kelgan ma'lumotdan EMAS)
        ├─ Har posilka uchun SAVEPOINT — bitta buzuq qator 29 ta yaxshisini yiqitmaydi
        ├─ UNIQUE (integration_id, external_parcel_id) → dublikat DB darajasida to'siladi
        ├─ order.integration_id, external_seller_id, extra ustunlar to'ldiriladi
        ├─ marketplace_parcel.order_id bog'lanadi, scan_state = accepted
        ├─ AYNI TRANZAKSIYADA: outbox'ga `parcel.accepted` hodisalari yoziladi
        └─ COMMIT
                │
                ▼
     Worker → POST {api_url}/bp/v1/parcels/accept  { batch_id, items: [...] }
                │
                └─ Ularda status ACCEPTED_BY_BEEPOST ga o'tadi
```

**Nega hodisa tranzaksiya ichida:** hozir `queueStatusSync` commit'dan **keyin**, `await`siz
chaqiriladi. Deploy commit bilan enqueue orasida bo'lsa — hodisa **butunlay yo'qoladi** va
buni hech narsa sezmaydi. Outbox qatori pul bilan bitta tranzaksiyada yoziladi.

### 5.5 Qabul qilinmaydigan posilka

Operator posilkani **rad eta oladi** (buzilgan, bizga tegishli emas, hududimiz emas):
`scan_state = rejected` + `parcel.rejected` hodisasi + sabab. Hozir bunday tushuncha yo'q —
operator shunchaki skanerlamaydi va marketplace **hech qachon bilmaydi**.

---

## 6. Oqim 2 — Status sinxroni

### 6.1 Hodisalar xaritasi

| PCS hodisasi | PCS statusi | Hodisa turi | Pul bormi |
|---|---|---|:---:|
| Qabul qilindi | `RECEIVED` | `parcel.accepted` | — |
| Rad etildi | — | `parcel.rejected` | — |
| Pochtaga jo'natildi | `ON_THE_ROAD` | `parcel.dispatched` | — |
| Hududga yetdi / kuryerda | `WAITING` | `parcel.out_for_delivery` | — |
| **Sotildi** | `SOLD` | `parcel.delivered` | ✅ |
| **Qisman sotildi** | `SOLD` + bola `CANCELLED` | `parcel.partly_delivered` | ✅ |
| **Ortiqcha xarajat** | — | `parcel.extra_cost_applied` | ✅ |
| **Bekor qilindi** | `CANCELLED` | `parcel.cancelled` | ✅ |
| Qaytish yo'lida | `CANCELLED_SENT` | `parcel.returning` | — |
| Marketga qaytarildi | `CLOSED` | `parcel.returned` | — |
| **Ortga qaytarildi** | `WAITING` | `parcel.rolled_back` | ✅ (teskari) |
| To'landi (avtomatik qarz hisobidan) | `PAID`/`PARTLY_PAID` | `ledger.entry` | ✅ |

⚠️ **`PAID` statusi hech qachon "biz sotuvchiga pul berdik" degani emas.** PCS'da market
balansi manfiy bo'lsa, sotuv **avtomatik eski qarzni yopadi** va status `PAID` bo'ladi —
hech qanday pul harakat qilmagan holda (`order.service.ts:2700-2720`). Agar marketplace
`PAID`ni "pul keldi" deb tushunsa, **yo'q pulni sotuvchiga taqsimlaydi**. Shuning uchun
kontraktda: **hisob-kitob faqat `settlement.paid` hodisasidan o'qiladi**, statusdan emas.

### 6.2 Tartib va idempotentlik — uchta majburiy mexanizm

| Mexanizm | Nima qiladi | Nega majburiy |
|---|---|---|
| `event_id` (uuid, **qayta urinishlarda o'zgarmaydi**) | Ular dublikatni tashlaydi | Hozir: 15s timeout → qayta yuborish → **ikkinchi marta sotuvchiga pul yozilishi** |
| `seq` (posilka bo'yicha monoton) | Ular eskirgan hodisani rad etadi | Hozir: `sold` 502 oladi → 60s kutadi; shu orada `rollback` ketadi va **muvaffaqiyatli**; keyin eskirgan `sold` yetib boradi → **marketplace noto'g'ri terminal holatda qoladi** |
| Posilka bo'yicha serializatsiya | Bir posilka uchun bir vaqtda 1 ta hodisa | Yuqoridagining ildizi |

Bizda ham himoya: `marketplace_parcel.last_sent_seq` dan past `seq` **yuborilmaydi**,
`superseded` deb belgilanadi.

### 6.3 Qisman sotuv (qiyin joy)

Bugun PCS'da qisman sotuv: ota buyurtma narxi kamayadi + **bola buyurtma** `CANCELLED`
holatida qolgan summa bilan yaratiladi. Bola `external_id`siz, `operator`siz — ya'ni
**sinxron uchun ko'rinmas**. Marketplace esa `completed` deb **to'liq asl narxda** xabar oladi.

**Qaror kerak (§19 S4).** Ikki variant:

| Variant | Marketplace ko'radi | Narxi |
|---|---|---|
| **A. Bitta o'zgartirilgan buyurtma** ✅ tavsiya | `parcel.partly_delivered` + `delivered_amount` + `returned_amount` + mahsulot ro'yxati | Ularda «qisman» tushunchasi bo'lishi shart |
| B. Ikkita buyurtma | Ota `delivered`, bola `cancelled` (yangi `parcel_id` bilan) | Bizda bola'ga `external_id` nusxalash kerak; ularda ID ko'payadi |

### 6.4 Rollback — biznes xavfi, texnik emas

PCS `rollbackOrderToWaiting` **avval commit qiladi** (pul qaytadi), **keyin** hodisa yuboradi.
Agar marketplace rad etsa (masalan sotuvchiga allaqachon to'langan), natija:
**PCS'da pul qaytarilgan, ularda sotilgan** — va hozir buni hech narsa sezmaydi.

Marketplace noldan quriladi, shuning uchun **kontraktda rollback MAJBURIY** qilinadi.
Lekin rad etilish yo'li baribir yoziladi:

```
Ular 409 qaytardi (rollback qabul qilinmadi)
     ├─ marketplace_parcel.mismatch_at + mismatch_reason
     ├─ Admin panelida «NOMUVOFIQLIK» kartasi
     ├─ Buyurtmada banner: "Marketplace ortga qaytarishni qabul qilmadi"
     └─ Shu buyurtmada keyingi amallar BLOKLANADI (operator hal qilmaguncha)
```

⚠️ Muqobil: **ikki fazali rollback** (avval so'raymiz, ular tasdiqlasa pulni qaytaramiz).
Xavfsizroq, lekin operator uchun sekinroq. **Tavsiya: bir fazali + rad etilishni ushlash**,
chunki kontraktda rollback majburiy va rad etish kamdan-kam holat bo'ladi.

---

## 7. Oqim 3 — Kassa sinxroni

### 7.1 Ikki bosqichli tarif — farq chiqadimi? **YO'Q**

Kelishuv: BeePost ↔ Marketplace = **50 000 markazga, 70 000 uygacha**.
Marketplace o'z sotuvchilariga **xohlagan narxini** qo'yadi (masalan 65 000 / 90 000).

Savol: shunda ikki kassa farq qilib qolmaydimi?

**Javob: yo'q — chunki bu ikki xil kassa emas, ikki xil DARAJADAGI ikki daftar.**

```
   MIJOZ
     │  COD = 300 000
     ▼
  BEEPOST  ──── bizning daftar ────▶  bizning tarif 50 000 yechiladi
     │                                 biz marketplace'ga 250 000 qarzdormiz
     ▼
 MARKETPLACE ── ularning daftari ──▶  o'z tarifi 65 000 yechiladi
     │                                 ular sotuvchiga 235 000 to'laydi
     ▼
  SOTUVCHI

  Farq = 250 000 − 235 000 = 15 000 = MARKETPLACE MARJASI (xato emas)
```

| Kim | Formula | Natija |
|---|---|---|
| **Bizning daftar** (BeePost ↔ Marketplace) | `COD − beepost_fee − extra_cost` | 300 000 − 50 000 = **250 000** |
| **Ularning daftari** (Marketplace ↔ Sotuvchi) | `COD − ularning tarifi − ...` | 300 000 − 65 000 = **235 000** |
| **Marja** | `ularning tarifi − bizning tarif` | **15 000** — ularniki, biz bilmaymiz |

Yetkazish narxini mijoz to'laydimi yoki sotuvchi — **bizga farqi yo'q**:

| Model | COD | Bizning daftar | Ularning daftari | Marja |
|---|---|---|---|---|
| Yetkazishni **sotuvchi** to'laydi | 300 000 | 250 000 | 235 000 | 15 000 |
| Yetkazishni **mijoz** to'laydi (+65 000) | 365 000 | 315 000 | 300 000 | 15 000 |

Ikkala holda ham bizning formula **o'zgarmaydi**: `COD − bizning tarif − ortiqcha xarajat`.

> ### 🔴 Asosiy xavf — texnik emas, TUSHUNCHA xatosi
> Agar sinxronni «bizning kassa == ularning kassasi» deb loyihalasak, u **har bir
> buyurtmada** farq ko'rsatadi va bir haftada hech kim haqiqiy xatoni marjadan
> ajrata olmay qoladi. Shu bois:
>
> - Kontraktdan **`payable_to_seller` maydoni olib tashlandi** — biz sotuvchiga
>   qancha tegishini **bilmaymiz va bilishimiz shart emas**.
> - O'rniga **`net_to_marketplace`** — faqat bizning daraja.
> - `seller_id` **attributsiya uchun** yuboriladi (qaysi sotuvchining posilkasi),
>   **balans uchun emas**.
> - Solishtiruv **faqat bitta son bo'yicha**: biz marketplace'ga qancha qarzdormiz.

### 7.2 🔴 HAQIQIY farq manbalari — kodda topilgan uchtasi

Ikki bosqichli tarif farq bermaydi. Lekin quyidagi uchtasi **beradi** va hozir
hech narsa ularni to'smaydi.

| # | Muammo | Kod | Nima bo'ladi |
|---|---|---|---|
| **B7** | **Tarif SOTUV paytida jonli o'qiladi, muzlatilmaydi** | `sellOrder`: `order.market_tariff ?? (where_deliver===CENTER ? market.tariff_center : market.tariff_home)` | Dushanba qabul qilingan posilka chorshanba sotilsa va seshanba tarif o'zgargan bo'lsa — **yangi tarif qo'llanadi**. Marketplace eski tarifni kutgan. Har tarif o'zgarishida yo'ldagi barcha posilka siljiydi |
| **B8** | **Operator har buyurtmada tarifni qo'lda o'zgartira oladi** | `PATCH order/:id` → `update-order.dto.ts` da `market_tariff`, `courier_tariff`, `where_deliver` **ochiq** | Bitta operator kelishilgan 50 000 ni 30 000 qilib qo'ysa — **kelishuv jimgina buziladi**, marketplace 50 000 kutadi |
| **B9** | **`where_deliver` qabulda ularning so'zidan EMAS, market sozlamasidan olinadi** | `receiveExternalOrders`: `where_deliver: market.default_tariff \|\| CENTER` — payload'dagi qiymat **o'qilmaydi** | Ular «uyga» desa ham hammasi «markaz» bo'lib tushadi → **70 000 o'rniga 50 000** yechiladi. Har posilkada 20 000 farq |

**Yechim — tarif shartnomasi kodga tushiriladi:**

```
1. Tarif QABUL paytida MUZLATILADI
   order.market_tariff = kelishilgan tarif (where_deliver bo'yicha)
   → sotuvda jonli qiymat o'qilmaydi (B7 yopiladi)

2. where_deliver ULARNING payload'idan olinadi
   → market.default_tariff bu integratsiyada ishlatilmaydi (B9 yopiladi)

3. Marketplace buyurtmasida qo'lda tarif o'zgartirish BLOKLANADI
   PATCH order/:id → marketplace buyurtmasi bo'lsa market_tariff/
   courier_tariff/where_deliver rad etiladi (B8 yopiladi)

4. Tarif shartnomasi VERSIYALANADI
   marketplace_tariff (integration_id, tariff_center, tariff_home,
                       effective_from, effective_to, version)
   → har posilkada tariff_version yoziladi va hodisada yuboriladi
   → «qaysi tarif qo'llandi» savoli hech qachon bahsli bo'lmaydi

5. where_deliver o'zgarsa (markaz → uy) — parcel.fee_changed hodisasi
   → tarif 50 000 dan 70 000 ga o'tdi, marketplace darhol biladi
```

### 7.3 Har-sotuvchi model (S1 qarori)

| Variant | Qanday | Afzallik | Kamchilik |
|---|---|---|---|
| A. O'tkazuvchi | Har hodisada `seller_id`, taqsimotni ular qiladi | Eng arzon | «Sotuvchi X ga qancha?» — javob yo'q. Nizoda dalil yo'q |
| B. Har sotuvchiga market | 40 sotuvchi = 40 market | Mavjud kod ishlaydi | Siz bitta market dedingiz; hisob-kitob 40 ga bo'linadi |
| **C. Bitta market + yordamchi daftar** ✅ | Bitta kassa + `marketplace_ledger_entry` | Bitta hisob-kitob **va** har-sotuvchi dalil | +1 jadval, +1 invariant |

**Muhim aniqlik:** yordamchi daftar **bizning tarifimiz bo'yicha** attributsiya qiladi
(`COD − 50 000`), ularning sotuvchi balansini emas. Ikkalasi **hech qachon teng bo'lmaydi**
va bu **to'g'ri**.

**Invariant:** `SUM(marketplace_ledger_entry.amount) == cash_box.balance`
(marketplace marketi kassasi) — allaqachon isbotlangan naqsh:
`SUM(virtual kartalar) == balance_card` (`applyCardDelta`).

### 7.4 Kassa sinxroni QANCHALIK chuqur bo'lsin — qayta baholandi

Siz to'g'ri sezdingiz: **ularga kassaga dostup berish kerak emas.** Bundan tashqari,
tahlil paytida muhim narsa aniqlandi:

> **Pul allaqachon posilka hodisalari ichida ketadi.** `parcel.delivered`,
> `parcel.cancelled`, `parcel.partly_delivered`, `parcel.extra_cost_applied`,
> `parcel.rolled_back` — hammasi summani va `balance_after`ni olib yuradi.
> Ya'ni kassa harakatlarining **~99%i baribir yetib boradi**.

Demak har kassa harakati uchun **alohida push kanali qurish shart emas**.

| Daraja | Nima | Baho |
|---|---|---|
| ~~L3 — to'liq push~~ | Har `cashbox_history` qatori → alohida hodisa. 7 ta kassa nuqtasini yangi funnel'ga o'tkazish | ❌ **rad etildi** — eng qimmat va **rejadagi eng yuqori xavf (R3)** |
| **L2+ — gibrid** ✅ | Pul posilka hodisalari ichida + `settlement.paid` push + `ledger.entry` **faqat posilkasiz harakatlar uchun** + kunlik snapshot + `GET /ledger` pull | ✅ **tavsiya** |
| L1 — faqat ko'rsatish | Faqat bizning panelda | ❌ ular solishtira olmaydi |

**L2+ da nima quriladi:**

| # | Komponent | Izoh |
|---|---|---|
| 1 | Pul posilka hodisalari ichida | **Allaqachon dizaynda** — qo'shimcha ish yo'q |
| 2 | `settlement.paid` push | Majburiy — «pul bizdan chiqdi» yagona signali |
| 3 | `ledger.entry` **faqat** posilkasiz harakatlar uchun | Qo'lda tuzatish, korreksiya. Kam uchraydi, kichik ish |
| 4 | Kunlik `ledger.snapshot` | Jimgina siljishni ushlaydi |
| 5 | `GET /marketplace/ledger` (pull) | **Faqat o'z `integration_id`si** — kassaga dostup YO'Q |
| 6 | **Integratsiyalar sahifasida panel** | Siz aytgandek — §7.5 |

**Nima tejaydi:** 7 ta kassa nuqtasini yangi chiquvchi funnel'ga o'tkazish kerak emas.
Bu rejadagi **eng yuqori ehtimolli xavf (R3)** edi — u endi yo'q.
**4+5-bosqich: 7–8 kundan → 5–6 kunga.** Umumiy: **24–30 → 22–28 dev-kun**.

> Yordamchi daftar (`marketplace_ledger_entry`) baribir yoziladi — lekin **bizning
> ichki hisobimiz va panel uchun**, push kanali sifatida emas. U faqat marketplace'ga
> tegishli nuqtalarda yoziladi, kechalik invariant tekshiruvi esa biror nuqta
> unutilgan bo'lsa **darhol ushlaydi**.

### 7.5 Integratsiyalar sahifasidagi panel (siz taklif qilgan yo'l)

«Marketplace — hisob-kitob» tabi:

| Blok | Nima ko'rsatadi |
|---|---|
| **Joriy balans** | Biz marketplace'ga qancha qarzdormiz + oxirgi harakat vaqti |
| **Solishtiruv kartasi** | *Bizda:* 42 350 000 · *Ularda:* 42 350 000 · **Farq: 0** — `GET /bp/v1/ledger/balance` orqali. Farq bo'lsa qizil + «sabab» tugmasi |
| **Sotuvchilar jadvali** | Har sotuvchi: posilka soni · yig'ilgan · bizning haq · ortiqcha xarajat · **sof (bizning tarifda)**. ⚠️ Izoh: «bu marketplace'ning sotuvchiga to'lovi EMAS» |
| **Harakatlar tarixi** | sotuv · ortiqcha xarajat · bekor · korreksiya · hisob-kitob (`balance_after` bilan) |
| **Tarif holati** | Kelishilgan: 50 000 / 70 000 · **Qo'llangan**: nechta posilkada boshqa tarif ishlatilgan (B7/B8 nazorati) · amaldagi versiya va sanasi |
| **Hodisa monitori** | Yuborilgan · kutilayotgan · xato · **nomuvofiqlik** — qayta yuborish tugmasi bilan |
| **Hisob-kitob** | «To'lov qilish» → sotuvchilar bo'yicha taqsimot + `settlement.paid` |

**Ular ko'radigan narsa** — faqat `GET /marketplace/ledger` (o'z `integration_id`si
bilan cheklangan). Kassa, boshqa marketlar, ichki balanslar — **ko'rinmaydi**.

### 7.6 Tutash nuqta — `cashbox_history` INSERT

Market balansini o'zgartiradigan **7 ta joy** bor, lekin **har balans o'zgarishiga
aniq 1 ta `cashbox_history` qatori** to'g'ri keladi (sanab tekshirilgan). Demak
yordamchi daftar yozuvi uchun yagona to'g'ri joy — shu INSERT.

```
writeCashboxEntry()   ← marketplace marketi uchun yagona funnel
     │
     ├─ 1. cash_box balansini ATOMIK yangilaydi
     │       UPDATE cash_box SET balance = balance + $1 ... RETURNING balance
     │       ⚠️ hozir: JS'da o'qib-yozish, LOCKSIZ → parallel sotuvda pul YO'QOLADI (B1)
     ├─ 2. cashbox_history qatorini yozadi (balance_after bilan)
     ├─ 3. AGAR bu marketplace marketi bo'lsa:
     │       └─ marketplace_ledger_entry (seller_id + tariff_version bilan)
     └─ hammasi BITTA tranzaksiyada
```

⚠️ Karta↔karta va karta↔naqd o'tkazmalari `cashbox_history`ga **yozilmaydi**
(`cashbox_card_movement`ga yoziladi). Marketplace uchun bu **to'g'ri** — ular faqat
asosiy kassaga tegishli.

### 7.7 Ikki daftarning teng yurishini NIMA ta'minlaydi

| Qatlam | Mexanizm | Qaysi xatoni to'sadi |
|---|---|---|
| 1 | **Har hodisada `balance_after`** | Bitta hodisa yo'qolsa — keyingisi **o'zi tuzatadi** |
| 2 | **`seq` uzilishini aniqlash** | 145 dan 147 ga sakradi → 146 yo'qolgan → qayta so'raladi |
| 3 | **Kunlik `ledger.snapshot` + `GET /ledger/balance` solishtiruvi** | Ikkalasi ham yiqilsa |
| 4 | **`tariff_version` har hodisada** | «Qaysi tarif qo'llandi» bahsi umuman chiqmaydi |

### 7.8 Hisob-kitob (marketga pul berish) — maxsus e'tibor

Bugungi `paymentsToMarket` marketplace uchun **xavfli**: u to'lovni **eng eski
buyurtmalardan FIFO** taqsimlaydi. 40 sotuvchili marketda bu degani: **A sotuvchi
uchun berilgan pul C, D, E sotuvchilarining buyurtmalarini «to'langan» qilib qo'yadi.**

**Qaror:** marketplace marketi uchun **alohida hisob-kitob ekrani** — to'lov sotuvchi
bo'yicha yoki aniq taqsimot ro'yxati bilan kiritiladi; `settlement.paid` hodisasi
taqsimot bilan yuboriladi; umumiy FIFO yo'li marketplace marketi uchun **bloklanadi**.

### 7.9 Pul qoidalari — yakuniy jadval (2026-09-15 kelishuvi)

> Misol raqamlari: kelishilgan tarif **markazga 50 000**, **uyga 70 000**.
> Tizimda tarif aynan shu — **sof emas, to'liq** (§7.11).

| Holat | `beepost_fee` | `extra_cost` | `net_to_marketplace` | Kodda |
|---|---:|---:|---:|---|
| **Sotildi** (oddiy) | 50 000 | 0 | `COD − 50 000` | ✅ hozirgi kod |
| **Sotildi** + ortiqcha xarajat | 50 000 | 5 000 | `COD − 55 000` | ✅ hozirgi kod |
| **Qisman sotildi** | 50 000 | 0 | `yetkazilgan − 50 000` | 🔧 hodisa yangi |
| **Bekor** (kuryer bormagan) | **0** | 0 | **0** | ✅ hozirgi kod |
| **Bekor** (kuryer borib rad javobi oldi) | **0** | 5 000 | **−5 000** | ✅ hozirgi kod |
| **Qaytarildi** (marketga) | 0 | 0 | 0 | ✅ **bepul** |
| **Prepaid** (`COD = 0`) | 50 000 | 0 | **−50 000** | ✅ hozirgi kod (CASE 2/3) |
| **COD tarifdan kam** (30 000) | 50 000 | 0 | **−20 000** | ✅ hozirgi kod (CASE 3) |
| **Rollback** | teskari | teskari | teskari | 🔧 B5 tuzatilishi shart |
| **Yo'qolgan posilka** | — | — | — | ⛔ **tizimda yo'q** — alohida kelishiladi |

### 7.10 🔴 Prepaid — `net_to_marketplace` MANFIY bo'lishi

Bu kelishuvning eng nozik texnik oqibati. `cod_amount` kam yoki `0` bo'lsa,
**tarif baribir hisoblanadi** — ya'ni marketplace **bizga qarzdor** bo'ladi.

```
Prepaid posilka:
  collected_from_customer = 0
  beepost_fee             = 50 000
  net_to_marketplace      = −50 000      ← ularning hisobidan YECHILADI
  seller_id               = "SLR-81"     ← qaysi sotuvchidan ushlanishi kerakligi
```

**Yaxshi xabar:** PCS buni **allaqachon to'g'ri qiladi**. `sellOrder`da uchta shox bor:

| Shox | Shart | Market kassasi |
|---|---|---|
| CASE 4 (normal) | `price ≥ marketTarif` | **INCOME** `price − marketTarif` |
| CASE 3 | `price < marketTarif` | **EXPENSE** `marketTarif − price` |
| CASE 2 | `price < courierTarif` | **EXPENSE** `marketTarif − price` |

Ya'ni COD tarifdan kam bo'lsa market kassasidan pul **yechiladi** — aynan siz
aytgandek. Yangi ish faqat: bu summani `seller_id` bilan birga hodisaga solish.

**Ikkita natija — ikkalasi ham hujjatlashtirilishi shart:**

| # | Natija | Ta'siri |
|---|---|---|
| 1 | **Daftar yozuvi manfiy bo'ladi** | Kontraktda MUST: marketplace manfiy `net`ni qabul qilishi shart. `if (amount <= 0) skip` deb yozsa — prepaid posilkalar daftariga umuman tushmaydi |
| 2 | **Umumiy balans manfiy bo'lishi mumkin** | Ko'p prepaid bo'lsa marketplace bizga qarzdor bo'ladi. ⚠️ Bu **avto-qarz-qoplash tuzog'ini kuchaytiradi**: keyingi sotuvda PCS avtomatik qarzni yopadi va status `PAID` bo'ladi — pul harakat qilmagan holda. Shuning uchun `PAID` **hech qachon** hisob-kitob signali emas (§6.1) |

### 7.11 Hamkorlik komissiyasi — tizimdan tashqarida

Kelishuv: marketplace bizga **50 000** (markaz) / **70 000** (uy) to'laydi. Shundan
ma'lum bir qismi (masalan 10 000) hamkorlik va buyurtma topib bergani uchun
marketplace'ga qaytariladi — lekin **alohida to'lov sifatida**, buyurtma oqimidan tashqarida.

**Qaror (2026-09-15): tizimda tarif TO'LIQ 50 000 / 70 000 deb belgilanadi.**
Komissiya kodga, kontraktga va daftarga **umuman kirmaydi**.

| Nima | Qaror |
|---|---|
| PCS market tarifi | **50 000 / 70 000** (to'liq) |
| `beepost_fee` hodisada | **50 000** — kelishilgan to'liq tarif |
| `gross_delivery_fee` / `partner_commission` maydonlari | ⛔ **YO'Q** — kontraktdan olib tashlandi |
| `marketplace_tariff`ga qo'shimcha ustun | ⛔ **kerak emas** |
| Komissiya to'lovi | BeePost va marketplace o'rtasida **alohida kelishiladi va to'lanadi** |

**Arxitekturaga ta'siri: YO'Q.** Bu variant sof tarif (40k/60k) variantidan ham
**soddaroq** — bitta ustun va ikkita hodisa maydoni kam.

#### ⚠️ Bitta buxgalteriya oqibati — bir marta aytib qo'yiladi

PCS har buyurtmada marjani `market_tariff − courier_tariff` deb hisoblaydi. Tarif
50 000 bo'lgani uchun **buyurtma darajasidagi marja 10 000 ga yuqori ko'rinadi**.

```
PCS ko'rsatadi:   50 000 − courier_tariff
Haqiqiy marja:    40 000 − courier_tariff
Farq:             10 000 × yetkazilgan buyurtmalar soni
```

Bu **xato emas** — chunki komissiya haqiqatda keyinroq to'lanadi. Kompaniya darajasidagi
foyda **to'g'ri chiqadi**, lekin faqat bitta shart bilan:

> 🔴 **Komissiya to'lovi kassaga XARAJAT sifatida kiritilishi shart.**
> Aks holda pul kassadan chiqib ketadi, lekin hisobotda ko'rinmaydi — va
> foyda doimiy ravishda yuqori ko'rsatiladi.

Amalda: `Source_type.MANUAL_EXPENSE` (yoki `BILLS`) orqali asosiy kassadan, izohda
davr va buyurtmalar soni ko'rsatilgan holda. **Yangi kod kerak emas** — bu yo'l allaqachon bor.

⚠️ Buni alohida ta'kidlashimning sababi: PCS'da **investor moduli** foydani taqsimlaydi.
Komissiya kassaga kiritilmasa, taqsimlanadigan foyda ham yuqori chiqadi.

**Agar kelajakda per-hamkor hisobot kerak bo'lsa:** `Source_type`ga yangi qiymat
(`PARTNER_COMMISSION`) qo'shiladi — bu `ALTER TYPE` migratsiyasi, ~2 soat. Hozircha
kerak emas.

### 7.12 ⚠️ Parallel ish bilan kesishuv — ortiqcha xarajat tasdig'i

2026-09-15 holatiga ko'ra repo'da **commit qilinmagan parallel ish** bor (boshqa sessiyada
yozilmoqda): «qo'shimcha xarajat: isbot + market tasdig'i»
(`docs/plans/qoshimcha-xarajat-tasdiqlash.md`, 577 qator).

**Ular qilayotgan ish — qisqacha:** market darajasidagi `extra_cost_proof_required` bayrog'i
yoqilgan bo'lsa, kuryer yozgan xarajat kassaga **umuman yozilmaydi** — `extra_cost_request`
jadvaliga foto isbot bilan `pending` qator tushadi va pul **faqat market tasdiqlaganda**
yoziladi.

#### Ularning ishi TEKSHIRILDI — marketplace uchun xavfsiz

| Tekshirilgan | Natija |
|---|---|
| Bayroq **o'chiq** market | Xulq **100% o'zgarmaydi** — bugungi kod bayt-ma-bayt bir xil |
| `amount <= 0` | Policy'dan darhol chiqadi — LDG (`extraCost: 0`) va bulk **butunlay tegilmaydi** |
| Kod holati | `users`ga **2 ta ustun** tushgan (`extra_cost_proof_required`, `extra_cost_auto_approve_under`) — uchinchisi qarorga ko'ra olib tashlangan |
| Rejaning §7.9 pul jadvali | **O'zgarmaydi** (bayroq o'chiq bo'lsa) |

#### 🔴 Kesishuv 1 — policy qoidasi marketplace holatini QAMRAMAYDI

✅ **Kod bo'yicha tasdiqlandi** (2026-09-16): `server/src/api/order/utils/extra-cost-policy.util.ts`
yozilgan va `EXTRA_COST_APPROVAL_FLOW_READY = true`. Qoidalar tartibi (faylning o'zidan):

```
1. amount <= 0                               → immediate + auto_rule  (bulk/LDG xavfsiz)
2. courier.external_provider != null         → immediate + external_auto
3. market.extra_cost_proof_required !== true → immediate + auto_rule
4. actionType === PRICE_CUT                  → immediate + isbot majburiy
5. amount < auto_approve_under               → immediate + auto_rule
6. aks holda                                 → deferred  ← MARKETPLACE SHU YERGA TUSHADI
```

⚠️ **Marketplace buyurtmasi 2-qoidaga tushmaydi.** Sabab: marketplace — **SOURCE**
(ular buyurtma beradi), yetkazishni **bizning o'z kuryerimiz** qiladi, ya'ni
`courier.external_provider = null`. Elchi/LDG esa **CARRIER** — u yerda virtual kuryer bor.

Demak faqat 3-qoida ushlab qoladi. Agar kimdir marketplace marketida bayroqni
**yoqib qo'ysa**:

```
kuryer xarajat yozdi → pending → tasdiqlovchi YO'Q
                                  (marketplace PCS'ga kirmaydi va O5 bo'yicha
                                   bizga yoza olmaydi)
   ↓ 7 kun
escalated → admin navbati
   ↓ yana 7 kun
auto_backstop → approved (14-kuni pul yoziladi)
```

Natija: `parcel.extra_cost_applied` hodisasi **14 kun kechikadi**, solishtiruv CRON esa
o'sha 14 kun davomida **nomuvofiqlik** ko'rsatadi.

**Yechim — bizning tomonda, ularning ishiga tegmasdan.** `marketplace_integration`
jadvali hali yo'q, shuning uchun ular bugun bu qoidani yoza olmaydi. Biz 1-bosqichda
o'z jadvalimizni qurganimizdan keyin **ularning policy util'iga 4-qoida qo'shamiz**:

```
2b. market marketplace integratsiyasiga bog'langan → immediate + external_auto
```

Fayl buni ataylab qo'llab-quvvatlaydi — o'z izohida shunday yozilgan:
*«Kelajakdagi barcha qoidalar (chegara bo'yicha eskalatsiya, hudud bo'yicha istisno,
kuryer ishonch reytingi...) FAQAT shu faylga qo'shiladi»*. Qo'shimcha himoya: bayroqni marketplace marketida yoqishni
admin UI'da **bloklash**.

#### 🔴 Kesishuv 2 — ikkita raqobatchi "yagona funnel"

| | Ularning ishi | Bizning reja |
|---|---|---|
| Nima | `ExtraCostApplierService` — ortiqcha xarajat pulini yozadigan **yagona** funksiya (3 ta nusxa shunga ko'chiriladi) | `writeCashboxEntry()` — marketplace daftari uchun **yagona** funnel (§7.6) |
| Qamrov | Faqat `extra_cost` yo'li | Barcha market kassa yozuvlari |

Ikkalasi **ayni kodga tegadi**. Mustaqil qurilsa merge to'qnashuvi va ikki karra refaktor
bo'ladi.

> **Qaror (tavsiya):** bizning daftar ilgagi ularning `ExtraCostApplierService` ichiga
> **qo'yiladi** (raqobatchi refaktor qilinmaydi). Sotuv/bekor/rollback yo'llari uchun
> ilgak alohida qo'yiladi. Ya'ni **ular birinchi, biz ikkinchi** — 4-bosqich ularning
> ishi merge bo'lgandan keyin boshlanadi.

#### 🟠 Kesishuv 3 — hodisa QAYERDAN chiqarilishi

Tasdiq oqimi yoqilgan bo'lsa, pul **kuryer yozganda emas, tasdiqlanganda** harakat qiladi.
Demak `parcel.extra_cost_applied` hodisasi **kuryer amalidan emas, kassa yozuvidan**
chiqarilishi shart — aks holda marketplace'ga hali harakat qilmagan pul haqida xabar ketadi.

Bu 2-kesishuv qarorini kuchaytiradi: ilgak **applier ichida** bo'lsa, hodisa avtomatik
to'g'ri vaqtda chiqadi.

#### 🟢 Kesishuv 4 — `price_cut` bizning `parcel.price_changed`ga to'g'ri keladi

Ularning `ExtraCostAction.PRICE_CUT` («kuryer mahsulot sonini o'zgartirmasdan narxni
pasaytirdi») — bu COD'ni o'zgartiradi, ya'ni `net_to_marketplace`ni ham. Bizning hodisa
katalogimizda u allaqachon bor: **`parcel.price_changed`** (§9.2). Ziddiyat yo'q —
4-bosqichda ulanadi.

#### 🟢 Kesishuv 5 — migratsiya raqami

Ular `1749700000000` ni oldi. **Bizning migratsiyalar `1749800000000` dan boshlanadi.**

## 8. Avtoritet modeli — kim nimani o'zgartiradi

Qaror (2026-09-15): **marketplace bizning tizimga hech narsa yoza olmaydi.**

| O'tish | Egasi | Marketplace nima qila oladi |
|---|---|---|
| Posilka yaratish | **Marketplace** | O'z tizimida |
| Qabuldan OLDIN bekor qilish (`VOIDED`) | **Marketplace** | O'z tizimida. Biz skan paytida `lookup` orqali ko'ramiz va **qabul qilmaymiz** |
| **Qabul qilish** | **BeePost** | Faqat o'qiydi |
| Jo'natish · yetkazish · **bekor** · rollback · ortiqcha xarajat | **BeePost** | **Hech narsa** — telefon/Telegram orqali so'raydi, operator hal qiladi |
| Mijoz ma'lumotini tuzatish | **BeePost operatori** | Biz bilan bog'lanadi |
| Sotuvchi reestri | **Marketplace** | Biz `GET /sellers` bilan tortib olamiz |
| **Pul / kassa** | **BeePost** | `GET /ledger` bilan **o'qiydi**, nomuvofiqlikni aytadi |

**Kodga tushishi:**

```
Qabuldan keyin order.control_owner = null   (PCS harakat qiladi)

Marketplace uchun YOZUV endpointi YO'Q:
  ❌ POST /marketplace/webhook
  ❌ POST /marketplace/manifest
  ❌ kiruvchi HMAC + raw-body middleware + webhook_log jadvali

Marketplace uchun O'QISH endpointlari (X-Api-Key guard):
  ✅ GET /marketplace/parcels/:id
  ✅ GET /marketplace/ledger
  ✅ GET /marketplace/events?since_seq=
```

> **Nega bu yaxshi qaror:** kiruvchi yozuv yo'li — integratsiyaning eng xavfli qismi
> (imzo tekshiruvi, raw body, replay himoyasi, holat o'zgartirish huquqi). Uni
> **umuman qurmaslik** xavfsizlik yuzasini keskin kichraytiradi va 2–3 kun tejaydi.
> O'qish yo'li uchun oddiy API-kalit qo'riqchisi yetarli.

## 9. Hodisa modeli (texnik)

### 9.1 Yagona chiquvchi konvert

```json
{
  "event_id":   "9f2c...-uuid",       // qayta urinishda O'ZGARMAYDI = idempotentlik kaliti
  "seq":        145,                   // posilka bo'yicha monoton
  "event_type": "parcel.delivered",
  "occurred_at": 1789480740752,        // epoch ms — PCS'da sodir bo'lgan payt
  "sent_at":     1789480741900,
  "integration": "uzum",
  "parcel": {
    "external_order_id":  "ORD-8842",
    "external_parcel_id": "PCL-8842-1",
    "seller_id":          "SLR-77",
    "beepost_order_id":   "uuid",
    "beepost_order_number": 100042
  },
  "status": { "from": "waiting", "to": "delivered" },
  "money": {
    "currency": "UZS",
    "product_amount":          180000,
    "delivery_amount":          20000,
    "collected_from_customer": 200000,
    "beepost_fee":              25000,   // market_tariff — snapshot
    "extra_cost":                5000,
    "payable_to_seller":       170000    // = collected − fee − extra_cost
  },
  "ledger": { "entry_id": "uuid", "balance_after": 42350000 },
  "actor":  { "type": "courier", "id": "uuid", "name": "..." }
}
```

### 9.2 Hodisa turlari (to'liq ro'yxat)

| Guruh | Turlar |
|---|---|
| Posilka | `parcel.accepted` · `parcel.rejected` · `parcel.dispatched` · `parcel.out_for_delivery` · `parcel.delivered` · `parcel.partly_delivered` · `parcel.cancelled` · `parcel.returning` · `parcel.returned` · `parcel.rolled_back` |
| Pul | `parcel.extra_cost_applied` · `parcel.extra_cost_reversed` · `parcel.price_changed` |
| Daftar | `ledger.entry` · `ledger.snapshot` |
| Hisob-kitob | `settlement.paid` |
| Tarif | `parcel.fee_changed` (markaz → uy o'zgarsa) |
| Texnik | `webhook.test` (sinov hodisasi, hech narsa qilmaydi) |

### 9.3 Yetkazish kafolati — halol bayonot

Kontraktda **"exactly-once" deb yozilmaydi**. Yoziladigan matn:

> Hodisalar **kamida bir marta** (at-least-once) yuboriladi, **lekin yo'qolishi ham mumkin**.
> Shu bois marketplace **majburan** solishtiruv endpointini taqdim etadi va PCS uni
> muntazam so'raydi.

Sababi kodda: hozir hodisa commit'dan keyin `await`siz yoziladi — deploy o'sha lahzada
bo'lsa hodisa **umuman tug'ilmaydi**. Outbox buni tuzatadi, lekin **halol kafolat** baribir
"at-least-once + solishtiruv" bo'ladi.

---

## 10. Ikki tomonlama kontrakt — qisqacha

> To'liq versiya: **[`MARKETPLACE_PARTNER_API.md`](../../MARKETPLACE_PARTNER_API.md)** —
> ularning dasturchilari uchun.

### ULAR quradi (biz chaqiramiz)

| # | Endpoint | Majburiy | Vazifasi |
|---|---|:---:|---|
| 1 | `GET /bp/v1/ping` | ✅ | Salomatlik + versiya |
| 2 | `POST /bp/v1/parcels/lookup` | ✅ | QR token → posilka ma'lumoti (**yon ta'sirsiz**) |
| 3 | `POST /bp/v1/parcels/accept` | ✅ | Qabul tasdiqi (idempotent) |
| 4 | `POST /bp/v1/events` | ✅ | **Barcha hodisalar shu yerga** (idempotent, `seq` bilan) |
| 5 | `GET /bp/v1/parcels/status` | ✅ | **Solishtiruv** — `?ids=` yoki `?updated_since=` |
| 6 | `GET /bp/v1/sellers` | ✅ | Sotuvchilar reestri |
| 7 | `GET /bp/v1/ledger/balance` | ✅ | Ularning balans ko'rinishi (solishtiruv uchun) |

### BIZ beramiz — faqat O'QISH (ular chaqiradi)

| # | Endpoint | Vazifasi |
|---|---|---|
| 1 | `GET /api/v1/marketplace/parcels/:id` | Bizdagi holat va pul |
| 2 | `GET /api/v1/marketplace/ledger` | Bizdagi daftar (sotuvchi/sana bo'yicha) |
| 3 | `GET /api/v1/marketplace/events?since_seq=` | Yo'qolgan hodisani qayta olish |

⛔ **Yozuv endpointi YO'Q** — webhook ham, manifest ham qurilmaydi (§8).

### Autentifikatsiya

| Yo'nalish | Usul |
|---|---|
| Biz → ular (**yozuv**) | `X-Api-Key` + `X-BeePost-Signature: t=<unix>,v1=<hex>` (HMAC-SHA256, `${t}.${rawBody}`) |
| Ular → biz (**faqat o'qish**) | `X-Api-Key` + IP ro'yxati. **Imzo shart emas** — yozuv yo'q |
| Sekret aylantirish | Ikki kalitli (`v1` + `v2`) — uzilishsiz |

✅ **Yaxshi xabar:** kiruvchi yozuv yo'li qurilmagani uchun `express.raw()` middleware
tuzog'i (Elchi'da tushilgan xato) bu integratsiyada **umuman yuzaga kelmaydi**.

## 11. Xavfsizlik

| Nima | Holat | Ish |
|---|---|---|
| ~~Kiruvchi HMAC + timestamp oynasi~~ | — | ⛔ **Kerak emas** — kiruvchi yozuv yo'li yo'q (§8) |
| ~~Kiruvchi replay himoyasi~~ | — | ⛔ **Kerak emas** |
| **O'qish uchun API-kalit qo'riqchisi** | ❌ yo'q | Yangi: oddiy `X-Api-Key` guard + `integration_id` bo'yicha qat'iy cheklov (ular faqat o'z ma'lumotini ko'radi) |
| IP ro'yxati | ❌ butun kodbazada yo'q | `marketplace_integration.ip_allowlist` — o'qish endpointlari uchun |
| Sekretlarni shifrlash | ❌ **ochiq matn** | AES transformer (yangi) — majburiy |
| Sekretni qaytarmaslik | ❌ `GET /active` **to'liq qaytaradi** | `writeOnly` DTO naqshi (Elchi'da bor) |
| SSRF / xost tekshiruvi | ❌ `auth_url`da validatsiya **umuman yo'q**, 5 redirect | `assertOutboundUrlSafe` + `maxRedirects: 0` |
| Chiquvchi so'rovda imzo | ❌ PCS hech narsa imzolamaydi | Yangi — biz imzolaymiz (HMAC) |
| Rate limit | ❌ global guard ro'yxatdan o'tmagan | `@Throttle` o'qish endpointlarida |
| PII (ism/telefon/manzil) | To'liq chiqadi | Yetkazish uchun shart; **shartnomada yozilsin** + loglarda maskalash |

## 12. Ishonchlilik

| Qatlam | Mexanizm | Qaysi xatoni to'sadi |
|---|---|---|
| 1 | **Tranzaksion outbox** (hodisa pul bilan bitta tranzaksiyada) | Commit va enqueue orasida crash → hodisa yo'qolishi |
| 2 | `event_id` idempotentlik kaliti | Qayta urinish → ikki marta pul yozilishi |
| 3 | `seq` + posilka bo'yicha serializatsiya | Eskirgan hodisa yangisidan keyin yetib borishi |
| 4 | Ko'p bosqichli backoff + **uzoq byudjet** | Hozir: 3 urinish ≈ **6 daqiqa**, keyin abadiy `failed`. Ularning deployi 6 daqiqadan uzoq bo'lsa — **butun oyna yo'qoladi**. Yangi: 8 urinish, 15 daqiqagacha, ~4 soat byudjet |
| 5 | **Solishtiruv CRON** (15 daq) | Butunlay yo'qolgan hodisa |
| 6 | **Kunlik daftar snapshot** | Jimgina pul siljishi |
| 7 | Mismatch jurnali + admin kartasi | Qo'lda va avtomatik amal to'qnashuvi |
| 8 | Kill-switch (`is_active`) + **navbatni to'xtatish** | Hozirgi kill-switch faqat yangi hodisani to'sadi, navbatdagilar **baribir ketaveradi** |
| 9 | 4xx/5xx tasnifi | Hozir **400/422 ham qayta urinilyapti**; 4xx = "qayta urinma" bo'lishi kerak |
| 10 | Dead-letter + ogohlantirish | Hozir `failed` bo'lsa **hech kim bilmaydi** |

---

## 13. 🔴 BLOKERLAR — ishni boshlashdan oldin tuzatilishi shart

Bular marketplace ishi emas, lekin **usiz ikki daftar teng yura olmaydi**.

| # | Muammo | Dalil | Nega bloker |
|---|---|---|---|
| **B1** | **Market kassasi balansi locksiz o'qib-yoziladi** | `cash_box` faqat 2 joyda lock qilinadi (ikkalasi ham asosiy kassa); `@VersionColumn` butun repo'da yo'q | Bir marketning ikki buyurtmasi bir vaqtda sotilsa — **bitta kirim yo'qoladi**. Ko'zgu haqiqatdan uziladi va sababi topilmaydi |
| **B2** | **Qabul dublikat yaratadi** | Dublikat tekshiruvi faqat `WAITING`/`ON_THE_ROAD`ni ko'radi, lekin qabul `RECEIVED` yaratadi | Qabul timeout bo'lib qayta bosilsa — **butun qop ikki marta**, sotuvda **pul ikki marta** |
| **B3** | Hodisa tranzaksiyadan tashqarida | `queueStatusSync` commit'dan keyin, `await`siz | Hodisa **jimgina yo'qoladi** |
| **B4** | `order.external_id` da noyoblik yo'q | Nullable varchar, indekssiz | Ikki marketplace bir ID da to'qnashadi |
| **B5** | Rollback **joriy** tariflardan qayta hisoblaydi | `order.market_tariff` snapshot'i o'rniga joriy user qatori | Tarif o'zgargandan keyin rollback **nolga qaytmaydi** — daftar abadiy siljiydi |
| **B6** | `POST /cashbox-history` — ochiq xom INSERT endpointi | Balansni o'zgartirmasdan tarix qatori yozadi, DTO 3 ta NOT NULL ustunni tashlab ketadi | `cashbox_history`ni haqiqat manbai qilishdan **oldin** yopilishi shart |

| **B7** | **Tarif sotuv paytida jonli o'qiladi** (muzlatilmaydi) | `sellOrder` `market.tariff_center/home` ni o'sha lahzada o'qiydi | Tarif o'zgarsa yo'ldagi barcha posilka siljiydi — §7.2 |
| **B8** | **Operator tarifni qo'lda o'zgartira oladi** | `PATCH order/:id` da `market_tariff`/`courier_tariff`/`where_deliver` ochiq | Kelishilgan narx jimgina buziladi — §7.2 |
| **B9** | **`where_deliver` ularning so'zidan olinmaydi** | `receiveExternalOrders`: `market.default_tariff` ishlatiladi, payload o'qilmaydi | Har «uyga» posilkada 20 000 farq — §7.2 |

| **B10** | **NestJS DI dublikat-provider tuzog'i** | `DashboardModule` `OrderService`ni **o'z provideri** sifatida qayta e'lon qiladi → NestJS ikkinchi nusxasini quradi | `OrderService` konstruktoriga yangi bog'liqlik (bizning outbox/hodisa servisimiz) qo'shilsa, uni beradigan modul **`DashboardModule`ga HAM** import qilinishi shart. Aks holda `tsc` ham, testlar ham ko'rmaydi — xato **faqat prod deploy'da** chiqadi. 2026-09-16 da `ExtraCostApplierService` bilan aynan shunday bo'lgan. Qulf: `order-service-di.spec.ts` |

✅ **B1 BAJARILDI** — `order.service.ts` dagi 6 ta nuqta atomik
(`applyCashboxDelta`). Haqiqiy bazada poyga sinovi: eski yo'l 150 000 yo'qotdi,
yangi to'g'ri hisobladi. QOLDI: `cash-box.service.ts` (11 nuqta, admin amallari)
va `ExtraCostApplier.writeOne` inline yo'li.

✅ **B2, B4 BAJARILDI** — DB darajasidagi unique cheklovlar + qabul
idempotentligi (14 ta cheklov sinovi o'tdi).

✅ **B3 BAJARILDI** — outbox qatori pul bilan BITTA tranzaksiyada
(`MarketplaceSyncService`). To'rtta ilgak ulangan: sotuv, bekor, qisman sotuv,
rollback.

✅ **B7, B9 BAJARILDI** — tarif qabulda muzlatiladi va `where_deliver`
ularning payload'idan olinadi.

✅ **B10 hal qilindi** — `MarketplaceModule` `OrderModule` va `DashboardModule`
ga qo'shildi, `CTOR_DEP_MODULES` yangilandi, DI grafi haqiqiy kompilyatsiyada
tekshirildi.

✅ **B8 BAJARILDI** — `PATCH order/:id` da marketplace buyurtmasining
`market_tariff` ini qo'lda o'zgartirish RAD ETILADI. `where_deliver`
o'zgarishi esa bloklanmaydi (mijoz «uyga olib keling» deyishi normal), lekin
tarif AMALDAGI shartnomadan qayta muzlatiladi va `parcel.fee_changed`
hodisasi yuboriladi. ⚠️ `courier_tariff` ATAYLAB bloklanmaydi — u
`net_to_marketplace` formulasiga kirmaydi.

⏳ **B5, B6** — ochiq.
**B10** — 3-bosqichda `OrderService`ga bog'liqlik qo'shilganda **darhol** tekshiriladi.
**B7, B8, B9** — tarif shartnomasi bilan birga, **1-bosqichda** (pul aniqligining asosi).
**B5, B6** — 4-bosqichgacha.

---

## 14. Bosqichlar

| # | Bosqich | Ish | Natija | Kun |
|---|---|---|---|---|
| **0** | **Kelishuv + kontrakt** | Kontrakt yakunlandi (§19); ✅ **mock server YOZILDI** — `server/scripts/local/marketplace-mock/` (kontrakt tekshiruvchisi, 11 sinov posilkasi, chaos rejimi); ularning dasturchilariga topshiriladi | Kontrakt muzlatildi | **1** *(mock tayyor)* |
| **1** | **Poydevor + blokerlar** | ✅ 8 jadval + migratsiya · ✅ `order` ustunlari (`integration_id`, `external_seller_id`, `extra_cost_net`) · ✅ B4 unique · ✅ sekret shifrlash (AES-256-GCM) · ✅ `marketplace_tariff` versiyalash · ⏳ B1–B3, B7–B9 (`order.service.ts` — parallel ish merge'ini kutadi) · ✅ **sozlash backendi**: `MarketplaceConfigService` + admin-only controller (`marketplace/config/...`), band-slug + SSRF tekshiruvi, tarif versiyalash, kalit aylantirish (`previous` ga ko'chadi — uzilishsiz), ulanish sinovi, **sekretlar javobda maskalanadi**, tayyorlik checklisti — tugallanmagan ulanish YOQILMAYDI · ✅ marshrut to'qnashuvi qulfi (statik test) · ✅ **admin ekrani**: «Integratsiyalar → Marketplace» tabi (`MarketplaceRoot` + `MarketplaceSettingsTab` + yaratish oynasi) — tayyorlik checklisti, master kalit (tugallanmagan bo'lsa bloklangan), ulanish sinovi, kalit aylantirish (bir martalik ko'rsatish + nusxalash), tarif versiyalari va tarixi, daftar invarianti kartasi | Sozlash mumkin | **4–5** *(BAJARILDI)* |
| **2** | **Skan + qabul** | ✅ server tomonda skan + sessiya · ✅ qattiq xato tasnifi + circuit breaker · ✅ per-row savepoint · ✅ token normalizatsiya · ✅ ko'p qutili to'liqlik · ✅ qabul idempotentligi · ✅ **tarif qabulda muzlatiladi (B7–B9 marketplace yo'li uchun yopildi)** · ✅ controller + modul (DI tekshirilgan) · ✅ **operator ekrani** (`/marketplace-intake`): skaner-klaviatura kiritish + avto-fokus, sessiya SERVERDAN tiklanadi, ko'p qutili to'liqlik ogohlantirishi, bloker/ogohlantirish ajratilgan, oxirgisini qaytarish, sababli rad etish, barqaror idempotentlik kaliti, natija oynasi (buyurtma raqamlari + yiqilganlar) · ✅ `GET marketplace/available` — registrator uchun (sozlash ro'yxati admin-only edi) | **Qop skanerlanadi va qabul qilinadi** | **4** *(BAJARILDI)* |
| **3** | **Outbox dvigateli + status hodisalari** | ✅ tranzaksion outbox + atomik `seq` (`next_seq`) · ✅ worker: advisory lock, posilka bo'yicha serializatsiya, `seq` qo'riqchisi, 8 urinishli backoff (~4 soat), 4xx=qayta urinmaslik, stale tiklash, kill-switch navbatni ham to'xtatadi · ✅ `parcel.accepted` ulandi · ⏳ `delivered`/`cancelled`/`rolled_back` — **`order.service.ts` merge'ini kutadi** | **Ikki tomonda status sinxron** ⬅ *birinchi demo* | **4–5** *(dvigatel BAJARILDI)* |
| **4** | **Pul + har-sotuvchi daftar** | ✅ pul utili (muzlatilgan tarif · prepaid manfiy `net` · bekor qoidasi · teskari yozuv/B5) · ✅ `MarketplaceLedgerService` (idempotent langar, atomik seq + qulf, `seller_balance_after`, invariant tekshiruvi, sotuvchi jamlanmasi) · ⏳ kassa nuqtalariga ilgak. ⚠️ Kassa **push funneli QURILMAYDI** (§7.4) | **Pul sinxron** | **3–4** |
| **5** | **Hisob-kitob + o'qish API** | ✅ `marketplace_settlement` + taqsimotli to'lov (yig'indi tekshiruvi) · ✅ `settlement.paid` hodisasi · ✅ **FIFO yo'li marketplace marketi uchun bloklandi** · ✅ 3 ta o'qish endpointi + `X-Api-Key` guard (doimiy vaqtli, IP ro'yxati, slug enumeratsiyasiga qarshi) · ✅ band slug ro'yxati · ✅ kunlik `ledger.snapshot` (6-bosqichda) | **Kassalar teng yuradi** | **3** |
| **6** | **Solishtiruv + panel** | ✅ 15-daq posilka solishtiruvi (status + `seq` uzilishi + **yo'qolgan hodisani qayta navbatga qo'yish**) · ✅ kunlik daftar solishtiruvi (invariant + ularning balansi + `ledger.snapshot`) · ✅ nomuvofiqlik kartasi endpointlari · ✅ qo'lda ishga tushirish · ✅ **frontend panel** — «Integratsiyalar → Marketplace» uch sub-tab: Sozlamalar / Hisob-kitob (sotuvchilar qoldig'i, taqsimotli to'lov, qoldiqdan ortiq to'lov BLOKLANGAN, manfiy qoldiqli sotuvchilar alohida) / Solishtiruv (nomuvofiqlik jadvali, «hal qilindi», qo'lda solishtiruv natijasi); ulanish tanlovi uch tab uchun YAGONA | **Operatsion jihatdan boshqariladi** | **3–4** *(BAJARILDI)* |
| **7** | **Uchdan-uchga sinov** | ✅ **BAJARILDI** — haqiqiy Postgres + haqiqiy Nest ilovasi + haqiqiy mock (alohida jarayon), **25 test / 19 mezon**, `npm run test:marketplace-e2e`. Migratsiya up→down→up haqiqiy sxemada sinaldi. **6 ta haqiqiy nuqson topildi va tuzatildi** (pastdagi jadval) | **Ishga tayyor** | **2** *(BAJARILDI)* |

### 7.1 Uchdan-uchga sinov TOPGAN nuqsonlar

Bularning **birortasi ham** unit testlarda ko'rinmagan — hammasi faqat haqiqiy
baza va haqiqiy HTTP oqimida chiqdi.

| # | Nuqson | Ta'siri | Tuzatish |
|---|---|---|---|
| 1 | **Ko'p qutili buyurtmaning 2- va 3-qutisi RAD ETILARDI.** `cod_amount = 0 && !prepaid` tekshiruvi har qutiga qo'llanilardi, holbuki qaror O1 bo'yicha pul faqat 1-qutida | Har ko'p qutili buyurtma qabul qilinmasdi (mezon M16) | Tekshiruv faqat PUL QUTISIGA (`parcel_index === 1`) — `marketplace-payload.util.ts` + `marketplace-intake.service.ts` |
| 2 | **Hech narsa ishlamasdi: `bigint "NaN"`.** TypeORM `UPDATE ... RETURNING` uchun `[rows, count]` TUPLE qaytaradi; kod `rows[0].col` o'qib `undefined` → `Number(undefined) = NaN` olardi | **Har qabul, har daftar yozuvi, har hisob-kitob yiqilardi** (4 nuqta) | Umumiy `pg-returning.util.ts` + 4 nuqtada ishlatildi; unit mock'lar prod shakliga keltirildi |
| 3 | **PREPAID posilkada market kassasiga hech kim to'lamagan pul tushardi.** `total_price` mahsulot+yetkazishdan olinardi, kuryer esa `cod_amount` (0) yig'adi | 250 000 so'mlik posilkada market +200 000 kirim olardi | `total_price = parcel.cod_amount` |
| 4 | **Ortiqcha xarajat daftarga tushmasdi.** U `updateCashbox` closure'idan emas, `ExtraCostApplierService.applyInline` orqali yoziladi | `SUM(daftar) == kassa` invarianti aynan xarajat qadar buzilardi | `appliedExtraCost` + ilgak xarajat blokidan KEYIN; `sellOrder` va `partlySold` |
| 5 | **Hodisadagi `balance_after` eskirgan edi.** Daftar langari sotuv qatoriga qo'yilgan, xarajat esa keyin yoziladi | Mock `LEDGER_DRIFT` deb ushladi — marketplace bizni noto'g'ri balans deb bilardi | Langar = MARKET kassasiga OXIRGI yozilgan qator |
| 6 | **`remote_status` hech qachon yangilanmasdi.** U skan paytida yozilib qolardi | 15-daqiqalik solishtiruv HAR yetkazilgan posilkani soxta nomuvofiq deb belgilardi — panel foydasiz bo'lardi | Worker muvaffaqiyatda `remote_status` ni ham yangilaydi (seq qo'riqchisi bilan) |
| 7 | **`tariff_version` sotuv/bekor hodisalarida YO'Q edi** (kontrakt §12: «har hodisada») | «Qaysi tarif qo'llandi» bahsini hal qilib bo'lmasdi | `resolveTariffVersion` — posilka qabul qilingan paytdagi versiya |
| 8 | **Tarifi yo'q kuryer bekor qilsa 500 xato** (`null.toLocaleString()`) | Kuryer mijoz oldida tushunarsiz server xatosini ko'rardi | Xabar chegara bilan bir xil null-xavfsiz qiymatni ko'rsatadi |

### 7.2 Adversarial audit TOPGAN nuqsonlar (2-raund)

E2e stend tayyor bo'lgach 6 lens × 2 skeptik bilan chuqur audit o'tkazildi
(72 topilma). Quyidagilar **e2e bilan empirik isbotlandi** va tuzatildi —
qolganlari rad etildi yoki ahamiyatsiz deb topildi.

| # | Nuqson | Isbot | Tuzatish |
|---|---|---|---|
| 9 | **Ko'p qutili buyurtmada har quti uchun TO'LIQ tarif yechilardi.** 2- va 3-qutining narxi 0, `sellOrder` ning «0 so'mlik» shoxi esa market kassasidan to'liq tarifni yechadi | e2e: 2-quti sotilganda `−70 000` | `market_tariff`/`courier_tariff` faqat pul qutisida; qolganlarida 0 |
| 10 | **Rollback MUZLATILGAN tarifni e'tiborsiz qoldirardi** (bloker B5 kassa tomonida ochiq edi) — `users.tariff_*` dan qayta hisoblardi | e2e: 165 000 lik buyurtmada rollbackdan keyin **49 001 so'm yo'qoldi** | `order.market_tariff`/`courier_tariff` ustun — `sellOrder` bilan bir xil naqsh |
| 11 | **Hisob-kitob har-sotuvchi qoldiqni KAMAYTIRMASDI** — bitta umumiy yozuv `seller_id = null` bilan yozilardi | e2e: SLR-81 ga 780 000 to'langach qoldig'i hamon 780 000 | Har sotuvchiga alohida yozuv; kassa langari faqat oxirgisida (idempotentlik uchun) |
| 12 | **Kill-switch yarim ishlardi** — `accept` `is_active` ni tekshirmasdi | unit | Qabulda ham master kalit tekshiriladi |
| 13 | **Sessiya ulanishga bog'lanmagan edi** — A marketplace sessiyasi bilan B ga qabul qilish mumkin edi (pul boshqa hamkorga tushardi) | unit | `session.integration_id` tekshiruvi |
| 14 | **Skan va qabul IKKI XIL `where_deliver` mapping'i yozgan edi** — skan `"home"` ni tushunardi, qabul yo'q | kod | Yagona `normalizeWhereDeliver` |
| 15 | **«Qayta urinilmaydi» deb belgilangan hodisa har 30 soniyada qayta yuborilardi** — `retryable ? FAILED : FAILED` va `claim()` da `next_retry_at IS NULL` | unit | Yangi terminal status `dropped` (varchar — migratsiya kerak emas) |
| 16 | **Skan maydoni so'rov ketayotganda o'chirilardi** — tez skaner yuborgan kodlar JIMGINA yo'qolardi | — | Maydon o'chirilmaydi; skanlar ketma-ket navbatda |
| 17 | **Bloker/ogohlantirishlar har skandan keyin o'chib ketardi** (sessiya qayta so'ralgani uchun) | — | Mavjud qatorlarning belgilari saqlanadi |
| 18 | **Ulanish yaratishda faqat 10 ta market ko'rinardi** | — | `limit: 0` |
| 19 | **Kalit aylantirish tugmalari har adminga ko'rinardi**, endpoint esa SUPERADMIN | — | Tugmalar rolga bog'landi + tushuntirish |

### 7.3 Auditni TUGATISH (3-raund)

72 topilmaning hammasi JORIY kodga qarshi qayta tekshirildi (13 guruh,
fayl bo'yicha). Natija: **21 allaqachon tuzatilgan**, **49 tasdiqlangan**,
2 rad etilgan. Tasdiqlanganlardan quyidagilar tuzatildi.

| # | Nuqson | Nega jiddiy | Tuzatish |
|---|---|---|---|
| 20 | **Solishtiruv eskirgan entity'ni `save` qilib `next_seq`/`last_sent_seq` ni ORQAGA surardi** | 15 daqiqalik CRON HTTP so'rovidan oldin yuklangan obyektni butunlay qayta yozadi. O'sha oynada kuryer sotsa, keyingi hodisa band `seq` ni olib `UQ_MP_OUTBOX_SEQ` ni buzadi → **kuryerning sotuvi kassa yozuvi bilan birga 500 bilan yiqiladi** | Nishonli `update` — faqat 3 ta ustun |
| 21 | **Rollbackda xarajat kassaga qaytardi, daftarga YO'Q** | Kassa 0 ga qaytardi, daftar `−xarajat` da qolardi → sotuvchiga shu summa kam to'lanardi. Uchala shox (SOLD/PAID, PARTLY_PAID, CANCELLED) | `reverseExtraCostForCashbox` langarni qaytaradi, daftar deltasiga qo'shiladi |
| 22 | **Tiklash yo'li O'LIK edi** — qayta navbatga qo'yilgan hodisa worker qo'riqchisiga tushib darhol `superseded` bo'lardi | Marketplace yo'qotgan hodisalarni **hech qachon** olmasdi; solishtiruvning bosh vazifasi ishlamasdi | Qayta navbatga qo'yishda `last_sent_seq` `LEAST` bilan tushiriladi |
| 23 | **CLICK_TO_MARKET marketplace darvozasini chetlab o'tardi** | Market kassasi daftarsiz kamayadi (invariant darhol buziladi) + FIFO NOTO'G'RI sotuvchining buyurtmalarini «to'langan» qilardi | `paymentsFromCourier` ga ham darvoza |
| 24 | **Kechiktirilgan xarajat tasdiqlanganda daftarsiz kassa** | Tasdiqlash yo'lida marketplace ilgagi yo'q | Marketplace buyurtmasida rejim har doim `immediate` |
| 25 | **Xarajat kassani «o'qi-o'zgartir-yoz» bilan yozardi** (B1) | Ikki parallel xarajat biri-birini o'chirardi; `balance_after` xotiradagi taxmin edi — marketplace daftari aynan shundan o'qiydi | `applyInline` → `writeOneAtomic`; eski `writeOne` O'CHIRILDI |
| 26 | **Skan sessiyasi ulanishga bog'lanmagan edi** | A sessiyasi bilan B ga skan qilish mumkin edi | `session.integration_id` tekshiruvi (qabulda ham) |
| 27 | **Qabulda yiqilgan posilka ABADIY qotib qolardi** | Sessiya yopiladi, dublikat qo'riqchisi qayta skanni to'sadi — posilka omborda, tizimda o'lik | Yiqilganlar sessiyadan ajratiladi |
| 28 | **`ledger.balance_after` ni kelish tartibida solishtirib bo'lmasdi** | Hodisalar posilka bo'yicha serializatsiya qilinadi, global emas — `seq 6` `seq 5` dan oldin kelib SOXTA «daftar ajraldi» berardi | Hodisaga `ledger.seq` qo'shildi; kontrakt §7.6; mock faqat KETMA-KET seq'da solishtiradi |

**E2e 31 testga yetdi** (19 mezon + audit isbotlari). Uch marta ketma-ket
ishga tushirilganda barqaror.

### 7.4 Auditni TO'LIQ yopish (4-raund) + STATUS LUG'ATI

72 topilmaning hammasi joriy kodga qarshi qayta baholangach (21 FIXED,
49 CONFIRMED, 2 REFUTED), tasdiqlanganlarning deyarli hammasi tuzatildi.

**Yangi imkoniyat — status lug'ati UI dan sozlanadi.** Hamkorning status
qiymatlari oldindan noma'lum (raqam? so'z? kod?), shuning uchun ularni
koddan taxmin qilmaymiz: admin panelida har kanonik status uchun ularning
qiymati qo'lda kiritiladi. Xarita ikki yo'nalishda ishlaydi — chiquvchi
hodisada ularning tili, kiruvchi javobda kanonikka qaytarish (busiz ular
bekor qilgan posilkani qabul qilib qo'yardik). Migratsiya:
`1749900000000-MarketplaceStatusMap`.

| # | Nuqson | Nega jiddiy | Tuzatish |
|---|---|---|---|
| 29 | **Hodisalarda PCS ichki statuslari ketardi** (`waiting`, `on the road`) | Kontrakt §6.1 lug'atida yo'q — hamkor tushunmaydi | `pcsStatusToCanonical` + status xaritasi |
| 30 | **Oraliq statuslar UMUMAN yuborilmasdi** | Hamkor faqat «qabul qilindi» va «yetkazildi» ni ko'rardi; mijozi «posilkam qayerda?» deganda javob yo'q edi | `parcel.dispatched` + `parcel.out_for_delivery` (pochta va kuryer skaneri) |
| 31 | **Rad etish hamkorga XABAR QILINMASDI** — UI esa «xabar beriladi» deb yolg'on aytardi | Hamkor posilkani abadiy «bizda» deb bilardi | `parcel.rejected` hodisasi + qabul tasdig'ida `rejected[]` |
| 32 | **Sotuvda market qarzi QULFSIZ balansdan hisoblanardi** | Ikki parallel sotuv bir qarzni IKKI MARTA yopardi | `SELECT ... FOR UPDATE` (market kassasi) |
| 33 | **Ortiqcha xarajat qulfsiz kassaga yozilardi** (`writeOne`) | B1 lost update + `balance_after` xotiradagi taxmin edi (marketplace daftari aynan shundan o'qiydi) | `applyInline` → `writeOneAtomic`; eski yo'l O'CHIRILDI |
| 34 | **Partiyada oldingi hodisa yiqilsa keyingisi o'tib ketardi** | Yiqilgani ABADIY `superseded` bo'lardi — pul hodisasi yo'qolishi mumkin | Posilka bo'yicha bloklash: qolganlari `pending` ga qaytadi |
| 35 | **`Retry-After` e'tiborsiz qolardi** | 429 da limitni qayta-qayta urib, urinish byudjetini yeb bitirardik | Sarlavha o'qiladi (soniya va HTTP sana), 1 soatgacha cheklangan |
| 36 | **IP oq ro'yxati CIDR'ni tushunmasdi** | Hamkor bir nechta IP dan yozsa, blok HECH QACHON mos kelmasdi — jimgina 403 | CIDR + IPv4-mapped normalizatsiya + sozlashda validatsiya |
| 37 | **SSRF: IPv6 literal va nuqtali host o'tib ketardi** | `https://[::ffff:127.0.0.1]` bilan loopback'ga so'rov | IPv6 (unique/link-local, IPv4-mapped o'n oltilik shakli) + oxirgi nuqta |
| 38 | **Shifrlash kaliti yo'q bo'lsa checklist «tayyor» derdi** | Sekretlar bazada OCHIQ MATN, admin bilmaydi | Checklist bandi — kalitsiz ulanish YOQILMAYDI |
| 39 | **Sozlash amallari audit jurnaliga yozilmasdi** | «Kim o'chirib qo'ydi?» savoliga javob yo'q edi | Kill-switch, kalit aylantirish, `api_key` — jurnalga (sekretning O'ZI emas) |
| 40 | **«Ulanishni tekshirish» IMZONI sinamasdi** | Ping ataylab imzolanmaydi — imzo xato bo'lsa faqat birinchi sotuvda bilinardi | Alohida «Imzo» tugmasi: imzolangan `webhook.test` |
| 41 | **Sotuvchilar reestri hech qachon yangilanmasdi** | Hisob-kitobda sotuvchi faqat `SLR-77` bo'lib ko'rinardi | Kunlik CRON (`fetchSellers`, sahifalash bilan) |
| 42 | **Undo rad etilgan posilkani ham o'chirardi** | Hamkorga «rad etildi» deb aytilgan-u, bizda iz qolmasdi | Undo faqat skanerlangan posilkaga; shartli `delete` (qabul bilan poyga yopildi) |
| 43 | **Bitta operatorga IKKI ochiq sessiya** | Posilkalar ikki qopga bo'linib, biri qulflanib qolardi | Qisman unique indeks + `23505` da mavjudini qaytarish |
| 44 | **Yoqiq ulanishda API manzilini bo'shatish mumkin edi** | Manzil o'chib, ulanish yoqiq qolardi — birinchi skanda tushunarsiz xato | Bo'sh satr rad etiladi |
| 45 | **Pochta hisoblagichlari qulfsiz** | Ikki operator bir vaqtda qabul qilsa, biri ikkinchisining qo'shganini o'chirardi | Atomik `UPDATE ... + 1` |
| 46 | **Nomuvofiqlikni tozalash egalikni tekshirmasdi** | Bir marketplace admini boshqasining belgisini o'chirardi | Yo'lda `slug`, so'rovda `integration_id` |
| 47 | **Migratsiya qayta ishga tushirilganda buzilardi** | `.catch()` yordam bermaydi: Postgres'da tranzaksiya ichidagi xato hammasini abort qiladi | `pg_constraint` dan oldindan tekshirish |
| 48 | **Mock boshqaruv yo'llari kalitsiz ochiq edi** | `/_mock/reset` sinov o'rtasida daftarni tozalab, natijani ma'nosiz qilardi | `X-Api-Key` talab qilinadi |

**E2e 37 testga yetdi.** Status lug'ati, oraliq statuslar va imzo sinovi
alohida qoplangan.

### 7.5 HISOB-KITOB SODDALASHTIRILDI (qaror 2026-09-17)

Tahlil savoli: kassa solishtiruvi ortiqchami va nomuvofiqlik ishni
to'xtatadimi?

**Javob: hech narsa to'xtamaydi.** `verifyInvariant` butun kodda faqat
uch O'QISH joyida chaqiriladi (hisob-kitob taklifi, solishtiruv, sozlash
sahifasi) va hech qachon xato tashlamaydi. `mismatch_at` — faqat
ko'rsatish bayrog'i. Skan, qabul, sotuv, bekor, rollback va to'lov
farqdan qat'i nazar ishlayveradi. Bu ATAYLAB: buxgalteriya farqi sababli
kuryerni dala o'rtasida to'xtatib qo'yish ancha yomon bo'lardi.

**Nima qoldirildi va nega:**

| Bo'lak | Nega qoldi |
|---|---|
| Market kassasi | Yagona haqiqat manbai: «ularga qancha qarzdormiz». Oddiy marketdan farqi yo'q |
| Hodisada `seller_id` | Boshlang'ich talab — ular kimga qancha berishni shundan biladi |
| Yordamchi daftar + invariant | Buxgalteriya EMAS, **tuzoq signali**: «kassa qimirladi-yu, hamkorga aytilmadi». Shu sessiyada aynan u 5 ta xatoni ushladi (xarajat daftarga tushmasligi, prepaid'da soxta kirim, ko'p qutida 3× tarif, eskirgan `balance_after`, rollbackda xarajat qaytmasligi). Narxi: 1 jadval + 1 CRON |

**Nima olib tashlandi:**

| Nima | Nega |
|---|---|
| **To'lovda taqsimot** | Marketplace pulni oladi va sotuvchilariga O'ZI tarqatadi. Har to'lovda jadval to'ldirish — admin uchun bekorga ish, ularga foydasi yo'q. Endi yaxlit summa: bitta raqam + usul + chek |
| **Frontendda sotuvchi ko'rsatish** | Biz ularning sotuvchilarini bilmaymiz, ular faqat ID yuborishi mumkin (`SLR-77`). Bunday qatorni adminga ko'rsatish foydasiz shovqin — u ID kimligini bilmaydi va unga qarab qaror qabul qila olmaydi. Hisob-kitob, skan va nomuvofiqlik ekranlaridan olib tashlandi |

`seller_id` **backendda to'liq qoladi**: daftar yozuvida, har posilka
hodisasida va kunlik `ledger.snapshot` da. Kontrakt §7.8 yangilandi —
`settlement.paid` endi taqsimotsiz.

> Oqibat: sotuvchilar kesimi endi «qancha QARZDORMIZ» emas, «qancha
> ISHLAB TOPGAN» degani (to'lov `seller_id` siz yoziladi). Shu sabab
> qarz **kassadan** olinadi, sotuvchilar yig'indisidan emas.

#### ATAYLAB TUZATILMAGANLAR

| Nuqson | Nega qoldirildi |
|---|---|
| **ASOSIY kassada «o'qi-o'zgartir-yoz»** (7 nuqta) | `balance_cash`/`balance_card` va virtual karta invarianti (`SUM(cards) == balance_card`) bilan chirmashgan. Alohida, o'z testlari bilan qilinadigan ish — marketplace oqimiga BEVOSITA tegmaydi (marketplace faqat MARKET kassasini ishlatadi, u allaqachon atomik) |
| **Qisman sotuvda `items_delivered`/`items_returned`** | Marketplace buyurtmasida `order_item` ataylab yaratilmaydi (katalog FK). Operator qisman sotuvda faqat SUMMA kiritadi — element darajasidagi ma'lumot manbadan YO'Q. Pul maydonlari (`delivered_amount`/`returned_amount`) to'g'ri ketadi |
| **`GET /{slug}/events` sahifalash nozikliklari** | O'qish API'si; hamkor uni hali ishlatmaydi. Pilotdan keyin real ehtiyojga qarab |

> **Auditning 58 agenti sessiya limitiga tushdi** — ya'ni tekshiruv TO'LIQ
> tugamagan. Yuqoridagilar e2e yoki kod o'qish bilan tasdiqlanganlar.
> Qolgan topilmalar ro'yxati workflow jurnalida saqlangan.

> **Eng qimmatli qismi mock bo'ldi.** U balansni MUSTAQIL hisoblaydi va har
> hodisani kontrakt bilan solishtiradi. 5-nuqson (`LEDGER_DRIFT`) aynan
> shu tufayli topildi: bizning kassa ham, daftarimiz ham to'g'ri edi —
> faqat ULARGA yuborilgan raqam eskirgan edi.

**Jami: 20–25 dev-kun** (PCS). Ular tomoni: ~8–12 kun (7 endpoint + hodisa qabuli + daftar).

> **Qamrov ikki marta qisqardi.** Dastlab 24–30 kun edi:
> kassa push funneli o'rniga gibrid (§7.4) **−2 kun**, kiruvchi webhook butunlay
> olib tashlandi (§8) **−2/3 kun**, manifest va hudud darvozasi qurilmaydi **−1 kun**.
> Ayni paytda rejadagi eng yuqori ikki xavf (R3 va kiruvchi yozuv yuzasi) **yo'qoldi**.

**Kritik yo'l:** 0 → 1 → 2 → 3 → 4 → 5. 6-bosqich 4 dan keyin parallel ketishi mumkin.
**Minimal ishlaydigan yo'l:** 0+1+2+3 = **14–16 kun** (pulsiz, lekin status to'liq sinxron).

## 15. Ehtimoliy holatlar katalogi

> 116 topilmaning eng muhimlari. To'liq ro'yxat: workflow jurnali.

### 15.1 Skan va qabul

| # | Holat | Bugun nima bo'ladi | Yechim |
|---|---|---|---|
| 1 | Marketplace API o'ldi | Har skan «ularda topilmadi» → operator «baribir qo'sh» bosadi → **bo'sh buyurtmalar** | HTTP kodini tasniflash + circuit breaker + aniq xabar. ⚠️ Manifest qurilmagani uchun **zaxira yo'l yo'q** — qabul to'xtaydi (§5.1) |
| 2 | Operator sessiyasi tugadi | Ayni natija (401 → «topilmadi») | Umumiy axios klienti + 401 refresh |
| 3 | Qabul timeout, qayta bosildi | **Butun qop ikki marta yaratiladi** | `idempotency_key` + UNIQUE `(integration_id, external_parcel_id)` |
| 4 | Telefon raqami JSON'da **son** | `TypeError` → **30 ta posilkaning hammasi yiqiladi** | `String(x ?? '')` + DTO validatsiya + per-row savepoint |
| 5 | QR aralash registrda | Saqlanadi, keyin **hech qaysi skaner topa olmaydi** | Normalizatsiya + asl token alohida ustunda |
| 6 | Bitta buyurtma — 3 quti | **3 ta to'liq narxli buyurtma**, mijozdan 3 marta undiriladi | `parcel_id` + `parcel_index/count`; pul faqat bir marta |
| 7 | Tuman moslanmadi | **Jimgina `allDistricts[0]`** ga tushadi → boshqa viloyatga ketadi | Qattiq xato + qo'lda moslash jadvali |
| 8 | Narx 0 yoki yo'q | Sotuvda **market va kuryer kassasidan tarif yechiladi** | Serverda 422 |
| 9 | Ular allaqachon bekor qilgan | Jimgina qabul qilinadi | `lookup` ularning statusini qaytaradi; bekorni qabul qilmaymiz |
| 10 | Skandan qabulgacha narx o'zgardi | Skan paytidagi eski narx yoziladi | Qabulda qayta tekshirish (`If-Match` semantikasi) |
| 11 | Ikki operator bir posilkani skanerladi | **Ikkalasi ham muvaffaqiyatli** | Server tomonda band qilish |
| 12 | Brauzer qulab tushdi | Butun qop yo'qoladi, izsiz | Server tomonda sessiya |

### 15.2 Status va hodisalar

| # | Holat | Bugun | Yechim |
|---|---|---|---|
| 13 | `sold` 502 oldi, keyin `rollback` ketdi, keyin eski `sold` yetdi | **Marketplace noto'g'ri terminal holatda** | `seq` + `last_sent_seq` qo'riqchisi |
| 14 | Qayta urinishda ayni tana | Ular **ikkinchi marta** sotuvchiga pul yozadi | `event_id` idempotentlik kaliti |
| 15 | Ular rollback'ni rad etdi | **Jimgina zidlik** — pul bizda qaytgan, ularda sotilgan | Mismatch + banner + amallarni bloklash |
| 16 | Integratsiya o'chirildi | Ish **cheksiz qayta da'vo** siklida qoladi | `skipped` holati + sabab |
| 17 | Kill-switch bosildi | Navbatdagilar **baribir ketaveradi** | Navbatni ham to'xtatish |
| 18 | Kuryer bulk sotuv (500 ta) | 500 ta cheklovsiz so'rov → rate limit → **hammasi 6 daqiqada o'ladi** | Guruhlash + `429`/`Retry-After` hurmat qilish |
| 19 | Status xaritada yo'q | Bizning xom satr ketadi (`'cancelled (sent)'`, `'on the road'`) | Kontraktda qattiq ro'yxat; xaritasiz status **yuborilmaydi** |
| 20 | Qisman sotuv | **To'liq asl narxda `completed`** deb ketadi | `parcel.partly_delivered` + delta |
| 21 | Almashtirish (kafolat-swap) | Sotuvchi tekshiruvi **market darajasida** → A sotuvchining buyurtmasi B ga yozilishi mumkin | Almashtirishda `seller_id` tekshiruvi |
| 22 | Qisman sotuv bolasi | `external_id`siz, `operator`siz → **sinxronga ko'rinmas** | `seller_id` + `parcel_id` bola'ga nusxalanadi |

### 15.3 Pul

| # | Holat | Bugun | Yechim |
|---|---|---|---|
| 23 | Ikki sotuv bir vaqtda | **Bitta kirim yo'qoladi** (B1) | Atomik `balance = balance + $1` |
| 24 | Market balansi manfiy | Sotuv **avtomatik qarzni yopadi**, status `PAID` bo'ladi, pul harakat qilmaydi | `PAID`ni hisob-kitob signali qilmaslik; faqat `settlement.paid` |
| 25 | `paymentsToMarket` FIFO | **A uchun berilgan pul C, D, E buyurtmalarini yopadi** | Sotuvchi bo'yicha hisob-kitob; FIFO bloklanadi |
| 26 | Ortiqcha xarajat | `order`da ustun **yo'q** — faqat 2 ta kassa qatori + izoh matni | `extra_cost_net` skalyari + daftar yozuvi |
| 27 | Rollback tarif o'zgargandan keyin | **Nolga qaytmaydi** (B5) | Snapshot tariflardan hisoblash |
| 28 | `PARTLY_PAID` rollback | Market kassasi **kam qaytariladi** (`to_be_paid − paid_amount` farqi) | Daftar yozuvi `reverses_entry_id` bilan |
| 29 | Kassa SQL bilan qo'lda tuzatildi | Ko'zgu **hech qachon bilmaydi** | `adjustment` yozuv turi + tuzatish endpointi |
| 30 | `total_price` — `float8`, kassa — `bigint` | Kasr yo'qoladi, yaxlitlash yo'q | Kontraktda: **butun son, so'm**; intake'da tekshirish |
| 31 | Mahsulot va yetkazish narxi **qo'shib yuboriladi** | Buyurtma summasi hech qachon mos kelmaydi | Alohida maydonlar (`product_amount`, `delivery_amount`) |
| 32 | Tarixiy buyurtmalarni backfill | Struktura jihatdan **chala va qayta ishga tushirish xavfli** | Faqat oldinga; tarixiy davr uchun qo'lda hisob-kitob |

---

## 16. Qabul mezonlari (bajarilgan deb hisoblash uchun)

| # | Mezon |
|---|---|
| 1 | 50 posilkali qop skanerlanadi; marketplace API'si **skan o'rtasida o'chirilsa** — operator aniq xabar ko'radi va **birorta bo'sh buyurtma yaratilmaydi** |
| 2 | «Qabul qilish» ikki marta bosilsa — **buyurtma soni o'zgarmaydi** |
| 3 | Qabuldan keyin marketplace'da status `ACCEPTED_BY_BEEPOST` |
| 4 | Sotuvdan keyin: PCS kassasi va marketplace daftari **tiyin-tiyin mos** |
| 5 | Ortiqcha xarajat qo'shilsa — ikkala daftarda **bir xil summa** |
| 6 | Rollback: pul ikkala tomonda **qaytadi**; ular rad etsa — **mismatch kartasi chiqadi** |
| 7 | Qisman sotuv: yetkazilgan va qaytgan summa **ikkalasida ham to'g'ri** |
| 8 | Hodisa 3 marta qayta yuborilsa — marketplace daftarida **bitta yozuv** |
| 9 | `rollback` `sold`dan keyin yuborilsa, eskirgan `sold` yetib kelsa — **rad etiladi** |
| 10 | Marketplace 30 daqiqa o'chirilsa — tiklangach **barcha hodisa yetib boradi** |
| 11 | Kunlik snapshot: 1000 buyurtmada **0 nomuvofiqlik** |
| 12 | Har-sotuvchi jamlanma: `SUM(sotuvchilar) == market kassasi balansi` |
| 13 | Sekret aylantirilsa — **uzilish bo'lmaydi** |
| 14 | **Prepaid posilka**: `cod_amount = 0` → daftar **kamayadi**, `seller_id` to'g'ri, marketplace manfiy yozuvni qabul qiladi |
| 15 | **Bekor + ortiqcha xarajat**: yetkazish haqqi olinmaydi, faqat `extra_cost` yechiladi |
| 16 | **Ko'p qutili buyurtma** (3 quti): pul **faqat bir marta**, uchala quti ham qabul qilinadi |
| 17 | **Tarif o'zgarsa**: yo'ldagi posilkalar **eski tarifda** qoladi (muzlatilgan) |
| 18 | Marketplace o'qish API'si **faqat o'z ma'lumotini** qaytaradi (boshqa integratsiya ko'rinmaydi) |
| 19 | **Tarif to'liq**: hodisada `beepost_fee` = 50 000 (kelishilgan to'liq tarif), komissiya maydoni **yo'q** |

---

## 17. Xavflar

| # | Xavf | Ehtimol | Ta'sir | Yumshatish |
|---|---|:---:|:---:|---|
| R1 | **Marketplace kontraktni to'liq bajarmaydi** (solishtiruv yoki rollback'ni tashlab ketadi) | O'rta | **Kritik** | MUST/SHOULD/MAY jadvali + sandbox qabul testi; kontraktsiz ishga tushirilmaydi |
| R2 | B1 (locksiz kassa) tuzatilmay qoladi | O'rta | **Kritik** | 1-bosqichda majburiy; invariant tekshiruvi CRON |
| R3 | ~~7 ta kassa nuqtasini chiquvchi funnel'ga o'tkazish~~ | ~~Yuqori~~ **Past** | O'rta | ✅ **Yo'qoldi** — §7.4 gibrid yo'li tanlandi: kassa push kanali qurilmaydi. Yordamchi daftar faqat marketplace nuqtalarida yoziladi + kechalik invariant tekshiruvi |
| R4 | Har-sotuvchi daftar market kassasidan siljiydi | O'rta | Yuqori | Invariant + kunlik solishtiruv + `reverses_entry_id` |
| R5 | Ko'p qutili posilka modeli noto'g'ri chiqadi | O'rta | Yuqori | §19 S3 da oldindan hal qilinadi; keyin o'zgartirish qimmat |
| R6 | Ularning dasturchilari sekin | **Yuqori** | O'rta | **Mock server** — biz ularni kutmaymiz (0-bosqich) |
| R7 | Sotuvchi tarifi har xil bo'lib chiqadi | O'rta | O'rta | §19 S2; `marketplace_seller`da tarif override joyi qoldiriladi |
| R10 | **«Bizning kassa == ularning kassasi» deb kutish** — har buyurtmada marja sabab farq ko'rinadi | **Yuqori** | Yuqori | §7.1: kontraktdan `payable_to_seller` olib tashlandi; solishtiruv faqat **bitta son** bo'yicha (biz marketplace'ga qancha qarzdormiz) |
| R11 | Tarif o'zgarishi yo'ldagi posilkalarni siljitadi | **Yuqori** | Yuqori | B7+B8+B9 va `marketplace_tariff` versiyalash (§7.2) |
| R8 | PII shartnomasiz chiqib ketadi | O'rta | Yuqori | Yozma kelishuv; loglarda maskalash; sekretlar shifrlangan |
| R9 | Ikki marketplace `external_id` da to'qnashadi | Past | Yuqori | Barcha noyoblik `integration_id` bilan |

---

## 18. Nima ATAYLAB qilinmaydi

| Nima | Nega |
|---|---|
| `external_integration` (Adosh) yo'lini o'zgartirish | Prod'da ishlayapti; tegilmaydi |
| LDG virtual-kuryer pul modelini o'zgartirish | Prod'da ishlayapti (`ldg-returned-closed-fix`, 29 test) |
| Elchi moduli bilan birlashtirish | Elchi = CARRIER (biz beramiz), marketplace = SOURCE (ular beradi). Boshqa yo'nalish, boshqa jadval |
| Umumiy `PartnerHttpClient` ajratish | Uchta ishlaydigan klientni majburlash — pul oqimini xavf ostiga qo'yish. Keyingi ixtiyoriy bosqich |
| Tarixiy buyurtmalarni backfill | Struktura jihatdan chala; tarixiy davr qo'lda hisob-kitob qilinadi |
| Marketplace'ning o'z sotuvchilariga to'lovi | Bu ularning ishi; biz faqat **kimga qancha** ma'lumotini beramiz |
| **Kiruvchi webhook** (ular → biz yozuv) | Qaror 2026-09-15: ular faqat o'qiydi. Xavfsizlik yuzasi kichrayadi, 2–3 kun tejaladi |
| **Manifest** (qop ro'yxati) | Qaror: qurilmaydi. Oqibatlari §5.1 da yozilgan va qabul qilingan |
| **Hudud darvozasi** | Qaror: butun O'zbekiston. Xizmat ko'rsatilmaydigan tumanga posilka tushishi xavfi qabul qilingan |
| **Yo'qolgan/buzilgan posilka mexanizmi** | Qaror: tizimga aralashtirilmaydi. Yo bekor deb topshiriladi, yo alohida kelishiladi. Qoplash puli bo'lsa — umumiy `adjustment` yo'lidan o'tadi va daftarda ko'rinadi |
| **Qabuldan keyin marketplace bekor qilishi** | Qaror: faqat BeePost. `cancel_request` qurilmaydi |

---

## 19. Kelishilgan shartlar — YAKUNIY (2026-09-15)

> ✅ **Ochiq savol qolmadi.** Quyidagi 18 shart tasdiqlangan va yuqoridagi barcha
> bo'limlar shularga muvofiq qayta yozilgan. Kontrakt **muzlatishga tayyor**.

### Pul shartlari

| # | Shart | QAROR | Kodga ta'siri |
|---|---|---|---|
| **P1** | Har-sotuvchi pul modeli | **Bitta market + yordamchi daftar** | `marketplace_ledger_entry`; invariant `SUM(daftar) == cash_box.balance` |
| **P2** | BeePost haqqi | **Har buyurtmada kelishilgan tarif** (50k markaz / 70k uy), barcha sotuvchiga bir xil | Mavjud `market_tariff` kodi; **qabulda muzlatiladi** |
| **P3** | Ikki bosqichli tarif farq beradimi | **YO'Q** — ikki daraja, ikki daftar; farq = ularning marjasi | `payable_to_seller` olib tashlandi → **`net_to_marketplace`** |
| **P4** | Bekorda yetkazish haqqi | **OLINMAYDI** | ✅ hozirgi kod o'zgarmaydi |
| **P5** | Bekorda ortiqcha xarajat | **Hisobga olinadi** (kuryer mijoz yonigacha borib rad javobini olsa) | ✅ hozirgi kod; chegara = kuryer tarifi |
| **P6** | Ortiqcha xarajatni kim ko'taradi | **Marketplace** | ✅ hozirgi kod; `seller_id` bilan yuboriladi |
| **P7** | Qaytarish tarifi | **BEPUL** | ✅ o'zgarish yo'q |
| **P8** | Prepaid buyurtma | **BO'LADI** — tarif baribir hisoblanadi, `net` **manfiy** bo'ladi, qaysi sotuvchi ekani yuboriladi | ✅ `sellOrder` CASE 2/3 allaqachon to'g'ri; hodisaga `seller_id` qo'shiladi |
| **P9** | Hisob-kitob davri | **Qo'lda + panel eslatmasi** | `marketplace_settlement` + davr sozlamasi + «muddat o'tdi» kartasi |
| **P10** | Yo'qolgan/buzilgan posilka | **Tizimga KIRITILMAYDI** — yo bekor deb topshiriladi, yo alohida kelishiladi | Qoplash puli bo'lsa umumiy `adjustment` yo'lidan o'tadi va daftarda ko'rinadi |
| **P11** | Kassa sinxroni chuqurligi | **L2+ gibrid** — pul posilka hodisalari ichida; **push funneli qurilmaydi** | R3 xavfi yo'qoldi, −2 kun |
| **P12** | **Hamkorlik komissiyasi** (kelishilgan tarifdan bir qism marketplace'ga) | **Tizimdan TASHQARIDA** — tarif **to'liq 50k / 70k** deb belgilanadi, komissiya BeePost va marketplace o'rtasida **alohida to'lanadi** | Arxitekturaga ta'sir **yo'q** va qo'shimcha kod **kerak emas** (§7.11). Yagona shart: davriy to'lov kassaga **xarajat** sifatida kiritilsin |

### Operatsion shartlar

| # | Shart | QAROR | Kodga ta'siri |
|---|---|---|---|
| **O1** | Ko'p qutili posilka | **HA — boshidan** | `parcel_id` ≠ `order_id`; pul faqat bir marta; barcha quti skanerlanmaguncha qabul tugallanmaydi |
| **O2** | Qisman sotuv | **Bitta o'zgartirilgan buyurtma** | `parcel.partly_delivered` + delta; `items[]` kontraktda MUST |
| **O3** | Qabuldan keyin bekor qilish | **Faqat BeePost** | `cancel_request` **qurilmaydi** |
| **O4** | Manifest | **QURILMAYDI** | −1 kun; oqibatlari §5.1 da qabul qilingan |
| **O5** | Kiruvchi kanal (webhook) | **YO'Q — faqat o'qish API** | Butun HMAC/raw-body/`webhook_log` qatlami **qurilmaydi**; −2/3 kun |
| **O6** | Yorliq | **Ularning QR'i butun zanjirda** | `qr_code_token` = ularning tokeni (normalizatsiya bilan) |
| **O7** | Hudud qamrovi | **Butun O'zbekiston** | Darvoza qurilmaydi |
| **O8** | Rollback | **Kontraktda MUST** | Rad etilsa nomuvofiqlik kartasi + buyurtma bloklanadi |
| **O9** | Sandbox | **MUST** | Alohida kalit, alohida ma'lumot |

### Kelishuvning umumiy ta'siri

| O'lchov | Avval | Hozir |
|---|---|---|
| Ish hajmi (PCS) | 24–30 dev-kun | **20–25 dev-kun** |
| Bosqichlar soni | 9 | **8** |
| Eng yuqori xavf (R3 — kassa funneli) | Yuqori ehtimol | **Yo'qoldi** |
| Kiruvchi yozuv yuzasi | HMAC + raw body + replay | **Umuman yo'q** |
| Ular quradigan endpointlar | 7 | **7** (o'zgarmadi) |
| Biz quradigan endpointlar (ular uchun) | 5 (2 ta yozuv) | **3** (faqat o'qish) |

## Havolalar

- Ular uchun kontrakt: [`MARKETPLACE_PARTNER_API.md`](../../MARKETPLACE_PARTNER_API.md)
- **Mock server + kontrakt tekshiruvchisi:** [`server/scripts/local/marketplace-mock/`](../../server/scripts/local/marketplace-mock/README.md)
- Eski generik yo'l (Adosh): [`EXTERNAL_INTEGRATION_API.md`](../../EXTERNAL_INTEGRATION_API.md)
- Elchi (CARRIER qolipi, pul aniqligi): [`05-elchi.md`](05-elchi.md)
- Skaner bilan qabul darslari: [`08-qabul-skaneri.md`](08-qabul-skaneri.md)
- Rol/rejim taksonomiyasi: [`06-platforma.md`](06-platforma.md)
- Elchi tomonidagi marketplace tahlili: [`09-marketplace.md`](09-marketplace.md)
