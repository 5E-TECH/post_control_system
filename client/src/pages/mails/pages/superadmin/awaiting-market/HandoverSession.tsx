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
  Camera,
  CheckCircle2,
  FileSignature,
  KeyRound,
  Loader2,
  Package,
  ShieldCheck,
  Timer,
} from "lucide-react";
import {
  MANUAL_OVERRIDE_REASONS,
  releaseHandoverBeacon,
  useMarketHandover,
  type HandoverAuthorization,
} from "../../../../../shared/api/hooks/useMarketHandover";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useManifestScanner } from "../../../../../shared/hooks/useManifestScanner";
import { normalizeQrToken } from "../../../../../shared/helpers/normalizeQrToken";
import { api } from "../../../../../shared/api";
import { BASE_URL } from "../../../../../shared/const";
import CourierCameraScanner from "../../../../../shared/components/courier-camera-scanner";
import {
  formatMmSs,
  useSecondsCountdown,
} from "../../../../../shared/hooks/useSecondsCountdown";
import {
  buildManualOverrides,
  canSubmitBatch,
  manualSelection,
  missingReasonIds,
} from "./handover.logic";

/**
 * Bir sahifada ko'rsatiladigan maksimal posilka.
 *
 * ⚠️ Market bir kelganda 100–200 posilka olib ketadi, shuning uchun
 * manifest BIR MARTA to'liq yuklanadi — skaner har skanni xotiradan
 * ~0ms da tekshiradi (sahifalash bo'lsa skaner yarim ro'yxatni
 * "topilmadi" deb rad etardi).
 */
const MANIFEST_LIMIT = 200;

const money = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("uz-UZ")} so'm`;

/**
 * MARKETGA TOPSHIRISH SESSIYASI.
 *
 * Oqim: market QR'ini skanerlash (yoki PIN) → 10 daqiqalik ruxsat →
 * posilkalarni skanerlab partiya-partiya topshirish → «Yakunlash».
 *
 * ⚠️ RUXSAT SAHIFAGA BOG'LANGAN. Sahifa har 30 s da heartbeat yuboradi va
 * chiqishda ruxsatni yopadi. Market ketgandan keyin ruxsat amalda qolib
 * ketsa «market ruxsat berdi» dalili ishonchini yo'qotadi.
 *
 * ⚠️ ELCHI FRONTENDIDAGI IKKI NUQSON ATAYLAB TAKRORLANMAYDI:
 *   1) QR skanerlangach BARCHA buyurtma avtomatik tanlanmaydi — faqat
 *      jismonan skanerlangani;
 *   2) taymer ko'rinadi (market yaroqsiz QR ko'rsatib turmaydi).
 */
