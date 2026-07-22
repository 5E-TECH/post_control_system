/**
 * CourierCameraScanner — kuryer uchun DOIMIY telefon-kamera QR skaneri.
 *
 * scanPage'dan farqi: bitta o'qib chiqib ketmaydi — KETMA-KET skanerlaydi.
 * Har o'qilgan QR uchun `onToken(token)` chaqiriladi (kuryer scanner hook'ining
 * `receiveByToken`'iga ulanadi → buyurtma AVTOMATIK qabul qilinadi, tugmasiz).
 *
 * Kamera uzluksiz o'qigani uchun bir xil tokenni qisqa vaqt ichida qayta
 * ishlamaymiz (cooldown) — ovoz/feedback spamining oldini oladi. Muvaffaqiyat/
 * xato feedback'ini chaqiruvchi sahifa (hook `feedback` overlay'i) ko'rsatadi.
 */

import { useCallback, useRef, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { X, Zap, ZapOff, Camera, RefreshCw, ScanLine } from "lucide-react";

interface CourierCameraScannerProps {
  open: boolean;
  onClose: () => void;
  /** Har o'qilgan QR token — odatda scanner hook'ining receiveByToken'i. */
  onToken: (token: string) => void;
  /** Shu sessiyada qabul qilinganlar soni (yuqorida ko'rsatish uchun). */
  successCount?: number;
}

// Bir xil tokenni shu oraliqda qayta ishlamaymiz (kamera uzluksiz o'qiydi).
const SAME_TOKEN_COOLDOWN_MS = 3000;

export function CourierCameraScanner({
  open,
  onClose,
  onToken,
  successCount = 0,
}: CourierCameraScannerProps) {
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState("");
  const lastRef = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  const handleScan = useCallback(
    (detected: IDetectedBarcode[]) => {
      const raw = detected?.[0]?.rawValue || "";
      if (!raw) return;

      // URL bo'lsa token qismini olamiz
      const token = raw.startsWith("http") ? raw.split("/").pop() || raw : raw;
      if (!token) return;

      // Cooldown: bir xil token qisqa vaqt ichida qayta o'qilsa e'tiborsiz
      const now = Date.now();
      if (
        lastRef.current.token === token &&
        now - lastRef.current.at < SAME_TOKEN_COOLDOWN_MS
      ) {
        return;
      }
      lastRef.current = { token, at: now };

      // Yengil tebranish (qo'llab-quvvatlansa) — kuryerga fizik signal
      if (navigator.vibrate) {
        try {
          navigator.vibrate(60);
        } catch {
          /* ignore */
        }
      }

      onToken(token);
    },
    [onToken],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 relative z-10">
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-white">
          <ScanLine className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-sm">
            Skaner aktiv · ✓ {successCount}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTorchOn((v) => !v)}
          className={`w-11 h-11 rounded-xl backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 ${
            torchOn
              ? "bg-yellow-500/30 border-yellow-500/50 text-yellow-400"
              : "bg-white/10 border-white/20 text-white"
          }`}
        >
          {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
        </button>
      </header>

      {/* Camera */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
        <p className="text-gray-300 text-sm text-center mb-4 max-w-xs">
          Buyurtma QR kodini ramka ichiga tuting — avtomatik qabul qilinadi
        </p>

        <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-black/50 border-2 border-white/20">
          {!error ? (
            <Scanner
              onScan={handleScan}
              onError={() =>
                setError("Kamera ochilmadi yoki ruxsat berilmadi")
              }
              components={{ finder: false, torch: false, onOff: false, zoom: false }}
              sound={false}
              scanDelay={400}
              constraints={{
                facingMode: "environment",
                ...(torchOn && { advanced: [{ torch: true } as never] }),
              }}
              styles={{
                container: { width: "100%", height: "100%" },
                video: { width: "100%", height: "100%", objectFit: "cover" },
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-white font-semibold mb-2">{error}</p>
              <p className="text-gray-400 text-xs mb-5">
                Hardware skaner yoki "qo'lda qabul" tugmasidan foydalaning
              </p>
              <button
                type="button"
                onClick={() => setError("")}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white font-medium rounded-xl active:scale-95 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Qayta urinish
              </button>
            </div>
          )}

          {/* Corner markers */}
          {!error && (
            <div className="absolute inset-8 pointer-events-none">
              <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-emerald-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-emerald-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-emerald-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-emerald-500 rounded-br-xl" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full max-w-sm h-12 rounded-xl bg-white/10 border border-white/20 text-white font-medium active:scale-[0.98] transition-all"
        >
          Skanerlashni yakunlash
        </button>
      </div>
    </div>
  );
}

export default CourierCameraScanner;
