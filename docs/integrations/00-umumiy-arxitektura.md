# Umumiy Integratsiya Qatlami — Master Bo'lim (Cross-Cutting)

> Hujjat turi: Uch integratsiya rejasini (Bitrix24, amoCRM/Kommo, Google Sheets) bog'lovchi arxitektura qarori.
> Til: O'zbek | Sana: 2026-07-25 | Rol: Yetakchi arxitektor
> Bu bo'lim **har bir tizimga xos detallarni takrorlamaydi** — u faqat **umumiy (shared)** qatlam, komponentlar, ketma-ketlik va xavflarni qamraydi. Har bir tizimning o'ziga xos auth/DTO/status detali — o'z rejasida.

---

## ⚠️ YO'NALISH TUZATILDI (2026-07-25)

> **Biznes tomonidan tasdiqlangan tuzatish.** Bu hujjatning quyi bo'limlari (§1–§5) dastlab **"faqat outbound (bizdan→tashqariga)"** deb faraz qilgan edi. Bu faraz **CRM'lar uchun TESKARI**. Yangi haqiqat: **CRM (Bitrix24 / amoCRM) — buyurtmaning BIRLAMCHI manbai, PCS'dan YUQORIDA turadi.** Asosiy yo'nalish **CRM→PCS intake**. Quyidagi bo'lim ustunlik qiladi; §1–§5 shu prizma orqali o'qilsin (outbound mexanikasi to'g'ri va saqlanadi, lekin CRM uchun u endi IKKILAMCHI).

### A. Tuzatilgan model — diagramma

```
                         ┌──────────────────────────┐
                         │   CRM (Bitrix24/amoCRM)   │  ◀── BIRLAMCHI MANBA
                         │   CRM-operator deal/lead  │
                         │   yaratadi va boshqaradi   │
                         └───────────┬───────▲───────┘
       (1) ASOSIY: INTAKE           │       │   (2) IKKILAMCHI: FEEDBACK
       "dostavkaga chiqarildi"      │       │   yetkazish statusi
        bosqichiga o'tkazildi       │       │   (qabul/yo'lda/kutilmoqda/
              webhook  ─────────────┘       │    sotildi/bekor) push
                                    ▼       │
   ┌────────────────────────────────────────┴────────────────────────────┐
   │                     POST CONTROL SYSTEM (PCS)                          │
   │                                                                        │
   │  INBOUND INTAKE (yangi shared yo'l)          OUTBOUND FEEDBACK (mavjud)│
   │  webhook receiver → to'liq yozuvni ol   ┌──▶ OrderEventDispatcher      │
   │   → CRM→order MAPPER → OrderService ────┘    → outbound_sync_queue     │
   │   → NEW buyurtma + crm↔order LINK            → Connector → CRM push    │
   │                                                                        │
   │  ▲ INTAKEdan KEYIN PCS = yetkazish statusi uchun AVTORITET.            │
   │    CRM-tomon keyingi o'zgarishlari PCS'ga SINXRONLANMAYDI.             │
   └───────────────────────────────┬───────────────────────────────────────┘
                                    │  (outbound-only, o'zgarmaydi)
                                    ▼
                         ┌──────────────────────────┐
                         │      Google Sheets        │  ◀── FAQAT ko'zgu
                         └──────────────────────────┘

  Boshqa manbalar (o'zgarmaydi): operator UI · order-bot · AI · QR → NEW buyurtma
  PCS'da tug'ilgan buyurtmani CRM'ga yangi deal qilib yuborish = IXTIYORIY keyingi bosqich
```

**Ikki yo'nalishning roli:**

| Yo'nalish | Ustuvorlik | Trigger | Nima bo'ladi | Davomiylik |
|---|---|---|---|---|
| **CRM→PCS intake** | **ASOSIY** (birlamchi qiymat) | CRM operatori deal/lead'ni "dostavkaga chiqarildi" bosqichiga o'tkazadi | PCS to'liq yozuvni oladi, map qiladi, **NEW buyurtma yaratadi**, crm↔order link saqlaydi | **Bir martalik** — faqat dastlabki intake |
| **PCS→CRM feedback** | IKKILAMCHI (kerak) | PCS yetkazish statusi o'zgaradi | Status CRM bosqichiga qaytariladi, CRM-operator kuzatadi | Buyurtma hayoti davomida |
| **CRM→PCS keyingi o'zgarish** | **YO'Q** | — | Intakedan keyin CRM tomonidagi o'zgarish PCS'ga sinxronlanMAYDI | — |