function HandoverSession() {
  const { marketId = "" } = useParams();
  const navigate = useNavigate();
  const { handleApiError, handleSuccess } = useApiNotification();
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [offlineForm, setOfflineForm] = useState({
    representative_name: "",
    representative_phone: "",
    reason: "",
  });

  const { data, isLoading, refetch } = getAwaitingOrders(marketId, {
    limit: MANIFEST_LIMIT,
  });
  // ⚠️ `useMemo` SHART: `data?.orders ?? []` har renderda YANGI massiv
  // beradi va u pastdagi `manifest` useMemo'sini har renderda qayta
  // hisoblashga majburlardi (200 posilkada sezilarli).
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const total = Number(data?.total ?? 0);

  // ─────────────────── Ruxsat oynasi va heartbeat ───────────────────

  const left = useSecondsCountdown(auth?.remaining_seconds, auth?.session_id);

  useEffect(() => {
    if (auth && left <= 0) {
      setAuth(null);
      handleApiError(
        { response: { data: { message: "" } } },
        "Ruxsat tugadi",
        "10 daqiqalik oyna tugadi — market yangi QR ko'rsatsin",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, left]);

  // Heartbeat: sahifa ochiq turganini serverga bildiradi.
  useEffect(() => {
    if (!auth) return;
    const token = auth.authorization_token;
    const everyMs =
      Math.max(5, Number(auth.heartbeat_interval_seconds || 30)) * 1000;
    const id = setInterval(() => {
      heartbeat.mutate(token, {
        // Server ruxsatni yopgan bo'lsa (muddat/boshqa xodim) — ekranni
        // DARHOL haqiqatga keltiramiz, aks holda xodim topshirayotgandek
        // o'ylab turib har bosishda xato olardi.
        onError: () => setAuth(null),
      });
    }, everyMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.authorization_token]);

  // Sahifadan chiqishda / tab yopilganda ruxsatni YOPAMIZ.
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

  // ─────────────────────────── Skaner ───────────────────────────

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
   * Skaner tanlagan buyurtmalarni ALOHIDA belgilab boramiz.
   *
   * ⚠️ NEGA KERAK: qo'lda belgilangan (skanerlanmagan) posilka uchun
   * YOPIQ sabab majburiy — "yorliq o'qilmadi" dalili shunda yoziladi.
   * Skanerlangani esa sababsiz o'tadi. Bu farqni faqat shu yerda bilib
   * olish mumkin.
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
    // ⚠️ Skaner FAQAT ruxsat ochiq bo'lganda ishlaydi: ruxsatsiz skanerlash
    // xodimda "ish ketdi" tuyg'usini berib, keyin topshirishda xato chiqardi.
    enabled: Boolean(auth),
  });

  // ─────────────────────────── Amallar ───────────────────────────

  const authorize = useCallback(
    (body: { qr_token?: string; pin?: string }) => {
      scan.mutate(
        { ...body, market_id: marketId },
        {
          onSuccess: (res) => {
            setAuth(res);
            setPin("");
            setCameraOpen(false);
            handleSuccess(
              "Ruxsat ochildi",
              "Posilkalarni skanerlab topshiring",
            );
          },
          onError: (err) => handleApiError(err, "Ruxsat ochilmadi"),
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketId],
  );

  // Qoidalar `handover.logic.ts` da — u test bilan qulflangan.
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

  const submitBatch = useCallback(() => {
    if (!auth || selectedIds.length === 0) return;
    if (missingReasons.length > 0) {
      handleApiError(
        {},
        "Sabab kerak",
        "Qo'lda belgilangan posilkalar uchun sabab tanlanishi shart",
      );
      return;
    }
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
          setSelectedIds([]);
          setScannedIds(new Set());
          setReasons({});
          void refetch();
        },
        onError: (err) => handleApiError(err, "Topshirib bo'lmadi"),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, selectedIds, manualIds, missingReasons, reasons, marketId]);

  const finishSession = useCallback(() => {
    if (!auth) return;
    finish.mutate(auth.authorization_token, {
      onSuccess: () => {
        setAuth(null);
        setSelectedIds([]);
        setScannedIds(new Set());
        setReasons({});
        handleSuccess("Yakunlandi", "Topshirish sessiyasi yopildi");
      },
      onError: () => setAuth(null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

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
          setSelectedIds([]);
          setScannedIds(new Set());
          setReasons({});
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

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 pb-24 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-3">
        <Button
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate("/mails/awaiting-market")}
        />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Marketga topshirish
          </h1>
          <p className="text-sm text-gray-500">
            Markazda {total} ta posilka
            {total > MANIFEST_LIMIT
              ? ` (ekranda ${MANIFEST_LIMIT} tasi — qolganini topshirgandan keyin yangilang)`
              : ""}
          </p>
        </div>
      </div>

      {/* ─────── Ruxsat paneli ─────── */}
      {!auth ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="mb-3 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <ShieldCheck className="h-5 w-5" />
            Market ruxsati kerak
          </div>
          <p className="mb-3 text-sm text-amber-800/80 dark:text-amber-200/80">
            Market kabinetida «Topshirishga ruxsat beraman» tugmasini bossin.
            So'ng QR'ni skanerlang yoki 6 xonali PIN'ni kiriting.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="primary"
              icon={<Camera className="h-4 w-4" />}
              onClick={() => setCameraOpen(true)}
            >
              QR skanerlash
            </Button>
            <Input
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="PIN (6 xona)"
              prefix={<KeyRound className="h-4 w-4 text-gray-400" />}
              className="max-w-[180px] font-mono tracking-[0.2em]"
              onPressEnter={() => pin.length === 6 && authorize({ pin })}
            />
            <Button
              loading={scan.isPending}
              disabled={pin.length !== 6}
              onClick={() => authorize({ pin })}
            >
              Tasdiqlash
            </Button>

            <Button
              className="ml-auto"
              icon={<FileSignature className="h-4 w-4" />}
              disabled={selectedIds.length === 0}
              onClick={() => setOfflineOpen(true)}
              title="Market panelga kira olmasa — vakil akti bilan topshirish"
            >
              Offline akt ({selectedIds.length})
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
            Ruxsat ochiq — posilkalarni skanerlang
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums ${
              left < 60
                ? "animate-pulse bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
            <Timer className="h-4 w-4" />
            {formatMmSs(left)}
          </span>
          <Button
            icon={<Camera className="h-4 w-4" />}
            onClick={() => setCameraOpen(true)}
          >
            Kamera
          </Button>
          <Button className="ml-auto" onClick={finishSession} loading={finish.isPending}>
            Yakunlash
          </Button>
        </div>
      )}

      {/* ─────── Skaner feedback ─────── */}
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

      {/* ─────── Posilkalar ─────── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((o) => {
            const checked = selectedIds.includes(o.id);
            const manual = checked && !scannedIds.has(o.id);
            return (
              <div
                key={o.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                  checked
                    ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10"
                    : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
                }`}
              >
                <Checkbox checked={checked} onChange={() => toggle(o.id)} />
                <Package className="h-4 w-4 text-gray-400" />
                <div className="min-w-[110px]">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    #{o.order_number}
                  </div>
                  <div className="text-xs text-gray-500">
                    {money(o.total_price)}
                  </div>
                </div>

                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {o.age_days} kun
                </span>

                {o.is_replacement_return && (
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    Almashtirish
                  </span>
                )}

                {checked && !manual && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Skanerlandi
                  </span>
                )}

                {/* Qo'lda belgilangan — YOPIQ sabab majburiy */}
                {manual && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                      <AlertTriangle className="h-3 w-3" />
                      Qo'lda
                    </span>
                    <Select
                      size="small"
                      placeholder="Sabab"
                      value={reasons[o.id]}
                      onChange={(v) =>
                        setReasons((r) => ({ ...r, [o.id]: v as string }))
                      }
                      className="min-w-[190px]"
                      status={reasons[o.id] ? undefined : "error"}
                      options={MANUAL_OVERRIDE_REASONS.map((r) => ({
                        value: r,
                        label: r,
                      }))}
                    />
                  </div>
                )}

                <span className="ml-auto font-mono text-xs text-gray-400">
                  {o.qr_code_token}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────── Pastdagi yopishqoq panel ─────── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white/95 p-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
          <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4">
            <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">
              {selectedIds.length} ta tanlandi
            </span>
            {missingReasons.length > 0 && (
              <span className="text-sm text-red-600">
                {missingReasons.length} ta posilka uchun sabab kerak
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

      {/* ─────── Kamera ─────── */}
      <CourierCameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onToken={(token) => {
          // Market QR'i (MRC-…) — ruxsat ochadi. Posilka QR'lari esa
          // klaviatura-skaner orqali `useManifestScanner` ga tushadi.
          if (token.startsWith("MRC-")) authorize({ qr_token: token });
        }}
        statusText={auth ? "Posilka skaneri" : "Market QR'ini skanerlang"}
        hint={
          auth
            ? "Posilka yorlig'ini kameraga tuting"
            : "Market telefonidagi QR'ni kameraga tuting"
        }
        tone={auth ? "emerald" : "amber"}
      />

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
