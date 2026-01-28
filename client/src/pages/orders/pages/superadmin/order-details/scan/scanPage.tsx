import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { buildAdminPath } from "../../../../../../shared/const";
import {
  ArrowLeft,
  QrCode,
  Zap,
  ZapOff,
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ScanLine,
} from "lucide-react";

export default function ScanPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    beepAudioRef.current = new Audio(
      `${import.meta.env.BASE_URL}sound/beep.mp3`
    );
    beepAudioRef.current.preload = "auto";

    // Kamera tayyor bo'lgandan keyin
    const timer = setTimeout(() => setCameraReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleScan = useCallback(
    (result: any) => {
      if (!isScanning || scanSuccess) return;

      if (result) {
        let scannedValue = "";

        if (Array.isArray(result) && result.length > 0) {
          scannedValue = result[0]?.rawValue || "";
        } else if (typeof result === "object" && result.rawValue) {
          scannedValue = result.rawValue;
        } else if (typeof result === "string") {
          scannedValue = result;
        }

        if (scannedValue) {
          setIsScanning(false);
          setScanSuccess(true);
          setError("");

          // Beep ovozi
          beepAudioRef.current
            ?.play()
            .catch((err) => console.error("Ovoz chiqmadi:", err));

          // Vibration (if supported)
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          // tokenni ajratib olish
          const token = scannedValue.split("/").at(-1);

          // Kichik delay bilan sahifaga yo'naltirish (success animatsiyasi uchun)
          setTimeout(() => {
            navigate(buildAdminPath(`scan/${token}`));
          }, 500);
        }
      }
    },
    [isScanning, scanSuccess, navigate]
  );

  const handleError = () => {
    setError("Kamera yuklanmadi yoki ruxsat berilmadi");
    setCameraReady(true);
  };

  const handleRetry = () => {
    setError("");
    setIsScanning(true);
    setScanSuccess(false);
  };

  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="safe-area-top" />
      <header className="flex items-center justify-between px-4 py-4 relative z-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90 touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">QR Scanner</span>
        </div>

        <button
          type="button"
          onClick={toggleTorch}
          className={`w-12 h-12 rounded-xl backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 touch-manipulation ${
            torchOn
              ? "bg-yellow-500/30 border-yellow-500/50 text-yellow-400"
              : "bg-white/10 border-white/20 text-white hover:bg-white/20"
          }`}
        >
          {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {/* Instructions */}
        <div className="text-center mb-6">
          <h1 className="text-white text-xl font-bold mb-2">
            QR kodni skanerlang
          </h1>
          <p className="text-gray-400 text-sm max-w-xs">
            Buyurtma QR kodini ramka ichiga joylashtiring
          </p>
        </div>

        {/* Scanner Container */}
        <div className="relative w-full max-w-sm aspect-square">
          {/* Outer glow effect */}
          <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 rounded-3xl opacity-30 blur-xl animate-pulse" />

          {/* Scanner frame */}
          <div className="relative w-full h-full rounded-3xl overflow-hidden bg-black/50 backdrop-blur-sm border-2 border-white/20">
            {/* Camera view */}
            {!error && (
              <Scanner
                onScan={handleScan}
                onError={handleError}
                components={{
                  finder: false,
                  torch: false,
                  tracker: false,
                  onOff: false,
                  zoom: false,
                }}
                sound={false}
                constraints={{
                  facingMode: "environment",
                  ...(torchOn && {
                    advanced: [{ torch: true }] as any,
                  }),
                }}
                styles={{
                  container: {
                    width: "100%",
                    height: "100%",
                    borderRadius: "24px",
                    overflow: "hidden",
                  },
                  video: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  },
                }}
              />
            )}

            {/* Loading state */}
            {!cameraReady && !error && (
              <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin mb-4" />
                <p className="text-gray-400 text-sm">Kamera yuklanmoqda...</p>
              </div>
            )}

            {/* Scanning overlay */}
            {cameraReady && !error && !scanSuccess && (
              <>
                {/* Corner markers */}
                <div className="absolute inset-8 pointer-events-none">
                  {/* Top Left */}
                  <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-purple-500 rounded-tl-xl" />
                  {/* Top Right */}
                  <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-purple-500 rounded-tr-xl" />
                  {/* Bottom Left */}
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-purple-500 rounded-bl-xl" />
                  {/* Bottom Right */}
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-purple-500 rounded-br-xl" />
                </div>

                {/* Scanning line animation */}
                <div className="absolute inset-8 overflow-hidden pointer-events-none">
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-scan-line" />
                </div>

                {/* Scan icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <ScanLine className="w-16 h-16 text-white/20" />
                </div>
              </>
            )}

            {/* Success overlay */}
            {scanSuccess && (
              <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 animate-bounce-in">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
                <p className="text-white font-semibold text-lg">
                  QR kod topildi!
                </p>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
                <p className="text-white font-semibold text-lg mb-2 text-center">
                  Xatolik yuz berdi
                </p>
                <p className="text-gray-400 text-sm text-center mb-6">{error}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all active:scale-95 touch-manipulation"
                >
                  <RefreshCw className="w-5 h-5" />
                  Qayta urinish
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 w-full max-w-sm">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-medium text-sm mb-1">
                  Maslahatlar
                </h3>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• QR kodni to'g'ri yorug'likda skanerlang</li>
                  <li>• Kamerani QR kodga yaqinlashtiring</li>
                  <li>• Qorong'ida chiroqni yoqing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom safe area */}
      <div className="h-6 safe-area-bottom" />

      {/* Custom styles for animations */}
      <style>{`
        @keyframes scan-line {
          0% {
            top: 0;
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            top: 100%;
            opacity: 1;
          }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .safe-area-top {
          padding-top: env(safe-area-inset-top, 0px);
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
    </div>
  );
}
