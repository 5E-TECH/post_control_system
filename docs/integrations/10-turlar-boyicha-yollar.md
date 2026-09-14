# 10 — Har ulanish turi uchun alohida yo'l

> Holat: **REJA.** Kod yozilmagan.
> Sana: 2026-09-13. Asos: 6 yo'nalish bo'yicha kod auditi (91 topilma).
> Tekshiruv: har topilmani alohida **rad etishga urinadigan** tasdiqlovchi
> ko'rgan. **67 tasdiqlangan**, **0 rad etilgan**, **24 tekshirilmagan**
> (tasdiqlovchi agentlar sessiya limitiga urildi — ularning hammasi kargo
> yo'lidan, ya'ni kargo "toza" emas, **tekshirilmagan**).

---

## 1. Qisqa xulosa

Elchi'da bugun **ikkita** ishlaydigan mexanizm va **bir nechta o'lik** mexanizm bor.

| Mexanizm | Holat |
|---|---|
| **Partner API** (`partners`): ular bizga push, biz ularga HMAC webhook | ✅ **ishlaydi** — kalit hash, IP ro'yxati, rate limit, outbox+retry, sandbox. 16 kamchilik bilan |
| **Chiquvchi status navbati** (`sync_queue` + CRON) | ✅ **ishlaydi** — backoff, advisory lock, tarix. Lekin **pul maydoni yo'q** |
| Tashqi saytdan buyurtma **kirishi** | ❌ amalda **yo'q** — tortib olish CRON'i yo'q, webhook buyurtma yaratmaydi |
| Turni farqlaydigan **konfiguratsiya** (`dispatch_config`, `field_mapping`, `webhook_secret`…) | ❌ **HTTP orqali yozib bo'lmaydi** — gateway DTO'da yo'q |
| Kargoga **birinchi jo'natish** | ❌ ishga tushiruvchi joy yo'q (faqat "qayta jo'natish") |
| **To'lov tizimi** yo'li | ❌ **umuman yo'q** — `role='payment'` sof UI yorlig'i |
| **CRM** yo'li | ❌ voronka/bosqich tushunchasi kodda yo'q |
| **Nasiya** (bo'lib to'lash) | ❌ kodda ham, rejada ham nol |

---

## 2. Ildiz sabab — nega kartalar bir xil chiqdi

Shikoyat: *"Yangi ulanish ichiga kirsam hammasini ichi bir xil"*.

Sabab **ikki qatlamli** va birinchisi mening xatom, ikkinchisi undan chuqurroq.

### 2.1 Mening xatom (FE-01, FE-05)

Registrda 6 tur e'lon qilingan, lekin **5 tasi ayni bitta massiv obyektiga**
ishora qiladi:

```
connections.ts:280  marketplace_inbound  → INBOUND_FIELDS   (6 maydon)
connections.ts:294  marketplace_outbound → OUTBOUND_FIELDS  ┐
connections.ts:308  crm                  → OUTBOUND_FIELDS  │ AYNI
connections.ts:322  carrier              → OUTBOUND_FIELDS  │ OBYEKT
connections.ts:336  payment              → OUTBOUND_FIELDS  │
connections.ts:350  mirror               → OUTBOUND_FIELDS  ┘
```

Ya'ni tur tanlash faqat `role`/`category` qiymatini o'zgartirardi. Ustiga men
`Roli` select'ini **Sozlamalar formasiga** qo'shdim (Donoxon noto'g'ri
tasniflanganini tuzatish uchun) — natijada ichdan turib turni almashtirish
mumkin bo'ldi va katalog tanlovi butunlay ma'nosizlandi.

### 2.2 Chuqurroq sabab — backend turni qabul qilmaydi (FE-02, EI-04, C1)

Turlar orasidagi **haqiqiy** farq `external_integrations` jadvalidagi shu
ustunlarda:

```
external-integration.entity.ts:212  dispatch_config          (kargo: endpoint, body_template, response_paths)
                            :188  webhook_payload_paths     (kiruvchi webhookda posilkani qanday topish)
                            :173  inbound_status_mapping    (ularning statusi → bizning statusimiz)
                            :140  webhook_secret            (HMAC)
                                  field_mapping             (ularning JSON maydonlari → bizning maydonlar)
                                  status_sync_config        (chiquvchi so'rov shabloni)
```

