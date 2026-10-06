import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Checkbox, Modal, Select } from "antd";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  FileText,
  KeyRound,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  QrCode,
  ShieldCheck,
  Timer,
  User,
} from "lucide-react";
import {
  MANUAL_OVERRIDE_REASON_KEYS,
  MANUAL_OVERRIDE_REASONS,
  releaseHandoverBeacon,
  useMarketHandover,
  type HandoverAuthorization,
} from "../../../../../shared/api/hooks/useMarketHandover";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useManifestScanner } from "../../../../../shared/hooks/useManifestScanner";
import { useMarketQrScanner } from "../../../../../shared/hooks/useMarketQrScanner";
import { formatPhone } from "../../../../../shared/helpers/formatPhone";
import PinInput from "../../../../../shared/components/pin-input";
import { normalizeQrToken } from "../../../../../shared/helpers/normalizeQrToken";
import { BASE_URL } from "../../../../../shared/const";
import {
  formatMmSs,
  useSecondsCountdown,
} from "../../../../../shared/hooks/useSecondsCountdown";
import {
  formatMoment,
  returnAgeTone,
} from "../../../../../shared/lib/returnStage";
import ReplacementBadge from "../../../../../shared/components/replacement-badge";
import {
  buildManualOverrides,
  canSubmitBatch,
  manualSelection,
  missingReasonIds,
} from "./handover.logic";

/**
 * Bir sahifada ko'rsatiladigan maksimal posilka.
 *
 * ⚠️ Market bir kelganda 100–200 posilka olib ketadi, shuning uchun manifest
 * BIR MARTA to'liq yuklanadi — skaner har skanni xotiradan ~0ms da
 * tekshiradi (sahifalash bo'lsa skaner yarim ro'yxatni "topilmadi" deb rad
 * etardi).
 */
const MANIFEST_LIMIT = 200;
/** Market PIN uzunligi — server `createConsent` bilan AYNI. */
const PIN_LENGTH = 6;

const money = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("uz-UZ")} so'm`;

/** Yosh bo'yicha rang. Sinflar LITERAL (Tailwind shablondan sinf yasamaydi). */
/** Desktop skeleton — `order-view` dagi naqsh. */
const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
      </td>
    ))}
  </tr>
);

/** Mobil skeleton. */
const MobileCardSkeleton = () => (
  <div className="animate-pulse rounded-xl bg-white p-3 dark:bg-[#2A263D]">
    <div className="mb-2 flex items-center gap-2">
      <div className="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-3 rounded bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
  </div>
);

/**
 * MARKETGA TOPSHIRISH SESSIYASI.
 *
 * Oqim: market QR'ini APPARAT SKANER o'qiydi (sahifaga kirgan zahoti aktiv,
 * tugma bosish SHART EMAS) → 10 daqiqalik ruxsat → posilkalarni skanerlab
 * partiya-partiya topshirish → «Yakunlash».
 *
 * ⚠️ IKKI SKANER, BIRI AKTIV: ruxsat ochilmaguncha faqat market-QR
 * tinglovchisi, ochilgandan keyin faqat posilka manifesti ishlaydi. Ikkisi
 * bir vaqtda yoqilsa ayni skan ikki marta ishlanardi.
 *
 * ⚠️ RUXSAT SAHIFAGA BOG'LANGAN: har 30 s heartbeat, chiqishda yopiladi.
 * Market ketgandan keyin ruxsat amalda qolsa «market ruxsat berdi» dalili
 * ishonchini yo'qotadi.
 *
 * ⚠️ ELCHI FRONTENDIDAGI IKKI NUQSON ATAYLAB TAKRORLANMAYDI: (1) QR
 * o'qilgach BARCHA buyurtma avtomatik tanlanmaydi — faqat jismonan
 * skanerlangani; (2) taymer ko'rinadi.
 */