**Idempotentlik (intake):** har CRM yozuvi uchun **FAQAT BITTA** PCS buyurtma. Bitrix `ONCRMDEALUPDATE` har o'zgarishda otadi — buyurtma faqat **birinchi** mos o'tishda (deal "dostavkaga chiqarildi" bosqichiga kirgan payt) yaratiladi; keyingi barcha webhooklar e'tiborsiz qoldiriladi ("CRM'dagi keyingi o'zgarishlar bizga ta'sir qilmaydi").

### B. Shared qatlamga nima QO'SHILADI

Endi shared qatlam **ikki oqim**dan iborat: (1) mavjud **OUTBOUND** queue (§1–§3, o'zgarmaydi) va (2) **YANGI shared INBOUND intake yo'li**. Inbound yo'l — 4 bosqichli pipeline, mexanikasi shared, biznes-mapping esa CRM-ga xos:

```
CRM webhook  ──▶ [1] WEBHOOK RECEIVER      (SHARED skeleton, CRM auth)
                     express.raw() route (§0.7), autentlik/signature tekshir,
                     tez 200 qaytar, ishni queue'ga qo'y (sinxron ishlamaydi)
                          │
                 [2] TO'LIQ YOZUVNI OL     (CRM-ga XOS)
                     Bitrix: crm.deal.get + crm.deal.contact.items.get/
                             crm.contact.get + crm.deal.productrows.get
                     amoCRM: GET /api/v4/leads/{id}?with=contacts
                          │
                 [3] CRM→ORDER MAPPER      (CRM-ga XOS, 6-bosqich mapping)
                     CRM maydonlari → PCS order maydonlari; SOATO/tuman aniqlash;
                     narx/mahsulot qatorlari → order item'lar
                          │
                 [4] OrderService.createOrder  (SHARED — mavjud naqsh)
                     receiveExternalOrders naqshi kabi NEW buyurtma yaratadi
                     + crm↔order LINK yozadi (idempotentlik kaliti)
```

| Komponent | SHARED (generik) | CRM-ga XOS (adapter) |
|---|---|---|
| Webhook receiver route + `express.raw()` + tez-200 + queue'ga qo'yish | ✅ | auth/signature usuli (§0.7 kengaytiriladi) |
| To'liq yozuvni GET bilan olish (payload faqat ID) | oqim skeleti | endpoint'lar (crm.deal.get vs /leads/{id}) |
| CRM→order MAPPER (maydon xaritasi, SOATO/tuman) | interfeys (`InboundMapper`) | **butunlay CRM-ga xos** |
| NEW buyurtma yaratish (`OrderService.createOrder`) | ✅ mavjud | — |
| crm↔order LINK + intake idempotentlik | jadval sxemasi (`<x>_link`) | kalit (deal_id/lead_id) |
| Outbound feedback (queue+connector+dispatcher) | ✅ §1–§3 | payload/endpoint |

Ya'ni Bosqich 0'ga (§4.1) qo'shiladi: **`InboundIntakeReceiver` + `InboundMapper` interfeysi** (webhook→GET→map→createOrder→link). Outbound queue o'z holicha qoladi, unga **qo'shimcha** sifatida keladi (o'rniga EMAS).

### C. Yangilangan taqqoslash (yo'nalish bo'yicha)

Quyidagi jadval §2 dagi "Yo'nalish" satrini **almashtiradi**:

| Tizim | Intake (CRM→PCS) | Feedback (PCS→CRM) | Yakuniy rol |
|---|---|---|---|
| **Bitrix24** | ✅ **ASOSIY** (`ONCRMDEALUPDATE` → GET → NEW buyurtma) | ✅ status push | **Ikki tomonlama** (intake + feedback) |
| **amoCRM / Kommo** | ✅ **ASOSIY** (leads webhook → GET → NEW buyurtma) | ✅ status push | **Ikki tomonlama** (intake + feedback) |
| **Google Sheets** | ❌ (Sheets inbound intake bermaydi) | ✅ | **Faqat outbound** (o'zgarmaydi) |

### D. Yangilangan rollout (ustuvorlik almashdi)

§4.2 "GSheets birinchi" tartibi **outbound poydevorini** sinash uchun hamon to'g'ri. Lekin **birinchi ishlaydigan biznes-qiymat = CRM'dan buyurtma tushishi (intake)**, shuning uchun CRM adapterida **inbound intake ASOSIY, outbound feedback keyin** keladi:

```
Bosqich 0 (shared outbound plumbing)          — §4.1, o'zgarmaydi
   + Bosqich 0b (shared INBOUND intake skeleton: receiver+mapper interfeys)
        │
        ▼
GSheets (sof outbound)          — poydevorni toza sinash (§4.2 sabab kuchida)
        │
        ▼
CRM (Bitrix YOKI amoCRM):
   1) INBOUND INTAKE   ◀── ASOSIY: webhook→GET→map→NEW buyurtma→link+dedup
   2) OUTBOUND FEEDBACK ◀── keyin: yetkazish statusini CRM bosqichiga push
        │
        ▼
[ixtiyoriy] PCS'da tug'ilgan buyurtmani CRM'ga yangi deal/lead qilib yuborish
```

Muhim farq (§4.2 dan): inbound endi CRM uchun **"oxirgi ixtiyoriy bosqich" EMAS** — u CRM integratsiyasining **butun sababi**. §4.2 dagi "inbound = oxirgi, ixtiyoriy" jumlasi faqat **Sheets** va **outbound feedback statuslariga** taalluqli, CRM intake'ga EMAS.

### E. Yangilangan xavflar (intake'ga xos, §5 ustiga qo'shiladi)

| # | Xavf | Nima bo'ladi | Yumshatish |
|---|---|---|---|
| **X8** | **Intake dedup buzilishi** | `ONCRMDEALUPDATE` har o'zgarishda otadi → bitta deal'dan **bir nechta** PCS buyurtma yaratiladi | `<x>_link` `deal_id/lead_id UNIQUE` + atomik "faqat birinchi mos o'tishda yarat" gate; link mavjud bo'lsa webhook **no-op**; "dostavkaga chiqarildi" bosqichiga **kirish** hodisasini aniqlash (avvalgi bosqich ≠ trigger, hozirgi = trigger) |
| **X9** | **SOATO/tuman mapping bo'shlig'i** | PCS marshrutlash SOATO tuman kodlariga bog'liq, CRM'da SOATO **bo'lmasligi mumkin** → intake buyurtma tumansiz/xato tuman bilan tushadi, routing sinadi | **Ajratilgan dizayn nuqtasi (quyida F).** Strategiya: (a) CRM custom-field'da SOATO, (b) shahar/tuman nomi→SOATO mapping jadval, yoki (c) default tuman + operator qo'lda tuzatishi. Har market o'z mapping'ini config'da tanlaydi |
| **X10** | **Trigger-bosqich noaniqligi** | Noto'g'ri yoki "har o'zgarish" bosqich → erta/dublikat intake yoki umuman tushmaslik | Trigger bosqich (deal stage / pipeline status) **per-market config'da** aniq sozlanadi (hardcode EMAS); faqat shu bosqichga **o'tish** intake'ni qo'zg'atadi |
| **X11** | **Webhook autentligi** | Bitrix webhook OFFLINE payload = faqat ID (HMAC yo'q); amoCRM webhook **HMAC yo'q**, oddiy POST → soxta intake in'ektsiyasi mumkin | Bitrix: `application_token`/handler URL secret tekshir + har doim GET read-back (payloadga ishonma); amoCRM: allow-list subdomain + Bearer bilan GET read-back majburiy; noma'lum manbadan kelgan webhook rad etiladi |

### F. AJRATILGAN DIZAYN NUQTASI — SOATO/tuman aniqlash

Bu intake'ning **eng nozik** joyi va alohida qaror talab qiladi:

```
CRM manzili (odatda ERKIN MATN yoki shahar tanlash)  ─── SOATO tuman kodi YO'Q
                        │
                        ▼   intake MAPPER shu yerda tumanni ANIQLASHI shart
        ┌───────────────┼────────────────┐
        ▼               ▼                 ▼
  (a) CRM custom   (b) nom→SOATO    (c) default tuman
      field         mapping jadval    + operator qo'lda
   UF_..._SOATO    ("Chilonzor"→      tuzatadi (NEW da
   to'g'ridan        1726269...)       "tuman aniqlanmagan"
   SOATO kodi                          bayrog'i)
        │               │                 │
        └───────────────┴─────────────────┘
                        ▼
             PCS order.district_soato  →  mavjud LDG/routing gate ishlaydi
```

MEMORY `ldg-district-gate`: avto-routing tuman kodiga bog'liq emas (operator qo'lda kuryer tanlaydi), shuning uchun **(c) default + qo'lda tuzatish** eng past xavfli boshlang'ich yo'l; (a)/(b) keyin aniqlikni oshiradi. Har market qaysi strategiyani ishlatishini config'da belgilaydi.

---

## 1. Umumiy tavsiya: BITTA shared outbound qatlami + 3 ta plug-in adapter

### 1.1 Qaror

**Uch alohida to'liq modul YOZILMAYDI.** Buning o'rniga **bitta shared "outbound integration / event-bus" qatlami** quriladi va uning ustiga **3 ta yupqa provider-adapter** ulanadi.

Sabab — kodbaza xaritasi allaqachon ikki tayyor "yarim" beradi:

| Mavjud aktiv | Nima beradi | Qanday qayta ishlatiladi |
|---|---|---|
| `integration-sync` **queue engine** | Atomik `FOR UPDATE SKIP LOCKED` claim, batch loop, backoff, stale-recovery, multi-instance xavfsizlik, cron+on-demand trigger, admin retry/stats | **AYNAN shu transport** — 3 tizim ham shundan foydalanadi, qayta yozilmaydi |
| `external-integration` **auth + config** | api_key / login token-cache, secret-masking (`splitSecrets`), daily counters | Auth-strategiya interfeysiga umumlashtiriladi |
| `ldg-cargo` **dedicated-module pattern** | Config-in-DB singleton, kill-switch ierarxiyasi, webhook signature/dedup, `applyStatusFromCode` (business-first), health checklist, `@Cron` avtomatlar | **Skelet naqsh** — har adapterning ichki tuzilishi shundan ko'chiriladi |

`integration-sync`-ning muammosi (xarita §5) — u **order-markazli va e-commerce-status'ga qattiq bog'langan**: `SyncAction` lug'ati sobit, payload faqat `{status_field}`, integratsiya faqat `operator: external_<slug>` orqali topiladi. CRM/Sheets bularning hech biriga mos kelmaydi. **Lekin** buzuq qism faqat **enqueue kontrakti va payload builder** — queue mexanikasi (claim/retry/stale) **butunlay generik**.

Shuning uchun to'g'ri yo'l: **queue/retry loop'ini shared processorga ajratish**, har provider esa faqat (a) auth-strategiya va (b) payload+endpoint builder beradi.

### 1.2 Taklif qilingan shared abstraksiya

Uchta shartnoma (contract):

```ts
// 1) Har provider shuni implementatsiya qiladi — "pluggable adapter"
interface IntegrationConnector {
  readonly kind: 'bitrix24' | 'amocrm' | 'gsheets';
  resolveAuth(cfg): Promise<AuthContext>;            // api_key | oauth2 | service-account
  buildRequest(job: OutboundJob): Promise<HttpCall>; // endpoint+method+headers+body
  parseResponse(raw, job): Promise<LinkPatch>;       // external id / row → link jadval
  isRetryable(err): boolean;                         // 429/5xx vs biznes-xato
  isAlreadyExists?(err): boolean;                    // soft-duplicate (ldg naqsh)
}

// 2) Bitta domain-hodisa dispatcher — order.service hook'lari shuni chaqiradi
interface OrderEventDispatcher {
  dispatch(event: OrderEvent): Promise<void>;  // fire-and-forget, await EMAS
  // event: { orderId, type: 'created'|'received'|'on_road'|'waiting'
  //          |'sold'|'cancelled'|'rollback'|'closed', snapshot }
  // → har FAOL integratsiya uchun BITTA job enqueue qiladi (fan-out shu yerda)
}

// 3) Bitta queue/retry worker — generic transport (mavjud engine'dan)
interface OutboundQueueWorker {
  enqueue(job: OutboundJob): Promise<void>;
  // claimJobs(SKIP LOCKED) → connector.buildRequest → send → parseResponse
  //   → link saqlash; xato → connector.isRetryable? backoff : permanent-failed
}
```

`OutboundJob` — order-markazli EMAS, generik:
```
{ id, integration_id, connector_kind, order_id, operation,
  target_ref (deal_id / lead_id / row / null),
  payload (JSONB), status, attempts, max_attempts, next_retry_at,
  last_error, last_response }
```

### 1.3 Har bir tizim adapterni qanday implementatsiya qiladi

```
                         ORDER LIFECYCLE HOOKS
       sellOrder:2754  cancelOrder:3025  createOrder:505  receive*/send*
                 └──────────┬──────────┬──────────┘
                            ▼ (commitdan KEYIN, fire-and-forget)
                   ┌─────────────────────┐
                   │ OrderEventDispatcher │  bitta hodisa → N ta job (fan-out)
                   └──────────┬──────────┘
                              ▼
                   ┌─────────────────────┐    @Cron(*/30s) + triggerWorker()
                   │  outbound_sync_queue │    FOR UPDATE SKIP LOCKED
                   │  (SHARED, durable)   │    RETRY_DELAYS[60s,5m,15m] max 3
                   └──────────┬──────────┘
                              ▼
                   ┌─────────────────────┐
                   │  OutboundQueueWorker │  connector_kind bo'yicha dispatch
                   └──┬───────┬───────┬──┘
             ┌────────┘       │       └────────┐
             ▼                ▼                ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Bitrix       │  │ amoCRM       │  │ GSheets      │
   │ Connector    │  │ Connector    │  │ Connector    │
   ├──────────────┤  ├──────────────┤  ├──────────────┤
   │ auth: webhook│  │ auth: long-  │  │ auth: service│
   │  URL secret  │  │  lived Bearer│  │  -account JWT│
   │ op: crm.deal │  │ op: leads/   │  │ op: values.  │
   │  .add/update │  │  complex,PATCH│  │  append/update│
   │ batch dedup  │  │ p-limit ≤6rps│  │ row_map O(1) │
   │ link: deal_id│  │ link: lead_id│  │ link: row_no │
   └──────────────┘  └──────────────┘  └──────────────┘
     REST/JSON         REST/JSON          googleapis v173
```

Har adapter **faqat 4 narsani** biladi: auth headerlari, operatsiya→endpoint xaritasi, body shakli, javobdan external-id/row olib link jadvalga yozish. Transport, retry, kill-switch, log — hammasi shared.

---

## 2. Taqqoslash jadvali

| O'lchov | **Bitrix24** | **amoCRM / Kommo** | **Google Sheets** |
|---|---|---|---|
| **Auth modeli** | Inbound webhook URL (kod = secret, muddatsiz) | Long-lived Bearer token (1–5 yil, refresh yo'q) | Service-account JSON → JWT (google-auth-library v10) |
| **Yo'nalish** | Ikki tomonlama mumkin (outbound birlamchi) | Ikki tomonlama mumkin (outbound birlamchi) | **Faqat outbound** (Sheets API webhook bermaydi) |
| **Idempotentlik qiyinligi** | O'rta — `crm.duplicate.findbycomm` + `UF_CRM_PCS_ORDER_ID` + `deal_link` | O'rta — `external_order_id` custom-field + `lead_link` | **Yengil** — `gsheets_row_map` (order_id→row); yo'q=append, bor=update |
| **Webhook (inbound) support** | Ha — `ONCRMDEALUPDATE` (OFFLINE, payload faqat ID → `crm.deal.get` kerak) | Ha — lekin **HMAC yo'q**, STRING qiymatlar, x-www-form-urlencoded | **Yo'q** — faqat Drive `files.watch` (fayl-daraja, 1 kunda eskiradi) |
| **Rate limit** | Portal-darajali (batch bilan yumshatiladi, 50/sahifa) | ~7 rps hard → **p-limit ≤6 rps** + write-gap | 60 read + 60 write / daq / project → serialized write-queue |
| **Tavsiya etilgan arxitektura** | Dedicated adapter + **shared queue** | Dedicated adapter + **shared queue** | Dedicated adapter + **shared queue** |
| **Link (idempotency) jadval kaliti** | `deal_id` | `lead_id` | `row_number` |
| **Terminal-status guard kerakmi** | Ha (inbound bo'lsa) | Ha (moliyaviy statusni webhookdan OLMAYDI) | Yo'q (outbound-only) |

**Umumiy xulosa:** uchalasi ham **"dedicated adapter + shared queue engine"** — hech qaysi biri mavjud `integration-sync` engine'ini o'zgarishsiz qayta ishlata olmaydi (payload/auth farqli), lekin hech qaysi biri to'liq mustaqil queue ham yozmasligi kerak.

---

## 3. Umumiy komponentlar (3 tizim ham qayta ishlatadi)

### 3.1 Entity/ustunlar sxemasi

Har provider **2 ta o'z jadvali** + **1 ta shared queue**ni ulashadi:

```
SHARED (bitta, hammasi uchun)               PER-PROVIDER (har biriga 2 ta)
┌───────────────────────────┐    ┌──────────────────┐  ┌──────────────────┐
│ outbound_sync_queue       │    │ <x>_config       │  │ <x>_link         │
│  id, connector_kind,      │    │ (singleton row)  │  │ (order↔external) │
│  integration_id, order_id,│    │  api creds/secrets│  │  order_id UNIQUE │
│  operation, target_ref,   │    │  webhook_secret + │  │  external_id/    │
│  payload JSONB,           │◀───│   _previous(rot.) │  │   deal/lead/row  │
│  status, attempts,        │    │  is_active MASTER │  │  last_status,    │
│  max_attempts,            │    │  *_enabled togglar │  │  send_attempts,  │
│  next_retry_at,           │    │  mapping JSONB    │  │  last_error,     │
│  last_error, last_response│    │  provider-courier │  │  mismatch_at,    │
│  synced_at                │    │   / SA / pipeline  │  │  last_synced_at  │
└───────────────────────────┘    └──────────────────┘  └──────────────────┘
  BaseEntity (uuid+bigint ms)      BaseEntity            BaseEntity
```

Qat'iy qoida (xatoni oldini olish, MEMORY'dagi tuzoq): nullable bigint ustunlarda **`bigintTransformerDefault` (null-preserving)** ishlatiladi, `NonNull` variant EMAS — aks holda `mismatch_at` va shunga o'xshash ustunlar `null→0` bo'lib `IS NOT NULL` filtrni zaharlaydi (LDG'da tuzatilgan bug).

### 3.2 Config strategiyasi — env vs DB

Yagona sanksiyalangan naqsh (uchala reja ham shunga rozi):

| Ma'lumot turi | Qayerda | Sabab |
|---|---|---|
| Infra master kalit (masalan `SHEETS_ENC_KEY` AES-256-GCM) | **env** | Deploy-baked, hamma uchun bir xil, admin ko'rmaydi |
| Provider credential (api_key, token, SA JSON, webhook code) | **DB config, shifrlangan** | Admin runtime'da almashtiradi, redeploysiz, audit kerak |
| Status/stage/pipeline mapping | **DB (jsonb)** | Portalga xos, HARDCODE qilinmaydi |
| Endpoint bazasi, subdomain, spreadsheet_id | **DB config** | Runtime o'zgaradi |

**Prinsip:** infra-daraja yagona kalit → env; runtime-tunable + per-tenant + audit kerak → DB config entity. Bu `ldg_config` singleton naqshining aynan takrori — operator UI'dan credential o'zgartira oladi, redeploy kutmaydi.

### 3.3 Yagona retry/queue worker

**Bitta** `OutboundQueueWorker` uchala provider uchun ishlaydi (§1.2). Mexanika `integration-sync`'dan olinadi, o'zgarishsiz:
- `@Cron('*/30 * * * * *')` + `triggerWorker()` (enqueue'dan keyin), `isProcessing` guard.
- `claimJobs`: `FOR UPDATE SKIP LOCKED`, `status='pending' OR (failed AND next_retry_at<=now)`, atomik `→processing, attempts++`.
- `reclaimStaleProcessing` (STALE=10min).
- `RETRY_DELAYS=[60s,5m,15m]`, `max_attempts=3`; transient (`next_retry_at!=null`) vs permanent (`next_retry_at IS NULL`) diskriminatori.
- Provider-farqi faqat `connector.isRetryable(err)` va `connector.buildRequest()`da.

### 3.4 Yagona activity-logging

MEMORY `activity-log-conventions` bo'yicha, uchala tizim ham **bir xil**:
- `order_number` (`#100000+`) ishlatiladi, uuid EMAS.
- Status-label `status-label.util` orqali o'zbekchaga o'giriladi.
- Secret maydonlar `masked_fields` marker bilan (raw YOZILMAYDI) — `INTEGRATION_SECRET_FIELDS`/`LDG_CONFIG_SECRET_FIELDS` naqshi har provider config'iga kengaytiriladi.
- Actor `@CurrentUser`, IP/qurilma `request-meta.util` + ALS request-context (MEMORY `audit-log-ip-device`, `9bb6c270`) orqali.

### 3.5 Shared kill-switch

`ldg_config` ierarxiyasi aynan takrorlanadi, har provider config'ida:

```
is_active (MASTER — "katta qizil tugma")
   ├─ outbound dispatch'ni to'sadi (enqueue oldidan assertDispatchEnabled)
   ├─ inbound apply'ni to'sadi (webhook status application)
   └─ reconcile/reprocess'ni to'sadi
webhook_enabled     ─┐
reconcile_enabled    ├─ per-background-process togglar (har loop boshida tekshir)
auto_retry_enabled  ─┘
```

Qo'shimcha: dispatcher darajasida **global fan-out gate** — bitta hodisa faqat `is_active=true` bo'lgan integratsiyalarga job yaratadi, shuning uchun bitta tizimni o'chirish qolganlariga ta'sir qilmaydi.

---

## 4. Ketma-ketlik (rollout order)

### 4.1 Umumiy Bosqich 0 — poydevor (hammasi shunga bog'liq)

Bu **provider-neytral** ish, birinchi tizimdan OLDIN bajariladi:

```
BOSQICH 0 (shared plumbing) — hech bir CRM/Sheet'siz test qilinadi
 ├─ 0.1  outbound_sync_queue jadval + migration (generik OutboundJob)
 ├─ 0.2  OutboundQueueWorker: claimJobs/processQueue/retry/stale ajratildi
 │        (integration-sync'dan extract, order-bog'liqlikdan tozalab)
 ├─ 0.3  IntegrationConnector interfeys + connector registry (kind→adapter)
 ├─ 0.4  OrderEventDispatcher: order.service hook'lariga ULANADI
 │        MAVJUD 4 seam (sell:2781, cancel:3048, partly:3557, rollback:4120)
 │        + YANGI seam: createOrder:505, receive*/send* (hozir sync YO'Q)
 │        fire-and-forget, commitdan KEYIN — mavjud konvensiya
 ├─ 0.5  Shared config-entity bazasi (secret-mask, is_active, togglar)
 ├─ 0.6  Shared activity-log + request-context ulanishi
 └─ 0.7  express.raw() webhook-route naqshi (inbound kerak bo'lganda)
```

### 4.2 Qaysi tizim birinchi — **Google Sheets**

| Mezon | GSheets | amoCRM | Bitrix24 |
|---|---|---|---|
| Faqat outbound (eng kam xavf) | ✅ | ❌ (inbound jozibasi) | ❌ (inbound jozibasi) |
| Idempotentlik yengilligi | ✅ (row_map) | o'rta | o'rta (dup-search) |
| Auth murakkabligi | past (SA JWT) | past (Bearer) | past (URL secret) |
| Feedback-loop xavfi | **yo'q** | bor | bor |
| Shared worker'ni sinash qiymati | yuqori (toza outbound) | yuqori | yuqori |

> ⚠️ **Quyidagi §4.2 tartibi TUZATILDI** — yuqoridagi «YO'NALISH TUZATILDI» bo'limiga qarang. Asosiy biznes qiymati CRM'dan buyurtma tushishi (inbound intake) bo'lgani uchun tartib CRM-intake'dan boshlanadi, Sheets'dan emas.

**Sabab (TUZATILGAN):** asosiy biznes qiymati — CRM'dan buyurtma tushishi (**inbound intake**). Shuning uchun poydevordan keyin darhol **birinchi CRM'ning intake'i** quriladi (CRM webhook → PCS'da NEW buyurtma), so'ng **outbound feedback** (status CRM'ga qaytadi), keyin ikkinchi CRM. Google Sheets — sof outbound hisobot; istalgan vaqtda alohida qo'shiladi (u shared queue'ni toza sinash uchun ham qulay, lekin biznes-krititik emas).

```
Tartib:  Bosqich 0 (shared: config·webhook-receiver·queue·log)
   →  1-CRM intake (CRM→PCS buyurtma, ASOSIY qiymat)
   →  1-CRM feedback (PCS→CRM status)
   →  2-CRM (intake + feedback)
   →  Google Sheets (outbound hisobot, istalgan payt)
```

**Inbound intake (CRM→PCS)** — CRM'lar uchun **ASOSIY oqim** (buyurtma manbai), ixtiyoriy EMAS. Moliyaviy/tuman qarorlari webhook payload'iga tayanmaydi — har doim GET read-back bilan (Bitrix `crm.deal.get`, amoCRM `GET /leads/{id}`). Intakedan keyingi CRM o'zgarishlari PCS'ga sinxronlanmaydi (1 CRM yozuvi = 1 buyurtma). Google Sheets'da inbound YO'Q (u manba emas).

---

## 5. Umumiy xavflar (cross-cutting) va yumshatish

| # | Xavf | Nima bo'ladi | Yumshatish (shared) |
|---|---|---|---|
| **X1** | **Secret sprawl** (sir tarqalishi) | 3 provider × credential + webhook secret + rotation = ko'p maxfiy maydon, log/audit'ga sizib chiqishi | Bitta shared secret-mask ro'yxati (`*_SECRET_FIELDS`), `getSafe()` faqat `*_set:boolean` qaytaradi, DB'da shifrlangan (AES-256-GCM, kalit env'da), `masked_fields` marker. Hech qachon raw log |
| **X2** | **Duplicate-order storm** (dublikat buyurtma bo'roni) | Retry yoki qayta-enqueue bir buyurtmani CRM'da 2 marta yaratadi | Har provider `<x>_link` jadvali `order_id UNIQUE` + idempotentlik: mavjud bo'lsa qayta-yubormaydi (ldg `${order.id}:${post_id}` naqsh); Bitrix `crm.duplicate.findbycomm`; queue'da `delivery/idempotency-key`; "already exists" **soft** ishlanadi |
| **X3** | **Rate-limit fan-out** | Bitta bulk amal (bulkSell/bulkCancel) N buyurtma × 3 provider = fan-out bo'roni, hamma limitni uradi | Shared worker `BATCH_SIZE=10` + 500ms gap; har adapter **serialized write-queue** (ldg `enqueueWrite`, amo p-limit ≤6rps); `429/Retry-After` hurmat qilinadi va **attempt counter'ni yoqmaydi** (rate-limit ≠ xato) |
| **X4** | **PII tizimdan chiqishi** | Mijoz ismi/telefon/manzil CRM va Sheet'ga chiqadi — ayniqsa Sheets keng ko'rish huquqi bilan | Payload builder'da **field-allowlist** (faqat kerakli maydon); Sheets share **faqat SA + minimal odam**; least-privilege scope (`crm` only, `spreadsheets` only, `drive` EMAS); MEMORY PII-parser qoidasi; kill-switch orqali darhol to'xtatish |
| **X5** | **Ikki manba haqiqat konflikti** (inbound yoqilganda) | CRM operatori statusni o'zgartiradi → biz push qildik → CRM webhook qaytardi → echo-loop; yoki moliyaviy status buziladi | Echo-guard (o'z webhook-user'imizdan kelgan o'zgarishni e'tiborsiz); terminal-status guard (`CLOSED` faqat skanerdan, LDG naqsh); moliyaviy qaror hech qachon webhook qiymatiga ishonmaydi — GET read-back majburiy |
| **X6** | **In-memory token cache multi-instance'da** | `getValidToken` cache per-process, restart'da yo'qoladi, instansiyalar orasida bo'linmaydi | Long-lived/SA auth'da muammo yo'q (refresh kam); OAuth kerak bo'lsa DB'da token saqlash; `clearTokenCache`/`refreshToken` 401'da qayta ishlaydi (mavjud naqsh) |
| **X7** | **Silent failure** (jimgina xato) | Fire-and-forget dispatch xatosi asosiy oqimni buzmaydi, lekin ko'rinmay qoladi | Har xato `<x>_link.last_error` + queue `last_error`/`last_response`; shared admin `GET /health` checklist + `permanently_failed` stats + manual `retryAll`; `@Cron` auto-retry |

**Umumiy prinsip (barcha xavflar uchun):** Post Control System — **yagona haqiqat manbai**, uchala tashqi tizim — **ko'zgu**. Ma'lumot faqat bir yo'nalishda avtoritetli oqadi (bizdan→tashqariga); teskari yo'nalish (inbound) har doim ehtiyotkor, guard'langan, moliyaviy-neytral va ixtiyoriy.