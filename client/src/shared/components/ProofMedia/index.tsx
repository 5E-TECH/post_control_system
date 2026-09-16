import { useEffect, useState } from "react";
import { FileWarning, Loader2, Play } from "lucide-react";
import { api } from "../../api";

interface Props {
  requestId: string;
  proofId: string;
  className?: string;
  /** `thumb` — kichik ko'rinish (video faqat kadr + ▶ belgisi). */
  variant?: "thumb" | "full";
}

/**
 * ISBOT MEDIASI (rasm YOKI video) — himoyalangan endpointdan.
 *
 * ⚠️ NEGA ODDIY `<img src>` ISHLAMAYDI. Isbot endpointi JWT talab qiladi,
 * `<img>` esa `Authorization` sarlavhasini YUBORA OLMAYDI. Tokenni URL
 * so'roviga qo'shish yechim EMAS: u brauzer tarixiga, nginx access-logiga va
 * `Referer` sarlavhasiga tushadi — ya'ni pul nizosi hujjatiga kirish kaliti
 * loglarda qolib ketardi.
 *
 * Shu sababli fayl axios orqali (interceptor tokenni qo'yadi) BLOB sifatida
 * olinadi.
 *
 * ⚠️ VIDEO UCHUN OGOHLANTIRISH. Blob butunlay yuklab olinadi, ya'ni videoda
 * `Range` bilan qismli oqim ishlamaydi. Bu ataylab: chegara 25 MB, va
 * tokenni URL'ga chiqarmasdan haqiqiy oqimni olishning yo'li yo'q.
 */
export default function ProofMedia({
  requestId,
  proofId,
  className,
  variant = "thumb",
}: Props) {
  const [state, setState] = useState<{
    url: string;
    isVideo: boolean;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const key = `${requestId}/${proofId}`;
    // ⚠️ IKKI BAYROQ KERAK, BITTASI YETMAYDI.
    //
    // `holding` — biz HAQIQATAN refcount olganmizmi. Busiz quyidagi xato
    // bo'lardi: komponent `acquire` javobidan OLDIN yo'q qilinsa, tozalash
    // funksiyasi `release` chaqirardi va bu AYNI faylni ko'rsatib turgan
    // BOSHQA komponentning refcount'ini kamaytirardi — natijada blob URL
    // muddatidan oldin yopilib, o'sha komponentda bo'sh kvadrat qolardi.
    let holding = false;
    let disposed = false;

    acquire(key)
      .then((entry) => {
        holding = true;
        if (disposed) {
          release(key);
          holding = false;
          return;
        }
        setState({ url: entry.url, isVideo: entry.isVideo });
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      if (holding) {
        release(key);
        holding = false;
      }
    };
  }, [requestId, proofId]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 dark:bg-gray-800 ${className ?? ""}`}
        title="Isbot fayli ochilmadi"
      >
        <FileWarning className="h-5 w-5" />
      </div>
    );
  }

  if (!state) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className ?? ""}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (state.isVideo) {
    // Kichik ko'rinishda boshqaruv tugmalari kerak emas — bosilganda
    // lightbox ochiladi va u yerda to'liq pleyer bo'ladi.
    if (variant === "thumb") {
      return (
        <div className={`relative ${className ?? ""}`}>
          <video
            src={state.url}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Play className="h-5 w-5 fill-white text-white" />
          </span>
        </div>
      );
    }
    return <video src={state.url} className={className} controls playsInline />;
  }

  return <img src={state.url} alt="isbot" className={className} />;
}

/* ══════════════════ BLOB KESHI (refcount bilan) ══════════════════
 *
 * ⚠️ NEGA KESH KERAK. Market kartasida rasm kichik ko'rinishda, bosilganda
 * esa lightbox'da ko'rsatiladi — kesh bo'lmasa AYNAN SHU fayl ikki marta
 * yuklanardi. Video bilan bu 25 MB ni ikki marta tortish demak.
 *
 * ⚠️ NEGA REFCOUNT. Blob URL'lar avtomatik tozalanmaydi. Lekin oddiy kesh
 * bilan komponent yo'q qilinganda `revokeObjectURL` chaqirish XATO bo'lardi:
 * o'sha URL'ni hali ko'rsatib turgan boshqa komponent bo'sh kvadratga
 * aylanardi. Shuning uchun URL faqat OXIRGI foydalanuvchi ketganda yopiladi.
 */

interface CacheEntry {
  url: string;
  isVideo: boolean;
  refs: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

async function acquire(key: string): Promise<CacheEntry> {
  const hit = cache.get(key);
  if (hit) {
    hit.refs += 1;
    return hit;
  }

  const pending = inflight.get(key);
  if (pending) {
    const entry = await pending;
    entry.refs += 1;
    return entry;
  }

  const [requestId, proofId] = key.split("/");
  const promise = api
    .get(`extra-cost/${requestId}/proof/${proofId}`, { responseType: "blob" })
    .then((res) => {
      const blob = res.data as Blob;
      const entry: CacheEntry = {
        url: URL.createObjectURL(blob),
        // MIME serverdan keladi — klient taxmin qilmaydi.
        isVideo: String(blob.type || "").startsWith("video/"),
        refs: 1,
      };
      cache.set(key, entry);
      inflight.delete(key);
      return entry;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });

  inflight.set(key, promise);
  return promise;
}

function release(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  URL.revokeObjectURL(entry.url);
  cache.delete(key);
}
