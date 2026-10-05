import { memo, useCallback, useEffect, useRef, useState } from "react";
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
type WakeLockSentinel = { released?: boolean; release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

/** Modal ichidagi foydali kenglik: antd `width` + mobil cheklovi − padding. */
const MODAL_MAX_WIDTH = 420;
/** `styles.content.padding` — antd default 24px o'rniga (ikki tomon). */
const CONTENT_PADDING = 12;
/** QR moduli (bitta kvadratcha) uchun ruxsat etilgan px chegaralari. */
const MIN_MODULE_PX = 5;
const MAX_MODULE_PX = 10;
/** QR standarti: chetda 4 modul bo'sh (oq) joy bo'lishi SHART. */
const QUIET_ZONE_MODULES = 4;

/**
 * MARKET RUXSATI — QR + PIN.
 *
 * ⚠️ ASOSIY QURILMA — TELEFON. Market QR'ni telefonidan ko'rsatadi, markaz
 * xodimi esa APPARAT skaner bilan EKRANDAN o'qiydi. Shundan kelib chiqadigan
 * talablar va ularning HAR BIRI nega shunday:
 *
 * 1. QUIET ZONE. QR standarti chetda 4 modul bo'sh joy talab qiladi.
 *    Qat'iy `p-4` (16px) 29 modulli QR'da atigi ~2 modul chiqadi —
 *    apparat imager QR'ni shu sababli RAD ETADI. Shuning uchun o'ram
 *    padding'i modul o'lchovidan HISOBLANADI.
 *
 * 2. MODUL BUTUN PIKSEL BO'LSIN. O'lcham modul soniga karrali bo'lmasa
 *    (224/29 = 7.72px) brauzer antialiasing modul chetlarini kulrang
 *    qiladi va telefon ekranidan o'qishda kontrast yo'qoladi. Shu sabab
 *    o'lcham `modul_px × modul_soni` sifatida hisoblanadi va SVG'ga
 *    `shapeRendering="crispEdges"` beriladi.
 *
 * 3. MODUL SONI QATTIQ YOZILMAYDI. U token uzunligiga bog'liq, shuning
 *    uchun SVG'ning `viewBox`idan O'QILADI — token formati o'zgarsa
 *    hisob o'zi moslashadi.
 *
 * 4. EKRAN UXLAB QOLMASIN. Telefon 15–30 s da o'chadi; xodim skanerlayotgan
 *    paytda ekran qorayadi. `wakeLock` olinadi va tabga qaytilganda QAYTA
 *    olinadi (brauzer fonga o'tganda uni o'zi bo'shatadi).
 *
 * 5. AVTO-YORQINLIK uchun OQ MAYDON. Brauzer yorqinlikni o'zgartira olmaydi;
 *    yagona dastak — katta oq sath (telefonning yorug'lik sensori oq
 *    kontentda yorqinlikni ko'taradi). Shu sabab modal tanasi QR
 *    ko'rsatilayotganda OQ, dark mode'da ham.
 *
 * 6. `maskClosable={false}`. Telefonda chetga tasodifiy tegish modalni
 *    yopardi, `onClose` esa sessiyani tashlab yuboradi → market qaytadan
 *    bosadi, serverda YANGI sessiya ochiladi va QR/PIN almashadi (xodim
 *    eski QR'ni skanerlab "muddati tugagan" oladi).
 *
 * ⚠️ TAYMER MAJBURIY. Elchi frontendidagi aniq nuqson: market QR modalida
 * sanoq yo'q edi va market YAROQSIZ QR ko'rsatib turardi.
 *
 * ⚠️ `level="M"` O'ZGARTIRILMAYDI: bu payload uchun L ham 29 modul beradi,
 * Q=33 / H=37 esa modulni KICHRAYTIRIB skanerlashni yomonlashtiradi.
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

  // Muddat tugagach AVTOMATIK yangilash — FAQAT bir marta va faqat modal
  // ochiq bo'lsa. Aks holda market modalni ochib qo'yib ketsa server
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

  // ─────────── QR geometriyasi ───────────

  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [modules, setModules] = useState(29);
  const [modulePx, setModulePx] = useState(8);

  /** Mavjud kenglikdan butun modul o'lchovini hisoblaydi. */
  const recalc = useCallback(() => {
    const vw = typeof window === "undefined" ? 420 : window.innerWidth;
    // antd ≤767px da `.ant-modal{max-width:calc(100vw - 16px)}` beradi.
    const modalWidth = Math.min(MODAL_MAX_WIDTH, vw - 16);
    const usable = modalWidth - CONTENT_PADDING * 2;
    // Quiet zone ham shu kenglikdan chiqadi: modul × (modullar + 2×4).
    const px = Math.floor(usable / (modules + QUIET_ZONE_MODULES * 2));
    setModulePx(Math.max(MIN_MODULE_PX, Math.min(MAX_MODULE_PX, px)));
  }, [modules]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  /**
   * Modul sonini SVG `viewBox`idan o'qiymiz — u token uzunligiga bog'liq va
   * qattiq yozilsa token formati o'zgarganda hisob jimgina buzilardi.
   */
  useEffect(() => {
    if (!session) return;
    const svg = qrWrapRef.current?.querySelector("svg");
    const viewBox = svg?.getAttribute("viewBox");
    const n = Number(viewBox?.split(" ")[2]);
    if (Number.isFinite(n) && n > 0 && n !== modules) setModules(n);
  }, [session, modules]);

  const qrSize = modulePx * modules;
  const quietZone = modulePx * QUIET_ZONE_MODULES;

  // ─────────── Ekran uyqusi ───────────

  useEffect(() => {
    if (!open || !session) return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      void nav.wakeLock
        ?.request("screen")
        .then((s) => {
          if (cancelled) void s.release().catch(() => {});
          else sentinel = s;
        })
        .catch(() => {});
    };

    acquire();
    // Brauzer fonga o'tganda qulfni O'ZI bo'shatadi — qaytganda qayta olamiz.
    document.addEventListener("visibilitychange", acquire);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release().catch(() => {});
    };
  }, [open, session]);

  const showingQr = Boolean(session) && !expired;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={MODAL_MAX_WIDTH}
      // ⚠️ Chetga tasodifiy tegish ruxsatni YO'Q QILMASIN.
      maskClosable={false}
      styles={{
        content: {
          padding: CONTENT_PADDING,
          // `dvh` — mobil brauzerda URL bar hisobga olinadi (`vh` emas).
          maxHeight: "94dvh",
          overflowY: "auto",
        },
        // Avto-yorqinlik uchun OQ sath (dark mode'da ham).
        ...(showingQr ? { body: { background: "#ffffff" } } : {}),
      }}
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
          {/* Telefonda balandlik tanqis — tushuntirish faqat kengroq ekranda. */}
          <p className="m-0 hidden text-center text-sm text-gray-600 sm:block dark:text-gray-300">
            Markaz xodimiga shu QR'ni ko'rsating yoki PIN'ni aytib bering.
          </p>

          <div
            ref={qrWrapRef}
            className={`rounded-xl bg-white transition-opacity ${
              expired ? "opacity-20" : "opacity-100"
            }`}
            // ⚠️ QUIET ZONE — modul o'lchovidan hisoblangan (4 modul).
            style={{ padding: quietZone, lineHeight: 0 }}
          >
            <QRCode
              value={session.qr_token}
              size={qrSize}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              // Modul chetlari kulrang bo'lib ketmasin (antialiasing).
              shapeRendering="crispEdges"
              style={{ display: "block" }}
            />
          </div>

          {!expired && (
            <p
              className={`m-0 inline-flex items-center gap-1.5 text-center text-xs ${
                showingQr ? "text-gray-500" : "text-gray-400"
              }`}
            >
              <Sun className="h-3.5 w-3.5 shrink-0" />
              Ekran yorqinligini oshirsangiz skaner tezroq o'qiydi
            </p>
          )}

          <div
            className={`w-full rounded-xl p-2.5 text-center ${
              showingQr ? "bg-gray-100" : "bg-gray-50 dark:bg-gray-800"
            }`}
          >
            <div className="text-[11px] uppercase tracking-wider text-gray-500">
              QR o'qilmasa — PIN
            </div>
            <div
              className={`font-mono text-[30px] font-bold leading-tight tracking-[0.25em] ${
                expired
                  ? "text-gray-400 line-through"
                  : showingQr
                    ? "text-gray-900"
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
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-base font-semibold tabular-nums text-amber-800">
              <Timer className="h-4 w-4" />
              {formatMmSs(left)}
            </span>
          )}

          <p className="m-0 hidden text-center text-xs text-gray-400 sm:block">
            Ruxsat {session.awaiting_count} ta posilka uchun amal qiladi.
            Xodim skanerlagach unga 10 daqiqa beriladi.
          </p>
        </div>
      )}
    </Modal>
  );
}

export default memo(ConsentModal);
