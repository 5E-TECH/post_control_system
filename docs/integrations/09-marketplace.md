# 09 — Marketplace'larni BeePost darajasida ulash

> Holat: **REJA — 3 qaror qabul qilingan (§8).** Kod yozilmagan.
> Sana: 2026-09-13. Tayanch: 05-elchi.md, 06-platforma.md, 08-qabul-skaneri.md.
> Barcha da'volar kodda tekshirilgan (fayl:satr ko'rsatilgan).

---

## 1. Savolga to'g'ridan-to'g'ri javob

> "Marketplace'larni xuddi biz BeePost'ga ulanganimiz kabi ulasak bo'ladimi?"

**Imkoniyat darajasida — ha. Protokol darajasida — yo'q.**

BeePost bilan ulanish ishlaydi, chunki **ikki tomon ham bizniki**: API
shartnomasini biz yozdik, PCS uni bajaradi. Marketplace esa bizning API'mizni
bajarmaydi — u o'zining API'sini e'lon qiladi va biz unga moslashamiz.

```
BeePost:        PCS  ──bizning API'ni bajaradi──▶  Elchi
Marketplace:    Elchi ──ularning API'siga moslashadi──▶  Uzum/Olcha
```

Ya'ni yetkazilishi kerak bo'lgan **qobiliyatlar bir xil** (xavfsiz ulanish,
status sinxroni, sotuv, ortiqcha xarajat, bekor, rollback), lekin har
marketplace uchun **moslashtirish qatlami** (adapter) kerak.

**Uchinchi yo'l ham bor va uni alohida aytaman:** agar marketplace hamkorlik
dasturiga rozi bo'lsa, u BeePost'dek bizning Partner API'mizni bajarishi
mumkin — o'shanda **bugun mavjud kod bilan hammasi ishlaydi, yangi kod
kerak emas**. Bu eng arzon variant va uni avval so'rab ko'rish kerak.

---

## 2. Hozir NIMA BOR — kutganimdan ancha ko'p

Tekshirib chiqdim: dvigatelning katta qismi allaqachon qurilgan.

