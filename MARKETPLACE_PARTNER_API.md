# BeePost ↔ Marketplace Integratsiya Kontrakti

> **v1.0-draft** · Sana: 2026-09-15
> Bu hujjat **marketplace dasturchilari** uchun. Unda: siz qanday API chiqarishingiz,
> bizdan nima qabul qilishingiz va pulni qanday hisoblashingiz yozilgan.
>
> ⚠️ Bu **SPEC rejimi**: kontraktni BeePost belgilaydi, marketplace uni bajaradi.
> Shuning uchun maydon nomlari, status nomlari va summa birliklari **aynan** shu yerdagidek
> bo'lishi shart — moslashtirish qatlami yo'q.

---

## 0. Kelishilgan shartlar (2026-09-15)

Bu shartlar kontraktni **yakunlaydi**. Quyidagi barcha bo'limlar shularga muvofiq yozilgan.

### Yo'nalish

| # | Shart | Siz uchun ma'nosi |
|---|---|---|
| 1 | **Siz bizga so'rov YUBORMAYSIZ** | Kiruvchi webhook yo'q. Siz faqat **o'qiy olasiz** (§5). Hamma yozuv BeePost'dan sizga boradi |
| 2 | **Qabuldan keyin bekor qilish faqat BeePost'da** | Posilka bizning qo'limizda — bekor qilishni bizning operator yoki kuryer hal qiladi |
| 3 | **Manifest yo'q** | Qopni oldindan e'lon qilmaysiz. Har posilka **skan paytida** `parcels/lookup` orqali topiladi — shu bois bu endpoint **ishonchli bo'lishi shart** (§4.2) |
| 4 | **Yorliq — sizniki** | Sizning QR'ingiz BeePost zanjirining hammasida ishlaydi. Biz qo'shimcha yorliq chop etmaymiz |

### Posilka va buyurtma

| # | Shart | Siz uchun ma'nosi |
|---|---|---|
| 5 | **Ko'p qutili buyurtma** | `external_parcel_id` ≠ `external_order_id`. Har quti alohida QR + `parcel_index/parcel_count`. **Pul faqat buyurtma darajasida bir marta** |
| 6 | **Qisman sotuv = bitta o'zgartirilgan buyurtma** | Ikkinchi buyurtma yaratmaysiz. `PARTLY_DELIVERED` + `delivered_amount`/`returned_amount` |
| 7 | **`items[]` majburiy** | Qisman sotuvda qaysi mahsulot yetkazilgani shundan hisoblanadi |
| 8 | **Rollback MAJBURIY** | Sotilgan buyurtma ortga qaytarilsa siz ham qaytarasiz (§6.3) |
| 9 | **Hudud cheklovi yo'q** | Butun O'zbekiston bo'ylab yetkazamiz |

### Pul

| # | Shart | Siz uchun ma'nosi |
|---|---|---|
| 10 | **BeePost haqqi — kelishilgan qat'iy tarif** | `beepost_fee` **qabulda muzlatiladi**. Barcha sotuvchilar uchun bir xil. Siz o'z sotuvchilaringizga **xohlagan narxni** qo'yasiz — bizga ko'rinmaydi (§7.1) |
| 10a | **Hamkorlik komissiyasi bu kontraktdan TASHQARIDA** | Agar tomonlar o'zaro komissiya kelishgan bo'lsa, u **alohida to'lov** sifatida hal qilinadi. Bu API'da unga tegishli maydon **yo'q** — `beepost_fee` har doim kelishilgan **to'liq** tarif |
| 11 | **Bekorda yetkazish haqqi OLINMAYDI** | Sotilmagan buyurtma uchun tarif yo'q. **Faqat ortiqcha xarajat** hisobga olinadi (§7.4) |
| 12 | **Ortiqcha xarajatni marketplace ko'taradi** | Kuryer mijoz yonigacha borib rad javobini olsa — sarflangan pul `extra_cost` sifatida hisobingizdan yechiladi. `seller_id` bilan birga keladi |
| 13 | **Qaytarish BEPUL** | Bekor qilingan posilkani sizga qaytarish uchun alohida pul olinmaydi |
| 14 | **Oldindan to'langan (prepaid) buyurtma bo'ladi** | `cod_amount` kam yoki `0` bo'lishi mumkin. **Tarif baribir hisoblanadi** → `net_to_marketplace` **MANFIY** bo'ladi (§7.5). Bu sizning hisobingizdan yechiladi va **qaysi sotuvchi** ekani ko'rsatiladi |
| 15 | **`seller_id` — attributsiya uchun, balans uchun emas** | Biz **bizning tarifimizdagi** summani beramiz; sotuvchiga qancha to'lashni siz hisoblaysiz |
| 16 | **Daftar solishtiruvi — faqat BITTA son** | «BeePost marketplace'ga qancha qarzdor». Sizning sotuvchi balanslaringiz hech qachon bizniki bilan teng bo'lmaydi va bu **to'g'ri** (§7.1) |
| 17 | **Kassaga o'zaro dostup yo'q** | `GET /ledger` orqali **faqat o'z hisobingizni** ko'rasiz |

### Tizimga KIRITILMAYDIGAN holatlar

| Holat | Qanday hal qilinadi |
|---|---|
| Posilka yo'qoldi yoki buzildi | **Tizimda alohida mexanizm yo'q.** Yo bekor qilingan deb topshiriladi, yo BeePost bilan alohida kelishilib qoplanadi. Qoplash pul harakati bo'lsa — u umumiy `ledger.entry` (korreksiya) sifatida sizga ko'rinadi |

---

## 1. Umumiy manzara

```
┌─────────────────────────────┐                      ┌─────────────────────────────┐
│        MARKETPLACE          │                      │         BEEPOST (PCS)       │
│   (ko'p sotuvchi ichida)    │                      │   yetkazish + pul avtoriteti│
│                             │                      │                             │
│  1. Posilka yaratadi        │                      │                             │
│  2. Jismonan BeePost'ga     │                      │                             │
│     olib keladi ───────────────── qop ───────────▶ │  3. Operator QR skanerlaydi │
│                             │ ◀─── lookup ──────── │                             │
│  4. Posilka ma'lumoti ──────────────────────────▶  │                             │
│                             │ ◀─── accept ──────── │  5. "Qabul qilish"          │
│  6. ACCEPTED_BY_BEEPOST     │                      │                             │
│                             │ ◀─── events ──────── │  7. Yetkazish · sotuv ·     │
│  8. Status + PUL daftari    │                      │     bekor · rollback        │
│     yangilanadi             │ ◀─── ledger ──────── │  9. Kassa o'zgarishlari     │
│                             │ ◀─── settlement ──── │ 10. BeePost pul to'ladi     │
│ 11. Sotuvchilarga taqsimlaydi│                     │                             │
│                             │ ──── GET (o'qish) ──▶ │ 12. Holat va daftarni       │
│                             │ ◀────────────────────  │     istalgan vaqtda o'qiysiz│
└─────────────────────────────┘                      └─────────────────────────────┘
```

### Rollarning aniq taqsimoti

