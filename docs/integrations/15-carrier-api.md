# 15 — Carrier API: tashqi yetkazuvchi BeePost'da bitta kuryer bo'lib ishlaydi

> Hujjat turi: **arxitektura va joriy etish hujjati (ichki)**
> Sana: 2026-11-10 · Til: O'zbek · Holat: **KOD YOZILMOQDA** — branch `feat/carrier-api`
> (`dev` dan `9c3d1906` da ajratilgan), deploy qilinmagan.
> Tashqi kontrakt: [`CARRIER_API.md`](../../CARRIER_API.md) (Elchi Carrier API'ning
> BeePost nashri, Ilova A — profil farqlari) · Statik spec: [`../carrier-openapi.json`](../carrier-openapi.json)
> Tayanch: Elchi-Backend `feat/carrier-api` @ `affbd7b4` — `docs/public/CARRIER_API.md`,
> `apps/api-gateway/src/carrier-*.ts`, `apps/integration-service/src/carrier/`.

---

## 0. Xulosa (30 soniyada)

**Nima:** tashqi yetkazuvchi kompaniya bir marta Elchi'ning Carrier API'siga
integratsiya yozadi va BeePost bilan ham **faqat baza manzili va kalitni
almashtirib** ishlaydi. Yo'llar, maydonlar, javob shakllari, `code` satrlari va
HTTP statuslari bir xil; farqlar `CARRIER_API.md` Ilova A da.

**Qanday:** kompaniya BeePost'da **bitta COURIER user**
(`users.external_provider = 'carrier'`). Har `/api/v1/carrier/*` so'rovi mavjud
kuryer amaliga aylanadi va o'sha kuryer nomidan bajariladi (`carrierActor` —
LDG/Elchi webhooklaridagi `elchiActor` naqshi, `order.service.ts:7843-7849`):

| Kontrakt | PCS amali |
|---|---|
| `POST /carrier/scan` | `PostService.receiveOrderForCourierById` (yangi; `receiveOrderByQrTokenForCourier` bilan umumiy yadro) |
| `sold` | `OrderService.sellOrder` |
| `partly_sold` | `OrderService.partlySold` |
| `cancelled` | `OrderService.cancelOrder` |
| `rollback` | `OrderService.rollbackOrderToWaiting` (`target_status: 'waiting'`) |
| `POST /carrier/returns` | `PostService.createCanceledPost` |

**Yangi pul mantiqi YO'Q.** Kassa, tarif, shtraf, investor ulushi — oddiy
kuryerdagidek. Yangi narsalar faqat tashqi qatlamda: kalit jadvali, guard,
idempotentlik daftari, xato filtri, ko'rinishlar (allowlist), alohida Swagger,
admin endpointlar.

**Admin UI:** Integratsiyalar → Yetkazuvchilar → «Carrier API» (Akkauntlar · Sozlamalar ·
Kalit · Faollik); pochta sahifasidagi kuryer tanlashda carrier kuryeri
«Carrier API» belgisi bilan ajratiladi.

**Bu fazada YO'Q:** per-buyurtma kuryer
hisob-kitobi (FIFO), `cancel_reason` ustuni, akkaunt bo'yicha tuman ro'yxati,
ochiq `GET order/qr-code/:token` ni yopish (alohida vazifa).

---

## 1. Qarorlar (egasi "tavsiya etilgan sukutlar" ni tasdiqladi)

