# Pilot: BeePost → Elchi (bitta hudud, real test)

> Hujjat turi: **ijro rejasi** (tahlil emas — bu bajariladigan ish)
> Sana: 2026-09-08 · Til: O'zbek · Holat: **REJA (kod yozilmagan)**
> Maqsad: BeePost'dan bitta viloyat/tuman buyurtmalarini Elchi'ga jo'natish, Elchi kuryerlari
> ular ustida amal bajarishi, **holat va summalar** BeePost'ga qaytib real testdan o'tishi.

> **Atama:** *BeePost* = Post Control System (PCS) mahsulot nomi (`client/index.html` → `<title>Beepost</title>`).
> Alohida tizim emas — shu hujjatda **PCS** deb yoziladi.

---

## 0. Xulosa (30 soniyada)

**Pilot uchun platforma yadrosi (`06-platforma.md` B bosqichi) KERAK EMAS.** Pilot = `05-elchi.md`
dagi nuqson tuzatishlari + PCS tomonidagi konnektor + pilot darvozasi.

**Eng muhim soddalashtirish — pilotda Elchi'ning sinalmagan dvigateli ISHLATILMAYDI:**

| Elchi mashinasozligi | Pilotda | Holat |
|---|---|---|
| **Partner API** (`/partner/*`) — SOURCE roli | ✅ **Ishlatiladi** | **Ishlaydi va Marketplace'da sinalmoqda** |
| `provider_shipments` · `dispatch_config` — CARRIER roli | ❌ Ishlatilmaydi | Hali birorta real provayderda sinalmagan |

Ya'ni pilotning kritik yo'lida **hech qanday sinalmagan Elchi kodi yo'q**. Bu xavfni keskin kamaytiradi.

**Ish hajmi:** Elchi **3–4 kun** (nuqson tuzatish) · PCS **6–8 kun** (konnektor + darvoza + hisob-kitob paneli) · jami **~9–12 dev-kun**.

**Tayyor namuna bor:** `Elchi-Marketplace/apps/elchi-integration/src/elchi-api.client.ts` (168 qator) —
Elchi Partner API'ning **ishlaydigan klienti**. PCS konnektori shu shaklni takrorlaydi.

---

## 1. Bir munosabat, ikki nom

Bu — pilotning eng muhim tushunchasi:

```
        PCS nuqtai nazaridan                 Elchi nuqtai nazaridan
        ─────────────────────                ──────────────────────
        Elchi = CARRIER                      PCS = SOURCE
        "ular biz uchun yetkazadi"           "ular bizga buyurtma beradi"
                    │                                    │
                    └────────────┬───────────────────────┘
                                 ▼
                    BIR MUNOSABATNING IKKI TOMONI
```

**Amaliy natijasi:** Elchi tomonida **yangi kod deyarli yozilmaydi**. Elchi'ning Partner API'si
aynan SOURCE roli uchun qurilgan (Elchi-Marketplace uchun) va u tayyor. Elchi'da faqat
**sinxronlik nuqsonlari** tuzatiladi.

| Ish | Qayerda | Nima |
|---|---|---|
| Nuqson tuzatish | **Elchi** | G2 · G3 · G4 (+ G1) — `05-elchi.md` §03 |
| Konnektor + darvoza + panel | **PCS** | Yangi `elchi-cargo` moduli (LDG qolipida) |
| Yangi Elchi funksiyasi | — | **Yo'q** |

---

## 2. Pilot qamrovi — darvoza, ROUTER emas

### ⚠️ Tarixiy eslatma (majburiy o'qish)

**Tuman bo'yicha avtomatik routing 2026-06-04 da ataylab OLIB TASHLANGAN** (LDG uchun).
Sabablari: qo'lda kuryer tanlash bilan **ikkilanish**, **yetim `ON_THE_ROAD` buyurtmalar**,
SOATO'ga bog'liqlik, ikki xil routing mexanizmi chalkashligi.

Pilot **shu xatoni takrorlamaydi**. Farqni aniq ushlab turish shart:

| | **Router** (olib tashlangan) | **Darvoza** (pilot uchun) |
|---|---|---|
| Kim qaror qiladi | **Tizim** — tumanga qarab buyurtmani o'zi yo'naltiradi | **Operator** — qo'lda "Elchi" kuryerini tanlaydi |
| Tizimning roli | Buyurtmalarni ajratadi | Faqat **ruxsat berilmaganini bloklaydi** |
| Xato bo'lganda | Jimgina o'tkazib yuboradi → yetim buyurtma | **Ochiq xato** — jo'natish to'xtaydi |
| Mexanizm soni | Ikkita (qo'lda + avtomatik) | Bitta (qo'lda) + xavfsizlik reyli |

### Darvoza qanday ishlaydi

```
Operator pochtani "Elchi" kuryeriga jo'natmoqchi
                    │
                    ▼
      ┌──────────────────────────────┐
      │  Pilot darvozasi tekshiradi  │
      │  har bir buyurtma tumani     │
      │  ruxsat ro'yxatidami?        │
      └──────────┬───────────────────┘
                 │
      ┌──────────┴───────────┐
      ▼                      ▼
   HAMMASI mos          BIRORTASI mos emas
      │                      │
      ▼                      ▼
  Elchi'ga jo'natiladi   ❌ JO'NATISH TO'XTAYDI
                         Ochiq xato: qaysi buyurtma,
                         qaysi tuman — operator ko'radi
```

**Qoida:** qisman jo'natish **YO'Q**. Yoki hammasi ketadi, yoki hech biri. Bu aynan
yetim `ON_THE_ROAD` muammosining oldini oladi.

**Sozlama:** `elchi_config.pilot_district_sato_codes` (SOATO kodlari ro'yxati) + master
`is_active` toggle. Bo'sh ro'yxat = **hamma tuman bloklangan** (xavfsiz default).

> LDG'da `enabled_district_sato_codes` ustuni **dormant** holda saqlanib qolgan
> (`ldg-config.entity.ts:116`) — u tegilmaydi. Elchi o'z jadvalida o'z ustunini oladi.

---

## 3. Pilot oqimi

```
 PCS (BeePost)                                         ELCHI
 ─────────────                                         ─────
 Buyurtma yaratiladi (oddiy oqim)
        │
 Qabul qilinadi → pochtaga qo'shiladi
        │
 Operator "Elchi" kuryerini tanlaydi
        │
 ┌──────▼───────────┐
 │ PILOT DARVOZASI  │  tuman ruxsat ro'yxatidami?
 └──────┬───────────┘
        │ ha
        ▼
 POST /partner/shipments ─────────────────────────►  Buyurtma yaratiladi (NEW)
   external_order_id = PCS UUID (idempotent)          market = "BeePost" akkaunti
   cod_amount = to_be_paid                            source = external
        │                                                    │
 elchi_shipment yozuvi saqlanadi                      Qabul → kuryerga biriktirish
        │                                                    │
        │                                             KURYER SOTADI / BEKOR QILADI
        │                                                    │
        │  ◄──── webhook: {status, cod_collected} ───────────┘
        ▼                                                 HMAC imzo
 Status moslashtiriladi
        │
 markDeliveredByElchi / markCancelledByElchi
        │
 Mavjud sotuv/bekor oqimi ishlaydi
        │
 ┌──────▼────────────────┐
 │ HISOB-KITOB PANELI    │  jo'natilgan · yetkazilgan · yig'ilgan · qaytarilmagan
 └───────────────────────┘
        ▲
        │ har 15 daqiqada
 REKONSILIATSIYA CRON ──► GET /partner/shipments/:id  (yo'qolgan webhook'ni tutadi)
```

---

## 3C. Tasdiqlangan operatsion oqim (2026-09-08)

Quyidagi oqim Elchi kodida **qadam-baqadam tekshirilgan**. 7 qadamdan **6 tasi bugun ishlaydi**.

| # | Qadam | Elchi'da | Holat |
|---|---|---|---|
| 1 | HQ'dan pilot hududi uchun filial ochiladi | `BranchType`: PICKUP · REGIONAL · HYBRID; egalik OWNED/PARTNER | ✅ |
| 2 | BeePost buyurtmalari HQ'da **skanerlab qabul qilinadi** | `order.receive` — `NEW` → `RECEIVED` (partner buyurtmalari HQ'ga `NEW` tushadi) | ✅ |
| 3 | HQ barcha buyurtmalarni filialga **transfer-batch** bilan jo'natadi | `sendBranchTransferBatch` → `current_batch_id` + `status=ON_THE_ROAD` | ✅ |
| 4 | **Kuryer skani filial qabulini ham bajaradi** | — | 🔨 **YOZILADI** (pastda) |
| 5 | Yoki menejer o'zi qabul qilib kuryerlarga bo'ladi | butun paket: `receive` · tanlab: `receive-orders` | ✅ |
| 6 | Kuryer yetkazadi | `sellOrder` (`WAITING` + `post_id`) | ✅ |
| 7 | **Market hisobiga pul qo'shiladi, xizmat haqqi ayiriladi** | `marketIncome = max(total_price − marketTariff, 0)` — tarif 0 bo'lsa hech narsa ayirilmaydi | ✅ **so'zma-so'z mos** |

---

## 3D. 🔨 YANGI FUNKSIYA — skan bilan avtomatik filial qabuli

**Talab:** kuryer o'z filialiga jo'natilgan paketdagi buyurtmani skan qilsa, tizim **bir amalda**
"filial qabul qildi" + "kuryerga biriktirildi" deb yozsin.

### Nega hozir ishlamaydi — 3 to'siq

HQ paketni jo'natgandan keyin buyurtma: `branch_id` = **hamon HQ**, `status` = **`ON_THE_ROAD`**.
`scanAssignOrder` uchta joyda to'xtatadi:

| # | Tekshiruv | Xato |
|---|---|---|
| 1 | `orderBranchId !== courierBranchId` | *"Boshqa filial orderi — qabul qila olmaysiz"* |
| 2 | Status faqat `NEW`/`RECEIVED`/`WAITING_CUSTOMER` | `ON_THE_ROAD` rad etiladi |
| 3 | `receive-orders` rollari: BRANCH·MANAGER·REGISTRATOR | **COURIER yo'q** |

### Yechim — `current_batch_id` orqali

Elchi `sendBranchTransferBatch`da buyurtmaga **`current_batch_id`** yozadi
(`branch-transfer-batch.service.ts:1688`). Bu — kerakli bog'lovchi: qo'shimcha qidiruv shart emas.