function HandoverSession() {
  const { marketId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("marketReturns");
  const { handleApiError, handleSuccess, handleWarning } = useApiNotification();
  const {
    getAwaitingOrders,
    resolveAwaitingByToken,
    scan,
    heartbeat,
    complete,
    finish,
    offlineHandover,
  } = useMarketHandover();

  const [auth, setAuth] = useState<HandoverAuthorization | null>(null);
  const [pin, setPin] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [handedInSession, setHandedInSession] = useState(0);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [offlineForm, setOfflineForm] = useState({
    representative_name: "",
    representative_phone: "",
    reason: "",
  });

  const { data, isLoading, refetch } = getAwaitingOrders(marketId, {
    limit: MANIFEST_LIMIT,
  });
  // ⚠️ `useMemo` SHART: `data?.orders ?? []` har renderda YANGI massiv beradi
  // va pastdagi `manifest` useMemo'sini har renderda qayta hisoblashga
  // majburlardi (200 posilkada sezilarli).
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const total = Number(data?.total ?? 0);

  // ─────────────────── Ruxsat oynasi va heartbeat ───────────────────

  const left = useSecondsCountdown(auth?.remaining_seconds, auth?.session_id);

  useEffect(() => {
    if (auth && left <= 0) {
      setAuth(null);
      handleWarning(t("toastExpiredTitle"), t("toastExpiredBody"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, left]);

  useEffect(() => {
    if (!auth) return;
    const token = auth.authorization_token;
    const everyMs =
      Math.max(5, Number(auth.heartbeat_interval_seconds || 30)) * 1000;
    const id = setInterval(() => {
      heartbeat.mutate(token, {
        // Server ruxsatni yopgan bo'lsa ekranni DARHOL haqiqatga keltiramiz:
        // aks holda xodim topshirayotgandek o'ylab turib har bosishda xato
        // olardi.
        onError: () => setAuth(null),
      });
    }, everyMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.authorization_token]);

  const authRef = useRef<HandoverAuthorization | null>(null);
  authRef.current = auth;
  useEffect(() => {
    const close = () => {
      const token = authRef.current?.authorization_token;
      if (token) releaseHandoverBeacon(BASE_URL, token);
    };
    window.addEventListener("beforeunload", close);
    return () => {
      window.removeEventListener("beforeunload", close);
      close();
    };
  }, []);

  // ─────────────────────── Ruxsat ochish ───────────────────────

  const authorize = useCallback(
    (body: { qr_token?: string; pin?: string }) => {
      scan.mutate(
        { ...body, market_id: marketId },
        {
          onSuccess: (res) => {
            setAuth(res);
            setPin("");
            setHandedInSession(0);
            handleSuccess(t("toastConsentOpened"), t("toastScanParcels"));
          },
          onError: (err) => {
            /**
             * ⚠️ MAYDON TOZALANADI. Xato kod maydonda qolib ketardi:
             * ramka qizil, ichida esa ayni yaroqsiz raqamlar — xodim
             * ularni qo'lda o'chirishi kerak bo'lardi va «Tasdiqlash»
             * ayni xato kodni QAYTA yuborib, serverdagi 5 urinish
             * chegarasini bekorga yeyardi.
             */
            setPin("");
            handleApiError(err, t("toastConsentFailedScan"));
          },
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketId],
  );

  /**
   * MARKET QR SKANERI — sahifaga kirgan zahoti aktiv, TUGMA YO'Q.
   * Faqat ruxsat ochilmagan paytda ishlaydi.
   */
  useMarketQrScanner({
    enabled: !auth && !scan.isPending,
    onMarketToken: (token) => authorize({ qr_token: token }),
    onForeignToken: () =>
      handleWarning(t("toastNotMarketQrTitle"), t("toastNotMarketQrBody")),
  });

  // ─────────────────────── Posilka skaneri ───────────────────────

  const manifest = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.qr_code_token) map.set(normalizeQrToken(o.qr_code_token), o.id);
    }
    return map;
  }, [orders]);

  const selectedRef = useRef<string[]>([]);
  selectedRef.current = selectedIds;

  /**
   * Skaner tanlagan posilkalarni ALOHIDA belgilab boramiz.
   *
   * ⚠️ NEGA KERAK: qo'lda belgilangan (skanerlanmagan) posilka uchun YOPIQ
   * sabab majburiy — "yorliq o'qilmadi" dalili shunda yoziladi. Skanerlangani
   * sababsiz o'tadi. Bu farqni faqat shu yerda bilib olish mumkin.
   */
  const setSelectedFromScanner = useCallback<
    Dispatch<SetStateAction<string[]>>
  >((updater) => {
    const prev = selectedRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    const added = next.filter((id) => !prev.includes(id));
    setSelectedIds(next);
    if (added.length) {
      setScannedIds((s) => {
        const n = new Set(s);
        added.forEach((id) => n.add(id));
        return n;
      });
    }
  }, []);

  // ⚠️ So'rov QATLAMI hookda — sahifa `api` ni to'g'ridan-to'g'ri chaqirmaydi.
  const resolveMiss = useCallback(
    (token: string) => resolveAwaitingByToken(marketId, token),
    [resolveAwaitingByToken, marketId],
  );

  const { visualFeedback } = useManifestScanner({
    manifest,
    resolveMiss,
    setSelectedIds: setSelectedFromScanner,
    onMissResolved: refetch,
    resetKey: marketId,
    enabled: Boolean(auth),
  });

  // ─────────────────────────── Amallar ───────────────────────────

  const manualIds = useMemo(
    () => manualSelection(selectedIds, scannedIds),
    [selectedIds, scannedIds],
  );
  const missingReasons = useMemo(
    () => missingReasonIds(manualIds, reasons),
    [manualIds, reasons],
  );
  const submitEnabled = useMemo(
    () =>
      canSubmitBatch({
        authorized: Boolean(auth),
        selectedIds,
        scannedIds,
        reasons,
      }),
    [auth, selectedIds, scannedIds, reasons],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setScannedIds(new Set());
    setReasons({});
  }, []);

  const submitBatch = useCallback(() => {
    if (!auth || selectedIds.length === 0) return;
    complete.mutate(
      {
        market_id: marketId,
        order_ids: selectedIds,
        authorization_token: auth.authorization_token,
        manual_overrides: buildManualOverrides(manualIds, reasons),
      },
      {
        onSuccess: (res) => {
          handleSuccess(
            t("toastHandedTitle"),
            t("toastHandedBody", { count: res.handed_over }),
          );
          setHandedInSession((n) => n + Number(res.handed_over ?? 0));
          clearSelection();
          void refetch();
        },
        onError: (err) => handleApiError(err, t("toastHandoverFailed")),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, selectedIds, manualIds, reasons, marketId]);

  const finishSession = useCallback(() => {
    if (!auth) return;
    finish.mutate(auth.authorization_token, {
      onSuccess: () => {
        setAuth(null);
        clearSelection();
        handleSuccess(
          t("toastFinishedTitle"),
          handedInSession > 0
            ? t("toastFinishedBody", { count: handedInSession })
            : t("toastSessionClosed"),
        );
      },
      onError: () => setAuth(null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, handedInSession]);

  const submitOffline = useCallback(() => {
    if (selectedIds.length === 0) return;
    offlineHandover.mutate(
      { market_id: marketId, order_ids: selectedIds, ...offlineForm },
      {
        onSuccess: (res) => {
          handleSuccess(
            t("toastOfflineTitle"),
            t("parcelsCount", { count: res.handed_over }),
          );
          setOfflineOpen(false);
          clearSelection();
          setOfflineForm({
            representative_name: "",
            representative_phone: "",
            reason: "",
          });
          void refetch();
        },
        onError: (err) => handleApiError(err, t("toastOfflineFailed")),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, selectedIds, offlineForm]);

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // ─────────────────────────── Ko'rinish ───────────────────────────

  const scannedCount = selectedIds.filter((id) => scannedIds.has(id)).length;

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 pb-28 sm:px-6 lg:px-8">
      {/* ─────── Sarlavha ─────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate("/awaiting-market")}
        />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-gray-800 dark:text-white">
            {t("handoverTitle")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("atCenterParcels", { count: total })}
            {total > MANIFEST_LIMIT
              ? ` · ${t("onScreenLimit", { count: MANIFEST_LIMIT })}`
              : ""}
            {handedInSession > 0
              ? ` · ${t("handedThisSession", { count: handedInSession })}`
              : ""}
          </p>
        </div>

        <Button
          className="ml-auto"
          icon={<FileSignature className="h-4 w-4" />}
          disabled={selectedIds.length === 0 || Boolean(auth)}
          onClick={() => setOfflineOpen(true)}
          title={
            auth ? t("offlineActDisabledHint") : t("offlineActHint")
          }
        >
          {t("offlineAct")}
        </Button>
      </div>

      {/* ─────── Ruxsat holati — INGICHKA chiziq ─────── */}
      {/*
        ⚠️ Ilgari bu ikki holat BALAND karta edi va 1080p ekranda ro'yxatdan
        atigi bir-ikki posilka ko'rinardi. Xodimga ish boshlangach RO'YXAT
        kerak, chaqiriq emas — shuning uchun marketplace qabulidagi ixcham
        naqsh: bitta ingichka qator.
      */}
      {!auth ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-900/10">
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-amber-400 opacity-50" />
              <QrCode className="relative h-4 w-4 text-amber-700 dark:text-amber-400" />
            </span>
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {t("scannerReadyMarketQr")}
            </span>
            {scan.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
            )}
          </span>

          <span className="hidden h-4 w-px bg-amber-300/60 sm:block dark:bg-amber-800" />

          <span className="inline-flex items-center gap-2">
            <span className="text-xs text-amber-700/80 dark:text-amber-300/70">
              {t("orPin")}
            </span>
            <PinInput
              value={pin}
              onChange={setPin}
              // To'lgan zahoti yuboriladi; tugma faqat qayta urinish uchun.
              onComplete={(digits) => authorize({ pin: digits })}
              disabled={scan.isPending}
              // Maydon tozalangani uchun `pin.length` ga tayanib
              // bo'lmaydi — xato yorlig'i so'nggi urinish natijasidan.
              invalid={scan.isError && pin.length === 0}
              length={PIN_LENGTH}
            />
            <button
              type="button"
              disabled={pin.length !== PIN_LENGTH || scan.isPending}
              onClick={() => authorize({ pin })}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 text-sm font-semibold text-white transition-all hover:from-purple-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700"
            >
              {scan.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {t("confirm")}
            </button>
          </span>

          <span className="ml-auto text-xs text-amber-700/70 dark:text-amber-300/60">
            {t("marketShouldPressCta")}
          </span>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-emerald-400 opacity-50" />
              <QrCode className="relative h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </span>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t("scannerReadyParcels")}
            </span>
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
              left < 60
                ? "animate-pulse bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
            title={t("expiresInHint")}
          >
            <Timer className="h-3.5 w-3.5" />
            {formatMmSs(left)}
          </span>

          {handedInSession > 0 && (
            <span className="text-xs text-emerald-700/80 dark:text-emerald-300/70">
              {t("handedThisSession", { count: handedInSession })}
            </span>
          )}

          <Button
            size="small"
            className="ml-auto"
            onClick={finishSession}
            loading={finish.isPending}
          >
            {t("finish")}
          </Button>
        </div>
      )}
      {/* ─────── Skaner javobi ─────── */}
      {visualFeedback.show && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            visualFeedback.type === "success"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : visualFeedback.type === "warning"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {visualFeedback.message}
        </div>
      )}

      {/* ─────── Ro'yxat sarlavhasi ─────── */}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          {t("parcelsCount", { count: orders.length })}
        </span>
        {selectedIds.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <PackageCheck className="h-4 w-4" />
              {t("scannedCount", { count: scannedCount })}
            </span>
            {manualIds.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                {t("manualCount", { count: manualIds.length })}
              </span>
            )}
            <button
              type="button"
              className="ml-auto text-gray-400 underline hover:text-gray-600"
              onClick={clearSelection}
            >
              {t("clearSelection")}
            </button>
          </>
        )}
      </div>

      {/* ─────── Posilkalar ─────── */}
      {/*
        Ko'rinish loyihaning ro'yxat naqshini ko'chiradi: mobilda karta
        (`block lg:hidden`), desktopda jadval (`hidden lg:block`, gradient
        sarlavha, skeleton, antd `Empty`).

        ⚠️ IKKI KO'RINISH BIR XIL TANLOV HOLATINI boshqaradi (`selectedIds`)
        — skaner qaysi ko'rinishda ishlayotganidan qat'i nazar.
      */}

      {/* Mobil: karta */}
      <div className="block space-y-2 lg:hidden">
        {isLoading ? (
          [...Array(4)].map((_, i) => <MobileCardSkeleton key={i} />)
        ) : orders.length === 0 ? (
          <div className="rounded-xl bg-white py-12 text-center dark:bg-[#2A263D]">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="m-0 font-semibold text-gray-700 dark:text-gray-200">
              {t("noneLeft")}
            </p>
          </div>
        ) : (
          orders.map((o) => {
            const checked = selectedIds.includes(o.id);
            const manual = checked && !scannedIds.has(o.id);
            return (
              <div
                key={o.id}
                /*
                  ⚠️ BUTUN KARTA BOSILADI. antd Checkbox 20px — telefonda
                  teginish nishoni sifatida kichik (44px talab). Loyihadagi
                  naqsh (refused-mail-detail): karta `onClick` bilan
                  almashtiradi, checkbox esa faqat vizual.
                */
                onClick={() => auth && toggle(o.id)}
                className={`rounded-xl border p-3 transition-colors ${
                  auth ? "cursor-pointer" : ""
                } ${
                  manual
                    ? "border-orange-300 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-900/10"
                    : checked
                      ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/10"
                      : "border-gray-100 bg-white dark:border-gray-800 dark:bg-[#2A263D]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="-m-2 p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      disabled={!auth}
                    />
                  </span>
                  {/* ISM birinchi, yorliq raqami OSTIDA kichikroq. */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-gray-800 dark:text-white">
                      {o.customer_name || "—"}
                    </span>
                    <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      #{o.order_number}
                    </span>
                  </span>
                  <ReplacementBadge order={o} />
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${returnAgeTone(o.age_days)}`}
                    title={t("ageHint")}
                  >
                    {t("days", { count: o.age_days })}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  {/* ⚠️ TELEFON KATTA — qatorni ko'z bilan solishtirishda
                      kichik shrift xato beradi. */}
                  {o.customer_phone && (
                    <a
                      href={`tel:${o.customer_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex w-full items-center gap-1.5 py-1 text-base font-semibold tabular-nums text-purple-700 dark:text-purple-300"
                    >
                      <Phone className="h-4 w-4 shrink-0 text-emerald-500" />
                      {formatPhone(o.customer_phone)}
                    </a>
                  )}
                  {(o.region_name || o.district_name) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      {[o.region_name, o.district_name]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {money(o.total_price)}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Package className="h-3 w-3 text-gray-400" />
                    {t("pcs", { count: Number(o.product_quantity ?? 0) })}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {o.escalated && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" />
                      {t("overdue")}
                    </span>
                  )}
                  {checked && !manual && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("scanned")}
                    </span>
                  )}
                  {manual && (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        <AlertTriangle className="h-3 w-3" />
                        {t("notScanned")}
                      </span>
                      <Select
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                        placeholder={t("chooseReason")}
                        value={reasons[o.id]}
                        onChange={(v) =>
                          setReasons((r) => ({ ...r, [o.id]: v as string }))
                        }
                        className="min-w-[200px]"
                        status={reasons[o.id] ? undefined : "error"}
                        options={MANUAL_OVERRIDE_REASONS.map((r) => ({
                          // ⚠️ `value` TARJIMA QILINMAYDI — server `@IsIn`.
                          value: r,
                          label: t(MANUAL_OVERRIDE_REASON_KEYS[r]),
                        }))}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop: jadval */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block dark:border-gray-800 dark:bg-[#2A263D]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <th className="w-12 px-4 py-4" />
                <th className="w-14 px-4 py-4 text-left text-sm font-semibold">
                  {t("colIndex")}
                </th>
                <th className="min-w-[200px] px-4 py-4 text-left text-sm font-semibold">
                  {t("colCustomer")}
                </th>
                <th className="min-w-[160px] whitespace-nowrap px-4 py-4 text-left text-sm font-semibold">
                  {t("colPhone")}
                </th>
                <th className="min-w-[150px] px-4 py-4 text-left text-sm font-semibold">
                  {t("colAddress")}
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold">
                  {t("colPrice")}
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-left text-sm font-semibold">
                  {t("colReceived")}
                </th>
                <th className="min-w-[260px] px-4 py-4 text-left text-sm font-semibold">
                  {t("colScanStatus")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                [...Array(8)].map((_, i) => <TableRowSkeleton key={i} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                    <p className="m-0 font-semibold text-gray-700 dark:text-gray-200">
                      {t("noneLeft")}
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((o, index) => {
                  const checked = selectedIds.includes(o.id);
                  const manual = checked && !scannedIds.has(o.id);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => auth && toggle(o.id)}
                      className={`transition-colors ${auth ? "cursor-pointer" : ""} ${
                        manual
                          ? "bg-orange-50/60 dark:bg-orange-900/10"
                          : checked
                            ? "bg-emerald-50/60 dark:bg-emerald-900/10"
                            : "hover:bg-purple-50 dark:hover:bg-[#3d3759]"
                      }`}
                    >
                      <td
                        className="px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggle(o.id)}
                          disabled={!auth}
                        />
                      </td>
                      {/* Tartib raqami — yorliq raqami ism OSTIDA turadi. */}
                      <td className="px-4 py-4 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <span className="block truncate font-semibold text-gray-800 dark:text-white">
                            {o.customer_name || "—"}
                          </span>
                          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                            #{o.order_number}
                          </span>
                          <ReplacementBadge order={o} className="mt-0.5" />
                        </div>
                      </td>
                      {/* ⚠️ TELEFON KATTA: xodim topshirishdan oldin mijozga
                          emas, MARKETga tekshirish uchun o'qiydi — qatorni
                          ko'z bilan solishtirishda kichik shrift xato beradi.
                          `stopPropagation` — bosilganda qator TANLANMASIN. */}
                      <td
                        className="whitespace-nowrap px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {o.customer_phone ? (
                          <a
                            href={`tel:${o.customer_phone}`}
                            className="text-base font-semibold tabular-nums text-purple-700 hover:underline dark:text-purple-300"
                          >
                            {formatPhone(o.customer_phone)}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          {o.region_name || "—"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {o.district_name || "—"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {o.where_deliver === "center"
                            ? t("deliverCenter")
                            : t("deliverAddress")}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-gray-800 dark:text-white">
                        <div>{money(o.total_price)}</div>
                        <div className="text-xs font-normal text-gray-400">
                          {t("pcs", {
                            count: Number(o.product_quantity ?? 0),
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm tabular-nums text-gray-600 dark:text-gray-300">
                        {formatMoment(o.center_received_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${returnAgeTone(o.age_days)}`}
                            title={t("ageHint")}
                          >
                            {t("days", { count: o.age_days })}
                          </span>
                          {o.escalated && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              <AlertTriangle className="h-3 w-3" />
                              {t("overdue")}
                            </span>
                          )}
                          {checked && !manual && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("scanned")}
                            </span>
                          )}
                          {manual && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                <AlertTriangle className="h-3 w-3" />
                                {t("notScanned")}
                              </span>
                              <Select
                                onClick={(e) => e.stopPropagation()}
                                size="small"
                                placeholder={t("chooseReason")}
                                value={reasons[o.id]}
                                onChange={(v) =>
                                  setReasons((r) => ({
                                    ...r,
                                    [o.id]: v as string,
                                  }))
                                }
                                className="min-w-[200px]"
                                status={reasons[o.id] ? undefined : "error"}
                                options={MANUAL_OVERRIDE_REASONS.map((r) => ({
                                  // ⚠️ `value` TARJIMA QILINMAYDI.
                                  value: r,
                                  label: t(MANUAL_OVERRIDE_REASON_KEYS[r]),
                                }))}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ─────── Pastdagi yopishqoq panel ─────── */}
      {selectedIds.length > 0 && (
        /*
          ⚠️ MOBIL NAV USTIDA. Mobil navigatsiya `fixed bottom-0 z-50` va
          ~60px baland, DOM'da bu paneldan KEYIN render bo'ladi — ya'ni
          `bottom-0` + past z-index bo'lsa tugma telefonda nav ostida qolib
          BOSILMAYDI. Loyihadagi to'g'ri naqsh: `max-[650px]:bottom-20`
          (courier-bulk, AiFinanceChat).
        */
        <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-gray-200 bg-white/95 py-3 backdrop-blur max-[650px]:bottom-20 max-[650px]:rounded-t-2xl max-[650px]:border dark:border-gray-800 dark:bg-[#2A263D]/95">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
            <span className="text-base font-bold tabular-nums text-gray-800 dark:text-white">
              {t("selectedCount", { count: selectedIds.length })}
            </span>
            {missingReasons.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {t("reasonNeededCount", { count: missingReasons.length })}
              </span>
            )}
            {!auth && (
              <span className="text-sm text-amber-700">
                {t("waitingConsent")}
              </span>
            )}
            <Button
              type="primary"
              size="large"
              className="ml-auto"
              disabled={!submitEnabled}
              loading={complete.isPending}
              onClick={submitBatch}
            >
              {t("submitHandover", { count: selectedIds.length })}
            </Button>
          </div>
        </div>
      )}

      {/* ─────── Offline akt ─────── */}
      <Modal
        open={offlineOpen}
        onCancel={() => setOfflineOpen(false)}
        onOk={submitOffline}
        okText={t("offlineSubmit")}
        confirmLoading={offlineHandover.isPending}
        okButtonProps={{
          disabled:
            offlineForm.representative_name.trim().length < 3 ||
            offlineForm.representative_phone.trim().length < 7 ||
            offlineForm.reason.trim().length < 5,
        }}
        title={t("offlineModalTitle")}
      >
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {t("offlineModalHint")}
        </p>
        {/* ⚠️ YORLIQLAR SHART. Avval uch maydon faqat placeholder bilan
            turardi: xodim yozishni boshlagach nima so'ralganini ko'rmay
            qolardi, akt esa HISOBOTGA kiradi — vakil ismi noto'g'ri
            yozilsa topshirish dalili yo'qoladi. */}
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="rep-name" className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {t("repName")} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="rep-name"
                type="text"
                placeholder={t("repName")}
                value={offlineForm.representative_name}
                onChange={(e) =>
                  setOfflineForm((f) => ({
                    ...f,
                    representative_name: e.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 transition-all placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-[#312D4B] dark:text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rep-phone" className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {t("repPhone")} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="rep-phone"
                // Telefonda raqamli klaviatura; `type=tel` harf ham qabul
                // qiladi (ba'zi vakillar «+998 (90)» ko'rinishida yozadi).
                type="tel"
                inputMode="tel"
                placeholder="+998 90 123 45 67"
                value={offlineForm.representative_phone}
                onChange={(e) =>
                  setOfflineForm((f) => ({
                    ...f,
                    representative_phone: e.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 transition-all placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-[#312D4B] dark:text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="offline-reason" className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {t("offlineReason")} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <textarea
                id="offline-reason"
                rows={2}
                placeholder={t("offlineReason")}
                value={offlineForm.reason}
                onChange={(e) =>
                  setOfflineForm((f) => ({ ...f, reason: e.target.value }))
                }
                className="min-h-[64px] py-2 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 transition-all placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-[#312D4B] dark:text-white resize-y"
              />
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {t("offlineWillHand", { count: selectedIds.length })}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default memo(HandoverSession);