| Nima | Kim haqiqat manbai |
|---|---|
| Posilka mavjudligi, mijoz ma'lumoti, sotuvchi kimligi | **Marketplace** |
| Qabuldan keyingi yetkazish holati (yo'lda/sotildi/bekor) | **BeePost** |
| **Pul** — qancha yig'ildi, qancha xarajat, qancha qarzdormiz | **BeePost** |
| Sotuvchiga qancha to'lash va qachon to'lash | **Marketplace** (bizning ma'lumot asosida) |

> **Muhim qoida:** marketplace bizning tizimimizga **hech narsa yoza olmaydi**.
> Qabuldan keyin posilkaning holati ham, puli ham faqat BeePost tomonidan o'zgaradi.
> Siz `GET` endpointlari orqali istalgan vaqtda **o'qiy olasiz** (§5), lekin yoza olmaysiz.
> O'zgarish kerak bo'lsa — BeePost operatoriga murojaat qilinadi.

---

## 2. Atamalar

| Atama | Ma'nosi |
|---|---|
| **order** (buyurtma) | Mijozning bitta xaridi. Bitta sotuvchiga tegishli |
| **parcel** (posilka) | Jismoniy quti/paket. **Bitta buyurtma bir nechta posilkadan iborat bo'lishi mumkin** |
| **seller** (sotuvchi) | Marketplace ichidagi sotuvchi. Har buyurtma aniq bitta sotuvchiniki |
| **COD** | Mijozdan yetkazishda olinadigan naqd summa |
| **event** (hodisa) | BeePost'dan sizga keladigan bitta o'zgarish xabari |
| **seq** | Posilka bo'yicha monoton o'suvchi hodisa raqami |
| **ledger** (daftar) | BeePost sizga qancha qarzdorligi yozilgan hisob |

### Pul birligi

- Valyuta: **UZS (so'm)**
- Barcha summalar — **butun son** (integer). Tiyin yo'q, kasr yo'q.
- `200000` = ikki yuz ming so'm. Hech qachon `200000.00` yoki `"200 000"` emas.

---

## 3. Autentifikatsiya

Ikkala yo'nalishda ham bir xil sxema: **API kalit + HMAC imzo**.

### 3.1 Sarlavhalar

| Yo'nalish | Sarlavhalar | Nega shunday |
|---|---|---|
| **BeePost → siz** (yozuv) | `X-Api-Key: <siz bergan kalit>`<br>`X-BeePost-Signature: t=<unix_sec>,v1=<hex>`<br>`X-Request-Id: <uuid>` | Biz sizning tizimingizga **yozamiz** — imzo majburiy |
| **Siz → BeePost** (faqat o'qish) | `X-Api-Key: <biz bergan kalit>` | Siz faqat **o'qiysiz** — imzo talab qilinmaydi. HTTPS + kalit yetarli |

⚠️ Imzo tekshirish mantig'i **faqat sizning tomonda** kerak (§3.3). Bizga yuboradigan
`GET` so'rovlaringizda imzo shart emas.

### 3.2 Imzo qanday hisoblanadi

```
base_string = "{t}.{raw_body}"          // t = unix seconds, raw_body = TANANING XOM BAYTLARI
signature   = HMAC_SHA256(secret, base_string)   // natija: kichik harfli hex
header      = "t={t},v1={signature}"
```

⚠️ **Eng ko'p uchraydigan xato:** JSON'ni parse qilib, keyin qayta `stringify` qilib imzolash.
Imzo **xom tanadan** hisoblanishi shart — bitta probel farq qilsa imzo mos kelmaydi.
Express'da: `express.raw({type:'application/json'})` — `express.json()`dan **oldin**.

### 3.3 Tekshirish qoidalari (majburiy)

1. `t` hozirgi vaqtdan **300 soniyadan** ko'p farq qilsa — **rad eting** (`401`).
2. Imzoni **doimiy vaqtli** taqqoslash bilan solishtiring (`crypto.timingSafeEqual`).
3. `X-Api-Key` mos kelmasa — **rad eting** (`401`).
4. IP ro'yxati bo'lsa — tekshiring.

### 3.4 Sekret aylantirish (majburiy)

Ikki kalit bir vaqtda faol bo'la oladi:

```
X-BeePost-Signature: t=1789480740,v1=<yangi kalit bilan>,v2=<eski kalit bilan>
```

Aylantirish tartibi: yangi kalit qo'shiladi → ikki kalit 24 soat birga ishlaydi →
eski o'chiriladi. **Uzilish bo'lmaydi.**

#### 🔴 Tekshirish qoidasi — bu joyda xato qilish oson

> **O'zingizdagi HAR BIR kalitni HAR BIR imzo maydoniga (`v1` VA `v2`) qarshi
> tekshiring.** Maydon nomini kalit bilan bog'lamang.

```js
// ❌ NOTO'G'RI — pozitsion bog'lash
if (hmac(mening_kalitim, base) === parts.v1) ok();

// ✅ TO'G'RI — har kalit har maydonga
for (const key of [mening_kalitim, mening_eski_kalitim]) {
  for (const field of ['v1', 'v2']) {
    if (parts[field] && timingSafeEqual(hmac(key, base), parts[field])) ok();
  }
}
```

**Nega:** aylantirishning butun maqsadi — tomonlar **bir vaqtda** kalit
almashtirmasligi. Biz yangi kalitga o'tib, uni `v1` ga qo'yamiz; siz hali
eski kalitdasiz. Pozitsion tekshiruvda siz eski kalitni `v1` ga qarshi
solishtirib **rad etasiz** — va aylantirish har safar uzilish beradi.

Narxi: ko'pi bilan 2 kalit × 2 maydon = 4 ta HMAC. E'tiborsiz.

> ℹ️ Bu qoida BeePost tomonida lokal e2e sinovda topildi: dastlabki
> implementatsiya aynan pozitsion edi va aylantirish ssenariysi yiqildi.
> Sizda ham shu xato bo'lishi ehtimoli yuqori — mock server (§11) buni
> tekshiradi.

### 3.5 Namuna (Node.js)

```js
const crypto = require('crypto');

function sign(secret, rawBody) {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret)
                    .update(`${t}.${rawBody}`)
                    .digest('hex');
  return `t=${t},v1=${sig}`;
}

function verify(secret, header, rawBody, toleranceSec = 300) {
  const parts = Object.fromEntries(
    header.split(',').map(kv => kv.split('=').map(s => s.trim()))
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const expected = crypto.createHmac('sha256', secret)
                         .update(`${t}.${rawBody}`)
                         .digest('hex');
  const given = Buffer.from(parts.v1 || '', 'hex');
  const want  = Buffer.from(expected, 'hex');
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}
```

---

## 4. SIZ QURADIGAN ENDPOINTLAR

Barchasi: **HTTPS**, **JSON**, **UTF-8**. Bazaviy manzil: `{api_base_url}`.
BeePost timeout: **15 soniya**. p95 javob vaqti: **800 ms dan kam**.

---

### 4.1 `GET /bp/v1/ping` — salomatlik

Autentifikatsiya: `X-Api-Key` (imzo shart emas).

**Javob 200:**
```json
{ "ok": true, "version": "1.0.0", "server_time": 1789480740 }
```

Biz buni admin panelidagi «Ulanishni tekshirish» tugmasida ishlatamiz.

---

### 4.2 `POST /bp/v1/parcels/lookup` — QR bo'yicha posilka topish

> Bu **har skanerda** chaqiriladi. **Yon ta'siri bo'lmasligi shart** — bu o'qish amali.
> Statusni o'zgartirmang, band qilmang, hisoblagichni oshirmang.

**So'rov:**
```json
{ "qr_token": "UZM-8842-1", "scanned_at": 1789480740752, "operator_ref": "uuid" }
```

**Javob 200 — topildi:**
```json
{
  "parcel": {
    "external_parcel_id": "PCL-8842-1",
    "external_order_id":  "ORD-8842",
    "qr_token":           "UZM-8842-1",
    "parcel_index":       1,
    "parcel_count":       3,
    "status":             "READY_FOR_PICKUP",
    "created_at":         1789400000000
  },
  "seller": {
    "seller_id":   "SLR-77",
    "seller_name": "Rustam Savdo MChJ",
    "seller_phone": "+998901112233"
  },
  "customer": {
    "full_name":        "Aliyev Vali",
    "phone":            "+998901234567",
    "additional_phone": "+998991112233",
    "region_sato":      "1727",
    "district_sato":    "1727401",
    "address":          "Toshkent sh., Yunusobod t., 4-mavze, 15-uy",
    "comment":          "Eshik oldiga qo'ying"
  },
  "money": {
    "currency":         "UZS",
    "product_amount":   180000,
    "delivery_amount":  20000,
    "cod_amount":       200000,
    "prepaid":          false
  },
  "items": [
    { "sku": "SKU-1", "name": "Futbolka", "quantity": 2, "unit_price": 65000 },
    { "sku": "SKU-2", "name": "Shapka",   "quantity": 1, "unit_price": 50000 }
  ],
  "where_deliver": "center"
}
```

**Javob 404 — topilmadi:**
```json
{ "error": { "code": "PARCEL_NOT_FOUND", "message": "Posilka topilmadi" } }
```

#### Maydonlar jadvali

| Maydon | Tur | Majburiy | Izoh |
|---|---|:---:|---|
| `parcel.external_parcel_id` | string | ✅ | **Posilka** ID si. Ko'p qutili buyurtmada har qutiga alohida |
| `parcel.external_order_id` | string | ✅ | **Buyurtma** ID si. Ko'p qutida bir xil bo'ladi |
| `parcel.qr_token` | string | ✅ | Yorliqdagi qiymat. `[A-Za-z0-9_-]`, 6–64 belgi |
| `parcel.parcel_index` / `parcel_count` | int | ✅ | `1/1` — bitta quti. `2/3` — uchtadan ikkinchisi |
| `parcel.status` | enum | ✅ | §6.1 dagi ro'yxatdan |
| `seller.seller_id` | string | ✅ | **Eng muhim maydon.** Pul shu bo'yicha ajratiladi |
| `seller.seller_name` | string | ✅ | Ko'rsatish uchun |
| `customer.phone` | string | ✅ | `+998XXXXXXXXX` formatida. **Bo'sh bo'lmasin** |
| `customer.district_sato` | string | ✅ | O'zbekiston SOATO tuman kodi. Mos kelmasa posilka **qabul qilinmaydi** |
| `money.product_amount` | int | ✅ | Mahsulotlar summasi |
| `money.delivery_amount` | int | ✅ | Yetkazish narxi (mijozdan). Yo'q bo'lsa `0` |
| `money.cod_amount` | int | ✅ | Mijozdan olinadigan summa. `0` = oldindan to'langan |
| `money.prepaid` | bool | ✅ | `true` bo'lsa kuryer pul olmaydi. **Tarif baribir hisoblanadi** (§7.5) |
| `items[]` | array | ✅ | **Majburiy.** Qisman sotuvda qaysi mahsulot yetkazilgani/qaytgani shundan hisoblanadi |
| `where_deliver` | enum | 🟡 | `center` \| `address` (default: `center`) |

> ⚠️ **Tiplar qat'iy.** `phone` — **string**, son emas. `product_amount` — **son**, satr emas.
> Noto'g'ri tip butun qopni rad ettiradi.

---

### 4.3 `POST /bp/v1/parcels/accept` — qabulni tasdiqlash

Operator «Qabul qilish» bosganda chaqiriladi. **Idempotent bo'lishi shart.**

**So'rov:**
```json
{
  "batch_id":    "uuid",
  "accepted_at": 1789480999000,
  "branch":      { "region_sato": "1727", "name": "Toshkent-3" },
  "items": [
    { "external_parcel_id": "PCL-8842-1", "beepost_order_id": "uuid", "beepost_order_number": 100042 },
    { "external_parcel_id": "PCL-8843-1", "beepost_order_id": "uuid", "beepost_order_number": 100043 }
  ],
  "rejected": [
    { "external_parcel_id": "PCL-8844-1", "reason": "DAMAGED", "note": "Quti ezilgan" }
  ]
}
```

**Javob 200:**
```json
{
  "accepted": ["PCL-8842-1", "PCL-8843-1"],
  "rejected": ["PCL-8844-1"],
  "errors":   []
}
```

**Idempotentlik:** ayni `batch_id` qayta kelsa — **ayni javobni qaytaring**, holatni
qayta o'zgartirmang. Ayni posilka boshqa `batch_id` bilan kelsa va allaqachon qabul
qilingan bo'lsa — `errors` ga qo'shing, xato qaytarmang:
```json
{ "errors": [{ "external_parcel_id": "PCL-8842-1", "code": "ALREADY_ACCEPTED" }] }
```

**Sizda nima bo'lishi kerak:** `READY_FOR_PICKUP` → `ACCEPTED_BY_BEEPOST`.
Shu daqiqadan boshlab posilka **BeePost javobgarligida**.

**Rad etish sabablari (`reason`):** `DAMAGED` · `NOT_OURS` · `OUT_OF_COVERAGE` ·
`MISSING_DATA` · `DUPLICATE` · `OTHER`.

---

### 4.4 `POST /bp/v1/events` — hodisalar oqimi ⭐

> **Eng muhim endpoint.** Barcha status va pul o'zgarishlari **shu yerga** keladi.

**So'rov — yagona konvert:**
```json
{
  "event_id":    "3f7a91c2-...-uuid",
  "seq":         145,
  "event_type":  "parcel.delivered",
  "occurred_at": 1789480740752,
  "sent_at":     1789480741900,
  "integration": "uzum",
  "parcel": {
    "external_parcel_id":   "PCL-8842-1",
    "external_order_id":    "ORD-8842",
    "seller_id":            "SLR-77",
    "beepost_order_id":     "uuid",
    "beepost_order_number": 100042
  },
  "status": { "from": "OUT_FOR_DELIVERY", "to": "DELIVERED" },
  "money": {
    "currency":                "UZS",
    "product_amount":          180000,
    "delivery_amount":         20000,
    "collected_from_customer": 200000,
    "beepost_fee":             50000,
    "beepost_fee_basis":       "center",
    "tariff_version":          3,
    "extra_cost":              5000,
    "net_to_marketplace":      145000
  },
  "ledger": { "entry_id": "uuid", "balance_after": 42350000 },
  "actor":  { "type": "courier", "name": "Jasur T." },
  "note":   "Mijoz qabul qildi"
}
```

**Javob 200 — qabul qilindi:**
```json
{ "ok": true, "receipt_id": "sizning-ichki-id", "applied": true }
```

**Javob 200 — dublikat (allaqachon qayta ishlangan):**
```json
{ "ok": true, "receipt_id": "...", "applied": false, "reason": "DUPLICATE" }
```

**Javob 200 — eskirgan (seq past):**
```json
{ "ok": true, "applied": false, "reason": "STALE_SEQ", "current_seq": 147 }
```

#### 🔴 Uchta majburiy qoida

| # | Qoida | Nima uchun |
|---|---|---|
| 1 | **`event_id` bo'yicha dedup.** Ayni `event_id` ikkinchi marta kelsa — **hech narsa qilmang**, `applied: false` qaytaring | Tarmoq uzilsa biz qayta yuboramiz. Dedup bo'lmasa **sotuvchiga ikki marta pul yozasiz** |
| 2 | **`seq` bo'yicha tartib.** Har posilka uchun oxirgi `seq`ni saqlang. Kelgan `seq` ≤ saqlangandan bo'lsa — **qo'llamang** | Qayta urinishlar tartibni buzadi: eskirgan `delivered` yangi `rolled_back`dan **keyin** kelishi mumkin |
| 3 | **Har doim `200` qaytaring** (biznes rad etishida ham, tanada `applied:false` bilan). `4xx`/`5xx` faqat haqiqiy xatoda | `5xx` bizni qayta urintiradi; `4xx` hodisani **butunlay tashlatadi** |

**Kafolat (halol):** hodisalar **kamida bir marta** yuboriladi va **yo'qolishi ham mumkin**.
Shuning uchun §4.5 (solishtiruv) **majburiy**.

---

### 4.5 `GET /bp/v1/parcels/status` — solishtiruv ⭐

> **Majburiy.** Yo'qolgan hodisalarni topish uchun BeePost buni **har 15 daqiqada** chaqiradi.

**Variant A — ID ro'yxati bo'yicha:**
```
GET /bp/v1/parcels/status?ids=PCL-8842-1,PCL-8843-1,PCL-8844-1
```

**Variant B — vaqt bo'yicha (sahifalash bilan):**
```
GET /bp/v1/parcels/status?updated_since=1789480000000&limit=200&cursor=<opaque>
```

**Javob 200:**
```json
{
  "items": [
    {
      "external_parcel_id": "PCL-8842-1",
      "status":             "DELIVERED",
      "status_at":          1789480740752,
      "last_applied_seq":   145,
      "money": { "collected_from_customer": 200000, "net_to_marketplace": 145000 }
    }
  ],
  "next_cursor": null
}
```

`last_applied_seq` — **nima uchun kerak:** biz sizning `seq`ingizni o'zimiznikiga
solishtiramiz. Farq bo'lsa yo'qolgan hodisalarni **avtomatik qayta yuboramiz**.

---

### 4.6 `GET /bp/v1/sellers` — sotuvchilar reestri

```
GET /bp/v1/sellers?updated_since=1789400000000&limit=200&cursor=
```

```json
{
  "items": [
    { "seller_id": "SLR-77", "name": "Rustam Savdo MChJ", "phone": "+998901112233",
      "is_active": true, "updated_at": 1789400000000 }
  ],
  "next_cursor": null
}
```

Biz buni kuniga bir marta so'raymiz va nomlarni ko'zgu qilamiz. Sotuvchi bizga
noma'lum bo'lsa — posilka baribir qabul qilinadi, lekin **«noma'lum sotuvchi»**
deb belgilanadi va panelda ko'rinadi.

---

### 4.7 `GET /bp/v1/ledger/balance` — sizning daftar ko'rinishingiz

```
GET /bp/v1/ledger/balance?seller_id=SLR-77
GET /bp/v1/ledger/balance                      // umumiy
```

```json
{
  "currency": "UZS",
  "total_receivable": 42350000,
  "as_of": 1789480740752,
  "sellers": [
    { "seller_id": "SLR-77", "receivable": 5120000, "last_entry_id": "uuid" }
  ]
}
```

`total_receivable` — **BeePost sizga qancha qarzdor** (sizning hisobingizcha).
Biz buni kunlik solishtiramiz. Farq chiqsa — ikkala tomonga ogohlantirish.

---

## 5. BIZ BERADIGAN ENDPOINTLAR — faqat O'QISH

Bazaviy manzil: `https://<beepost-domain>/api/v1/marketplace/{slug}`
Autentifikatsiya: `X-Api-Key` (imzo shart emas).

`{slug}` — BeePost sizga beradigan ulanish nomi (masalan `uzum`). U URL'da
turadi, chunki kalitlar bazada shifrlangan saqlanadi va faqat kalit bo'yicha
qidirib bo'lmaydi.

> 🔴 **Yozuv endpointi yo'q.** Siz bizning tizimga posilka qo'sha olmaysiz, statusni
> o'zgartira olmaysiz, bekor qila olmaysiz. Bu **ataylab** shunday: posilka BeePost
> qo'lida bo'lganda uning holati uchun faqat bitta tomon javobgar bo'lishi kerak.

---

### 5.1 `GET /{slug}/parcels/{external_parcel_id}` — bizdagi holat

```json
{
  "external_parcel_id":   "PCL-8842-1",
  "external_order_id":    "ORD-8842",
  "seller_id":            "SLR-77",
  "beepost_order_number": 100042,
  "status":               "DELIVERED",
  "status_at":            1789480740752,
  "last_sent_seq":        145,
  "money": {
    "currency":                "UZS",
    "collected_from_customer": 200000,
    "beepost_fee":             50000,
    "beepost_fee_basis":       "center",
    "tariff_version":          3,
    "extra_cost":              5000,
    "net_to_marketplace":      145000
  }
}
```

Bir nechta posilkani birdan so'rash:
⚠️ Bir nechta posilkani birdan so'rash v1 da YO'Q — bittalab so'rang yoki
§4.5 dagi o'z solishtiruv endpointingizdan foydalaning.

---

### 5.2 `GET /{slug}/ledger` — bizdagi daftar

```
GET /uzum/ledger                                  // umumiy balans + oxirgi yozuvlar
GET /uzum/ledger?seller_id=SLR-77                 // bitta sotuvchi bo'yicha
GET /uzum/ledger?from=1789400000000&to=1789500000000&limit=200&cursor=
```

```json
{
  "currency": "UZS",
  "balance":  42350000,
  "as_of":    1789480999000,
  "entries": [
    {
      "entry_id":           "uuid",
      "seq":                145,
      "seller_id":          "SLR-77",
      "external_parcel_id": "PCL-8842-1",
      "type":               "sale",
      "amount":             145000,
      "balance_after":      42350000,
      "created_at":         1789480740752
    },
    {
      "entry_id":           "uuid",
      "seq":                146,
      "seller_id":          "SLR-81",
      "external_parcel_id": "PCL-9001-1",
      "type":               "sale",
      "amount":             -50000,
      "balance_after":      42300000,
      "created_at":         1789480800000,
      "note":               "prepaid — yetkazish haqqi hisobdan yechildi"
    }
  ],
  "next_cursor": null
}
```

| `type` | Ma'nosi | Ishora |
|---|---|:---:|
| `sale` | Yetkazildi | `+` yoki **`−`** (prepaid — §7.5) |
| `extra_cost` | Kuryerning qo'shimcha xarajati | `−` |
| `cancel` | Bekor qilindi (ortiqcha xarajat bo'lsa) | `−` yoki `0` |
| `correction` | Rollback yoki tuzatish | `+` / `−` |
| `adjustment` | Qo'lda kiritilgan tuzatish (kelishuv bo'yicha) | `+` / `−` |
| `settlement` | BeePost sizga to'ladi | `−` |

`balance` **manfiy** bo'lishi mumkin — u holda **siz BeePost'ga qarzdorsiz** (§7.5).

---

### 5.3 `GET /{slug}/events?since_seq=` — yo'qolgan hodisani qayta olish

`seq`da uzilish sezsangiz (145 dan keyin 147 keldi) — yetishmaganini shu yerdan oling.

```
GET /uzum/events?external_parcel_id=PCL-8842-1&since_seq=145
GET /uzum/events?since_seq=8840&limit=200
```

⚠️ Faqat **yuborilgan** hodisalar qaytariladi. Navbatda turgan yoki tashlangan
qatorlar ko'rsatilmaydi — aks holda siz ularni «yetib kelgan» deb hisoblab,
keyin haqiqiy yuborishda dublikat sifatida rad etardingiz va hodisa jimgina
yo'qolardi.

Javob — §4.4 dagi konvertlarning massivi:
```json
{ "events": [ { "event_id": "...", "seq": 146, "event_type": "...", ... } ],
  "next_cursor": null }
```

---

## 6. Status modeli

### 6.1 Sizning tomondagi statuslar (biz shularni kutamiz)

| Status | Ma'nosi | Kim qo'yadi |
|---|---|---|
| `CREATED` | Sotuvchi buyurtma yaratdi | Marketplace |
| `READY_FOR_PICKUP` | Qopga solindi, BeePost'ga ketyapti | Marketplace |
| `ACCEPTED_BY_BEEPOST` | BeePost qabul qildi | **BeePost hodisasi** |
| `REJECTED_BY_BEEPOST` | BeePost qabul qilmadi | **BeePost hodisasi** |
| `IN_TRANSIT` | Hududga yo'lda | **BeePost hodisasi** |
| `OUT_FOR_DELIVERY` | Kuryerda | **BeePost hodisasi** |
| `DELIVERED` | Yetkazildi, pul yig'ildi | **BeePost hodisasi** |
| `PARTLY_DELIVERED` | Qisman yetkazildi | **BeePost hodisasi** |
| `CANCELLED` | Bekor qilindi | **BeePost hodisasi** |
| `RETURNING` | Qaytish yo'lida | **BeePost hodisasi** |
| `RETURNED` | Sotuvchiga qaytarildi | **BeePost hodisasi** |
| `VOIDED` | Qabul qilinmasdan bekor qilindi | Marketplace |

### 6.2 O'tishlar

```
CREATED ──▶ READY_FOR_PICKUP ──▶ ACCEPTED_BY_BEEPOST ──▶ IN_TRANSIT ──▶ OUT_FOR_DELIVERY
                    │                      │                                    │
                    │                      └──▶ REJECTED_BY_BEEPOST             ├──▶ DELIVERED
                    └──▶ VOIDED                                                 ├──▶ PARTLY_DELIVERED
                                                                                └──▶ CANCELLED ──▶ RETURNING ──▶ RETURNED

⟲ ROLLBACK:  DELIVERED | PARTLY_DELIVERED | CANCELLED  ──▶  OUT_FOR_DELIVERY
             (pul BeePost tomonida qaytariladi; siz ham qaytarasiz)
```

### 6.3 🔴 Rollback — majburiy qo'llab-quvvatlash

Operator xato qilsa (masalan noto'g'ri buyurtmani «sotildi» qilsa), BeePost uni **ortga
qaytaradi**. Siz `parcel.rolled_back` hodisasini olasiz va:

1. Posilka statusini `OUT_FOR_DELIVERY` ga qaytarasiz;
2. Sotuvchi hisobiga yozilgan summani **qaytarib olasiz** (`ledger` teskari yozuv);
3. `applied: true` qaytarasiz.

⚠️ **Agar sotuvchiga allaqachon to'lagan bo'lsangiz** va qaytarib ololmasangiz —
`applied: false` + `"reason": "ROLLBACK_REFUSED"` qaytaring. Bu **xato emas**, lekin
BeePost'da **nomuvofiqlik kartasi** ochiladi va operator qo'lda hal qiladi.
Jimgina `applied: true` qaytarish — **eng yomon variant**: ikki daftar abadiy ajraladi.

---

## 7. Pul modeli

### 7.1 🔴 AVVAL SHUNI O'QING — ikki daraja, ikki daftar

BeePost bilan siz **yetkazish tarifini kelishasiz** (masalan 50 000 markazga,
70 000 uygacha). Siz esa **o'z sotuvchilaringizga xohlagan narxni** qo'yasiz.

**Bu ikki daftar hech qachon teng bo'lmaydi — va bu XATO EMAS.**

```
   MIJOZ
     │  COD = 300 000
     ▼
  BEEPOST      bizning tarif 50 000 yechiladi
     │         ──▶  BeePost sizga 250 000 qarzdor      ◀── BIZ SOLISHTIRADIGAN SON
     ▼
 MARKETPLACE   o'z tarifingiz 65 000 yechiladi
     │         ──▶  siz sotuvchiga 235 000 to'laysiz   ◀── BU SIZNING ISHINGIZ
     ▼
  SOTUVCHI

  Farq 15 000 = SIZNING MARJANGIZ — biz uni bilmaymiz va bilishimiz shart emas
```

| Kim | Formula | Natija |
|---|---|---|
| **BeePost daftari** | `collected_from_customer − beepost_fee − extra_cost` | **250 000** |
| **Sizning daftaringiz** | `collected − sizning tarifingiz − ...` | 235 000 |
| **Marja** | `sizning tarifingiz − beepost_fee` | 15 000 |

Yetkazishni mijoz to'laydimi yoki sotuvchi — **bizga farqi yo'q**:

| Model | COD | BeePost daftari | Sizning daftaringiz | Marja |
|---|---|---|---|---|
| Yetkazishni **sotuvchi** to'laydi | 300 000 | 250 000 | 235 000 | 15 000 |
| Yetkazishni **mijoz** to'laydi (+65 000) | 365 000 | 315 000 | 300 000 | 15 000 |

> ⚠️ **Shuning uchun kontraktda `payable_to_seller` maydoni YO'Q.** Uning o'rnida
> **`net_to_marketplace`** bor — faqat bizning daraja. Sotuvchiga qancha to'lashni
> siz hisoblaysiz; biz `seller_id` va **o'z tarifimizdagi** summani beramiz.

### 7.2 Tarif shartnomasi

| Qoida | Izoh |
|---|---|
| Tarif **`center`** va **`home`** uchun alohida | `beepost_fee_basis` qaysi biri qo'llanganini aytadi |
| `where_deliver` **siz aytasiz** (`lookup` javobida) | Biz shunga qarab tarifni tanlaymiz |
| Tarif **qabul paytida muzlatiladi** | Keyin tarif o'zgarsa ham **bu posilkaga ta'sir qilmaydi** |
| Har tarifning **versiyasi** bor | `tariff_version` har hodisada — «qaysi tarif qo'llandi» bahsi chiqmaydi |
| `where_deliver` o'zgarsa (markaz → uy) | **`parcel.fee_changed`** hodisasi: eski tarif, yangi tarif, sabab |

```json
{
  "event_type": "parcel.fee_changed",
  "money": {
    "beepost_fee_before": 50000, "beepost_fee_basis_before": "center",
    "beepost_fee_after":  70000, "beepost_fee_basis_after":  "home",
    "tariff_version":     3,
    "net_to_marketplace": 125000
  },
  "reason": "Mijoz uyga yetkazishni so'radi"
}
```

> ℹ️ **Hamkorlik komissiyasi bu kontraktda yo'q.** Tomonlar o'zaro komissiya kelishgan
> bo'lsa, u **alohida to'lov** sifatida hal qilinadi. `beepost_fee` har doim kelishilgan
> **to'liq** tarif (masalan 50 000 / 70 000) va daftarga aynan shu son tushadi.

### 7.3 Bitta sotuvda

```
collected_from_customer   — kuryer mijozdan olgan summa
beepost_fee               — kelishilgan tarif (QABULDA muzlatilgan)
extra_cost                — qo'shimcha xarajat (agar bo'lsa)
────────────────────────────────────────────────────────────────
net_to_marketplace = collected_from_customer − beepost_fee − extra_cost
```

Misol:
```
collected_from_customer = 200 000
beepost_fee             =  50 000   (center, tariff_version 3)
extra_cost              =   5 000
────────────────────────────────────
net_to_marketplace      = 145 000   ← BeePost sizga shuncha qarzdor bo'ladi
seller_id               = "SLR-77"  ← qaysi sotuvchining posilkasi
```

### 7.4 Bekor qilinganda — yetkazish haqqi OLINMAYDI

Sotilmagan buyurtma uchun BeePost tarif olmaydi. Faqat kuryerning **haqiqiy xarajati**
hisobga olinadi.

```
collected_from_customer = 0
beepost_fee             = 0          ← yetkazish haqqi YO'Q
extra_cost              = 5 000      ← kuryer mijoz yonigacha borib rad javobini oldi
────────────────────────────────────────────────────────────────
net_to_marketplace      = −5 000     ← faqat shu summa hisobingizdan yechiladi
```

| Holat | `beepost_fee` | `extra_cost` | `net_to_marketplace` |
|---|---:|---:|---:|
| Bekor, kuryer bormagan | 0 | 0 | **0** — hech qanday harakat yo'q |
| Bekor, kuryer borib rad javobini oldi | 0 | 5 000 | **−5 000** |

`extra_cost` cheksiz emas — u **kuryer tarifidan oshmaydi** (BeePost ichida qat'iy chegara).

**Qaytarish bepul:** bekor qilingan posilkani sizga qaytarish uchun alohida pul olinmaydi.
`parcel.returning` va `parcel.returned` hodisalari **pul harakatisiz** keladi.

### 7.5 🔴 Oldindan to'langan (prepaid) posilka — `net_to_marketplace` MANFIY bo'ladi

Bu eng ko'p e'tibor talab qiladigan holat. `cod_amount` kam yoki `0` bo'lsa ham
**yetkazish haqqi baribir hisoblanadi** — chunki ish bajarilgan.

```
Misol A — to'liq prepaid (cod_amount = 0)

collected_from_customer = 0
beepost_fee             = 50 000
────────────────────────────────────────
net_to_marketplace      = −50 000    ← SIZNING hisobingizdan yechiladi
```

```
Misol B — COD tarifdan kam (cod_amount = 30 000)

collected_from_customer = 30 000
beepost_fee             = 50 000
────────────────────────────────────────
net_to_marketplace      = −20 000    ← farq hisobingizdan yechiladi
```

**Har ikkala holatda ham hodisa `seller_id` va `external_parcel_id` bilan keladi** — ya'ni
siz **aynan qaysi sotuvchining qaysi posilkasi** uchun yetkazish haqqi ushlab qolinganini
bilasiz va o'sha sotuvchi hisobidan yechasiz.

```json
{
  "event_type": "parcel.delivered",
  "parcel": { "external_parcel_id": "PCL-9001-1", "seller_id": "SLR-81" },
  "money": {
    "collected_from_customer": 0,
    "prepaid":                 true,
    "beepost_fee":             50000,
    "beepost_fee_basis":       "center",
    "tariff_version":          3,
    "extra_cost":              0,
    "net_to_marketplace":      -50000
  },
  "ledger": { "entry_id": "uuid", "balance_after": 42300000 }
}
```

#### Sizning tizimingizda nima bo'lishi kerak

| # | Talab | Nega |
|---|---|---|
| 1 | `net_to_marketplace` **manfiy bo'lishi mumkin** deb qabul qiling | Aks holda prepaid posilkada daftaringiz noto'g'ri tomonga ketadi |
| 2 | Umumiy `balance` ham **manfiy bo'lishi mumkin** | Ko'p prepaid bo'lsa **siz BeePost'ga qarzdor** bo'lasiz |
| 3 | Manfiy summani **sotuvchi hisobidan** yeching | `seller_id` aynan shuning uchun yuboriladi |
| 4 | Manfiy yozuvni «xato» deb rad etmang | U to'g'ri yozuv; `applied: true` qaytaring |

> ⚠️ **Eng ko'p uchraydigan xato:** `if (amount <= 0) skip` deb yozib qo'yish.
> Shunda prepaid posilkalar daftaringizga umuman tushmaydi va bir oyda
> ikki daftar sezilarli farq qiladi.

### 7.6 Qisman sotuvda

Mijoz uchta mahsulotdan ikkitasini oldi. Sizda **bitta** buyurtma qoladi, holati
`PARTLY_DELIVERED`.

```json
"money": {
  "delivered_amount":        120000,
  "returned_amount":          80000,
  "collected_from_customer": 120000,
  "beepost_fee":              50000,
  "beepost_fee_basis":       "center",
  "tariff_version":               3,
  "extra_cost":                   0,
  "net_to_marketplace":       70000
},
"items_delivered": [ { "sku": "SKU-1", "quantity": 2 } ],
"items_returned":  [ { "sku": "SKU-2", "quantity": 1 } ]
```

`beepost_fee` **to'liq** olinadi — yetkazish bajarilgan. Qaytgan mahsulot uchun
alohida qaytarish haqqi yo'q (§7.4).

### 7.7 Daftar — ikki tomon qanday teng yuradi

Har pul hodisasida `ledger.balance_after` bo'ladi — **BeePost sizga qancha qarzdorligi**
o'sha yozuvdan keyin.

```
Hodisa 143:  sale        +145 000    balance_after = 42 180 000
Hodisa 144:  extra_cost    −5 000    balance_after = 42 175 000
Hodisa 145:  sale        +175 000    balance_after = 42 350 000
Hodisa 146:  settlement −40 000 000  balance_after =  2 350 000   ← BeePost to'ladi
```

**Nega bu kuchli:** 144-hodisa yo'qolsa, 145 kelganda sizning balansingiz 42 355 000,
bizniki 42 350 000 bo'ladi — **darhol ko'rinadi**. Yo'qolganini
`GET /events?since_seq=143` bilan olasiz.

| # | Qatlam | Nimani ushlaydi |
|---|---|---|
| 1 | `balance_after` har yozuvda | Bitta yo'qolgan hodisa — keyingisi o'zi tuzatadi |
| 2 | `seq` uzilishi | Aynan qaysi hodisa yo'qolganini aniqlash |
| 3 | Kunlik `ledger.snapshot` + `GET /ledger/balance` | Ikkalasi ham yiqilsa |
| 4 | `tariff_version` har hodisada | «Qaysi tarif qo'llandi» bahsi |

> 🔴 **Solishtirish faqat `balance_after` bo'yicha.** Sizning **sotuvchi**
> balanslaringizni bizniki bilan solishtirmang — ular boshqa darajadagi son (§7.1).

### 7.8 Hisob-kitob (BeePost sizga pul to'laydi)

`settlement.paid` hodisasi **taqsimot ro'yxati bilan** keladi:

```json
{
  "event_type": "settlement.paid",
  "settlement": {
    "settlement_id": "uuid",
    "amount":        40000000,
    "method":        "bank_transfer",
    "paid_at":       1789480740752,
    "reference":     "TXN-88213",
    "allocation": [
      { "seller_id": "SLR-77", "amount": 5120000 },
      { "seller_id": "SLR-81", "amount": 3400000 }
    ]
  },
  "ledger": { "entry_id": "uuid", "balance_after": 2350000 }
}
```

`allocation` — **bizning tarifimizdagi** taqsimot: har sotuvchining posilkalaridan
yig'ilgan sof summa. Sotuvchiga **haqiqatda qancha to'lashni** siz o'z marjangizni
hisobga olib o'zingiz belgilaysiz.

🔴 **Juda muhim:** sotuvchiga to'lash signali **faqat `settlement.paid`**.
Posilka statusi (`DELIVERED`) pul kelgani degani **emas** — u faqat «yetkazildi va
hisobingizga yozildi» degani.

## 8. Xato taksonomiyasi

### Siz qaytaradigan HTTP kodlar

| Kod | Ma'nosi | BeePost nima qiladi |
|:---:|---|---|
| `200` | Qabul qilindi (biznes rad etishi ham shu, tanada `applied:false`) | Muvaffaqiyat deb yozadi |
| `400` | Payload buzuq | **Qayta urinmaydi** — panelda xato |
| `401` | Imzo/kalit noto'g'ri | **Qayta urinmaydi** — panelda ogohlantirish |
| `404` | Posilka topilmadi | **Qayta urinmaydi** |
| `409` | Konflikt (masalan allaqachon qabul qilingan) | **Qayta urinmaydi** |
| `422` | Ma'lumot to'g'ri, lekin qo'llab bo'lmaydi | **Qayta urinmaydi** |
| `429` | Limit oshdi | `Retry-After` ni **hurmat qiladi** |
| `5xx` | Sizning server xatosi | **Qayta urinadi** (8 marta, ~4 soat) |
| timeout | 15s ichida javob yo'q | **Qayta urinadi** |

> Qoida: **`4xx` = «qayta urinma»**. Agar vaqtinchalik muammo bo'lsa — `5xx` yoki `429`
> qaytaring, `400` emas.

### Xato tanasi formati

```json
{ "error": { "code": "PARCEL_NOT_FOUND", "message": "Posilka topilmadi",
             "details": { "qr_token": "UZM-8842-1" } } }
```

---

## 9. Qayta urinish siyosati (BeePost → siz)

| Urinish | Kutish |
|:---:|---|
| 1 | darhol |
| 2 | 1 daqiqa |
| 3 | 5 daqiqa |
| 4 | 15 daqiqa |
| 5 | 30 daqiqa |
| 6 | 1 soat |
| 7 | 2 soat |
| 8 | 4 soat |
| — | so'ng `failed` + panelda ogohlantirish + solishtiruv CRON tiklaydi |

Deploy yoki texnik ishlar **4 soatdan uzoq** bo'lsa — solishtiruv endpointi (§4.5)
yo'qolganlarni tiklaydi.

---

## 10. Limitlar

| Nima | Qiymat |
|---|---|
| Timeout | 15 soniya |
| Maksimal tana | 5 MB |
| `POST /events` — bizning tezlik | ≤ 20 so'rov/soniya (bulk sotuvda cho'qqi) |
| `POST /parcels/lookup` — cho'qqi | ≤ 10 so'rov/soniya (operator skanerlaganda) |
| Sizning limitingiz | `429` + `Retry-After` bilan aytng — **hurmat qilamiz** |
| Sahifalash | `limit` ≤ 200, `cursor` — opaque satr |

---

## 11. Sandbox va sinov

🔴 **Majburiy:** alohida sandbox muhiti — **alohida kalitlar, alohida ma'lumot**.
Birinchi sinov hech qachon prod'da bo'lmasin.

| Nima kerak | Izoh |
|---|---|
| `sandbox_api_base_url` | Prod'dan butunlay ajratilgan |
| Sandbox API kaliti + HMAC sekreti | Prod kalitidan boshqa |
| `webhook.test` turini qo'llab-quvvatlash | **Imzo tekshirilgandan KEYIN** ishlanishi shart |
| Test posilkalari | Kamida 20 ta, turli holatlar bilan |

### 🧪 Ishlaydigan namuna — BeePost mock serveri

BeePost sizning tomoningizni **taqlid qiluvchi mock server** yozdi. U ochiq va
bog'liqliksiz (faqat Node):

```
server/scripts/local/marketplace-mock/
```

| Nima beradi |
|---|
| Kontraktning **ishlaydigan namunasi** — imzo tekshiruvi, `event_id` dedup, `seq` tartibi, `batch_id` idempotentligi, manfiy `net` — hammasi izoh bilan yozilgan |
| O'z implementatsiyangizni unga qarab **solishtirishingiz** mumkin |
| 11 ta sinov posilkasi: ko'p qutili, prepaid, COD<tarif, VOIDED, aralash registrli QR, noma'lum sotuvchi |

Uni o'z tilingizga ko'chirishingiz yoki mantiqni namuna sifatida olishingiz mumkin.

### Ishga tushirishdan oldingi tekshiruv ro'yxati

| # | Test | Kutilgan natija |
|:---:|---|---|
| 1 | `GET /ping` | 200, versiya bilan |
| 2 | Noto'g'ri imzo bilan `/events` | 401 |
| 3 | `t` 10 daqiqa eski | 401 |
| 4 | Ayni `event_id` ikki marta | Ikkinchisida `applied:false` |
| 5 | `seq` 145 dan keyin 144 | `applied:false`, `STALE_SEQ` |
| 6 | Ayni `batch_id` bilan `accept` ikki marta | Ayni javob, holat o'zgarmaydi |
| 7 | Noma'lum `qr_token` bilan `lookup` | 404, `PARCEL_NOT_FOUND` |
| 8 | `lookup` ikki marta | **Status o'zgarmaydi** (yon ta'sirsiz) |
| 9 | To'liq sikl: lookup → accept → delivered | Daftar `net_to_marketplace` ga oshadi |
| 10 | `rolled_back` yuborish | Daftar **teskari** yoziladi |
| 11 | `partly_delivered` | `delivered_amount` + `returned_amount` to'g'ri |
| 12 | `settlement.paid` taqsimot bilan | Har sotuvchi hisobi to'g'ri kamayadi |
| 12a | **Prepaid posilka** (`cod_amount = 0`) | `net_to_marketplace = −50 000`, daftar **kamayadi**, `seller_id` to'g'ri |
| 12b | **Bekor + ortiqcha xarajat** | `beepost_fee = 0`, `extra_cost` daftardan yechiladi |
| 12c | Ko'p qutili buyurtma (3 quti) | Pul **faqat bir marta**, uchala quti ham qabul qilinadi |
| 13 | 4 soat o'chirib qo'yish | Tiklangach hamma hodisa yetib keladi |
| 14 | `GET /parcels/status` solishtiruvi | `last_applied_seq` biznikiga mos |
| 15 | Kalit aylantirish (v1+v2) | Uzilish yo'q |

---

## 12. MUST / SHOULD / MAY

### 🔴 MUST — busiz integratsiya ishga tushmaydi

| # | Talab |
|---|---|
| 1 | HTTPS + JSON + UTF-8 |
| 2 | `X-Api-Key` + HMAC imzo tekshiruvi (300s oyna, doimiy vaqtli taqqoslash) |
| 3 | Ikki kalitli sekret aylantirish (`v1`/`v2`) |
| 4 | `GET /bp/v1/ping` |
| 5 | `POST /bp/v1/parcels/lookup` — **yon ta'sirsiz**, `seller_id` bilan. ⚠️ **Manifest yo'q** — bu endpoint har skanerda chaqiriladi va **ishonchli bo'lishi shart** |
| 6 | `POST /bp/v1/parcels/accept` — **`batch_id` bo'yicha idempotent** |
| 7 | `POST /bp/v1/events` — **`event_id` bo'yicha dedup + `seq` bo'yicha tartib** |
| 8 | `GET /bp/v1/parcels/status` — **solishtiruv** (`ids` va `updated_since`) |
| 9 | `GET /bp/v1/sellers` |
| 10 | `GET /bp/v1/ledger/balance` |
| 11 | **Rollback qo'llab-quvvatlash** (§6.3) |
| 12 | **`net_to_marketplace` MANFIY bo'lishini qabul qilish** — prepaid posilkada (§7.5) |
| 13 | **Umumiy `balance` manfiy bo'lishini qabul qilish** — siz BeePost'ga qarzdor bo'lishingiz mumkin |
| 14 | Butun sonli UZS summalar |
| 15 | SOATO tuman kodlari |
| 16 | `+998XXXXXXXXX` formatidagi **string** telefon |
| 17 | `parcel_index` / `parcel_count` — ko'p qutili buyurtma |
| 18 | `items[]` — SKU, nom, miqdor, birlik narxi (**qisman sotuv uchun**) |
| 19 | `money.prepaid` bayrog'i va `cod_amount` (`0` bo'lishi mumkin) |
| 20 | Sandbox muhiti — alohida kalit, alohida ma'lumot |
| 21 | `4xx` = qayta urinma; `5xx`/`429` = vaqtinchalik |
| 22 | 12 oy audit saqlash (`event_id`, payload, HTTP kod, vaqt) — bizning ID bo'yicha qidiriladigan |

### 🟡 SHOULD — kuchli tavsiya

| # | Talab |
|---|---|
| 1 | `429` + `Retry-After` |
| 2 | `webhook.test` turi (`POST /events` orqali) |
| 3 | `parcels/lookup` uchun yuqori mavjudlik (SLA) — manifest yo'qligi sabab bu endpoint **qabul jarayonining yagona bog'lanish nuqtasi** |
| 4 | `GET /bp/v1/ledger/balance` da sotuvchilar bo'yicha taqsimot |

### ⚪ MAY — ixtiyoriy

| # | Talab |
|---|---|
| 1 | Sotuvchi bo'yicha alohida tarif (hozir bir xil) |
| 2 | Real-time WebSocket |
| 3 | Sotuvchiga to'lov grafigi |

### ❌ v1 da YO'Q

| Nima | Nega |
|---|---|
| **Sizdan bizga webhook** | Siz bizga yoza olmaysiz — faqat `GET` (§5) |
| **Manifest** (qopni oldindan e'lon qilish) | Kelishuv bo'yicha qurilmaydi |
| **Qabuldan keyin bekor qilish** | Faqat BeePost hal qiladi |
| **Yo'qolgan posilka mexanizmi** | Tizimga kiritilmaydi — alohida kelishiladi |
| **Hudud cheklovi** | Butun O'zbekiston |
| mTLS · OAuth · GraphQL · exactly-once kafolat | Qo'llab-quvvatlanmaydi |

## 13. Ishga tushirish tartibi

| # | Qadam | Kim |
|:---:|---|---|
| 1 | Kontrakt tasdiqlanadi, savollar yopiladi | Ikkala tomon |
| 2 | Sandbox kalitlari almashiladi | Ikkala tomon |
| 3 | 7 ta endpoint yoziladi (§4) | Marketplace |
| 4 | BeePost tomoni yoziladi (mock bilan) | BeePost |
| 5 | §11 dagi 15 ta test o'tkaziladi | Ikkala tomon |
| 6 | Prod kalitlari, IP ro'yxati, endpoint manzillari | Ikkala tomon |
| 7 | **Pilot: 1 hudud, 1 hafta, kunlik solishtiruv** | Ikkala tomon |
| 8 | To'liq ishga tushirish | Ikkala tomon |

---

## 14. Savollar

Kontrakt bo'yicha savollar: BeePost texnik jamoasi.
Har o'zgarish **versiyalanadi** (`v1`, `v1.1`, ...) va eski versiya kamida 3 oy ishlaydi.
