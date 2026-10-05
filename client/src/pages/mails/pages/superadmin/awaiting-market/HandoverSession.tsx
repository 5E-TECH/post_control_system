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
import { Button, Checkbox, Input, Modal, Select } from "antd";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  KeyRound,
  Loader2,
  Package,
  PackageCheck,
  ShieldCheck,
  Timer,
  Calendar,
  MapPin,
  Phone,
  QrCode,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  MANUAL_OVERRIDE_REASONS,
  releaseHandoverBeacon,
  useMarketHandover,
  type HandoverAuthorization,
} from "../../../../../shared/api/hooks/useMarketHandover";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useManifestScanner } from "../../../../../shared/hooks/useManifestScanner";
import { useMarketQrScanner } from "../../../../../shared/hooks/useMarketQrScanner";
import { normalizeQrToken } from "../../../../../shared/helpers/normalizeQrToken";
import { api } from "../../../../../shared/api";
import { BASE_URL } from "../../../../../shared/const";
import {
  formatMmSs,
  useSecondsCountdown,
} from "../../../../../shared/hooks/useSecondsCountdown";
import { formatMoment } from "../../../../../shared/lib/returnStage";
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

const money = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("uz-UZ")} so'm`;

/** Yosh bo'yicha rang. Sinflar LITERAL (Tailwind shablondan sinf yasamaydi). */
const ageTone = (days: number) =>
  days >= 14
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : days >= 7
      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      : days >= 3
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

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
  const { handleApiError, handleSuccess, handleWarning } = useApiNotification();
  const {
    getAwaitingOrders,
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
      handleWarning(
        "Ruxsat tugadi",
        "10 daqiqalik oyna tugadi — market yangi QR ko'rsatsin",
      );
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
            handleSuccess("Ruxsat ochildi", "Posilkalarni skanerlang");
          },
          onError: (err) => handleApiError(err, "Ruxsat ochilmadi"),
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
      handleWarning(
        "Bu market QR'i emas",
        "Avval market kabinetidagi ruxsat QR'ini o'qiting",
      ),
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

  const resolveMiss = useCallback(
    async (token: string): Promise<string | null> => {
      const res = await api.get(`market-handover/awaiting/${marketId}`, {
        params: { search: token, limit: 1 },
      });
      return res?.data?.data?.orders?.[0]?.id ?? null;
    },
    [marketId],
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
            "Topshirildi",
            `${res.handed_over} ta posilka marketga topshirildi`,
          );
          setHandedInSession((n) => n + Number(res.handed_over ?? 0));
          clearSelection();
          void refetch();
        },
        onError: (err) => handleApiError(err, "Topshirib bo'lmadi"),
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
          "Yakunlandi",
          handedInSession > 0
            ? `${handedInSession} ta posilka topshirildi`
            : "Sessiya yopildi",
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
            "Offline akt bilan topshirildi",
            `${res.handed_over} ta posilka`,
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
        onError: (err) => handleApiError(err, "Offline akt yozilmadi"),
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
          <h1 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">
            Marketga topshirish
          </h1>
          <p className="text-sm text-gray-500">
            Markazda {total} ta posilka
            {total > MANIFEST_LIMIT ? ` · ekranda ${MANIFEST_LIMIT} tasi` : ""}
            {handedInSession > 0
              ? ` · bu sessiyada ${handedInSession} ta topshirildi`
              : ""}
          </p>
        </div>

        <Button
          className="ml-auto"
          icon={<FileSignature className="h-4 w-4" />}
          disabled={selectedIds.length === 0 || Boolean(auth)}
          onClick={() => setOfflineOpen(true)}
          title={
            auth
              ? "Ruxsat ochiq — oddiy topshirishdan foydalaning"
              : "Market panelga kira olmasa: vakil akti bilan topshirish"
          }
        >
          Offline akt
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
              Skaner tayyor — market QR'ini o'qiting
            </span>
            {scan.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
            )}
          </span>

          <span className="hidden h-4 w-px bg-amber-300/60 sm:block dark:bg-amber-800" />

          <span className="inline-flex items-center gap-2">
            <span className="text-xs text-amber-700/80 dark:text-amber-300/70">
              yoki PIN
            </span>
            <Input
              size="small"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              prefix={<KeyRound className="h-3.5 w-3.5 text-gray-400" />}
              className="w-[132px] text-center font-mono tracking-[0.2em]"
              onPressEnter={() => pin.length === 6 && authorize({ pin })}
            />
            <Button
              size="small"
              type="primary"
              loading={scan.isPending}
              disabled={pin.length !== 6}
              onClick={() => authorize({ pin })}
            >
              Tasdiqlash
            </Button>
          </span>

          <span className="ml-auto text-xs text-amber-700/70 dark:text-amber-300/60">
            Market kabinetida «Topshirishga ruxsat beraman» tugmasini bossin
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
              Skaner tayyor — posilka yorliqlarini o'qiting
            </span>
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
              left < 60
                ? "animate-pulse bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
            title="Ruxsat shu vaqtdan keyin tugaydi"
          >
            <Timer className="h-3.5 w-3.5" />
            {formatMmSs(left)}
          </span>

          {handedInSession > 0 && (
            <span className="text-xs text-emerald-700/80 dark:text-emerald-300/70">
              {handedInSession} ta topshirildi
            </span>
          )}

          <Button
            size="small"
            className="ml-auto"
            onClick={finishSession}
            loading={finish.isPending}
          >
            Yakunlash
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
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          {orders.length} ta posilka
        </span>
        {selectedIds.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <PackageCheck className="h-4 w-4" />
              {scannedCount} skanerlandi
            </span>
            {manualIds.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                {manualIds.length} qo'lda
              </span>
            )}
            <button
              type="button"
              className="ml-auto text-gray-400 underline hover:text-gray-600"
              onClick={clearSelection}
            >
              Tanlovni tozalash
            </button>
          </>
        )}
      </div>

      {/* ─────── Posilkalar ─────── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <p className="m-0 font-semibold text-gray-700 dark:text-gray-200">
            Bu marketda topshiriladigan posilka qolmadi
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((o) => {
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
                      : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
                }`}
              >
                {/* ── 1-qator: kim, nima, holati ── */}
                <div className="flex flex-wrap items-center gap-3">
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
                  <span className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    #{o.order_number}
                  </span>

                  {/*
                    ⚠️ MIJOZ ISMI — raqamdan muhimroq. Xodim 150 posilka
                    orasidan qaysi birini topshirayotganini yorliq raqamiga
                    emas, odamga qarab ham tekshiradi (pochta ichidagi
                    buyurtma kartasi bilan bir xil to'plam).
                  */}
                  <span className="min-w-0 flex-1 truncate font-semibold text-gray-800 dark:text-gray-200">
                    {o.customer_name || "—"}
                  </span>

                  <ReplacementBadge order={o} />

                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${ageTone(o.age_days)}`}
                    title="Markazda qancha turgani"
                  >
                    {o.age_days} kun
                  </span>

                  {o.escalated && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" />
                      Muddati o'tdi
                    </span>
                  )}

                  {checked && !manual && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Skanerlandi
                    </span>
                  )}

                  {manual && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        <AlertTriangle className="h-3 w-3" />
                        Skanerlanmadi
                      </span>
                      <Select
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                        placeholder="Sababni tanlang"
                        value={reasons[o.id]}
                        onChange={(v) =>
                          setReasons((r) => ({ ...r, [o.id]: v as string }))
                        }
                        className="min-w-[210px]"
                        status={reasons[o.id] ? undefined : "error"}
                        options={MANUAL_OVERRIDE_REASONS.map((r) => ({
                          value: r,
                          label: r,
                        }))}
                      />
                    </div>
                  )}
                </div>

                {/* ── 2-qator: posilka tafsilotlari ── */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-300">
                  {o.customer_phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {o.customer_phone}
                    </span>
                  )}
                  {o.district_name && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      {o.district_name}
                    </span>
                  )}
                  {o.where_deliver && (
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3 w-3 text-gray-400" />
                      {o.where_deliver === "center" ? "Markazga" : "Manzilga"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-800 tabular-nums dark:text-gray-200">
                    {money(o.total_price)}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Package className="h-3 w-3 text-gray-400" />
                    {Number(o.product_quantity ?? 0)} dona
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    {formatMoment(o.created_at)}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300"
                    title="Viloyatdan markazga qabul qilingan vaqt"
                  >
                    <Warehouse className="h-3 w-3" />
                    {formatMoment(o.center_received_at)}
                  </span>
                  {o.comment && (
                    <span
                      className="min-w-0 max-w-[280px] truncate italic text-gray-500"
                      title={o.comment}
                    >
                      «{o.comment}»
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[11px] text-gray-400">
                    {o.qr_code_token}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────── Pastdagi yopishqoq panel ─────── */}
      {selectedIds.length > 0 && (
        /*
          ⚠️ MOBIL NAV USTIDA. Mobil navigatsiya `fixed bottom-0 z-50` va
          ~60px baland, DOM'da bu paneldan KEYIN render bo'ladi — ya'ni
          `bottom-0` + past z-index bo'lsa tugma telefonda nav ostida qolib
          BOSILMAYDI. Loyihadagi to'g'ri naqsh: `max-[650px]:bottom-20`
          (courier-bulk, AiFinanceChat).
        */
        <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-gray-200 bg-white/95 py-3 backdrop-blur max-[650px]:bottom-20 max-[650px]:rounded-t-2xl max-[650px]:border dark:border-gray-800 dark:bg-gray-900/95">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
            <span className="text-base font-bold tabular-nums text-gray-800 dark:text-gray-100">
              {selectedIds.length} ta tanlandi
            </span>
            {missingReasons.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {missingReasons.length} ta posilka uchun sabab kerak
              </span>
            )}
            {!auth && (
              <span className="text-sm text-amber-700">
                Market ruxsati kutilmoqda
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
              Marketga topshirish ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* ─────── Offline akt ─────── */}
      <Modal
        open={offlineOpen}
        onCancel={() => setOfflineOpen(false)}
        onOk={submitOffline}
        okText="Akt bilan topshirish"
        confirmLoading={offlineHandover.isPending}
        okButtonProps={{
          disabled:
            offlineForm.representative_name.trim().length < 3 ||
            offlineForm.representative_phone.trim().length < 7 ||
            offlineForm.reason.trim().length < 5,
        }}
        title="Offline akt — market QR'siz topshirish"
      >
        <p className="mb-3 text-sm text-gray-500">
          Market panelga kira olmasa ishlatiladi. Hisobotda market tasdig'idan
          AJRATIB ko'rsatiladi, shuning uchun vakil ma'lumoti majburiy.
        </p>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Vakilning ismi"
            value={offlineForm.representative_name}
            onChange={(e) =>
              setOfflineForm((f) => ({
                ...f,
                representative_name: e.target.value,
              }))
            }
          />
          <Input
            placeholder="Vakilning telefoni"
            value={offlineForm.representative_phone}
            onChange={(e) =>
              setOfflineForm((f) => ({
                ...f,
                representative_phone: e.target.value,
              }))
            }
          />
          <Input.TextArea
            rows={2}
            placeholder="Nega QR'siz topshirilmoqda"
            value={offlineForm.reason}
            onChange={(e) =>
              setOfflineForm((f) => ({ ...f, reason: e.target.value }))
            }
          />
          <div className="text-xs text-gray-400">
            {selectedIds.length} ta posilka topshiriladi
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default memo(HandoverSession);
