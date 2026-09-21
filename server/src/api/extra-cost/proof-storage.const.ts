import * as path from 'path';
import * as fs from 'fs';

/**
 * ISBOT FAYLLARI SAQLANADIGAN JOY — yagona manba.
 *
 * ⚠️ NEGA ALOHIDA KONSTANTA. Loyihada allaqachon shu xato bor: mahsulot
 * rasmlari `product.controller.ts:42` da `'home/ubuntu/uploads'` ga yoziladi,
 * `product.service.ts:343` esa o'chirishda yo'lni QAYTA yozadi. Ikki joy
 * ajralib ketsa, fayl "o'chirildi" deb ko'rinadi-yu diskda qolaveradi (yoki
 * aksincha — o'chirish umuman ishlamaydi). Yuklash, o'qish, o'chirish va
 * backup — to'rtalasi ham SHU konstantadan foydalanadi.
 *
 * ⚠️ NEGA MUTLAQ YO'L. `'home/ubuntu/uploads'` — NISBIY yo'l, ya'ni u
 * `process.cwd()` ga bog'liq. Server boshqa papkadan ishga tushirilsa
 * (pm2, systemd, cron), fayllar butunlay boshqa joyga tushadi va eski
 * fayllar "yo'qoladi".
 *
 * ⚠️ NEGA DEPLOY PAPKASIDAN TASHQARIDA. Isbot — pul nizosining YAGONA dalili.
 * U deploy papkasi ichida tursa, har `git clone` / `rsync --delete` / yangi
 * relizda o'chib ketadi va market bilan kuryer o'rtasidagi bahsni hal qilib
 * bo'lmay qoladi.
 */

/** Production'da SHART bo'lgan env o'zgaruvchisi nomi. */
export const UPLOAD_ROOT_ENV = 'UPLOAD_ROOT';

/**
 * ISBOT YUKLASH ENDPOINTI MAVJUDMI.
 *
 * Bosqich 3 dan boshlab `true`. Bu bayroq **serverni o'ldirmaydi** — u faqat
 * "sozlash xatosi endi haqiqiy ma'lumot yo'qotish xavfi" degani.
 *
 * ⚠️ NEGA ISHGA TUSHISHDA CRASH QILMAYMIZ. Prod `.env` da `UPLOAD_ROOT`
 * hali yo'q. Agar boot'da xato tashlansa, keyingi deploy butun SAYTNI
 * o'chirardi — holbuki muammo faqat bitta funksiyaga tegishli.
 *
 * O'rniga to'siq YUKLASH PAYTIDA turadi (`assertProofStorageUsable`):
 * sozlanmagan bo'lsa kuryer aniq o'zbekcha xato oladi, sotuvi esa
 * "isbot keyin biriktiriladi" holatida yopilaveradi. Ya'ni:
 *
 *   - sayt hech qachon o'chmaydi
 *   - isbot HECH QACHON yo'qoladigan joyga yozilmaydi
 *   - sotuv hech qachon yiqilmaydi
 */
export const PROOF_UPLOAD_ENABLED = true;

/**
 * Dev uchun zaxira yo'l. Production'da ISHLATILMAYDI — u yerda
 * `assertProofStorageConfigured()` serverni ko'tarmaydi.
 */
const DEV_FALLBACK = path.resolve(process.cwd(), '.uploads-dev');

/** Barcha yuklanadigan fayllar uchun ildiz (mutlaq yo'l). */
export const UPLOAD_ROOT: string = path.resolve(
  process.env[UPLOAD_ROOT_ENV] || DEV_FALLBACK,
);

/** Faqat qo'shimcha xarajat isbotlari. */
export const PROOF_DIR: string = path.join(UPLOAD_ROOT, 'extra-cost-proofs');

