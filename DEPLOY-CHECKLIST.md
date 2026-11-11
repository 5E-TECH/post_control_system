# Prod deploy — tekshiruv ro'yxati

> Qamrov: **qo'shimcha xarajat (isbot + tasdiq)**, **marketplace integratsiyasi**,
> **SOATO ma'lumotnomasi**, **Carrier API (tashqi yetkazuvchi)**.
> Oxirgi yangilanish: 2026-11-10.

---

## 1. `.env` ga QO'SHILADI

### 1.1 `SECRET_ENC_KEY` — 🔴 SHART

```bash
SECRET_ENC_KEY=<kamida 32 belgi, tasodifiy>
```

> ⚠️ Eski nom `MARKETPLACE_SECRET_KEY` ham ishlaydi (zaxira sifatida
> o'qiladi), lekin u chalg'itadi: «qaysidir marketplace'ning siri»
> degandek o'qiladi. Yangi o'rnatishda `SECRET_ENC_KEY` ishlating.

**Bu HAMKORNING kaliti EMAS — bu BIZNING shifrlash kalitimiz.**

Hamkor bergan `api_key`, `signing_secret`, `inbound_api_key` lar
**UI'dan** kiritiladi va **bazada** (`marketplace_integration` ustunlari)
yotadi. `.env` ga hamkor haqida hech narsa yozilmaydi. Bu kalit esa
o'sha ustunlarni bazaga yozishdan oldin AES-256-GCM bilan shifrlaydi —
ya'ni baza = seyf, bu kalit = seyfning kaliti. Seyf kalitini seyf ichiga
qo'yib bo'lmaydi, shuning uchun u `.env` da turadi.

Bitta kalit BARCHA marketplace ulanishlari uchun. Hamkor almashsa ham,
yangi ulanish qo'shilsa ham — bu kalit o'zgarmaydi.

| Holat | Nima bo'ladi |
|---|---|
| Berilmasa | Sekretlar **ochiq matnda** saqlanadi. Tizim ishlaydi, lekin bazaga kirgan odam hamkor kalitlarini ko'radi |
| Keyin qo'yilsa | Ochiq matndagi eski qiymatlar o'qilaveradi, yangilari shifrlanadi — uzilish yo'q |
| **Qo'yilib, keyin YO'QOLSA** | 🔴 Shifrlangan sekretlar **butunlay o'qilmaydi**. Har so'rov «Sekret shifrlangan, lekin SECRET_ENC_KEY o'rnatilmagan» beradi va integratsiya to'xtaydi |

> ⚠️ Bu kalitni **zaxirada saqlang**. Lokal sinovda aynan shu yo'qolib,
> integratsiya butunlay ishlamay qolgan — sekretlarni qayta o'rnatishga
> to'g'ri kelgan.

Generatsiya: `openssl rand -hex 24`

### 1.2 `UPLOAD_ROOT` — 🔴 SHART (qo'shimcha xarajat isboti uchun)

```bash
UPLOAD_ROOT=/var/beepost/uploads
```

Kuryerning foto/video isbotlari shu yerga yoziladi
(`extra-cost-proofs/YYYY/MM/`) va vaqtinchalik fayllar `extra-cost-tmp/` ga.

| Talab | Sabab |
|---|---|
| **Deploy papkasidan TASHQARIDA** bo'lsin | `git clone` / `rsync --delete` / yangi reliz uni o'chirib yuboradi — market bilan kuryer o'rtasidagi bahsni hal qilib bo'lmay qoladi |
| Bitta fayl tizimida | `tmp → proofs` ko'chirish `rename` bilan bo'ladi; boshqa disk bo'lsa `EXDEV` xatosi |
| App foydalanuvchisiga yozish huquqi | `chown -R <app-user> /var/beepost/uploads` |
| **Zaxiraga kiritilsin** | Bu — moliyaviy bahs isboti |

Berilmasa: sayt ishlaydi, lekin kuryer isbot yuklolmaydi (aniq o'zbekcha xato
chiqadi, sotuv esa «isbot keyin biriktiriladi» holatida yopilaveradi).

### 1.3 `FFMPEG_PATH` — ⚪ ixtiyoriy

```bash
# faqat ffmpeg PATH da bo'lmasa
FFMPEG_PATH=/usr/bin/ffmpeg
```

### 1.4 Carrier API — ⚪ ixtiyoriy (sukut bilan ishlaydi)

Tashqi yetkazuvchi kompaniya `/api/v1/carrier/*` ni `X-Api-Key` bilan
chaqiradi (kontrakt: [`CARRIER_API.md`](CARRIER_API.md), ichki hujjat:
[`docs/integrations/15-carrier-api.md`](docs/integrations/15-carrier-api.md)).

**Kompaniya kaliti `.env` ga YOZILMAYDI** — u admin panelda
(`POST /api/v1/carrier-accounts`) yaratiladi, bazada faqat SHA-256 xeshi
turadi va bir marta ko'rsatiladi. `.env` da faqat rejim sozlamalari:

```bash
CARRIER_THROTTLE_LIMIT=120        # bitta akkaunt, barcha /carrier/* birgalikda
CARRIER_THROTTLE_TTL_MS=60000     # oyna, ms
CARRIER_IP_THROTTLE_LIMIT=600     # bitta IP, kalit tekshiruvidan OLDIN
CARRIER_DOCS_ENABLED=             # prod'da /api/v1/carrier-docs: true | 1 | yes
CARRIER_DOCS_USER=carrier         # Basic Auth login
CARRIER_DOCS_PASSWORD=            # Basic Auth paroli
```

| O'zgaruvchi | Sukut | Berilmasa / xato bo'lsa |
|---|---|---|
| `CARRIER_THROTTLE_LIMIT` | `120` | Bo'sh — sukut. `0`, manfiy yoki son bo'lmagan qiymat — sukut + startda bitta ogohlantirish (`[config] … musbat butun son emas`). Kontraktda "daqiqasiga 120" — o'zgartirsangiz provayderga ayting |
| `CARRIER_THROTTLE_TTL_MS` | `60000` | Xuddi shunday |
| `CARRIER_IP_THROTTLE_LIMIT` | `600` | Xuddi shunday. Kalitsiz/noto'g'ri kalitli oqimni bazaga va log'ga yetkazmaydi. Bitta chiquvchi IP ortida akkauntlar soni × 120 dan kam qo'ymang |
| `CARRIER_DOCS_ENABLED` | bo'sh | Prod'da Swagger **o'chiq**. Dev'da sukut bo'yicha ochiq |
| `CARRIER_DOCS_USER` | `carrier` | — |
| `CARRIER_DOCS_PASSWORD` | bo'sh | Prod'da `CARRIER_DOCS_ENABLED=true` bo'lsa ham sahifa **ulanmaydi** (ataylab yopiq) |

O'zgartirilgandan keyin servis qayta ishga tushirilishi kerak.

---

## 2. `.env` da BO'LMASLIGI kerak

| O'zgaruvchi | Nega |
|---|---|
| `MARKETPLACE_ALLOW_LOCAL_URL` | SSRF qo'riqchisini o'chiradi (`localhost`, ichki IP larga so'rov). **Faqat lokal mock uchun** |
| `TYPEORM_SYNCHRONIZE=true` | Sxemani avtomatik o'zgartiradi. `data-source.ts` da `synchronize: false` qat'iy, lekin baribir qo'yilmasin |

---

## 3. Server tayyorgarligi

### 3.1 ffmpeg

```bash
apt-get install -y ffmpeg && ffmpeg -version
```

Yo'q bo'lsa video **siqilmasdan** saqlanadi (`transcode_status = 'skipped'`) —
fatal emas, faqat disk ko'proq band bo'ladi.

### 3.2 nginx — yuklash hajmi

Isbot so'rovi **120 MB** gacha bo'lishi mumkin (5 tagacha fayl).
nginx'ning standart chegarasi 1 MB.

```nginx
location /api/v1/extra-cost/ {
    client_max_body_size 128m;
    proxy_request_buffering off;   # katta faylni diskka bufferlamaydi
    proxy_read_timeout 300s;
    proxy_pass http://127.0.0.1:<PORT>;
}
```

### 3.3 nginx — haqiqiy IP (audit jurnali uchun)

`/api/` blokida bo'lishi shart, aks holda jurnalda hamma IP `127.0.0.1`
bo'lib qoladi (kodda `trust proxy: loopback` allaqachon o'rnatilgan):

```nginx
proxy_set_header X-Real-IP        $remote_addr;
proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

### 3.4 Papka

```bash
mkdir -p /var/beepost/uploads
chown -R <app-user>:<app-group> /var/beepost/uploads
```

### 3.5 nginx — Carrier API (`/api/v1/carrier/`) — 🔴 SHART (Carrier API yoqilsa)

Ikki sabab:

1. **Isbot fayli 50 MB gacha** (`proof`, multipart) — nginx'ning standart
   chegarasi 1 MB. 64 MB — fayl + multipart qo'shimchasi uchun zaxira.
   Undan katta tana nginx'ning o'zidan 413 oladi (JSON emas — kontrakt
   ilovasida yozilgan).
2. **IP ro'yxati** (`ip_allowlist`) mijoz IP'siga tayanadi. Carrier blokida
   `X-Forwarded-For` uzatilmasa har so'rov `127.0.0.1` dan ko'rinadi va IP
   ro'yxati bor akkauntning HAMMA so'rovi 403 bo'ladi.

   ⚠️ Bu yagona xavf EMAS. nginx `location` prefiksi registrga sezgir,
   Express marshrutlari esa yo'q: `/api/v1/CARRIER/ping` carrier blokini
   chetlab umumiy `/api/` blokiga tushardi. U blok `X-Forwarded-For` ni qayta
   yozmasa, mijoz yuborgan sarlavha o'zgarmay keladi va ilova uni haqiqiy IP
   deb oladi — ya'ni xato sozlama "hammasi 403" (yopiq) emas, **soxta IP
   o'tadi** (ochiq). Ilova buni o'zi yopadi (kanonik bo'lmagan yo'l → `404`,
   smoke #19), lekin baribir `proxy_set_header X-Forwarded-For
   $proxy_add_x_forwarded_for;` ni `server {}` darajasida ham va `/api/`
   blokida ham yozing — boshqa ilova qismlari ham `req.ip` ga tayanadi.

```nginx
location /api/v1/carrier/ {
    client_max_body_size 64m;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    proxy_pass http://127.0.0.1:<PORT>;   # /api/ bloki bilan AYNI upstream
}
```

> ⚠️ nginx'da ichki `location` da **bitta** `proxy_set_header` yozilsa ham,
> tashqi (`server`) darajadagi `proxy_set_header` lar MEROS BO'LMAYDI. Shu
> sabab hammasi shu blokda qayta yozilgan. `/api/` blokida boshqa
> sarlavhalar ham bo'lsa — ularni ham ko'chiring.

> ⚠️ `X-Forwarded-For` ni soxtalashtirib bo'lmaydi: `$proxy_add_x_forwarded_for`
> mijoz yuborgan qiymat OXIRIGA haqiqiy manzilni qo'shadi, ilova esa
> (`trust proxy: loopback`) faqat nginx qo'shgan oxirgi manzilga ishonadi.
> Kod `CF-Connecting-IP` ni ATAYLAB o'qimaydi. Kelajakda Cloudflare (yoki
> boshqa CDN) qo'yilsa `$remote_addr` CDN manzili bo'lib qoladi — avval
> nginx `real_ip` modulini sozlang, aks holda IP ro'yxatlari buziladi.

`/api/v1/carrier-docs` (Swagger) alohida blok talab qilmaydi — u oddiy
`/api/` bloki orqali o'tadi (`/api/v1/carrier/` prefiksiga tushmaydi).

---

## 4. Migratsiyalar

```bash
npm run migration:run
```

Qo'llanadiganlar (prod holatiga qarab):

| # | Migratsiya | Nima qiladi |
|---|---|---|
| 1 | `ExtraCostApproval` | Tasdiqlash oqimi jadvallari |
| 2 | `ExtraCostRequestDetails` | So'rov tafsilotlari |
| 3 | `ExtraCostDetailsBackfill` | Eski yozuvlarni to'ldirish |
| 4 | `ExtraCostProofTranscode` | Video siqish holati |
| 5 | `MarketplaceIntegration` | Marketplace 8 jadvali |
| 6 | `MarketplaceStatusMap` | Status lug'ati + sessiya indeksi |
| 7 | `SoatoDistrictsBackfill` | 26 ta tuman/shahar (faqat `INSERT`) |
| 8 | `OrderOperatorAssignment` | Operator biriktirish ustunlari + eski buyurtmalar backfill'i |
| 9 | `RollbackCorrectionSourceType` | `cashbox_history.source_type` ga `rollback_correction` qiymati |
| 10 | `OrderMarketNet` | `order.market_net` (ishorali) + qisman indeks; backfill `= to_be_paid` |
| 11 | `OrderMarketSettled` | `order.market_settled` (ishorali); backfill `= paid_amount` |
| 12 | `CarrierApi` (`1751100000000`) | `carrier_account` + `carrier_idempotency_key` jadvallari (tashqi yetkazuvchi kalitlari va `Idempotency-Key` daftari) |

`CarrierApi` xavfsizligi: faqat ikkita YANGI jadval yaratadi
(`CREATE TABLE/INDEX IF NOT EXISTS`); mavjud jadvallarga tegmaydi — yagona
bog'lanish `carrier_account.courier_user_id → users(id)` FK. Backfill yo'q,
pulga tegmaydi, kassa invariantlariga ta'sir qilmaydi. `down()` ikkala
jadvalni o'chiradi va bog'langan kuryerlarning
`users.external_provider = 'carrier'` qiymatini `NULL` ga qaytaradi:
barcha carrier kalitlari va idempotentlik daftari **yo'qoladi** — faqat
deploy muvaffaqiyatsiz bo'lsa ishlating. Kuryerlarning tasodifiy paroli
qaytarilmaydi (ular baribir kira olmaydi — kerak bo'lsa admin parolni
yangilaydi).

`SoatoDistrictsBackfill` xavfsizligi: faqat qo'shadi, mavjud qatorlarga
tegmaydi (sha256 barmoq izi bilan tekshirilgan), idempotent, `down()` faqat
ishlatilmagan qatorni o'chiradi.

`OrderOperatorAssignment` xavfsizligi: ustunlar `IF NOT EXISTS`;
`order.operator_id` va uning indeksi ham shu yerda kafolatlanadi (ular
bazada tarixan `synchronize` orqali paydo bo'lgan, migratsiyasi yo'q edi
— prod'da bo'lmasligi mumkin). Backfill eski buyurtmalarni «qabul
qilingan» deb belgilaydi.

`RollbackCorrectionSourceType` xavfsizligi: faqat enum qiymati
QO'SHILADI (`ADD VALUE IF NOT EXISTS`), ishlatilmaydi — shuning uchun
PG 12+ da tranzaksiya ichida xavfsiz. `down()` ataylab bo'sh: Postgres
enum qiymatini o'chirishni qo'llab-quvvatlamaydi.

`OrderMarketNet` / `OrderMarketSettled` xavfsizligi: ikkala backfill ham
HOZIRGI qiymatni ko'chiradi (`to_be_paid` / `paid_amount`), QAYTA
HISOBLAMAYDI. Ya'ni eski buyurtmalar va to'lov navbati AYNAN hozirgidek
qoladi — tuzatish faqat YANGI sotuvlarga ta'sir qiladi. Bu ataylab
(qaror 2026-09-23: mavjud tafovut migratsiya bilan to'g'rilanmaydi).

⚠️ MAVJUD TAFOVUT SAQLANADI. 2026-09-16 dan beri to'plangan farq
(dev bazada ~5,9 mln) o'z-o'zidan yopilmaydi. Shu sabab
`db:check-market-settlement` deploy'da STRICT emas, `--snapshot` /
`--compare` rejimida ishlaydi: halt faqat YANGI farq paydo bo'lsa.

⚠️ Deploydan keyin TEKSHIRING:
```sql
SELECT count(*) FROM "order"
 WHERE operator_id IS NOT NULL
   AND operator_accepted_at IS NULL
   AND deleted_at IS NULL;          -- ⚠️ o'chirilganlar hisobga olinmaydi
```
Natija `0` bo'lishi kerak. Aks holda operator sahifasi butun tarix bilan
«Sizga biriktirilgan» bo'lib to'lib ketadi.

⚠️ `deleted_at IS NULL` SHART: o'chirilgan buyurtmalar ham
`operator_accepted_at IS NULL` bo'lishi mumkin (deploydan keyin
biriktirilib, keyin o'chirilgan bo'lsa) — ular operator ekranida
KO'RINMAYDI, lekin bu shartsiz so'rov soxta ogohlantirish beradi.

---

## 5. Deploydan keyin

| # | Tekshiruv |
|---|---|
| 1 | Sayt ochiladi, kirish ishlaydi |
| 2 | `Integratsiyalar → Marketplace` — ulanish yaratiladi, «Ulanish» va «Imzo» tugmalari yashil |
| 3 | Kuryerdan qo'shimcha xarajat: foto yuklash ishlaydi (413 xatosi bo'lmasin) |
| 4 | Audit jurnalida IP `127.0.0.1` emas, haqiqiy IP |
| 5 | Yangi tumanlar ro'yxatda: Nukus shahri, Termiz shahri, Urganch shahri |
| 6 | Buyurtma formasida operator tanlovi (operatorli marketda) chiqadi |
| 7 | Yuqoridagi SQL (§4 oxiri, `deleted_at IS NULL` bilan) → `0` |
| 8 | O'chirilgan operator kira OLMAYDI (login 400) |
| 9 | Marketni bloklang → uning operatori kira OLMASLIGI kerak (login 400) |
| 10 | Marketni blokdan chiqaring → operator yana kiradi; ALOHIDA bloklangan operator esa bloklanganicha qoladi |
| 11 | `npm run db:check-market-settlement` — farqlar ro'yxati deploydan OLDINGI bilan bir xil (yangi farq YO'Q) |
| 12 | Bitta marketga to'liq to'lov: kassadagi summa kiritilsa BARCHA buyurtma `PAID` bo'lishi kerak. Eski buyurtmalarda tafovut saqlanadi — bu kutilgan |
| 13 | 0 so'mlik yoki tarifdan arzon buyurtma sotilsa: `market_net` MANFIY bo'ladi (`SELECT market_net FROM "order" WHERE ...`) — bu to'g'ri, market farqni qoplaydi |
| 14 | Carrier jadvallari bor: `SELECT to_regclass('carrier_account'), to_regclass('carrier_idempotency_key');` — ikkalasi ham `NULL` emas |
| 15 | `curl -i https://<domain>/api/v1/carrier/ping` (kalitsiz) → `401` va JSON'da `trace_id`. HTML yoki `404` bo'lsa — nginx bloki (§3.5) yoki modul ulanmagan |
| 16 | IP tekshiruvi (staging, sinov akkaunti): `ip_allowlist` ga ataylab boshqa IP qo'yib `ping` → `403` xabaridagi IP sizning haqiqiy IP'ingiz bo'lishi kerak. `127.0.0.1` bo'lsa — nginx `X-Forwarded-For` uzatmayapti. So'ng `-H 'X-Forwarded-For: <ro'yxatdagi IP>'` bilan ham `403` va xabarda o'sha haqiqiy IP bo'lishi kerak |
| 17 | Prod'da `CARRIER_DOCS_*` berilmagan bo'lsa `https://<domain>/api/v1/carrier-docs` ochilMAYDI; berilgan bo'lsa login/parol so'raydi |
| 18 | `verify` job'ida `💼 Carrier API testlari (BLOKLOVCHI)` yashil |
| 19 | Registr chetlab o'tishi yopiq: `curl -i -H 'X-Forwarded-For: 203.0.113.10' -H 'X-Api-Key: <sinov kaliti>' https://<domain>/api/v1/CARRIER/ping` → `404` va JSON'da `trace_id` (`200`/`403` bo'lsa — ilova eski versiyada) |

---

## 6. Bilib qo'yish kerak (bloker emas)

| Holat | Ta'siri |
|---|---|
| Marketlarda `telegram_id` yo'q | 🟡 **Tekshiring.** Dev bazada 13 marketdan 0 tasida bor. Zaxira yo'l (`notifyMarketUsers`) market yoki uning **operatoriga** yuboradi — ikkalasida ham `telegram_id` bo'lmasa **hech qanday xabar bormaydi**. Tizim yiqilmaydi va tasdiqlash panel orqali ishlayveradi, lekin market so'rovdan **o'zi panelga kirmaguncha xabardor bo'lmaydi**. Bog'lash: market egasi order-botga market tokenini + telefonini yuboradi |
| Yangi tumanlarga kuryer biriktirilmagan | Posilka **qabul qilinadi**, lekin kuryer qo'lda tayinlanadi |
| Marketplace kontrakti hali hamkorga berilmagan | `MARKETPLACE_PARTNER_API.md` (v1.1) va PDF tayyor |
| Market bloklansa mavjud sessiya DARHOL uzilmaydi | `JwtGuard` bazaga qaramaydi, token 1 kun yashaydi. Lekin frontend interceptori birinchi 401 da `/user/refresh` ga boradi, u ham rad etadi → foydalanuvchi login sahifasiga chiqariladi. Ya'ni amalda keyingi so'rovdayoq uziladi |
| Carrier kuryeri kuryer tanlash ro'yxatlarida ko'rinadi | Super-kuryer bo'lsa — har hududda. Xodim unga ichki pochtani adashib jo'natmasligi uchun nomini aniq qo'ying (masalan `[Carrier] <kompaniya>`). Admin UI hali yo'q — akkauntlar API orqali boshqariladi |
| Carrier rate limit xotirada | Akkaunt limiti ham, kalitdan oldingi IP limiti ham. Bitta `nestapp` jarayoni uchun to'g'ri. Bir nechta instans/cluster qilinsa limit instanslar soniga ko'payadi |
| `GET /api/v1/order/qr-code/:token` autentifikatsiyasiz | Oldindan bor muammo (guard izohga olingan). Carrier API'ning "begona buyurtma — 404" va'dasini chetlab o'tadi. Alohida vazifada yopiladi |
| Testlar parallel ishlaganda beqaror | Bu mashinada `npx jest` har safar BOSHQA to'plamni yiqitadi (alohida esa o'tadi). `npx jest --maxWorkers=2` bilan 883/883. Resurs raqobati, koddagi muammo emas |
