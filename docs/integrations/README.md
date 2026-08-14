# Integratsiya Rejalari — Bitrix24, amoCRM/Kommo, Google Sheets

> Post Control System'ni 3 ta tashqi tizim bilan integratsiya qilish uchun **implementatsiyadan oldingi to'liq reja to'plami**.
> Sana: 2026-07-25 · Til: O'zbek · Holat: **REJA (kod yozilmagan)** — biznes qarorlaridan keyin implementatsiya boshlanadi.

---

## Bu papkada nima bor

| Hujjat | Nima haqida | Kim uchun |
|---|---|---|
| **[00-umumiy-arxitektura.md](00-umumiy-arxitektura.md)** | Uchala tizimni bog'lovchi **yagona integratsiya qatlami** qarori, taqqoslash jadvali, umumiy komponentlar, rollout ketma-ketligi, umumiy xavflar | **Avval shuni o'qing** — arxitektura qarori |
| **[01-bitrix24.md](01-bitrix24.md)** | Bitrix24 to'liq rejasi (13 bo'lim) — **CRM = buyurtma manbai** (inbound intake asosiy + outbound feedback) | Bitrix ustida ishlaydigan dasturchi |
| **[02-amocrm-kommo.md](02-amocrm-kommo.md)** | amoCRM/Kommo to'liq rejasi (13 bo'lim) — **CRM = buyurtma manbai** (inbound intake asosiy + outbound feedback) | amoCRM ustida ishlaydigan dasturchi |
| **[03-google-sheets.md](03-google-sheets.md)** | Google Sheets to'liq rejasi (13 bo'lim) — **faqat outbound** hisobot/oyna | Sheets ustida ishlaydigan dasturchi |
| **[04-intake-texnik-eslatmalar.md](04-intake-texnik-eslatmalar.md)** | CRM→buyurtma intake implementatsiyasi uchun texnik ground-truth (`receiveExternalOrders`, `ldg-webhook`, SOATO, kod file:line) | CRM intake yozadigan dasturchi |

Har bir tizim rejasi bir xil 13-bo'limli tuzilishga ega: maqsad/yo'nalish · ma'lumot oqimi · auth · arxitekturaga ulanish · field/status mapping · API chaqiruvlari · kod hook nuqtalari · ishonchlilik · xavfsizlik · bosqichma-bosqich joriy etish · sinov · xavflar/savollar · ish hajmi bahosi.

---

## Asosiy xulosa (30 soniyada)

**Model:** CRM'lar (Bitrix24, amoCRM/Kommo) — **buyurtma manbai**. Buyurtma CRM'da yaratiladi va "dostavkaga chiqarildi" bo'lganda Post Control System'ga **yangi buyurtma bo'lib tushadi** (inbound intake — asosiy oqim, mavjud `receiveExternalOrders` naqshi). PCS yetkazishni boshqaradi va statusni CRM'ga **qaytaradi** (outbound feedback), shunda CRM-operatorlari kuzatadi. Intakedan keyin PCS = **yetkazish avtoriteti** (CRM'dagi keyingi o'zgarishlar qayta sinxronlanmaydi; idempotent: 1 CRM yozuvi = 1 buyurtma). **Google Sheets** — faqat outbound hisobot/oyna (manba emas). Har bir tizim: *maxsus adapter (`ldg-cargo` uslubi) + umumiy durable navbat (`integration-sync` naqshi)*.

