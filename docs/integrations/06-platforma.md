# Integratsiya Platformasi — Qayerda Qurish va Qanday Qurish

> Hujjat turi: **implementatsiyadan oldingi arxitektura va strategiya rejasi**
> Sana: 2026-09-08 (2-tahrir) · Til: O'zbek · Holat: **REJA (kod yozilmagan)**
> Maqsad: har yangi hamkor (cargo · market · CRM) **kod yozmasdan**, faqat hujjat berib
> ulanadigan platforma — va u **qaysi tizimda** qurilishi kerakligi.

---

## 0. Xulosa (30 soniyada)

Ikkita savol bor edi. Birinchisi — **qanday qurish**: hamkorlar bir xil emas, shuning uchun
**3 rol × 2 rejim** taksonomiyasi (§1–§3). Bu javob **o'zgarmadi**.

Ikkinchisi — **qayerda qurish**. Elchi platformasi yaqin orada ishga tushadi va PCS mijozlari
o'sha yoqqa o'tishi mumkin. Shuning uchun ikkala tizimning integratsiya kodini o'qib chiqdim.
Natija kutilmagan bo'ldi:

> ### 🔑 Elchi'da **dvigatel** bor, lekin **kabina** yo'q.
> ### PCS'da **kabina** bor, lekin dvigatel **bitta provayderga** qattiq yozilgan.

| | PCS | Elchi |
|---|:---:|:---:|
| **Provayder-agnostik dispatch** (config bilan, kodsiz) | ❌ LDG qattiq yozilgan | ✅ **ishlaydi** |
| **Provayder-agnostik webhook** (har qanday imzo/payload) | ❌ faqat LDG | ✅ **ishlaydi** |
| Generik `buyurtma ↔ provayder posilkasi` bog'lami | ❌ | ✅ |
| Provayder bo'yicha COD qarz/hisob-kitob daftari | ❌ | ✅ |
| Hamkor bizga buyurtma push qilishi (Partner API) | ❌ | ✅ **ishlaydi** |
| **Operatsion kabina** (monitor · loglar · reconcile · bulk) | ✅ **yetuk** | ❌ **61 qator demo** |
| Dispatch buyurtma oqimiga ulangan | ✅ | ❌ **faqat qo'lda** |
| Mismatch aniqlash va hal qilish | ✅ | ❌ |

**Qaror: platforma ELCHI'da quriladi, PCS'da emas.** PCS'ga faqat Elchi bilan ko'prik yoziladi.

**Nima tejaydi:** 1-tahrirdagi PCS bosqichlari B va E (**10–12 dev-kun**) — ular Elchi'da
allaqachon mavjud narsani qayta yozgan bo'lar edi.

**Bonus:** PCS↔Elchi ko'prigi bir vaqtning o'zida **migratsiya ko'prigi** — market avval
faqat yetkazishni Elchi'ga beradi, keyin to'liq o'tadi.

