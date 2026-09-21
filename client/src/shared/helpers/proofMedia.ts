/**
 * ISBOT MEDIASI — klient tomondagi chegaralar va siqish.
 *
 * ⚠️ RAQAMLAR SERVER BILAN BIR XIL BO'LISHI SHART
 * (`server/src/api/extra-cost/proof-storage.const.ts`). Ular ajralib ketsa
 * kuryer faylni tanlaydi, yuklaydi va faqat serverdan qaytgach rad javobini
 * ko'radi — mobil internetda bu bir necha daqiqa behuda kutish demak.
 */

/** Bitta rasm. Klientda siqilgandan keyin odatda ~300 KB. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Bitta video — QABUL chegarasi (~35-45 s telefon videosi).
 *
 * ⚠️ BRAUZERDA SIQILMAYDI, SERVERDA SIQILADI. `MediaRecorder` qayta
 * kodlash uchun real vaqt talab qiladi va mobil Safari'da sifat/kodek
 * kafolati yo'q; `ffmpeg.wasm` esa ~25 MB kutubxona yuklab telefonda bir
 * necha daqiqa ishlaydi — kuryer mijoz oldida turganda ikkalasi yaroqsiz.
 *
 * Shuning uchun fayl asl holida yuboriladi va serverda `ffmpeg` uni
 * 720p/H.264 ga o'tkazadi (odatda 2-5 MB qoladi). Ya'ni bu chegara
 * YUKLASH uchun, SAQLASH uchun emas.
 */
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

/**
 * BITTA SO'ROVDAGI JAMI — umumiy byudjet.
 *
 * Bitta to'la 80 MB video olinsa, qolganiga 40 MB joy qoladi (yana bitta
 * qisqaroq video yoki bir necha rasm); ikkinchi TO'LA video sig'maydi.
 * Aynan foydalanuvchi talab qilgan xulq.
 */
export const MAX_TOTAL_BYTES = 120 * 1024 * 1024;

export const MAX_FILES = 5;

/** Siqish uchun eng uzun tomon (piksel). */
const MAX_DIM = 1280;

/** JPEG sifati — chek matni hali o'qiladi, hajm esa kichik. */
const JPEG_QUALITY = 0.82;

/** Shundan kichik rasmlar TEGILMAYDI (qayta kodlash faqat sifatni yo'qotardi). */
const SKIP_COMPRESS_BELOW = 600 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const mb = (bytes: number): string =>
  (bytes / (1024 * 1024)).toFixed(1);

export const isVideoFile = (file: File): boolean =>
  file.type.startsWith('video/');

export interface PreparedMedia {
  file: File;
  /** Ko'rib turish uchun blob URL — ishlatib bo'lgach `revoke` qilinadi. */
  preview: string;
  isVideo: boolean;
  /** Siqishdan OLDINGI hajm — foydalanuvchiga ko'rsatish uchun. */
  originalSize: number;
}

/**
 * Bitta faylni yuborishga tayyorlaydi.
 *
 * RASM — canvas orqali 1280px ga siqiladi. Zamonaviy telefon rasmi 5-12 MB,
 * siqilgandan keyin 200-400 KB: 2G da ham bir necha soniya.
 *
 * VIDEO — KLIENTDA tegilmaydi, SERVERDA siqiladi (`ffmpeg`, 720p/H.264).
 * Brauzerda videoni ishonchli siqishning amaliy yo'li yo'q, shuning uchun
 * bu yerda faqat hajm tekshiriladi — asl fayl yuboriladi va server uni
 * kichraytiradi.
 */
export async function prepareProofFile(raw: File): Promise<PreparedMedia> {
  if (isVideoFile(raw)) {
    return {
      file: raw,
      preview: URL.createObjectURL(raw),
      isVideo: true,
      originalSize: raw.size,
    };
  }

  const original = raw.size;

  // Kichik va tanish formatdagi rasm — tegmaymiz.
  if (original <= SKIP_COMPRESS_BELOW && IMAGE_TYPES.includes(raw.type)) {
    return {
      file: raw,
      preview: URL.createObjectURL(raw),
      isVideo: false,
      originalSize: original,
    };
  }

  const url = URL.createObjectURL(raw);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("rasmni ochib bo'lmadi"));
      el.src = url;
    });

    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, MAX_DIM / longest);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas mavjud emas');

    // Shaffof PNG → JPEG da qora fon bo'lmasligi uchun oq fon.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) throw new Error("siqib bo'lmadi");

    const compressed = new File([blob], renameToJpg(raw.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    URL.revokeObjectURL(url);
    return {
      file: compressed,
      preview: URL.createObjectURL(compressed),
      isVideo: false,
      originalSize: original,
    };
  } catch {
    // ⚠️ SIQISH YIQILSA HAM DAVOM ETAMIZ — masalan iPhone HEIC'ni ba'zi
    // brauzerlar canvas'da ocholmaydi. Asl faylni yuborish hech
    // yubormaslikdan yaxshi; server turini o'zi aniqlaydi.
    //
    // Bu shoxda `url` PREVIEW sifatida qaytadi, shuning uchun yopilmaydi.
    // (HEIC bo'lsa preview bo'sh kvadrat bo'ladi — UI buni alohida aytadi.)
    return { file: raw, preview: url, isVideo: false, originalSize: original };
  }
}

/**
 * Tanlangan fayllarni byudjet bo'yicha tekshiradi.
 *
 * ⚠️ NEGA KLIENTDA HAM. Server baribir tekshiradi, lekin u YUKLAB
 * BO'LGANDAN keyin — ya'ni kuryer mobil internetda 40 MB ni behuda
 * yuborib, keyin rad javobini olardi.
 *
 * `null` = hammasi joyida.
 */
export function validateBudget(
  existing: PreparedMedia[],
  incoming: PreparedMedia[],
): string | null {
  const all = [...existing, ...incoming];

  if (all.length > MAX_FILES) {
    return `Eng ko'pi ${MAX_FILES} ta fayl biriktirish mumkin`;
  }

  for (const m of incoming) {
    const max = m.isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (m.file.size > max) {
      return m.isVideo
        ? `Video ${mb(max)} MB dan katta bo'lmasligi kerak ` +
            `(bu ${mb(m.file.size)} MB). Taxminan 40 soniyagacha oling.`
        : `Rasm ${mb(max)} MB dan katta bo'lmasligi kerak ` +
            `(bu ${mb(m.file.size)} MB).`;
    }
  }

  const total = all.reduce((acc, m) => acc + m.file.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    const used = all.length - incoming.length;
    return (
      `Umumiy hajm ${mb(MAX_TOTAL_BYTES)} MB dan oshmasligi kerak ` +
      `(bo'lardi: ${mb(total)} MB` +
      (used > 0 ? `, hozir ${used} ta fayl biriktirilgan` : '') +
      `). Videoni qisqaroq oling yoki fayl sonini kamaytiring.`
    );
  }

  return null;
}

function renameToJpg(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'isbot';
  return `${base}.jpg`;
}