| O'lchov | Bitrix24 | amoCRM/Kommo | Google Sheets |
|---|---|---|---|
| **Yo'nalish** | **Ikki tomonlama:** CRM→biz intake (asosiy) + biz→CRM feedback | **Ikki tomonlama:** CRM→biz intake (asosiy) + biz→CRM feedback | **Faqat outbound** (hisobot/oyna) |
| **Auth** | Inbound webhook URL + read `crm.deal.get` (kod=secret, muddatsiz) | Long-lived Bearer token (refresh yo'q) | Service-account JSON → JWT |
| **Intake trigger** | `ONCRMDEALUPDATE` → STAGE=«dostavka» | `status_lead` → status=«dostavka» | — (manba emas) |
| **Obyekt** | Deal (bitim) + Contact + productrows | Lead (bitim) + Contact | Jadval qatori (row) |
| **Intake idempotentlik** | `deal_link` UNIQUE (1 deal=1 buyurtma) | `lead_link` UNIQUE (1 lead=1 buyurtma) | `row_map` (order→qator) |
| **Rate limit** | ~2 req/s (batch bilan) | ~7 req/s (IP bo'yicha) | 60/min per-user (SA=1 user) |
| **MVP (0+1 intake)** | ~9–14 dev-kun | ~9–13 dev-kun | ~6–9 dev-kun |

**Tavsiya etilgan tartib:** avval **umumiy Bosqich 0** (poydevor: config, navbat, webhook-receiver, log) → so'ng birinchi CRM'ning **inbound intake**i (CRM'dan buyurtma tushishi — asosiy biznes qiymati) → **outbound feedback** (status qaytishi) → ikkinchi CRM → **Google Sheets** (hisobot). Batafsil: [00-umumiy-arxitektura.md](00-umumiy-arxitektura.md).

---

## ✅ Biznes qarorlari (tasdiqlandi — 2026-07-25)

| # | Qaror | Tanlov | Arxitekturaga ta'siri |
|---|---|---|---|
| **Q1** | Tenancy | **Per-market** — har market o'z akkaunti bilan ulanadi | Har tizim `market_id` FK + slug (`external_integration` uslubi). Yagona umumiy akkaunt YO'Q; har market o'z credential'ini admin panelda kiritadi. amoCRM: har market o'z long-lived tokenini beradi → **OAuth kerak emas**. Sheets: bitta platforma SA, har market o'z jadvalini share qiladi. |
| **Q2** | Yo'nalish | **CRM = buyurtma manbai** (CRM→biz intake asosiy + biz→CRM feedback); Google Sheets faqat outbound | Buyurtma CRM'da yaratiladi; "dostavkaga chiqarildi" bo'lganda bizga inbound tushadi (asosiy). Biz statusni CRM'ga qaytaramiz (feedback). Intakedan keyin CRM o'zgarishlari bizga ta'sir qilmaydi (idempotent: 1 CRM yozuvi = 1 buyurtma). CRM'lar = ikki tomonlama; Sheets = outbound-only. |
| **Q3a** | Voronka bosqichlari | **To'liq 6 bosqich** (Yangi→Qabul→Yo'lda→Kutilmoqda→Sotildi/Bekor) | To'liq lifecycle mirror boshidan — barcha status-hook nuqtalari (Bosqich 1+2) yoqiladi. |
| **Q3b** | Maydonlar | **Barchasi** — mijoz(ism+tel), manzil+tuman, summa+№, kuryer+mahsulotlar | To'liq field mapping (har rejaning §5). |
| **Q4** | Maxfiylik | To'liq PII tashqariga chiqadi | Himoya: per-market izolyatsiya (har market faqat o'z buyurtmasini ko'radi), shifrlangan secretlar, least-privilege scope, Sheet read-only. |

**Natijaviy scope:** *per-market · to'liq 6-bosqich · barcha maydon*. **Yo'nalish:** CRM'lar (Bitrix, amoCRM) ikki tomonlama — **inbound intake asosiy** (CRM=manba) + outbound feedback; **Google Sheets outbound-only**. Har rejaning boshida tuzatilgan yo'nalish banneri bor. Batafsil: [00-umumiy-arxitektura.md](00-umumiy-arxitektura.md) §"YO'NALISH TUZATILDI".

---

## Bu reja qanday tuzilgan (metodologiya)

- **Kodbaza xaritasi:** 5 ta agent mavjud `external-integration`, `integration-sync`, `ldg-cargo` modullarini, buyurtma hayotiy siklini (hook nuqtalari), config/secret/migration konvensiyalarini va cross-cutting infratuzilmani (activity-log, request-context, webhook xavfsizligi) o'rgandi.
- **API tadqiqoti:** 3 ta agent har bir tizimning **rasmiy hujjatlaridan** (URL bilan) auth, record CRUD, webhook, rate-limit ma'lumotlarini yig'di.
- **Adversarial tekshiruv:** har bir API dossier alohida agent tomonidan rasmiy hujjatga qarshi qayta tekshirildi (endpoint yo'llari, auth oqimi, token muddatlari, rate-limitlar). Uchala dossier ham **"high" ishonch** oldi; topilgan tuzatishlar rejalarga singdirilgan (masalan: Bitrix 480s qat'iy limit emas; amoCRM `retry_after=300` hujjatlashtirilgan + `User-Agent` shart; Google `googleapis` npm v173).

> Eslatma: kod ichidagi `method:line` havolalari tahlil paytidagi holatga tegishli — implementatsiyada aniqlashtiring.