/**
 * YUKLANAYOTGAN fayl vaqtincha tushadigan joy.
 *
 * ⚠️ NEGA XOTIRA EMAS, DISK. Avval multer `memoryStorage()` ishlatardi va
 * bu 25 MB da maqbul edi. Endi bitta so'rov 120 MB gacha bo'lishi mumkin —
 * uni RAM'ga o'qish bir necha kuryer bir vaqtda yuklaganda serverni
 * o'ldirardi (OOM).
 *
 * ⚠️ NEGA `PROOF_DIR` ICHIDA EMAS. Orfan tozalash CRON'i `PROOF_DIR` ni
 * kezadi va `YYYY/MM` tuzilmasini kutadi; vaqtinchalik papka u yerda
 * bo'lsa chalkashardi. Lekin AYNI `UPLOAD_ROOT` ichida — shuning uchun
 * `rename` bitta fayl tizimida qoladi (boshqa diskka `rename` EXDEV
 * bilan yiqiladi).
 */
export const PROOF_TMP_DIR: string = path.join(UPLOAD_ROOT, 'extra-cost-tmp');

/**
 * FFMPEG — video siqish.
 *
 * ⚠️ SERVERDA BO'LISHI SHART, lekin YO'QLIGI FATAL EMAS. Topilmasa video
 * asl holida saqlanadi (`transcode_status = 'skipped'`) va tizim
 * ishlayveradi — faqat disk ko'proq band bo'ladi. Bu `UPLOAD_ROOT` bilan
 * bir xil printsip: sozlash kamchiligi SAYTNI o'chirmaydi.
 */
export const FFMPEG_BIN: string = process.env.FFMPEG_PATH || 'ffmpeg';

/**
 * Chiqish o'lchami — uzun tomon bo'yicha quti (px).
 *
 * 1280 quti 1920x1080 ni 1280x720 ga, 1080x1920 (tik telefon videosi) ni
 * esa 720x1280 ga tushiradi. Manba kichikroq bo'lsa KATTALASHTIRILMAYDI.
 */
export const PROOF_VIDEO_BOX_PX = 1280;

/**
 * H.264 sifat darajasi. 28 — isbot uchun yetarli ("chek o'qiladi"),
 * hajm esa manbadan 8-15 barobar kichik. 23 dan past qilish faylni
 * keraksiz kattalashtiradi.
 */
export const PROOF_VIDEO_CRF = 28;

/** Ovoz bitreyti (kbit/s). Kuryer gapirsa eshitilishi yetarli. */
export const PROOF_VIDEO_AUDIO_KBPS = 64;

/**
 * Bitta ffmpeg jarayoni uchun eng uzun vaqt.
 *
 * ⚠️ TIMEOUT SHART. Buzilgan yoki g'alati kodekli fayl ffmpeg'ni cheksiz
 * kuttirishi mumkin — jarayon esa serverning protsessorini band qilib
 * turardi.
 */
export const PROOF_TRANSCODE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Ruxsat etilgan RASM turlari.
 *
 * SVG va HTML ATAYLAB YO'Q: ular ichida skript bo'lishi mumkin va bizning
 * domenimizdan berilganda saqlangan XSS bo'lardi. GIF ham yo'q — u foto
 * isbot emas.
 */
export const PROOF_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/**
 * Ruxsat etilgan VIDEO turlari.
 *
 * ⚠️ `video/quicktime` (iPhone `.mov`, ko'pincha HEVC kodek) QABUL QILINADI,
 * chunki iPhone kuryerlar uchun bu STANDART format va rad etish ularni
 * butunlay to'sardi. LEKIN market tomondagi Chrome/Firefox uni ocha
 * OLMASLIGI mumkin — shu sababli UI'da har doim "yuklab olish" yo'li
 * beriladi va video ochilmasa aniq xabar chiqadi.
 */
export const PROOF_VIDEO_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
] as const;

export const PROOF_ALLOWED_MIME = [
  ...PROOF_IMAGE_MIME,
  ...PROOF_VIDEO_MIME,
] as const;

export function isVideoMime(mime: string): boolean {
  return (PROOF_VIDEO_MIME as readonly string[]).includes(mime);
}