| Qobiliyat | Mexanizm | Holat |
|---|---|---|
| Kiruvchi webhook xavfsizligi | HMAC imzo + sozlanadigan sarlavha/prefiks + **sekret rotatsiyasi** + rad etishni loglash | ✅ to'liq |
| Chiquvchi status yuborish | `sync_queue` + `external_update` konfiguratsiyasi (`endpoint`, `method`, `body_template`, `query_template`, `headers`, `use_auth`) | ✅ dvigatel to'liq |
| Navbatni yuritish | `sync-queue.scheduler.ts` — CRON + `pg_try_advisory_lock` (HA), 4 urinish, muloyim to'xtash | ✅ to'liq |
| Status xaritasi | `status_mapping` + `resolveExternalStatus` | ✅ bor |
| Maydon xaritasi (kiruvchi) | `field_mapping` + `receiveExternalOrders` | ✅ bor |
| Sotuv/bekor/to'lov signali | `resolveSyncAction` → `sold`/`canceled`/`paid`/`waiting` | ✅ bor |
| **Rollback signali** | `resolveSyncAction`: `WAITING` ← {CANCELLED, CLOSED, SOLD, PAID, PARTLY_PAID} → `rollback` | ✅ bor |
| Tashuvchi statusini qabul qilish | `receiveWebhook` → `order.provider.mark` | ✅ bor |
| Hodisalar jurnali | `sync_history` + xulosa (UI'ga ulandi) | ✅ bor |

Ya'ni **noldan qurish kerak emas** — yetishmagan joylarni yopish kerak.

---

## 3. Hozir NIMA YO'Q — bajarilishi kerak bo'lgan ish

### 3.1 🔴 Pul chiquvchi payloadda YO'Q — eng katta to'siq

`queueExternalStatusSync` **ikki** yo'ldan boradi
(`order-lifecycle.service.ts:3193`):

```
1) HAMKOR yo'li (BeePost)          2) MARKETPLACE yo'li
   action, old_status, new_status     action, old_status, new_status
   cod_collected  ✅                  cod_collected  ❌
   total_price    ✅                  total_price    ❌
   extra_cost     ✅                  extra_cost     ❌
```

`enqueueSync` ichidagi `context` faqat id'lar va statuslardan iborat
(`integration-service.service.ts:3760`). Demak marketplace'ning
`body_template`'i sotuv summasini yoki ortiqcha xarajatni **umuman yoza
olmaydi** — o'sha o'zgaruvchilar mavjud emas.

Bu sizning "sotuvlari ham ortiqcha xarajati ham ishlashi kerak" talabining
**to'g'ridan-to'g'ri bloklovchisi**.

### 3.2 🔴 Buyurtmalarni tortib olish YO'Q

Elchi'da faqat BITTA scheduler bor — `sync-queue.scheduler.ts`, va u
**chiquvchi** navbatni yuritadi. Marketplace'dan yangi buyurtmani davriy
olib keladigan ish **yo'q**. Buyurtma faqat shunday kiradi:

- `POST /orders/external/receive` — tashqaridan yuborilgan payload (qo'lda)
- `POST /partner/shipments` — hamkorlar uchun (Partner API)
- `POST /integrations/:slug/search-by-qr` — bitta QR bo'yicha bittasini olish

⚠️ `POST /integrations/:id/sync` nomi chalg'itadi — u **chiquvchi navbatni**
qayta ishlaydi, hech narsa tortib olmaydi.

### 3.3 🔴 Marketplace webhook bilan buyurtma YARATA olmaydi

`receiveWebhook` imzoni tekshiradi, keyin statusni **mavjud** posilkaga
xaritalaydi (`order.provider.mark`). Yangi buyurtma yaratish yo'li yo'q.

### 3.4 🟠 `operator` darvozasi mo'rt

Chiquvchi sinxron faqat `order.operator?.startsWith('external_')` bo'lganda
ishlaydi (`order-lifecycle.service.ts:3225`). Ya'ni marketplace buyurtmasi
boshqa yo'l bilan yaratilsa (operator qo'lda kiritsa, yoki Partner API
orqali kelsa) — status **hech qachon** ortga ketmaydi va buni hech narsa
sezmaydi.

### 3.5 🟠 Status xaritasi to'liqligi tekshirilmaydi

`resolveExternalStatus` xaritada topilmasa **bizning ichki status nomini**
yuboradi (`integration-service.service.ts:3694`). Ya'ni `status_mapping`'da
`rollback` yozilmagan bo'lsa, marketplace'ga `waiting` deb ketadi — u esa
bunday statusni bilmaydi. Ulanish "sozlangan" bo'lib ko'rinadi, sinxron esa
har safar yiqiladi.

### 3.6 🟠 Chiquvchi so'rovda idempotentlik kaliti yo'q

`executeExternalRequest` sarlavhalarga idempotentlik kaliti qo'ymaydi
(`:2883`), `max_attempts` esa 4. Timeout → qayta urinish → marketplace
"sotildi"ni **ikki marta** qo'llashi mumkin. Status uchun bu ko'pincha
zararsiz, lekin ular tomonida moliyaviy yozuv tug'ilsa — dublikat.

### 3.7 🟠 Rollback'ni marketplace RAD ETISHI mumkin

Bu texnik emas, **biznes** xavfi va eng nozik joyi.

Rollback PCS↔Elchi orasida ishlaydi, chunki ikkisi ham bizniki. Marketplace
uchun esa bekor qilish ko'pincha **terminal**: pul xaridorga qaytarilgan
bo'lsa, "bekorni bekor qilish" imkonsiz.

Ya'ni: operator Elchi'da "adashdim" deb ortga qaytaradi, marketplace esa
qabul qilmaydi → **ikki tizim bir-biriga zid holatda qoladi** va hozir buni
hech narsa ushlab qolmaydi.

---

## 4. To'rt oqim — nima yuboriladi

| # | Hodisa | Elchi ichida | Marketplace'ga ketishi kerak |
|---|--------|--------------|------------------------------|
| 1 | **Sotildi** | `SOLD` → action `sold` | status + `total_price` + `cod_collected` |
| 2 | **Ortiqcha xarajat** | kuryer yozadi, limit tekshiriladi | `extra_cost` — sotuvchi qo'liga tushadigan summa shunga bog'liq |
| 3 | **Bekor** | `CANCELLED` / `CANCELLED_SENT` / `RETURNED_TO_MARKET` → `canceled` | bekor statusi + sababi |
| 4 | **Ortga qaytarish** | `WAITING` ← terminal holat → `rollback` | "yana yo'lda" statusi **+ rad etilsa ushlash** |

Ortiqcha xarajat qoidasi Elchi'da allaqachon bor (`extra-cost-limit`):
uyga yetkazishda **taqiqlangan**, markazga `uy − markaz` tarifidan oshmaydi,
tariflar teng bo'lsa o'z tarifining **50%** idan oshmaydi.

---

## 5. Bajarilishi kerak bo'lgan ish

> Ketma-ketlik §8 dagi qarorlardan keyin qayta tuzildi. Eng muhim o'zgarish:
> **dublikat himoyasi poydevorga ko'chdi.** Buyurtma ikki yo'ldan kirishi
> qabul qilinganda (webhook + tortib olish), ayni buyurtma IKKI marta
> yaratilishi eng ehtimolli xato bo'ladi — shuning uchun u 1-bosqich.

### 0-bosqich — Partner API'ni taklif qilish (kod yo'q)

Har marketplace bilan alohida. Rozi bo'lsa — quyidagi bosqichlarning
deyarli hammasi **kerak bo'lmaydi**: BeePost yo'li allaqachon pul, rollback
va xavfsizlikni to'liq olib yuradi.

⚠️ Lekin kutib turmaymiz: ba'zilari rad etadi, ya'ni adapter yo'li baribir
kerak bo'ladi. Ish behuda ketmaydi.

### 1-bosqich — poydevor: `source_integration_id` + idempotent yaratish (1 kun)

Buyurtmada `source_integration_id` ustuni va tashqi buyurtma yaratishning
YAGONA idempotent yo'li, kaliti `(integration_id, external_id)`.

Nega poydevor:
- webhook va tortib olish IKKISI ham buyurtma yaratadi → dublikat xavfi;
- `operator` matniga tayanadigan mo'rt darvoza (§3.4) yopiladi;
- ayni ustun **qabul skaneri** ishiga ham kerak
  (`08-qabul-skaneri.md`) — bitta migratsiya ikki ishga xizmat qiladi.

### 2-bosqich — pul + status xaritasi + idempotentlik kaliti (2 kun)

- `enqueueSync` kontekstiga `total_price`, `extra_cost`, `cod_collected`
  qo'shiladi → shablonda `{{extra_cost}}` yozish mumkin bo'ladi.
- `status_mapping` to'liqligi tekshiriladi: qamramasa **saqlanadi, lekin
  ogohlantiriladi** va Konsolda "sozlash tugallanmagan" bo'lib turadi.
  Jimgina noto'g'ri status yuborishdan ko'ra ochiq ogohlantirish yaxshi.
- Chiquvchi so'rovga barqaror `X-Idempotency-Key` (`sync_queue.id` dan).

⚠️ Mavjud ulanishlarga ta'sir qilmaydi: yangi maydonlar shablonda
ishlatilmasa payload o'zgarmaydi.

### 3-bosqich — rollback: har marketplace uchun alohida (1.5 kun)

Qabul qilingan qaror — **sozlanadigan**. Ulanishda `rollback_supported`
belgisi:

```
rollback_supported = false  →  Elchi'da bu buyurtmalarda ortga qaytarish
                               TUGMASI ishlamaydi (sabab ko'rsatiladi)
rollback_supported = true   →  ruxsat, lekin marketplace rad etsa (4xx)
                               buyurtmada belgi qoladi:
                               "Marketplace ortga qaytarishni qabul qilmadi
                                — ular tomonda bekor holatida"
```

⚠️ Ikkinchi holat MUHIM: aks holda ikki tizim jimgina zidlashadi va farqni
hech kim sezmaydi.

### 4-bosqich — webhook bilan buyurtma qabul qilish (1.5 kun)

`receiveWebhook`ga ikkinchi rejim (`webhook_mode = 'order_intake'`): imzo
tekshirilgandan keyin payload `field_mapping` bilan buyurtmaga aylanadi va
1-bosqichdagi idempotent yo'ldan o'tadi.

Xavfsizlik qatlami **o'zgarmaydi** — u allaqachon to'liq (HMAC, rotatsiya,
rad etishni loglash).

### 5-bosqich — tortib olish (zaxira yo'l) (2.5 kun)

Yangi scheduler: `inbound_pull` konfiguratsiyasi (`endpoint`, `params`,
sahifalash, `since` belgisi). Qabul qilingan qarorga ko'ra bu **asosiy yo'l
emas, zaxira**: webhook yo'qolgan buyurtmalarni topadi.

Shu bois u "topdim-yaratdim" emas, **solishtiruvchi** bo'lib ishlaydi:
allaqachon bor buyurtmani o'tkazib yuboradi, yo'qini yaratadi va buni
jurnalga yozadi ("webhook yo'qolgan: 3 buyurtma").

### 6-bosqich — bitta haqiqiy marketplace bilan uchdan-uchga sinov (1 kun)

Buyurtma kirishi → sotuv → ortiqcha xarajat → bekor → rollback (agar
qo'llab-quvvatlansa) → har qadam ikki tomonda tekshiriladi.

**Jami: 9.5-10 kun.** Minimal ishlaydigan yo'l = **1 + 2 bosqich (3 kun)**:
mavjud ulanish pul bilan to'liq va xavfsiz sinxronlanadi, buyurtma esa
hozircha qo'lda kiritiladi.

## 6. Xavfsizlik — nima qo'shiladi

Kiruvchi tomon allaqachon to'liq (HMAC, rotatsiya, loglash). Qo'shiladigani:

| Nima | Nega |
|---|---|
| IP ro'yxati chiquvchi ulanish uchun ham | Hozir faqat hamkorlarda bor |
| `X-Idempotency-Key` | Qayta urinish dublikat yasamasin |
| Sekretni ko'rsatmaslik | Mavjud (`writeOnly`), o'zgarmaydi |
| SSRF tekshiruvi | Mavjud (`assertOutboundUrlSafe`), yangi endpointlarga ham qo'llanadi |

---

## 7. Xavflar

| # | Xavf | Yumshatish |
|---|------|-----------|
| 1 | **Rollback'ni marketplace qabul qilmaydi** — ikki tizim zidlashadi | D bosqichi: rad etilishni buyurtmada ko'rsatish. Biznes qarori ham kerak (quyida) |
| 2 | Tortib olishda dublikat buyurtma | `external_id` bo'yicha noyoblik, `since` belgisi |
| 3 | Marketplace API'si o'zgaradi | Adapter konfiguratsiyada, kodda emas — shablon tahrirlanadi |
| 4 | Status xaritasi chala → har sinxron yiqiladi | B bosqichi: ogohlantirish + "tugallanmagan" belgisi |
| 5 | Ortiqcha xarajat marketplace hisobiga to'g'ri kelmaydi | `extra_cost` yuboriladi; ular qabul qilmasa — kelishuv masalasi |
| 6 | Bir vaqtda ikki marketplace ayni buyurtmani da'vo qilishi | `source_integration_id` (G bosqichi) |

---

## 8. Qabul qilingan qarorlar (2026-09-13)

| # | Savol | Qaror | Ta'siri |
|---|-------|-------|---------|
| 1 | Partner API'ni taklif qilamizmi? | **Avval taklif** | 0-bosqich; rozi bo'lsa qolgani kerak emas |
| 2 | Rollback marketplace'da mumkin bo'lmasa? | **Har marketplace uchun alohida sozlanadi** | 3-bosqich: `rollback_supported` belgisi + rad etilishni ko'rsatish |
| 3 | Buyurtma qanday kiradi? | **Ikkisi ham** — webhook asosiy, tortib olish zaxira | 4 va 5-bosqich; dublikat himoyasi 1-bosqichga ko'chdi |

**Ochiq qolgan savol:** qaysi marketplace birinchi? Har biri alohida
adapter, shuning uchun bittasini oxirigacha qilib, keyin ikkinchisiga
o'tish to'g'ri.