Kod bu ustunlarni **o'qiydi**, lekin ularni **yozish yo'li yo'q**:
`api-gateway/src/main.ts:128` da `ValidationPipe({ whitelist: true,
forbidNonWhitelisted: true })`, gateway DTO'larida esa bu maydonlar **e'lon
qilinmagan**. Demak:

- UI'dan yuborilsa — **jimgina tashlanadi**
- Swagger/curl bilan yuborilsa — **400** (`property should not exist`)

> **Xulosa:** men formani dangasalik bilan bir xil qilganim to'g'ri, lekin
> to'g'ri forma yozganimda ham **saqlanmasdi**. Shu bois "har tur uchun
> alohida yo'l" ishining **0-bosqichi backend konfiguratsiya yuzasini
> ochish** bo'lishi kerak — aks holda har qanday UI yolg'on bo'ladi.

---

## 3. Har tur uchun alohida yo'l

### Umumiy jadval

| Tur | Yo'nalish | Mexanizm | Buyurtma kirishi | Status/pul ortga | Bugun |
|---|---|---|---|---|---|
| **Hamkor** (Elchi Marketplace, BeePost) | ular→biz push | `partners` + Partner API | `POST /partner/shipments` → NEW → skanerlab qabul | HMAC outbox | ✅ ishlaydi, 12 kamchilik |
| **Sayt** (Donoxon, Adosh) | biz→ular pull | `external_integrations` + `field_mapping` | tortib olish CRON | `sync_queue` | ❌ kirish yo'q |
| **CRM** (amoCRM, Bitrix24) | ular→biz webhook | yangi kiruvchi yo'l | bosqich o'zgarishi webhooki | CRM bosqichiga qaytish | ❌ yo'q |
| **To'lov** (Uzum, Alif, bank, nasiya) | ular→biz webhook | **yangi** to'lov yo'li | buyurtma yaratmaydi | `paid_amount`/status | ❌ yo'q |
| **Kargo** (LDG kabi) | biz→ular dispatch | `dispatch_config` + `provider_shipments` | — | webhook → `provider.mark` + COD daftari | ⚠️ bo'laklar bor, zanjir uzuq |
| **Ko'zgu** (Sheets, BI) | biz→ular push | `sync_queue` | — | faqat eksport | ⚠️ minimal |

### 3.1 Hamkor — Partner API

**Usta qadamlari (shu turga xos):**
1. Nomi
2. **Kalit yaratiladi va BIR MARTA ko'rsatiladi** (boshqa turlarda bunday qadam yo'q)
3. Ularning webhook manzili + sekret
4. IP ro'yxati (ixtiyoriy)
5. **Market bog'lanishi** — hamkor qaysi Elchi market akkauntiga yozadi
6. Sinov webhooki → Tayyor

**Tuzatilishi shart (auditdan):**

| # | Muammo | Dalil |
|---|---|---|
| F1 | `cod_collected` **har doim 0** — ikki shart bir-birini yo'q qiladi | `integration-service.service.ts:1339` + `order-lifecycle.service.ts:3910` |
| F3 | `elchi_market_id` **egaligi tekshirilmaydi** → to'liq huquqli IDOR (so'rov ichkarida SUPERADMIN bilan bajariladi) | `integration-service.service.ts:978-993, 1060` |
| F4 | Bekor qilish faqat `WAITING`dan ishlaydi — eng ko'p uchraydigan holat (`new`) **502** beradi | `order-lifecycle.service.ts:4167` |
| F2 | `cod_amount=0` (prepaid) pul matematikasiga **ta'sir qilmaydi** — kuryer to'liq summaga qarzdor bo'lib qoladi | `order-lifecycle.service.ts:3820-3875` |
| F6 | Hamkor posilkalari **hamisha HQ** filialiga tushadi — viloyat filiali ko'rmaydi | audit F6 |
| K3 | Hamkor **yorlig'ini skanerlash hech qachon mos kelmaydi** (Partner API so'rovida token maydoni yo'q) | `integration-service.service.ts:1035-1063` |