/**
 * MIME → diskda ishlatiladigan kengaytma.
 *
 * ⚠️ Har bir ruxsat etilgan MIME shu yerda BO'LISHI SHART. Unutilsa fayl nomi
 * `<uuid>undefined` bo'lib qoladi — test buni qulflaydi.
 */
export const PROOF_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/3gpp': '.3gp',
};

/**
 * BITTA RASM uchun maksimal hajm.
 *
 * Klient tomonda 1280px gacha siqilgan foto odatda 200-400 KB, ya'ni bu
 * chegara siqish ishlamay qolgan holat (masalan HEIC'ni brauzer ocha
 * olmagan) uchun zaxira.
 */
export const PROOF_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * BITTA VIDEO uchun maksimal QABUL hajmi (siqishdan OLDIN).
 *
 * ⚠️ 25 MB dan 80 MB ga KO'TARILDI, chunki endi video SERVERDA siqiladi
 * (`ProofTranscodeService`).
 *
 * Nega 25 MB yetmasdi: zamonaviy telefon 1080p/30fps da ~15-20 Mbit/s
 * yozadi, ya'ni 25 MB atigi 10-12 SONIYA. Kuryer 30 soniyalik video olib,
 * rad javobini olardi. 80 MB ≈ 35-45 soniya 1080p.
 *
 * Diskda esa bu hajm QOLMAYDI: ffmpeg uni 720p/CRF28 ga o'tkazadi va odatda
 * 2-5 MB qoladi. Ya'ni chegara YUKLASH uchun, SAQLASH uchun emas.
 */
export const PROOF_MAX_VIDEO_BYTES = 80 * 1024 * 1024;

/**
 * BITTA SO'ROVDAGI JAMI hajm — UMUMIY BYUDJET.
 *
 * ⚠️ NEGA ALOHIDA CHEGARA. Faqat "bitta faylga 80 MB" qo'yilsa, 5 ta video
 * 400 MB bo'lardi — bu nginx, disk va backup uchun juda katta, mobil
 * internetda esa umuman yuklanmasdi.
 *
 * Byudjet shuni anglatadi: bitta to'la 80 MB video olinsa, qolganiga 40 MB
 * joy qoladi (ya'ni yana bitta qisqaroq video yoki bir necha rasm);
 * ikkinchi TO'LA video sig'maydi.
 */
export const PROOF_MAX_TOTAL_BYTES = 120 * 1024 * 1024;

/** Bitta so'rovga biriktiriladigan maksimal fayl soni. */
export const PROOF_MAX_FILES = 5;

/**
 * nginx uchun ZARUR minimal `client_max_body_size` (MB).
 * Jami byudjet + multipart sarlavhalari + zaxira.
 */
export const PROOF_NGINX_MIN_BODY_MB = 128;

/**
 * Bog'lanmagan (orfan) isbot fayli qancha vaqt yashaydi.
 * Kuryer "isbotsiz davom etish" bilan sotuvni yopsa, unga isbot biriktirish
 * uchun shuncha vaqt beriladi; muddat o'tsa fayl ham, so'rov ham bekor bo'ladi.
 */
export const PROOF_ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Ishga tushishda isbot saqlash joyini tekshiradi.
 *
 * QAT'IYLIK DARAJASI `PROOF_UPLOAD_ENABLED` GA BOG'LIQ:
 *
 *   `false` (hozir) — faqat ogohlantirish. Isbot yuklash endpointi hali yo'q,
 *                     ya'ni yo'qotiladigan fayl ham yo'q. Bu bosqichda
 *                     serverni to'xtatish faqat SAYTNI O'CHIRARDI.
 *
 *   `true` (Bosqich 3) — sozlash xatosi FATAL bo'ladi, loyihadagi mavjud
 *                     `TYPEORM_SYNCHRONIZE=true` qat'iy-to'xtatish naqshi
 *                     kabi: jimgina noto'g'ri joyga yozishdan ko'ra umuman
 *                     ko'tarilmagan yaxshi, chunki fayl yo'qolsa DB'da
 *                     yozuv qoladi-yu DALIL qolmaydi.
 */
