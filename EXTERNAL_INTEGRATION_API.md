# Post Control System — Tashqi Sayt Integratsiya Hujjati

> Bu hujjat tashqi sayt (internet-do'kon) dasturchilari uchun mo'ljallangan.
> Post Control System bilan integratsiya qilish uchun tashqi sayt **3 ta endpoint** tayyorlashi kerak.

---

## Umumiy Arxitektura

```
┌──────────────────────┐                    ┌──────────────────────┐
│   POST CONTROL       │                    │   TASHQI SAYT        │
│   SYSTEM             │                    │   (Sizning tizim)    │
│                      │                    │                      │
│  1. Login so'rovi ──────────────────────► │  /auth/login         │
│                      │  ◄──────────────── │  (token qaytaradi)   │
│                      │                    │                      │
│  2. QR qidiruv ─────────────────────────► │  /qrorder/find       │
│                      │  ◄──────────────── │  (buyurtma qaytaradi)│
│                      │                    │                      │
│  3. Status yangilash ────────────────────►│  /orders/{id}/status │
│                      │  ◄──────────────── │  (natija qaytaradi)  │
└──────────────────────┘                    └──────────────────────┘
```

---

## Autentifikatsiya

Post Control System sizning API ga har safar so'rov yuborishdan oldin **token** oladi.
Siz **ikkita usuldan birini** tanlashingiz mumkin:

### Variant A: Login orqali (Tavsiya etiladi)

Biz sizning login endpointingizga so'rov yuboramiz va javobdan tokenni olamiz.
Token 55 daqiqa cache qilinadi, keyin yangi token olinadi.

**Endpoint:** `POST {auth_url}`

**Request:**
```json
{
  "username": "post_control",
  "password": "sizning_parol"
}
```

**Response (kutilayotgan format):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

> **Muhim:** Response body da `token` nomli field bo'lishi SHART.
> Token JWT yoki boshqa format bo'lishi mumkin — biz uni faqat `Authorization: Bearer {token}` sifatida ishlatamiz.

### Variant B: Statik API Key

Agar login tizimingiz bo'lmasa, bizga doimiy API key berishingiz mumkin.
Biz uni `Authorization: Bearer {api_key}` sifatida har bir so'rovda yuboramiz.

---

## Endpoint #1: QR Kod Orqali Buyurtma Qidirish

Bu endpoint orqali operatorlar QR kodni skanlab, tashqi saytdagi buyurtmani tizimga tortib oladi.

### So'rov

```
POST {api_url}/qrorder/find
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "qr_code": "ABC123XYZ"
}
```

| Field    | Turi   | Tavsif                           |
|----------|--------|----------------------------------|
| qr_code  | string | Buyurtmaning QR kodi yoki unikal identifikatori |

### Javob (Response)

Buyurtma topilganda **bitta buyurtma yoki buyurtmalar massivi** qaytaring.
Quyidagi fieldlar kerak (field nomlari moslashtirish mumkin, pastda tushuntirilgan):

```json
{
  "id": 12345,
  "qrCode": "ABC123XYZ",
  "full_name": "Aliyev Vali Saliyevich",
  "phone": "+998901234567",
  "additional_phone": "+998991112233",
  "region": "1727",
  "district": "1727401",
  "address": "Toshkent sh., Yunusobod t., 4-mavze, 15-uy",
  "comment": "Eshik oldiga qo'ying",
  "total_price": 250000,
  "delivery_price": 30000,
  "total_count": 3,
  "items": [
    { "name": "Futbolka", "quantity": 2, "price": 100000 },
    { "name": "Shapka", "quantity": 1, "price": 50000 }
  ],
  "created_at": "2026-02-15T10:30:00Z"
}
```

### Fieldlar Jadvali

| # | Field              | Turi     | Majburiy | Tavsif                                              |
|---|--------------------|----------|----------|------------------------------------------------------|
| 1 | `id`               | number/string | **Ha** | Buyurtmaning sizning tizimdagi unikal ID si         |
| 2 | `qrCode`           | string   | Ha       | Buyurtmaga biriktirilgan QR kod                      |
| 3 | `full_name`        | string   | Ha       | Mijoz to'liq ismi                                    |
| 4 | `phone`            | string   | **Ha**   | Mijoz telefon raqami (format: +998XXXXXXXXX)         |
| 5 | `additional_phone` | string   | Yo'q     | Qo'shimcha telefon raqam                             |
| 6 | `region`           | string   | Yo'q     | Viloyat SOATO kodi (masalan: "1727")                 |
| 7 | `district`         | string   | **Ha**   | Tuman SOATO kodi (masalan: "1727401")                |
| 8 | `address`          | string   | Yo'q     | To'liq manzil                                        |
| 9 | `comment`          | string   | Yo'q     | Buyurtma bo'yicha izoh                               |
| 10| `total_price`      | number   | **Ha**   | Mahsulotlar umumiy narxi (so'mda)                   |
| 11| `delivery_price`   | number   | Yo'q     | Yetkazib berish narxi (so'mda). 0 yoki bo'sh bo'lsa, hisobga olinmaydi |
| 12| `total_count`      | number   | Yo'q     | Mahsulotlar umumiy soni (default: 1)                 |
| 13| `items`            | array    | Yo'q     | Mahsulotlar ro'yxati (hozirda faqat saqlash uchun)   |
| 14| `created_at`       | string   | Yo'q     | Buyurtma yaratilgan sanasi                           |

### Xatolik Javoblari

Buyurtma topilmaganda:
```json
// HTTP 404
{
  "message": "Buyurtma topilmadi",
  "error": "Not Found"
}
```

---

## Endpoint #2: Buyurtma Statusini Yangilash

Bu eng muhim endpoint. Buyurtma holati o'zgarganda biz **real-time** sizning tizimingizga xabar beramiz.

### Qachon chaqiriladi?

| Hodisa                   | Biz yuboradigan status  | Tavsif                              |
|--------------------------|------------------------|--------------------------------------|
| Buyurtma **sotildi**     | `completed`            | Mijozga topshirildi                  |
| Buyurtma **bekor qilindi** | `cancelled`          | Buyurtma bekor qilindi               |
| Buyurtma **to'landi**    | `paid`                 | To'lov qabul qilindi                 |
| Buyurtma **qaytarildi**  | `returned`             | Kutish holatiga qaytarildi           |
| Buyurtma **kutilmoqda**  | `pending`              | Yetkazish kutilmoqda                 |

> **Eslatma:** Status nomlari moslashtirish mumkin. Agar sizning tizimda boshqa nomlar ishlatilsa
> (masalan `delivered` o'rniga `completed`), biz uni sozlashda o'zgartiramiz.

### So'rov

```
PUT {api_url}/orders/{id}/status
```

Yoki (sizning API dizayningizga qarab):
```
PATCH {api_url}/orders/{id}/status
POST  {api_url}/orders/{id}/status
```

> `{id}` — sizning tizimdagi buyurtma ID si (yuqoridagi `id` field qiymati, masalan: `12345`).

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "status": "completed"
}
```

| Field    | Turi   | Tavsif                                        |
|----------|--------|-----------------------------------------------|
| status   | string | Yangi status qiymati (yuqoridagi jadvaldan)   |

### Muqobil Variant (agar URL da ID bo'lmasa)

Agar sizning API `{id}` ni URL da qabul qilmasa, body da ham yuborish mumkin:

```
POST {api_url}/orderstatus/update
```

```json
{
  "order_id": 12345,
  "status": "completed"
}
```

> Bu holatda biz `include_order_id_in_body: true` va `order_id_field: "order_id"` deb sozlaymiz.

### Muvaffaqiyatli Javob

```json
// HTTP 200
{
  "success": true,
  "message": "Status yangilandi"
}
```

Yoki istalgan HTTP 2xx javob — biz faqat status kodini tekshiramiz.

### Xatolik Javoblari

```json
// HTTP 404 — buyurtma topilmadi
{
  "message": "Order not found"
}

// HTTP 401 — token muddati tugagan (biz avtomatik yangi token olib qayta urinib ko'ramiz)
{
  "message": "Unauthorized"
}

// HTTP 400 — noto'g'ri so'rov
{
  "message": "Invalid status value"
}
```

### Retry Mexanizmi

Agar sizning server javob bermasa yoki xatolik qaytarsa, biz avtomatik qayta urinib ko'ramiz:

| Urinish | Kutish vaqti | Holat                     |
|---------|-------------|----------------------------|
| 1-chi   | Darhol      | Birinchi so'rov             |
| 2-chi   | 1 daqiqa    | 1-chi retry                 |
| 3-chi   | 5 daqiqa    | 2-chi retry                 |
| 4-chi   | 15 daqiqa   | Oxirgi retry                |
| —       | —           | `failed` deb belgilanadi    |

> HTTP 401 xatolikda token cache tozalanadi va yangi token bilan qayta uriniladi.

---

## Endpoint #3: Login (Agar Variant A tanlansa)

### So'rov

```
POST {auth_url}
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "post_control",
  "password": "kelishilgan_parol"
}
```

### Muvaffaqiyatli Javob

```json
// HTTP 200
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Turi   | Tavsif                              |
|-------|--------|-------------------------------------|
| token | string | Bearer token (JWT yoki boshqa)      |