| # | Qaror | Nega |
|---|---|---|
| D1 | Bog'langan kuryer: `users.external_provider = 'carrier'` (aynan shu satr). `'ldg'`/`'elchi'` hech qachon qayta ishlatilmaydi | `assertCourierOwnsOrder` faqat `'ldg'`/`'elchi'` uchun egalik tekshiruvini O'TKAZIB YUBORADI (`order.service.ts:2675-2694`). `'carrier'` bilan egalik tekshiruvi ishlaydi, push-dispatch esa ishga tushmaydi (`post.service.ts:964`, `:1104`, `:1111` aniq qiymat bilan solishtiradi) |
| D2 | Baza manzili global prefiks bilan: `https://<beepost-domain>/api/v1` → `/api/v1/carrier/*` | nginx faqat `/api/` ni backendga uzatadi; prefiksdan istisno qilish yangi nginx/SPA to'qnashuvi xavfini beradi |
| D3 | Kalit prefiksi `bpc_` (`CARRIER_KEY_PREFIX`) | Elchi `elc_` dan ajralib tursin — operator va loglarda qaysi tizim kaliti ekani ko'rinadi |
| Q2 | Shtrafdan ozodlik — avtomatik, `external_provider='carrier'` orqali | Mavjud PCS xulqi: har qanday `external_provider` kechikish shtrafini o'chiradi (`courier-penalty.service.ts:138`) |
| Q4 | Naqd topshirilgandan keyin ham rollback ruxsat | PCS'da per-buyurtma kuryer hisob-kitobi yo'q; FIFO bu fazada qilinmaydi. Ilova A15 da hujjatlangan |
| Q5 | Bekor sababi: `cancelOrder` ga `comment = "[<REASON>] <comment>"` + activity-log `metadata.reason`. Yangi ustun yo'q | Hisobot uchun ustun keyin kerak bo'lsa — alohida migratsiya |
| Q6 | `proof` qabul qilinadi va Elchi qoidalari bilan tekshiriladi (MIME, rasm/pdf ≤10 MB, video ≤50 MB), keyin **tashlanadi** (saqlanmaydi). Multer memory storage, 50 MB qat'iy chegara | PCS'da isbot faqat qo'shimcha xarajat yoki yashirin narx tushirishda kerak; v1 ikkalasini ham taqiqlaydi. Elchi uchun yozilgan kod buzilmasin |
| Q7 | Alohida Swagger `/api/v1/carrier-docs` (JSON `/api/v1/carrier-docs-json`). Dev'da ochiq; production'da faqat `CARRIER_DOCS_ENABLED` ∈ {true,1,yes} **va** `CARRIER_DOCS_PASSWORD` bo'lsa, HTTP Basic Auth ortida (qo'lda yozilgan middleware, `timingSafeEqual`, yangi npm paket yo'q). Statik `docs/carrier-openapi.json` ham commit qilinadi | Tashqi dasturchiga ichki API xaritasi kerak emas; asosiy Swagger production'da o'chiq (`app.service.ts:216-221`) |
| Q8 | Admin endpointlari: SUPERADMIN va ADMIN | Boshqa integratsiya panellari bilan bir xil |
| Q11 | Almashtirish (kafolat-swap) buyurtmalari ruxsat | `old_item_required:false` bo'lsa adapter `old_item_collected:true` ni o'zi yuboradi (§6.4) |
| Q12 | Kuryer-kassa modeli (Elchi Carrier API'dagi kabi) | `06-platforma.md` §6 dagi "status-only qarz daftari" tavsiyasi bu kontraktga qo'llanmaydi — u yerga 2026-11 eslatmasi qo'shildi |
| Q13 | `waiting_customer` yo'q: yetkazib bo'lmagan posilka `waiting` da qoladi | PCS'da bu holat yo'q (`common/enums/index.ts:79-91`) |
| — | Bu fazada **client kodi yo'q** (`P/client` ga tegilmaydi) | Egasi avval dizaynni tasdiqlaydi |
| — | `GET order/qr-code/:token` dagi ochiq route bu yerda tuzatilmaydi | Alohida vazifa; xavf §7 da |

---

## 2. Modul xaritasi

```
server/src/
├── core/entity/
│   ├── carrier-account.entity.ts           carrier_account (kalit xeshi, IP ro'yxati, kuryer)
│   └── carrier-idempotency-key.entity.ts   carrier_idempotency_key (Idempotency-Key daftari)
├── migrations/1751100000000-CarrierApi.ts  ikki jadval, IF NOT EXISTS, nomlangan PK/FK/UQ/IDX
└── api/carrier/
    ├── carrier.module.ts                   controllerlar tartibi: Admin, keyin Public
    ├── carrier-error-codes.ts              CARRIER_*/IDEMPOTENCY_* kodlari (Elchi bilan aynan), bpc_, carrierActor
    ├── carrier-account.service.ts          kalit yaratish/xesh, validateKey, admin amallar
    ├── carrier-admin.controller.ts         /api/v1/carrier-accounts (JWT + RolesGuard + @AcceptRoles)
    ├── carrier-public.controller.ts        /api/v1/carrier/* (X-Api-Key)
    ├── carrier.service.ts                  orkestrator: egalik, oldindan tekshiruv, xato xaritasi
    ├── carrier-idempotency.service.ts      kalitni atomar olish, lease, holatlar
    ├── carrier-order-view.ts               toCarrierOrderView (Elchi allowlist'i)
    ├── carrier-cashbox-view.ts             toCarrierCashboxView (PCS manba turlari bilan)
    ├── carrier-swagger.ts                  alohida OpenAPI hujjati + Basic Auth
    ├── dto/                                Elchi DTO nomlari va maydonlari aynan
    ├── guards/                             CarrierIpThrottlerGuard (kalitdan oldin), CarrierApiKeyGuard, CarrierThrottlerGuard
    ├── filters/carrier-exception.filter.ts {statusCode, message, code?, trace_id}
    └── utils/ip-allowlist.ts               IPv4, IPv4 CIDR, kanonik IPv6
```

**Modul tashqarisidagi o'zgarishlar (minimal):**

| Fayl | O'zgarish |
|---|---|
| `api/app.module.ts` | `CarrierModule` import |
| `config/index.ts` | `CARRIER_THROTTLE_LIMIT`, `CARRIER_THROTTLE_TTL_MS`, `CARRIER_IP_THROTTLE_LIMIT`, `CARRIER_DOCS_ENABLED`, `CARRIER_DOCS_USER`, `CARRIER_DOCS_PASSWORD` |
| `api/users/users.service.ts` | Faqat `external_provider = 'carrier'` kuryer uchun: login 400 (parol to'g'ri bo'lsa ham), refresh 401, `selfUpdate` 403, admin `updateCourier` da parol 400 (R14). Boshqa foydalanuvchilar uchun xulq o'zgarmagan |
| `api/app.service.ts` | `setupCarrierSwagger(app)` — global prefiksdan keyin, o'z `try/catch` ida |
| `api/post/post.module.ts` | `exports: [PostService]` (hozir hech narsa eksport qilmaydi, `:32-34`) |
| `api/post/post.service.ts` | (1) `receiveOrderForCourierById` — token metodining aynan o'sha semantikasi, buyurtma id bo'yicha; ikkalasi bitta yadroni ulashadi. (2) `reassignCourier` — eski yoki yangi kuryer `'carrier'` bo'lsa: avval pochta, keyin buyurtmalar qulflanadi; pochtada `on the road`/`waiting` dan boshqa holat bo'lsa 400; yangi kuryer carrier bo'lsa `courier_tariff` `sendPost` dagidek qayta muzlatiladi, qayta muzlatib bo'lmaydigan begona tarif — 400 (§6.2). Oddiy kuryerlar uchun xulq O'ZGARMAYDI |
| `server/scripts/generate-carrier-openapi.ts` | `npm run docs:carrier-openapi` → `docs/carrier-openapi.json` (DB'siz) |

⚠️ **`OrderService` konstruktoriga tegilmaydi (B10 tuzog'i).** `DashboardModule`
o'zining `OrderService` providerini e'lon qiladi; yangi bog'liqlik u yerda
yo'q bo'lsa ilova faqat ishga tushishda yiqiladi (`dashboard.module.ts:44-47`,
`order-service-di.spec.ts`). Carrier qatlami `OrderService`/`PostService` ni
TASHQARIDAN chaqiradi; `carrier-wiring.spec.ts` buni qulflaydi.

### So'rov yo'li

```
nginx  location /api/v1/carrier/  (client_max_body_size 64m, X-Forwarded-For)
  │
  ▼
Express  trust proxy 'loopback' → req.ip = haqiqiy mijoz IP (app.service.ts:117)
  │
  ▼
CarrierIpThrottlerGuard   kalitdan OLDIN
  0. yo'l kanonik emas (/api/v1/CARRIER/…)  → 404 (savat ochilmaydi)
  –  bitta IP, barcha carrier endpointlari, 600/60 s (CARRIER_IP_THROTTLE_LIMIT) → 429
  │
  ▼
CarrierApiKeyGuard
  0. yo'l kanonik emas                     → 404 (guard tartibi o'zgarsa ham)
  1. X-Api-Key yo'q                        → 401
  2. validateKey() DB xatosi               → 503 CARRIER_KEY_CHECK_UNAVAILABLE
  3. kalit topilmadi                       → 401 (1-band bilan bir xil xabar)
  4. akkaunt is_active=false               → 403
  5. IP ro'yxatda yo'q                     → 403 (aniqlangan IP xabarda) — kuryer holatidan OLDIN
  6. kuryer faol emas / 'carrier' emas     → 403 CARRIER_COURIER_INACTIVE
  7. request.carrier = {id, name, courier_user_id}; last_used_at (≤1/daq)
  │
  ▼
CarrierThrottlerGuard   bitta akkaunt = bitta savat (barcha handler), 120/60 s
  │
  ▼
FileInterceptor('proof') memory, 50 MB → oshsa 413 (Nest multer transform)
  │
  ▼
global ValidationPipe   whitelist + forbidNonWhitelisted → 422 …
  │                                          … CarrierExceptionFilter uni 400 qiladi
  ▼
CarrierPublicController → CarrierService → OrderService / PostService (carrierActor)
```

`CarrierExceptionFilter` faqat public controllerga `@UseFilters` bilan
qo'yilgan: har xato `{statusCode, message, code?, trace_id}` + `X-Trace-Id`
sarlavhasi; validatsiya 422 → 400; 429 `Retry-After` bilan; 5xx va
HTTP bo'lmagan xatolar → umumiy matn (ichki xato matni tashqariga chiqmaydi),
logda `trace_id`, carrier id, method, url, stack. Global `AllExceptionsFilter`
`code` ni tashlab yuborardi (`all.exception.filter.ts:23-48`) — shu sabab
alohida filtr.

---

## 3. Endpointlar — adapter nimani tekshiradi

| Endpoint | Adapter tekshiruvi (PCS xizmatidan OLDIN) | PCS chaqiruvi |
|---|---|---|
| `GET /carrier/ping` | — | — |
| `POST /carrier/scan` | `normalizeQrToken`; egalik filtri bilan qidiruv (`qr_code_token = :t` VA egalik). Bir nechta mos qator (token noyob emas, `order.entity.ts:47-50`) → yakuniy bo'lmagan holat, keyin eng yangisi | Holat `on the road` → `receiveOrderForCourierById`. Poyga bo'lsa qayta o'qish: endi `waiting` va sizniki → `received:false`. Boshqa holat → `received:false` |
| `POST /carrier/orders/:id/status` | UUID (400); `Idempotency-Key` (≤255, bo'sh emas, aks holda 400 `CARRIER_IDEMPOTENCY_KEY_REQUIRED`); egalik (404); `sold`/`partly_sold`/`cancelled` → holat `waiting`; `rollback` → aynan `sold`/`cancelled`; proof qoidalari | §5 bo'yicha idempotent bajarish |
| `GET /carrier/orders` | Elchi holatlarining to'liq ro'yxati qabul qilinadi; `from`/`to` Toshkent kuni (`toUzbekistanTimestamp`), kalendarda bor kun bo'lishi shart (`2026-02-31` → 400; Elchi jimgina keyingi oyga suradi — Ilova A25); `limit` ∈ {10,25,50,100} | Alohida QueryBuilder (`allCouriersOrders` ishlatilmaydi — u `IN (...)` ro'yxati quradi va qaytarilganlarni chiqarmaydi) |
| `GET /carrier/cashbox` | Oyna: sukut 30 kun, eng ko'pi 92 kun | Kuryerning `FOR_COURIER` kassasi + oynadagi `cashbox_history` (`myCashbox` emas — u "bugun" ni oladi va xodim ma'lumotini qo'shadi) |
| `POST /carrier/returns` | 1–50 UUID; **kompaniya bo'yicha navbat** (`carrier_returns:<kuryer>` advisory lock, R16); allaqachon shu kuryerning CANCELED pochtasida → o'sha `post_id` (idempotent); sizniki emas → 404 (butun so'rov); `cancelled` emas → 400 | Qolganlari → `createCanceledPost` (u qayta yuborilgan id'ga 400 berardi, `post.service.ts:1765-1771`) |

**`partly_sold` qo'shimcha qoidalari** (PCS `partlySold` ularni o'zi
tekshirmaydi, `order.service.ts:4085-4095` atrofidagi izoh):

- buyurtmada kamida bitta `order_item` qatori bor (marketplace va tashqi
  buyurtmalarda qator yo'q — `marketplace-intake.service.ts:73-76`; aks holda
  `partlySold` bo'sh ro'yxat bilan oddiy narx tushirishga aylanardi);
- almashtirish buyurtmasi emas (`partlySold` da almashtirish darvozasi yo'q);
- bitta `productId` ikki qatorda emas (PCS qatorlarni `product_id` bo'yicha
  moslaydi, `:4160-4174`);
- har asl qator aynan bir marta, `order_item_id` yoki `product_id` bo'yicha;
- har qatorda `0 ≤ quantity ≤ asl`; kamida bitta qator kamaygan va kamida
  bitta dona sotilgan;
- `total_price` butun son, `0 ≤ total_price ≤ order.total_price`.

Har qatorlik tekshiruv nega SHART: har qanday `external_provider` bo'lsa narx
tushirish siyosati izohsiz va isbotsiz avtomatik qo'llanadi
(`extra-cost-policy.util.ts:111-116`), "yashirin narx tushirish" tekshiruvi
esa faqat jami donaga qaraydi (`order.service.ts:4113-4115`). Bir qatorga +1,
boshqasiga −1 — shu teshik.

**`rollback` qo'shimcha rad etishlari:** bola buyurtma (`parent_order_id`
bor) — 400; qisman sotilgan ota buyurtmaning biror bolasi `cancelled` emas
yoki `canceled_post_id` bor — 400 (M1, §6.4).

---

## 4. Egalik va 404 siyosati

**Yagona predikat (hamma joyda):** buyurtma carrier'niki ⇔
`order.post_id → post.courier_id = carrier.courier_user_id` **va**
`order.control_owner IS NULL`; yoki (qaytarilgan buyurtma uchun) uning
`canceled_post_id` pochtasining `courier_id` si carrier kuryeri.

- Sizniki emas, topilmadi, Elchi nazoratida (`control_owner='elchi'`) — hammasi
  bir xil **404** "Buyurtma topilmadi yoki sizga biriktirilmagan". Borligi
  aytilmaydi.
- `control_owner` filtrda bo'lmasa `assertControlAllowed` ning 409 i
  (`order.service.ts:2723-2741`) provayderga idempotentlik 409 i bo'lib
  ko'rinardi.
- PCS o'zi egalik xatosiga **403** beradi (`:2696`); adapter uni 404 ga
  aylantiradi (§5, 2-qoida).
- ⚠️ "404 borligini yashiradi" va'dasi PCS'da **to'liq emas**: ochiq
  `GET /api/v1/order/qr-code/:token` (guard izohga olingan,
  `order.controller.ts:356-367`) QR'ni bilgan har kimga buyurtmani mijozi
  bilan beradi. Alohida vazifada yopiladi (§7).

---

## 5. Idempotentlik va xato xaritasi

**Daftar:** `carrier_idempotency_key`, unique `(carrier_account_id, key_hash)`;
`key_hash = sha256(Idempotency-Key)`; `binding = <action>:<orderId>:<fingerprint32>`,
fingerprint — proof'siz DTO'ning kanonik JSON'idan sha256 ning birinchi 32
hex belgisi (Elchi `courierOpFingerprint`). Qatorlar **o'chirilmaydi**: eskirgan
kalitni aniqlash `completed` qatorlarga tayanadi.

| Mavjud yozuv | Natija |
|---|---|
| yo'q | `INSERT … ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE`; `in_progress`, `lease_until = now + 90 s`; amal bajariladi |
| `binding` boshqa | 422 `IDEMPOTENCY_KEY_MISMATCH` |
| `in_progress`, lease tugamagan | 409 `IDEMPOTENCY_IN_PROGRESS` |
| `failed` (4xx) | qayta olinadi (yangi lease) va bajariladi — avvalgi urinish yozmagani aniq |
| lease tugagan `in_progress` yoki `failed` (5xx) | qayta olinadi; avvalgi urinish commit qilgan bo'lishi **mumkin** (`priorAttemptMayHaveRun`): buyurtma qayta o'qiladi va **pre-checklardan oldin** shu amal natijasidami tekshiriladi (`isRecoveredOutcome`) → ha bo'lsa 200, amal yuritilmaydi; yo'q bo'lsa eng yangi holat bilan bajariladi |
| `completed` | amal **bajarilmaydi**; buyurtma `acquire` dan **keyin** qayta o'qiladi: holat maqsadda → 200 `{order, refreshed:true}`; aks holda 409 `CARRIER_IDEMPOTENCY_KEY_STALE`; o'qib bo'lmasa 503, begona — 404 |

**Maqsad holatlar:** `sold`/`partly_sold` → `sold`, `paid`, `partly_paid`;
`cancelled` → `cancelled`, `cancelled (sent)`, `closed`; `rollback` → `waiting`.

**PCS xizmati xato tashlasa** (Elchi'ning "404 → 503" qoidasi O'RNIGA — PCS'da
"waiting emas" 404 bo'lib keladi, `order.service.ts:2889`, `:3927`, `:3934`,
ya'ni Elchi qoidasi takroriy sotuvni qayta urinish sikliga aylantirardi):
xom buyurtma qayta o'qiladi va

1. sizniki va holat maqsadda → muvaffaqiyat (200) — crash oynasi va bir
   vaqtdagi ayni amal;
2. `control_owner` dan `ConflictException` yoki endi sizniki emas → 404;
3. holat oldingidan o'zgargan (maqsad emas) → 400 "Buyurtma holati o'zgardi: <status>";
4. holat o'zgarmagan va sizniki: asl `BadRequestException` → 400 o'z xabari
   bilan; `NotFoundException`/boshqa → 503 `CARRIER_TEMPORARILY_UNAVAILABLE`
   (error darajada log).

Muvaffaqiyatdan keyin: qayta o'qish; holat maqsadda emas va oldingisiga teng →
409 `CARRIER_IDEMPOTENCY_KEY_STALE` (Elchi `carrier-gateway.controller.ts:839-869`).
Qayta o'qish yiqilsa → 200 `{order: null, refreshed: false}`.

**Crash oynasi (pul amali commit bo'ldi, kalit `completed` bo'lmadi):** deploy
(`systemctl restart`, shutdown hook yo'q), OOM, commit'dan keyingi Telegram
chaqiruvi (`syncStatusButton`) 90 s dan oshishi yoki xatodan keyingi qayta
o'qishning ham yiqilishi. Kalit qayta egallanganda "maqsad holat" qoidasi
kontrakt pre-checklaridan ("faqat waiting", "rollback faqat sold/cancelled")
**oldin** ishlaydi — aks holda bajarilgan sotuvga ayni kalit bilan qayta
urinish 400 "waiting emas" (kontraktda "qayta urinmang") olardi. Amaldan
oldingi nusxa yo'q, shuning uchun qoidalar joriy holatdan: `sold` —
`original_total_price` bo'sh (to'liq sotuv uni to'ldirmaydi, rollback
tozalaydi); `partly_sold` — u to'la va summa aynan so'ralgan; `cancelled` /
`rollback` — maqsad holat. Tiklangan amal audit'ga `recovered_after_takeover:
true` bilan yoziladi (asl yozuv commit'dan keyin yo'qolgan bo'lishi mumkin).
`failed` (4xx) kalitga bu qoida qo'llanmaydi: avvalgi urinish yozmagani aniq,
maqsad holat esa boshqa kalitniki. Activity log'ga tayanib bo'lmaydi — u
commit'dan KEYIN, kutilmasdan yoziladi va xatosi yutiladi
(`order.service.ts:3384`/`:3393`, `activity-log.service.ts:31-33`). Bu
xavfsiz, chunki kuryer nomidan faqat API ishlaydi: bog'lashda parol tasodifiy
bcrypt xesh, `UserService` esa carrier kuryeriga login, refresh, o'z
profilini o'zgartirish va admin parol qo'yishini rad etadi (R14).

Har amal `ActivityLogService` ga yoziladi (`entity_type: Order`,
`action: carrier.<status>`, metadata: `carrier_account_id`, `carrier_name`,
kalit xeshi prefiksi, `reason`), best-effort.

---

## 6. Pul oqimi

### 6.1 Amallar

| Amal | Kassa | Manba |
|---|---|---|
| `sold` | Kuryer kassasi **+(narx − kuryer tarifi)** (kompaniya BeePost'ga qarzdor); market kassasi +(narx − market tarifi). Narx tarifdan kam/0 bo'lsa kuryer `expense` (`:3036-3077`) | `order.service.ts:3100-3122` |
| `partly_sold` | Xuddi shu, yangi narx bilan; sotilmagan qism — o'sha pochtadagi `CANCELLED` bola buyurtma, kassasiz | `:4178-4255`, `:4553-4575` |
| `cancelled` | Pul harakati yo'q (v1 da `extraCost` taqiqlangan) | `:3684-3689` |
| `rollback` | `rollback_correction` qatorlari muzlatilgan tariflar bilan; API'da `correction` bo'lib ko'rinadi | `:5019-5115` |
| Naqd topshirish | Admin `POST /api/v1/cashbox/payment/courier` → kuryer kassasi `courier_payment` chiqim, MAIN kirim. Smena ochiq bo'lishi SHART | `cash-box.service.ts:1143`, `:1184-1243` |
| Shtraf | Carrier kuryeri ozod (`external_provider`) — `courier_penalty` qatori yozilmaydi | `courier-penalty.service.ts:138` |
| Investor ulushi | Marja = market tarifi − kuryer tarifi; provayder haqi marjani oddiy kuryerdek kamaytiradi | `order.service.ts:6106-6130` |

Hammasi `applyCashboxDelta` orqali (`cashbox-delta.util.ts:74-170`) — deploy'dagi
kassa/market/investor/shtraf invariantlari carrier amallarini ham qamraydi.

### 6.2 Tarif (provayder haqi)

- Sotuvda muzlatilgan `order.courier_tariff`, bo'lmasa kuryerning
  `tariff_center`/`tariff_home` (`order.service.ts:2991-2996`).
- Hudud bo'yicha haq kerak bo'lsa: kuryer **super-kuryer** + `courier_regions`
  tariflari; `sendPost` ularni har buyurtmaga muzlatadi
  (`post.service.ts:1000-1031`).
- `reassignCourier` ilgari tarifga tegmasdi (A4): carrier kuryeriga ko'chirilgan
  pochta eski kuryer tarifini olib qolardi. Endi yangi kuryer carrier bo'lsa
  tarif `sendPost` dagidek qayta muzlatiladi; pochtada `on the road`/`waiting`
  dan boshqa holatli buyurtma bo'lsa ko'chirish rad etiladi (eski yoki yangi
  kuryer carrier bo'lganda). Oddiy kuryerlar uchun xulq o'zgarmagan.
- Qayta muzlatib bo'lmaydigan buyurtmada (carrier super kuryer emas yoki shu
  yetkazish turi uchun tarifi yo'q) **begona** muzlatilgan tarif bo'lsa —
  ko'chirish rad etiladi (400, buyurtma raqamlari bilan). Qaror buyurtmalarga
  qarab, eski kuryerga emas: sotilib rollback qilingan buyurtma sotuvchi
  kuryer tarifini saqlaydi (`rollbackOrderToWaiting` uni tozalamaydi), pochta
  esa super kuryerdan oddiy kuryer orqali carrier'ga o'tishi mumkin
  (S → A → C). Begona emas: `NULL`, `0` (marketplace ko'p qutili buyurtmaning
  to'lovsiz qutisi) va carrier'ning o'z stavkasiga teng qiymat. Chiqish yo'li —
  carrier kuryerini super kuryer qilish (hudud tariflari bilan).
- Carrier ishtirokidagi `reassignCourier` avval **pochtani**, keyin
  buyurtmalarni qulflaydi — qabul yo'llari (`receiveSingleOrderForCourier`,
  `receivePost`) bilan bir xil tartib, deadlock yo'q.

### 6.3 Elchi kontraktidan farq: FIFO yo'q

Elchi topshirilgan naqdni eng eski sotuvlarga bog'laydi va "yopilgan" sotuvni
rollback qilmaydi. PCS'da kuryer tomonida per-buyurtma hisob-kitob ustuni
yo'q, kuryer rollback'i faqat holatga qaraydi (`order.service.ts:4899-4906`).
Natija: naqd topshirilgandan keyingi rollback kuryer kassasini **manfiyga**
tushirishi mumkin (BeePost provayderga qarzdor). Q4 bo'yicha qabul qilingan va
`CARRIER_API.md` Ilova A15 da hujjatlangan. Parity kerak bo'lsa — alohida faza
(kuryer settlement ustuni + `paymentsFromCourier` da FIFO; ~5–7 kun, pul
yadrosi va deploy invariantlariga tegadi).

### 6.4 Pul chekka holatlari (adapter yopadi)

| # | Holat | Yechim |
|---|---|---|
| M1 | Qisman sotilgan buyurtmani rollback qilish, sotilmagan qismi allaqachon `cancelled (sent)`. `mergePartialChildrenBack` faqat `CANCELLED` bolalarni qo'shadi (`:4797-4802`), lekin `total_price` ni doim `original_total_price` dan tiklaydi (`:4852-4853`) → ota `waiting` ga **to'liq narx, kamaygan dona** bilan qaytadi; qayta sotuv qaytarilgan tovar uchun kassaga pul yozadi | Adapter rad etadi (400). ⚠️ Bu nuqson **ichki kuryerlar uchun ham bor** — alohida tuzatish kerak (§10) |
| M2 | Almashtirish buyurtmasi sotib, rollback qilingan: `replacement_state` `old_collected` qoladi → ko'rinishda `old_item_required:false`, `sellOrder` esa baribir `old_item_collected:true` talab qiladi (`:2902-2908`) | Holat `old_collected`/`old_returned` bo'lsa adapter `old_item_collected:true` ni o'zi yuboradi |
| M3 | Almashtirish sotilganda eski buyurtma (SOLD) jimgina carrier'ning CANCELED pochtasiga biriktiriladi (`attachReplacementToCanceledPost`, `:2752-2795`) | API'da ko'rinmaydi; Ilova A18 da yozilgan. Jismoniy qaytarish tartibi — ochiq savol (§10) |
| M4 | Marketplace va tashqi buyurtmalarda `order_item` yo'q | `partly_sold` → 400; Ilova A11 |

---

## 7. Xavflar

| # | Xavf | Ta'sir | Yumshatish / holat |
|---|---|---|---|
| R1 | **Ochiq QR route** `GET /api/v1/order/qr-code/:token` (guard izohda, `order.controller.ts:356-367`) | Yorliqni bilgan har kim buyurtma va mijoz ma'lumotini oladi; carrier'ning 404 siyosatini chetlab o'tadi | Alohida vazifa (egasi qarori). Provayder hujjatida aytilmaydi |
| R2 | `reassignCourier` va tarif | Carrier'ga ko'chirilgan pochta noto'g'ri tarif bilan sotilardi; rollback pochta kuryeridan yechadi (`:4928-4943`) | Carrier uchun guard + tarifni qayta muzlatish; qayta muzlatib bo'lmaydigan begona tarif — rad (§6.2). Teskari yo'nalish (carrier → ichki kuryer) ochiq savol (§11) |
| R3 | FIFO yo'q | Rollback naqd topshirilgandan keyin kassani manfiy qiladi | Q4 qabul qilingan; hujjatlangan; kassa tarixi bo'yicha solishtirish |
| R4 | **QR Elchi bilan umumiy.** BeePost Elchi'ga jo'natganda `label_token = order.qr_code_token` (`elchi-shipment.service.ts:556-569`) | Bitta yorliq ikkala tizimda ham topiladi | Ikki marta pul YO'Q: BeePost'da `control_owner='elchi'` → 404; Elchi'da faqat provayderga biriktirilgan bo'lsa. Ilova A.4 da yo'naltirish qoidasi |
| R5 | `qr_code_token` noyob emas; marketplace/tashqi buyurtmada hamkor yorlig'i | Boshqa kuryerning qatori olinishi | Egalik filtri bilan qidiruv + id bo'yicha receive (token metodi egasiz `findOne` qiladi, `post.service.ts:1408-1411`) |
| R6 | Throttler xotirada | Bir nechta instans bo'lsa limit instanslar soniga ko'payadi | Hozir bitta systemd unit (`deploy.yml:392`); cluster rejimi tekshirilmagan |
| R7 | IP ro'yxati nginx'ga bog'liq | (a) carrier blokida `X-Forwarded-For` uzatilmasa hamma so'rov `127.0.0.1` dan ko'rinadi → ro'yxatli akkaunt 403. (b) Express yo'llari registrga sezgir emas: `/api/v1/CARRIER/…` nginx carrier blokini chetlab umumiy `/api/` blokiga tushadi; u blok XFF ni qayta yozmasa mijoz yuborgan XFF `req.ip` bo'ladi — bu **ochiq** (soxta IP ro'yxatdan o'tadi), yopiq emas | (b) ilovada yopilgan: kanonik bo'lmagan yo'l 404 (`isCanonicalCarrierPath`, ikkala guard). `DEPLOY-CHECKLIST.md` §3.5 (XFF ni `server{}` darajasida ham) va smoke #16, #19 |
| R8 | SOATO to'liqligi | `soato_code: null` — provayder geo'ni moslay olmaydi | Pilotdan oldin provayder tumanlari bo'yicha `district.sato_code`/`region.sato_code` ni tekshirish (`1749600002000-DistrictSatoBackfill.ts:7-9`: backfill'gacha 184 dan 71 tasida kod bor edi) |
| R9 | Carrier kuryeri kuryer tanlash ro'yxatlarida ko'rinadi (super-kuryer bo'lsa — har hududda) | Xodim adashib unga ichki pochta jo'natadi | Kuryer nomini aniq qo'ying (masalan "[Carrier] BTS Express"); pochta sahifasidagi kuryer tanlashda «Carrier API» belgisi (`CarrierApiChip`) |
| R10 | Tuman ro'yxati yo'q (O5) | Provayder xizmat qilmaydigan hududga pochta jo'natilishi mumkin | Hozircha operator tartibi; kerak bo'lsa akkauntga SOATO allowlist (§10) |
| R11 | Filtrdan tashqaridagi xatolar | Noma'lum yo'l, buzilgan JSON — `code`/`trace_id` siz | Ilova A23 da hujjatlangan |
| R12 | Activity log best-effort | Audit yozuvi yo'qolishi mumkin | Pul haqiqati — kassa tarixi va idempotentlik daftari, log emas |
| R13 | CI faqat `main` ga push'da ishlaydi (`deploy.yml:3-6`) | Bloklovchi testlar xatoni faqat deploy paytida ushlaydi | PR'dan oldin lokal `npx jest src/api/carrier …` |
| R14 | Bog'langan kuryer bilan login | Bog'lashdan oldin ochilgan JWT sessiya (stateless) bog'lashdan keyin ham yashab, `PATCH /user/self` da parol qo'yib, kuryer ilovasi orqali kalit, IP, o'chirgich va adapter pul qoidalarini (`extraCost` → EXTERNAL_AUTO) chetlab o'tardi | Bog'lashda parol tasodifiy; `UserService`: carrier kuryeriga login (parol to'g'ri bo'lsa ham) 400, refresh 401 (cookie tozalanadi), `selfUpdate` 403, admin `updateCourier` parol 400. Bog'lash `ACCESS_TOKEN_TIME + REFRESH_TOKEN_TIME` ichida login bo'lgan kuryerni rad etadi — bog'lashdan oldin berilgan access token ham qolmaydi |
| R15 | Kalitsiz oqim | Kalit guardi limitdan oldin: noto'g'ri kalitlar 429 olmay bazaga va WARN log'ga cheksiz yuk berardi | `CarrierIpThrottlerGuard` (600/daq/IP, kalitdan oldin, xotirada — R6 bilan bir xil cheklov) |
| R16 | Parallel `/carrier/returns` | PCS `createCanceledPost` buyurtmalarni advisory lock'dan oldin o'qiydi — ikki parallel takror qaytarish pochtasi `order_quantity`/`post_total_price` ni ikki marta oshirardi | Kompaniya so'rovlari `carrier_returns:<kuryer>` advisory lock bilan navbatda (`lock_timeout` 15 s → 503). PCS'dagi ildiz poyga (kuryer UI'da ikki marta bosish) — alohida vazifa (§11) |

---

## 8. Ulanish tartibi (operator)

1. **Kuryer.** `Foydalanuvchilar → Kuryer qo'shish` (`POST /api/v1/user/courier`).
   Tarif = provayderning bir buyurtma uchun haqi; hudud bo'yicha haq kerak
   bo'lsa super-kuryer + hudud tariflari. Kuryer **yangi** bo'lsin: pochtasi
   yo'q, kassa balansi 0, `external_provider` bo'sh, akkauntiga **hech kim
   kirmagan** (bog'lash buni tekshiradi va 400 beradi; kirib ko'rilgan bo'lsa
   — yangi kuryer oching). Qaysi filial naqd qabul qilishini oldindan kelishing.
2. **Akkaunt.** `POST /api/v1/carrier-accounts` `{ name, courier_id, ip_allowlist? }`
   (SUPERADMIN/ADMIN). Bir tranzaksiyada: kuryer `external_provider='carrier'`,
   parol tasodifiy, `FOR_COURIER` kassa kafolatlanadi, akkaunt yoziladi.
   Javobdagi `api_key` **bir marta** ko'rinadi — xavfsiz kanal bilan bering.
3. **IP.** Provayder chiquvchi IP'larini bersa — `PATCH /api/v1/carrier-accounts/:id`
   `{ ip_allowlist }` (ko'pi bilan 50 yozuv; IPv4, IPv4 CIDR, aniq IPv6).
4. **Sinov (staging).** Provayder `GET /carrier/ping` → 200. Ro'yxatga
   ataylab boshqa IP qo'yib 403 xabaridagi IP haqiqiy ekanini tekshiring
   (`127.0.0.1` bo'lsa nginx XFF uzatmayapti). Sinov buyurtmasi: pochta
   carrier kuryeriga jo'natiladi → `scan` → `sold` → `GET /carrier/cashbox`
   da kirim → `cancelled` → `returns` → markaz qabul qiladi.
5. **Ish.** Pochtalar carrier kuryeriga oddiy kuryerdagidek jo'natiladi
   (`sendPost`; kerak bo'lsa `orderIds` bilan qisman). Qaytarish pochtasini
   markaz `POST /api/v1/post/cancel/receive/:id` bilan qabul qiladi.
6. **Naqd.** `POST /api/v1/cashbox/payment/courier` (smena ochiq). Balans
   manfiy bo'lsa — BeePost provayderga qarzdor (§6.3).
7. **To'xtatish.** Vaqtincha: `POST /api/v1/carrier-accounts/:id/status`
   `{ is_active: false }`. Kalit sizdi: `POST /api/v1/carrier-accounts/:id/rotate-key`.
   Butunlay: `DELETE /api/v1/carrier-accounts/:id` (soft delete,
   `external_provider` NULL ga qaytadi — shtrafdan ozodlik va avtomatik
   qo'shimcha xarajat ham o'chadi, O4). Kuryerni bloklash ham kalitni darhol
   to'xtatadi, lekin qayta faollashtirsangiz eski kalit tiriladi.

---

## 9. elchi-cargo va ldg-cargo bilan munosabat

| | elchi-cargo / ldg-cargo | Carrier API |
|---|---|---|
| Yo'nalish | **Push**: PCS provayderga jo'natadi, provayder webhook yuboradi | **Pull**: provayder bizning API'ni chaqiradi |
| Kuryer | `external_provider` = `'elchi'` / `'ldg'` — egalik tekshiruvi O'TKAZIB YUBORILADI | `'carrier'` — egalik tekshiruvi ishlaydi |
| Dispatch | `sendPost` aniq qiymat bilan ishga tushiradi (`:1104`, `:1111`) | Hech narsa ishga tushmaydi |
| Nazorat | Elchi: `control_owner='elchi'`, BeePost UI amallari 409 | `control_owner` ishlatilmaydi (NULL bo'lishi shart) |
| Pul | Virtual kuryer kassasi (webhook nomidan) | Xuddi shu kuryer-kassa, API nomidan |

- Ikkalasi ham **saqlanadi** — qarama-qarshi yo'nalishlar.
- Carrier akkauntini `'ldg'`/`'elchi'` kuryeriga bog'lab bo'lmaydi (bog'lash
  `external_provider IS NULL` talab qiladi); guard har so'rovda
  `external_provider === 'carrier'` ni tekshiradi — Elchi/LDG `bindCourier`
  qiymatni tekshirmasdan qayta yozsa ham (`elchi-config.service.ts:236-245`,
  `ldg-config.service.ts:136-149`) kalit darhol 403 bo'ladi.
- **Provayder ikkala tizimda:** ikki akkaunt, ikki kalit, bitta kod. Elchi
  orqali jo'natilgan posilka BeePost kaliti bilan 404 (`control_owner`),
  Elchi kaliti bilan — Elchi uni provayderga biriktirgan bo'lsa topiladi. Ikki
  marta pul yo'q.
- **0-variant (kodsiz):** yangi cargo Elchi orqali ulanadi (BeePost → Elchi →
  provayder; `06-platforma.md` §5). Ikki bo'g'in va ikki tomonlama hisob-kitob;
  to'g'ridan-to'g'ri Carrier API — bitta bo'g'in. Operator pochta yoki buyurtma
  bo'yicha tanlaydi.
- LDG keyinchalik Carrier API'ga o'tishi mumkin — faqat LDG rozi bo'lsa; hozir
  hech narsa o'zgarmaydi.

---

## 10. Sinov va deploy

**Unit testlar** (uy uslubi: to'g'ridan-to'g'ri `new`, `jest.fn()` repolar,
o'zbekcha `it` sarlavhalari):
`carrier-account.service.spec.ts`, `guards/carrier-api-key.guard.spec.ts`,
`guards/carrier-throttler.guard.spec.ts`, `guards/carrier-ip-throttler.guard.spec.ts`,
`carrier-courier-session.spec.ts` (carrier kuryeriga JWT sessiya yo'q),
`filters/carrier-exception.filter.spec.ts`,
`utils/ip-allowlist.spec.ts`, `carrier.service.spec.ts`,
`carrier-idempotency.service.spec.ts`, `carrier-order-view.spec.ts`,
`carrier-cashbox-view.spec.ts`, `carrier-public.controller.spec.ts`,
`carrier-wiring.spec.ts`, `carrier-di.spec.ts` (haqiqiy `CarrierModule` DI
grafi + HTTP guard → filtr zanjiri, aylanma import yo'qligi),
`carrier-swagger.spec.ts` (`/api/v1/carrier-docs` ulanish qoidalari va Basic
auth), `carrier-openapi-drift.spec.ts`, `carrier-api-docs-contract.spec.ts`
(`CARRIER_API.md` jadvallari ↔ DTO/ko'rinishlar), `carrier-schema.spec.ts`
(entity ↔ migratsiya konstruksiya nomlari; hammasi `src/api/carrier/` ostida) va
`src/api/post/post-carrier-receive.spec.ts`.

**Uchdan-uchga sinov (haqiqiy Postgres):** `cd server && npm run test:carrier-e2e`
(`scripts/local/run-carrier-e2e.sh` → `test/carrier.e2e-spec.ts` +
`test/carrier-e2e-seed.sql`). Alohida `pcs_e2e` bazasi (marketplace e2e bilan
umumiy; yo'q bo'lsa sxema `.env` dagi dev bazadan nusxalanadi), to'liq
`AppModule` va `app.service.ts` dagi global sozlama. Seed'da faqat bazaviy
ma'lumot; akkaunt, buyurtma, ombor, `sendPost` (super kuryer tarifini
muzlatish bilan), skan, sold / partly_sold / cancelled / rollback, eskirgan
va band kalitlar, crash oynasi (commit bo'lgan, `complete()` yozilmagan kalit),
qaytarish (parallel takror ham) va markaz qabuli, `reassign` (begona
muzlatilgan tarif rad etilishi bilan), IP ro'yxati va katta harfli yo'l,
akkaunt va kalitdan oldingi IP limiti (429), carrier kuryeri login'i,
baza xatolarida 503/500, Swagger JSON (commit qilingan fayl bilan bir xil) —
HTTP orqali; pul `cash_box` / `cashbox_history` dan mustaqil tekshiriladi.
Lokal, CI'ga ulanmagan.

**CI:** `deploy.yml` → `💼 Carrier API testlari (BLOKLOVCHI)`:
`npx jest src/api/carrier src/api/post/post-carrier-receive.spec.ts --ci`.
Shuningdek `npm run audit:roles` (admin handlerlarda `@AcceptRoles`).

**OpenAPI drift:** `npm run docs:carrier-openapi` `docs/carrier-openapi.json` ni
qayta yozadi; `carrier-openapi-drift.spec.ts` xotirada qayta yaratib commit
qilingan fayl bilan solishtiradi. Controller/DTO o'zgarsa — faylni qayta
yarating va commit qiling. Elchi `docs/public/carrier-openapi.json` bilan
farq faqat `servers`, matnli tavsiflar va misollarda bo'lishi kerak. Yo'llar
(`/carrier/...`), sxema nomlari (`CarrierOrderDto`, `CarrierScanResponseDto`, …),
teg (`Carrier`) va `operationId` lar (`CarrierGatewayController_scan`, …)
**bir xil** bo'lishi shart: kod generatorlari klass va metod nomlarini
aynan shulardan yasaydi — farq qilsa provayderning generatsiya qilingan
klienti BeePost uchun boshqacha nomlanib, "bitta kod" buziladi.

2026-11-10 holati: tavsif/misol/`servers` dan tashqari hujjat Elchi fayli
bilan **tuzilma darajasida aynan bir xil** (yo'llar, metodlar, `operationId`,
parametrlar, tanalar, javoblar, 25 ta sxema va ularning maydonlari, kalit
tartibi ham). Ikki texnik moslash `carrier-swagger.ts` da: (1)
`operationIdFactory` — `CarrierPublicController_*` o'rniga Elchi'dagi
`CarrierGatewayController_*`; (2) `normalizeNullableRefs` — BeePost'dagi
`@nestjs/swagger` 11.2.0 `nullable` + `allOf` maydonlarga `type: object`
yozmaydi (Elchi'dagi 11.4.7 yozadi). OAS 3.0.3 bo'yicha `type` siz
`nullable` kuchga kirmaydi va kod generatorlari `customer`, `region`,
`order` kabi maydonlarni null bo'lmaydigan deb yasardi.

**Deploy:** migratsiya `1751100000000-CarrierApi` (ikki yangi jadval), nginx
`location /api/v1/carrier/` bloki, `.env` kalitlari — hammasi
[`DEPLOY-CHECKLIST.md`](../../DEPLOY-CHECKLIST.md) da (§1.4, §3.5, §4, §5).

**Hujjatlar sinxronligi:** `CARRIER_API.md` dagi §4 va §5.x jadvallari
(birinchi ustundagi `maydon` lar) Elchi nashri bilan aynan bir xil tuzilishda
va `carrier-api-docs-contract.spec.ts` (Elchi testining porti, bloklovchi CI
qadamida) ularni DTO'lar va `toCarrierOrderView` / `toCarrierCashboxView`
kalitlariga qarshi tekshiradi.

---

## 11. Ochiq savollar (egasiga)

| # | Savol | Tavsiya |
|---|---|---|
| M1 | Qisman sotilgan buyurtma rollback nuqsoni **ichki kuryerlarda ham** bor — tuzatamizmi? | Ha, alohida vazifa: `mergePartialChildrenBack` qaytarilgan bolada narxni tiklamasin yoki rollback rad etilsin |
| M3 | Almashtirishdagi eski mahsulotni provayder qanday qaytaradi va kim qabul qiladi? | Oddiy qaytarish pochtasi bilan; markaz xodimi ro'yxatni pochtadan ko'radi |
| M4 | Marketplace buyurtmasini API orqali qisman sotib bo'lmasligi maqbulmi? | Ha (v1); kerak bo'lsa operator qo'lda |
| O5 | Akkauntga SOATO tuman ro'yxati kerakmi? | Pilotdan keyin qaror |
| Q3 | Hudud bo'yicha haq va naqd qabul qiladigan filial | Shartnoma bo'yicha; super-kuryer + `courier_regions` |
| Q9 | Provayder ikkala tizimda bo'lsa, qaysi posilka qaysi yo'l bilan? | Pochta/buyurtma darajasida operator tanlaydi |
| Q10 | Qaytarishni qaysi markaz qabul qiladi? | Naqd qabul qiladigan filial bilan bir xil |
| UI | Admin panel (akkauntlar, kalitni bir marta ko'rsatish, IP, faollik) | Bajarildi: Integratsiyalar → Yetkazuvchilar → «Carrier API» (`client/src/pages/integrations/components/carrier`); `registry.tsx` da carrier yozuvi o'z izohi bilan |
| R6 | PCS bitta instansdami? | Ha bo'lsa — hozirgi throttler yetarli |
| T1 | Pochta carrier'dan **ichki** kuryerga o'tkazilsa, carrier'ning muzlatilgan hudud tarifi buyurtmalarda qoladi va ichki kuryerga o'sha stavka to'lanadi | Ichki kuryerlar orasidagi o'tkazishdagi mavjud xulq bilan bir xil (u ham tarifga tegmaydi). Tuzatish kerak bo'lsa — barcha `reassignCourier` uchun yagona qoida (alohida vazifa) |
| T2 | `sendPost` (va unga teng carrier `reassign`) super kuryerga jo'natishda marketplace ko'p qutili buyurtmaning `courier_tariff = 0` ini hudud tarifiga almashtiradi — har quti uchun haq to'lanadi | PCS'dagi mavjud xulq (carrier'dan oldin ham). Tuzatish `sendPost` da — alohida vazifa, carrier spec "sendPost bilan aynan bir xil" talab qilgani uchun bu yerda o'zgartirilmadi |
| P1 | PCS `createCanceledPost` parallel takrorda pochta hisoblagichlarini ikki marta oshiradi (ichki kuryer ikki marta bossa) | Carrier yo'li navbat bilan yopilgan (R16); PCS'ning o'zida — qulfdan keyin buyurtmalarni `FOR UPDATE` + holat bilan qayta tanlash (alohida vazifa) |

---

## Havolalar

- Tashqi kontrakt: [`CARRIER_API.md`](../../CARRIER_API.md) · OpenAPI: [`../carrier-openapi.json`](../carrier-openapi.json)
- Deploy: [`DEPLOY-CHECKLIST.md`](../../DEPLOY-CHECKLIST.md)
- Platforma strategiyasi va pul modellari: [`06-platforma.md`](06-platforma.md) §6–§7
- Elchi bilan push integratsiya: [`05-elchi.md`](05-elchi.md)
- Marketplace (SOURCE roli, kalit naqshi): [`14-marketplace-beepost.md`](14-marketplace-beepost.md), [`MARKETPLACE_PARTNER_API.md`](../../MARKETPLACE_PARTNER_API.md)
- Elchi manbasi: `Elchi-Backend/docs/public/CARRIER_API.md`, `apps/api-gateway/src/carrier-gateway.controller.ts`