```
Kuryer buyurtma QR'ini skan qiladi
        │
        ▼
scanAssignOrder:  orderBranchId !== courierBranchId ?
        │ ha
        ▼
order.current_batch_id bormi?
        │ ha
        ▼
YANGI RPC: order.transfer_batch.receive_one_by_scan
   { order_id, courier_branch_id, requester }
        │
        ├─ batch.status === SENT            (PENDING → RAD ETILADI)
        ├─ batch.destination === kuryer filiali
        ├─ batch.direction === FORWARD      (qaytarish paketi EMAS)
        └─ buyurtma shu paket ichida va hali qabul qilinmagan
        │
        ▼  bitta tranzaksiyada
   branch_id = filial · status = RECEIVED
   holder_type = BRANCH · holder_branch_id = filial · holder_courier_id = null
   paket item → qabul qilindi · tracking yozuvi · hammasi qabul bo'lsa paket → RECEIVED
        │
        ▼
scanAssignOrder davom etadi (mavjud yo'l)
   RECEIVED → ON_THE_ROAD · courier_id · post yaratiladi/topiladi
```

### Dizayn qarorlari

| Qaror | Sabab |
|---|---|
| **Statusga emas, paket a'zoligiga tayanadi** | `ON_THE_ROAD` Elchi'da **ikki ma'noli**: "filiallar orasida yo'lda" (holder=HQ, `courier_id` null) va "kuryerda". Paket a'zoligi bir ma'noli — umumiy status guardini bo'shatmaydi |
| **Qabul order-service'da bajariladi** | Paket jadvallari va tranzaksiya o'sha yerda. Logistics'da qilish atomikligni buzadi |
| **`receive_one_by_scan` — yangi RPC** | Mavjud `receive_orders` `batch_id` talab qiladi; qidiruv + qabul bitta tranzaksiyada bo'lishi kerak |
| **Ikkita tracking yozuvi** | Custody zanjiri **uzilmaydi**: HQ → BRANCH → COURIER. Skan bitta, daftarda ikki bo'g'in |

### Saqlanishi SHART bo'lgan guardlar

Bu guardlar — butun xavfsizlik hikoyasi. Bo'shatilsa, kuryer **jismonan yetib kelmagan**
posilkani o'ziga yozib olishi mumkin va custody buziladi.

| Guard | Nega |
|---|---|
| `batch.status === SENT` | `PENDING` = paket hali HQ'dan chiqmagan |
| `destination === kuryer filiali` | Boshqa filial posilkasini tortib olmasin |
| `direction === FORWARD` | Qaytarish paketi bu yo'l bilan qabul qilinmasin |
| Buyurtma boshqa kuryerga biriktirilmagan | Mavjud tekshiruv — saqlanadi |
| Takroriy skan idempotent | Qabul qilingan buyurtma qayta yozilmasin |

### Ish hajmi

**Elchi: ~1.5–2 kun** — 1 yangi RPC (order-service) + `scanAssignOrder`da guard shoxi
(logistics-service) + testlar. Yangi jadval yoki migratsiya **yo'q**.

> **Muhim:** menejerning qo'lda qabul qilish yo'li (`receive` / `receive-orders`) **saqlanadi**.
> Skan-qabul uni almashtirmaydi, yoniga qo'shiladi — filial istasa o'zi qabul qiladi.

---

## 4. Pul va summalarni tekshirish

Pilotning asosiy maqsadi — **summalar to'g'ri kelishini isbotlash**.

### Pilot uchun qaror: mavjud, isbotlangan yo'l

`06-platforma.md` §05 da uzoq muddatga **qarz daftari modeli** tavsiya qilingan (Elchi'da bor).
Lekin **pilot uchun PCS'ning mavjud virtual-kuryer oqimi ishlatiladi** — sababi: yangi pul kodi
= yangi xavf, pilotda esa xavf minimal bo'lishi kerak.

| | Pilotda |
|---|---|
| Elchi PCS ichida | Virtual kuryer (`external_provider='elchi'`) — LDG bilan bir xil |
| Elchi sotganda | Mavjud `sellOrder` oqimi → **kassaga tushadi** (bugungi LDG xulqi) |
| ⚠️ Nuance | Pul haqiqatda hali Elchi'da — kassa uni erta ko'rsatadi |
| Yechim | **Yangi "Elchi hisob-kitobi" paneli** buni ochiq ko'rsatadi |

### Hisob-kitob paneli (yangi, kichik)

| Ko'rsatkich | Manba |
|---|---|
| Jo'natilgan buyurtmalar / summa | `elchi_shipment` |
| Yetkazilgan / yig'ilgan summa | webhook `cod_collected` yig'indisi |
| Bekor qilingan / qaytgan | webhook |
| **Elchi bizga qarz** | yig'ilgan − qaytarilgan |
| Elchi tomondagi balans | `GET /partner/shipments/:id` yoki Elchi market balansi |

**Solishtirish mezoni:** PCS panelidagi "Elchi bizga qarz" = Elchi'dagi "BeePost" market balansi.
Farq bo'lsa — pilot muammoni topdi, aynan shuning uchun qilinyapti.

> **Ochiq savol (Q1):** Elchi'da "BeePost" uchun bitta market akkaunti ochiladimi?
> **Tavsiya: ha** — `POST /partner/markets` bilan, `external_seller_id='beepost'`.

---

## 4A. ✅ Oqim kod bo'yicha tasdiqlandi — va 7 ta muammo topildi

> Bu bo'lim ikkala kodbaza **oxirigacha kuzatib** yozilgan (2026-09-08). Oqim ishlaydi,
> lekin quyidagi 7 nuqta tuzatilmasa pilot noto'g'ri natija beradi.

### To'liq zanjir (tasdiqlangan)

| # | Qadam | Qayerda | Natija |
|---|---|---|---|
| 1 | Operator pochtaga buyurtma yig'adi, kuryer = **"Elchi"** | PCS UI (Pochta) | — |
| 2 | "Jo'natish" → `sendPost` → pilot darvozasi → `POST /partner/shipments` | `post.service.ts:1006` | PCS: `ON_THE_ROAD` |
| 3 | `order.create` — status `NEW`, `qr_code_token` avtomat, **branch = HQ (fallback)** | `order-lifecycle:2426`, `resolveBranchIdForOrder:216` | Elchi: `NEW` |
| 4 | Manager/registrator Dispatch sahifasida kuryerga biriktiradi | `assignOrdersToCourier:2711` | `NEW→RECEIVED→ON_THE_ROAD` + **post yaratiladi** |
| 5 | Kuryer postni qabul qiladi | `receivePost:1960` | `WAITING` |
| 6 | Kuryer sotadi | `sellOrder:3131` — **`WAITING` + `post_id` SHART** | `SOLD` |
| 7 | Webhook → PCS status mapper → `sellOrder` (virtual kuryer) | PCS | PCS: `SOLD`, kassaga kirim |

---

### 🔴 M1 — FILIAL TO'SIQI (bloker)

Partner buyurtmalari **HQ filialiga** tushadi: `resolveBranchIdForOrder` da explicit `branch_id`
yo'q, `partner:X` requester'ida `branch_id` yo'q, `branch.user.find_by_user` topmaydi →
**HQ fallback**.

Lekin `assignOrdersToCourier` uchta shart qo'yadi:
1. So'rovchi filialga **MANAGER yoki REGISTRATOR** sifatida biriktirilgan
2. Kuryer **o'sha filialda** COURIER sifatida biriktirilgan
3. **Buyurtma filiali = so'rovchi filiali** (`holder_branch_id ?? branch_id`)

> **Natija:** agar pilot tumani REGIONAL filial tomonidan xizmat qilinsa, mahalliy manager bu
> buyurtmalarni **biriktira olmaydi** — *"Manager/registrator faqat o'z filiali orderlarini
> biriktira oladi"*.
>
> **Bundan tashqari:** HQ filial umuman sozlanmagan bo'lsa `resolveBranchIdForOrder`
> **500 tashlaydi** → shipment yaratish butunlay ishlamaydi.

**Yechim (2026-09-08 da tasdiqlangan ssenariy):** M1 **operatsion oqim bilan** hal qilinadi —
partner buyurtmalari HQ'ga tushadi, HQ ularni **transfer-batch** bilan pilot filialiga jo'natadi.
Qabul qilinganda `branch_id` filialga o'tadi va kuryer biriktirish ishlaydi. Kod o'zgarishi yo'q.

> Bu §3C dagi to'liq oqim. Qolgan variantlar (Partner API'ga `branch_id`, tuman→filial moslash)
> platforma bosqichiga qoldiriladi — pilot uchun kerak emas.

---

### 🔴 M2 — `cod_collected` NET yuboriladi, gross emas (pul)

Webhook `cod_collected: Number(order.paid_amount ?? 0)` yuboradi
(`order-lifecycle:2693`). Lekin `sellOrder`da:

```
totalPrice   = order.total_price
marketIncome = max(totalPrice − marketTariff, 0)
netToBePaid  = marketIncome
paid_amount  = paidAfter   ≈ netToBePaid       ← webhook shuni yuboradi
```

Ya'ni `paid_amount` = **Elchi tarifi ayirilgandan keyingi** summa, kuryer yig'gan pul EMAS.
Koddagi izoh *"`paid_amount` = kuryer yig'gan pul (cod_collected)"* — **noto'g'ri**.

> **Natija:** PCS buni "mijozdan olingan pul" deb qabul qilsa, summalar **hech qachon
> mos kelmaydi**; farq = to'plangan Elchi tarifi.

**Yechim:** Elchi webhook'i **ikkala** qiymatni yuborsin — `cod_collected` (gross, mijozdan
olingan) **va** `market_credited` (net, market balansiga tushgan). Yoki PCS tarifni bilib
o'zi hisoblasin. **Tavsiya: ikkalasini yuborish** — aniq va kelajakdagi carrierlar uchun ham to'g'ri.

---

### 🔴 M3 — Sotuv matematikasi `total_price` ustida, `to_be_paid` ustida emas (pul)

Partner API va'da qiladi: *"`cod_amount=0` → kuryer pul yig'maydi"*. Lekin `sellOrder`
`to_be_paid`ni **o'qimaydi** — faqat **qayta yozadi** (`to_be_paid: netToBePaid`).
Butun hisob `order.total_price` ustida ketadi.

> **Natija:** prepaid buyurtmada (`cod_amount=0`, lekin `subtotal>0`) kuryer hech nima
> yig'masa ham market balansi **o'sadi**. Pilotda COD>0 bo'lgani uchun bu darhol tegmaydi,
> lekin marketplace prepaid buyurtmalarida **bevosita pul xatosi**.

