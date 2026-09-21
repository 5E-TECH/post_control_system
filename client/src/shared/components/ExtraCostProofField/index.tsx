import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import ProofPicker from "../ProofPicker";

/** Kuryer modallariga qaytariladigan holat. */
export interface ProofFieldValue {
  extra_cost_proof_ids?: string[];
  extra_cost_proof_deferred?: boolean;
}

interface Props {
  /** Market «isbot majburiy» bayrog'ini yoqqanmi. */
  required: boolean;
  /** Kiritilgan qo'shimcha xarajat (0 bo'lsa maydon ko'rinmaydi). */
  amount: number;
  onChange: (value: ProofFieldValue) => void;
  /** Modal boshqa buyurtmaga ochilganda tozalash uchun. */
  resetKey?: string | number;
}

/**
 * QO'SHIMCHA XARAJAT ISBOTI — kuryer modallari uchun YAGONA komponent.
 *
 * Kuryer xarajatni UCH ekranda kiritadi (kutilayotgan buyurtmalar, barcha
 * buyurtmalar, QR-skan). Alohida yozilsa, biri e'tibordan qoladi va
 * kuryerlar aynan o'sha yo'ldan isbotsiz o'tishadi.
 *
 * Fayl tanlash/yuklash mantig'i `ProofPicker` da — u "isbotni keyinroq
 * biriktirish" modalida ham ishlatiladi.
 *
 * ⚠️ SABAB (kategoriya) TANLASH OLIB TASHLANDI. Amalda kuryer mijoz oldida
 * turib ro'yxatdan doim "Boshqa"ni tanlardi — maydon hech qanday ma'lumot
 * bermay faqat sotuvni sekinlashtirardi. Isbotning o'zi sababni ko'rsatadi.
 * Server tomonidagi maydon saqlanib qoldi, ya'ni keyin qaytarish uchun
 * migratsiya kerak emas.
 */
export default function ExtraCostProofField({
  required,
  amount,
  onChange,
  resetKey,
}: Props) {
  const [proofIds, setProofIds] = useState<string[]>([]);
  const [skipProof, setSkipProof] = useState(false);
  const [busy, setBusy] = useState(false);

  // `onChange` chaqiruvchida har render'da yangi funksiya bo'lishi mumkin.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emit = useCallback((ids: string[], skip: boolean) => {
    onChangeRef.current({
      extra_cost_proof_ids: ids.length ? ids : undefined,
      extra_cost_proof_deferred: skip || undefined,
    });
  }, []);

  const handleIds = useCallback(
    (ids: string[]) => {
      setProofIds(ids);
      // Fayl yuklangan bo'lsa "isbotsiz davom etish" ma'nosiz.
      if (ids.length) setSkipProof(false);
      emit(ids, ids.length ? false : skipProof);
    },
    [emit, skipProof],
  );

  // Buyurtma almashganda belgilash tozalanadi.
  useEffect(() => {
    setSkipProof(false);
  }, [resetKey]);

  // Xarajat kiritilmagan bo'lsa maydon umuman kerak emas.
  if (!amount || amount <= 0) return null;

  const canSkip = required && proofIds.length === 0 && !busy;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/15">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
        <Camera className="h-4 w-4" />
        {required ? "Isbot (majburiy)" : "Isbot (ixtiyoriy)"}
      </div>

      <ProofPicker
        onChange={handleIds}
        resetKey={resetKey}
        onBusyChange={setBusy}
      />

      {/* Isbotsiz davom etish — SOTUV HECH QACHON YIQILMASLIGI KERAK */}
      {canSkip && (
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
          <input
            type="checkbox"
            checked={skipProof}
            onChange={(e) => {
              setSkipProof(e.target.checked);
              emit(proofIds, e.target.checked);
            }}
            className="mt-0.5"
          />
          <span>
            Yuklanmayapti — <b>isbotsiz davom etaman</b>. So'rov "isbot
            kutilmoqda" holatida qoladi; uni <b>24 soat ichida</b> «Qo'shimcha
            xarajat» bo'limidan biriktirasiz.
          </span>
        </label>
      )}

      {required && (
        <p className="mt-2 text-[11px] leading-snug text-amber-800 dark:text-amber-300">
          {skipProof
            ? "⚠️ Isbot biriktirilmaguncha bu so'rov marketga YUBORILMAYDI va tasdiqlanmaydi."
            : "Bu xarajat market tasdiqlagandan keyin hisobingizga o'tkaziladi. Naqdni kassaga to'liq topshirasiz."}
        </p>
      )}
    </div>
  );
}