export function assertProofStorageConfigured(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const explicit = !!process.env[UPLOAD_ROOT_ENV];

  const hint =
    `Isbot fayllari pul nizosining yagona dalili — ular deploy papkasidan ` +
    `TASHQARIDAGI mutlaq yo'lga yozilishi shart (masalan /var/beepost/uploads), ` +
    `aks holda har relizda o'chib ketadi. Sozlash: DEPLOY.md.`;

  // ── Sozlanmagan holat ────────────────────────────────────────────────────
  //
  // ⚠️ BU YERDA `throw` QILINMAYDI, va bu ataylab.
  //
  // Guard mavjud serverga QO'SHILAYAPTI: prod `.env` da `UPLOAD_ROOT` hali
  // yo'q (u shu o'zgarish bilan BIRINCHI marta paydo bo'ldi). Agar bu yerda
  // xato tashlansa, keyingi deploy `pm2 restart` dan keyin serverni umuman
  // ko'tarmaydi va SAYT O'CHADI — holbuki isbot yuklash endpointi hali
  // umuman mavjud emas, ya'ni yo'qotiladigan fayl ham yo'q.
  //
  // Qat'iy talab isbot yuklash ishga tushganda (Bosqich 3) yoqiladi:
  // o'shanda `PROOF_UPLOAD_ENABLED` `true` bo'ladi va sozlanmagan holat
  // haqiqiy ma'lumot yo'qotish xavfiga aylanadi.
  if (!explicit) {
    const msg = `${UPLOAD_ROOT_ENV} o'rnatilmagan → ${UPLOAD_ROOT}. ${hint}`;
    console.warn(
      isProd
        ? `⚠️  ${msg} (isbot yuklash ISHLAMAYDI — server davom etmoqda)`
        : `⚠️  ${msg} (dev)`,
    );
  }

  // ── Deploy papkasi ichiga ishora qilish ──────────────────────────────────
  // Eng ko'p uchraydigan sozlash xatosi.
  const insideApp = isInsideDeployTree(UPLOAD_ROOT);
  if (insideApp) {
    const msg =
      `${UPLOAD_ROOT_ENV} (${UPLOAD_ROOT}) deploy papkasi ICHIDA. ` +
      `Yangi deploy isbot fayllarini o'chirib yuboradi.`;
    console.warn(`⚠️  ${msg}`);
  }

  // ── Papka yaratish va yozish huquqi ──────────────────────────────────────
  //
  // ⚠️ Bu ham serverni O'LDIRMASLIGI kerak. Huquq yetmasa (root:root egaligi,
  // systemd `ProtectSystem=strict`, ReadWritePaths yo'q) yagona natija —
  // isbot yuklab bo'lmaydi. Sotuv, kassa va boshqa hamma narsa ishlayveradi,
  // shuning uchun butun tizimni to'xtatish nomutanosib javob bo'lardi.
  try {
    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.accessSync(PROOF_DIR, fs.constants.W_OK);
    fs.mkdirSync(PROOF_TMP_DIR, { recursive: true });
    fs.accessSync(PROOF_TMP_DIR, fs.constants.W_OK);
  } catch (e) {
    const msg =
      `Isbot papkasiga yozib bo'lmadi (${PROOF_DIR}): ` +
      `${e instanceof Error ? e.message : String(e)}. ` +
      `Isbot yuklash ISHLAMAYDI. Tuzatish: sudo mkdir -p ${PROOF_DIR} && ` +
      `sudo chown -R $(whoami) ${UPLOAD_ROOT}`;
    console.warn(`⚠️  ${msg}`);
  }
}