> Biz tokenni 55 daqiqa saqlaimiz. 55 daqiqadan keyin yoki 401 xatolik olganimizda yangi token so'raymiz.

---

## Field Nomlari Moslashtirish (Field Mapping)

Agar sizning API dagi field nomlari bizning standartdan farq qilsa, moslashtirish mumkin.
Masalan, sizning API quyidagi formatda javob bersa:

```json
{
  "order_number": 999,
  "barcode": "ABC123",
  "client": {
    "name": "Aliyev Vali",
    "mobile": "+998901234567"
  },
  "delivery_address": "Toshkent, Yunusobod",
  "amount": 350000
}
```

Biz field mapping ni quyidagicha sozlaymiz:

| Bizning field        | Sizning field         | Izoh                               |
|---------------------|-----------------------|-------------------------------------|
| id_field            | `order_number`        | Buyurtma ID si                      |
| qr_code_field       | `barcode`             | QR kod / shtrix kod                 |
| customer_name_field | `client.name`         | Ichki (nested) object ham bo'ladi   |
| phone_field         | `client.mobile`       | Nuqta (`.`) orqali nested field     |
| district_code_field | `district_code`       | SOATO tuman kodi                    |
| address_field       | `delivery_address`    | Manzil                              |
| total_price_field   | `amount`              | Narx                                |

