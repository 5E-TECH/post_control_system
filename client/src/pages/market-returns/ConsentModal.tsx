import { memo, useCallback, useEffect, useRef } from "react";
import { Button, Modal } from "antd";
import QRCode from "react-qr-code";
import { Loader2, RefreshCw, ShieldCheck, Sun, Timer } from "lucide-react";
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

/** `navigator.wakeLock` hamma brauzerda yo'q — tip mahalliy e'lon qilinadi. */
type WakeLockSentinel = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

/**
 * MARKET RUXSATI — QR + PIN.
 *
 * ⚠️ ASOSIY QURILMA — TELEFON. Market QR'ni amalda telefonidan ko'rsatadi,
 * markaz xodimi esa APPARAT skaner bilan EKRANDAN o'qiydi. Shundan kelib
 * chiqadigan uch talab:
 *
 *   1. QR imkon qadar KATTA va to'liq kontrastli bo'lsin — o'lcham ekranga
 *      moslanadi (`min(72vw, 260px)`), kichik telefonda ham maksimal.
 *   2. Ekran UXLAB QOLMASIN — market QR'ni ko'rsatib turganda telefon
 *      o'chsa, xodim skanerlay olmaydi va ikkisi vaqt yo'qotadi. Shuning
 *      uchun `wakeLock` (qo'llab-quvvatlanmasa jimgina o'tkazib yuboriladi).
 *   3. YORQINLIK muhim — xira ekranni skaner o'qimaydi, shuning uchun
 *      eslatma ko'rsatiladi (brauzer yorqinlikni o'zi o'zgartira olmaydi).
 *
 * ⚠️ TAYMER MAJBURIY. Elchi frontendidagi aniq nuqson: market QR modalida
 * sanoq YO'Q edi va market YAROQSIZ QR ko'rsatib turardi — xodim skanerlaydi,
 * "muddati tugagan" chiqadi, ikkisi ham nima bo'layotganini tushunmaydi.
 *
 * ⚠️ PIN — QR ning ZAXIRASI: skaner ekrandan o'qiy olmasa xodim 6 xonani
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

  /**
   * EKRAN UXLAB QOLMASIN — QR ko'rsatilayotganda.
   *
   * Qo'llab-quvvatlanmasa (iOS Safari'ning eski versiyalari, HTTP) xato
   * JIMGINA yutiladi: bu qulaylik, shart emas.
   */
  useEffect(() => {
    if (!open || !session) return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    void nav.wakeLock
      .request("screen")
      .then((s) => {
        if (cancelled) void s.release().catch(() => {});
        else sentinel = s;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      void sentinel?.release().catch(() => {});
    };
  }, [open, session]);

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
        <div className="flex flex-col items-center gap-3 py-1">
          <p className="m-0 text-center text-sm text-gray-600 dark:text-gray-300">
            Markaz xodimiga shu QR'ni ko'rsating yoki PIN'ni aytib bering.
          </p>

          {/*
            ⚠️ O'LCHAM EKRANGA MOSLANADI. Qat'iy `size` bersak kichik
            telefonda QR modaldan chiqib ketardi yoki keraksiz kichik
            bo'lardi — apparat skaner esa ekrandan o'qiydi va kichik QR'ni
            ilg'amaydi. SVG konteynerni to'liq egallaydi.
          */}
          <div
            className={`rounded-xl bg-white p-3 transition-opacity ${
              expired ? "opacity-20" : "opacity-100"
            }`}
            style={{ width: "min(72vw, 260px)" }}
          >
            <QRCode
              value={session.qr_token}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>

          {!expired && (
            <p className="m-0 inline-flex items-center gap-1.5 text-center text-xs text-gray-400">
              <Sun className="h-3.5 w-3.5 shrink-0" />
              Ekran yorqinligini oshirsangiz skaner tezroq o'qiydi
            </p>
          )}

          <div className="w-full rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
            <div className="text-[11px] uppercase tracking-wider text-gray-500">
              QR o'qilmasa — PIN
            </div>
            <div
              className={`font-mono text-[32px] font-bold leading-tight tracking-[0.25em] sm:text-3xl ${
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
                size="large"
                icon={<RefreshCw className="h-4 w-4" />}
                loading={loading}
                onClick={handleRegenerate}
                block
              >
                Yangi ruxsat
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-base font-semibold tabular-nums text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <Timer className="h-4 w-4" />
              {formatMmSs(left)}
            </span>
          )}

          <p className="m-0 text-center text-xs text-gray-400">
            Ruxsat {session.awaiting_count} ta posilka uchun amal qiladi.
            Xodim skanerlagach unga 10 daqiqa beriladi.
          </p>
        </div>
      )}
    </Modal>
  );
}

export default memo(ConsentModal);
