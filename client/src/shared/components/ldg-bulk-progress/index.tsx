import { useEffect, useRef, useState } from "react";
import { Progress, Button, message } from "antd";
import {
  Loader2,
  X,
  Minus,
  PackageCheck,
  CircleStop,
  Truck,
} from "lucide-react";
import { useLdgAdmin } from "../../api/hooks/useLdgAdmin";

const MIN_KEY = "ldg_bulk_minimized";
// Yakunlangan jobни ko'rsatib turish oynasi (refreshdan keyin eskirgan natija
// har safar chiqavermasligi uchun).
const SHOW_FINISHED_MS = 10 * 60 * 1000;

/**
 * LDG ommaviy ("Hammasini qayta jo'natish") jarayoni uchun GLOBAL progress
 * widget. Server tomonida ishlaydi — bu komponent faqat holatni poll qiladi.
 * Shu sabab boshqa sahifaga o'tilsa yoki refresh berilsa ham jarayon davom
 * etadi; widget esa qaytadan paydo bo'lib, joriy holatni ko'rsatadi.
 *
 * Holatlar:
 *  - Kichraytirilgan (chip) — pastki o'ng burchakda kichik tugma.
 *  - Kattalashtirilgan (panel) — to'liq progress + to'xtatish tugmasi.
 * "ldg-bulk-open" window eventi panelni ochadi (jo'natish boshlanganda).
 */
export const LdgBulkProgress = () => {
  const { getBulkStatus, stopBulk } = useLdgAdmin();
  const { data: status } = getBulkStatus(true, true);

  const [minimized, setMinimized] = useState<boolean>(
    () => localStorage.getItem(MIN_KEY) !== "false",
  );
  const [dismissed, setDismissed] = useState(false);
  const prevRunning = useRef(false);

  // Jo'natish boshlanganda (boshqa joydan) panelni ochish signali.
  useEffect(() => {
    const open = () => {
      setMinimized(false);
      setDismissed(false);
      localStorage.setItem(MIN_KEY, "false");
    };
    window.addEventListener("ldg-bulk-open", open);
    return () => window.removeEventListener("ldg-bulk-open", open);
  }, []);

  // Job ishga tushganda (false -> true) avtomatik ochilib, dismiss tozalanadi.
  useEffect(() => {
    if (status?.running && !prevRunning.current) {
      setDismissed(false);
    }
    prevRunning.current = !!status?.running;
  }, [status?.running]);

  const toggleMin = (v: boolean) => {
    setMinimized(v);
    localStorage.setItem(MIN_KEY, String(v));
  };

  if (!status) return null;

  const finishedRecently =
    !status.running &&
    status.finished_at != null &&
    Date.now() - Number(status.finished_at) < SHOW_FINISHED_MS;

  const visible =
    (status.running || (finishedRecently && status.total > 0)) && !dismissed;
  if (!visible) return null;

  const pct =
    status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
  const stopping = status.running && status.stop_requested;

  const handleStop = async () => {
    try {
      const r = await stopBulk.mutateAsync();
      message.warning(r.message || "To'xtatilmoqda...");
    } catch {
      message.error("To'xtatishda xatolik");
    }
  };

  const statusText = status.running
    ? stopping
      ? "To'xtatilmoqda..."
      : "Jo'natilmoqda..."
    : status.stop_requested
      ? "To'xtatildi"
      : "Yakunlandi";

  // ===== Kichraytirilgan (chip) =====
  if (minimized) {
    return (
      <button
        onClick={() => toggleMin(false)}
        className="fixed bottom-5 right-5 z-[1000] flex items-center gap-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 shadow-lg shadow-violet-600/30 transition-colors cursor-pointer"
      >
        {status.running ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <PackageCheck className="w-4 h-4" />
        )}
        <span className="text-sm font-semibold">
          LDG {status.done}/{status.total}
        </span>
        <span className="text-xs opacity-80">{pct}%</span>
      </button>
    );
  }

  // ===== Kattalashtirilgan (panel) =====
  return (
    <div className="fixed bottom-5 right-5 z-[1000] w-[360px] max-w-[92vw] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
      {/* Sarlavha */}
      <div className="flex items-center justify-between px-4 py-3 bg-violet-600 text-white">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4" />
          <span className="font-semibold text-sm">LDG ommaviy jo'natish</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleMin(true)}
            title="Kichraytirish"
            className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          {!status.running && (
            <button
              onClick={() => setDismissed(true)}
              title="Yopish"
              className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tana */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {status.running ? (
            <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
          ) : status.stop_requested ? (
            <CircleStop className="w-4 h-4 text-amber-500" />
          ) : (
            <PackageCheck className="w-4 h-4 text-green-600" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {statusText}
          </span>
          <span className="ml-auto text-sm font-bold text-gray-800 dark:text-white">
            {status.done}/{status.total}
          </span>
        </div>

        <Progress
          percent={pct}
          status={
            status.running ? "active" : status.failed > 0 ? "exception" : "success"
          }
          strokeColor="#7C3AED"
        />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 py-2">
            <div className="text-lg font-bold text-green-600">
              {status.success}
            </div>
            <div className="text-[11px] text-gray-500">Jo'natildi</div>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2">
            <div className="text-lg font-bold text-red-500">{status.failed}</div>
            <div className="text-[11px] text-gray-500">Xato</div>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
            <div className="text-lg font-bold text-gray-600 dark:text-gray-300">
              {Math.max(0, status.total - status.done)}
            </div>
            <div className="text-[11px] text-gray-500">Qoldi</div>
          </div>
        </div>

        {status.last_error && (
          <p className="text-xs text-red-500 line-clamp-2">
            Oxirgi xato: {status.last_error}
          </p>
        )}

        {status.running && (
          <Button
            danger
            block
            icon={<CircleStop className="w-4 h-4" />}
            loading={stopBulk.isPending || stopping}
            onClick={handleStop}
          >
            {stopping ? "To'xtatilmoqda..." : "To'xtatish"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default LdgBulkProgress;
