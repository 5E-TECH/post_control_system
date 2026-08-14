# amoCRM / Kommo Integratsiya Rejasi — Post Control System (CRM = buyurtma manbai)

> Hujjat tili: Oʻzbek. Manbalar: kodbaza xaritasi (INPUT A) + tasdiqlangan amoCRM API tadqiqoti (INPUT B, VERIFICATION tuzatishlari qoʻllangan) + CRM→order intake xaritasi (INPUT C).
> Barcha fayl yoʻllari: `/home/shodiyor/Desktop/post_control_system/server/` ostida.
> Qamrov: **faqat amoCRM / Kommo** (bir mahsulot, bir REST API v4; yagona farq — akkaunt hosti: `{subdomain}.kommo.com` xalqaro yoki `{subdomain}.amocrm.ru` RU/MDH).

> ## ⚠️ YOʻNALISH TUZATILDI (2026-07-25 — biznes tomonidan tasdiqlangan)
> Oldingi reja yoʻnalishni **teskari** faraz qilgan edi ("biz amoCRM'da lead YARATAMIZ, CRM = koʻzgu"). **Bu notoʻgʻri.** Tuzatilgan model:
>
> - **amoCRM / Kommo — buyurtmaning BIRLAMCHI MANBAI.** CRM PCS'dan **yuqorida** turadi. Buyurtma CRM'da CRM-operatorlari tomonidan yaratiladi.
> - **ASOSIY OQIM = INBOUND INTAKE (CRM → PCS).** CRM-operatori lead'ni sozlangan **"dostavkaga chiqarildi"** bosqichiga (`status_id`) oʻtkazsa → PCS'ga `status_lead` webhook keladi → PCS `GET /api/v4/leads/{id}?with=contacts` bilan toʻliq yozuvni oladi → maydonlarni PCS buyurtma maydonlariga map qiladi → PCS'da **YANGI (NEW)** buyurtma yaratadi → CRM `lead_id` ↔ PCS `order_id` link saqlanadi.
> - **IDEMPOTENTLIK:** har lead uchun **FAQAT BITTA** buyurtma. `status_lead` webhook koʻp marta otishi mumkin — buyurtma faqat **birinchi mos oʻtishda** yaratiladi, keyingilari eʼtiborsiz qoldiriladi. Intakedan keyin CRM-tomon oʻzgarishlari PCS'ga **SINXRONLANMAYDI** (davomiy inbound status-sync YOʻQ).
> - **IKKILAMCHI OQIM = OUTBOUND FEEDBACK (PCS → CRM).** PCS yetkazishni qayta ishlaganda (qabul/yoʻlda/kutilmoqda/sotildi/bekor) — status CRM lead bosqichiga (`PATCH /api/v4/leads/{id}` bilan) qaytariladi. Oldingi rejadagi **queue/retry/mapping/kill-switch/xavfsizlik/config** shu yerda **QAYTA ISHLATILADI** — faqat "biz lead yaratamiz" degan asosiy faraz olib tashlandi.
> - **INTAKEDAN KEYIN PCS — yetkazish statusi uchun AVTORITET.** Yagona muhim inbound hodisa = dastlabki "dostavkaga chiqarildi" intake.
> - **CRM — QOʻSHIMCHA MANBA.** PCS hali ham operator/bot/AI/QR orqali buyurtma qabul qiladi. PCS'da tugʻilgan buyurtmani CRM'ga lead qilib yuborish — **IXTIYORIY Bosqich 3**, asosiy talab EMAS.

> ## ✅ QOʻLLANILGAN QARORLAR
> - **Tenancy = PER-MARKET** — har market oʻz amoCRM/Kommo akkaunti + oʻz **long-lived tokeni** bilan ulanadi (`market_id` FK + `slug`; singleton EMAS). Bir akkaunt boʻlgani uchun **OAuth KERAK EMAS**.
> - **Auth = long-lived Bearer token** (refresh loop YOʻQ).
> - **Bosqichlar = TOʻLIQ 6 BOSQICH** feedback, **Maydonlar = BARCHASI** (ikkala yoʻnalishda).
> - **Maxfiylik:** toʻliq PII ishlanadi → himoya = per-market izolyatsiya + shifrlangan/masklangan token + minimal scope.

---

## 1. Maqsad va yoʻnalish

### Nima integratsiya qilamiz va NEGA

Bir qator marketlar sotuvni **amoCRM / Kommo'da** boshqaradi: qoʻngʻiroq, lead, sotuv voronkasi — hammasi CRM'da. Buyurtma **CRM'da tugʻiladi**. Post Control System (PCS) esa **yetkazib berish operatsion tizimi**: qabul, kuryer, post, kassa, LDG. Maqsad — CRM'da "yetkazishga tayyor" deb belgilangan har bir lead **avtomatik PCS'ga buyurtma boʻlib tushsin**, va yetkazish jarayoni PCS'da kechganda CRM-operatori uni CRM voronkasidan **kuzatib tursin**.

### Yoʻnalish (TUZATILGAN)

```
   ┌──────────────────────────────────────────────────────────────┐
   │  amoCRM / Kommo   =   BUYURTMA MANBAI (yuqorida)             │
   │  CRM-operator lead'ni yaratadi va voronkada boshqaradi        │
   └───────────────┬──────────────────────────────▲───────────────┘
                   │ (1) INBOUND INTAKE            │ (2) OUTBOUND
                   │     ASOSIY                    │     FEEDBACK
                   │     "dostavkaga chiqarildi"   │     ikkilamchi
                   │     status_lead webhook       │     PCS status →
                   │     → PCS'da NEW buyurtma      │     CRM status_id
                   ▼                               │
   ┌──────────────────────────────────────────────┴───────────────┐
   │  POST CONTROL SYSTEM  =  YETKAZISH AVTORITETI (intakedan keyin)│
   │  qabul → kuryer → post → sotildi/bekor → kassa → LDG          │
   └──────────────────────────────────────────────────────────────┘
```

| Yoʻnalish | Qamrov | Ustuvorlik |
|---|---|---|
| **CRM → PCS (inbound intake)** | "dostavkaga chiqarildi" → PCS'da **NEW** buyurtma yaratish | 🥇 **ASOSIY — Bosqich 1** |
| **PCS → CRM (outbound feedback)** | Qabul/yoʻlda/kutilmoqda/sotildi/bekor → CRM `status_id` bosqichiga koʻchirish | 🥈 **KERAK — Bosqich 2** |
| **PCS → CRM (lead yaratish)** | PCS'da tugʻilgan (operator/bot/AI/QR) buyurtmani CRM'ga lead qilib yuborish | ⚪ **IXTIYORIY — Bosqich 3** |
| **CRM → PCS davomiy status-sync** | Intakedan keyin CRM oʻzgarishini PCS'ga tortish | ❌ **YOʻQ (ataylab)** |

**Rationale:**
- **CRM = manba.** Buyurtma CRM'da yaratiladi; PCS uni **qabul qiladi** (intake), aynan hozirgi `receiveExternalOrders` tashqi-buyurtma qabul naqshi kabi (`order.service.ts:5533`). Shuning uchun asosiy oqim **inbound**.
- **Intakedan keyin PCS avtoritet.** Yetkazishning haqiqiy holati (sotildi, bekor, kassa, kuryer) **PCS'da** hisoblanadi. Shu sabab yetkazish statusi CRM'ga **feedback** qilib qaytariladi (outbound), lekin CRM'dagi keyingi qoʻl oʻzgarishlari PCS'ga **tortilmaydi** — aks holda ikki avtoritet toʻqnashadi va kassa buziladi.
- **Yagona inbound hodisa = "dostavkaga chiqarildi".** Boshqa hech qanday CRM oʻzgarishi (izoh, summa tahriri, bosqich orqaga tortish) PCS'ga taʼsir qilmaydi. Bu idempotentlikni ham soddalashtiradi.

### "Dostavkaga chiqarildi" trigger'i — nima aynan intake qiladi

| CRM | Trigger hodisa | Trigger sharti |
|---|---|---|
| **amoCRM / Kommo** | `status_lead` webhook (lead bosqichi oʻzgargani) | `lead.status_id == config.release_stage_id` **VA** bu lead uchun link hali yoʻq |

