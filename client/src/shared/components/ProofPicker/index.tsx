import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Loader2, Video as VideoIcon, X } from "lucide-react";
import {
  MAX_FILES,
  MAX_TOTAL_BYTES,
  MAX_VIDEO_BYTES,
  mb,
  prepareProofFile,
  validateBudget,
  type PreparedMedia,
} from "../../helpers/proofMedia";
import { useExtraCost, type UploadedProof } from "../../api/hooks/useExtraCost";

/** Tanlangan fayl + serverdagi id'si (yuklangandan keyin to'ladi). */
interface PickedMedia extends PreparedMedia {
  proofId?: string;
}

interface Props {
  /** Yuklangan `proof_id` lar o'zgarganda chaqiriladi (bo'sh = tayyor emas). */
  onChange: (proofIds: string[]) => void;
  /** Modal boshqa buyurtmaga ochilganda tozalash uchun. */
  resetKey?: string | number;
  /** Yuklash jarayoni haqida xabar — tashqi tugmani bloklash uchun. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * ISBOT TANLASH VA YUKLASH — rasm/video, 5 tagacha, umumiy byudjet bilan.
 *
 * ⚠️ NEGA ALOHIDA KOMPONENT. U IKKI joyda kerak:
 *   1. Sotuv/bekor modalida (`ExtraCostProofField` ichida)
 *   2. "Isbotni keyinroq biriktirish" modalida (kuryer sahifasi)
 * Ikki nusxa bo'lsa, byudjet qoidasi bittasida eskirib qolardi.
 *
 * ⚠️ HAMMA FAYL BITTA SO'ROVDA YUBORILADI.
 *
 * Avval har fayl ALOHIDA so'rovda ketardi va bu ikki xatoga olib kelgan:
 *   1. UMUMIY BYUDJETNI majburlash printsipial imkonsiz edi — server bir
 *      vaqtda faqat bitta faylni ko'rardi.
 *   2. Yuklash throttle'i (6/daqiqa) 5 faylda ikkinchi buyurtmayoq urib
 *      qolardi.
 *
 * ⚠️ INDEKS BO'YICHA HOLAT SAQLANMAYDI.
 *
 * Avvalgi versiya siklda `items.length` ni indeks sifatida ishlatardi.
 * `items` o'sha render'dagi qiymatni yopib olgani uchun bir vaqtda bir
 * nechta fayl tanlanganda indeks ESKIRARDI va birinchi faylning `proof_id`
 * si YO'QOLARDI — fayl serverda "orfan" bo'lib qolardi. Sinov bazasida
 * aynan shunday 3 ta bog'lanmagan isbot topilgan.
 */
export default function ProofPicker({
  onChange,
  resetKey,
  onBusyChange,
}: Props) {
  const { uploadProof } = useExtraCost();
  // Har bir element o'zining `proof_id` si bilan saqlanadi — o'chirishda
  // qolganlarini QAYTA YUKLAMASLIK uchun (pastda sababi bor).
  const [items, setItems] = useState<PickedMedia[]>([]);
  const [dupCount, setDupCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⚠️ Chaqiruvchida bu funksiyalar har render'da yangi bo'lishi mumkin.
  // Ularni `useEffect` bog'liqligiga qo'shish cheksiz siklga olib kelardi.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;

  // ⚠️ Yo'q qilishda tozalash uchun ALOHIDA ref. `setItems(prev => ...)`
  // ichida tozalash ishonchsiz: komponent yo'q qilingandan keyin React
  // yangilash funksiyasini umuman chaqirmasligi mumkin va blob URL'lar
  // xotirada qolib ketardi (mobil brauzerda bu sezilarli).
  const itemsRef = useRef<PickedMedia[]>([]);
  itemsRef.current = items;

  const setBusyBoth = useCallback((v: boolean) => {
    setBusy(v);
    onBusyRef.current?.(v);
  }, []);

  /** Tanlanganlarni tozalaydi va blob URL'larni yopadi. */
  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((m) => URL.revokeObjectURL(m.preview));
      return [];
    });
    setDupCount(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Boshqa buyurtmaga o'tilganda holat tozalanadi — aks holda oldingi
  // buyurtmaning isboti yangisiga biriktirilib ketardi.
  useEffect(() => {
    clearAll();
    onChangeRef.current([]);
  }, [resetKey, clearAll]);

  // Komponent yo'q qilinganda blob URL'lar yopiladi.
  useEffect(
    () => () => {
      itemsRef.current.forEach((m) => URL.revokeObjectURL(m.preview));
    },
    [],
  );

  /**
   * To'plamni YAXLIT yuboradi — server byudjetni FAQAT shunda ko'ra oladi.
   *
   * ⚠️ NEGA HAR SAFAR HAMMASI. Server umumiy hajmni bitta so'rov ichida
   * hisoblaydi. Fayllar alohida-alohida yuborilsa, 5 ta 25 MB lik videoni
   * 5 ta so'rovda yuborib 40 MB byudjetni chetlab o'tish mumkin bo'lardi.
   *
   * ⚠️ NARXI: yangi fayl qo'shilganda oldingi yuklamalar "orfan" bo'lib
   * qoladi (hech qaysi so'rovga bog'lanmagan). Ularni soatlik CRON tozalaydi
   * (`cleanupOrphans`, 24 soat TTL). O'CHIRISHDA esa qayta yuklanmaydi —
   * pastdagi `removeAt` ga qarang.
   */
  const uploadAll = async (all: PickedMedia[]) => {
    if (!all.length) {
      onChangeRef.current([]);
      return;
    }
    setBusyBoth(true);
    try {
      const res: UploadedProof[] = await uploadProof.mutateAsync(
        all.map((m) => m.file),
      );
      setDupCount(Math.max(0, ...res.map((r) => r.dup_count ?? 0)));
      // Javob tartibi yuborilgan tartib bilan bir xil — har elementga o'z
      // id'si biriktiriladi.
      setItems(all.map((m, i) => ({ ...m, proofId: res[i]?.proof_id })));
      onChangeRef.current(res.map((r) => r.proof_id));
      setError(null);
    } catch (e) {
      // Backend xato kontrakti: `{ message, error }` — ikkisi ham SATR.
      // `data.error.message` EMAS (loyihada bu allaqachon tuzoq bo'lgan).
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Yuklab bo'lmadi — qayta urinib ko'ring";
      setError(String(msg));
      // Yuklanmagan to'plam biriktirilmasin.
      onChangeRef.current([]);
    } finally {
      setBusyBoth(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || busy) return;
    setError(null);

    const prepared: PickedMedia[] = [];
    for (const raw of Array.from(fileList)) {
      prepared.push(await prepareProofFile(raw));
    }

    // ⚠️ BYUDJET KLIENTDA HAM TEKSHIRILADI. Server baribir tekshiradi, lekin
    // u YUKLAB BO'LGANDAN keyin — mobil internetda bu behuda daqiqalar.
    const problem = validateBudget(items, prepared);
    if (problem) {
      prepared.forEach((m) => URL.revokeObjectURL(m.preview));
      setError(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const all = [...items, ...prepared];
    setItems(all);
    await uploadAll(all);
  };

  /**
   * ⚠️ O'CHIRISHDA QAYTA YUKLANMAYDI.
   *
   * Qolgan fayllar ALLAQACHON serverda va ular byudjet tekshiruvidan
   * o'tgan to'plamning QISM TO'PLAMI — ya'ni ular ham, albatta, byudjetga
   * sig'adi. Qayta yuklash faqat bekorga trafik sarflab, yuklash
   * throttle'ini (6/daqiqa) urib qo'yardi.
   */
  const removeAt = (idx: number) => {
    const removed = items[idx];
    const next = items.filter((_, i) => i !== idx);
    if (removed) URL.revokeObjectURL(removed.preview);
    setItems(next);
    setError(null);

    const ids = next.map((m) => m.proofId).filter((v): v is string => !!v);
    // Hali yuklanmagan element qolgan bo'lsa (masalan oldingi yuklash
    // xato bergan), to'plamni yaxlit qayta yuboramiz.
    if (ids.length === next.length) {
      onChangeRef.current(ids);
      return;
    }
    void uploadAll(next);
  };

  const usedBytes = items.reduce((acc, m) => acc + m.file.size, 0);
  const budgetPct = Math.min(100, (usedBytes / MAX_TOTAL_BYTES) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Rasm yoki video — {MAX_FILES} tagacha
        </span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {items.length}/{MAX_FILES} · {mb(usedBytes)}/{mb(MAX_TOTAL_BYTES)} MB
        </span>
      </div>

      {/* Byudjet ko'rsatkichi — kuryer joy qolganini ko'rib tursin */}
      {items.length > 0 && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${
              budgetPct > 90 ? "bg-red-500" : "bg-amber-500"
            }`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {items.map((m, idx) => (
          <div
            key={m.preview}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-amber-300 bg-black/5 dark:border-amber-700"
          >
            {m.isVideo ? (
              <>
                <video
                  src={m.preview}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <VideoIcon className="absolute bottom-1 left-1 h-3.5 w-3.5 text-white drop-shadow" />
              </>
            ) : (
              <img
                src={m.preview}
                alt="isbot"
                className="h-full w-full object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => removeAt(idx)}
              disabled={busy}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white disabled:opacity-40"
              aria-label="O'chirish"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {items.length < MAX_FILES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-amber-400 text-amber-600 disabled:opacity-40 dark:border-amber-700 dark:text-amber-400"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Camera className="h-5 w-5" />
                <span className="text-[10px]">Rasm/video</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        // ⚠️ `capture` ATAYLAB YO'Q. U telefonda kamerani majburlab, bir
        // martada BITTA fayl tanlashga cheklaydi — "5 tagacha" talabi bilan
        // to'g'ridan-to'g'ri ziddiyatda.
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {dupCount > 1 && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Bu fayl bugun boshqa so'rovlarda ham ishlatilgan — market buni
            ko'radi.
          </span>
        </div>
      )}

      <p className="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
        Rasm telefoningizda, video esa serverda <b>avtomatik siqiladi</b>.
        Bitta video {mb(MAX_VIDEO_BYTES)} MB gacha (~40 soniya).
      </p>
    </div>
  );
}