**Ish hajmi:** A+B+C (ko'prik ishlaydi + Elchi'da kategoriya) **12–15 kun** ·
+D (Elchi operatsion jihatdan ishlatsa bo'ladigan) **20–25 kun** ·
+E (yangi cargo kodsiz ulanadi, isbotlangan) **23–29 kun**.

---

## 1. Uch rol — hamkor bizga kim bo'ladi

Hamkorlarni bitta "integratsiya" deb qarash — hozirgi PCS kodidagi asosiy xato, va aynan
shuning uchun har yangi hamkor yangi modul talab qilyapti.

| Rol | Yo'nalish | Ta'rif | Kimlar |
|---|---|---|---|
| **CARRIER** — yetkazuvchi | biz → hamkor | Bizning buyurtmamizni oladi va yetkazadi. Buyurtma bizniki bo'lib qoladi | LDG · Elchi · keyingi cargolar |
| **SOURCE** — manba | hamkor → biz | Bizga buyurtma beradi, biz yetkazamiz | do'konlar · marketplace · **CRM** |
| **MIRROR** — ko'zgu | biz → hamkor | Faqat hisobot oynasi, buyurtmaga ta'sir qilmaydi | Google Sheets · BI |

**CRM alohida rol emas** — SOURCE'ning kichik turi. Farqi faqat kirish triggerida: do'kon
buyurtmani yuboradi, CRM esa voronka bosqichi o'zgarganda signal beradi va biz to'liq yozuvni
o'zimiz olamiz. Dvigatel bitta, sozlash sehrgari boshqacha.

### Nega kategoriya kerak — imkoniyat matritsasi

| Imkoniyat | CARRIER | SOURCE | CRM | MIRROR |
|---|:---:|:---:|:---:|:---:|
| Bizga buyurtma kiritish | ❌ | ✅ | ✅ | ❌ |
| Ularga posilka yaratish | ✅ | ❌ | ❌ | ❌ |
| Status chiqarish (biz → ular) | 🟡 bekor | ✅ | ✅ | ✅ |
| Status qabul qilish (ular → biz) | ✅ | ❌ | ❌ | ❌ |
| Hudud moslash (SOATO) | ✅ | ✅ | ✅ | ❌ |
| COD qarz / hisob-kitob | ✅ | ❌ | ❌ | ❌ |
| Tarif boshqaruvi | ✅ | ❌ | ❌ | ❌ |
| Marketga bog'lash | ❌ | ✅ | ✅ | 🟡 |
| Dublikat tekshiruvi | ❌ | ✅ | ✅ | ❌ |
| Voronka bosqichi moslash | ❌ | ❌ | ✅ | ❌ |

---

## 2. Ikki rejim — kim kimga moslashadi

| Rejim | Kim moslashadi | Qanday | Vaqt |
|---|---|---|---|
| **SPEC** | **Ular** bizning kontraktni bajaradi | `PCS_CARRIER_API.md` / `PCS_SOURCE_API.md` beriladi | **soatlar, kodsiz** |
| **ADAPTER** | **Biz** ularga config-profil bilan moslashamiz | endpoint shablon · maydon/status mapping · imzo sxemasi | kunlar |

ADAPTER rejimi majburiy: Bitrix24 va amoCRM bizning kontraktimizni **bajarmaydi**, ularga
biz moslashamiz. Eski cargolarning ham o'z API'si bor.

**Muhim:** ADAPTER rejimi Elchi'da **allaqachon to'liq implementatsiya qilingan** (§4).

---

## 3. Yangi hamkor qancha vaqtda ulanadi

| Hamkor turi | Rejim | Bizning ish | Vaqt |
|---|---|---|---|
| Cargo — kontraktimizni bajaradi | SPEC | Config | **~2 soat, kodsiz** |
| Cargo — o'z API'si bor | ADAPTER | Profil + test | ~3–5 kun |
| Do'kon — bizga push qiladi | SPEC | Kalit + config | **~1 soat, kodsiz** |
| Do'kon — biz tortamiz | SPEC (pull) | Config | ~1 kun, kodsiz |
| CRM (Bitrix, amoCRM) | ADAPTER | Bir marta adapter, keyin config | 4–6 kun → ~1 kun |

---

## 4. Ikki tizimning haqiqiy holati (kod o'qib tasdiqlangan)

### Elchi — dvigatel tayyor va generik

`external_integrations` jadvali **provayder-agnostik dvigatel**:

| Ustun | Nima beradi | Implementatsiya |
|---|---|---|
| `dispatch_config` | `endpoint` · `method` · `headers` · **`body_template` `{{maydon}}` interpolyatsiya bilan** · `response_paths` | ✅ `integration-service.service.ts:3590`, `interpolate():1116` |
| `webhook_payload_paths` | Har qanday provayder payload'idan nuqta-yo'l bilan maydon o'qish | ✅ `:3166` |
| `inbound_status_mapping` | Provayder statusi → ichki status + amal (`sell`/`cancel`/`return`) | ✅ `:3548` |
| `webhook_signature_header` · `_prefix` · `_algorithm` · `_id_header` | Har qanday HMAC sxemasini **config bilan** tekshirish | ✅ `:3020` |
| `webhook_secret` + `_previous` | AES-shifrlangan, rotatsiya oynasi bilan | ✅ |
| `field_mapping` · `status_mapping` · `status_sync_config` | Chiquvchi status sinxroni | ✅ |

Yordamchi jadvallar — **hammasi provayderdan qat'i nazar generik**:

| Jadval | Vazifasi |
|---|---|
| `provider_shipments` | `buyurtma ↔ provayder posilkasi` (unique `order_id`), xom + moslangan status |
| `provider_receivables` | Provayder yig'gan COD — **bizga qancha qarz**. `PENDING → SETTLED / CANCELLED`, idempotent |
| `provider_remittances` | Provayder to'lovi — qarzlarni yopadi (aniq ro'yxat yoki FIFO) |
| `provider_webhook_logs` | Kiruvchi webhook auditi + `(integration_id, delivery_id)` unique → replay himoyasi |
| `sync_queue` | Chiquvchi navbat — buyurtma amallari **va** generik `create/update/delete` |
| `partners` · `partner_shipment_refs` · `partner_market_refs` | **SOURCE roli** — hamkor bizga push qiladi (Partner API) |