`release_stage_id` — admin tomonidan **har market uchun** sozlanadi (CRM voronkasidagi aniq bosqich ID'si). Faqat shu bosqichga **oʻtish** intake'ni ishga tushiradi; boshqa bosqichdagi lead'lar eʼtiborsiz.

> ⚠️ **Muhim (INPUT B):** oʻrta bosqich `status_id` lari **akkauntga xos** raqamlar (masalan `58141807`). Ular hech qachon kod ichida qattiq yozilmaydi — admin CRM'dan (`GET /api/v4/leads/pipelines`) oʻqib `crm_config`'ga kiritadi. Faqat `142` (Won) va `143` (Lost) — barqaror tizim ID'lari.

---

## 2. Maʼlumot oqimi (diagramma)

```
 ═══════════════════════ (1) INBOUND INTAKE — ASOSIY ═══════════════════════

  amoCRM / Kommo                                   POST CONTROL SYSTEM
  ┌─────────────────────┐   status_lead webhook    ┌──────────────────────────┐
  │ operator lead'ni     │   (x-www-form-urlencoded)│ crm-webhook.controller   │
  │ "dostavkaga          │─────────────────────────▶│  POST /crm/webhook/:slug │
  │  chiqarildi"ga       │   leads[status][0][id]=…  │  auth-guard YOʻQ         │
  │  tortadi             │   account[subdomain]=…    │  @HttpCode(200)          │
  └─────────────────────┘                          └────────────┬─────────────┘
             ▲                                                   │ 200 DARHOL (<2s)
             │                                                   ▼
             │                                      ┌──────────────────────────┐
             │                                      │ crm-webhook.service      │
             │  (3) READ-BACK (oʻz Bearer token):  │  1) slug→config; is_active│
             │  GET /api/v4/leads/{id}?with=       │  2) subdomain/account[id] │
             │      contacts                        │  3) webhook dedup log     │
             │  Authorization: Bearer <token>       │  4) status_id==release?   │
             │  User-Agent: PostControlSystem/1.0   │  5) link bor? → SKIP      │
             └─────────────────────────────────────┤◀───────────┘ ASINXRON     │
                                                    ▼                           │
                                      ┌──────────────────────────┐             │
                                      │ crm-intake.service       │             │
                                      │  lead+contacts → order DTO│             │
                                      │  · mijoz upsert (telefon) │             │
                                      │  · SOATO/tuman aniqlash   │             │
                                      │  · narx = read-back'dan   │             │
                                      └────────────┬─────────────┘             │
                                                   ▼                           │
                                      ┌──────────────────────────┐             │
                                      │ OrderService.            │             │
                                      │  createOneCrmOrder(...)   │  status=NEW │
                                      │  (receiveExternalOrders   │  guruh-tasdiq│
                                      │   naqshidan ajratilgan)   │  YOʻQ, post  │
                                      └────────────┬─────────────┘  biriktirilma │
                                                   ▼                           │
                                      ┌──────────────────────────┐             │
                                      │ crm_lead_link YOZ         │             │
                                      │  UNIQUE(subdomain,lead_id)│             │
                                      │  ↔ order_id UNIQUE        │             │
                                      └──────────────────────────┘             │

 ═══════════════════ (2) OUTBOUND FEEDBACK — IKKILAMCHI ════════════════════

  order.service.ts / post.service.ts (commitdan KEYIN, fire-and-forget)
  ┌──────────────┐   crmFeedbackService.enqueue({orderId, operation})
  │ receiveNew   │──┐
  │ sendPost     │  │      ┌──────────────────────┐   @Cron(*/30s)+trigger
  │ receivePost  │  ├────▶ │  crm_sync_queue       │──▶ FOR UPDATE SKIP LOCKED
  │ sellOrder    │  │      │  (durable, DB)        │        │
  │ cancelOrder  │  │      └──────────────────────┘        ▼
  │ rollback...  │──┘                              ┌──────────────────────┐
  └──────────────┘                                 │ crm-api.service      │ p-limit
                                                   │  PATCH /api/v4/      │ ≤6 rps
                                                   │   leads/{id}         │ 429→
                                                   │   {status_id, price} │ retry_after 300
                                                   └──────────┬───────────┘
                                                              ▼  crm_lead_link.lead_id
                                                     CRM voronkada bosqich koʻchadi
```

### CRM hodisa → PCS amali (INBOUND — asosiy)

| CRM hodisa | PCS amali |
|---|---|
| Lead **"dostavkaga chiqarildi"** bosqichiga oʻtdi (birinchi marta) | Read-back (`GET /leads/{id}?with=contacts`) → map → **PCS'da NEW buyurtma yarat** → `crm_lead_link` yoz |
| Xuddi shu lead yana oʻzgardi (izoh/summa/bosqich) | **Eʼtiborsiz** (link mavjud → skip) |
| Lead boshqa (release EMAS) bosqichga oʻtdi | **Eʼtiborsiz** (trigger sharti bajarilmadi) |
| Lead CRM'da oʻchirildi | **Eʼtiborsiz** (PCS avtoritet; buyurtma PCS oqimida davom etadi) |

### PCS hodisa → CRM amali (OUTBOUND — ikkilamchi feedback)

| PCS hodisa (method:line) | CRM amali |
|---|---|
| NEW→RECEIVED (`receiveNewOrders :1853` / `receiveWithScaner :1974`) | `status_id` → "Qabul qilindi" |
| RECEIVED→ON_THE_ROAD (`post.service.ts:929` sendPost) | `status_id` → "Yoʻlda" |
| ON_THE_ROAD→WAITING (receivePost oilasi `:1059/:1159/:1224/:1329`) | `status_id` → "Kutilmoqda" |
| Sotildi (`sellOrder :2754`) / qisman (`partlySold :3532`) | `status_id` → **142 (Won)** + `price` = real summa |
| Bekor (`cancelOrder :3025`) | `status_id` → **143 (Lost)** |
| Rollback (`rollbackOrderToWaiting :4099`) | `status_id` → "Kutilmoqda" (yoki oldingi) |

> Eslatma: outbound feedback faqat **`crm_lead_link` mavjud** (yaʼni CRM'dan intake qilingan) buyurtmalar uchun ishlaydi. PCS'da tugʻilgan (link'siz) buyurtmalar feedback yubormaydi — ular Bosqich 3'da (ixtiyoriy) CRM'ga lead boʻlib chiqishi mumkin.

---

## 3. Autentifikatsiya va dastlabki sozlash

### 3.1 Tenancy — PER-MARKET

Har market oʻz amoCRM/Kommo akkauntiga ulanadi: `crm_config` jadvali `market_id` FK + `slug` bilan (singleton EMAS). Har akkaunt oʻz **long-lived tokeni**ni oladi.

### 3.2 amoCRM / Kommo auth — long-lived token (OAuth EMAS)

INPUT B tasdiqlangan: bu **oʻz akkauntining** buyurtmalarini qabul qiladi (public marketplace emas). Shuning uchun **private integration + long-lived token**:
- `Authorization: Bearer <long_lived_token>` — **refresh loop YOʻQ**, expiry-monitoring YOʻQ (bu OAuth'ning eng ogʻir qismini butunlay olib tashlaydi).
- Token 1 kundan **5 yilgacha** amal qiladi, **bir marta koʻrsatiladi** (nusxa oling; qayta olib boʻlmaydi).
- Kamchilik (INPUT B): admin-darajali huquq, "less safe" — sirni qatʼiy himoya qiling, tugashidan oldin almashtiring.

```
amoCRM / Kommo sozlash (admin, bir martalik):
1. Settings → Integrations → Create integration → "Private"
2. "Keys and scopes" → "Generate long-lived token" → tugash sanasi (masalan 2 yil)
3. Tokenni NUSXA OL (qayta koʻrsatilmaydi!)
4. Webhook obuna (INBOUND trigger uchun) — 3.3'ga qarang.
5. Pipeline/status ID larni oʻqib olish:
   GET /api/v4/leads/pipelines  → release_stage_id (intake trigger)
                                 + feedback bosqich ID lari (Qabul/Yoʻlda/Kutilmoqda)
6. Custom-field ID larni oʻqib olish:
   GET /api/v4/leads/custom_fields      → manzil/tuman(SOATO)/narx maydonlari
   GET /api/v4/contacts/custom_fields   → telefon (enum_id) maydoni
7. Admin UI → crm_config: subdomain, host (kommo.com|amocrm.ru), long_lived_token,
   pipeline_id, release_stage_id, status_mapping, field_mapping, district_strategy
```

> ⚠️ **`User-Agent` header SHART** (INPUT B extra-finding): amoCRM/Kommo `User-Agent`siz soʻrovlarni rad etadi. `crm-api.service` transport qatlamida global default `User-Agent: PostControlSystem/1.0` oʻrnating.
> ⚠️ **Host per-account:** markaziy `api.kommo.com` YOʻQ — har chaqiruv `{subdomain}.kommo.com` yoki `{subdomain}.amocrm.ru`. Notoʻgʻri host / eskirgan subdomain → xato. `crm_config`'da `host` ustuni ajratadi.

### 3.3 INBOUND webhook obuna — UI yoki API (tarif-cheklovi bor)

amoCRM lead bosqichi oʻzgarishini bizga `status_lead` hodisasi orqali yuboradi.

| Usul | Qanday | Cheklov |
|---|---|---|
| **UI (tavsiya)** | Settings → Integrations → integration → **Webhooks** → HTTPS URL kiriting + `status_lead` (ixtiyoriy `add_lead`) belgilang | Arzon tarifda ham ishlaydi |
| **API** | `POST /api/v4/webhooks` `{destination, settings:["status_lead"]}` | ⚠️ **Advanced / Pro / Enterprise** tarif talab qiladi (INPUT B) |

- URL = bizning **hard-to-guess** endpoint: `https://.../api/v1/crm/webhook/<random-slug>` (imzo yoʻqligini qisman qoplaydi, §9).
- Akkauntda **maksimum 100 webhook**; bitta webhook bir necha hodisani olib yurishi mumkin.
- **Trigger status_id tanlash:** admin CRM voronkasidan qaysi bosqich "dostavkaga chiqarildi" ekanini aniqlab, uni `release_stage_id`ga kiritadi (§12 ochiq savol #3).

### 3.4 Sirlar qayerda saqlanadi

| Sir/sozlama | Qayerda | Nega |
|---|---|---|
| **Hech narsa env'da emas** (per-market, runtime-tunable) | — | env deploy-baked; CRM sozlamalari runtime toggle + audit + per-market |
| `long_lived_token` | **DB `crm_config`**, hozircha plaintext varchar (LDG uslubi), kelajakda AES-256-GCM `ValueTransformer` | INPUT A qism 4 §2 |
| `subdomain`/`host`, `pipeline_id`, `release_stage_id`, `status_mapping`, `field_mapping`, `district_strategy` | DB `crm_config` (jsonb) | Admin runtime'da oʻzgartiradi |
| `SECRETS_ENC_KEY` (kelajakda shifrlash) | **env** | Yagona master kalit |

---

## 4. Arxitekturaga ulanish

### Qaror: YANGI maxsus modul (`ldg-cargo` uslubida)

INPUT A: `external-integration`/`integration-sync` engine'i order-centric, `external_id` + `operator='external_<slug>'` shart qiladi, fixed action vocabulary + fixed `{status_field}` payload — CRM'ning **inbound intake** (buyurtma yaratish) va ikkita alohida amaliyot (webhook read-back GET, feedback PATCH) ehtiyojiga toʻgʻri kelmaydi. Shuning uchun `ldg-cargo` skeletiga koʻra yangi `crm-integration` moduli quramiz. **Durable-queue** logikasini (atomik-claim, retry, stale-recovery) esa `integration-sync.service.ts` naqshidan **koʻchiramiz** (INPUT A qism 5).

### 4.1 INBOUND intake — asosiy oqim (yangi, oldingi rejada YOʻQ edi)

Naqsh manbalari:
- **`ldg-webhook.*`** — auth'siz controller + har-doim-200 + dedup + master switch. (Faqat farq: amoCRM'da **HMAC yoʻq** → imzo-verify oʻrniga subdomain-check + read-back.)
- **`receiveExternalOrders`** (`order.service.ts:5533`) — tashqi xom yozuv → toʻliq buyurtma: mijoz-upsert (telefon), SATO→tuman, dedup — hammasi bitta tranzaksiyada.

> **INPUT C qarori:** `receiveExternalOrders` ichidagi bitta-buyurtma yaratish bloki (`:5660-5872`) `private createOneExternalOrder(extOrder, ctx, opts)` helperiga **ajratiladi**, `opts.status` va `opts.attachPost` parametrlari bilan. `OrderService.createOneCrmOrder` shuni `{status:NEW, attachPost:false}` bilan chaqiradi. `createOrder` (`:272`) intake uchun **mos emas**: u mijozni telefon bilan yaratmaydi (faqat mavjud `customer_id` UUID qabul qiladi `:371`), tuman UUID kutadi, post biriktirmaydi.

**Intake status qarori (MUHIM — `receiveExternalOrders`'dan farq):**

| Jihat | Tashqi-QR (`receiveExternalOrders` hozirgi) | **CRM intake (yangi)** |
|---|---|---|
| Boshlangʻich status | `RECEIVED` (`:5855`) | **`NEW`** (biznes talabi) |
| Post biriktirish | Darhol (`:5852`) | **YOʻQ** — operator odatdagidek qabul qiladi |
| Guruh-tasdiq | Yoʻq | **Yoʻq** — CRM allaqachon tasdiqlagan manba; `dispatchOrderForApproval` chaqirilMAYDI |
| Mijoz upsert | Telefon boʻyicha | Telefon boʻyicha (bir xil) |
| Tuman | SATO → fallback `allDistricts[0]` (xavfli) | SOATO kaskad (§5.3), fallback = **"aniqlanmagan" sentinel** (random EMAS) |

Yaʼni CRM buyurtmasi `NEW` navbatiga tushadi va operator uni odatdagidek qabul qiladi/kuryerga beradi — CRM ishonchli manba boʻlgani uchun guruh ✅/❌ oʻtkazib yuboriladi, lekin post biriktirish operator qoʻlida qoladi (MEMORY: tuman avto-routing ataylab oʻchirilgan — routing faqat operatorning qoʻlda kuryer tanlashi boʻyicha).

### 4.2 OUTBOUND feedback — ikkilamchi oqim (oldingi rejadan QAYTA ISHLATILADI)

Oldingi rejadagi durable-queue + retry/backoff + rate-limit + kill-switch **saqlanadi**, faqat asosiy operatsiya endi `create_lead` emas, balki **`update_stage`** (feedback). `create_lead` esa Bosqich 3'ga (ixtiyoriy) koʻchadi.

### 4.3 Yangi modul: `src/api/crm-integration/`

```
src/api/crm-integration/
├── crm-integration.module.ts   # TypeOrmModule.forFeature([...]),
│                               #   HttpModule.register({timeout:30000, maxRedirects:0}),
│                               #   forwardRef(() => OrderModule)
├── crm-api.service.ts          # TRANSPORT: axios; Bearer <long_lived_token>;
│                               #   User-Agent SHART; p-limit ≤6rps; 429 → retry_after 300
├── crm-webhook.service.ts      # INBOUND: subdomain-check → dedup → link-check → release-check
│                               #   → read-back (GET /leads/{id}?with=contacts) → intake; har-doim 200
├── crm-intake.service.ts       # INBOUND DOMAIN: lead+contact → order DTO mapper
│                               #   (mijoz/telefon/manzil/SOATO/narx); createOneCrmOrder chaqiradi
├── crm-feedback.service.ts     # OUTBOUND QUEUE: enqueue(), claimJobs (FOR UPDATE SKIP LOCKED),
│                               #   processQueue, reclaimStale, retry/backoff, @Cron(*/30s)
├── crm-config.service.ts       # CONFIG CRUD: getOrCreate(market), secret masking, getSafe()
├── crm-admin.service.ts        # OPS: health/checklist, listlar, redispatch, @Cron reconcile/retry
├── crm-webhook.controller.ts   # POST /crm/webhook/:slug — auth-guard YOʻQ, @HttpCode(200),
│                               #   @ApiExcludeEndpoint
├── crm-config.controller.ts    # /crm/config — JWT + ADMIN/SUPERADMIN
├── crm-admin.controller.ts     # /crm/admin/* — JWT + admin
├── dto/
│   ├── amocrm-webhook.dto.ts   # leads[status][0][...] urlencoded envelope + account[]
│   ├── amocrm-lead.dto.ts      # lead GET (?with=contacts) / PATCH request/response shakllari
│   └── crm-headers.const.ts    # header konstantalar (User-Agent va h.k.)
└── utils/
    ├── crm-status.mapper.ts    # Order_status → status_id (feedback), pure fn + CLOSED-invariant
    ├── crm-field.mapper.ts     # lead+contact → order maydon (intake), config field_mapping asosida
    └── sato-resolver.ts        # SOATO/tuman aniqlash kaskadi (§5.3)
```

### 4.4 Yangi entity'lar (4 ta)

| Entity | Shakl | Asosiy ustunlar |
|---|---|---|
| **`crm_config`** (`src/core/entity/crm-config.entity.ts`) | Per-market (`market_id` FK, `slug` unique) | `host` (`kommo`\|`amocrm`), `subdomain`, `long_lived_token` (sir), `pipeline_id`, `release_stage_id` (intake trigger), `status_mapping` (jsonb, outbound `status_id`lari), `field_mapping` (jsonb, intake `field_id` kodlari), `district_strategy` (jsonb: SOATO field_id, name field_id, mapping jadval, `default_district_id`), `is_active` (master), `inbound_enabled`, `outbound_enabled`, `auto_retry_enabled`, `reconcile_enabled`. Extends `BaseEntity`. |
| **`crm_lead_link`** (`src/core/entity/crm-lead-link.entity.ts`) | Bir qator = bir CRM lead ↔ bir buyurtma (**idempotentlik omurtqasi**) | `market_id`, `subdomain`, **`lead_id`** (bigint), `pipeline_id`, `order_id` (uuid, **unique**), `last_outbound_status_id`, `send_attempts`, `last_error`, `last_synced_at`, `mismatch_at/reason`. **UNIQUE (`subdomain`,`lead_id`)**. Nullable bigint uchun `bigintTransformer` (**NonNull EMAS** — INPUT A qism 4 §3 tuzogʻi: NonNull null→0 yozadi va `IS NOT NULL` filtrni buzadi). |
| **`crm_sync_queue`** (`src/core/entity/crm-sync-queue.entity.ts`) | Outbound feedback job | `order_id`, `operation` (`update_stage`\|`create_lead`), `payload` (jsonb), `status` (pending/processing/failed/success), `attempts`, `max_attempts` (3), `next_retry_at` (bigint ms, index), `last_error`, `last_response`, `synced_at`. |
| **`crm_webhook_log`** (`src/core/entity/crm-webhook-log.entity.ts`) | Inbound dedup + audit | `event_hash` (PK — `md5(subdomain+lead_id+status_id+old_status_id)`), `subdomain`, `market_id`, `event_type`, `auth_valid`, `status` (processed/skipped/failed/duplicate), `raw_payload` (jsonb), `received_at/processed_at`. BaseEntity EMAS. |

### 4.5 Migratsiya + wiring

- **Migratsiya:** `src/migrations/<ts>-CrmIntegrationTables.ts`. `ts` = joriy eng yuqori migratsiya timestamp +1 (masalan `1748500000000`). Idempotent raw SQL, `CREATE TABLE IF NOT EXISTS`, real `down()`. `synchronize:false` — entity'lar `autoLoadEntities` orqali yuklanadi, sxema faqat migratsiyadan oʻzgaradi.
- `crm-integration.module.ts` → `src/api/app.module.ts` `imports` ga qoʻshish.
- **INBOUND webhook body parser** (`app.service.ts`): amoCRM webhook **`x-www-form-urlencoded`** yuboradi → `app.use('/api/v1/crm/webhook', express.urlencoded({ extended:true, limit:'5mb' }))` **`express.json()` dan OLDIN** (LDG'da `express.raw` shu joyda joylashgani kabi, `app.service.ts:76-82`). Aks holda payload boʻsh keladi.
- `order.service.ts` va `post.service.ts` constructor'lariga `CrmFeedbackService` inject (feedback fire-and-forget uchun; `forwardRef` bilan sikl uziladi).
- `crm-intake.service` `OrderService`'ni inject qiladi (yangi `createOneCrmOrder` helper).
- `ActivityLogModule` `@Global` — import shart emas.

---

## 5. Field & status mapping (IKKI YOʻNALISH)

### 5.1 (a) CRM lead+contact → PCS order — INTAKE mapping

`config.field_mapping` har amoCRM `field_id`sini PCS maydoniga bogʻlaydi; `crm-field.mapper` read-back javobidan oʻqiydi. **Custom-field qiymatlari `custom_fields_values[].field_id` boʻyicha keladi**; kontakt telefoni `_embedded.contacts[0].custom_fields_values` ichida.

| PCS order maydon (DB) | amoCRM manba | Majburiy? | Fallback |
|---|---|---|---|
| `user_id` (market) | `crm_config.market_id` | Ha | config'dan |
| `customer` name (upsert) | `_embedded.contacts[0].name` | — | `'CRM mijoz'` |
| `customer.phone_number` | contact custom-field `PHONE` (`field_id` config'dan) | Ha (upsert kaliti) | `unknown_<ts>_<rand>` |
| `customer.extra_number` | contact `PHONE` 2-qiymat | — | null |
| `address` | lead custom-field "Manzil" (`field_id`) | — | `''` |
| `district_id` (SOATO) | lead custom-field "Tuman/SOATO" (`field_id`) | Ha | **§5.3 kaskad** |
| `total_price` | `lead.price` (read-back'dan, payload'dan EMAS) | — | 0 (audit xavfi) |
| `product_quantity` | catalog_elements / productrows soni | — | 1 |
| mahsulot roʻyxati | `_embedded` catalog_elements yoki `/links` | — | **§5.4 qarori** |
| `comment` | lead custom-field / note | — | `''` |
| `external_id` | `lead.id` | Ha (link) | — |
| `operator` (manba tag) | `crm_<slug>` | — | — |
| `status` | — | — | qattiq **`NEW`** |
| `where_deliver` | — | — | `market.default_tariff \|\| CENTER` |
| `qr_code_token` | — | — | `generateCustomToken()` |

> **Muhim:** intake `NEW` status bilan, post'siz, guruh-tasdiqsiz yaratadi (§4.1). `external_id` = `lead.id`, `operator = 'crm_<slug>'` manbani belgilaydi. Narx **har doim read-back GET javobidan** olinadi — webhook payload STRING qiymatiga ishonilmaydi (§9).

### 5.2 (b) PCS Order_status → CRM `status_id` — FEEDBACK mapping (6 bosqich)

> `status_id`lar akkauntga xos — admin `GET /api/v4/leads/pipelines`'dan oʻqib `crm_config.status_mapping` jsonb'ga kiritadi. `<...>` real ID bilan almashadi. **142=Won, 143=Lost** — barqaror tizim ID'lari.

| PCS `Order_status` | CRM bosqich (mantiqiy) | amoCRM `status_id` | Terminal? | Amal |
|---|---|---|---|---|
| `NEW` | (intake nuqtasi — feedback YOʻQ; CRM allaqachon "release"da) | — | — | skip |
| `RECEIVED` | "Qabul qilindi" | `<received>` | yoʻq | `update_stage` |
| `ON_THE_ROAD` | "Yoʻlda" | `<on_road>` | yoʻq | `update_stage` |
| `WAITING` | "Mijozda / kutilmoqda" | `<waiting>` | yoʻq | `update_stage` |
| `SOLD` / `PAID` | **Closed – Won** | **142** | ✅ | `update_stage` + `price` |
| `PARTLY_PAID` | Won (yoki "Qisman") | 142 / `<partly>` | ✅ | `update_stage` + real `price` |
| `CANCELLED` | **Closed – Lost** | **143** | ✅ | `update_stage` |
| `CANCELLED_SENT` | "Bekor (joʻnatildi)" | `<canc_sent>` / 143 | ✅ | `update_stage` |
| `CLOSED` | — | — | ✅ | **CRM'ga hech qachon yozilmaydi** (guard) |

**Module-load invariant** (`ldg-status.mapper` naqshi, `codebaseMap` qism 2 §4): `crm-status.mapper.ts` import vaqtida hech bir mapping `CLOSED`'ni maqsad qilmasligini tekshiradi — buzilsa import paytida throw (yomon mapping runtime'ga yetmaydi).

> **Pipeline oʻtishi (INPUT B):** agar maqsad `status_id` boshqa voronkaga tegishli boʻlsa, PATCH'ga `pipeline_id` ham qoʻshiladi. Odatda bitta voronka boʻlgani uchun faqat `status_id` yuboriladi.

### 5.3 SOATO / tuman aniqlash strategiyasi (MUHIM DIZAYN NUQTASI)

**Muammo:** PCS `DistrictEntity.sato_code` (unique, indexed) boʻyicha marshrutlaydi (`district.entity.ts:24`). amoCRM'da SOATO boʻlmasligi mumkin. Hozirgi `receiveExternalOrders` fallback'i `allDistricts[0]` (`:5591`, `:5745-5746`) — **tasodifiy birinchi tuman** → xavfli (notoʻgʻri regionga marshrutlash). CRM intake buni **takrorlamasligi kerak** (INPUT C §3).

**Yechim = kaskad (`sato-resolver.ts`), tartib boʻyicha:**

```
1. ANIQ SOATO field:
   CRM'da "SOATO / tuman kodi" custom-field (config.district_strategy.sato_field_id)
   → districtBySatoCode.get(code)  → topildi? ISHLAT.
   (Eng ishonchli — market CRM'da shu maydonni toʻldiradi.)
        │ topilmadi
        ▼
2. NOM boʻyicha fuzzy match:
   CRM tuman/shahar NOMI custom-field (config.district_strategy.name_field_id)
   → matchDistricts util (district.service.ts:24) → SATO
        │ topilmadi
        ▼
3. MAPPING jadval:
   CRM select-option (enum, masalan "Toshkent → Chilonzor") → PCS district_id
   config.district_strategy.mapping jsonb'da (enum_id → district_id)
        │ topilmadi
        ▼
4. "ANIQLANMAGAN" sentinel (random EMAS):
   Buyurtma yaratiladi, lekin district_id = config.district_strategy.default_district_id
   ("SOATO aniqlanmagan" tumani), va order.comment'ga
   "⚠️ tuman CRM'dan aniqlanmadi — operator biriktirsin" yoziladi.
   Operator NEW navbatida qoʻlda tuzatadi.
   (MEMORY: tuman avto-routing ataylab oʻchirilgan — routing faqat operator
    qoʻlda kuryer tanlashi boʻyicha; shu sabab "aniqlanmagan" bloklamaydi.)
```

> `district_id` DB'da NOT NULL boʻlgani uchun 4-bosqichda **haqiqiy sentinel tuman qatori** ishlatiladi (null emas). `config.default_district_id` **majburiy** sozlama — admin uni "Aniqlanmagan / qoʻlda biriktiriladigan" tumaniga qaratadi. Bu — **ochiq savol** (§12): sentinel global bitta boʻladimi yoki region-boʻyichami.

### 5.4 Mahsulot mapping qarori

Hozirgi `receiveExternalOrders` **order-item YARATMAYDI** — faqat `product_quantity` sonini yozadi (`:5861`), chunki tashqi mahsulotlar PCS `product_id` bilan bogʻlanmagan (INPUT C §2). CRM intake uchun 2 variant (**ochiq qaror** §12):

- **A (sodda, tavsiya Bosqich 1):** mahsulot roʻyxatini **matn** sifatida `comment`ga (yoki yangi `external_items_text` maydonga) yoz + `product_quantity` sonini hisobla. Order-item yoʻq.
- **B (toʻliq):** amoCRM catalog_elements'ni PCS `ProductEntity`'ga mapping qil (`crm_product_map` jadval: CRM catalog element id / nom → `product_id`) + `OrderItemEntity` yarat. `createOrder`'dagi IDOR himoyasi (`:445-453`) kabi mahsulot shu marketniki ekanini tekshir. Ogʻirroq — Bosqich 2+.

---

## 6. API chaqiruvlari

### 6.1 INBOUND — webhook envelope (trigger payload)

amoCRM `status_lead` hodisasini **`x-www-form-urlencoded`** (JSON EMAS) nested-bracket kalitlar bilan yuboradi; **barcha qiymat STRING**.

```
POST /api/v1/crm/webhook/<slug>
Content-Type: application/x-www-form-urlencoded

leads[status][0][id]=152462
leads[status][0][status_id]=<release_stage_id>
leads[status][0][old_status_id]=<...>
leads[status][0][pipeline_id]=6950551
leads[status][0][price]=250000
account[id]=12345678&account[subdomain]=bizning_akkaunt
```
→ `leads[status][0][status_id] == config.release_stage_id` **VA** `account[subdomain] == config.subdomain` boʻlsagina intake. **2s ichida 200**, keyin asinxron read-back (6.2). Payload'dagi `price` — faqat signal; haqiqiy narx read-back'dan.

### 6.2 INBOUND — toʻliq yozuvni olish (read-back)

Webhook faqat **ID + trigger signal** olib keladi. Haqiqiy yozuvni **oʻz Bearer token** bilan oʻqib olamiz (INPUT B: money maydonlariga payload'dan ishonilmaydi).

```
GET https://{subdomain}.kommo.com/api/v4/leads/{lead_id}?with=contacts
Authorization: Bearer <long_lived_token>
User-Agent: PostControlSystem/1.0

# Javob (soddalashtirilgan, HAL-style _links/_embedded):
{
  "id": 152462,
  "price": 250000,
  "status_id": <release_stage_id>,
  "pipeline_id": 6950551,
  "custom_fields_values": [
    { "field_id": <fid_address>, "values":[{"value":"Chilonzor 5-kv"}] },
    { "field_id": <fid_soato>,   "values":[{"value":"1726269"}] }
  ],
  "_embedded": {
    "contacts": [ { "id": 99, "name":"Vali Aliyev",
                    "custom_fields_values":[
                      {"field_id":<fid_phone>,"values":[{"value":"+998901234567","enum_code":"WORK"}]}]} ]
  }
}
# Mahsulot kerak boʻlsa (variant B): GET /api/v4/leads/{id}/links yoki catalog_elements.
```

> `?with=contacts` bitta soʻrovda kontaktni ham qaytaradi. Kontakt telefoni `_embedded.contacts[0].custom_fields_values` ichida `field_id` boʻyicha.

### 6.3 Custom-field discovery (bir martalik, sozlash paytida)

`custom_fields_values` joʻnatishdan/oʻqishdan oldin har `field_id` (va select/phone uchun `enum_id`) maʼlum boʻlishi shart — ular **akkauntga xos** (INPUT B extra-finding):

```
GET /api/v4/leads/custom_fields       → manzil, SOATO/tuman, narx maydon field_id lari
GET /api/v4/contacts/custom_fields     → telefon maydon field_id + enum_id (WORK/MOBILE)
GET /api/v4/leads/pipelines            → pipeline_id, release_stage_id, feedback status_id lari
```
Natijalar `crm_config.field_mapping` / `status_mapping`'ga bir marta yoziladi va cache qilinadi.

### 6.4 OUTBOUND — feedback (status koʻchirish)

```
PATCH https://{subdomain}.kommo.com/api/v4/leads/{lead_id}
Authorization: Bearer <long_lived_token>
User-Agent: PostControlSystem/1.0
Content-Type: application/json

{ "status_id": 142, "price": 250000 }        # yagona lead → OBJECT body
```

Batch (bir necha lead bir soʻrovda, rate-limit tejash):
```
PATCH https://{subdomain}.kommo.com/api/v4/leads
[ { "id": 152462, "status_id": 142, "price": 250000 },
  { "id": 152464, "status_id": <received> } ]   # ARRAY, har element oʻz id bilan
```

> **Idempotentlik uchun `crm_lead_link.lead_id` bizda saqlanadi** — amoCRM'da server-side "find by external key" **ishonchsiz** (INPUT B: faqat fuzzy full-text `query`; custom-field boʻyicha filter hujjatlanmagan). Feedback shu saqlangan `lead_id` boʻyicha PATCH qiladi. **Body — PLAIN JSON** (v2 `{"update":[...]}` wrapper v4'da ishlamaydi).

---

## 7. Hodisa nuqtalari (kod)

### 7.1 INBOUND — buyurtmani WEBHOOK yaratadi (bizning `createOrder` hook'i EMAS)

Intake asosiy oqim boʻlgani uchun buyurtma **webhook kelganda** yaratiladi — `order.service` ichidagi lifecycle-hook orqali emas. Zanjir:

```
crm-webhook.controller (POST /crm/webhook/:slug)
  → 200 DARHOL qaytar (@HttpCode 200)
  → crm-webhook.service.process():
      1. slug → crm_config topish (yoʻq / is_active=false / inbound_enabled=false → log+skip)
      2. autentlik: account[subdomain]==config.subdomain (+ account[id])
      3. dedup: event_hash crm_webhook_log'da bormi → "duplicate", 200
      4. release trigger: leads[status][0][status_id] == config.release_stage_id ?
                          (aks holda → skip, 200)
      5. crm_lead_link'da (subdomain, lead_id) bormi → SKIP (idempotentlik, ikkinchi buyurtma yoʻq)
      6. read-back (6.2): GET /leads/{id}?with=contacts → toʻliq yozuv
      7. crm-intake.service.intake(record):
           crm-field.mapper + sato-resolver → order DTO
           → OrderService.createOneCrmOrder(dto)  [status=NEW, post'siz, tasdiqsiz]
           → crm_lead_link YOZ (subdomain, lead_id ↔ order_id)
      8. crm_webhook_log yoz (processed)   [xatoda ham → failed, baribir 200]
```

`createOneCrmOrder` = `receiveExternalOrders` ichidan ajratilgan `createOneExternalOrder(extOrder, ctx, {status:NEW, attachPost:false})` helper.

### 7.2 OUTBOUND — feedback hook'lari (PCS lifecycle oʻtishlarida)

Konvensiya (INPUT A qism 3 §2): **`commitTransaction`'dan KEYIN, fire-and-forget**, `activityLog.log(...)` yonida. Yangi `crmFeedbackService.enqueue(orderId, operation)` — u `external_id`'ga bogʻlanmaydi (mavjud `queueStatusSync` `external_id` shart qilib CRM oqimini bloklardi), faqat **`crm_lead_link` mavjudligini** va `config.is_active && outbound_enabled`ni tekshiradi.

| PCS oʻtish | Hook (method:line) | Operation | Bosqich |
|---|---|---|---|
| NEW→RECEIVED | `receiveNewOrders :1853` / `receiveWithScaner :1974` | `update_stage`→"Qabul qilindi" | 2 |
| RECEIVED→ON_THE_ROAD | `post.service.ts:929` (sendPost) | `update_stage`→"Yoʻlda" | 2 |
| ON_THE_ROAD→WAITING | receivePost oilasi (`:1059/:1159/:1224/:1329`) | `update_stage`→"Kutilmoqda" | 2 |
| Sotildi | `sellOrder :2754` | `update_stage`→142 (Won) + price | 2 |
| Qisman sotildi | `partlySold :3532` | `update_stage`→142 + real price | 2 |
| Bekor | `cancelOrder :3025` | `update_stage`→143 (Lost) | 2 |
| Rollback | `rollbackOrderToWaiting :4099` | `update_stage`→"Kutilmoqda" | 2 |

> Kodbaza kuzatuvi (INPUT A qism 3 §2): hozir faqat **sell/partly/cancel/rollback** (4 nuqta) outbound sync chiqaradi; NEW→RECEIVED, sendPost, receivePost oilasi va CLOSED oʻtishlarida **hech qanday outbound call yoʻq** — aynan shu joylarga CRM feedback hook'lari qoʻshiladi.

**`enqueue` mantiqi (`crm-feedback.service`):**
1. `crm_lead_link`'ni `order_id` boʻyicha topish — **yoʻq boʻlsa jimgina return** (bu buyurtma CRM'dan kelmagan, feedback yoʻq).
2. `config.is_active && outbound_enabled` — yoʻq boʻlsa return (kill-switch).
3. Yubormoqchi `status_id == link.last_outbound_status_id` boʻlsa → skip (takror).
4. `crm_sync_queue`'ga job yozib, `triggerWorker()`.

> ⚠️ **Bot manba guruh-tasdigʻi:** CRM intake guruh-tasdiqni oʻtkazib yuboradi (§4.1), shuning uchun `processOrderAction` hook'i CRM oqimiga taʼsir qilmaydi. CRM buyurtmasi darhol NEW.

---

## 8. Ishonchlilik

### 8.1 INBOUND intake idempotentligi (bitta lead = bitta buyurtma)

Bu — **asosiy talab**. Uch qatlamli himoya:

```
1. crm_lead_link UNIQUE (subdomain, lead_id)
   → webhook process'da lead_id bor boʻlsa → SKIP (birinchi intake yutadi).
   → parallel ikki webhook → DB unique violation ikkinchisini yumshoq bloklaydi (200).

2. crm_webhook_log event_hash dedup
   → bir xil webhook (subdomain+lead_id+status_id+old_status_id) qayta kelsa
     → "duplicate", 200 (LDG delivery_id naqshi).

3. release-trigger sharti
   → faqat status_id == release_stage_id da yaratadi;
     keyingi status_lead otishlari (boshqa bosqichga) trigger sharti bajarmaydi → skip.
```

> **INPUT C ogohlantirishi:** hozirgi `receiveExternalOrders` dedup faqat **aktiv statuslar** boʻyicha ilova-darajali (`:5613`), **DB unique YOʻQ**. CRM uchun bu **yetarli emas** (retry/parallel dublikat xavfi). Shuning uchun `crm_lead_link`da **haqiqiy DB UNIQUE constraint (`subdomain`,`lead_id`)** — yaʼni **partial-unique kerak emas**, chunki lead_id har lead uchun global yagona; toʻliq unique ishlaydi. Bu retry'ga bardoshli intake omurtqasi.

### 8.2 Webhook 2-soniya cheklovi

amoCRM webhook **2s ichida 200** (HTTP 100–299) kutadi. Auto-disable qoidasi (INPUT B verify): **>100 xato javob 2 soat ichida VA oxirgi (eng soʻnggi) javob ham xato** boʻlsa — yaʼni oxirgi javob 200 boʻlsa, oldingi xatolar toʻdasi oʻzi disable qilmaydi. Baribir xavfsiz strategiya: **200 darhol**, read-back + intake **asinxron**. Xato boʻlsa ham 200 (retry-storm oldini olish) — nosozlik `crm_webhook_log`dan qoʻlda reprocess.

### 8.3 OUTBOUND feedback queue (INPUT A qism 3/5 naqshi)

```
@Cron('*/30 * * * * *')  scheduledProcessQueue()   ← periodik backstop
triggerWorker()                                     ← enqueue'dan keyin (isProcessing flag)
     ▼
processQueue():
  1) config.is_active + outbound_enabled → oʻchiq boʻlsa return   [KILL-SWITCH]
  2) reclaimStaleProcessing()  → 'processing' 10 daq oshgan → pending/failed
  3) claimJobs(BATCH=10)  → TRANSACTION FOR UPDATE SKIP LOCKED    [MULTI-INSTANCE SAFE]
     WHERE status='pending' OR (status='failed' AND next_retry_at<=now)
  4) ketma-ket process, orada 500ms gap
```

| Qatlam | Strategiya |
|---|---|
| **Queue-level** | `RETRY_DELAYS=[60s,5min,15min]`, `max_attempts=3`. `attempts>=max` → `failed, next_retry_at=null` (permanent). Aks holda `next_retry_at` → avto qayta-claim. |
| **HTTP-level** | Faqat `[429,500,502,503,504]`+network retry. **`retry_after=300`** hurmat (INPUT B verify: rasman hujjatlashtirilgan, ~community taxmin EMAS). Eksponensial backoff+jitter, cap. Biznes 4xx retry QILINMAYDI. |

### 8.4 Rate-limit (INPUT B)

```
amoCRM / Kommo: ≤ 7 rps IP boʻyicha (BUTUN server IP boʻyicha ulushlanadi);
  oshsa 429 (body: retry_after=300); doimiy buzsa IP BLOK (403 har soʻrovga).
  → p-limit ≤6 rps (headroom); enqueueWrite gap;
    batch PATCH (50 tagacha tavsiya, 250 hard cap); 429 da retry-storm YOʻQ.
  → 504 batch = juda katta (community-lore, tasdiqlanmagan) → batch kichraytir.
```

### 8.5 Kill-switch

| Toggle | Taʼsir |
|---|---|
| `crm_config.is_active` | **Master**. Off → inbound intake **bloklanadi** (webhook log qiladi, buyurtma yaratmaydi) VA outbound feedback bloklanadi. |
| `inbound_enabled` | Faqat inbound intake toʻxtaydi (webhook log, buyurtma yoʻq). |
| `outbound_enabled` | Faqat feedback push toʻxtaydi. |
| `auto_retry_enabled` / `reconcile_enabled` | Fon `@Cron` loop'lari. |

### 8.6 Xato ishlash

- Inbound: har throw ushlanadi, `crm_webhook_log.status='failed'`, **baribir 200**; qoʻlda reprocess.
- Outbound: xato faqat `crm_lead_link.last_error` + queue `last_error`ga, **asosiy order-oqim buzilMAYDI** (fire-and-forget).

---

## 9. Xavfsizlik

### 9.1 Webhook autentligi (amoCRM'da HMAC YOʻQ — qatlamli himoya)

amoCRM standart entity webhook'larida **imzo/HMAC/shared-secret header YOʻQ** (INPUT B verify: `X-Signature` faqat alohida Chats API'da). Shuning uchun autentlik = **qatlamli**:

```
1. account[subdomain] / account[id] == crm_config bilan mos (birinchi filtr).
2. hard-to-guess URL: /crm/webhook/<random-slug>  (slug config'da, taxmin qilib boʻlmaydi).
3. ENG MUHIM — read-back GET oʻz Bearer token bilan haqiqiy yozuvni oʻqish:
   payload STRING qiymatiga (ayniqsa price'ga) ishonmaymiz.
   → Har intake qarori read-back'dan keyin.
   → Money maydonlari (price) faqat read-back'dan, payload'dan EMAS.
4. Master switch off → hech qanday state oʻzgarmaydi (faqat log).
5. Dedup (crm_lead_link UNIQUE + webhook_log) → soxta/takror webhook zarar bermaydi.
6. (Ixtiyoriy) IP-allowlist: Kommo egress IP → nginx darajasida.
```

> **Moliyaviy qaror faqat read-back'dan.** Imzo yoʻqligi sababli hech qanday pul/status oʻzgarishi webhook payload'iga tayanmaydi — faqat `GET /leads/{id}` javobiga.

### 9.2 Least-privilege

- amoCRM long-lived token admin-huquqli ("less safe", INPUT B) — kelajakda scope-cheklovli OAuth'ga oʻtish imkoni.
- Webhook controller: **auth-guard YOʻQ** (CRM JWT yubormaydi) — LDG naqshi (`ldg-webhook.controller` `:18-24`).
- Token per-market izolyatsiya: bir market tokeni sizsa faqat oʻsha akkaunt xavfda.

### 9.3 Sir shifrlash / mask (INPUT A qism 5 §1)

```
CRM_CONFIG_SECRET_FIELDS = {'long_lived_token'}
  • Activity-log'ga sir XOM yozilmaydi → faqat masked_fields:[...] + "(maxfiy: ...)"
  • getSafe() → *_set: boolean qaytaradi (long_lived_token_set:true)
  • GET /crm/config → getSafe() (xom sir hech qachon qaytmaydi)
  • Kelajak: AES-256-GCM ValueTransformer, SECRETS_ENC_KEY (env master kalit)
```

---

## 10. Bosqichma-bosqich joriy etish

```
Bosqich 0 ──▶ Bosqich 1 ──────▶ Bosqich 2 ──────▶ Bosqich 3
(poydevor)   (INBOUND INTAKE    (OUTBOUND         (IXTIYORIY:
             CRM→PCS buyurtma)   feedback PCS→CRM)  PCS→CRM lead yaratish)
```

### Bosqich 0 — Umumiy poydevor va konfiguratsiya
- 4 entity (`crm_config`, `crm_lead_link`, `crm_sync_queue`, `crm_webhook_log`) + migratsiya (`1748500000000`).
- `crm-integration.module.ts`, `crm-config.service.ts` (getOrCreate per-market, getSafe, masking), `crm-config.controller.ts`.
- `crm-api.service.ts` skeleti (Bearer + **User-Agent SHART**, p-limit ≤6rps, 429 retry_after 300) + `POST /crm/admin/test-connection` (`GET /leads/pipelines` ping, hech narsa yaratmaydi).
- Admin config kiritadi; `GET /crm/admin/health` checklist (`token_set`, `release_stage_set`, `field_mapping_ok`, `is_active`).
- **Deliverable:** per-market ulanish + config UI + ping ishlaydi.

### Bosqich 1 — INBOUND INTAKE (🥇 ASOSIY: CRM'dan buyurtma yaratish — asosiy qiymat)
- `receiveExternalOrders` → `createOneExternalOrder(...opts)` refaktor (status/post parametrlari).
- `OrderService.createOneCrmOrder` (status=NEW, post'siz, tasdiqsiz).
- `express.urlencoded` route wiring (`app.service.ts`, `express.json` dan oldin).
- `crm-webhook.controller` (auth-guard yoʻq, @HttpCode 200) + `crm-webhook.service` (subdomain-check → dedup → link-check → release-check → read-back → intake; har-doim 200).
- `crm-intake.service` + `crm-field.mapper` + `sato-resolver` (SOATO kaskad §5.3).
- `crm_lead_link` UNIQUE idempotentlik + `crm_webhook_log` dedup.
- **Deliverable:** CRM'da "dostavkaga chiqarildi" → PCS'da **NEW buyurtma**, operator qabul qiladi.

### Bosqich 2 — OUTBOUND status feedback (🥈 KERAK: PCS → CRM)
- `crm-feedback.service` queue engine (claimJobs, processQueue, @Cron */30s, retry, kill-switch) — oldingi rejadan qayta ishlatiladi.
- `crm-status.mapper` (Order_status → status_id, CLOSED-invariant).
- Hook (7.2): receiveNew/receiveWithScaner, sendPost, receivePost oilasi, sellOrder, partlySold, cancelOrder, rollback.
- `PATCH /api/v4/leads/{id}` (yagona) / `PATCH /api/v4/leads` (batch). p-limit, 429 backoff, `last_outbound_status_id` takror-guard.
- `crm-admin.service`: @Cron auto-retry + reconcile (drift tekshirish), listlar, redispatch, resolve-mismatch.
- **Deliverable:** CRM-operatori voronkada yetkazish bosqichini kuzatadi.

### Bosqich 3 — IXTIYORIY: PCS'da tugʻilgan buyurtmani CRM'ga lead qilib yuborish
- PCS operator/bot/AI/QR buyurtmasi (link'siz) → CRM'da yangi lead yaratish.
- `POST /api/v4/leads/complex` (lead+contact bitta chaqiruvda; dedup control; max 50/soʻrov) yoki `POST /api/v4/leads` (ARRAY).
- `create_lead` operation queue'da; yaratilgach javobdagi `id` → `crm_lead_link` yoziladi → keyin feedback ham ishlaydi.
- **Asosiy talab EMAS** — biznes tasdiqlagach qoʻshiladi.

---

## 11. Sinov strategiyasi

### Sandbox
- **Kommo bepul trial** (14 kun) / alohida test subdomain.
- Test voronka + release bosqich + custom-field (SOATO/manzil/telefon) + long-lived token.
- `crm_config.is_active=true` faqat dev muhitida.

### Unit testlar (Jest)
| Test | Nima tekshiriladi |
|---|---|
| `crm-field.mapper` (intake) | lead+contact → order DTO: telefon/manzil/summa toʻgʻri; `field_id` lar |
| `sato-resolver` | 4-bosqich kaskad: aniq SOATO → nom-fuzzy → mapping → sentinel; **random EMAS** |
| `crm-status.mapper` (feedback) | Order_status → status_id; CLOSED-invariant throw |
| Idempotentlik | (subdomain,lead_id) link bor → skip; parallel unique violation yumshoq |
| Config masking | getSafe() xom token qaytarmaydi; audit `masked_fields` |
| urlencoded parse | `leads[status][0][id]` nested-bracket toʻgʻri oʻqiladi |

### Integration testlar (mock axios)
| Test | Nima |
|---|---|
| **Intake e2e** | webhook(release) → read-back mock → **NEW buyurtma** yaratildi + `crm_lead_link` yozildi |
| **Intake idempotentlik** | bir xil lead ikki webhook → faqat **1 buyurtma**; keyingi status_lead → skip |
| Webhook autentlik | notoʻgʻri `account[subdomain]` → rad; release EMAS status_id → skip; xatoda 200 |
| Webhook 2s | 200 darhol, intake asinxron |
| Queue claim | FOR UPDATE SKIP LOCKED — ikki instance dublikat feedback yubormaydi |
| Retry/backoff | 429 → `retry_after 300`; 500 → RETRY_DELAYS; biznes-xato retry yoʻq |
| **Feedback e2e** | sell → queue → PATCH mock → CRM `status_id`=142 (Won); `last_outbound_status_id` yangilandi |

### Dry-run
- `POST /crm/admin/test-connection` → faqat `GET /leads/pipelines`, hech narsa yaratmaydi.
- Staging: CRM'da test lead → release bosqichga tort → PCS'da NEW buyurtma paydo boʻlishini kuzat.
- Buyurtmani sotib → CRM voronkada 142 (Won) ga oʻtishini kuzat.
- SOATO'siz lead → "aniqlanmagan" sentinel'ga tushishini + operator navbatida koʻrinishini tekshir.

---

## 12. Xavflar va ochiq savollar

### Xavflar

| Xavf | Taʼsir | Yumshatish |
|---|---|---|
| **SOATO/tuman CRM'da yoʻq** | Buyurtma notoʻgʻri regionga marshrutlanishi | §5.3 kaskad; random `allDistricts[0]` EMAS; "aniqlanmagan" sentinel + operator qoʻlda |
| **Webhook takror otishi** (status_lead qayta) | Dublikat buyurtma | `crm_lead_link` UNIQUE + release-trigger sharti + `crm_webhook_log` dedup |
| Parallel webhook (retry timeout) | Dublikat buyurtma | DB UNIQUE constraint (ilova-dedup yetarli emas — INPUT C §4) |
| amoCRM webhook HMAC yoʻq | Soxta webhook | Read-back GET + subdomain-check + hard-to-guess URL; money faqat read-back'dan |
| Intake `NEW` vs `RECEIVED` chalkashlik | Buyurtma notoʻgʻri oqimga | Aniq qaror: CRM intake = **NEW**, post'siz, tasdiqsiz (§4.1) |
| Long-lived token admin-huquqli, "less safe" | Sizsa akkaunt xavfda | Masking + kelajak AES + per-market izolyatsiya + tugashdan oldin rotatsiya |
| Rate-limit 7 rps IP-block (403) | Butun server IP bloklansa | p-limit ≤6, retry-storm yoʻq, batch, `retry_after` hurmat |
| `status_id` akkauntga xos | Notoʻgʻri mapping | Admin `GET /leads/pipelines`'dan aniq ID oʻqiydi; faqat 142/143 barqaror; health-check validatsiya |
| Money payload'dan olinsa (STRING) | Notoʻgʻri narx | Narx read-back'dan (GET), payload'dan EMAS |
| **Webhook API tarif-cheklovi** | Marketda `POST /api/v4/webhooks` ishlamasligi | UI orqali webhook qoʻshish (arzon tarifda ham); §ochiq savol #4 |
| Mahsulot order-item yaratilmasligi | Item detallari yoʻqoladi | Bosqich 1 = matn; Bosqich 2 = `crm_product_map` (§5.4) |

### Ochiq savollar (biznes / CRM)

1. **SOATO manbasi:** Marketlar CRM'da alohida "SOATO / tuman kodi" custom-field'ini toʻldiradimi (eng ishonchli), yoki faqat tuman **nomi** boʻladimi (fuzzy match)? Yoki select-option (enum) → mapping jadval?
2. **"Aniqlanmagan" sentinel tuman:** global bitta boʻladimi yoki region-boʻyicha? `config.default_district_id` qaysi tumanga qaraydi?
3. **Release trigger bosqichi:** har marketda amoCRM voronkasidagi qaysi aniq bosqich "dostavkaga chiqarildi"? (`release_stage_id` konfiguratsiyasi.)
4. **Webhook obuna usuli/tarif:** marketlar amoCRM tarifi Advanced/Pro/Enterprise'mi (API webhook) yoki UI orqali qoʻlda qoʻshiladimi?
5. **Mahsulot mapping (§5.4):** matn sifatida saqlaymizmi (Bosqich 1, sodda) yoki catalog_elements'ni PCS `product`'ga mapping qilamizmi (`OrderItemEntity`, ogʻirroq)?
6. **PARTLY_PAID feedback:** 142 (Won) ga tushirilsinmi yoki alohida "Qisman" `status_id`?
7. **Bosqich 3 (PCS→CRM lead yaratish):** kerakmi? Agar market barcha buyurtmalarini CRM'da koʻrishni istasa — ha; agar CRM faqat oʻz manbasini boshqarsa — yoʻq.
8. **CRM'da lead oʻchirilsa:** PCS buyurtmasi (yaratilgan) davom etadi (avtoritet PCS) — bu biznes uchun maqbulmi, yoki ogohlantirish kerakmi?

---

## 13. Ish hajmi bahosi

| Bosqich | Deliverable | Baho | Dev-kun |
|---|---|---|---|
| **Bosqich 0** | 4 entity + migratsiya, config service/controller, api skelet (Bearer+User-Agent), test-connection, health | **S–M** | 3–4 |
| **Bosqich 1 (INBOUND intake)** | `createOneCrmOrder` refaktor, webhook controller+service (subdomain-auth), intake mapper, SOATO kaskad, sentinel tuman, `crm_lead_link` UNIQUE idempotentlik, webhook dedup, e2e | **L** | 6–9 |
| **Bosqich 2 (OUTBOUND feedback)** | queue engine, status mapper, 7 hook, `PATCH /leads/{id}` (+batch), retry/rate-limit, admin (cron reconcile/retry, listlar, redispatch) | **M–L** | 5–7 |
| **Bosqich 3 (ixtiyoriy PCS→CRM)** | lead yaratish (`complex`-create), `create_lead` queue, link backfill | **M** | 4–6 |
| | **Jami (0–2, asosiy: intake + feedback)** | | **~14–20 kun** |
| | **Jami (0–3, toʻliq ikki-tomonlama)** | | **~18–26 kun** |

> Tavsiya: **Bosqich 0+1** (INBOUND intake — asosiy biznes qiymati: CRM buyurtmasi PCS'ga NEW boʻlib tushadi, ~9–13 kun) bilan boshlang. Ishlab-turgan intakeni koʻrsating, soʻng Bosqich 2 (feedback) bilan CRM-operatorga voronka kuzatishini qaytaring. Bosqich 3 — faqat biznes talab qilsa.