**Yechim (pilot uchun oddiy):** PCS `subtotal = cod_amount` yuborsin, ya'ni
`total_price === to_be_paid`. Shunda ikki maydon ajralib ketmaydi.

---

### 🔴 M4 — Tarif 0 ga default (konfiguratsiya + pul)

`provisionPartnerMarket` `tariff_home`/`tariff_center` ni `Number(dto.tariff_home ?? 0)`
bilan oladi. Gateway DTO'sida bu maydonlar **bor** (`partner-market.swagger.dto.ts:46,52`),
lekin PCS yubormasa **0 bo'ladi** → **Elchi bepul yetkazadi**, butun COD BeePost balansiga tushadi.

**Va teskari invariant:**

> **PCS'dagi "Elchi" virtual kuryer tarifi = Elchi'dagi BeePost market tarifi** bo'lishi SHART.
> Aks holda PCS xarajat sifatida bir summani, Elchi esa boshqasini ushlab qoladi va
> ikki daftar ajraladi.

**Yechim:** market provisioning'da tarif **majburiy** yuborilsin va P0 da kelishilsin;
ikki tomonda bir xil qiymat yozilganini tekshirish — qabul mezoniga qo'shildi (№13).

---

### 🟠 M5 — Sinxronlik nuqsonlari (G2 · G3 · G4)

`05-elchi.md` §03 da batafsil. Pilot uchun **P1 bosqichida majburiy**.

---

### 🟠 M6 — Pul chiqarish QO'LDA

BeePost marketga to'lov Elchi'da `POST /cashbox/payment/market`
(`finance.cashbox.payment_market`) orqali — **Elchi operatori qo'lda kiritadi**. Avtomatik
emas va PCS bu haqda **hech narsa bilmaydi**.

> **Pilot uchun qabul qilinadi** (hajm kichik), lekin PCS panelida "Elchi'dan olingan to'lov"
> qo'lda kiritiladigan maydon bo'lishi kerak — aks holda "Elchi bizga qarz" hech qachon
> kamaymaydi.

---

### 🟡 M7 — Elchi kuryerida kassa bo'lishi shart

`sellOrder`: `if (!courierCashbox && !isManagerRequester) → 'Courier cashbox not found'`.
Pilot kuryerlarida kassa ochilganini P0 da tekshirish kerak.

---

## 4B. 🎛 UI boshqaruvi — integratsiya qora quti bo'lmasin

**Talab:** integratsiyani istalgan vaqtda UI'dan o'zgartirish, yangi integratsiya qo'shish,
olib tashlash. Busiz integratsiya faqat dasturchi tega oladigan qora quti bo'lib qoladi.

### Hozirgi holat

