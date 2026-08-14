# Bitrix24 (btrx24) Integratsiya Rejasi — Post Control System

> Hujjat turi: Integratsiya arxitekturasi rejasi (implementatsiyadan oldingi tahlil)
> Til: O'zbek | Sana: 2026-07-25 | Muallif roli: Senior Integration Architect
> **YO'NALISH QAYTA YOZILDI (2026-07-25):** Oldingi reja "biz→CRM deal/lead yaratamiz" deb faraz qilgan edi. Biznes tomonidan tasdiqlangan TUZATILGAN MODEL bunga **teskari**: CRM (Bitrix24/amoCRM) — buyurtmaning **birlamchi manbai**, PCS'dan yuqorida turadi. Shuning uchun **ASOSIY oqim = INBOUND INTAKE** (CRM webhook → to'liq yozuvni ol → CRM→order maydon mapping → PCS'da NEW buyurtma yarat → link + idempotentlik). **IKKILAMCHI oqim = OUTBOUND FEEDBACK** (PCS status → CRM bosqichi) — oldingi rejaning queue/retry/mapping qismi asosan qayta ishlatiladi.

> ## ✅ TUZATILGAN MODEL — QARORLAR (2026-07-25)
> - **M1 Manba iyerarxiyasi:** CRM = **source of truth (buyurtma yaratish uchun)**; PCS = **yetkazish statusi uchun avtoritet** (intakedan keyin). Asosiy yo'nalish **CRM→PCS**.
> - **M2 Intake trigger:** CRM-operatori deal/lead'ni sozlangan **"dostavkaga chiqarildi / release to delivery"** bosqichiga o'tkazsa → PCS'ga webhook → PCS'da **YANGI (NEW) buyurtma** yaratiladi.
> - **M3 Idempotentlik:** har CRM yozuvi uchun **FAQAT BITTA** buyurtma. `ONCRMDEALUPDATE` har o'zgarishda otadi — buyurtma faqat **birinchi mos o'tishda** yaratiladi; keyingilari e'tiborsiz.
> - **M4 Intakedan keyin:** CRM-tomon o'zgarishlari PCS'ga **SINXRONLANMAYDI** (davomiy inbound status-sync YO'Q). Yagona muhim inbound hodisa = dastlabki intake.
> - **M5 Outbound feedback:** PCS yetkazish statusi (qabul/yo'lda/kutilmoqda/sotildi/bekor) → CRM bosqichiga qaytariladi (CRM-operatori kuzatadi). Oldingi outbound queue SAQLANADI.
> - **M6 PCS→CRM create (deal/lead yaratish):** PCS'da tug'ilgan (bot/AI/operator/QR) buyurtmani CRM'ga **yangi deal/lead** qilib yuborish — **IXTIYORIY Bosqich 3**, asosiy talab EMAS.
> - **M7 Tenancy = PER-MARKET** — har market o'z CRM akkaunti bilan ulanadi (`external_integration` uslubi; singleton EMAS).
> - **M8 Maydonlar = BARCHASI, ikkala yo'nalishda; bosqichlar = TO'LIQ 6.**
> - **M9 SOATO/TUMAN — kritik dizayn nuqtasi:** PCS SOATO tuman kodlari bo'yicha marshrutlaydi; CRM'da SOATO bo'lmasligi mumkin → intake **tuman-aniqlash strategiyasi** shart (§5.3).

---

## 1. Maqsad va yo'nalish

### 1.1 Nimani integratsiya qilamiz

Post Control System (PCS) — NestJS + TypeORM + Postgres yetkazib berish tizimi. Bitrix24 — CRM va **buyurtmaning birlamchi manbai**. Biznes modeli: CRM-operatorlari (call-markaz/sotuv) mijoz bilan Bitrix ichida ishlaydi, buyurtmani deal (yoki lead) sifatida to'liq to'ldiradi va **"dostavkaga chiqarildi"** bosqichiga o'tkazadi. Shu lahzada buyurtma yetkazishga tayyor — PCS uni oladi, kuryerlik/regionlik oqimiga tushiradi va yetkazadi. Yetkazish jarayoni PCS'da boradi; uning holati CRM'ga qaytib ko'rinadi, shunda CRM-operatori "buyurtmam qayerda?" degan savolga CRM ichidan javob oladi.

Ya'ni ikki tizim ikki xil ishni bajaradi:
- **CRM** — mijoz bilan muzokaralar, buyurtmani **tug'diradi** (source of truth for creation).
- **PCS** — buyurtmani **yetkazadi** va yetkazish holatining avtoriteti (source of truth for delivery).

### 1.2 Yo'nalish tavsiyasi (TUZATILGAN)

| Yo'nalish | Nima | Tavsiya | Sabab |
|---|---|---|---|
| **Inbound INTAKE (CRM → PCS)** | CRM-operatori deal'ni "dostavkaga chiqarildi" bosqichiga o'tkazdi → PCS to'liq yozuvni oladi → PCS'da **NEW buyurtma yaratadi** | ✅ **ASOSIY (Bosqich 0–1)** | CRM = manba. Buyurtma shu yerdan tug'iladi. Bu integratsiyaning butun mavjudlik sababi. |
| **Outbound FEEDBACK (PCS → CRM)** | PCS statusi o'zgardi (qabul/yo'lda/kutilmoqda/sotildi/bekor) → CRM deal bosqichi yangilanadi | ✅ **KERAK (Bosqich 2)** | CRM-operatori yetkazish holatini CRM ichida kuzatishi uchun. Faqat oyna (status mirror). |
| **Inbound STATUS-SYNC (intakedan keyin CRM→PCS)** | CRM'da deal maydonlari intakedan keyin o'zgardi → PCS'ga aks etsin | ❌ **YO'Q (scope'dan tashqarida)** | M4: intakedan keyin PCS = avtoritet. Davomiy inbound status-sync qilinmaydi. Feedback-loop va konflikt xavfini oldini oladi. |
| **Outbound CREATE (PCS-born → CRM deal/lead)** | PCS'da tug'ilgan (bot/AI/operator) buyurtmani CRM'ga yangi deal qilib yuborish | 🔻 **IXTIYORIY (Bosqich 3)** | M6: asosiy talab emas. Marketing/hisobot to'liqligi uchun keyingi bosqich. |

**Qaror:** Boshlanishi **inbound intake** (Bosqich 0–1). Bu integratsiyaning yuragi. So'ng **outbound feedback** (Bosqich 2). Outbound-create (Bosqich 3) — faqat biznes talab qilsa.

### 1.3 Intake trigger'i: qaysi CRM bosqichi

Butun oqimning kaliti — **"dostavkaga chiqarildi / release to delivery"** bosqichi. Bu:
- **Bitrix'da:** deal `STAGE_ID` ma'lum bir qiymatga o'tishi (masalan default voronkada `PREPARATION`/`EXECUTING` yoki maxsus voronkada `C1:DELIVERY`). Bu qiymat **per-market konfiguratsiyalanadi** (`intake_stage_id`), hardcode QILINMAYDI (STAGE_ID voronkaga bog'liq — §3).
- **amoCRM'da:** lead `status_id`/`pipeline_id` ma'lum bosqichga o'tishi.

CRM'dan `ONCRMDEALUPDATE` (Bitrix) yoki `leads:status` (amoCRM) hodisasi otiladi. PCS deal'ni to'liq o'qib, uning joriy bosqichi **sozlangan intake bosqichiga TENG bo'lsagina** buyurtma yaratadi. Boshqa har qanday o'zgarish (STAGE ≠ intake, yoki allaqachon intake qilingan) → **e'tiborsiz**.

> **Nozik masala (M3):** `ONCRMDEALUPDATE` deal'ning **har** o'zgarishida (izoh, maydon, mas'ul, va h.k.) otadi. Trigger = "STAGE endi intake bosqichida VA bu deal uchun hali PCS buyurtma yaratilmagan". Ikkala shart ham majburiy.

---

## 2. Ma'lumot oqimi (diagramma)

### 2.1 ASOSIY: Inbound intake oqim (Bosqich 0–1)

```
  Bitrix24 portal                                   PCS (NestJS)
 ┌───────────────────┐                             ┌──────────────────────────────────────────────┐
 │ CRM-operator      │                             │                                                │
 │ deal → "dostavkaga│  ONCRMDEALUPDATE            │ POST /api/v1/bitrix/webhook                    │
 │ chiqarildi"       │  (form-urlencoded,          │  (auth guard YO'Q; application_token verify;   │
 │ STAGE_ID = intake │───application_token)───────►│   raw body; @HttpCode(200))                    │
 └───────────────────┘  payload: FAQAT deal ID     │        │                                        │
       ▲                                            │        ▼ 1. token/member_id/domain verify      │
       │                                            │        ▼ 2. delivery/event dedup (webhook_log) │
       │  crm.deal.get(ID)                          │        ▼ 3. crm.deal.get(ID) — to'liq yozuv     │
       │  crm.deal.contact.items.get → contact.get  │◄──────── crm.deal.contact.items.get            │
       │  crm.deal.productrows.get                  │◄──────── crm.contact.get(contactId)            │
       └────────────────────────────────────────────┤◄──────── crm.deal.productrows.get(dealId)      │
                                                     │        │                                        │
                                                     │        ▼ 4. STAGE == intake_stage_id ?          │
                                                     │           yo'q → skip (log only)                │
                                                     │        ▼ 5. bitrix_order_link bor ? (idempot.) │
                                                     │           bor → skip (buyurtma allaqachon bor)  │
                                                     │        ▼ 6. CRM→order MAP (mijoz/manzil/TUMAN/  │
                                                     │              mahsulot/narx) — §5.1              │
                                                     │        ▼ 7. tuman-aniqlash (SOATO) — §5.3        │
                                                     │        ▼ 8. createOneCrmOrder() → NEW buyurtma  │
                                                     │              (receiveExternalOrders naqshi)     │
                                                     │        ▼ 9. bitrix_order_link INSERT            │
                                                     │              (crm_id ↔ order_id, UNIQUE)        │
                                                     │        ▼ 10. always 200                          │
                                                     └──────────────────────────────────────────────┘
```

### 2.2 IKKILAMCHI: Outbound feedback oqim (Bosqich 2)

```
   PCS (NestJS)                                              Bitrix24 portal
  ┌──────────────────────────────────────────┐            ┌──────────────────┐
  │  order.service.ts / post.service.ts       │            │   CRM Deal       │
  │   sellOrder / cancelOrder / sendPost / ... │            │   STAGE_ID       │
  │        │ (commitTransaction)              │            │   (oyna)         │
  │        ▼  fire-and-forget (await EMAS)     │            └────────▲─────────┘
  │  BitrixFeedbackService.enqueue(orderId,ev) │                     │ HTTPS
  │        │                                   │                     │ inbound
  │        ▼  (link topilmasa jim skip)         │                     │ webhook URL
  │  ┌──────────────────────┐                 │                     │
  │  │ bitrix_sync_queue    │  durable        │                     │
  │  │ status/attempts/     │  Postgres       │                     │
  │  │ next_retry_at        │                  │                     │
  │  └──────────┬───────────┘                 │                     │
  │             │  @Cron('*/30 * * * * *')     │                     │
  │             ▼  FOR UPDATE SKIP LOCKED       │                     │
  │  ┌──────────────────────┐                 │                     │
  │  │ BitrixWorker         │──STAGE map──────┼──── crm.deal.update ┘
  │  │  (claim→send→retry)  │  (order_link.    │      {STAGE_ID: mapped}
  │  └──────────────────────┘   deal_id orqali)│
  └──────────────────────────────────────────┘

  ⚠️ Echo-guard: PCS'ning crm.deal.update chaqiruvi Bitrix'da yana
     ONCRMDEALUPDATE otadi. Intake webhook uni ko'radi, LEKIN:
     - link allaqachon bor (idempotentlik) → skip (create qilmaydi)
     - STAGE endi intake emas (WON/LOSE) → skip
     Shuning uchun feedback → cheksiz sikl YO'Q. (§8.4)
```

### 2.3 Hodisa → amal jadvallari

**(a) CRM hodisasi → PCS amali (INBOUND):**

| CRM hodisa | Shart | PCS amali |
|---|---|---|
| `ONCRMDEALUPDATE` (deal o'zgardi) | STAGE = `intake_stage_id` **VA** link yo'q | To'liq yozuvni ol → **NEW buyurtma yarat** → link saqla |
| `ONCRMDEALUPDATE` | STAGE = intake **LEKIN** link bor | **Skip** (idempotentlik — allaqachon yaratilgan) |
| `ONCRMDEALUPDATE` | STAGE ≠ intake (masalan sotuv bosqichi, yoki bizning feedback echo'si) | **Skip** (log only) |
| `ONCRMDEALADD` | (ixtiyoriy) | Odatda e'tiborsiz — deal yaratilishi intake emas; intake = **bosqichga o'tish** |
| `ONCRMDEALDELETE` | link bor | (ixtiyoriy) buyurtma allaqachon yetkazishda bo'lishi mumkin → **o'chirmaymiz**, faqat log/flag |

**(b) PCS hodisasi → CRM amali (OUTBOUND FEEDBACK):**

| PCS buyurtma hodisasi | Bitrix REST amali | Natija |
|---|---|---|
| Qabul qilindi (NEW→RECEIVED) | `crm.deal.update {STAGE_ID: <received>}` | Bosqich = Qabul qilindi |
| Yo'lga chiqdi (→ON_THE_ROAD) | `crm.deal.update {STAGE_ID: <on_road>}` | Bosqich = Yo'lda |
| Kuryerda (→WAITING) | `crm.deal.update {STAGE_ID: <waiting>}` | Bosqich = Kuryerda |
| **Sotildi** (SOLD/PAID/PARTLY_PAID) | `crm.deal.update {STAGE_ID: WON}` | Bosqich = Yutildi (terminal) |
| **Bekor** (CANCELLED/CANCELLED_SENT) | `crm.deal.update {STAGE_ID: LOSE}` | Bosqich = Yo'qotildi (terminal) |
| Rollback (qaytarish) | `crm.deal.update {STAGE_ID: <waiting>}` | Bosqichga qaytadi |
| Yopildi (→CLOSED) | `crm.deal.update {STAGE_ID: LOSE, COMMENTS: ...}` | Yopilgan izoh |

---

## 3. Autentifikatsiya va sozlash

### 3.1 Ikki xil auth — inbound qabul VA outbound chaqiruv

Integratsiya ikki kanaldan iborat, ularning autentifikatsiyasi **turlicha**:

| Kanal | Yo'nalish | Auth mexanizmi |
|---|---|---|
| **Inbound webhook qabul** | CRM → PCS | Bitrix **outbound webhook** `application_token` (payload `auth.application_token`), + `member_id`/`domain` tekshiruvi. PCS bu tokenni saqlangan qiymat bilan solishtiradi. |
| **Outbound REST chaqiruv** (deal.get, deal.update, productrows.get) | PCS → CRM | Bitrix **inbound (incoming) webhook** — URL ichida `<USER_ID>/<WEBHOOK_CODE>`. Muddati tugamaydi. Bu bizning CRM'ga chaqiruvimiz uchun. |

> **Diqqat — atama chalkashligi:** Bitrix terminologiyasida "**inbound webhook**" = *biz Bitrix'ga chaqiruv qilamiz* (URL-kod credential). "**Outbound webhook**" = *Bitrix bizga event yuboradi* (application_token). Bizning INBOUND INTAKE oqimimiz Bitrix'ning **outbound webhook**'idan (event) foydalanadi, va u eventga javoban Bitrix'ning **inbound webhook** URL-kodi orqali `crm.deal.get` qiladi. Ikkalasi ham kerak.

**Bitrix inbound (incoming) webhook URL formati** (biz chaqiramiz):
```
https://<portal>.bitrix24.com/rest/<USER_ID>/<WEBHOOK_CODE>/<method>.json
namuna: https://mymarket.bitrix24.com/rest/1/173glortu42lvpju/crm.deal.get.json
```
`<WEBHOOK_CODE>` = credential (muddati yo'q; sizib chiqsa doimiy xavf → shifrlanadi, §9).

### 3.2 Bitrix portalida per-market qo'lda sozlash (bir martalik)

Har market o'z portalida:
```
1. Portal → Applications → Developer resources → "Other"
2. INBOUND (incoming) webhook yaratish  [biz REST chaqirish uchun]
     ├─ Scope: crm  (least privilege, §9)
     └─ URL/kod → PCS admin panelга kiritiladi (portal_domain, webhook_user_id, webhook_code)
3. OUTBOUND webhook yaratish  [CRM → biz event uchun — INTAKE'ning yuragi]
     ├─ Event: ONCRMDEALUPDATE  (va ixtiyoriy ONCRMDEALADD)
     ├─ Handler URL: https://<pcs-domain>/api/v1/bitrix/webhook
     └─ Bitrix random application_token beradi → PCS admin panelga kiritiladi (outbound_app_token)
4. Voronka bosqichlarini aniqlash:
     crm.status.list {ENTITY_ID: "DEAL_STAGE"}  → STAGE_ID qiymatlari
     ├─ intake_stage_id  = "dostavkaga chiqarildi" bosqichi   [INTAKE trigger]
     └─ received/on_road/waiting/won/lose  [OUTBOUND feedback mapping]
5. (Muhim, SOATO uchun §5.3) Tuman-aniqlash strategiyasini tanlash:
     A) CRM'da SOATO custom field (UF_CRM_SOATO) mavjudmi?
     B) yoki CRM tuman NOMI qaysi maydonda keladi? (nom-match)
     C) yoki market uchun DEFAULT tuman belgilanadimi?
6. (ixtiyoriy Bosqich 3) korrelyatsiya uchun UF_CRM_PCS_ORDER_ID user field
```

**amoCRM per-market sozlash (agar amoCRM bo'lsa):**
```
1. Sozlamalar → Integratsiyalar → o'z integratsiyangizni yarating (OAuth2)
2. Webhook obunasi: leads:status (bosqich o'zgarishi) → handler URL
     ⚠️ Webhook obunasi TARIF'ga bog'liq (§12) — ba'zi tariflarda cheklangan/yo'q
3. Trigger bosqich (pipeline_id + status_id) = "dostavkaga chiqarildi"
4. amoCRM webhook payloadida asosiy maydonlar keladi, lekin to'liq lead uchun:
     GET /api/v4/leads/{id}?with=contacts  (OAuth Bearer)
```

### 3.3 Nimani qayerda saqlaymiz (env vs DB)

Qoida: **infra/global secret → env; runtime-tunable / per-market / audit kerak → DB config entity.**

| Ma'lumot | Qayerda | Sabab |
|---|---|---|
| Portal domeni | **DB** (`bitrix_integration`) | Per-market |
| Inbound webhook USER_ID + CODE | **DB** (**shifrlangan**) | Bizning REST chaqiruvimiz krediti |
| Outbound `application_token` | **DB** (**shifrlangan**) | Kelgan event autentligini tekshirish |
| `intake_stage_id` | **DB** | Qaysi bosqich intake — per-market |
| STAGE_ID mapping (feedback) | **DB** (jsonb) | Voronkaga xos, hardcode QILINMAYDI |
| Tuman-aniqlash strategiyasi + mapping | **DB** (jsonb + flag) | §5.3, per-market |
| `SECRETS_ENC_KEY` (AES master) | **env** | Infra-level, deploy-baked |
| Master toggle / yo'nalish flaglari | **DB** boolean | Runtime kill-switch |

### 3.4 Token-refresh loop

- **Bitrix:** inbound webhook (URL-kod) tanlangani uchun **token-refresh YO'Q**. Outbound event `application_token` ham statik. Refresh state-machine kerak emas.
- **amoCRM (agar):** OAuth2 — `access_token` 24 soat, `refresh_token` rotatsiya bilan → refresh loop KERAK. Shuning uchun amoCRM entity'siga `access_token`/`refresh_token`/`token_expires_at` (shifrlangan) ustunlari qo'shiladi va retry-worker ichida proaktiv yangilanadi. **Bu Bitrix va amoCRM o'rtasidagi asosiy farq.**

---

## 4. Arxitekturaga ulanish

### 4.1 Asosiy qaror: yangi maxsus modul + ikki isbotlangan naqsh

TUZATILGAN modelda ikkita mustaqil quyi-tizim bor va ularning **ikkalasiga ham** kodbazada tayyor namuna mavjud:

| Quyi-tizim | Naqsh manbai | Nima qayta ishlatiladi |
|---|---|---|
| **INBOUND intake** (webhook → buyurtma yaratish) | `ldg-webhook.*` (xavfsizlik/dedup) + `receiveExternalOrders` (buyurtma yaratish) | Auth'siz controller + raw body + imzo/token verify + dedup log; **buyurtma yaratish esa `receiveExternalOrders`ning bitta-buyurtma helperi** |
| **OUTBOUND feedback** (status → CRM) | `integration-sync.service.ts` durable queue | `enqueue` + `claimJobs` (FOR UPDATE SKIP LOCKED) + retry/backoff/stale reclaim + kill-switch |

**QAROR: `ldg-cargo` uslubidagi YANGI maxsus modul `bitrix-crm/`.** Generic `external-integration` engine mos emas (kodbaza xaritasi §5: 7 ta hardcode cheklov; enqueue `order.external_id` + `operator='external_'` talab qiladi, CRM-tug'ilgan buyurtmada bu bor, lekin outbound feedback shakli `{status_field: value}` — CRM STAGE_ID mapping'iga yetmaydi). Buning o'rniga: yangi modul, isbotlangan **pattern**larni ko'chiradi.

**INBOUND buyurtma yaratish — kritik qaror (intake xaritasidan):** yangi buyurtma **`createOrder` bilan EMAS**, `receiveExternalOrders` (`order.service.ts:5533`) naqshi bilan yaratiladi. Sabab (intake xaritasi 1-bo'lim):
- `createOrder` mijozni telefon bilan **yaratmaydi** — faqat mavjud `customer_id` UUID qabul qiladi (`:371`), CRM esa telefon/ism yuboradi.
- `receiveExternalOrders` aynan "tashqi xom yozuv → to'liq buyurtma"ni bajaradi: mijoz-upsert (telefon bo'yicha), telefon normalizatsiya, SATO→tuman, region post biriktirish, dedup — hammasi bitta tranzaksiyada.

**Amaliy tanlov (intake xaritasi Variant B — toza):** `receiveExternalOrders` ichidagi bitta-buyurtma yaratish blokini (`order.service.ts:5660-5872`) `private async createOneExternalOrder(extOrder, ctx)` helperiga **refaktor qilib ajratamiz**; CRM webhook servisi shuni chaqiradi. Loop/dedup/post-cache umumiy qoladi. Bu `OrderService`da kichik, xavfsiz refaktor.

> **Diqqat — status farqi (intake xaritasi 6-bo'lim):** `receiveExternalOrders` buyurtmani to'g'ridan **`RECEIVED`** holatida yaratadi va post'ga biriktiradi (guruh-tasdiqsiz). TUZATILGAN modelda CRM buyurtmasi PCS'ga NEW sifatida kirishi kerak (M2: "PCS'da NEW buyurtma yaratadi"). **Qaror kerak (§12 Q3):** CRM buyurtmasi `NEW` (operator PCS'da ko'zdan kechiradi)mi yoki tashqi konvensiyadagidek `RECEIVED` (ishonchli manba, darhol post'da)mi. TUZATILGAN model matni **NEW** deydi → helper'da boshlang'ich statusni parametrlashtiramiz (`initialStatus: NEW`), post'ga darhol biriktirmaymiz, `dispatchOrderForApproval` esa **chaqirilmaydi** (CRM allaqachon tasdiqlagan manba — guruh-tasdiq shart emas).

### 4.2 Tenancy: per-market (M7)

`bitrix_integration` — `market_id` FK + `slug` unique (`external_integration` uslubi). Har market o'z portaliga ulanadi. Queue va link jadvallari `integration_id` FK orqali generic (kelajakda singletonga ham moslashuvchan).

### 4.3 Yangi entitylar (4 ta)

Barchasi `BaseEntity` (uuid `id` + bigint `created_at/updated_at`) ni kengaytiradi (webhook-log bundan mustasno — LDG naqshi).

**1. `bitrix_integration`** (`src/core/entity/bitrix-integration.entity.ts`) — per-market config:

| Ustun | Tur | Izoh |
|---|---|---|
| `market_id` | uuid FK → UserEntity | role=MARKET, onDelete CASCADE |
| `slug` | varchar unique | discovery kaliti |
| `portal_domain` | varchar | mymarket.bitrix24.com |
| `webhook_user_id` | varchar | inbound webhook URL segmenti |
| `webhook_code` | varchar (**shifrlangan**) | REST chaqiruv krediti |
| `outbound_app_token` | varchar (**shifrlangan**) | kelgan event autentligi (INTAKE) |
| `member_id` / `expected_domain` | varchar | event qo'shimcha verify |
| `category_id` | int (default 0) | Deal voronkasi |
| **`intake_stage_id`** | varchar | **"dostavkaga chiqarildi" — INTAKE trigger** (M2) |
| `stage_mapping` | jsonb | Order_status → STAGE_ID (feedback, §5.2) |
| **`district_strategy`** | varchar enum | `soato_field` \| `name_match` \| `default` (§5.3) |
| **`district_soato_field`** | varchar (nullable) | CRM'dagi SOATO maydoni (UF_CRM_SOATO) |
| **`district_name_field`** | varchar (nullable) | CRM tuman nomi maydoni |
| **`default_district_id`** | uuid (nullable) | fallback tuman (§5.3) |
| `field_map` | jsonb | CRM maydon → order maydon (inbound intake, §5.1) |
| `uf_order_id_field` | varchar (nullable) | UF_CRM_PCS_ORDER_ID (Bosqich 3) |
| `default_assigned_by_id` | int | Bitrix mas'ul (Bosqich 3 create) |
| `is_active` | boolean default false | **master kill-switch** |
| **`inbound_enabled`** | boolean default true | INTAKE oqimi (ASOSIY) |
| `outbound_enabled` | boolean default true | FEEDBACK oqimi |
| `auto_retry_enabled` | boolean default true | feedback cron toggle |
| `outbound_create_enabled` | boolean default false | Bosqich 3 (PCS→CRM deal yaratish) |

**2. `bitrix_order_link`** (`src/core/entity/bitrix-order-link.entity.ts`) — CRM yozuv ↔ PCS buyurtma bog'lam (idempotentlik yadrosi, ikki yo'nalishga ham xizmat qiladi):

| Ustun | Tur | Izoh |
|---|---|---|
| `order_id` | uuid (**unique**, indexed) | PCS buyurtma |
| `integration_id` | uuid FK | qaysi portal |
| `crm_entity_type` | varchar | `'deal'` \| `'lead'` |
| `crm_entity_id` | bigint (`bigintTransformer` — **null-safe**) | Bitrix Deal/Lead ID |
| `crm_contact_id` | bigint (null-safe) | Bitrix Contact ID |
| `intake_at` | bigint | buyurtma qachon CRM'dan olindi |
| `last_stage_id` | varchar | oxirgi yuborilgan feedback STAGE |
| `last_feedback_at` | bigint (nullable) | |
| `feedback_attempts` | int default 0 | |
| `last_error` | text (nullable) | |

> **UNIQUE constraint:** `(integration_id, crm_entity_type, crm_entity_id)` — **idempotentlik yadrosi** (M3). Bir CRM deal uchun ikkinchi buyurtma yaratishga urinish DB-darajasida bloklanadi (webhook race'ida ham). Alohida `order_id` ham unique (bir buyurtma bir link).
> **bigint tuzog'i:** `crm_entity_id`/`crm_contact_id` nullable → **`bigintTransformer`** (null→null), `bigintTransformerNonNull` EMAS (u null→0 yozib filtrni buzadi — memory'dagi mismatch_at bug'i).

**3. `bitrix_sync_queue`** (`src/core/entity/bitrix-sync-queue.entity.ts`) — outbound feedback durable queue (`integration_sync_queue` nusxasi):

| Ustun | Tur | Izoh |
|---|---|---|
| `integration_id` | uuid | |
| `order_id` | uuid | |
| `event` | varchar | 'received'\|'on_road'\|'waiting'\|'sold'\|'canceled'\|'rollback'\|'closed' |
| `target_stage_id` | varchar | mapping natijasi (enqueue vaqtida hisoblangan) |
| `status` | varchar | pending\|processing\|failed |
| `attempts` / `max_attempts` | int / int (default 3) | |
| `next_retry_at` | bigint (nullable, **indexed**) | transient vs permanent diskriminator |
| `processing_started_at` | bigint | stale-reclaim |
| `last_error` / `last_response` | text / jsonb | |
| `synced_at` | bigint (nullable) | |

**4. `bitrix_webhook_log`** (`src/core/entity/bitrix-webhook-log.entity.ts`) — INBOUND event dedup + audit (`ldg_webhook_log` naqshi, `BaseEntity` EMAS):

| Ustun | Tur | Izoh |
|---|---|---|
| `delivery_key` | varchar **PRIMARY KEY** | dedup yadrosi (Bitrix: `event_handler_id`+`ts`+`ID` hash, yoki amoCRM delivery id) |
| `integration_id` | uuid | |
| `event_type` | varchar | ONCRMDEALUPDATE... |
| `crm_entity_id` | bigint (nullable) | payload'dagi ID |
| `token_valid` | boolean | |
| `outcome` | varchar | intake_created\|skipped_not_stage\|skipped_dup\|invalid_token\|failed |
| `created_order_id` | uuid (nullable) | yaratilgan buyurtma |
| `raw_payload` | jsonb | |
| `received_at` / `processed_at` | bigint | |

### 4.4 Migratsiyalar

House-style: `src/migrations/<timestamp>-<PascalName>.ts`, timestamp joriy eng yuqoridan (`1748400000000-LdgMismatchAtZeroFix.ts`) monoton (+1e11). Idempotent raw SQL (`IF NOT EXISTS`), real `down()`, `synchronize:false`.

```
1748500000000-BitrixIntegration.ts    → bitrix_integration
1748600000000-BitrixOrderLink.ts      → bitrix_order_link + UNIQUE(integration_id,crm_entity_type,crm_entity_id) + order_id unique
1748700000000-BitrixWebhookLog.ts     → bitrix_webhook_log (delivery_key PK)
1748800000000-BitrixSyncQueue.ts      → bitrix_sync_queue + next_retry_at indeks
```
`autoLoadEntities:true` — DataSource ro'yxatini tahrirlash shart emas.

### 4.5 Fayl/papka rejasi (ldg-cargo mirror, ikki oqimli)

```
src/api/bitrix-crm/
├─ bitrix-crm.module.ts           # wiring
├─ bitrix-api.service.ts          # TRANSPORT: axios, inbound-webhook URL, envelope unwrap,
│                                 #   429/503 backoff, batch, serialized write-queue
│   ─────────── INBOUND (ASOSIY) ───────────
├─ bitrix-webhook.controller.ts   # POST /bitrix/webhook (auth guard YO'Q, token verify)
├─ bitrix-intake.service.ts       # INBOUND domain: token verify, dedup, deal.get + contact + productrows,
│                                 #   STAGE==intake gate, idempotency, MAP → createOneCrmOrder → link
├─ bitrix-mapper.service.ts       # CRM yozuv → order maydonlari (field_map, tuman-aniqlash §5.3)
│   ─────────── OUTBOUND (IKKILAMCHI) ───────
├─ bitrix-feedback.service.ts     # QUEUE: enqueue(orderId,event) + worker (claim/send/retry/stale)
├─ bitrix-deal.service.ts         # (Bosqich 3) OUTBOUND CREATE: order→Deal DTO (ixtiyoriy)
│   ─────────── UMUMIY ─────────────────────
├─ bitrix-config.service.ts       # CONFIG CRUD: getOrCreate/update, secret mask, getSafe
├─ bitrix-admin.service.ts        # OPS: health, listlar, redispatch, reprocess, @Cron loop
├─ bitrix-config.controller.ts    # GET/PATCH /bitrix/config  (JWT + ADMIN)
├─ bitrix-admin.controller.ts     # /bitrix/admin/*          (JWT + ADMIN)
├─ dto/
│   ├─ bitrix-webhook.dto.ts      # event envelope + HEADERS/EVENTS const
│   ├─ bitrix-deal.dto.ts         # deal.get/productrows/contact javob shakllari
│   └─ bitrix-create-deal.dto.ts  # (Bosqich 3)
└─ utils/
    ├─ bitrix-token.util.ts       # application_token timing-safe verify
    ├─ bitrix-stage.mapper.ts     # Order_status → STAGE_ID (+ module-load invariant)
    └─ bitrix-payload.util.ts     # form-urlencoded/JSON payloaddan ID chiqarish (defensive)
```
Entitylar: `src/core/entity/bitrix-*.entity.ts`.

### 4.6 Module wiring

```ts
// bitrix-crm.module.ts (ldg-cargo.module.ts shakli)
imports: [
  TypeOrmModule.forFeature([BitrixIntegrationEntity, BitrixOrderLinkEntity,
                            BitrixSyncQueueEntity, BitrixWebhookLogEntity,
                            OrderEntity, UserEntity, DistrictEntity, PostEntity]),
  HttpModule.register({ timeout: 30000, maxRedirects: 0 }),
  forwardRef(() => OrderModule),   // intake → OrderService.createOneCrmOrder; feedback hook <- OrderService
],
controllers: [BitrixWebhookController, BitrixConfigController, BitrixAdminController],
providers:   [BitrixApiService, BitrixIntakeService, BitrixMapperService,
              BitrixFeedbackService, BitrixConfigService, BitrixAdminService,
              /*B3:*/ BitrixDealService],
exports:     [BitrixFeedbackService, BitrixConfigService],  // OrderModule feedback uchun inject qiladi
```
`app.module.ts` `imports`ga `BitrixCrmModule`. `ActivityLogModule` `@Global`. `ScheduleModule.forRoot()` global.

**Raw body wiring** (`app.service.ts`, LDG naqshi, `express.json()`dan OLDIN):
```ts
app.use('/api/v1/bitrix/webhook', express.urlencoded({ extended: true, limit: '5mb' }));
// Bitrix outbound webhook ko'pincha form-urlencoded (data[FIELDS][ID]=...) yuboradi (gotcha).
// application_token verify uchun raw kerak bo'lsa: express.raw + qo'lda parse.
```

---

## 5. Field & status mapping (IKKI YO'NALISH)

### 5.1 (a) CRM → PCS order (INBOUND INTAKE — ASOSIY)

`crm.deal.get` + `crm.deal.contact.items.get`→`crm.contact.get` + `crm.deal.productrows.get` natijalari → PCS buyurtma maydonlari (`createOneCrmOrder` helper qabul qiladigan xom obyekt). `field_map` jsonb per-market moslashtiradi.

**Buyurtma yadrosi (OrderEntity):**

| PCS maydon | CRM manba (Bitrix) | Majburiy? | Fallback |
|---|---|---|---|
| `user_id` (market) | `integration.market_id` | ✅ | integratsiyadan |
| `customer_id` | telefon bo'yicha **upsert** (helper ichida) | ✅ | `unknown_<ts>` telefon |
| `total_price` | `deal.OPPORTUNITY` (+ delivery field agar bor) | — | `0` (§12 xavf) |
| `product_quantity` | `productrows` yig'indisi (`SUM(QUANTITY)`) | — | `1` |
| `district_id` | **§5.3 tuman-aniqlash** | ✅ | strategiyaga qarab |
| `address` | `deal.UF_CRM_ADDRESS` / contact address | — | contactdan |
| `where_deliver` | konstanta/field | — | `market.default_tariff` |
| `status` | **`NEW`** (M2; guruh-tasdiqsiz) | ✅ | qattiq NEW |
| `comment` | `deal.COMMENTS` + "CRM deal #<id>" | — | |
| `operator` | `'bitrix_<slug>'` (manba belgisi) | ✅ | |
| `external_id` | `deal.ID` (string) | — | link yadro |
| `qr_code_token` | generatsiya (`generateCustomToken()`) | ✅ | |

**Mijoz (UserEntity role=CUSTOMER):**

| PCS maydon | CRM manba |
|---|---|
| `name` | `contact.NAME` + `contact.LAST_NAME` (yoki `deal.TITLE` fallback `'CRM mijoz'`) |
| `phone_number` | `contact.PHONE[0].VALUE` — normalizatsiya (`+998...`) |
| `extra_number` | `contact.PHONE[1].VALUE` |
| `district_id` / `address` | yuqoridagi bilan bir xil |

**Mahsulotlar — qaror kerak (§12 Q4):** `receiveExternalOrders` **order-item YARATMAYDI** (faqat `product_quantity` soni). CRM esa `crm.deal.productrows.get` bilan aniq mahsulot qatorlarini beradi (`PRODUCT_NAME`, `QUANTITY`, `PRICE`). Ikki variant:
- **A (tez, hozirgi tashqi konvensiya):** faqat `product_quantity` = qatorlar yig'indisi; mahsulot nomlari `comment`ga matn sifatida. Item YARATILMAYDI.
- **B (to'liq):** CRM `PRODUCT_ID`/`PRODUCT_NAME` ni PCS `product`ga mapping qilib `OrderItemEntity` yaratish. Bu marketning mahsulot katalogi bilan moslashtirishni talab qiladi (IDOR himoyasi `createOrder:445` kabi). Murakkabroq.
> **Tavsiya:** Bosqich 1'da **Variant A** (matn + quantity). Variant B — biznes talab qilsa alohida.

**amoCRM manbalari (agar):** `GET /api/v4/leads/{id}?with=contacts` → `lead.price`→`total_price`, `_embedded.contacts[0]`→mijoz, custom_fields → manzil/tuman. Mahsulotlar amoCRM'da odatda custom field/catalog — mapping shunga qarab.

### 5.2 (b) Order_status → Bitrix STAGE_ID (OUTBOUND FEEDBACK — 6 bosqich)

PCS enum (`common/enums:46`) → Bitrix stage. STAGE_ID hardcode QILINMAYDI (`crm.status.list` bilan aniqlanib `stage_mapping` jsonb'ga yoziladi; default voronkada `"WON"`, boshqa voronkada `"C1:WON"`). Default taklif:

| PCS status | Ma'no | STAGE_ID (default voronka) | Terminal? |
|---|---|---|---|
| `NEW` | Intake qilindi (PCS'da yangi) | — (yubormaslik — CRM allaqachon intake bosqichida) | yo'q |
| `RECEIVED` | Qabul qilindi | `PREPARATION` | yo'q |
| `ON_THE_ROAD` | Yo'lda | `EXECUTING` | yo'q |
| `WAITING` | Kuryerda | `FINAL_INVOICE` | yo'q |
| `SOLD`/`PAID`/`PARTLY_PAID` | Sotildi | `WON` | ✅ terminal |
| `CANCELLED`/`CANCELLED_SENT` | Bekor | `LOSE` | ✅ terminal |
| `CLOSED` | Yopildi (skanerdan) | `LOSE` (izoh) | ✅ terminal |

> **Nozik masala (echo-guard bilan bog'liq):** `intake_stage_id` (masalan `PREPARATION`) va feedback RECEIVED→`PREPARATION` **bir xil** bo'lib qolmasligi kerak, aks holda feedback echo'si intake trigger'iga o'xshab ko'rinadi. Yechim: intake bosqichi va feedback bosqichlari **ajratilgan** bo'lsin (masalan intake = maxsus "Dostavkaga tayyor" bosqichi, feedback boshqa bosqichlarga yozadi), YOKI intake gate faqat "link yo'q" shartiga tayanadi (§8.4 — asosiy himoya link idempotentligi). `bitrix-stage.mapper.ts` module-load invariant (ldg naqshi) noto'g'ri mapping runtime'ga chiqmasligini kafolatlaydi.

### 5.3 SOATO/TUMAN aniqlash strategiyasi (KRITIK — M9)

**Muammo:** PCS SOATO tuman kodlari (`DistrictEntity.sato_code`, unique, indexed) bo'yicha regionga marshrutlaydi. CRM'da SOATO bo'lmasligi mumkin. `receiveExternalOrders`ning hozirgi fallback'i — **`allDistricts[0]` (tasodifiy birinchi tuman)** (`order.service.ts:5591, :5746`) — bu **xavfli**: buyurtma noto'g'ri regionga tushishi mumkin.

**Yechim: per-market `district_strategy` (uch rejim):**

```
                    CRM deal keldi
                         │
          ┌──────────────┼──────────────────┐
          ▼              ▼                   ▼
   'soato_field'    'name_match'        'default'
   CRM'da UF_SOATO   CRM tuman NOMI     har doim market
   maydoni bor       keladi             default tumaniga
          │              │                   │
          ▼              ▼                   ▼
  districtBySatoCode  sato-matcher       default_district_id
  .get(code)          (matchDistricts,   (config'da belgilangan)
  (aniq/partial       district.service         │
   moslik)            :24 fuzzy nom)           │
          │              │                     │
          ▼              ▼                     ▼
      topildi?       topildi?              ishlatildi
       │    │          │    │
      ha    yo'q       ha    yo'q
       │    │          │    │
       ▼    ▼          ▼    ▼
    ishlat  ═══════════════════►  ┌─────────────────────────────┐
                                   │ TUMAN ANIQLANMADI            │
                                   │ → allDistricts[0] EMAS!      │
                                   │ → "district_unresolved" flag │
                                   │   + buyurtma NEW'da qoladi   │
                                   │ + operator qo'lda biriktiradi│
                                   │ + Telegram admin xabari      │
                                   └─────────────────────────────┘
```

| Strategiya | Qachon | Mexanizm | Aniqlanmasa |
|---|---|---|---|
| `soato_field` | CRM'da SOATO custom field bor | `districtBySatoCode.get(code)` + partial (`endsWith`/`includes`) — `receiveExternalOrders:5717-5752` mantig'i | flag + qo'lda |
| `name_match` | CRM tuman **nomini** yuboradi | `sato-matcher` util (`district.service.ts:24 matchDistricts`) — fuzzy nom→SATO | flag + qo'lda |
| `default` | CRM manzil strukturasi yo'q/ishonchsiz | `integration.default_district_id` (config'da market belgilagan) | — (har doim topiladi) |

> **Muhim (MEMORY: tuman avto-routing ataylab o'chirilgan):** tuman aniqlanmasa **`allDistricts[0]`ga tashlanMAYDI**. Buning o'rniga buyurtma `district_unresolved=true` flag bilan `NEW`'da qoladi va operator PCS'da qo'lda tuman biriktiradi. Bu MEMORY qaroriga mos: routing faqat operatorning qo'lda kuryer tanlashi bo'yicha. `default` strategiyasi esa market ataylab bitta tumanga (masalan o'z shahri) ishlaganida ishlatiladi.

---

## 6. API chaqiruvlari

Barcha PCS→Bitrix chaqiruvlari: `POST https://<portal>/rest/<user_id>/<code>/<method>.json`, JSON body, javob `{result, time}` yoki `{error, error_description}`.

### 6.1 INBOUND intake — to'liq yozuvni olish (ASOSIY)

Bitrix outbound webhook faqat **deal ID** beradi (gotcha: `data.FIELDS.ID`, ko'pincha form-urlencoded `data[FIELDS][ID]=759`). To'liq yozuv uchun 3 chaqiruv — **bitta `batch`da** birlashtirish mumkin (1 bucket-tick):

```json
POST .../batch.json
{
  "halt": 0,
  "cmd": {
    "deal":     "crm.deal.get?id=759",
    "contacts": "crm.deal.contact.items.get?id=759",
    "products": "crm.deal.productrows.get?id=759",
    "contact":  "crm.contact.get?id=$result[contacts][0][CONTACT_ID]"
  }
}
```

**`crm.deal.get` javob (namuna):**
```json
{ "result": {
    "ID": "759", "TITLE": "Buyurtma — Ali",
    "STAGE_ID": "PREPARATION", "CATEGORY_ID": "0",
    "OPPORTUNITY": "250000", "CURRENCY_ID": "UZS",
    "COMMENTS": "Manzil: Chilonzor 12-45",
    "UF_CRM_SOATO": "1726269",           // (agar sozlangan bo'lsa) SOATO
    "CONTACT_ID": "84"
} }
```
**`crm.deal.productrows.get` javob:**
```json
{ "result": [
    { "PRODUCT_NAME": "Krem X", "QUANTITY": "2", "PRICE": "100000" },
    { "PRODUCT_NAME": "Krem Y", "QUANTITY": "1", "PRICE": "50000" }
] }
```
**`crm.contact.get` javob:**
```json
{ "result": {
    "ID": "84", "NAME": "Ali", "LAST_NAME": "Valiyev",
    "PHONE": [ { "VALUE": "+998901234567", "VALUE_TYPE": "MOBILE" } ]
} }
```

**amoCRM ekvivalenti (agar):**
```
GET /api/v4/leads/759?with=contacts   (Authorization: Bearer <access_token>)
→ lead.price, lead.status_id, lead.custom_fields_values (manzil/tuman/SOATO),
  _embedded.contacts[0] → GET /api/v4/contacts/{id} (telefon/ism)
```

### 6.2 OUTBOUND feedback — status/bosqich yangilash (IKKILAMCHI)

`bitrix_order_link.crm_entity_id` (intake'da saqlangan) bo'yicha to'g'ridan:
```json
POST .../crm.deal.update.json
{ "id": 759, "fields": { "STAGE_ID": "WON" },
  "params": { "REGISTER_SONET_EVENT": "Y", "REGISTER_HISTORY_EVENT": "Y" } }
```
Javob: `{ "result": true, "time": {...} }` (record echo QILMAYDI). Xato: `{error, error_description}`.

**amoCRM:** `PATCH /api/v4/leads/759 { "status_id": <won>, "pipeline_id": <p> }`.

### 6.3 Voronka bosqichlarini aniqlash (sozlash paytida)

```json
POST .../crm.status.list.json
{ "filter": { "ENTITY_ID": "DEAL_STAGE" } }         // default voronka
// yoki { "ENTITY_ID": "DEAL_STAGE_<categoryId>" }  // maxsus voronka
```
Natija: `{ID, STATUS_ID, NAME, SORT}` qatorlari → admin `intake_stage_id` va `stage_mapping`ni shu ro'yxatdan tanlaydi.

### 6.4 (Bosqich 3, ixtiyoriy) PCS→CRM deal yaratish

`batch`da contact dedup + deal.add + link (oldingi rejadagi §6.1 mantig'i saqlanadi — faqat endi bu **ixtiyoriy** oxirgi bosqich):
```json
{ "halt": 1, "cmd": {
    "find_dup":   "crm.duplicate.findbycomm?type=PHONE&entity_type=CONTACT&values[]=%2B998...",
    "add_contact":"crm.contact.add?fields[NAME]=Ali&fields[PHONE][0][VALUE]=%2B998...",
    "add_deal":   "crm.deal.add?fields[TITLE]=...&fields[STAGE_ID]=NEW&fields[CONTACT_IDS][0]=$result[add_contact]&fields[UF_CRM_PCS_ORDER_ID]=<uuid>"
} }
```

---

## 7. Hodisa nuqtalari (kod)

### 7.1 INBOUND intake — buyurtma bu yerda YARATILADI (webhook orqali, hook EMAS)

Muhim: intake buyurtmani **PCS lifecycle hook'i orqali emas**, **webhook orqali** yaratadi. Ya'ni yangi kirish nuqtasi:

```
POST /api/v1/bitrix/webhook  (BitrixWebhookController — auth guard YO'Q)
  → BitrixIntakeService.process(rawBody, headers)
      1. application_token verify (bitrix-token.util, timing-safe)  §9
      2. payloaddan crm_entity_id chiqarish (bitrix-payload.util — form-urlencoded/JSON)
      3. delivery_key dedup (bitrix_webhook_log PK)  §8.1
      4. batch: deal.get + contact + productrows  §6.1
      5. STAGE_ID === integration.intake_stage_id ?  yo'q → outcome=skipped_not_stage, 200
      6. bitrix_order_link mavjud? (crm_entity_id bo'yicha)  bor → skipped_dup, 200  §8.2
      7. BitrixMapperService.toOrderInput(deal, contact, products)  §5.1
      8. tuman-aniqlash (district_strategy)  §5.3
      9. OrderService.createOneCrmOrder(orderInput, ctx)  → NEW buyurtma
     10. bitrix_order_link INSERT (crm_id ↔ order_id, UNIQUE)  §8.2
     11. saveLog(outcome=intake_created, created_order_id), 200
```

`OrderService.createOneCrmOrder` = `receiveExternalOrders:5660-5872` blokidan ajratilgan `createOneExternalOrder` helper (§4.1 Variant B), `initialStatus=NEW` parametri bilan, `dispatchOrderForApproval` **chaqirmasdan**.

### 7.2 OUTBOUND feedback — PCS lifecycle o'tishlarida enqueue (IKKILAMCHI)

O'rnatilgan konvensiya: **`commitTransaction`dan keyin, fire-and-forget (await EMAS)**, `activityLog.log(...)` yonida. `BitrixFeedbackService.enqueue(orderId, event)` `bitrix_order_link` mavjud bo'lsagina ish qiladi (CRM'dan kelmagan buyurtma uchun jim skip — link yo'q).

| PCS hodisa | Hook (commit joyi, order-lifecycle xaritasidan) | enqueue | Bosqich |
|---|---|---|---|
| NEW→RECEIVED | `receiveNewOrders :1853`, `receiveWithScaner :1974` | `enqueue(id,'received')` | 2 |
| RECEIVED→ON_THE_ROAD | `post.service.ts sendPost :929` | `enqueue(id,'on_road')` | 2 |
| ON_THE_ROAD→WAITING | `post.service.ts receivePost*` (`:1059/:1159/:1224/:1329`) | `enqueue(id,'waiting')` | 2 |
| **Sotildi** | `sellOrder :2754` (yonida `:2781`) | `enqueue(id,'sold')` | **2** |
| Qisman sotildi | `partlySold :3532` (`:3557`) | `enqueue(id,'sold')` | 2 |
| **Bekor** | `cancelOrder :3025` (`:3048`) | `enqueue(id,'canceled')` | **2** |
| Rollback | `rollbackOrderToWaiting :4099` (`:4120`) | `enqueue(id,'rollback')` | 2 |
| CANCELLED_SENT→CLOSED | `receiveWithScaner :1907` (`:1910`) | `enqueue(id,'closed')` | 2 |

> **`queueStatusSync` gate'ni takrorlamaymiz:** mavjud `integrationSyncService.queueStatusSync` `order.external_id` + `operator='external_'` talab qiladi (`integration-sync.service.ts:78-97`). CRM buyurtmalari `operator='bitrix_<slug>'` va `external_id`=deal ID bilan keladi, LEKIN feedback logikasini shunga bog'lamaymiz — `BitrixFeedbackService.enqueue` **`bitrix_order_link` bo'yicha** integratsiyani topadi (`order_id`→link→integration_id). Bu ancha ishonchli: hatto CRM buyurtmasi bo'lmagan (bot/AI) buyurtma uchun ham link yo'q → jim skip, xato yo'q.

Ulanish: `OrderService` konstruktoriga `BitrixFeedbackService` inject (`:123` yonida, `integrationSyncService` turgan joy). `forwardRef` sikl uchun.

---

## 8. Ishonchlilik

### 8.1 Intake idempotentligi — 1-qatlam: webhook dedup

`ONCRMDEALUPDATE` deal'ning har o'zgarishida otadi + Bitrix online event drop bo'lsa qayta yuborilmaydi (offline event bo'lsa qayta keladi) → dedup zarur.

- **`delivery_key` PK** (`bitrix_webhook_log`): Bitrix event payloadidan barqaror kalit quriladi (`event_handler_id` + `ts` + `data.FIELDS.ID` hash). Bir xil delivery qayta kelsa → unique violation yumshoq ishlanadi, `200 "Already processed"` (LDG naqshi).
- Bu **retry-storm** va **takroriy event** himoyasi.

### 8.2 Intake idempotentligi — 2-qatlam: bir CRM yozuvi = bir buyurtma (M3 yadrosi)

Bu ASOSIY kafolat. Ikkita himoya:
```
┌─ APP-DARAJA: intake oldidan bitrix_order_link SELECT (crm_entity_id bo'yicha) ─┐
│   link bor → skip (buyurtma allaqachon yaratilgan)                            │
└───────────────────────────────────────────────────────────────────────────────┘
┌─ DB-DARAJA: UNIQUE(integration_id, crm_entity_type, crm_entity_id) ────────────┐
│   parallel/race webhook ikkinchi INSERT'da unique violation → yumshoq skip     │
│   (buyurtma yaratish + link INSERT bitta tranzaksiyada; violation → rollback)  │
└───────────────────────────────────────────────────────────────────────────────┘
```
> Bu `receiveExternalOrders`ning hozirgi app-only dedup'idan (`external_id`, faqat aktiv statuslar — `:5613`) **kuchliroq**: DB unique constraint webhook race'ini ham to'sadi. Buyurtma yaratish va link INSERT **bitta `queryRunner` tranzaksiyasida** bo'lishi shart (helper shuni ta'minlaydi) — aks holda buyurtma yaratilib link yaratilmay qolishi mumkin.

### 8.3 Outbound feedback — queue + retry (IKKILAMCHI)

`integration-sync.service.ts` naqshi, `bitrix_sync_queue` ustida:
```
enqueue(orderId, event):
   1. bitrix_order_link topish (order_id orqali) — yo'q bo'lsa jim qaytish (CRM buyurtmasi emas)
   2. integration is_active && outbound_enabled tekshirish
   3. stage_mapping[event] → target_stage_id hisoblash (mapper)
   4. bitrix_sync_queue INSERT (status=pending, attempts=0, max=3)
   5. triggerWorker()

worker (@Cron('*/30 * * * * *') + on-demand, isProcessing guard):
   reclaimStaleProcessing (processing_started_at > 10min)
   claimJobs(BATCH=10): FOR UPDATE SKIP LOCKED, pending OR (failed && next_retry_at<=now)
   har biri: crm.deal.update(link.crm_entity_id, {STAGE_ID: target_stage_id})
      success: synced_at, link.last_stage_id
      429/503: backoff; 401/config: permanent log; boshqa: retry
```

| Qatlam | Strategiya |
|---|---|
| Queue | `RETRY_DELAYS=[60s,5min,15min]`, `max=3`. Transient: `next_retry_at=now+delay`. Permanent: `attempts>=max` → `next_retry_at=null` (admin qo'lda). |
| HTTP | Faqat `[429,500,502,503,504]`+tarmoq retry (ldg-api naqshi). Business `{error}` retry EMAS. |
| Rate-limit | Serialized write-queue (`enqueueWrite`, 500ms gap → ≤2/s), `batch`, 429→`operating_reset_at`gacha, 503→eksponensial. **480s qat'iy limitga kod yozILMAYDI** (verify: illyustrativ). |

### 8.4 Echo-loop himoyasi (feedback → intake sikl oldini)

PCS'ning `crm.deal.update` chaqiruvi Bitrix'da yana `ONCRMDEALUPDATE` otadi → intake webhook uni ko'radi. Sikl **YO'Q**, chunki intake ikki qattiq gate bilan himoyalangan:
```
1. STAGE gate: feedback WON/LOSE/PREPARATION yozadi → STAGE ≠ intake_stage_id → skip
2. Link gate: bu deal uchun bitrix_order_link ALLAQACHON bor → skip (M3)
```
Ikkinchi gate (link) yetarli va ishonchli: intake faqat **link yo'q** bo'lganda buyurtma yaratadi; feedback esa doim mavjud link'li buyurtma uchun ishlaydi. Shuning uchun feedback echo'si hech qachon yangi buyurtma tug'dirmaydi. (Bu M4'ning "intakedan keyin CRM→PCS sync yo'q" qaroriga to'liq mos — biz echo'ni shunchaki e'tiborsiz qoldiramiz.)

### 8.5 Kill-switch iyerarxiyasi (ldg naqshi)

```
is_active (MASTER — katta qizil tugma)
   ├─ inbound_enabled        → intake webhook buyurtma yaratishi (ASOSIY)
   ├─ outbound_enabled       → feedback deal.update
   ├─ auto_retry_enabled     → feedback cron retry
   └─ outbound_create_enabled→ Bosqich 3 (PCS→CRM deal)
```
`is_active=false` → intake webhook faqat log yozadi (buyurtma yaratmaydi), feedback enqueue jim skip. Portal yiqilsa asosiy PCS oqimi buzilmaydi (feedback fire-and-forget; intake `last_error`/webhook_log'ga tushadi).

---

## 9. Xavfsizlik

### 9.1 Secret saqlash va maskalash

| Chora | Amal |
|---|---|
| **Shifrlash (rest)** | `webhook_code`, `outbound_app_token` (+amoCRM `access_token`/`refresh_token`) — AES-256-GCM `ValueTransformer`. Master kalit env `SECRETS_ENC_KEY`. Kodbaza transformer'lardan foydalanadi (`bigint.transformer.ts`) — shu slotga. **Plaintext varchar QILMANG** (LDG interim holatidan yaxshiroq). |
| **Activity-log maskalash** | `BITRIX_SECRET_FIELDS = {webhook_code, outbound_app_token, access_token, refresh_token}`. Update'da faqat `masked_fields:[...]` yoziladi (`ldg-config.service.ts` naqshi). |
| **Read-back redaction** | `getSafe()` faqat `webhook_code_set`, `app_token_set` booleanlarini qaytaradi. |

### 9.2 INBOUND webhook autentligini tekshirish (ASOSIY — intake xavfsizligi)

Intake webhook auth'siz endpoint (JWT yo'q). Autentlik = `application_token`:
```
POST /bitrix/webhook  (auth guard YO'Q, @HttpCode(200), @ApiExcludeEndpoint)
   1. payload.auth.application_token === saqlangan outbound_app_token  (timingSafeEqual + length pre-check)
   2. payload.auth.member_id / auth.domain === saqlangan expected_domain/member_id
   3. mos kelmasa → outcome=invalid_token log, 401, buyurtma YARATILMAYDI
```
- **Timing-safe** solishtirish (`bitrix-token.util`, LDG `safeEqualHex` naqshi).
- **Form-urlencoded parse:** Bitrix outbound webhook ko'pincha `application/x-www-form-urlencoded` (`data[FIELDS][ID]=...`, `auth[application_token]=...`) yuboradi — JSON deb faraz QILMANG (gotcha). `express.urlencoded` + bracket-key parse.
- **Response-kod intizomi:** header yo'q → 400; token noto'g'ri → 401; **business/processing xato → 200** (retry-storm oldini; xatolar `bitrix_webhook_log`dan qo'lda reprocess).
- **IP allowlist (tavsiya, hozir yo'q):** Bitrix egress IP'lari barqaror bo'lsa allowlist qo'shish (trust proxy = 'loopback' → resolved real IP bilan solishtirish).

> **Bitrix ishonchliligi (research):** online event server yiqilsa **qayta yuborilmaydi**. Intake yo'qotmasligi kerak bo'lsa **OFFLINE event** (`event_type:"offline"`, admin huquqi) — Bitrix durable navbatga qo'yadi, biz poll+ack qilamiz. Intake uchun offline event **tavsiya etiladi** (Bosqich 1 hardening) — chunki buyurtma yo'qolishi = biznes yo'qotishi. Reconcile @Cron (§10 B2) qo'shimcha safety-net.

### 9.3 amoCRM inbound farqi (agar)

amoCRM webhook `application_token` bermaydi. Autentlik = (a) **subdomain tekshiruvi** (payload `account[subdomain]` saqlangan bilan) + (b) **hard-to-guess handler URL** (secret path segment). HMAC yo'q → URL maxfiyligi va subdomain match asosiy himoya. Bu Bitrix'dan zaifroq → amoCRM uchun IP allowlist yanada muhim.

### 9.4 Least-privilege
- Inbound webhook scope: **faqat `crm`**.
- Webhook yaratgan Bitrix user — cheklangan huquqli "integration" foydalanuvchi.
- PCS controller'lar: config/admin — JWT + `SUPERADMIN/ADMIN`. Webhook controller — guard yo'q, token verify.
- **Intake actor:** buyurtma system-actor sifatida yaratiladi (`user: <bitrix service-user id>` yoki `null`), `metadata:{source:'bitrix', crm_deal_id}` — request-context bo'sh (webhook, IP fabrikatsiya QILINMAYDI; infra-crosscut §2).

---

## 10. Bosqichma-bosqich joriy etish

```
Bosqich 0 ──► Bosqich 1 ──► Bosqich 2 ──► Bosqich 3
 poydevor     INBOUND        OUTBOUND       ixtiyoriy
 (umumiy)     INTAKE         FEEDBACK       PCS→CRM
              (CRM→buyurtma)  (status→CRM)   deal yaratish
              ═══ASOSIY═══
```

### Bosqich 0 — Umumiy poydevor
**Deliverable:**
- Entitylar: `bitrix_integration`, `bitrix_order_link`, `bitrix_webhook_log`, `bitrix_sync_queue` + migratsiyalar.
- `BitrixApiService` (inbound-webhook URL, `crm.deal.get`/`batch`/`crm.deal.update`, backoff, write-queue, envelope unwrap).
- `BitrixConfigService` + config controller (GET/PATCH, secret mask, `crm.status.list` bilan stage discovery yordamchi).
- Kill-switch `is_active` + toggle ustunlar.
- `bitrix-stage.mapper.ts` + module-load invariant.
- Raw/urlencoded body wiring (`app.service.ts`).

### Bosqich 1 — INBOUND INTAKE (ASOSIY — CRM'dan buyurtma yaratish)
**Maqsad:** CRM-operator deal'ni "dostavkaga chiqarildi" bosqichiga o'tkazsa → PCS'da NEW buyurtma paydo bo'lsin.
**Deliverable:**
- `BitrixWebhookController` (auth guard yo'q, token verify, form-urlencoded parse).
- `BitrixIntakeService.process` (token verify → dedup → batch deal.get+contact+products → STAGE gate → link gate → map → create → link).
- `BitrixMapperService` (§5.1 field_map) + **tuman-aniqlash 3 strategiya** (§5.3).
- `OrderService.createOneCrmOrder` — `receiveExternalOrders:5660-5872` refaktori (helper, `initialStatus=NEW`, guruh-tasdiqsiz).
- DB idempotentlik: `bitrix_order_link` UNIQUE + tranzaksion create+link.
- (Hardening) OFFLINE event bind + poll/ack (intake yo'qotmaslik).
- Admin: intake health/checklist, webhook-log ro'yxati + reprocess, "tuman aniqlanmagan" buyurtmalar ro'yxati.

### Bosqich 2 — OUTBOUND FEEDBACK (status → CRM bosqichi)
**Maqsad:** yetkazish holati CRM-operatoriga CRM ichida ko'rinsin.
**Deliverable:**
- `BitrixFeedbackService.enqueue` + worker (claim/retry/stale — `integration-sync` naqshi).
- 8 ta lifecycle hook (§7.2): received/on_road/waiting/sold/canceled/rollback/closed — hammasi commit'dan keyin fire-and-forget.
- `OrderService`ga `BitrixFeedbackService` inject.
- Auto-retry @Cron + reconcile @Cron (link-drift/yo'qolgan feedback tuzatish).
- Echo-loop guard tasdiqlash (§8.4).

### Bosqich 3 — IXTIYORIY: PCS→CRM deal/lead yaratish (M6)
**Maqsad:** PCS'da tug'ilgan (bot/AI/operator/QR) buyurtmani CRM'ga yangi deal qilib yuborish (marketing/hisobot to'liqligi).
**Deliverable:**
- `BitrixDealService.buildCreateDealBody` (order→Contact+Deal DTO).
- `batch` (findbycomm dedup + contact.add + deal.add) + `UF_CRM_PCS_ORDER_ID`.
- Hook: `createOrder :505`, `createOrderByBot :871` (CRM'dan kelmagan buyurtmalar uchun — link yo'q shartida).
- `outbound_create_enabled` gate.
> Bu bosqich faqat biznes talab qilsa. Asosiy qiymat Bosqich 1+2'da.

---

## 11. Sinov strategiyasi

### 11.1 Test-akkaunt
- Bepul Bitrix24 cloud portal (`<test>.bitrix24.com`).
- Inbound webhook (scope=crm) + outbound webhook (ONCRMDEALUPDATE → PCS test handler).
- Test voronka: "Dostavkaga chiqarildi" bosqichini yaratib `intake_stage_id`ga yozish; WON/LOSE/PREPARATION feedback uchun.

### 11.2 Test qatlamlari

| Qatlam | Nima | Vosita |
|---|---|---|
| **Unit (intake)** | `bitrix-payload.util` (form-urlencoded/JSON'dan ID), `bitrix-token.util` (timing-safe verify), `BitrixMapperService` (deal→order, 3 tuman strategiya), STAGE gate, link gate | Jest, mock |
| **Unit (feedback)** | `bitrix-stage.mapper` (barcha status→stage), claimJobs atomiklik, retry backoff, stale reclaim | Jest + test DB |
| **Integration (intake)** | mock HTTP: batch deal.get+contact+products javobi → NEW buyurtma yaratilishi; **idempotentlik** (bir deal ikki webhook → bitta buyurtma); tuman aniqlanmaganda flag | Jest + test DB |
| **Integration (feedback)** | mock `crm.deal.update`: 200/`{error}`/429/503 backoff | Jest |
| **Integration (real)** | Test-portalda deal'ni intake bosqichiga o'tkazish → PCS'da NEW buyurtma; PCS'da sotish → Bitrix STAGE=WON | Real sandbox |
| **E2E** | CRM deal → "dostavkaga chiqarildi" → 30s ichida PCS'da NEW buyurtma; PCS sell → 30s ichida Bitrix WON | Manual + sandbox |

### 11.3 Dry-run
- `bitrix-admin` `POST /test-connection` — `crm.status.list` pingi (hech narsa yaratmaydi, `is_active` bypass).
- **Intake dry-run:** webhook keladi, `dry_run` flag'da payload va map natijasi log qilinadi, buyurtma YARATILMAYDI — mapping/tuman-aniqlashni prodsiz tekshirish.
- `is_active=false`'da intake faqat log, feedback jim skip — PCS oqimi buzilmasligini tekshirish.

---

## 12. Xavflar va ochiq savollar

### 12.1 Xavflar

| Xavf | Ta'sir | Yumshatish |
|---|---|---|
| **Tuman/SOATO aniqlanmasligi** (M9) | Buyurtma noto'g'ri regionga marshrutlanadi | 3 strategiya (§5.3); `allDistricts[0]` fallback OLIB TASHLANADI → `district_unresolved` flag + qo'lda biriktirish + admin xabari |
| **Intake dublikat** (webhook ko'p marta) | Bir deal → ko'p buyurtma | `delivery_key` dedup + `bitrix_order_link` UNIQUE + tranzaksion create+link (§8.1-8.2) |
| **Feedback echo → sikl** | Cheksiz sikl / soxta intake | STAGE gate + link gate (§8.4) — feedback echo hech qachon buyurtma tug'dirmaydi |
| **Online event drop** (research) | Intake buyurtma yo'qoladi | OFFLINE event + poll/ack (Bosqich 1 hardening) + reconcile @Cron |
| **Narx = 0** (CRM OPPORTUNITY bo'sh) | Buyurtma 0 so'm | Mapping'da OPPORTUNITY majburiy tekshiruvi + audit warn; blok emas |
| **STAGE_ID hardcode / `C1:` prefiks** | Update/gate xato | `crm.status.list` discovery, per-integration jsonb, module-load invariant |
| **Rate-limit 429/503** | Feedback kechikadi | Write-queue 2/s, batch, backoff |
| **Token sizib chiqishi** (muddati yo'q) | Doimiy xavf | AES shifr, mask, least-privilege crm scope |
| **amoCRM webhook tarif-cheklovi** | Intake ishlamaydi | Sozlashda tarif tekshirish (Q6); OAuth refresh loop |
| **`receiveExternalOrders` refaktori regressiyasi** | Mavjud tashqi-intake buziladi | Helper ajratish + mavjud loop testlari; `initialStatus` parametri backward-compat |

### 12.2 Biznesga / CRM admin'ga savollar

1. **Q1 (intake trigger):** "Dostavkaga chiqarildi" aynan qaysi voronka bosqichi (STAGE_ID)? `crm.status.list` natijasi kerak. Default voronkami yoki maxsus (`C1:`)?
2. **Q2 (Deal vs Lead):** Buyurtma CRM'da **Deal**mi yoki **Lead**mi? (Deal = voronka/stage; Lead = STATUS_ID + telefon record'da). `crm_entity_type` shunga bog'liq.
3. **Q3 (boshlang'ich status):** CRM buyurtmasi PCS'ga **NEW** (operator ko'zdan kechiradi)mi yoki **RECEIVED** (darhol post'da)mi? TUZATILGAN model NEW deydi — tasdiqlansin.
4. **Q4 (mahsulotlar):** `crm.deal.productrows` qatorlari PCS'da **matn** (quantity, item'siz)mi yoki `OrderItemEntity` (product mapping)mi?
5. **Q5 (tuman/SOATO — kritik):** CRM'da SOATO custom field bormi (`soato_field`)? Yo'q bo'lsa tuman NOMI keladimi (`name_match`)? Yo'q bo'lsa market bitta default tumangami (`default`)?
6. **Q6 (CRM turi + tarif):** Bitrix24mi yoki amoCRM? amoCRM bo'lsa webhook obunasi tarifda bormi? On-Premise Bitrix bo'lsa aktiv litsenziya bormi (outbound event uchun)?
7. **Q7 (feedback bosqichlari):** RECEIVED/ON_THE_ROAD/WAITING uchun CRM'da qaysi bosqichlar? Ular intake bosqichidan **ajratilganmi** (echo-guard §5.2)?
8. **Q8 (telefon format):** CRM'da telefon `+998...` formatidami? Normalizatsiya kerakmi?
9. **Q9 (Bosqich 3 kerakmi):** PCS'da tug'ilgan (bot/AI) buyurtmalar CRM'ga qaytib deal bo'lib chiqishi kerakmi, yoki CRM faqat o'zi tug'dirgan buyurtmalarni kuzatadimi?
10. **Q10 (offline event):** Intake yo'qotmaslik kritikmi (→ OFFLINE event + poll/ack majburiy) yoki online event + reconcile yetarlimi?

---

## 13. Ish hajmi bahosi

| Bosqich | Ish | Hajm | Dev-kun |
|---|---|---|---|
| **Bosqich 0** | 4 entity + migratsiya, ApiService (get/batch/update+backoff+write-queue), ConfigService+controller, stage mapper+discovery, kill-switch, body wiring | **M** | 4–6 |
| **Bosqich 1 (INBOUND — ASOSIY)** | WebhookController+token verify, IntakeService (dedup→batch→gate→map→create→link), MapperService + **3 tuman strategiya**, `createOneCrmOrder` refaktor, DB idempotentlik, offline event+poll, intake admin | **L** | 7–10 |
| **Bosqich 2 (OUTBOUND FEEDBACK)** | FeedbackService+worker (queue naqshi), 8 lifecycle hook, OrderService inject, auto-retry+reconcile @Cron, echo-guard | **M** | 5–7 |
| **Bosqich 3 (ixtiyoriy PCS→CRM)** | DealService (order→DTO), batch create+dedup, 2 create-hook, UF korrelyatsiya | **M** | 4–6 |
| **Umumiy testlar** | Unit + integration + sandbox E2E (bosqichlar bo'ylab) | **M** | 4–6 (taqsimlangan) |

**Jami:** ~ **24–35 dev-kun** (Bosqich 0+1+2+3 + testlar).
**Asosiy qiymat (Bosqich 0+1):** ~ **11–16 dev-kun** — CRM'dan buyurtma PCS'ga tushishi (integratsiyaning yuragi).
**To'liq ikki yo'nalish (0+1+2):** ~ **16–23 dev-kun** — CRM'dan intake + PCS'dan status feedback.

> **Tavsiya:** Bosqich 0+1'ni birinchi relizga (INBOUND intake — bu integratsiyaning butun sababi). Bosqich 2 (feedback) darhol keyin, chunki CRM-operator "buyurtmam qayerda?" ni ko'rishi kerak. Bosqich 3 (PCS→CRM create) — faqat biznes hisobot/marketing to'liqligini talab qilsa. Eng ko'p dizayn xavfi **tuman/SOATO aniqlash** (§5.3) va **intake idempotentligida** (§8.2) — ularga alohida e'tibor bering.