### 3.2 Sayt (pull adapter)

**Usta qadamlari:**
1. Nomi + slug
2. API manzili + kirish turi (kalit yoki login)
3. **Maydon xaritasi** — ularning JSON'idagi qaysi maydon bizning `id`/`ism`/`telefon`/`manzil`/`summa` (bu qadam faqat shu turda)
4. **Market bog'lanishi** — import uchun MAJBURIY
5. **Status xaritasi** — bizning status → ularning statusi
6. Tortib olish jadvali (har N daqiqa)
7. Sinov: bitta buyurtma tortib ko'rish → Tayyor

**Tuzatilishi shart:**

| # | Muammo | Dalil |
|---|---|---|
| EI-01 | Buyurtma **kirishining ishlaydigan yo'li yo'q**: tortib olish CRON'i yo'q, yagona endpoint JWT talab qiladi | `order-gateway.controller.ts:1013` |
| EI-02 | `market_id` import uchun **majburiy**, ustada bunday maydon **yo'q** → har import 400 | `order-lifecycle.service.ts:3537` |
| EI-03/04 | `field_mapping`, `status_mapping`, `dispatch_config`, `webhook_secret` … **yozib bo'lmaydi** (9 maydon o'lik) | gateway DTO + `main.ts:128` |
| EI-05 | Import qilingan buyurtma **`RECEIVED`** bo'lib tug'iladi — skaner `NEW` so'raydi, ya'ni ko'rinmaydi | `order-lifecycle.service.ts:3667` vs `order-service.service.ts:1404` |
| EI-06 | Tashqi `region` qiymati bigint ustunga xom yoziladi → **500**, partiya yarim yo'lda uziladi | audit EI-06 |
| EI-07 | Chiquvchi statusda **pul maydoni umuman yo'q** — shablon `{{cod_collected}}` bo'sh satr beradi | audit EI-07 |
| EI-08 | Webhook bilan "sotildi" bo'lgan buyurtma **kassaga tushmaydi** va keyin qo'lda ham sotib bo'lmaydi | audit EI-08 |
| EI-11 | `external_id` da **unique ham, indeks ham yo'q** — dublikat poygasi | audit EI-11 |
| EI-12 | Import qilingan buyurtmada **mahsulot qatorlari yo'q** | audit EI-12 |

### 3.3 CRM

**Usta qadamlari:**
1. Nomi
2. **Biz beradigan webhook manzili + sekret** (yo'nalish teskari — ular bizga yuboradi)
3. Maydon xaritasi
4. **Voronka va bosqich** — qaysi bosqichga o'tganda buyurtma yaratiladi (bu tushuncha kodda **yo'q**, P7)
5. Market bog'lanishi
6. Sinov: soxta webhook → Tayyor

✅ **BAJARILDI (6-bosqich).** Kiruvchi webhook endi buyurtma **yaratadi**:
`inbound_order_config` ustuni voronka va bosqich darvozasini saqlaydi,
`applyWebhookToInboundOrder` esa darvozadan o'tgan bitimni
`order.receive_external` ga topshiradi. Batafsil: `11-crm-voronka.md`.

**Ataylab qilinmagan:** CRM bosqichi → bizning buyurtma statusi (teskari
inbound). Bu pulga tegadi — audit EI-08 ga ko'ra webhook bilan "sotildi"
bo'lgan buyurtma kassaga tushmaydi. Chiquvchi yo'nalish (biz → CRM)
ishlaydi.

### 3.4 To'lov tizimi (Uzum, Alif, bank, nasiya)

✅ **1-QATLAM BAJARILDI (7-bosqich).** `role='payment'` endi o'qiladi:
`payment_config` bo'yicha tranzaksiya, summa, holat va buyurtma havolasi
aniqlanadi; tasdiqlangan to'lov `payment_transactions` ga yozilib
buyurtmaga qo'llanadi. Batafsil: `12-tolov-tizimi.md`.