| Tomon | UI holati |
|---|---|
| **PCS** | ✅ **Kuchli namuna bor** — `client/src/pages/integrations/`: 2 tab (*Tashqi saytlar* 1432 qator + *LDG Cargo* 6 sub-tab, jami 3605 qator). Yangi manba (do'kon) qo'shish/o'chirish **bugun UI'dan ishlaydi** |
| **Elchi** | ❌ **Hamkor boshqaruvi UI'si YO'Q** — `admin/partners` da 4 endpoint bor (yaratish · ro'yxat · kalitni yangilash · faollashtirish), lekin sahifa yo'q. BeePost'ni ro'yxatga olish faqat Swagger orqali — **qabul qilinishi mumkin emas** |

### Asosiy prinsip — LDG panelini NUSXALAMAYMIZ

LDG paneli LDG'ga qattiq yozilgan. Elchi uchun ikkinchi nusxa yasash — uchinchi cargo kelganda
uchinchi nusxa demakdir. Buning o'rniga panel **provayder-boshqariladigan** qilinadi:

```
Integratsiyalar sahifasi
├── Tab 1: MANBALAR (Tashqi saytlar)        ← mavjud CRUD, o'zgarmaydi
└── Tab 2: YETKAZUVCHILAR                    ← YANGI, provayder tanlovi bilan
         ┌─────────────────────────────┐
         │  [ LDG ▾ ] [ Elchi ] [ + ]  │     ← provayder tanlanadi
         └─────────────────────────────┘
              6 sub-tab (provider_slug bo'yicha)
```

Bitta panel, provayder tanlovi. LDG ishlashda davom etadi, Elchi ikkinchi variant bo'lib qo'shiladi.
**Uchinchi cargo — yangi UI yozilmaydi.**

### PCS: Yetkazuvchilar paneli — 6 sub-tab

| Sub-tab | Nima boshqariladi |
|---|---|
| **1. Umumiy holat** | Tayyorlik checklisti (kalit ✓ · sekret ✓ · virtual kuryer ✓ · **tarif** ✓ · tumanlar ✓ · ulanish ✓) + kunlik raqamlar |
| **2. Sozlamalar** | API manzili · kalit (faqat yozish, `*_set` bayrog'i) · webhook sekret · **virtual kuryer** tanlash/yaratish · **tarif (uy/markaz)** · **pilot tumanlari — darvoza** · "Ulanishni tekshirish" tugmasi |
| **3. Jo'natmalar** | Filtr pillalari: hammasi · kutilmoqda · **xato** · yetkazilgan · **nomuvofiqlik**; qidiruv; bitta jo'natmani sinxronlash; qayta jo'natish |
| **4. Webhook loglar** | Filtr (qabul · tekshirildi · rad · ishlandi · xato) · payload ko'rish · **qayta ishlash** |
| **5. Hisob-kitob** | Jo'natilgan · yetkazilgan · yig'ilgan · **qarz**; **"Elchi'dan olingan to'lov" qo'lda kiritish** (M6); Elchi balansi bilan solishtirish |
| **6. Boshqaruv** | **Master kill-switch** · rekonsiliatsiyani qo'lda ishga tushirish · integratsiyani o'chirish |

> 1–4 va 6 — LDG panelining tasdiqlangan shakli. **5 (Hisob-kitob) — yangi**, pilotning pul
> tekshiruvi uchun.

### Elchi: Hamkorlar sahifasi (butunlay yangi)

| Ekran | Nima boshqariladi |
|---|---|
| **Hamkorlar ro'yxati** | Nom · holat (faol/o'chirilgan) · webhook manzili · oxirgi faollik |
| **Hamkor yaratish** | Nom · webhook URL · IP allowlist → **API kalit BIR MARTA ko'rsatiladi** (nusxalash tugmasi bilan; qayta ko'rsatilmaydi) |
| **Kalitni yangilash** | Ogohlantirish bilan: eski kalit **darhol** ishlamay qoladi |
| **Faol / o'chirilgan** | **Per-hamkor kill-switch** — BeePost'ni bir tugma bilan uzish |
| **Webhook yetkazish jurnali** | Outbox holati (kutilmoqda · yetkazilgan · muvaffaqiyatsiz) · xato matni · **qayta urinish** |

> Oxirgi ekran muhim: `partner_webhook_outbox`da qatorlar bor, lekin **hech qanday UI yo'q** —
> muvaffaqiyatsiz webhook hozir ko'rinmaydi.

### Nima UI'dan boshqariladi, nima yo'q (halol jadval)

| Amal | Pilot UI bilan | Izoh |
|---|---|---|
| Elchi sozlamalarini o'zgartirish | ✅ | Sozlamalar sub-tabi |
| Pilot tumanlarini o'zgartirish | ✅ | Darvoza ro'yxati |
| Tarifni o'zgartirish (ikki tomonda) | ✅ | PCS + Elchi hamkor sahifasi |
| Integratsiyani to'xtatish/yoqish | ✅ | Master toggle (ikki tomonda) |
| Integratsiyani butunlay olib tashlash | ✅ | O'chirish (soft-delete) |
| **Yangi MANBA (do'kon/market) qo'shish** | ✅ | *Tashqi saytlar* tabi **bugun ishlaydi** |
| **Yangi CARGO qo'shish — kodsiz** | ❌ | PCS'da dispatch config-driven emas. **Yangi cargolar Elchi'ga ulanadi** (`06-platforma.md` qarori) |

> Halol e'tirof: "istalgan integratsiyani UI'dan qo'shish" **manbalar uchun bugun bor**,
> **cargolar uchun** esa platforma ishi (Elchi'da `dispatch_config` allaqachon mavjud).
> Pilot UI'si buni **bloklamaydi** — panel provayder-boshqariladigan bo'lgani uchun
> keyingi cargo faqat konfiguratsiya bo'lib qo'shiladi.

### 4B.2 Operator ekranlari — kunlik ish (bu bo'lim avval yetishmayotgan edi)

Yuqoridagi 6 sub-tab — **sozlash** paneli (admin, kamdan-kam ochiladi). Kunlik ish esa boshqa
ekranlarda kechadi. Quyida **jo'natish** va **qabul qilish** oqimlari ekran-ekran.

#### PCS — jo'natish (mavjud ekran, kichik qo'shimchalar)

Operator **yangi ekran o'rganmaydi** — bugungi Pochta detali ekrani ishlatiladi
(`client/src/pages/mails/pages/superadmin/mail-detail/`, 1290 qator, kuryer tanlash + jo'natish
allaqachon bor).

| # | Ekranda nima ko'rinadi | Holat |
|---|---|---|
| 1 | Kuryer ro'yxatida **"Elchi"** — 🚚 belgi va "tashqi provayder" yozuvi bilan, odam-kuryerdan ajralib turadi | 🔨 kichik |
| 2 | Tanlanganda **oldindan tekshiruv**: *"12 buyurtmadan 12 tasi pilot hududida ✓"* yoki *"9 mos · **3 mos emas**: Chilonzor (2), Yunusobod (1)"* | 🔨 **yangi** |
| 3 | Mos kelmasa **"Jo'natish" tugmasi o'chadi**; mos kelmagan buyurtmalar bosiladigan ro'yxat bo'lib turadi | 🔨 **yangi** |
| 4 | Jo'natilgandan keyin **holat chizig'i**: *"12/12 Elchi'ga yetdi ✓"* yoki *"10/12 · 2 xato — Qayta urinish"* | 🔨 **yangi** |
| 5 | Virtual kuryer uchun **kuryer cheki chop etilmaydi** (odam emas) | 🔨 kichik |

> 2–4 majburiy: darvoza xatosini **jo'natishdan oldin** ko'rsatish kerak, keyin emas. Va dispatch
> fire-and-forget bo'lgani uchun (M6 naqshi) operator **haqiqatan yetdimi** ko'rishi shart —
> aks holda jimgina yo'qolgan buyurtma bo'ladi.

#### Elchi — qabul qilish

| # | Qadam | Ekran | Holat |
|---|---|---|---|
| 1 | HQ: BeePost'dan kelganlarni ko'rish | `new_orders/external_orders/` (870 qator) bor — partner buyurtmalariga **ulanishi tekshiriladi** | 🟡 tekshirish |
| 2 | HQ: **bittalab skanerlab qabul qilish** | **UI YO'Q** — `order.receive` hech qaysi ekrandan chaqirilmaydi | 🔨 **YANGI** |
| 3 | HQ: qabul qilinganlarni paketga yig'ib filialga jo'natish | `pages/batches` bor | ✅ |
| 4 | Filial: paketni skanerlab qabul qilish | `pages/scan` — `BTB-` prefiksli token → **"Qabul qilish" tugmasi** | ✅ **bugun ishlaydi** |
| 5 | Kuryer: buyurtmani skanerlab **o'ziga olish** | **TUGMA YO'Q** — buyurtma skani *faqat o'qish*; `scanAssign` faqat coverage-stub'da | 🔨 **YANGI** |
| 6 | Menejer: kuryerlarga bo'lib berish | `pages/dispatch` bor | ✅ |

> **Eng muhim ikki bo'shliq — 2 va 5.** Ular bo'lmasa oqim **umuman boshqarilmaydi**:
> HQ buyurtmalarni tizimga kiritolmaydi, kuryer esa o'ziga olaolmaydi. Backend endpointlari
> ikkalasida ham **bor** — faqat tugma yo'q.

#### HQ intake ekrani (yangi, №2)

```
┌─ BeePost'dan kelgan buyurtmalar ─────────────────────┐
│  [ Skaner maydoni — QR o'qing ]        Kelgan: 24    │
├──────────────────────────────────────────────────────┤
│  ✓ #100428  Aliyev V.      Chilonzor    250 000     │
│  ✓ #100429  Karimova S.    Yunusobod    180 000     │
│  ✓ #100430  Toshev A.      Chilonzor     95 000     │
│                                                      │
│  Skanerlangan: 3 / 24                                │
│                          [ Qabul qilish (3) ]         │
└──────────────────────────────────────────────────────┘
```
Har QR o'qilganda: qatorga ✓, **ovozli signal**, dublikat skan ogohlantiriladi.
"Qabul qilish" → `order.receive` → `NEW` → `RECEIVED`.

#### Kuryer skan ekrani (mavjud ekranga tugma, №5)

```
┌─ Buyurtma #100428 ───────────────────────────────────┐
│  Mijoz:   Aliyev Vali                                │
│  Manzil:  Chilonzor, 12-uy                           │
│  Summa:   250 000 so'm                               │
│  Holat:   Yo'lda (paketda)                           │
├──────────────────────────────────────────────────────┤
│           [ ✓ O'ZIMGA OLISH ]                        │
└──────────────────────────────────────────────────────┘
```
Bosilganda §3D ishlaydi: **filial qabuli + kuryerga biriktirish** bir amalda.

### 4B.3 "Oddiy va tushunarli" — amal qilinadigan qoidalar

| Qoida | Amalda |
|---|---|
| **Yangi ekran o'rganish shart emas** | Jo'natish — bugungi Pochta ekrani; qabul — bugungi skan ekrani. Faqat 2 yangi ekran (HQ intake, hisob-kitob) |
| **Har qadamda bitta asosiy tugma** | "Jo'natish" · "Qabul qilish (N)" · "O'zimga olish" — ikkilanish yo'q |
| **Xato oldindan ko'rsatiladi** | Darvoza tekshiruvi jo'natishdan **oldin**; tugma o'chadi va sababi yoziladi |
| **"Elchi" har joyda bir xil** | Bitta belgi, bitta rang — kuryer ro'yxatida, jo'natmalar jadvalida, hisob-kitobda |
| **Skanerda ovozli/vizual qaytarma** | PCS'da bor (`playSuccessSound`) — Elchi intake ekraniga ham |
| **Raqamlar har doim ko'rinadi** | "3/24 skanerlangan", "10/12 yetdi", "Elchi qarzi: N so'm" — taxmin qilishga o'rin yo'q |

---

### Ish hajmi

| Ish | Kun |
|---|---|
| **PCS admin:** provayder-boshqariladigan backend (config · jo'natmalar · loglar · reconcile · health) | 3 |
| **PCS admin:** Yetkazuvchilar paneli UI (6 sub-tab) | 4 |
| **PCS operator:** jo'natish ekrani qo'shimchalari (belgi · oldindan tekshiruv · holat chizig'i) | **2** |
| **Elchi admin:** Hamkorlar sahifasi + webhook outbox monitori | 2.5–3 |
| **Elchi operator:** HQ intake skan ekrani (№2) | **2** |
| **Elchi operator:** kuryer "O'zimga olish" tugmasi (№5) | **1** |
| **Elchi operator:** external_orders ro'yxatini ulash (№1) | **1** |
| | **≈ 15–16 kun** |

**Minimal yo'l (pilot ishlaydi va boshqariladi) ≈ 10–11 kun:**

| Kechiktirilmaydi — busiz oqim ishlamaydi | Kun |
|---|---|
| Elchi: HQ intake skan ekrani | 2 |
| Elchi: kuryer "O'zimga olish" tugmasi | 1 |
| PCS: jo'natish ekrani qo'shimchalari | 2 |
| PCS: Sozlamalar + Hisob-kitob + Boshqaruv sub-tablari | 4 |
| Elchi: hamkor yaratish ekrani (yoki bir martaga Swagger) | 1.5 |

**Kechiktiriladi:** PCS Jo'natmalar/Webhook-loglar sub-tablari · Elchi webhook outbox monitori ·
ommaviy qayta jo'natish · grafiklar · external_orders ro'yxati bezaklari.

> ⚠️ **Diqqat:** Elchi'dagi HQ intake ekrani va kuryer tugmasi (§4B.2 №2 va №5)
> **ixtiyoriy emas** — backendda endpointlar bor, lekin tugma yo'q, ya'ni oqim bugun
> **UI'dan umuman bajarilmaydi**.

---

## 5. Qabul mezonlari — pilot muvaffaqiyatli deb hisoblanadi agar

Bu ro'yxat **test rejasi**. Har biri qo'lda tekshiriladi.

| # | Ssenariy | Kutilgan natija | Nimani sinaydi |
|---|---|---|---|
| 1 | Oddiy sotuv: PCS → Elchi → kuryer sotadi | PCS'da `sold`, summa to'g'ri | Asosiy oqim |
| 2 | Elchi kuryeri bekor qiladi | PCS'da `cancelled` | Asosiy oqim |
| 3 | PCS operatori bekor qiladi | Elchi'da ham bekor bo'ladi | Chiquvchi bekor |
| 4 | Sotilganni bekor qilishga urinish | Elchi **409**, PCS holati o'zgarmaydi | Konflikt ishlanishi |
| 5 | **Elchi sotilganni rollback qiladi** | **PCS xabar oladi** | **G3 tuzatilganini** |
| 6 | **sotildi → rollback → yana sotildi** | **Ikkinchi "sotildi" ham yetadi** | **G2 tuzatilganini** |
| 7 | Kuryer "yetkaza olmadim" deydi | PCS'da ko'rinadi, kutilmoqdada qotmaydi | **G4 tuzatilganini** |
| 8 | Webhook ataylab bloklanadi | **Rekonsiliatsiya CRON holatni tuzatadi** | Yo'qolgan webhook himoyasi |
| 9 | Bir buyurtma ikki marta jo'natiladi | Elchi'da **bitta** posilka | Idempotentlik |
| 10 | Pilot hududidan tashqari buyurtma | **Jo'natish bloklanadi, ochiq xato** | Darvoza |
| 11 | Qisman: pochtada 1 ta noto'g'ri tuman | **Butun pochta bloklanadi** | Yetim buyurtma oldini olish |
| 12 | **N ta buyurtma yakunlangach summa** | **PCS gross COD − Elchi tarifi jami = Elchi market balansi** (M2/M4 sababli sodda tenglik ISHLAMAYDI) | **Pul aniqligi** |
| 13 | PCS virtual kuryer tarifi ↔ Elchi market tarifi | **Ikkalasi bir xil qiymat** | M4 — ikki daftar ajralmasligi |
| 14 | Prepaid sinovi (`cod_amount=0`) | Kuryer pul yig'maydi **va** market balansi o'smaydi | M3 — `total_price` tuzog'i |
| 15 | **Kuryer skan qiladi — filial qabul qilmagan** | Bir amalda **qabul + biriktirish**; custody: HQ→BRANCH→COURIER **ikki tracking yozuvi** | §3D asosiy |
| 16 | Kuryer **boshqa filialga** jo'natilgan buyurtmani skan qiladi | **Rad etiladi** | §3D guard |
| 17 | Paket hali `PENDING` (jo'natilmagan) — kuryer skan qiladi | **Rad etiladi** | §3D guard — jismonan chiqmagan |
| 18 | Bir buyurtmani ikki marta skan qilish | Idempotent — ikkinchi marta qabul yozilmaydi | §3D guard |
| 19 | **Integratsiya UI'dan to'xtatiladi** | Jo'natish darhol bloklanadi, mavjud webhooklar ishlashda davom etadi | §4B kill-switch |
| 20 | **Pilot tumanlari UI'dan o'zgartiriladi** | Yangi ro'yxat darhol kuchga kiradi (deploy kerak emas) | §4B darvoza |
| 21 | **Elchi'da hamkor kaliti UI'dan yangilanadi** | Eski kalit darhol ishlamaydi, yangisi bilan jo'natish davom etadi | §4B kalit rotatsiyasi |
| 22 | Elchi'dan olingan to'lov UI'dan kiritiladi | "Elchi bizga qarz" summasi kamayadi | §4B M6 |

**Pilot to'xtatiladi va tahlil qilinadi agar:** 5, 6, 8, 12, 13 yoki 15–18 dan biri muvaffaqiyatsiz bo'lsa.
**19–22 — UI boshqaruvi mezonlari** (pilotni to'xtatmaydi, lekin ishga tushirishdan oldin bajarilishi shart).

---

## 6. Kelajakka tayyorlik — ayniqsa marketplacelar

Talab: *"kelajakda boshqa sistemalar bilan ham ulanish, ayniqsa marketplacelar bilan"*.

**Yaxshi xabar: marketplace yo'nalishi allaqachon qurilgan va pilot uni buzmaydi.**

| Kim | Rol | Holat |
|---|---|---|
| **Elchi-Marketplace** | SOURCE → Elchi | ✅ Klient yozilgan (`elchi-api.client.ts`), Partner API ishlaydi |
| **PCS/BeePost** | SOURCE → Elchi | 🔨 Shu pilotda quriladi — **ikkinchi mijoz** |
| Boshqa marketplacelar | SOURCE → Elchi | Partner API tayyor: kalit + hujjat = ulanish |
| Boshqa cargolar | CARRIER → Elchi | Elchi dvigateli bor, **sinalmagan** (`06-platforma.md` E bosqichi) |

**Muhim:** PCS Elchi Partner API'ning **ikkinchi real mijozi** bo'ladi. Marketplace birinchi.
Ikki mustaqil mijoz — kontrakt to'g'ri chizilganining eng yaxshi isboti.

### Pilot platformani bloklaydimi?

**Yo'q**, agar uchta qoidaga rioya qilinsa:

| Qoida | Nega |
|---|---|
| PCS konnektori **`05-elchi.md` §04 status lug'atiga** tayansin, o'zi o'ylab topmasin | Keyingi carrier shu lug'atni qayta ishlatadi |
| Darvoza **konfiguratsiya**da bo'lsin, kodda emas | Boshqa provayderga ham qo'llanadi |
| Hisob-kitob paneli **`provider_slug` bo'yicha** yozilsin, `'elchi'` qattiq yozilmasin | Ikkinchi provayder qo'shilsa panel qayta ishlatiladi |

---

## 7. Bosqichlar

| | Ish | Qayerda | Kun |
|---|---|---|---|
| **P0** | **Kelishuv:** Elchi'da PCS uchun hamkor ochish (`POST /admin/partners`) → API kalit; PCS webhook URL + sekret; **"BeePost" market akkaunti**; pilot hududi tanlash | Ikkalasi | **1** |
| **P1** | ✅ **BAJARILDI (2026-09-10):** G1 (`sato_code`) · G2 (qisman dedup + `event_id`) · G3 (rollback signali) · G4 (`returned_to_market` · `waiting_customer` · `cancelled_sent`) | Elchi | ~~3–4~~ |
| **P1b** | ✅ **BAJARILDI (2026-09-10):** skan bilan avtomatik filial qabuli (§3D) — inkremental RPC + `scanAssignOrder` shoxi + 15 test | Elchi | ~~1.5–2~~ |
| **P2** | ✅ **BAJARILDI (2026-09-10):** 4 jadval + migratsiya · Partner API klienti · sozlash/moslash servisi (darvoza) · 15 test | PCS | ~~2–3~~ |
| **P3** | ✅ **BAJARILDI (2026-09-10):** virtual kuryer biriktirish · dispatch · **hudud darvozasi** · **BOSHQARUV EGASI** guardi + qaytarib olish · 25 test | PCS | ~~2~~ |
| **P4** | ✅ **BAJARILDI (2026-09-10):** webhook + HMAC (xom tana) + `event_id` takror himoyasi · status mapper · 3 terminal amal · nomuvofiqlik · 31 test | PCS | ~~2–3~~ |
| **P5** | ✅ **BAJARILDI (2026-09-10):** solishtiruvchi CRON (har 15 daq) · aylanish kafolati · webhook bilan **ayni** qo'llash mantiqi · 15 test | PCS | ~~2~~ |
| **P5a** | ✅ **BAJARILDI (2026-09-10):** **Yetkazuvchilar** tabi (provayder registri) + Elchi 6 sub-tab · admin servis (hisob-kitob/jurnal/monitor) + `elchi_settlement_payment` jadvali · 18 test | PCS | ~~7~~ |
| **P5b** | ✅ **BAJARILDI (2026-09-10):** jo'natish ekrani — ELCHI belgisi · **darvoza oldindan tekshiruvi** (tugma bloklanadi) · dispatch holat oynasi + qayta jo'natish · virtual kuryerga chek yo'q | PCS | ~~2~~ |
| **P5c** | ✅ **BAJARILDI (2026-09-10):** HQ intake skan ekrani (yangi sahifa+entity+marshrut+menyu) · kuryer **"O'zimga olish"** tugmasi · 3 tilda tarjima | Elchi FE | ~~4~~ |
| **P5d** | ✅ **BAJARILDI (2026-09-10):** Hamkorlar sahifasi (yaratish · **bir martalik kalit** · rotatsiya · per-hamkor kill-switch) + **webhook outbox monitori** (2 yangi endpoint) · 9 test · 3 tilda | Elchi | ~~2.5–3~~ |
| **P6** | **Real test:** §5 dagi 12 ssenariy; kichik hajmda boshlash, kengaytirish | Ikkalasi | **2–3** |

> **P0 va P6 dan boshqa BARCHA bosqichlar bajarildi (2026-09-10).** Qolgani ikkitasi va ikkisi ham TASHQI: Elchi hamkor akkaunti + API kalit (P0), va birgalikda o'tkaziladigan real test (P6).

**Jami: ~28–33 kun** (P6 test bilan). Ajratilgan holda:
- **Yadro kod** (P0–P5): 11–14 kun
- **UI** (P5a–P5d): 15–16 kun — *minimal yo'l bilan 10–11 kun*
- **Real test** (P6): 2–3 kun

> **Minimal UI bilan jami: 23–28 kun.** P5c (Elchi operator ekranlari) **eng ustuvor** —
> busiz oqim UI'dan umuman bajarilmaydi.

> P5a boshqa bosqichlarga **parallel** ketishi mumkin (turli odam / turli repo).
> Minimal UI bilan (kechiktirilishi mumkin qismlarsiz) UI ishi **6–7 kunga** tushadi.

> **Holat (2026-09-10):** UI ishlari (P5a · P5b · P5c · P5d) **to'liq bajarildi**. Kodda qolgan ish yo'q.

**Parallel:** P1 (Elchi) va P2 (PCS) bir vaqtda ketadi.
**Birinchi jonli buyurtma:** P4 oxirida.

---

## 7A. ✅ Bajarilgan ish — P1 · P1b · P2 · P3 · P4 · P5 · P5a–P5d (2026-09-10)

Elchi-Backend, branch `shodiyor`. **66 test to'plami / 501 test PASS**, typecheck toza
(faqat oldindan mavjud `catalog-service` xatolari qoldi).

| Fayl | Nima qilindi |
|---|---|
| `apps/api-gateway/src/partner-gateway.controller.ts` | **G1** — `/partner/regions` va `/partner/districts` endi `sato_code` qaytaradi |
| `apps/api-gateway/src/partner-gateway.geo.spec.ts` | G1 testlari (+2). ⚠️ Eski test `sato_code` **sizmasligini** tekshirardi — qaror teskari qilindi va sababi izohda yozildi |
| `apps/integration-service/src/entities/partner-webhook-outbox.entity.ts` | **G2** — dedup indeksi **qisman**: `WHERE status IN ('pending','processing')` |
| `migrations/1716000000024-PartnerWebhookDedupPending.ts` | **G2** migratsiyasi (yangi). Qisman indeks to'liqdan bo'shroq → mavjud ma'lumotni buzmaydi |
| `apps/integration-service/src/integration-service.service.ts` | **G2** — webhook payloadiga `event_id` (UUID) qo'shildi: qabul qiluvchi takrorni **status bo'yicha emas, hodisa id bo'yicha** ajratadi |
| `apps/integration-service/src/integration-service.partner-webhook.spec.ts` | G2 testlari (+2) |
| `apps/order-service/src/lifecycle/order-lifecycle.service.ts` | **G3** — `rollbackOrderToWaiting` endi signal chiqaradi (barcha 3 yo'nalish). **G4** — `resolveSyncAction`ga `RETURNED_TO_MARKET`→`canceled`, `WAITING_CUSTOMER`→`waiting`, `CANCELLED_SENT`→`canceled`; `markReturnedToMarket`ga alohida emit |
| `apps/order-service/src/order-service.external-sync.spec.ts` | Yangi spec — 17 test (G3+G4) |
| `Elchi-Backend/docs/PARTNER_API.md` | Kontrakt yangilandi: `sato_code`, `event_id` + dedup qoidasi, holat jadvali |

### Ishlash paytida topilgan qo'shimchalar

| Topilma | Qanday hal qilindi |
|---|---|
| Webhook payloadida **hodisa identifikatori yo'q** edi → qabul qiluvchi takrorni ishonchli ajrata olmaydi | `event_id` (UUID) qo'shildi. Busiz qisman dedup ham to'liq xavfsiz bo'lmaydi |
| `CANCELLED_SENT` ham signal chiqarmasdi (`updateFull` orqali) | G4 sinfiga qo'shib tuzatildi |
| `couldNotDeliverOrder` `updateFull` orqali ketadi, undagi emit `audit` bayrog'iga bog'liq **emas** | Alohida emit **kerak emas** — faqat mapping yetarli bo'ldi |

### P1b — skan bilan avtomatik filial qabuli (2026-09-10)

| Fayl | Nima qilindi |
|---|---|
| `apps/order-service/src/transfer-batch/branch-transfer-batch.service.ts` | Yangi `receiveOneOrderByScan` — **inkremental** qabul |
| `apps/order-service/src/order-service.controller.ts` | `order.transfer_batch.receive_one_by_scan` pattern (faqat ichki, HTTP'ga chiqarilmagan) |
| `apps/logistics-service/src/logistics-service.service.ts` | `scanAssignOrder`ga scan-through shoxi + `receiveOrderIntoBranchByScan` helper |
| `apps/order-service/src/order-service.receive-by-scan.spec.ts` | Yangi spec — **11 test** (7 guard + 4 muvaffaqiyat) |
| `apps/logistics-service/src/logistics-service.scan-assign.spec.ts` | +4 test (scan-through, rad etish, guard xatosi, ortiqcha RPC yo'q) |

**Eng muhim topilma — mavjud `receive_orders`ni QAYTA ISHLATIB BO'LMAYDI.** U
"tanlanganlarni qabul qil, **qolganini `NEW`ga qaytar**, paketni **YOP**" semantikasiga ega.
Kuryer bitta buyurtma skan qilganda bu falokat bo'lardi: paketdagi qolgan hamma buyurtma
qayta batchlanib ketardi. Shu bois yangi metod **inkremental**: bitta buyurtmani qabul
qiladi, qolganlarga **tegmaydi**, paket faqat **oxirgi** element qabul qilinganda yopiladi.

**Ikkinchi topilma:** `findOrderById` (logistics) javob qobig'ini **ochmaydi**,
`findOrderByQrToken` esa ochadi (`data.data` / `data` / xom). Qabuldan keyin buyurtmani
qayta o'qish uchun **QR token orqali** o'qiladi — aks holda status guardi buzilardi.

`order_count` / `total_price` **ataylab tegilmaydi** — ular paket jo'natilganda nima
borligini bildiradi (partial-receive yo'li ularni qayta hisoblaydi, chunki qolganini
tashlab yuboradi; bu yerda tashlanmaydi).

### P2 — PCS poydevori (2026-09-10)

PCS `server`, branch `shodiyor`. **21 to'plam / 205 test PASS**, typecheck **0 xato**.

| Fayl | Nima qilindi |
|---|---|
| `core/entity/elchi-config.entity.ts` | Singleton sozlama: master kill-switch, API kalit, webhook sekret (+ rotatsiya), `elchi_market_id`, virtual kuryer |
| `core/entity/elchi-shipment.entity.ts` | Buyurtma ↔ Elchi posilkasi. `cod_amount_sent` **va** `cod_collected_reported` alohida — M2 sababli |
| `core/entity/elchi-webhook-log.entity.ts` | Takror himoyasi, PK = **`event_id`** (Elchi'da P1'da qo'shilgan maydon) |
| `core/entity/elchi-district-map.entity.ts` | Tuman moslamasi **va DARVOZA** (`is_enabled`) |
| `migrations/1749600000000-ElchiIntegration.ts` | 4 jadval, idempotent, FK'lar bilan |
| `api/elchi-cargo/elchi-api.service.ts` | Partner API klienti: global navbat (600ms) · retry (429/5xx) · himoyalangan qobiq ochish |
| `api/elchi-cargo/elchi-config.service.ts` | Sozlama CRUD (sirlar maskalangan) · ulanish testi · **SOATO avtomatik moslash** · darvoza kaliti |
| `api/elchi-cargo/elchi-config.spec.ts` | **15 test** — invariantlar qulflandi |

### P2 dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| **Darvoza `elchi_district_map.is_enabled`da, config'dagi SOATO massivida EMAS** | LDG'da aynan shunday massiv bo'lgan (`enabled_district_sato_codes`), ikki joyda ikki haqiqat yaratgan va **butunlay olib tashlangan** — ustun esa dormant qolib ketgan. Moslama va ruxsat bitta qatorda: bitta ekran, bitta haqiqat manbai |
| `is_enabled` standart **`false`** | Moslama yaratilishi jo'natishga ruxsat bermaydi. Jadval bo'sh = hamma tuman bloklangan (xavfsiz standart) |
| **`syncDistricts` `is_enabled`ga tegmaydi** | Aks holda "moslashni yangilash" tugmasi darvozani bilvosita ochib yuborardi. Testda qulflangan |
| Qo'lda moslangan qator ustidan yozilmaydi | Operator tuzatgan narsa avtomatik moslash tomonidan yo'q qilinmasin |
| `cod_amount_sent` **va** `cod_collected_reported` alohida | M2: Elchi qaytargan summa NET (tarif ayirilgan). Ayirmasi = Elchi tarifi → hisob-kitob paneli aynan shuni ko'rsatadi |
| Bitta global so'rov navbati (600ms) | Elchi hamkor bo'yicha ~120/daq limit qo'yadi. Bitta navbat = qancha oqim bo'lsa ham limitdan oshmaslik **kafolati** (LDG'da 429 orqali o'rganilgan dars) |
| `bigintTransformer` (null-saqlovchi) nullable ustunlarda | LDG webhook jurnalida nonNull variant nullable ustunga qo'llangan — bu null→0 yozib "IS NOT NULL" filtrlarini buzadigan tuzoq. Takrorlamadik |
| `users.external_provider` qayta ishlatiladi | LDG migratsiyasida allaqachon bor — yangi ustun kerak emas |

### P3 — jo'natish, darvoza va BOSHQARUV EGASI (2026-09-10)

**23 to'plam / 230 test PASS**, typecheck **0 xato**.

#### Yangi arxitektura qarori: yagona boshqaruv egasi

Foydalanuvchi taklifi — Elchi akkaunti BeePostda ham sotish/bekor qilsin — **tahlil
qilindi va o'zgartirildi**. Sabab: ikki tizim mustaqil "sotildi" yozsa **pul ikki
daftarda** paydo bo'ladi. Bizning status guardimiz (sotish `WAITING` talab qiladi) faqat
BIZ tomonni himoyalaydi; provayder tomonini emas. Elchi Partner API'sida "sotildi deb
belgila" endpointi ham **yo'q** (faqat `cancel`), ya'ni teskari yo'nalishda yopib bo'lmaydi.

Yechim — `order.control_owner`:

```
Elchi'ga jo'natildi  →  control_owner = 'elchi'
                        BeePostda sotish/bekor/rollback BLOKLANADI
                        holat faqat webhook orqali o'zgaradi
                                │  integratsiya buzildi / posilka qaytdi
                                ▼
"Boshqaruvni qaytarib olish"  →  AVVAL Elchi posilkasi bekor qilinadi
                                 KEYIN control_owner = null
                                 endi BeePostda normal ishlanadi
```

**Hech qachon ikkalasi birga emas.** Har o'tish audit'ga yoziladi.

| Fayl | Nima qilindi |
|---|---|
| `core/entity/order.entity.ts` | `control_owner` ustuni (+ indeks). `null` = biz boshqaramiz — eski yozuvlar tegilmaydi |
| `migrations/1749600000000-ElchiIntegration.ts` | `order.control_owner` qo'shildi (idempotent `ADD COLUMN IF NOT EXISTS`) |
| `api/order/order.service.ts` | `assertControlAllowed` guardi + `sellOrder` · `cancelOrder` · `partlySold` · `rollbackOrderToWaiting`ga ulandi. `bulkSell/bulkCancel` yakka metodlarni chaqirgani uchun avtomatik qamraladi |
| `api/elchi-cargo/elchi-shipment.service.ts` | Kill-switch · **hudud darvozasi** · dispatch · **`reclaimControl`** |
| `api/elchi-cargo/elchi-config.service.ts` | `bindCourier` — virtual kuryer + kassa |
| `api/elchi-cargo/elchi-config.controller.ts` | Sozlama · ulanish testi · kuryer biriktirish · tuman moslash · **darvoza kaliti** · **boshqaruvni qaytarib olish** |
| `api/post/post.service.ts` | Darvoza (yozuvlardan **oldin**, tranzaksiya ichida) + Elchi dispatch shoxi |
| `elchi-shipment.spec.ts` · `order-control-guard.spec.ts` | **25 test** |

#### P3 dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| `bypassControlGuard` — **alohida parametr**, DTO maydoni EMAS | HTTP qatlamidan berib bo'lmaydi. DTO maydoni bo'lsa validatsiya sozlamasiga bog'liq bo'lib qolardi |
| **LDG buyurtmalarida `control_owner` to'ldirilmaydi** | LDG prod'da ishlayapti; xulqini o'zgartirmaymiz. Guard faqat yangi provayderlarga taalluqli |
| Darvoza `newOrders` olingandan **keyin**, yozuvlardan **oldin** | Keyinroq tekshirilsa buyurtmalar allaqachon `ON_THE_ROAD` bo'lib "yetim" qolardi |
| Darvoza **ikki qatlamda** (pochta + har posilka) | `createShipmentForOrder` boshqa yo'llardan ham chaqiriladi (qo'lda qayta jo'natish, retry) |
| `subtotal = cod_amount` | M3: Elchi sotuv matematikasi `to_be_paid`ni o'qimaydi, `total_price` ustida ishlaydi |
| Javobda `shipment_id` bo'lmasa — **boshqaruv o'tmaydi** | Aks holda buyurtma "muallaq" qolardi: bizda bloklangan, Elchi'da yo'q |
| Qaytarib olishda bekor qilinmasa — **boshqaruv qaytarilmaydi** (`force`dan tashqari) | Jimgina bosib o'tish aynan ikki tomonli faollikka olib kelardi. `force` nomuvofiqlik belgisini qo'yadi |
| Virtual kuryer akkaunti **tashqi tomonga berilmaydi** | `assertCourierOwnsOrder` tashqi provayder aktyori uchun egalik tekshiruvini o'tkazib yuboradi — bu akkaunt privilegiyalangan |

### P4 — webhook qabuli (2026-09-10)

**25 to'plam / 261 test PASS**, typecheck **0 xato**.

| Fayl | Nima qilindi |
|---|---|
| `utils/elchi-signature.util.ts` | HMAC-SHA256 (xom tana) + kalit rotatsiyasi + timing-safe solishtirish |
| `utils/elchi-status.mapper.ts` | Elchi status → PCS holat + terminal amal. **Modul yuklanishida `CLOSED` taqiqi** |
| `dto/elchi-webhook.dto.ts` | Payload kontrakti (`event_id`, `cod_collected` — M2 izohi bilan) |
| `elchi-webhook.service.ts` | Imzo → parse → takror himoyasi → posilka yangilash → terminal amal |
| `elchi-webhook.controller.ts` | `POST /api/v1/elchi/webhook` — auth guard YO'Q, faqat HMAC |
| `api/app.service.ts` | Webhook yo'li uchun `express.raw()` (`express.json()`dan OLDIN) |
| `api/order/order.service.ts` | `markDeliveredByElchi` · `markCancelledByElchi` · `markReturnedByElchi` + `logElchiMismatch` |
| 2 spec | **31 test** (15 util + 16 servis) |

#### P4 dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| Imzo **xom tana** ustidan tekshiriladi | `JSON.parse`→`stringify` aylanishi kalit tartibini/bo'shliqni o'zgartirib hashni buzadi. `express.raw()` sozlanmagan bo'lsa kontroller **ochiq xato** yozadi va 401 qaytadi — jimgina o'tmaydi |
| Elchi imzosida **timestamp YO'Q** → takror himoyasi `event_id`da | Imzoning o'zi o'zgarmagan so'rovni cheksiz qabul qiladi. Shu bois `elchi_webhook_log.event_id` PK — bu P1'da Elchi'ga qo'shgan maydon |
| **Statusga qarab dedup QILINMAYDI** | Bir status qayta yuz berishi mumkin (`sold`→rollback→`sold`). `(shipment_id, status)` dedup kaliti bo'la olmaydi |
| Oldingi urinish `failed` bo'lsa **qayta ishlanadi** | Aks holda vaqtinchalik xato (DB timeout) hodisani **abadiy** yo'q qilardi |
| `event_id` kelmasa — xom tana hashidan zaxira kalit | Ayni so'rovning qayta yuborilishi hamon to'siladi. Zaxira, yechim emas — ogohlantirish yoziladi |
| Terminal amallar `bypassControlGuard: true` bilan | Buyurtma `control_owner='elchi'` bo'lgani uchun odatdagi guard bloklaydi; webhook esa uni o'zgartirishga haqli **yagona** yo'l |
| **Oraliq status buyurtmaga TEGMAYDI** | Faqat posilkada qayd etiladi. Majburan `WAITING`ga o'tkazish qaytarish oqimini chalkashtirardi |
| `closed` **e'tiborga olinmaydi** | `CLOSED` faqat bizning skaner oqimimizdan. Mapperda modul-yuklanish taqiqi bor (LDG'dagi xato takrorlanmasin) |
| O'chirilgan holatda **200** qaytariladi | Elchi 2xx bo'lmasa cheksiz qayta yuboradi. Buyurtma esa tegilmaydi |
| Vaqtinchalik xatoda **500** | Elchi outboxi qayta yuborishi TO'G'RI xulq |
| Nomuvofiqlik posilkaga yoziladi (`mismatch_at`) | Admin panelning "Nomuvofiqlik" filtri shu maydon orqali topadi |

> **Bonus:** P6 ("PCS'dan bekor qilish") aslida **boshqaruvni qaytarib olish**
> mexanizmi bilan qamrab olindi — PCS'da bekor qilish uchun avval boshqaruv
> qaytariladi va u ayni paytda Elchi posilkasini bekor qiladi. Alohida kod kerak emas.

### P5 — solishtiruvchi CRON (2026-09-10)

**26 to'plam / 276 test PASS**, typecheck **0 xato**.

| Fayl | Nima qilindi |
|---|---|
| `elchi-reconcile.service.ts` | `@Cron('0 */15 * * * *')` · partiya 40 ta · `reconcileOne` (admin tugmasi) |
| `elchi-webhook.service.ts` | `applyPayload` → **public `applyStatusUpdate`** (endi umumiy) |
| `elchi-config.controller.ts` | `POST /elchi/reconcile` · `POST /elchi/orders/:id/reconcile` |
| `elchi-reconcile.spec.ts` | **15 test** |

#### P5 dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| **Qo'llash mantiqi webhook bilan AYNI** (`applyStatusUpdate`) | Solishtiruvchi o'z mantig'iga ega bo'lsa, ikki yo'l vaqt o'tib ajralib ketadi va bir xil status ikki xil natija berardi — pul aniqligi talab qilinadigan joyda qabul qilinmaydi |
| **`cod_collected` solishtiruvdan YUBORILMAYDI** | `GET /partner/shipments/:id` javobidagi `cod_amount` — bu `to_be_paid`, webhookdagi `paid_amount` EMAS. Aralashtirish pul solishtiruvini buzardi (M2) |
| `last_synced_at` **status o'zgarmasa ham** yangilanadi | Aylanish kafolati: aks holda tartib o'zgarmay, ayni posilkalar qayta-qayta tekshirilib boshqalari navbatga kelmasdi (LDG'da 100-limit muammosi) |
| Xato bo'lgan posilkada ham belgi yangilanadi | Bitta muammoli posilka butun navbatni **bloklab qo'ymasin** |
| `NULL` statusli posilkalar ham so'raladi | Jo'natilgan-u hech qanday xabar kelmagan posilka — **eng shubhali** holat |
| Terminal Elchi statuslari so'rovdan chiqariladi | Aks holda CRON tugagan posilkalarni abadiy tekshirib yurardi |
| Bir vaqtda bitta aylanish (`running` bayrog'i) | Ustma-ust tik ortiqcha so'rov beradi. Ko'p instansiyada to'liq himoya emas, lekin qo'llash idempotent — zarar yo'q |
| Partiya 40 ta | Global navbat 600ms → ~24 soniya. 15 daqiqalik tik uchun xavfsiz |

### P5c — Elchi operator ekranlari (2026-09-10)

Elchi-Frontend. **44 test fayli / 179 test PASS**, typecheck **0 xato**, lint toza.

| Fayl | Nima qilindi |
|---|---|
| `pages/incoming-orders/index.tsx` | **YANGI** — HQ intake skan ekrani |
| `entities/incoming-orders/index.ts` | **YANGI** — `GET /orders/external` so'rovi + himoyalangan qobiq ochish |
| `pages/scan/detail.tsx` | Kuryer uchun **"O'ZIMGA OLISH"** tugmasi + inline xabar |
| `pages/scan/lib/scanResource.ts` | `scanAssignOrder` (`POST /orders/scan-assign`) |
| `app/lib/routes.tsx` · `widgets/Sidebar/model/menuConfig.tsx` | Marshrut + menyu (superadmin · admin · registrator) |
| `locales/{uz,ru,en}/common.json` | 19 kalit, **joyida** qo'shildi (alifbo tartibiga solmadim — 368 qatorlik ortiqcha diff bo'lardi) |

#### ⚠️ Tuzatilgan noto'g'ri taxmin

Rejada `new_orders/external_orders/` (870 qator) "kiruvchi buyurtmalar sahifasi, ulanishi
tekshiriladi" deb yozilgan edi. **Aslida u butunlay boshqa narsa** — *integratsiyalar*
CRUD ro'yxati (`useGetIntegrations`, `INTEGRATIONS.BASE`). Papka nomi chalg'ituvchi.
Ya'ni kiruvchi buyurtmalar ekrani **umuman yo'q edi** va noldan yozildi.

#### P5c dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| **Skan har safar serverga so'rov yubormaydi** | Ro'yxat bir marta yuklanadi, skanerlangan token ro'yxatdagi `qr_code_token` bilan solishtiriladi. (a) skaner tez ishlaydi, har skanda so'rov kutish operatorni sekinlashtiradi; (b) ro'yxatda YO'Q posilkani tasodifan qabul qilishning oldini oladi |
| Tugma faqat **kuryer** roliga ko'rinadi | Backend guardi ham `@Roles(COURIER)` — boshqa rolga tugma ko'rsatish bosgan zahoti 403 berardi |
| Sahifa faqat **superadmin/admin/registrator** | `POST /orders/receive` guardi bilan bir xil |
| **Backend xato xabari ko'rsatiladi** | Backend aniq sababni aytadi ("paket hali jo'natilmagan", "boshqa filial orderi", "allaqachon boshqa kuryerga biriktirilgan"). Umumiy xabar kuryerni ko'r qoldirardi |
| Raqamlar doim ko'rinadi | "Kelgan: 24 · Skanerlangan: 3/24" — operator taxmin qilmasligi kerak |
| Dublikat skan **ogohlantiriladi** | Jimgina o'tkazib yuborilsa operator ikki marta skanerladi deb o'ylamaydi |
| Ovozli qaytarma mavjud mexanizmdan | `playScanFeedback` app darajasidagi overlay bilan ishlaydi — `shared/components/ScanFeedbackOverlay` ham aynan shu joydan import qiladi, ya'ni naqsh mos |

### P5b — PCS operator jo'natish ekrani (2026-09-10)

**Fayl:** `client/src/pages/mails/pages/superadmin/mail-detail/index.tsx` (+ yangi hook)

| Qism | Nima qilindi |
|---|---|
| **ELCHI belgisi** | Kuryer ro'yxatida (`external_provider === 'elchi'`) — **ikkala** ro'yxatda: oddiy va super kuryer. Backend o'zgarishi kerak emas: `userRepo.find` `select`siz ishlaydi, ya'ni ustun allaqachon kelayotgan edi |
| **Darvoza oldindan tekshiruvi** | Elchi tanlanganda `POST elchi/gate/preview` chaqiriladi. Bloklangan buyurtma bo'lsa — qizil panel (raqam · tuman) va **Tasdiqlash tugmasi o'chadi**. Toza bo'lsa — yashil chiziq |
| **Dispatch holat oynasi** | Jo'natgandan keyin ro'yxatga QAYTMAYDI (odatdagi oqim qaytadi). Jami / Yetdi / Yetmadi + navbatdagilar; yetmaganlar sababi (`last_error`) bilan va **"Qayta jo'natish"** tugmasi bilan chiqadi |
| **Chek yo'q** | Virtual kuryerga `generateCourierReceipt` chaqirilmaydi — imzolaydigan odam yo'q. Excel eksport esa qoladi (pochta ro'yxati baribir kerak) |

**Yangi backend endpoint:** `POST /elchi/orders/:orderId/dispatch-retry` — `createShipmentForOrder`
ustiga yupqa qatlam (idempotent, `external_order_id` bo'yicha).

#### P5b dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| **Tugma bloklanadi**, ogohlantirish emas | Server qoidasi *hammasi yoki hech biri* — bitta ruxsatsiz tuman BUTUN pochtani rad etadi. Tugma faol qolsa operator sababsiz xatoga uriladi |
| Preview `mutation`, `query` emas | Natija tanlangan buyurtmalar ro'yxatiga bog'liq; kesh bu yerda chalg'ituvchi bo'lardi |
| Preview xatosi jo'natishni **to'smaydi** | Haqiqiy darvoza baribir serverda; UI faqat oldindan ogohlantiruvchi. Tekshiruv yiqilgani uchun ishni to'xtatish noto'g'ri |
| Serverdagi darvoza va UI **bitta metodni** ishlatadi | `findBlockedByGate` — `assertDistrictsAllowedForPost` (xato tashlaydi) va `previewGate` (tashlamaydi) uchun umumiy. Ajralib ketsa UI "toza" deb ko'rsatib, jo'natishda xato chiqardi |
| Kutilgan son **tashqaridan** beriladi | `dispatch-status` dagi `total` — urinib ko'rilganlar soni: yozuv API javobidan KEYIN saqlanadi. Faqat unga tayanilsa, dispatch boshlanmasidan "0/0 — hammasi tayyor" ko'rinardi |
| So'rov ~1 daqiqada **to'xtaydi** | Ba'zi xatolar (sozlama yo'q, tuman moslanmagan) yozuv yaratilmasdan otiladi — u holda buyurtma ro'yxatda umuman paydo bo'lmaydi va shartli so'rov cheksiz aylanardi. To'xtagach "Yangilash" tugmasi qoladi |

**Tekshiruv:** typecheck toza (client + server), `elchi-cargo` + `post` + `order-control-guard` — **129 test PASS**.

---

### P5a — PCS Yetkazuvchilar paneli (2026-09-10)

**Prinsip bajarildi:** LDG paneli **nusxalanmadi**. `IntegrationsRoot` dagi ikkinchi tab
endi "LDG Cargo" emas, **"Yetkazuvchilar"** — provayder tanlovi bilan. LDG paneliga
mazmunan tegilmadi (faqat pill-nav umumiy komponentga ko'chirildi).

```
Integratsiyalar
├── Tab 1: Tashqi saytlar      ← o'zgarmadi
└── Tab 2: YETKAZUVCHILAR      ← YANGI kabina
         [ LDG Cargo ] [ Elchi Pochta ] [ + ]
                └── 6 sub-tab (provayderga xos modul)
```

| Fayl | Nima qilindi |
|---|---|
| `components/providers/registry.tsx` | Yetkazuvchilar registri — yangi provayder = massivga **bitta yozuv** |
| `components/providers/ProvidersTab.tsx` | Provayder tanlovi + tanlangan panel |
| `components/providers/ProviderSubNav.tsx` | Sub-tab navi — **LDG va Elchi bittasini** ishlatadi |
| `components/LdgCargoTab.tsx` | Faqat nav umumiy komponentga ko'chirildi (mazmun o'zgarmadi) |
| `components/elchi/ElchiCargoTab.tsx` + 6 ta sub-tab | Umumiy holat · Sozlamalar · Jo'natmalar · Webhook loglar · **Hisob-kitob** · Boshqaruv |
| `shared/api/hooks/useElchiConfig` · `useElchiAdmin` | Sozlama va admin so'rovlari |

**Backend (yangi):** `elchi-admin.service.ts` + `elchi-admin.controller.ts`
(`/elchi/admin/*`), `elchi_settlement_payment` jadvali va migratsiyasi
(`1749600001000`). **18 test PASS**.

| Endpoint | Nima uchun |
|---|---|
| `GET admin/health` · `GET admin/stats` | Tayyorlik + raqamlar (health tashqi so'rov qiladi, stats qilmaydi) |
| `GET admin/shipments` | Filtr pillalari: hammasi · kutilmoqda · xato · yetkazilgan · **nomuvofiqlik** + qidiruv |
| `POST admin/shipments/:orderId/resolve-mismatch` | Nomuvofiqlikni yopish (**pulga tegmaydi**) |
| `GET admin/webhook-logs` · `POST .../:eventId/reprocess` | Jurnal + qayta ishlash |
| `GET admin/settlement` · `POST/DELETE admin/settlement/payments` | Pul solishtiruvi + **qo'lda to'lov (M6)** |
| `POST admin/shutdown` | Uchala kalitni birdan o'chirish |

#### P5a dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| **Qarz davr bo'yicha kesilmaydi** | Qarz — to'planuvchi qoldiq. Davr bilan kesilsa, oldingi oyda yig'ilib bu oyda to'langan pul "ortiqcha to'lov" bo'lib ko'rinardi. Javobda `period` (harakat) va `overall` (qoldiq) **ikki alohida blok** |
| Yig'ilgan pul `elchi_status_changed_at` bo'yicha sanaladi | Pul buyurtma yaratilganda emas, **yetkazilganda** yig'iladi |
| **Kelajak sanali to'lov rad etiladi** | Qarzni bugun yolg'on kamaytirardi |
| To'lov yozuvi **kassaga tegmaydi** | Aks holda bitta pul ikki marta hisoblanardi. Bu — solishtirish daftari, kassa emas |
| **Imzosi noto'g'ri webhook qayta ishlanmaydi** | Imzo XOM tana ustidan tekshiriladi; bizda faqat parse qilingan JSON bor va uni qayta serializatsiya qilish bayt-ma-bayt bir xil chiqishiga kafolat yo'q. "Qayta tekshiramiz" degan yolg'on xavfsizlikdan aniq rad etish yaxshiroq |
| Muvaffaqiyatli webhook **qayta qo'llanmaydi** | Ikki marta qo'llash pul/holatni buzardi |
| `mismatch_at > 0` sharti | LDG'da null→0 transformer tuzog'i butun ro'yxatni "nomuvofiq" ko'rsatgan edi — filtr himoyalangan yoziladi |
| "O'chirish" **ma'lumotni o'chirmaydi** | Posilka bog'lanishi va pul izi eski buyurtmalar tarixi uchun kerak |
| "+" tugmasi **o'chiq holatda** turadi | Yangi cargo hozir server kodi talab qiladi. Ishlaydigandek ko'rsatish operatorni chalg'itardi |

### P5d — Elchi Hamkorlar sahifasi + outbox monitori (2026-09-10)

| Fayl | Nima qilindi |
|---|---|
| `Elchi-Frontend/src/pages/partners/index.tsx` | Hamkorlar ro'yxati + yaratish + **bir martalik kalit** + rotatsiya + per-hamkor kill-switch + **webhook outbox monitori** |
| `Elchi-Frontend/src/entities/partners/index.ts` | So'rovlar (himoyalangan qobiq ochish) |
| `shared/api/endpoints.ts` · `routes.tsx` · `menuConfig.tsx` | `/partners` marshruti + menyu (superadmin/admin) |
| `locales/{uz,ru,en}/common.json` | 43 kalit, joyiga qo'yilgan |
| `integration-service.service.ts` | `listPartnerWebhooks` · `retryPartnerWebhook` · `listPartners` webhook xulosasi bilan |
| `partner-admin-gateway.controller.ts` | `GET admin/partners/webhooks` · `POST admin/partners/webhooks/:id/retry` |
| `integration-service.partner-outbox.spec.ts` | **9 test** |

#### P5d dagi dizayn qarorlari

| Qaror | Sabab |
|---|---|
| Qayta navbatda **`max_attempts` ko'tariladi** | Yetkazuvchi `attempts < max_attempts` ga qaraydi. Chegara oshirilmasa qator birinchi xatodayoq yana `permanently_failed` bo'lardi — tugma ishlagandek ko'rinib, aslida hech nima o'zgarmasdi |
| Qayta navbatdan keyin **darhol** urinib ko'riladi | Scheduler tick'ini kutish operatorga "ishladimi?" degan noaniqlik qoldirardi |
| Qisman unique indeks urilsa — **xato emas** | Ayni (hamkor, buyurtma, status) uchun yangi urinish allaqachon navbatda. Javob `skipped: "already_queued"` |
| `webhooks` marshruti `:id` dan **OLDIN** | Aks holda `/admin/partners/webhooks` "webhooks" nomli hamkor id'si deb o'qilardi |
| Xulosa **bitta guruhlangan so'rov** | Hamkor sonicha so'rov N+1 bo'lardi |
| Kalit **modal yopilgach yo'qoladi** | Bazada faqat sha256 hash bor — kalitni qayta ko'rsatib bo'lmaydi, shu bois ogohlantirish ham ochiq yozilgan |

---

### Qolgan tekshiruv (unit test qamramaydi)

Qisman indeksning haqiqiy xulqi **DB darajasida** tekshiriladi — migratsiya ishga
tushgandan keyin, pilot qabul mezoni **№6** (`sotildi → rollback → yana sotildi`) orqali.
To'liq rollback oqimi (tranzaksiya + commit) ham mezon **№5** bilan qo'lda tasdiqlanadi.

---

## 8. Xavflar

| # | Xavf | Ehtimol | Ta'sir | Yumshatish |
|---|---|---|---|---|
| R1 | **Pilot hududidan tashqari buyurtma Elchi'ga ketib qoladi** | O'rta | Yuqori | Darvoza + hammasi-yoki-hech-biri qoidasi + bo'sh ro'yxat = hammasi bloklangan |
| R2 | Elchi kuryerlari pilot hududini bilmaydi / qamrovi yo'q | **Yuqori** | Yuqori | P0 da **Elchi bilan hudud kelishuvi** — texnik ish emas, tashkiliy |
| R3 | Summalar mos kelmaydi | O'rta | **Kritik** | §5 №12 majburiy mezon; panel har kuni tekshiriladi |
| R4 | Yo'qolgan webhook buyurtmani osib qo'yadi | O'rta | Yuqori | Rekonsiliatsiya CRON (P5) — **ixtiyoriy emas** |
| R5 | Kassa Elchi'dagi pulni erta ko'rsatadi | **Yuqori** | O'rta | Panel ochiq ko'rsatadi; pilot kichik hajmda; uzoq muddatda qarz daftariga o'tiladi |
| R6 | Elchi'da qaytgan pochta jismonan qayerga boradi | O'rta | O'rta | **P0 da hal qilinadi** (Q4) — skaner oqimi shunga bog'liq |
| R7 | Pilot kodi kelajakdagi platformaga to'sqinlik qiladi | Past | O'rta | §6 dagi uchta qoida |

---

## 9. P0 da hal qilinishi kerak

| # | Savol | Tavsiya |
|---|---|---|
| **Q1** | Elchi'da "BeePost" uchun **bitta** market akkaunti ochiladimi? | **Ha** — `external_seller_id='beepost'`; pul avtoriteti PCS'da qoladi |
| **Q2** | **Qaysi hudud** pilot uchun tanlanadi? | Elchi kuryerlari **haqiqatan ishlaydigan** hudud; buyurtma oqimi kunlik 10–30 atrofida |
| **Q3** | Elchi tarifi PCS'da qanday xarajat? | Virtual kuryer tarifi (`tariff_home`/`tariff_center`) — LDG bilan bir xil |
| **Q4** | Elchi bekor qilgan pochta **jismonan qayerga** qaytadi? | Skaner oqimi (`CLOSED`) shunga bog'liq — kelishilishi shart |
| **Q5** | Pilot **qancha davom etadi** va muvaffaqiyat mezoni nima? | Tavsiya: 2 hafta yoki 200 buyurtma; mezon = §5 dagi 12 ssenariy |
| **Q6** | Pilot davrida mijozga qaysi tizim ko'rinadi? | PCS — mijoz uchun hech narsa o'zgarmaydi |

---

## Havolalar

- Elchi nuqsonlari, status lug'ati, ishonchlilik: [`05-elchi.md`](05-elchi.md)
- Platforma strategiyasi (uzoq muddat): [`06-platforma.md`](06-platforma.md)
- **Tayyor namuna:** `Elchi-Marketplace/apps/elchi-integration/src/elchi-api.client.ts`
- Elchi Partner API: `Elchi-Backend/docs/PARTNER_API.md` (eskirgan — kodga solishtiring)
- Tuman-routing olib tashlanishi: memory `ldg-district-gate`
- PCS cargo qolipi: `server/src/api/ldg-cargo/README.md`
