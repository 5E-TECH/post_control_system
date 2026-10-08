import { memo } from "react";
import { CheckCircle, QrCode, RefreshCw, XCircle } from "lucide-react";

/**
 * SKANER JAVOBI — BUTUN EKRANLI VIZUAL EFFEKT.
 *
 * ⚠️ NEGA KICHIK YOZUV YETARLI EMAS. Xodim skanerlaganda ko'zi
 * POSILKADA bo'ladi, ekranda emas: u qo'lida yorliqni ushlab turadi va
 * keyingisiga o'tadi. Ro'yxat tepasidagi kichik rangli qator e'tibordan
 * chetda qolardi — xodim skan o'tgan-o'tmaganini bilmay, ayni posilkani
 * ikki marta o'qitardi yoki o'tkazib yuborardi.
 *
 * Loyihada bu saboq allaqachon o'rganilgan: `today-orders`,
 * `courier-bulk` va `today-orders/orderview` da aynan shunday butun
 * ekranli overlay bor. Shu naqsh bitta komponentga yig'ildi — uchta
 * nusxa o'rniga (ular allaqachon bir-biridan ajrab ketgan edi).
 *
 * ⚠️ `pointer-events-none` — overlay 0.9 s ko'rinadi va shu vaqt ichida
 * bosishni to'smasligi kerak: xodim ketma-ket skanerlaydi.
 */
export type ScanFeedbackTone = "success" | "error" | "warning" | "info";

export interface ScanFeedbackState {
  show: boolean;
  type: ScanFeedbackTone;
  message?: string;
}

/**
 * ⚠️ RANG MA'NO TASHIYDI — xodim MATNNI emas, RANGNI ko'radi:
 *   ko'k    — market ruxsati ochildi (boshqa turdagi hodisa);
 *   yashil  — posilka topildi;
 *   sariq   — allaqachon skanerlangan (xato emas, takror);
 *   qizil   — topilmadi yoki xato.
 */
const TONE = {
  success: {
    veil: "bg-green-500/20",
    circle: "bg-green-500 shadow-green-500/50",
    text: "text-green-600",
  },
  info: {
    veil: "bg-sky-500/20",
    circle: "bg-sky-500 shadow-sky-500/50",
    text: "text-sky-600",
  },
  warning: {
    veil: "bg-amber-500/20",
    circle: "bg-amber-500 shadow-amber-500/50",
    text: "text-amber-600",
  },
  error: {
    veil: "bg-red-500/20",
    circle: "bg-red-500 shadow-red-500/50",
    text: "text-red-600",
  },
} as const;

const ICON = {
  success: CheckCircle,
  info: QrCode,
  warning: RefreshCw,
  error: XCircle,
} as const;

function ScanFeedback({ state }: { state: ScanFeedbackState }) {
  if (!state.show) return null;

  const tone = TONE[state.type] ?? TONE.success;
  const Icon = ICON[state.type] ?? CheckCircle;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${tone.veil}`}
      />
      {/* `scan-feedback-anim` — index.css dagi maxsus klass. Tailwind'ning
          `animate-in zoom-in` i ishlatilmaydi: u modallarga ham tegib,
          ularni 0.9 s da yo'q qilib yuborardi (index.css izohi). */}
      <div className="scan-feedback-anim relative flex flex-col items-center justify-center">
        <div
          className={`flex h-40 w-40 items-center justify-center rounded-full shadow-2xl sm:h-52 sm:w-52 ${tone.circle}`}
        >
          <Icon
            className="h-24 w-24 text-white sm:h-32 sm:w-32"
            strokeWidth={2.5}
          />
        </div>
        {state.message && (
          <p
            className={`mt-6 text-2xl font-bold sm:text-3xl ${tone.text}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(ScanFeedback);
