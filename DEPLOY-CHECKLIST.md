# Prod deploy — tekshiruv ro'yxati

> Qamrov: **qo'shimcha xarajat (isbot + tasdiq)**, **marketplace integratsiyasi**,
> **SOATO ma'lumotnomasi**. Oxirgi yangilanish: 2026-09-18.

---

## 1. `.env` ga QO'SHILADI

### 1.1 `MARKETPLACE_SECRET_KEY` — 🔴 SHART

```bash
MARKETPLACE_SECRET_KEY=<kamida 32 belgi, tasodifiy>
```

Marketplace `api_key`, `signing_secret`, `inbound_api_key` larini bazada
AES-256-GCM bilan shifrlaydi.

| Holat | Nima bo'ladi |
|---|---|
| Berilmasa | Sekretlar **ochiq matnda** saqlanadi. Tizim ishlaydi, lekin bazaga kirgan odam hamkor kalitlarini ko'radi |
| Keyin qo'yilsa | Ochiq matndagi eski qiymatlar o'qilaveradi, yangilari shifrlanadi — uzilish yo'q |
| **Qo'yilib, keyin YO'QOLSA** | 🔴 Shifrlangan sekretlar **butunlay o'qilmaydi**. Har so'rov «Sekret shifrlangan, lekin MARKETPLACE_SECRET_KEY o'rnatilmagan» beradi va integratsiya to'xtaydi |

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

`SoatoDistrictsBackfill` xavfsizligi: faqat qo'shadi, mavjud qatorlarga
tegmaydi (sha256 barmoq izi bilan tekshirilgan), idempotent, `down()` faqat
ishlatilmagan qatorni o'chiradi.

`OrderOperatorAssignment` xavfsizligi: ustunlar `IF NOT EXISTS`;
`order.operator_id` va uning indeksi ham shu yerda kafolatlanadi (ular
bazada tarixan `synchronize` orqali paydo bo'lgan, migratsiyasi yo'q edi
— prod'da bo'lmasligi mumkin). Backfill eski buyurtmalarni «qabul
qilingan» deb belgilaydi.

⚠️ Deploydan keyin TEKSHIRING:
```sql
SELECT count(*) FROM "order"
 WHERE operator_id IS NOT NULL AND operator_accepted_at IS NULL;
```
Natija `0` bo'lishi kerak. Aks holda operator sahifasi butun tarix bilan
«Sizga biriktirilgan» bo'lib to'lib ketadi.

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
| 7 | `SELECT count(*) FROM "order" WHERE operator_id IS NOT NULL AND operator_accepted_at IS NULL` → `0` |
| 8 | O'chirilgan operator kira OLMAYDI (login 400) |

---

## 6. Bilib qo'yish kerak (bloker emas)

| Holat | Ta'siri |
|---|---|
| Marketlarda `telegram_id` yo'q | 🟡 **Tekshiring.** Dev bazada 13 marketdan 0 tasida bor. Zaxira yo'l (`notifyMarketUsers`) market yoki uning **operatoriga** yuboradi — ikkalasida ham `telegram_id` bo'lmasa **hech qanday xabar bormaydi**. Tizim yiqilmaydi va tasdiqlash panel orqali ishlayveradi, lekin market so'rovdan **o'zi panelga kirmaguncha xabardor bo'lmaydi**. Bog'lash: market egasi order-botga market tokenini + telefonini yuboradi |
| Yangi tumanlarga kuryer biriktirilmagan | Posilka **qabul qilinadi**, lekin kuryer qo'lda tayinlanadi |
| Marketplace kontrakti hali hamkorga berilmagan | `MARKETPLACE_PARTNER_API.md` (v1.1) va PDF tayyor |