/**
 * YUKLASH PAYTIDAGI to'siq — sozlanmagan joyga isbot yozilmasin.
 *
 * Ishga tushish tekshiruvidan farqi: bu yerda xato foydalanuvchiga ko'rinadi
 * va FAQAT yuklashni to'sadi. Sotuv, kassa va boshqa hamma narsa ishlayveradi.
 *
 * Sabab qaytaradi (`null` = hammasi joyida).
 */
export function proofStorageProblem(): string | null {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !process.env[UPLOAD_ROOT_ENV]) {
    return (
      'Isbot saqlash joyi sozlanmagan (UPLOAD_ROOT). Administratorga ' +
      'murojaat qiling — isbotsiz ham davom etishingiz mumkin.'
    );
  }
  if (isProd && isInsideDeployTree(UPLOAD_ROOT)) {
    return (
      "Isbot saqlash joyi noto'g'ri sozlangan — fayllar keyingi yangilanishda " +
      "o'chib ketardi. Administratorga murojaat qiling."
    );
  }
  try {
    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.accessSync(PROOF_DIR, fs.constants.W_OK);
    fs.mkdirSync(PROOF_TMP_DIR, { recursive: true });
    fs.accessSync(PROOF_TMP_DIR, fs.constants.W_OK);
  } catch {
    return (
      "Isbot papkasiga yozib bo'lmadi. Administratorga murojaat qiling — " +
      'isbotsiz ham davom etishingiz mumkin.'
    );
  }
  return null;
}

/**
 * Yo'l deploy daraxti ichidami.
 *
 * `__dirname` dist'da `<APP>/server/dist/api/extra-cost`, ya'ni uch daraja
 * yuqorisi `<APP>/server`. Lekin deploy `git reset --hard` ni REPO ILDIZIDA
 * bajaradi, shuning uchun bir daraja YUQORIROQ (repo ildizi) ham tekshiriladi:
 * `UPLOAD_ROOT=<APP>/uploads` ham yangi relizda o'chib ketardi.
 */
function isInsideDeployTree(target: string): boolean {
  const serverDir = path.resolve(__dirname, '../../..');
  const repoRoot = path.resolve(serverDir, '..');
  return [serverDir, repoRoot].some(
    (base) => target === base || target.startsWith(base + path.sep),
  );
}

/**
 * Fayl uchun `YYYY/MM` bo'lakli nisbiy yo'l qaytaradi va papkani yaratadi.
 *
 * Oylik bo'lish shart: bitta papkada yuz minglab fayl to'plansa, `ls`,
 * backup va tozalash sekinlashadi (ba'zi fayl tizimlarida esa cheklovga
 * uriladi).
 */
export function ensureProofSubdir(now: Date): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const rel = path.join(yyyy, mm);
  fs.mkdirSync(path.join(PROOF_DIR, rel), { recursive: true });
  return rel;
}

/**
 * Nisbiy yo'ldan mutlaq yo'l yasaydi va u PROOF_DIR ICHIDA qolishini
 * tekshiradi.
 *
 * ⚠️ PATH TRAVERSAL to'sig'i. `rel_path` DB'dan kelsa ham, uni ko'r-ko'rona
 * `path.join` qilish xavfli: DB'ga qandaydir yo'l bilan `../../etc/passwd`
 * tushsa, himoyalangan endpoint uni o'qib berardi.
 */
export function resolveProofPath(relPath: string, storedName: string): string {
  const abs = path.resolve(PROOF_DIR, relPath, storedName);
  // QAT'IY ichkarida: `PROOF_DIR + sep` bilan boshlanishi SHART.
  // PROOF_DIR ning O'ZI ham rad etiladi — u papka, fayl emas. Uni o'tkazib
  // yuborsak, bo'sh `stored_name` bilan chaqiruv papkani qaytarardi va
  // `createReadStream` EISDIR bilan yiqilardi (yoki arxivlash mantig'i
  // butun papkani ochib yuborardi).
  if (!abs.startsWith(PROOF_DIR + path.sep)) {
    throw new Error("Isbot fayli yo'li ruxsat etilgan papkadan tashqarida");
  }
  return abs;
}