> **Muhim:** Nested objectlar nuqta (`.`) orqali ko'rsatiladi.
> Masalan `client.name` — bu `{ "client": { "name": "..." } }` degani.

---

## Status Mapping Moslashtirish

Agar sizning tizimdagi status nomlari biznikidan farq qilsa:

| Bizning holat  | Default qiymat | Sizning tizimga moslashtirish |
|---------------|---------------|-------------------------------|
| Sotildi       | `completed`   | Masalan: `delivered`, `done`  |
| Bekor qilindi | `cancelled`   | Masalan: `canceled`, `rejected` |
| To'landi      | `paid`        | Masalan: `payment_received`   |
| Qaytarildi    | `returned`    | Masalan: `refunded`, `rollback` |
| Kutilmoqda    | `pending`     | Masalan: `waiting`, `in_delivery` |

> Sizga qulay qiymatlarni ayting, biz sozlashda o'zgartiramiz.

---

## Texnik Talablar

### Sizning API ga bo'lgan talablar:

| # | Talab                            | Tushuntirish                                      |
|---|----------------------------------|---------------------------------------------------|
| 1 | **HTTPS** ishlatish              | Barcha endpointlar HTTPS orqali bo'lishi kerak    |
| 2 | **JSON** format                  | Request va Response lar JSON formatda              |
| 3 | **Bearer Token** autentifikatsiya | `Authorization: Bearer {token}` header qabul qilish |
| 4 | **Timeout**: 15 soniya            | Biz 15 soniyadan keyin so'rovni uzib qo'yamiz     |
| 5 | **UTF-8** encoding               | O'zbek harflari uchun UTF-8 qo'llab-quvvatlash   |
| 6 | HTTP status kodlar               | 2xx = muvaffaqiyat, 4xx = client xatolik, 5xx = server xatolik |

### SOATO Tuman Kodlari

Tuman kodi (district code) — bu O'zbekiston Respublikasi SOATO klassifikatori bo'yicha tuman/shahar kodi.
Masalan:
- `1727401` — Toshkent shahri, Yunusobod tumani
- `1703` — Toshkent viloyati
- `1712` — Samarqand viloyati

> Agar sizda SOATO kodlari bo'lmasa, biz default tumanga biriktiramiz.
> Lekin to'g'ri yetkazish uchun SOATO kodlarini ishlatish tavsiya etiladi.

---

## Xulosa: Sizdan Kerak Bo'lgan Narsalar

### Minimal (faqat status sync):

| # | Nima kerak                                      |
|---|--------------------------------------------------|
| 1 | Status yangilash endpoint (PUT/PATCH/POST)       |
| 2 | Auth usuli (API key yoki login endpoint + credentials) |
| 3 | Sizning tizimdagi status nomlari ro'yxati        |

### To'liq integratsiya:

| # | Nima kerak                                      |
|---|--------------------------------------------------|
| 1 | **Login endpoint** + username/password           |
| 2 | **QR qidiruv endpoint** (buyurtma ma'lumotlarini qaytaradi) |
| 3 | **Status yangilash endpoint**                    |
| 4 | Buyurtma response dagi **field nomlari** ro'yxati |
| 5 | Sizning tizimdagi **status nomlari** ro'yxati    |
| 6 | **API base URL** (masalan: `https://api.yoursite.uz`) |
| 7 | **Auth URL** (masalan: `https://api.yoursite.uz/auth/login`) |

---

## Misol: To'liq Integratsiya Oqimi

```
1. AUTENTIFIKATSIYA
   POST https://api.yoursite.uz/auth/login
   Body: { "username": "post_control", "password": "secret123" }
   Response: { "token": "eyJhbG..." }

2. QR KOD ORQALI BUYURTMA QIDIRISH
   POST https://api.yoursite.uz/qrorder/find
   Headers: Authorization: Bearer eyJhbG...
   Body: { "qr_code": "ABC123" }
   Response: { "id": 12345, "full_name": "Aliyev Vali", "phone": "+998901234567", ... }

3. BUYURTMA STATUSINI YANGILASH (buyurtma sotilganda)
   PUT https://api.yoursite.uz/orders/12345/status
   Headers: Authorization: Bearer eyJhbG...
   Body: { "status": "completed" }
   Response: { "success": true }
```

---

## Savollar bo'lsa

Agar savollaringiz bo'lsa yoki field nomlarini moslashtirish kerak bo'lsa,
Post Control System administratoriga murojaat qiling.

Biz sizning API formatiga to'liq moslasha olamiz — faqat yuqoridagi
3 ta endpointni tayyorlashingiz kifoya!