⚠️ **PUL HARAKATI OCHIQ.** Foydalanuvchi qarori bilan onlayn pul kassaga
yozilmaydi va marketga qarz yozilmaydi; kuryer tarifi esa HQ'dan
to'lanishi kerak. Bu uchtasi birgalikda kompaniya balansini faqat chiqim
tomonga siljitadi, shu bois kuryer tarifi implementatsiya qilinmadi va
`sellOrder` onlayn to'langan buyurtmani RAD ETADI (jimgina noto'g'ri
hisoblashdan ko'ra to'xtash to'g'ri).

⚠️ **Payme/Click uchun adapter kerak** — ular ikki fazali JSON-RPC Merchant
API ishlatadi, bitta imzolangan webhook emas.

**Ilgari mavjud bo'lmagan narsa (tarix uchun):**

**Kerak bo'ladigan yangi yo'l:**
1. Nomi
2. Merchant id + sekret
3. **Qaysi hodisa "to'landi" deb hisoblanadi** (ularning payload'ida)
4. **To'landi bo'lganda nima qilinadi** — `paid_amount` yoziladimi, status
   o'zgaradimi, kuryer undirishi to'xtatiladimi
5. Sinov → Tayyor

**Nasiya** uchun qo'shimcha: bo'lib to'lash grafigi, qoldiq, muddat — bu
maydonlar kodda **yo'q** (P9).

⚠️ Bu tur **pulga tegadi**, shu bois oxirgi navbatda qilinishi kerak va
alohida moliyaviy ko'rib chiqish talab qiladi.

### 3.5 Kargo

⚠️ **Bu yo'nalishning 20 topilmasi TEKSHIRILMAGAN** (tasdiqlovchi agentlar
limitga urildi). Quyidagilar **da'vo**, tasdiqlangan fakt emas — ishga
kirishishdan oldin qayta tekshirilishi kerak.

| # | Da'vo | Holat |
|---|---|---|
| C1 | `dispatch_config` va webhook sozlamalarini HTTP orqali **yozib bo'lmaydi** | ○ tekshirilmagan |
| C2 | Kargoga **birinchi jo'natishni ishga tushiradigan joy yo'q** (tovuq-tuxum: posilka yaratish uchun posilka qatori kerak) | ○ |
| C3 | Frontend dispatch'ga `context` **yubormaydi** → shablondagi `{{...}}` bo'sh satr, `cod_amount=0` xavfi | ○ |
| C4 | Kargo sotsa **pul kitobga tushmaydi** — `markByProvider` moliyani ataylab chetlab o'tadi | ○ |
| C5 | Kargo webhooki **SOTILGAN** buyurtmani bekor qiladi — idempotentlik ro'yxatida `SOLD` yo'q | ○ |

---

## 4. Umumiy dvigatel — nima takrorlanmaydi

Har tur uchun alohida yo'l qilinganda **quyidagilar bitta joyda qolishi
kerak**, aks holda 6 tur = 6 nusxa:

| Umumiy qism | Bugun qayerda |
|---|---|
| Kalit/sekret shifrlash + rotatsiya | `partners` uchun bor, `external_integrations` uchun ham bor |
| HMAC imzo: tekshirish (kiruvchi) va qo'yish (chiquvchi) | `verifyHmacSignature`, outbox |
| Navbat + CRON + backoff + tarix | `sync_queue`, `sync-queue.scheduler.ts` |
| Audit jurnali | `ActivityLogService` |
| Konsol qobig'i, tablar, holat nuqtasi | `ConnectionsPage` + panellar |
| Sinov/healthcheck ramkasi | `webhook-test`, `healthcheck` |

**Turga xos bo'lishi kerak:** usta qadamlari, so'raladigan maydonlar,
buyurtma kirish yo'li, status/pul chiqish yo'li, ko'rsatiladigan tablar.

---

## 5. Bosqichlar

