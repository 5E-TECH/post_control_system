# BeePost — Carrier API (tashqi yetkazuvchi)

**Dasturchilar uchun qo'llanma** · Versiya 1 (BeePost nashri) · Oxirgi yangilanish: 2026-11-10

> **Elchi Pochta Carrier API bilan bir xil kontrakt.** Yo'llar (baza
> manzilidan keyingi qism), so'rov maydonlari, javob maydonlari va shakllari,
> xato `code` satrlari va HTTP statuslari Elchi bilan bir xil. Elchi'ga
> ulangan bo'lsangiz, BeePost uchun **faqat baza manzili va kalit** almashadi.
> Ikki tizim orasidagi barcha farqlar bitta joyda yig'ilgan:
> [Ilova A — BeePost profili](#ilova-a-beepost-profili-elchidan-farqlar).
>
> Interaktiv hujjat (Swagger, faqat Carrier API):
> `https://<beepost-domain>/api/v1/carrier-docs` — login va parolni BeePost
> beradi. Mashina o'qiydigan spec:
> [`docs/carrier-openapi.json`](docs/carrier-openapi.json) (Postman / kod
> generatori).

Bu hujjat BeePost posilkalarini **yetkazib beradigan tashqi kompaniya**
dasturchisi uchun. Unda quyidagilar bor: posilka QR'ini skanerlab buyurtma
ma'lumotini olish, yetkazish natijasini (sotildi, qisman sotildi, bekor
qilindi) BeePost'ga yuborish, bekor qilingan posilkani qaytarish va
hisob-kitobni kuzatish.

> **Marketplace API bilan adashtirmang.** `/api/v1/marketplace/{slug}/*`
> ([`MARKETPLACE_PARTNER_API.md`](MARKETPLACE_PARTNER_API.md)) BeePost'ga
> posilka **beradigan** marketplace'lar uchun. Bu hujjatdagi
> `/api/v1/carrier/*` esa BeePost buyurtmasini **yetkazadiganlar** uchun.
> Kalitlar ham alohida: biri ikkinchisida ishlamaydi.

---

## 1. Umumiy tasavvur

BeePost'da siz **bitta kurier akkaunti** sifatida ro'yxatdan o'tasiz. Bu bir
marta, ulanishda qilinadi. Keyingi oqim:

```
1. BeePost xodimi posilkalar pochtasini sizning kurier akkauntingizga
   jo'natadi — posilkalar `on the road` holatiga o'tadi
   (bu BeePost ichida bo'ladi, sizdan so'rov kerak emas).

2. Posilkani qo'lingizga olganda QR'ni skanerlaysiz   POST /carrier/scan
   → buyurtma ma'lumoti qaytadi va posilka sizda "qabul qilindi"
     (waiting) holatiga o'tadi.

3. Yetkazish natijasini yuborasiz                     POST /carrier/orders/:id/status
   sold | partly_sold | cancelled | rollback

4. Bekor qilingan posilkalarni qaytarasiz             POST /carrier/returns

5. Solishtirish va hisob-kitob                        GET  /carrier/orders
                                                      GET  /carrier/cashbox
```

**Muhim tushunchalar:**

- Siz **faqat o'zingizga biriktirilgan** (yoki hozir qo'lingizdagi)
  buyurtmalarni ko'rasiz. Boshqa buyurtmaning QR'i yoki id'si yuborilsa
  **404** qaytadi. Bunday buyurtma bazada bor-yo'qligi ham aytilmaydi.
- Sotilgan buyurtma summasi sizning **kurier kassangizga** yoziladi.
  Naqdni BeePost'ga topshirganingizda kassadan ayiriladi (§7).
- Statuslar **bizning nomlarimizda** yuboriladi (§5.2). Sizdagi ichki
  statuslarni shu to'rttasiga o'zingiz moslaysiz.
- Viloyat va tuman **nomi emas, SOATO kodi** bilan keladi (§4).
- Barcha id'lar (buyurtma, qator, mahsulot, hudud, pochta) — **UUID satr**.
  Ularni shaffof satr deb saqlang, son sifatida o'qimang.

### Baza manzili

```
https://<beepost-domain>/api/v1
```

Aniq domenni BeePost operatori beradi. Hujjatdagi barcha yo'llar shu
manzilga qo'shiladi: `POST /carrier/scan` →
`POST https://<beepost-domain>/api/v1/carrier/scan`. Ikkala tizim bilan
ishlasangiz, baza manzilini tizim bo'yicha sozlanadigan qiling.

---

## 2. Autentifikatsiya

Har bir so'rovda **`X-Api-Key`** sarlavhasi bo'lishi kerak:

```http
GET /api/v1/carrier/ping HTTP/1.1
Host: <beepost-domain>
X-Api-Key: bpc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- JWT **ishlatilmaydi**, faqat API kalit. Kalit `bpc_` bilan boshlanadi.
  Kalitni shaffof satr deb saqlang (uzunligi va formatiga tayanmang).
- Kalit **bir marta** ko'rsatiladi (yaratilganda). Bazada faqat uning
  SHA-256 hash'i saqlanadi, shuning uchun biz uni tiklab bera olmaymiz.
  Yo'qotsangiz, yangisi beriladi.
- Kalitni BeePost operatori yangilaydi (rotate). Bunda **eski kalit darhol
  ishlamay qoladi**.
- Kurier akkauntining **paroli sizga berilmaydi** va kerak ham emas: barcha
  amallar shu kalit orqali bajariladi. Bu akkaunt bilan BeePost ilovasiga
  kirib bo'lmaydi (login va sessiyani yangilash rad etiladi). BeePost kurier
  akkauntini bloklasa, kalit ham **darhol** ishlamay qoladi (`403`,
  `CARRIER_COURIER_INACTIVE`).

### IP cheklovi (ixtiyoriy)

Operator akkauntingizga IP ro'yxatini qo'yishi mumkin. Qabul qilinadigan
yozuvlar: IPv4 manzil (`203.0.113.10`), IPv4 diapazon (`203.0.113.0/24`) va
IPv6 manzil (`2001:db8::1`). **IPv6 diapazon qo'llab-quvvatlanmaydi.**
Serveringiz IPv6 orqali chiqsa, IPv6 manzilini ham bering. Ro'yxat **bo'sh
bo'lsa cheklov yo'q**. Ro'yxatdan tashqari manzildan kelgan so'rovga **403**
qaytadi va xabarda aniqlangan IP ko'rsatiladi.

IP manzil BeePost'ga kelgan **ulanishdan** aniqlanadi. `CF-Connecting-IP`
yoki siz yuborgan `X-Forwarded-For` kabi sarlavhalar hisobga olinmaydi.

Yo'lni **aynan kichik harflarda** yozing: `/api/v1/carrier/...`. Boshqa
registrdagi yo'l (`/api/v1/Carrier/ping`) `404` qaytaradi.

### Rate limit

- Akkaunt uchun **daqiqada 120 so'rov** — barcha `/carrier/*` endpointlari
  birgalikda.
- Bitta IP manzildan **daqiqada 600 so'rov** — barcha `/carrier/*`
  endpointlari birgalikda, kalit tekshiruvidan **oldin** (kalitsiz va
  noto'g'ri kalitli so'rovlar ham sanaladi). Bitta IP ortida bir nechta
  akkaunt bo'lsa ham yetadi.
- Elchi'dagi "har endpoint uchun bitta IP'dan 120" limiti BeePost'da
  yuqoridagi umumiy IP limiti bilan almashtirilgan.

Oshsa **429** qaytadi (`Retry-After` sarlavhasi bilan). Solishtirish uchun
buyurtmalarni bittalab so'ramang, `GET /carrier/orders` bilan sahifalab
oling (§5.3).

---

## 3. Javob shakllari

### Muvaffaqiyat

**Barcha** `/carrier/*` javoblari shu qobiqda keladi:

```json
{
  "statusCode": 200,
  "message": "Buyurtma topildi",
  "data": { ... }
}
```

### Xatolar

```json
{
  "statusCode": 409,
  "message": "Bu Idempotency-Key oldingi urinishga tegishli — amal qayta bajarilmadi. Yangi kalit bilan yuboring",
  "code": "CARRIER_IDEMPOTENCY_KEY_STALE",
  "trace_id": "eaff465b-4c89-4721-b7c8-30cf22fb403e"
}
```

`trace_id` ni **saqlab qo'ying**: muammo bo'lganda biz shu id bo'yicha
loglardan aniq so'rovni topamiz (BeePost'da u `X-Trace-Id` javob
sarlavhasida ham keladi). Qarorni xabar **matniga emas**, `statusCode` va (bo'lsa) `code` ga
qarab qabul qiling — matn o'zgarishi mumkin.

| Kod | Ma'nosi | Qayta urinishmi |
|---|---|---|
| `400` | So'rov noto'g'ri (maydon, id UUID emas, `Idempotency-Key` yo'q — `CARRIER_IDEMPOTENCY_KEY_REQUIRED`, isbot fayli mos emas) yoki buyurtma bu amal uchun mos holatda emas | ❌ yo'q — tuzatish kerak |
| `401` | `X-Api-Key` yo'q yoki yaroqsiz | ❌ yo'q |
| `403` | Akkaunt o'chirilgan, bog'langan kurier faol emas (`CARRIER_COURIER_INACTIVE`) yoki IP ruxsat etilmagan | ❌ yo'q — BeePost'ga murojaat |
| `404` | Buyurtma topilmadi yoki sizga biriktirilmagan | ❌ yo'q |
| `409` + `IDEMPOTENCY_IN_PROGRESS` | Ayni `Idempotency-Key` bilan so'rov hali bajarilmoqda | ✅ ha, biroz kutib, **ayni** kalit bilan |
| `409` + `CARRIER_IDEMPOTENCY_KEY_STALE` | Kalit eski urinishga tegishli — amal bajarilmadi | ✅ ha, **yangi** kalit bilan |
| `413` | Isbot fayli 50 MB dan katta | ❌ yo'q |
| `422` + `IDEMPOTENCY_KEY_MISMATCH` | Shu `Idempotency-Key` boshqa amal, buyurtma yoki tana bilan ishlatilgan | ❌ yo'q — yangi kalit |
| `429` | Rate limitdan oshdi | ✅ ha, `Retry-After` kutib |
| `5xx`, `503`, `504` | Bizning tomonimizdagi vaqtinchalik xato yoki timeout (`CARRIER_KEY_CHECK_UNAVAILABLE`, `CARRIER_TEMPORARILY_UNAVAILABLE`) | ✅ ha, **ayni** `Idempotency-Key` bilan. 10 daqiqadan uzoq takrorlansa — `trace_id` bilan BeePost'ga murojaat qiling |

> `/carrier/*` endpointlariga yetib kelmagan so'rovlar (mavjud bo'lmagan
> yo'l, buzilgan JSON, 64 MB dan katta tana) BeePost'ning umumiy xato
> shaklida kelishi mumkin — `code` va `trace_id` siz. Bunda ham qarorni
> `statusCode` ga qarab qiling.

---

## 4. Buyurtma obyekti

`scan`, `status` va `orders` javoblaridagi `order` obyekti:

| Maydon | Tur | Izoh |
|---|---|---|
| `id` | string | Buyurtma id (UUID) — `POST /carrier/orders/:id/status` uchun |
| `order_number` | string \| null | Inson o'qiydigan raqam |
| `qr_token` | string \| null | Yorliqdagi QR qiymati. Shaffof satr deb qarang (Ilova A) |
| `parent_order_id` | string \| null | Qisman sotuvdan ajralgan (sotilmagan) qism bo'lsa — asl buyurtma |
| `status` | string | BeePost'dagi holat (§6) |
| `total_price` | number | Buyurtma summasi, so'm |
| `paid_online_amount` | number | Mijoz oldindan onlayn to'lagan qism. BeePost'da **doim `0`** |
| `cod_amount` | number | **Mijozdan naqd olinadigan summa** = `total_price − paid_online_amount` (BeePost'da `= total_price`) |
| `where_deliver` | string \| null | `center` yoki `address` |
| `address` | string \| null | Yetkazish manzili |
| `comment` | string \| null | Buyurtmaga izoh |
| `customer` | object \| null | `{ name, phone_number, extra_number }` |
| `region`, `district` | object \| null | `{ id, soato_code }` — viloyat va tuman **nomi emas, rasmiy SOATO kodi** bilan (viloyat 4 xona, masalan `1726`; tuman 7 xona, masalan `1726294`). Geo'ni o'zingizdagi ma'lumotnomaga SOATO bo'yicha moslang. Obyekt `null` — buyurtmada viloyat/tuman yo'q; `soato_code: null` — bu hudud uchun SOATO kodi BeePost'da yo'q (bunda `id` dan foydalaning yoki BeePost'dan so'rang) |
| `market` | object \| null | Sotuvchi: `{ id, name }` |
| `replacement` | object \| null | Almashtirish buyurtmasi: `{ of_order_id, old_item_required }`. `old_item_required: true` bo'lsa eski mahsulotni mijozdan oling va sotishda `old_item_collected: true` yuboring (aks holda `400`). Oddiy buyurtmada `null` |
| `items` | array | `[{ id, product_id, name, quantity }]` — `id` qisman sotuvda kerak. Ba'zi buyurtmalarda bo'sh bo'lishi mumkin (Ilova A) |
| `created_at` | string \| null | ISO vaqt |

Ro'yxatga **yangi maydon qo'shilishi mumkin**. Kodingiz noma'lum maydonni
e'tiborsiz qoldirsin. Mavjud maydon esa o'chirilmaydi va ma'nosi
o'zgarmaydi.

---

## 5. Asosiy oqim

### 5.1 Posilkani skanerlash

`POST /carrier/scan`

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `qr_token` | string | ✅ | Yorliqdagi QR qiymati (≤255 belgi) |

```json
{ "qr_token": "5f2a9c1e7b3d4a6f8e0c2b19" }
```

Javob:

```json
{
  "statusCode": 200,
  "message": "Posilka qabul qilindi",
  "data": {
    "received": true,
    "order": { "id": "3f6c1a2e-8b4d-4c7a-9e21-5d0b7f3a9c10", "status": "waiting", "cod_amount": 150000, "...": "..." },
    "refreshed": true
  }
}
```

- Posilka **yo'lda** (`on the road`) bo'lsa, skan uni sizga **qabul
  qiladi**: holati `waiting` ga o'tadi va `received: true` qaytadi. Sotish
  va bekor qilish faqat `waiting` holatida mumkin, shuning uchun posilkani
  **avval skanerlang**. (BeePost'da `waiting_customer` holati yo'q.)
- `received: true` bilan `order: null`, `refreshed: false` — posilka qabul
  qilindi, lekin ma'lumotni hozir o'qib bo'lmadi: biroz kutib qayta
  skanerlang (endi `received: false` bilan to'liq ma'lumot keladi — bu normal).
- Boshqa holatda faqat ma'lumot qaytadi (`received: false`). Qayta skanerlash
  xavfsiz: allaqachon sotilgan yoki bekor qilingan buyurtma qayta "qabul
  qilinmaydi".
- Sizga biriktirilmagan posilka bo'lsa **404** qaytadi.
- QR qiymati normallashtiriladi (chetdagi bo'sh joylar olib tashlanadi,
  harflar kichik harfga o'tkaziladi, rus klaviaturasida terilgan belgilar
  lotinga qaytariladi). Yorliqdagi qiymatni o'zgartirmasdan yuboring.

### 5.2 Holatni yuborish

`POST /carrier/orders/:id/status` · `application/json` yoki `multipart/form-data`
· **`Idempotency-Key` sarlavhasi majburiy**

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `status` | string | ✅ | `sold` · `partly_sold` · `cancelled` · `rollback` |
| `comment` | string | — | Izoh (≤1000 belgi). `reason: OTHER` bo'lsa majburiy |
| `reason` | string | `cancelled` da ✅ | `CUSTOMER_NO_ANSWER` · `CUSTOMER_REFUSED` · `WRONG_ADDRESS` · `DEFECTIVE_PRODUCT` · `PRICE_DISPUTE` · `OTHER` |
| `total_price` | number | `partly_sold` da ✅ | Mijoz **olgan** tovarlarning to'liq qiymati, so'm (butun son) — oldindan onlayn to'langan qism (`paid_online_amount`) ham shu ichida. Buyurtma summasidan oshmaydi. Siz yig'adigan naqd = `max(total_price − paid_online_amount, 0)` (BeePost'da `= total_price`) |
| `items` | array | `partly_sold` da ✅ | Buyurtmaning **har bir** qatori va undan **sotilgan** dona (pastdagi jadval) |
| `old_item_collected` | boolean | almashtirishda ✅ | `order.replacement.old_item_required: true` bo'lsa — eski mahsulot mijozdan olindi |

`items[]` elementi:

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `order_item_id` | string | tavsiya | `order.items[].id` |
| `product_id` | string | `order_item_id` bo'lmasa ✅ | `order.items[].product_id` |
| `quantity` | integer | ✅ | Shu qatordan **sotilgan** dona (0 — hech narsa) |

**Statuslar:**

| Status | Nima bo'ladi | Shart |
|---|---|---|
| `sold` | Buyurtma to'liq sotildi. Summa kassangizga yoziladi (§7). Javobdagi holat `sold`, ba'zan darhol `paid`/`partly_paid` | Holat `waiting` |
| `partly_sold` | Qisman sotildi. Sotilmagan qism alohida `cancelled` buyurtma bo'lib ajraladi (`parent_order_id` bilan) va sizda qoladi — uni §5.5 bilan qaytarasiz | Holat `waiting`. `items` da buyurtmaning **har bir** qatori bo'lishi, kamida bitta qator kamaytirilgan va kamida bitta dona sotilgan bo'lishi kerak. Har qatorda sotilgan dona asl donadan oshmaydi. Buyurtmada tovar qatorlari bo'lishi, u almashtirish buyurtmasi bo'lmasligi va bitta mahsulot ikki qatorda takrorlanmasligi kerak (Ilova A) |
| `cancelled` | Mijoz olmadi. Pul harakati yo'q. Posilka sizda qoladi — uni §5.5 bilan BeePost markaziga qaytarasiz | Holat `waiting` |
| `rollback` | Xato yuborilgan `sold` yoki `cancelled` ni bekor qiladi: buyurtma `waiting` ga qaytadi, kassa yozuvi teskari yoziladi | Holat **aynan** `sold` yoki `cancelled` (bekor qilingan posilka hali sizda bo'lishi kerak). `paid` / `partly_paid` — `400`, tuzatishni BeePost operatori qiladi. Topshirilgan naqd rollback'ni to'smaydi (§7). Qisman sotuvdan ajralgan qismni va sotilmagan qismi allaqachon qaytarilgan qisman sotuvni qaytarib bo'lmaydi — `400` (Ilova A) |

Qo'shimcha xarajat (`extraCost`) va sotuvchiga to'g'ridan-to'g'ri to'lov
(`paidAmount`) **bu versiyada yo'q**. Bunday maydon yuborilsa 400 qaytadi.

#### Qisman sotuv misoli

Buyurtma: `total_price = 300 000`, `paid_online_amount = 0`, ikki qator
(2 ta kurtka 100 000 dan, 1 ta shim 100 000). Mijoz 1 ta kurtka va shimni
oldi:

```json
{
  "status": "partly_sold",
  "total_price": 200000,
  "items": [
    { "order_item_id": "9b1e4c2a-6d3f-4e8b-a7c5-1f2d3e4a5b6c", "quantity": 1 },
    { "order_item_id": "0c8d7e6f-5a4b-4c3d-9e2f-1a0b9c8d7e6f", "quantity": 1 }
  ]
}
```

Siz yig'adigan naqd: `200 000` (BeePost'da oldindan onlayn to'lov yo'q).
Sotilmagan 1 ta kurtka (`100 000`) alohida `cancelled` buyurtma bo'lib
qoladi.

> Elchi nashridagi misol oldindan to'langan buyurtma bilan
> (`paid_online_amount = 100 000`). Formula bir xil:
> naqd = `max(total_price − paid_online_amount, 0)`. Kodingiz shu formulani
> ishlatsa, ikkala tizimda ham to'g'ri hisoblaydi.

#### Isbot fayli (`proof`)

BeePost'da isbot **talab qilinmaydi**: "isbot talab qilinadi" sababli `400`
bo'lmaydi. Elchi uchun yozilgan kodingiz `multipart/form-data` bilan `proof`
faylini yuborsa ham so'rov qabul qilinadi, fayl Elchi'dagi qoidalar bilan
tekshiriladi, lekin **saqlanmaydi**:

- rasm `jpeg`/`png`/`webp` yoki `pdf` — **≤10 MB**;
- video `mp4`/`mov`/`webm` — **≤50 MB** (kattasi — `413`);
- fayl qismi `Content-Type` i shu turlardan biri bo'lishi kerak (HEIC qabul
  qilinmaydi); boshqa tur yoki hajm — `400`;
- `rollback` bilan `proof` yuborilsa — `400`.

Multipart'da boshqa maydonlar matn bo'lib yuboriladi: `items` — bitta
JSON-massiv satri (`[{"order_item_id":"9b1e4c2a-…","quantity":1}]`) yoki har
bir qator alohida `items` qismi (JSON-obyekt satri), `total_price` — raqam
satri, `old_item_collected` — `true`/`false`.

#### Idempotentlik

`Idempotency-Key` **majburiy** (≤255 belgi). Qoida oddiy:

- **Har yangi urinish (niyat) uchun yangi kalit** — masalan UUID.
- Ayni kalitni **faqat shu so'rovni qayta yuborishda** ishlating (javob
  kelmadi, `409`, `429`, `5xx`, `504`). Amal ikkinchi marta bajarilmaydi.
  Birinchi urinish aslida bajarilgan bo'lsa (javob yo'lda yo'qolgan yoki
  server qayta ishga tushgan), qayta yuborish `200` va buyurtmaning joriy
  holatini qaytaradi — "waiting emas" `400` emas. Birinchi urinish hali
  ishlayotgan bo'lsa `409` `IDEMPOTENCY_IN_PROGRESS` (ko'pi bilan 90
  soniya), keyin qayta urining.
- `rollback` dan keyin qayta `sold`/`cancelled` — **yangi** kalit. Eski
  kalit bilan yuborilsa amal bajarilmaydi va `409`
  `CARRIER_IDEMPOTENCY_KEY_STALE` qaytadi.
- Ayni kalit boshqa tana bilan yuborilsa **422** qaytadi.

```http
POST /api/v1/carrier/orders/3f6c1a2e-8b4d-4c7a-9e21-5d0b7f3a9c10/status HTTP/1.1
X-Api-Key: bpc_…
Idempotency-Key: 6f1c2a8e-4b7d-4c1e-9a3f-2d5b8e7c1a90
Content-Type: application/json

{ "status": "sold" }
```

Javob — yangilangan buyurtma:

```json
{ "statusCode": 200, "message": "Holat qabul qilindi", "data": { "order": { "id": "3f6c1a2e-8b4d-4c7a-9e21-5d0b7f3a9c10", "status": "sold", "...": "..." }, "refreshed": true } }
```

`refreshed: false` va `order: null` — holat **qabul qilindi**, lekin
yangilangan buyurtmani hozir o'qib bo'lmadi. **Qayta yubormang**: buyurtmani
keyinroq `GET /carrier/orders` bilan oling.

### 5.3 Buyurtmalar ro'yxati

`GET /carrier/orders?status=waiting,sold&from=2026-11-01&to=2026-11-10&page=1&limit=50`

| Parametr | Izoh |
|---|---|
| `status` | Vergul bilan ajratilgan holatlar (§6). Berilmasa barcha holatlar. Elchi holatlari ro'yxatidagi har qanday qiymat qabul qilinadi (BeePost'da bo'lmaydiganlari — bo'sh natija); noma'lum qiymat — `400` |
| `from`, `to` | **Buyurtma yaratilgan** kun oralig'i (`YYYY-MM-DD`, Toshkent vaqti, chegaralar kiradi) — biriktirilgan yoki sotilgan sana emas. Kalendarda bor kun bo'lishi shart: `2026-02-31` — `400` |
| `page` | 1 dan boshlanadi |
| `limit` | `10` · `25` · `50` · `100` (standart 50) |

Javob: `data: { items: Order[], total, page, limit }`. Bu yerda sizga
biriktirilgan yoki hozir qo'lingizdagi buyurtmalar chiqadi.

### 5.4 Kassa

`GET /carrier/cashbox?from=2026-11-01&to=2026-11-10`

Kurier kassangizning balansi va harakatlar tarixi: sotuvdan tushgan summalar
va BeePost'ga topshirgan naqdingiz. Pul qoidalari §7 da.

| Maydon | Tur | Izoh |
|---|---|---|
| `from`, `to` | string | Tarix oynasi (`YYYY-MM-DD`, Toshkent kunlari). Berilmasa — oxirgi 30 kun; eng ko'pi 92 kun (uzunroq oraliq — `400`, bo'lib so'rang) |
| `balance` | number | Joriy balans — BeePost'ga topshirilishi kerak bo'lgan summa. Oynaga **bog'liq emas**. Manfiy bo'lishi mumkin (§7) |
| `income`, `outcome` | number | Oynadagi jami kirim va chiqim |
| `history` | array | Oynadagi harakatlar (pastdagi jadval), yangidan eskiga |

> ℹ️ BeePost'da kassa yozuvi holat bilan **bitta tranzaksiyada** yoziladi:
> `status` javobi kelganda yozuv kassada allaqachon bor. (Elchi'da yozuv bir
> necha soniya kechikib paydo bo'ladi — ikkala tizim uchun bitta kod
> yozsangiz, kechikishga chidamli bo'ling.)

`history[]` elementi:

| Maydon | Tur | Izoh |
|---|---|---|
| `id` | string | Harakat id |
| `type` | string | Yo'nalish: `income` — kirim, `expense` — chiqim |
| `source_type` | string | Manba, masalan `sell` — sotuv, `correction` — tuzatish (rollback), `courier_payment` — topshirilgan naqd, `extra_cost`, `courier_penalty` — kechikish shtrafi yoki bonusi. Ro'yxat **ochiq**: yangi qiymat paydo bo'lishi mumkin |
| `amount` | number | Summa, so'm — **doim musbat**; yo'nalish `type` da. `sell` qatori ham `expense` bo'lishi mumkin (summa yetkazish haqidan kam buyurtma, §7) |
| `balance_after` | number | Shu harakatdan keyingi balans |
| `order_id` | string \| null | Buyurtma bilan bog'liq qatorda — buyurtma id |
| `payment_method` | string \| null | To'lov usuli (masalan `cash`, `click`) |
| `comment` | string \| null | Izoh |
| `created_at` | string \| null | ISO vaqt |

### 5.5 Bekor qilingan posilkalarni qaytarish

`POST /carrier/returns`

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `order_ids` | array | ✅ | Sizdagi `cancelled` posilkalar id'lari (qisman sotuvdan ajralgan qism ham), 1–50 ta |

```json
{ "order_ids": ["7d2e9f1a-3b4c-4d5e-8f6a-0b1c2d3e4f5a", "a4b5c6d7-e8f9-4a0b-9c1d-2e3f4a5b6c7d"] }
```

Javob: `data: { post_id, order_ids }`. Posilkalar BeePost'ning qaytarish
pochtasiga tushadi va holati `cancelled (sent)` bo'ladi. Posilkalarni
BeePost markaziga topshirasiz, markaz pochtani qabul qiladi. Takroriy so'rov
xavfsiz: allaqachon shu pochtadagi posilka uchun o'sha `post_id` qaytadi.

Qaytarilgan posilka **`GET /carrier/orders` ro'yxatidan chiqadi** (u endi
sizda emas). Uni QR bo'yicha `POST /carrier/scan` bilan ko'rish mumkin:
holati `cancelled (sent)` — markaz qabul qilgandan keyin ham shunday
qoladi; posilka sotuvchiga topshirilgach — `closed`. Qaytarishni javobdagi
`post_id` bo'yicha kuzating.
Markaz pochtani qabul qilganda undagi posilka **yetib kelmagan** bo'lsa, u
yana `cancelled` bo'lib sizga qaytadi va ro'yxatda qayta paydo bo'ladi —
uni qaytadan yuboring (yangi `post_id` kelishi mumkin).
`cancelled` bo'lmagan posilka bor bo'lsa — `400`, sizniki bo'lmagani — `404`
(id'lar xabarda). UUID bo'lmagan id — `400`.

---

## 6. BeePost'dagi holatlar

| Holat | Ma'nosi |
|---|---|
| `created`, `new`, `received` | BeePost ichida (hali sizga jo'natilmagan) |
| `on the road` | Sizga jo'natildi, hali skanerlanmagan |
| `waiting` | Sizda (skanerlangan) — natija kutilmoqda. Yetkazib bo'lmasa ham shu holatda qoladi |
| `sold` | Sotildi |
| `paid`, `partly_paid` | Sotildi va sotuvchi bilan hisob-kitob qilindi (BeePost ichida) |
| `cancelled` | Bekor qilindi. Posilka hali sizda — §5.5 bilan qaytaring |
| `cancelled (sent)` | Bekor qilingan posilka qaytarish pochtasida (BeePost markaziga yo'lda yoki markazda) |
| `closed` | Qaytarilgan posilka sotuvchiga topshirildi (qaytarish yakunlandi) |

Elchi'dagi `waiting_customer` va `returned_to_market` BeePost'da **hech
qachon kelmaydi**.

Holatlar ro'yxati **kengayishi mumkin**: kodingiz noma'lum holatni xato deb
emas, "boshqa" deb qabul qilsin.

---

## 7. Pul qanday hisoblanadi

- **Sotuvda** kassangizga yoziladigan summa: mijozdan olingan naqd
  (`cod_amount`, qisman sotuvda `total_price − paid_online_amount`) minus
  **sizning yetkazish haqingiz** (shartnomadagi tarif; hududga qarab farq
  qilishi mumkin). Bu siz BeePost'ga topshirishingiz kerak bo'lgan summa
  (`income` qatori).
- Buyurtma summasi yetkazish haqingizdan kam bo'lsa (masalan 0 so'mlik
  buyurtma), farq **`expense`** qatori bo'lib yoziladi (`source_type: sell`,
  `amount` musbat): balans kamayadi — ya'ni BeePost sizga qarzdor.
- **Bekor qilishda** pul harakati yo'q.
- **Naqdni topshirganingizda** BeePost xodimi uni qabul qiladi. Kassangizdan
  **chiqim** yoziladi (`courier_payment`) va tarixda ko'rinadi (§5.4).
  BeePost'da topshirilgan naqd alohida sotuvlarga bog'lanmaydi — u faqat
  umumiy balansni kamaytiradi.
- `rollback` sotuvni teskari yozadi (`correction` qatori). BeePost'da naqd
  topshirilgandan keyin ham rollback ishlaydi: balans **manfiy** bo'lishi
  mumkin — bu BeePost sizga qarzdor degani, farq keyingi hisob-kitobda
  yopiladi.

---

## 8. Ulanish tartibi (checklist)

**BeePost tomoni (operator):**

1. Yangi kurier ochiladi (`POST /api/v1/user/courier`). Undagi tarif —
   kompaniyaning har bir buyurtma uchun oladigan haqi. Kurier **yangi**
   bo'lishi shart: unga pochta jo'natilmagan, kassa balansi `0`.
2. `POST /api/v1/carrier-accounts` `{ name, courier_id, ip_allowlist? }` —
   javobdagi `api_key` kompaniyaga xavfsiz kanal orqali beriladi.
3. Kurier paroli kompaniyaga **berilmaydi**: bog'lashda u tasodifiy parolga
   almashtiriladi va kurier akkauntiga hech kim kira olmaydi (login,
   sessiyani yangilash va parol o'rnatish rad etiladi). Bog'lashdan oldin
   kurier akkauntiga **kirib ko'rmang**: yaqinda kirilgan kurier bog'lanmaydi
   (`400`) — o'sha sessiya kalitsiz amal qila olardi.
4. Kompaniya bilan ishni to'xtatish: `POST /api/v1/carrier-accounts/:id/status`
   `{ is_active: false }`. Kurierni bloklash ham kalitni **darhol**
   to'xtatadi, lekin kurier **qayta faollashtirilsa eski kalit ham qayta
   ishlaydi** — kalit sizib chiqqan bo'lsa, albatta
   `POST /api/v1/carrier-accounts/:id/rotate-key` qiling yoki akkauntni
   o'chiring (`DELETE /api/v1/carrier-accounts/:id`).
5. Posilkalar kompaniyaga oddiy kurierdagi kabi pochta jo'natish bilan
   beriladi.
6. Qaytarilgan posilkalarni markaz qaytarish pochtasi bo'yicha qabul qiladi.
7. Naqd topshirilganda kassada kurierdan to'lov qabul qilinadi (smena ochiq
   bo'lishi kerak).

**Sizning tomoningiz:**

1. Baza manzilini sozlang (`https://<beepost-domain>/api/v1`) va
   `GET /carrier/ping` bilan kalit ishlayotganini tekshiring.
2. Sinov buyurtmasi akkauntingizga jo'natilgach: `scan` → `status: sold`
   → `GET /carrier/cashbox` da kirimni ko'ring.
3. Sizdagi statuslarni §5.2 dagi to'rtta qiymatga moslang.
4. Har bir holat yuborishda **yangi** `Idempotency-Key` (UUID) yarating;
   qayta urinishda ayni kalitni ishlating.
5. Bekor qilingan posilkalarni `POST /carrier/returns` bilan qaytaring.
6. Geo'ni SOATO kodi bo'yicha moslang (§4).
7. `trace_id` va `Idempotency-Key` ni loglaringizda saqlang.

---

## 9. Tez-tez uchraydigan xatolar

| Xabar | Sabab | Yechim |
|---|---|---|
| `Buyurtma topilmadi yoki sizga biriktirilmagan` (404) | Buyurtma boshqa kurierda, hali biriktirilmagan yoki boshqa tizim (masalan Elchi) nazoratida | BeePost operatoridan biriktirishni so'rang |
| Holat `waiting` emas (400) | Posilka skanerlanmagan | Avval `POST /carrier/scan` |
| Buyurtma id noto'g'ri (400) | Id UUID emas (masalan Elchi id'si BeePost'ga yuborilgan) | Id'ni shu tizimning `scan`/`orders` javobidan oling |
| `CARRIER_IDEMPOTENCY_KEY_REQUIRED` (400) | `Idempotency-Key` sarlavhasi yo'q | Har urinish uchun UUID yuboring |
| `CARRIER_IDEMPOTENCY_KEY_STALE` (409) | Eski urinish kaliti qayta ishlatildi | Yangi kalit bilan yuboring |
| `property extraCost should not exist` (400) | v1 da qo'shimcha xarajat yo'q | Maydonni olib tashlang |
| Almashtirish buyurtmasi (400) | `old_item_collected: true` yuborilmagan | `order.replacement` ga qarang |
| Qisman sotib bo'lmaydi (400) | Buyurtmada tovar qatorlari yo'q, almashtirish buyurtmasi yoki bitta mahsulot ikki qatorda | `sold` yoki `cancelled` yuboring yoki BeePost operatoriga murojaat qiling |
| Rollback mumkin emas (400) | `paid`/`partly_paid`, qisman sotuvdan ajralgan qism yoki sotilmagan qismi qaytarilgan qisman sotuv | BeePost operatoriga murojaat qiling |
| Isbot fayli mos emas (400) / 50 MB dan katta (413) | `proof` turi yoki hajmi qoidaga mos emas | Faylni tuzating yoki yubormang — BeePost'da isbot majburiy emas |
| `CARRIER_COURIER_INACTIVE` (403) | Bog'langan kurier bloklangan | BeePost operatoriga murojaat qiling |
| `Carrier akkaunt faol emas` (403) | Akkaunt o'chirilgan | BeePost operatoriga murojaat qiling |
| `IP ruxsat etilmagan: …` (403) | So'rov ro'yxatda yo'q manzildan keldi | Xabardagi IP'ni BeePost operatoriga bering |
| `CARRIER_KEY_CHECK_UNAVAILABLE` / `CARRIER_TEMPORARILY_UNAVAILABLE` (503) | Vaqtinchalik ichki xato | Biroz kutib ayni kalit bilan qayta urining |

---

## Ilova A. BeePost profili (Elchi'dan farqlar)

Quyidagilardan tashqari kontrakt Elchi bilan **bir xil**. Xato `code`
satrlari ikkala tizimda aynan bir xil: `CARRIER_KEY_CHECK_UNAVAILABLE`,
`CARRIER_COURIER_INACTIVE`, `CARRIER_IDEMPOTENCY_KEY_REQUIRED`,
`CARRIER_IDEMPOTENCY_KEY_STALE`, `CARRIER_TEMPORARILY_UNAVAILABLE`,
`IDEMPOTENCY_KEY_MISMATCH`, `IDEMPOTENCY_IN_PROGRESS`.

Bitta kod ikkala tizimda ishlashi uchun kodingiz: (1) baza manzili va
kalitni tizim bo'yicha sozlaydi; (2) id'larni shaffof satr deb saqlaydi;
(3) noma'lum holat va noma'lum `source_type` ni "boshqa" deb qabul qiladi;
(4) qarorni xabar matniga emas, `statusCode` va `code` ga qarab qiladi.

### A.1 Ulanish va xavfsizlik

| # | Mavzu | Elchi | BeePost | Kodingizga ta'siri |
|---|---|---|---|---|
| A1 | Baza manzili | `https://api.elchipochta.uz` | `https://<beepost-domain>/api/v1` | Baza manzili sozlanadigan bo'lsin. Undan keyingi yo'llar (`/carrier/...`) bir xil |
| A2 | Kalit prefiksi | `elc_` | `bpc_` | Kalitni shaffof satr deb saqlang. Bir tizim kaliti ikkinchisida `401` |
| A3 | Kurier bloklanishi | ≤30 soniyada kuchga kiradi | **Darhol** (har so'rovda tekshiriladi) | Yo'q |
| A4 | Mijoz IP'si | `CF-Connecting-IP` sarlavhasidan | Ulanishdan (BeePost proksisi orqali); `CF-Connecting-IP` va siz yuborgan `X-Forwarded-For` hisobga olinmaydi | IP ro'yxatiga serveringizning haqiqiy chiquvchi IP'sini bering |
| A5 | Rate limit | Akkaunt uchun 120/daq + har endpoint uchun bitta IP'dan 120/daq | Akkaunt uchun 120/daq (barcha endpoint birgalikda) + kalitdan oldin bitta IP'dan 600/daq (barcha endpoint birgalikda) | Yo'q — `429` va `Retry-After` qoidasi bir xil |
| A6 | Swagger | `/carrier-docs` | `/api/v1/carrier-docs` (JSON: `/api/v1/carrier-docs-json`) | Statik spec: [`docs/carrier-openapi.json`](docs/carrier-openapi.json) — yo'llari Elchi'dagidek `/carrier/...`, `/api/v1` esa `servers` da |
| A7 | Admin endpointlari (operator uchun) | `/admin/carriers` | `/api/v1/carrier-accounts` (+ `DELETE /:id`) | Yo'q — sizning kodingiz ularni chaqirmaydi |
| A26 | Yo'l registri | — | Faqat kichik harf: `/api/v1/carrier/...`; `/api/v1/Carrier/...` — `404` | Yo'llarni hujjatdagidek yozing |

### A.2 Ma'lumot

| # | Mavzu | Elchi | BeePost | Kodingizga ta'siri |
|---|---|---|---|---|
| A8 | Id'lar | Raqamli satr (`"900"`) | **UUID satr** (`"3f6c1a2e-…"`): buyurtma, `items[].id`, `product_id`, `region.id`, `district.id`, `market.id`, `post_id`, kassa yozuvi `id` | Id'ni son deb o'qimang; ≥36 belgi joy qoldiring. Path'dagi yoki `order_ids` dagi UUID bo'lmagan id — `400` (Elchi'da raqam bo'lmagan id — `400`, xuddi shunday) |
| A9 | `qr_token` | Elchi yorlig'i | Odatda 24 belgili hex. Marketplace va tashqi manbadan kelgan buyurtmada **hamkor yorlig'i** bo'lishi mumkin (masalan `uzm-9100-1`); bir xil qiymat bir nechta buyurtmada uchrashi mumkin | QR'ni shaffof satr deb yuboring. Skan faqat sizga biriktirilgan posilkalar orasidan qidiradi |
| A10 | `paid_online_amount` | Oldindan onlayn to'lov bo'lishi mumkin | **Doim `0`**, ya'ni `cod_amount = total_price` | Formula `max(total_price − paid_online_amount, 0)` ikkala tizimda to'g'ri |
| A11 | `items` | Har buyurtmada qatorlar bor | Marketplace va tashqi manbadan kelgan buyurtmada `items: []` bo'lishi mumkin | Bunday buyurtmani `partly_sold` qilib bo'lmaydi (`400`) — `sold`/`cancelled` yoki BeePost operatori |
| A12 | Holatlar | `waiting_customer`, `returned_to_market` bor; `closed` — eski yozuvlar | Bu ikkisi **hech qachon kelmaydi**; `closed` — faol holat: qaytarilgan posilka sotuvchiga topshirildi | Noma'lum/kelmaydigan holatni "boshqa" deb qabul qiling. `GET /carrier/orders?status=` Elchi ro'yxatidagi barcha qiymatni qabul qiladi (`400` bermaydi) |
| A13 | Yetkazib bo'lmagan posilka | `waiting_customer` ga o'tadi, keyingi skan qayta qabul qiladi | Holat yo'q: posilka sizda `waiting` bo'lib qoladi | Qayta urinib ko'ring yoki `cancelled` yuboring. Skan faqat `on the road` ni qabul qiladi |
| A14 | Qaytarilgan posilka | `cancelled (sent)` → filial qabul qilgach `cancelled` | `cancelled (sent)` → markaz qabul qilgandan keyin ham **`cancelled (sent)`** → sotuvchiga topshirilgach `closed`. Markazga yetib kelmagan posilka `cancelled` bo'lib sizga qaytadi | Qaytgan posilkani qayta `POST /carrier/returns` qiling |
| A25 | `GET /carrier/orders` da kalendarda yo'q kun (`from=2026-02-31`) | Qabul qilinadi, kun keyingi oyga suriladi (`2026-03-03`) — `200` | `400` "Sana noto'g'ri (YYYY-MM-DD)" | Oy oxirini hisoblab yuboring (`2026-02-28`); bu ikkala tizimda bir xil natija beradi |

### A.3 Amallar va pul

| # | Mavzu | Elchi | BeePost | Kodingizga ta'siri |
|---|---|---|---|---|
| A15 | Rollback va topshirilgan naqd | Hisob-kitobi yopilgan sotuv (naqd eng eski sotuvlardan yopiladi) — `400` | Per-buyurtma hisob-kitobi **yo'q**: naqd topshirilgandan keyin ham rollback ishlaydi; balans manfiy bo'lishi mumkin (BeePost sizga qarzdor) | Balans manfiy bo'lishini ko'taradigan qiling. `paid`/`partly_paid` → `400` qoidasi bir xil |
| A16 | Qisman sotuv bilan bog'liq rollback | — | Qisman sotuvdan ajralgan qism (`parent_order_id` bor) — `400`; sotilmagan qismi `cancelled` emas yoki allaqachon qaytarilgan qisman sotuv — `400` | Bunday tuzatishni BeePost operatori qiladi |
| A17 | `partly_sold` qo'shimcha shartlari | Qator `order_item_id` bo'yicha moslanadi | Qo'shimcha `400`: almashtirish buyurtmasi; bitta `product_id` ikki qatorda; tovar qatorlari yo'q (A11); `total_price` butun so'm emas; `items` da bitta buyurtma qatori ikki marta (masalan `order_item_id` va `product_id` bilan) | Bunday buyurtmani `sold`/`cancelled` qiling yoki operatorga murojaat qiling |
| A18 | Almashtirishda eski mahsulot | — | Almashtirish buyurtmasi sotilganda eski buyurtma avtomatik **sizning qaytarish pochtangizga** qo'shiladi (`/carrier/orders` da ko'rinmaydi) | Eski mahsulotni keyingi qaytarish bilan BeePost markaziga topshiring |
| A19 | Isbot (`proof`) | Sotuvchi talab qilsa majburiy (aks holda `400`); fayl saqlanadi | **Talab qilinmaydi**; yuborilsa bir xil qoidalar bilan tekshiriladi (`400`/`413`), lekin **saqlanmaydi** | Yo'q — Elchi kodi o'zgarishsiz ishlaydi |
| A20 | Kassa yozuvi vaqti | Bir necha soniya kechikadi (navbat) | Holat bilan **bir tranzaksiyada** | Yo'q |
| A21 | Kassa `source_type` | `sell`, `cancel`, `correction`, `courier_payment`, `extra_cost`, `payment_reversal` | `sell`, `correction` (rollback), `courier_payment`, `extra_cost`, `courier_penalty` (kechikish shtrafi/bonusi; Carrier akkaunt shtrafdan ozod, shuning uchun odatda chiqmaydi). `cancel` va `payment_reversal` yozilmaydi | Ro'yxat ochiq — noma'lum qiymatni "boshqa" deb qabul qiling |
| A22 | 504 | Ichki xizmat timeout'i | Faqat proksi timeout'i | Yo'q — ayni `Idempotency-Key` bilan qayta urinish qoidasi bir xil |
| A23 | `/carrier/*` dan tashqaridagi xato | — | Mavjud bo'lmagan yo'l, buzilgan JSON, 64 MB dan katta tana — BeePost'ning umumiy xato shakli (`code`/`trace_id` siz) bo'lishi mumkin | Qarorni `statusCode` ga qarab qiling |
| A24 | `X-Trace-Id` javob sarlavhasi | Hujjatlanmagan | `/carrier/*` xato javobida tanadagi `trace_id` bilan bir xil qiymat | Tanadagi `trace_id` ga tayaning — u ikkala tizimda bor |

### A.4 Ikkala tizimda ishlasangiz

- Ikki akkaunt va ikki kalit bo'ladi; integratsiya kodi bitta.
- Har posilkani **uni sizga bergan tizimga** yuboring. BeePost Elchi orqali
  jo'natgan posilkaning yorlig'i ikkala tizimda bir xil QR bilan bo'lishi
  mumkin: BeePost kaliti bilan u `404` beradi (posilka Elchi nazoratida),
  Elchi kaliti bilan esa — agar Elchi uni sizga biriktirgan bo'lsa — topiladi.
  Ishonchingiz komil bo'lmasa, ikkala tizimda ham skanerlang: ko'pi bilan
  bittasi `200` qaytaradi, ikkalasi ham qaytarmasa — operatorga murojaat
  qiling.
- Id formatlari har xil (UUID va raqam) — bir tizimning id'si ikkinchisiga
  tasodifan to'g'ri kelmaydi (`400`).
