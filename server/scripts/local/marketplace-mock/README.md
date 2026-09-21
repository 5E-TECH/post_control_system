# Marketplace Mock — kontrakt tekshiruvchisi

> BeePost ↔ Marketplace kontraktining **marketplace tomoni**.
> Kontrakt: [`MARKETPLACE_PARTNER_API.md`](../../../../MARKETPLACE_PARTNER_API.md) ·
> Reja: [`docs/integrations/14-marketplace-beepost.md`](../../../../docs/integrations/14-marketplace-beepost.md)

## Nima uchun kerak

Ikki vazifasi bor:

1. **BeePost tomonini ularni kutmasdan yozish.** Marketplace dasturchilari hali
   boshlamagan bo'lsa ham, biz 0–3 bosqichni to'liq qura va sinay olamiz.
2. **Kontrakt tekshiruvchisi.** Mock shunchaki `200` qaytarmaydi — kontraktdagi
   har bir MUST qoidasini tekshiradi va buzilganini hisobotda ko'rsatadi.

> ### Eng qimmatli qismi — daftar solishtiruvi
> Mock balansni **mustaqil** hisoblaydi va har hodisadagi `ledger.balance_after`
> bilan solishtiradi. Ikki daftar ajralsa — **shu yerda** ushlanadi, prod'da emas.

Bog'liqlik **yo'q** (faqat Node standart kutubxonasi) — marketplace dasturchilari
uni o'z tizimlari uchun **boshlang'ich namuna** sifatida ham ishlatishi mumkin.

---

## Ishga tushirish

```bash
node server/scripts/local/marketplace-mock/server.js
```

```
╭──────────────────────────────────────────────────────────╮
│  MARKETPLACE MOCK — BeePost kontrakti (marketplace tomoni)│
╰──────────────────────────────────────────────────────────╯
   manzil      http://localhost:4010
   API kalit   mock-marketplace-key
   sekret      mock-secret-v1
   tarif       markaz 50000 / uy 70000
   chaos       off
   posilkalar  11 ta · sotuvchilar 4 ta
```

### Sozlamalar (ENV)

| O'zgaruvchi | Default | Izoh |
|---|---|---|
| `MP_PORT` | `4010` | Port |
| `MP_API_KEY` | `mock-marketplace-key` | `X-Api-Key` qiymati |
| `MP_SECRET` | `mock-secret-v1` | HMAC sekreti (`v1`) |
| `MP_SECRET_PREV` | — | Eski sekret (`v2`) — **kalit aylantirish sinovi** |
| `MP_TOLERANCE` | `300` | Imzo vaqt oynasi (soniya) |
| `MP_TARIFF_CENTER` | `50000` | Kelishilgan tarif — mock buni tekshiradi |
| `MP_TARIFF_HOME` | `70000` | ″ |
| `MP_CHAOS` | `off` | `off` · `slow` · `500` · `down` |

---

## Kontrakt tekshiruvlari

Mock quyidagilarni **avtomatik** ushlaydi:

| Kod | Nima ushlanadi | Daraja |
|---|---|:---:|
| `LEDGER_DRIFT` | `ledger.balance_after` mockning mustaqil hisobiga mos emas | 🔴 |
| `MONEY_FORMULA` | `net ≠ collected − beepost_fee − extra_cost` | 🔴 |
| `TARIFF_MISMATCH` | `beepost_fee` kelishilgan tarifga teng emas | 🔴 |
| `ACCEPTED_VOIDED` | BeePost ular bekor qilgan posilkani qabul qildi | 🔴 |
| `NO_BALANCE_AFTER` | `ledger.balance_after` yuborilmadi | 🟠 |
| `SEQ_GAP` | `seq` uzilishi — hodisa yo'qolgan | 🟠 |
| `TERMINAL_OVERWRITE` | Terminal holat ustiga yozildi | 🟠 |
| `PARTIAL_MULTIBOX` | Ko'p qutili buyurtma chala qabul qilindi | 🟠 |
| `UNKNOWN_PARCEL` | Noma'lum posilka bo'yicha hodisa | 🟠 |

Va MUST qoidalarini **majburlaydi**:

| Qoida | Xulq |
|---|---|
| Imzo majburiy (`POST`) | Imzosiz/yomon imzo → **401**, `ping`dan tashqari |
| Vaqt oynasi 300s | Eski `t` → **401** |
| Ikki kalitli aylantirish | **Har kalit har maydonga** (`v1` VA `v2`) — pozitsion EMAS. Bu qoida shu mock bilan e2e sinovda topilgan: pozitsion tekshiruvda aylantirish har safar uziladi |
| `event_id` dedup | Takror → `200 {applied:false, reason:"DUPLICATE"}` |
| `seq` tartibi | Eskirgan → `200 {applied:false, reason:"STALE_SEQ", current_seq}` |
| `batch_id` idempotentligi | Ayni batch → **ayni javob**, holat o'zgarmaydi |
| Manfiy `net` (prepaid) | **Qabul qilinadi** — rad etilmaydi |
| `lookup` yon ta'siri | Status **o'zgarmaydi** |

---

## Sinov posilkalari

Ro'yxat tasodifiy emas — rejaning §15 chekka holatlar katalogidan olingan.

| QR token | Nima sinaladi |
|---|---|
| `UZM-8842-1` | Oddiy COD sotuv (asosiy yo'l) |
| `UZM-9100-1/2/3` | **Ko'p qutili buyurtma** — pul faqat 1-qutida |
| `UZM-9200-1` | **Prepaid** (`cod_amount = 0`) → `net` **manfiy** |
| `UZM-9300-1` | **COD tarifdan kam** (30 000 < 50 000) → `net` manfiy |
| `UZM-9400-1` | **Qisman sotuv** — `items[]` bilan |
| `UZM-9500-1` | **`VOIDED`** — PCS qabul qilmasligi shart |
| `UZM-9600-AbCdEf` | **Aralash registrli QR** — normalizatsiya sinovi |
| `UZM-9700-1` | **Noma'lum sotuvchi** — reestrda yo'q |
| `UZM-9800-1` | **Uyga yetkazish** — 70 000 tarif |

---

## Hisobot

```bash
curl -s -H "x-api-key: mock-marketplace-key" localhost:4010/_mock/report | jq
```

```json
{
  "balance": 100000,
  "by_seller": { "SLR-77": 150000, "SLR-81": -50000 },
  "counters": { "lookup": 6, "accept": 2, "events": 5, "duplicates": 1, "stale": 1 },
  "issues": [],
  "verdict": "KONTRAKT BUZILMADI ✅"
}
```

Tozalash (sinovlar orasida):

```bash
curl -s -H "x-api-key: mock-marketplace-key" localhost:4010/_mock/reset
```

---

## Chaos rejimi

Skan oqimining xato ishlashini sinash uchun (`parcels/lookup` ga qo'llanadi):

| Rejim | Nima bo'ladi | Nimani sinaydi |
|---|---|---|
| `MP_CHAOS=500` | `lookup` → **500** | ⚠️ PCS buni «topilmadi» demasligi va **bo'sh buyurtma yaratmasligi** shart |
| `MP_CHAOS=slow` | `lookup` **12 soniya** kutadi | 15s timeout + operator UI |
| `MP_CHAOS=down` | Ulanish **uziladi** | Circuit breaker — 3 ketma-ket xatodan keyin navbat to'xtashi shart |

```bash
MP_CHAOS=500 node server/scripts/local/marketplace-mock/server.js
```

> Imzo tekshiruvi chaos'dan **oldin** ishlaydi — ya'ni yomon imzo chaos rejimida
> ham **401** qaytaradi, `500` emas.

---

## BeePost tomonini ulash

Marketplace integratsiyasi qurilgach, sozlamaga shuni kiriting:

| Maydon | Qiymat |
|---|---|
| `api_base_url` | `http://localhost:4010` |
| `api_key` | `mock-marketplace-key` |
| `signing_secret` | `mock-secret-v1` |
| `tariff_center` / `tariff_home` | `50000` / `70000` |

Keyin odatdagidek: skanerlash sahifasini oching → yuqoridagi QR tokenlarni
kiriting → «Qabul qilish» → sotuv/bekor/rollback qiling → `/_mock/report` da
hukmni ko'ring.

---

## Marketplace dasturchilari uchun

Bu mock — **sizning tizimingiz nima qilishi kerakligining ishlaydigan namunasi**.
`server.js` ichida har bir MUST qoidasi izoh bilan belgilangan:

- imzo tekshiruvi — `verifySignature()` (xom tanadan, `timingSafeEqual`)
- `event_id` dedup va `seq` tartibi — `handleEvents()`
- `batch_id` idempotentligi — `handleAccept()`
- daftar va manfiy summa — `applyMoney()`

Uni o'z tilingizga ko'chirishingiz yoki mantiqni namuna sifatida olishingiz mumkin.