| # | Bosqich | Nega shu tartibda | Kun |
|---|---|---|---|
| **0** | **Konfiguratsiya yuzasini ochish** — gateway DTO'lariga 9 o'lik maydonni qo'shish, validatsiya bilan | Busiz har qanday UI **yolg'on** bo'ladi | 1.5 |
| **1** | **Hamkor yo'lini tuzatish** — F1, F3, F4, K3 | Yagona ishlaydigan yo'l; Elchi Marketplace shu yo'ldan keladi | 3 |
| **2** | **Skanerlab qabulni majburlash** — K1, K2, EI-05 (server darvozasi) | Javobgarlik buzilishi ochiq turibdi | 2.5 |
| **3** | **Sayt yo'lini ochish** — tortib olish CRON + `field_mapping` UI + EI-02/06/11/12 | Donoxon shundan keyin ishlaydi | 4 |
| **4** | **Turga xos usta** — har tur uchun alohida qadamlar, `typeKey` saqlanadi | 0-bosqichdan keyin ma'noli bo'ladi | 3 |
| **5** | **Kargo zanjirini yopish** — avval 20 da'voni qayta tekshirish, keyin C1–C5 | Tekshirilmagan asosda kod yozish xavfli | 1 + 4 |
| **6** | ✅ **CRM yo'li** — kiruvchi webhook → buyurtma + voronka modeli (`11-crm-voronka.md`) | Yangi mexanizm | 4 |
| **7** | ✅ **To'lov tizimi** — to'lov tasdig'i yo'li (`12-tolov-tizimi.md`); nasiya ko'lamdan chiqarildi | Pulga tegadi, oxirgi | 5 |

**Jami ≈ 28 kun.** Minimal ishlaydigan yo'l: **0+1+2 = 7 kun** — hamkor
(Elchi Marketplace + BeePost) to'g'ri va xavfsiz ishlaydi, skanerlash
majburlanadi.

---

## 6. UI/UX ishlari

| # | Ish | Ustuvorlik |
|---|---|---|
| FE-01/02 | Katalog kartalari haqiqatan farqlansin (0-bosqichdan keyin) | blocker |
| FE-03 | Tanlangan tur (`typeKey`) **saqlansin** — hozir konsol turni `role`+`category` dan taxmin qiladi | high |
| FE-04 | Ustadagi `Roli`/`Turi` qiymati **jimgina tashlanadi** — yoki yuborilsin, yoki olinsin | high |
| FE-05 | `Roli` Sozlamalardan **olinsin**, "Turini o'zgartirish" alohida ogohlantirishli amal bo'lsin | high |
| FE-07 | `auth_type` ga qarab maydonlar yashirilsin (hozir 4 ta kirish maydoni birga ko'rinadi) | medium |
| FE-08/P11/M4 | Tablar **rolga qarab filtrlansin** — to'lov tizimida "Jo'natmalar" va "Hisob-kitob" ma'nosiz | medium |
| FE-10 | `market_id` (tenant) bog'lash yuzaga **qaytarilsin** — eski sahifada bor edi, yangisida yo'qolgan | medium |
| FE-11 | `integration_mode` (spec/adapter) UI'da yo'q — hamma ulanish `adapter` bo'lib yaratiladi | medium |
| FE-09 | Tayyorlik checklisti turga qarab farqlansin (hozir 2 xil) | medium |
| M2 | `isConfigured` faqat `base_url`ni tekshiradi → kargo **yashil** ko'rinadi, aslida ishlamaydi | medium |
| K13 | "Noto'g'ri manba" va "tizimda yo'q" **bitta xato xabari** bilan ko'rsatiladi | low |
| K12 | Skan ro'yxati 200 ta bilan cheklangan, ogohlantirish yo'q | low |
| FE-13 | Ustada 2-qadamdan keyin ortga yo'l yo'q, sinovi yiqilgan yozuv "tayyor" bo'lib qoladi | low |

---

## 7. Foydalanuvchidan kerak bo'lgan qarorlar

1. **Elchi Marketplace Partner API'dan foydalanadimi?** Entity izohi
   (`partner.entity.ts:5`) shunday deydi. Agar ha — 1-bosqich uni ham
   qamraydi va alohida ish kerak emas.
2. **Donoxon buyurtmalarini biz tortib olamizmi yoki ular yuboradimi?**
   Tortib olish 3-bosqich, webhook esa 6-bosqichga yaqin.
3. **Kargo yo'nalishi hozir kerakmi?** 20 da'vo tekshirilmagan; kerak
   bo'lmasa 5-bosqichni keyinga qoldirish mumkin.
4. **Nasiya to'lovlari qamrovga kiradimi?** Bu alohida moliyaviy model —
   7-bosqichni ikki baravar kattalashtiradi.