Yo'llar: `POST /webhooks/:slug` (generik qabul) · `POST /integrations/:slug/dispatch` (generik
jo'natish) · `GET /integrations/receivables` · `POST /integrations/:id/remittances`.

### Elchi — kabina yo'q

`Elchi-Frontend/src/pages/integrations-ops/index.tsx` — **61 qator**: bitta debitorlik jadvali
va bitta sync tugmasi. Coverage-demo sahifasi. **Haqiqiy integratsiya boshqaruvi UI'si yo'q.**

Bundan tashqari **dvigatel buyurtma oqimiga ulanmagan**: `dispatchShipment` faqat qo'lda
HTTP chaqiruv orqali ishga tushadi — hech bir avtomatik trigger uni chaqirmaydi.

### PCS — kabina yetuk, dvigatel tor

| Bor | Izoh |
|---|---|
| Sync monitor (statistika · barchasi · failed · pending · retry · bulk-retry · o'chirish) | 14 endpoint + modal UI |
| Webhook log ko'ruvchi (filtr · payload · reprocess · o'chirish) | LDG paneli |
| Jo'natmalar paneli (pending/error/delivered/**mismatch** filtri) | LDG paneli |
| Reconcile (provayder bilan tenglashtirish) · bitta shipment sync | LDG paneli |
| Bulk redispatch (server-side, persistent, progress, to'xtatish) | LDG paneli |
| Sozlama checklisti + tayyorlik dashboardi | `GET /ldg/admin/health` |
| Virtual kuryer yaratish/biriktirish | `external_provider` ustuni |
| Skaner/QR orqali tashqi buyurtma qabuli | today-orders `external` tabi |

Lekin bularning **deyarli hammasi LDG'ga qattiq yozilgan** — ikkinchi provayder uchun
qayta ishlatilmaydi.

> **Xulosa:** Elchi'ning 57 ta "PCS-only" integratsiya funksiyasi — bu **arxitektura emas,
> operatsion qatlam**. Arxitekturada Elchi oldinda.

---

## 5. Strategik qaror — platforma qayerda quriladi

**Elchi'da.** Uch sabab:

1. **Kelajak o'sha yerda.** Elchi platformasi ishga tushadi, mijozlar o'tadi. PCS'ga
   qurilgan platforma migratsiyadan keyin tashlab yuboriladigan ish bo'ladi.
2. **Dvigatel allaqachon Elchi'da** va u PCS'nikidan **arxitekturaviy kuchliroq** (§4).
   PCS'da qurish = mavjud, ishlaydigan narsani noldan qayta yozish.
3. **PCS'ning qimmatli qismi — operatsion kabina**, va u **ko'chiriladi**. Kabina UI +
   admin endpointlar; ular Elchi dvigateli ustiga qo'yiladi.

### PCS bilan nima bo'ladi

| | Qaror |
|---|---|
| Mavjud integratsiyalar (LDG · tashqi do'konlar) | **Saqlanadi va ishlaydi** — tegilmaydi |
| Yangi integratsiya platformasi | ❌ **Qurilmaydi** (1-tahrirdagi B va E bosqichlari bekor) |
| Elchi bilan ko'prik | ✅ **Quriladi** — bu ham migratsiya yo'li |
| Yangi cargo/market so'ralsa | Elchi orqali ulanadi |

### Migratsiya ko'prigi — qo'shimcha qiymat

PCS↔Elchi ko'prigi bir vaqtning o'zida **bosqichma-bosqich ko'chish yo'li**:

```
1-bosqich   Market PCS'da qoladi, faqat YETKAZISH Elchi'ga beriladi
            (PCS operatori "Elchi" kuryerini tanlaydi)
                              ↓
2-bosqich   Market Elchi'da akkaunt oladi, buyurtmalar ikkalasida ko'rinadi
                              ↓
3-bosqich   Market to'liq Elchi'ga o'tadi, PCS'dan chiqadi
```

Ko'prik bo'lmasa ko'chish "bir kunda hammasi" bo'ladi — mijoz uchun xavfli.

---

## 6. ⚠️ Hal qilinishi kerak — ikki xil pul modeli

Ikkala tizim provayder yetkazganda pulni **butunlay boshqacha** hisoblaydi. Carrier
kontraktini yozishdan oldin bittasi tanlanishi shart.

| | PCS modeli | Elchi modeli |
|---|---|---|
| Provayder = | **Virtual kuryer** (`external_provider`) | Hech kim — status-only |
| Yetkazganda | `sellOrder` ishlaydi → **kassaga pul tushadi** | Kassaga **hech narsa tushmaydi** |
| Qarz qayerda | Aniq daftar **yo'q** | `provider_receivables` — `PENDING` qator |
| Hisob-kitob | Alohida, qo'lda | `provider_remittances` → qarzlarni yopadi (FIFO) |

**Tavsiya: Elchi modeli.** Sabablari:
- Pul haqiqatda hali bizda emas — provayderda. PCS modeli **mavjud bo'lmagan pulni kassaga
  yozadi**, bu esa kassa balansini haqiqatdan uzoqlashtiradi.
- Qarz aniq daftar bilan kuzatiladi va rekonsiliatsiya qilinadi.
- `05-elchi.md` §05 dagi "bitta PCS marketi" qarori shu modelga to'g'ri o'tiradi.

> PCS'dagi LDG virtual-kuryer modeli **o'zgartirilmaydi** — u prod'da ishlayapti.
> Qaror faqat **yangi carrier kontrakti** uchun.

---

## 7. Bosqichlar

| | Bosqich | Qayerda | Kun |
|---|---|---|---|
| **A** | **Elchi sinxronlik nuqsonlari** — G1·G2·G3·G4 (`05-elchi.md` §03). Darhol boshlanadi, boshqasiga bog'liq emas | Elchi BE | **3–4** |
| **B** | **Elchi: kategoriya reestri + dispatch triggeri.** `external_integrations`ga `category` (`carrier`/`source`/`mirror`) + `mode` (`spec`/`adapter`); dispatch'ni buyurtma oqimiga ulash (hozir faqat qo'lda); pul modeli qarorini (§6) kodga tushirish | Elchi BE | **4–5** |
| **C** | **PCS ↔ Elchi ko'prigi.** PCS tomonida Elchi konnektori (posilka yaratish · bekor · webhook qabuli · SOATO moslash · rekonsiliatsiya CRON) | PCS | **5–6** |
| | | | ⬆ **To'xtash 1: 12–15 kun — ko'prik ishlaydi, Elchi'da kategoriya bor** |
| **D** | **Elchi operatsion kabinasi** — PCS'dan ko'chiriladi: sync monitor · webhook log ko'ruvchi · jo'natmalar paneli · reconcile · **mismatch** · bulk redispatch · health checklist. Endi **provayderdan qat'i nazar** | Elchi BE+FE | **8–10** |
| | | | ⬆ **To'xtash 2: 20–25 kun — Elchi operatsion jihatdan ishlatsa bo'ladigan** |
| **E** | **Carrier onboarding.** `PCS_CARRIER_API.md` e'loni + **LDG'ni Elchi'ga faqat config bilan ulash** — abstraksiyaning haqiqiy sinovi (kod yozilmasligi kerak) | Elchi | **3–4** |
| | | | ⬆ **To'xtash 3: 23–29 kun — yangi cargo kodsiz ulanadi, isbotlangan** |
| **F** | CRM adapterlari (Bitrix24 · amoCRM) — rejalari tayyor | Elchi | har biri 4–6 |
| **G** | Mirror (Google Sheets) — rejasi tayyor | Elchi | 3–4 |

**Tavsiya:** hozir **A + B + C** ni tasdiqlang. D — Elchi ishga tushishidan oldin majburiy
(kabinasiz operatorlar integratsiyani boshqara olmaydi). E — birinchi tashqi cargo so'ralganda.

**Kritik yo'l:** A va B parallel ketishi mumkin (turli odam). C — B tugagach.

---

## 8. Xavflar

| Xavf | Ehtimol | Ta'sir | Yumshatish |
|---|---|---|---|
| **Elchi dvigateli real provayderda sinalmagan** — hozir hech kim ulanmagan | **Yuqori** | Yuqori | E bosqichida LDG'ni config bilan ulash — abstraksiyaning haqiqiy sinovi. Muammo chiqsa D dan oldin tuzatiladi |
| Ikki pul modeli aralashib ketadi | O'rta | **Kritik** | §6 qarori B bosqichida kodga tushiriladi; PCS LDG modeliga tegilmaydi |
| Elchi kabinasiz ishga tushadi | **Yuqori** | Yuqori | D bosqichi Elchi ishga tushishidan **oldin** bajarilishi shart |
| PCS integratsiyalari e'tibordan chetda qoladi | O'rta | O'rta | PCS'da faqat saqlash rejimi — yangi funksiya yo'q, lekin buzilgani tuzatiladi |
| Migratsiya ko'prigi ikki tomonda ikki xil holat yaratadi | O'rta | Yuqori | `05-elchi.md` §06 — 5 qatlamli himoya + rekonsiliatsiya CRON majburiy |
| Kategoriya modeli noto'g'ri chiqadi | Past | O'rta | Kategoriya = `external_integrations`ga 2 ustun; qaytarish arzon |

---

## 9. Sizdan javob kerak

| # | Savol | Tavsiya |
|---|---|---|
| **P1** | Qaysi to'xtash nuqtasi tasdiqlanadi — 1, 2 yoki 3? | **A+B+C** (12–15 kun), keyin qayta baholash |
| **P2** | Elchi platformasi qachon ishga tushadi? | **D bosqichini shunga qarab rejalashtiramiz** — kabinasiz ishga tushirish xavfli |
| **P3** | Pul modeli — Elchi'ning qarz daftari tanlanadimi? (§6) | **Ha** — kassaga mavjud bo'lmagan pul yozilmasligi uchun |
| **P4** | PCS'da yangi integratsiya so'rovi kelsa nima qilamiz? | Elchi orqali ulash; PCS = saqlash rejimi |
| **P5** | LDG oxir-oqibat Elchi'ga ko'chadimi yoki PCS'da qoladimi? | E bosqichida **config bilan sinov** — natijaga qarab qaror |

---

## Havolalar

- Elchi integratsiyasi va topilgan nuqsonlar (A va C bosqichlari): [`05-elchi.md`](05-elchi.md)
- Mavjud shared outbound taklifi: [`00-umumiy-arxitektura.md`](00-umumiy-arxitektura.md) §1.2
- CRM rejalari (F): [`01-bitrix24.md`](01-bitrix24.md) · [`02-amocrm-kommo.md`](02-amocrm-kommo.md)
- Sheets rejasi (G): [`03-google-sheets.md`](03-google-sheets.md)
- Elchi Partner API (SOURCE roli): `Elchi-Backend/docs/PARTNER_API.md`
- PCS↔Elchi funksional taqqoslash: `Elchi-Backend/docs/comparison/PCS_vs_ELCHI_FUNKSIONAL_TAQQOSLASH.md`
