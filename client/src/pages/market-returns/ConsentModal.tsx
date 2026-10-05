import { memo, useCallback, useEffect, useRef } from "react";
import { Button, Modal } from "antd";
import QRCode from "react-qr-code";
import { Loader2, RefreshCw, ShieldCheck, Timer } from "lucide-react";
import {
  formatMmSs,
  useSecondsCountdown,
} from "../../shared/hooks/useSecondsCountdown";
import type { ConsentSession } from "../../shared/api/hooks/useMarketHandover";

interface Props {
  open: boolean;
  onClose: () => void;
  session: ConsentSession | null;
  loading: boolean;
  /** Muddat tugaganda / qayta so'ralganda yangi ruxsat yaratadi. */
  onRegenerate: () => void;
}

/**
 * MARKET RUXSATI — QR + PIN.
 *
 * ⚠️ TAYMER MAJBURIY. Elchi frontendidagi aniq nuqson: market QR modalida
 * sanoq YO'Q edi va market YAROQSIZ QR ko'rsatib turardi — xodim skanerlaydi,
 * "muddati tugagan" chiqadi, ikkisi ham nima bo'layotganini tushunmaydi.
 * Shuning uchun bu yerda: sanoq ko'rinadi, tugaganda QR XIRALASHADI va
 * «Yangilash» tugmasi chiqadi.
 *
 * ⚠️ PIN — QR ning ZAXIRASI, qo'shimcha hashamat emas. Market telefoni eski
 * yoki ekrani xira bo'lsa kamera QR'ni o'qiy olmaydi; shunda xodim 6 xonani
 * klaviaturadan kiritadi. Shu sabab PIN katta shriftda va ajratib
 * ko'rsatiladi.
 */
function ConsentModal({
  open,
  onClose,
  session,
  loading,
  onRegenerate,
}: Props) {
  const left = useSecondsCountdown(session?.ttl_seconds, session?.session_id);
  const expired = Boolean(session) && left <= 0;

  // Muddat tugagach AVTOMATIK yangilash — lekin FAQAT bir marta va faqat
  // modal ochiq bo'lsa. Aks holda market modalni ochib qo'yib ketsa server
  // soniyada bitta sessiya yaratib yotardi.
  const autoRenewed = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !session || !expired) return;
    if (autoRenewed.current === session.session_id) return;
    autoRenewed.current = session.session_id;
    onRegenerate();
  }, [open, session, expired, onRegenerate]);

  const handleRegenerate = useCallback(() => {
    autoRenewed.current = null;
    onRegenerate();
  }, [onRegenerate]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Topshirishga ruxsat
        </span>
      }
    >
      {loading && !session ? (
        <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          Ruxsat tayyorlanmoqda…
        </div>
      ) : !session ? (
        <div className="py-8 text-center text-gray-500">
          Ruxsat yaratilmadi. Qaytadan urinib ko'ring.
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-center text-sm text-gray-600 dark:text-gray-300">
            Markaz xodimiga shu QR'ni ko'rsating yoki PIN'ni aytib bering.
            Shundan keyin posilkalaringizni topshirishadi.
          </p>

          <div
            className={`rounded-xl bg-white p-4 transition-opacity ${
              expired ? "opacity-20" : "opacity-100"
            }`}
          >
            <QRCode value={session.qr_token} size={180} />
          </div>

          <div className="w-full rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
            <div className="text-[11px] uppercase tracking-wider text-gray-500">
              QR o'qilmasa — PIN
            </div>
            <div
              className={`font-mono text-3xl font-bold tracking-[0.3em] ${
                expired
                  ? "text-gray-400 line-through"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {session.pin}
            </div>
          </div>

          {expired ? (
            <div className="flex w-full flex-col items-center gap-2">
              <span className="text-sm font-semibold text-red-600">
                Muddati tugadi — yangi ruxsat kerak
              </span>
              <Button
                type="primary"
                icon={<RefreshCw className="h-4 w-4" />}
                loading={loading}
                onClick={handleRegenerate}
                block
              >
                Yangi ruxsat
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-sm font-semibold tabular-nums text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <Timer className="h-4 w-4" />
              {formatMmSs(left)}
            </span>
          )}

          <p className="text-center text-xs text-gray-400">
            Ruxsat {session.awaiting_count} ta posilka uchun amal qiladi.
            Xodim skanerlagach unga 10 daqiqa beriladi.
          </p>
        </div>
      )}
    </Modal>
  );
}

export default memo(ConsentModal);
