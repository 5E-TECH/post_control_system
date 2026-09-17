# Marketplace — qo'lda sinov yo'riqnomasi

> Marketplace tomonini **kutish shart emas**: mock server kontraktning
> ularning tomonini to'liq bajaradi. Real skaner bilan uchdan-uchiga
> sinash HOZIR mumkin.

---

## 1. Tayyorgarlik (bir marta)

### 1.1 Migratsiya

```bash
cd server
npm run migration:run
```

Ikkita migratsiya qo'llanadi: `MarketplaceIntegration` (8 jadval) va
`MarketplaceStatusMap` (status lug'ati + sessiya unique indeksi).

### 1.2 `.env`

```bash
# Sekretlarni bazada shifrlash (AES-256-GCM). Busiz ulanishni YOQIB
# BO'LMAYDI — sozlash ekranida qizil band ko'rinadi.
MARKETPLACE_SECRET_KEY=<kamida 16 belgi, tasodifiy satr>

# ⚠️ FAQAT LOKAL SINOV UCHUN. Mock `localhost` da turadi, SSRF
# qo'riqchisi esa ichki manzillarni to'sadi. PROD'da BO'LMASIN.
MARKETPLACE_ALLOW_LOCAL_URL=1
```

### 1.3 Mock serverni ishga tushirish

```bash
node server/scripts/local/marketplace-mock/server.js
```

```
   manzil      http://localhost:4010
   API kalit   mock-marketplace-key
   sekret      mock-secret-v1
   tarif       markaz 50000 / uy 70000
   posilkalar  11 ta · sotuvchilar 4 ta
```

### 1.4 QR varaqni bosib chiqarish

```bash
node server/scripts/local/marketplace-mock/print-qr.js
```

`qr-varaq.html` yasaladi — brauzerda oching va bosib chiqaring.
Har kartada posilka **nima sinayotgani** yozilgan.

---

## 2. Sozlash (brauzerda)

**Integratsiyalar → Marketplace → Sozlamalar**

1. **«Ulanish yaratish»**
   - Nomi: `UzMarket (sinov)`
   - Slug: `uzmarket`
   - Market: marketplace uchun ochilgan market akkaunti
   - API manzili: `http://localhost:4010`
   - Tarif: markaz `50000`, uy `70000`

2. **Kalitlar** (Ulanish sozlamalari kartasi)
   - «Ularning API kaliti» → `mock-marketplace-key` → **Saqlash**

3. **Imzo sekreti** — mock `mock-secret-v1` ni kutadi. Aylantirish
   tugmasi tasodifiy sekret beradi, shuning uchun sinov uchun uni
   bazadan qo'yish osonroq:
   ```sql
   UPDATE marketplace_integration
      SET signing_secret = 'mock-secret-v1'
    WHERE slug = 'uzmarket';
   ```

4. **Kiruvchi kalit** → «Aylantirish» (qiymati muhim emas, shunchaki
   bo'lishi kerak)

5. **«Holat» kartasi** — checklist to'lganini tekshiring, so'ng
   **master kalitni YOQING**

6. Ikki tugma bilan tekshiring:
   - **«Ulanish»** → `Ulanish bor — N ms`
   - **«Imzo»** → `Imzo qabul qilindi` ⚠️ bu ikkinchisi muhim: ping
     imzolanmaydi, imzo xato bo'lsa faqat birinchi sotuvda bilinardi

---

## 3. Skan va qabul (real skaner)

**Chap menyu → «Marketplace qabuli»**

- Kursor QR maydonida turadi, skaner klaviatura kabi ishlaydi
- Bosib chiqarilgan varaqdan ketma-ket skanerlang

| QR | Nima bo'lishi kerak |
|---|---|
| `UZM-8842-1` | Oddiy qo'shiladi, «tayyor» |
| `UZM-9500-1` | **RAD ETILADI** — ular bekor qilgan (`VOIDED`) |
| `UZM-9100-1..3` | Uchalasi kerak; ikkitasini skanerlab qabul qilsangiz **«chala buyurtma»** ogohlantirishi chiqadi va tugma bloklanadi |
| `UZM-9200-1` | Prepaid — «oldindan to'langan» yorlig'i, olinadigan 0 |
| `uzm-9600-abcdef` | Kichik harfda ham ishlaydi (normalizatsiya) |
| `UZM-9700-1` | Sotuvchi reestrda yo'q — sariq ogohlantirish, lekin qabul qilinadi |

**Tekshiring:** sahifani yangilang — ro'yxat **yo'qolmaydi** (holat
serverda). Bir posilkani ikki marta skanerlang — dublikat qo'shilmaydi.

**«Qabul qilish»** → buyurtma raqamlari chiqadi. Tugmani ikki marta
bosing — soni **o'zgarmaydi**.

---

## 4. Pul oqimi

1. **Pochta → kuryerga jo'natish** (odatdagi oqim)
2. **Kuryer** posilkaning QR'ini skanerlaydi → `waiting`
3. **Kuryer sotadi** (ortiqcha xarajat bilan ham sinab ko'ring)

Har qadamdan keyin uchta raqam **teng** bo'lishi kerak:

| Qayerda ko'riladi | Nima |
|---|---|
| Kassa → market kassasi | Bizning balans |
| Integratsiyalar → Marketplace → **Hisob-kitob** | «Marketplace'ga qarzimiz» |
| `curl -H "X-Api-Key: mock-marketplace-key" localhost:4010/_mock/report` | `balance` |

```bash
# Mock hisoboti — kontrakt buzilgan bo'lsa shu yerda ko'rinadi
curl -s -H "X-Api-Key: mock-marketplace-key" \
  http://localhost:4010/_mock/report | jq '{balance, verdict, issues}'
```

`verdict` **`KONTRAKT BUZILMADI ✅`** bo'lishi kerak.

---

## 5. Status lug'ati

**Sozlamalar → Status lug'ati**

Hamkorning qiymatlarini yozing (masalan `DELIVERED` → `7`) va saqlang.
Keyingi sotuvda hodisada **`7`** ketadi:

```bash
curl -s -H "X-Api-Key: mock-marketplace-key" \
  http://localhost:4010/_mock/report | jq '.parcels'
```

Bo'sh qoldirsangiz bizning nom ketaveradi — integratsiya baribir ishlaydi.

---

## 6. Nima sinalmaydi

| Nima | Nega |
|---|---|
| Ularning haqiqiy API'si | Mock kontraktni bajaradi, lekin ularning kodini emas. Ular tayyor bo'lgach sandbox'da qayta sinaladi |
| Ularning status qiymatlari | Hali noma'lum — shuning uchun lug'at qo'lda sozlanadigan qilingan |

---

## 7. Avtomatik sinov

```bash
cd server && npm run test:marketplace-e2e
```

38 test, ~10 soniya. **Alohida baza** (`pcs_e2e`) ishlatadi — dev bazaga
tegmaydi.
