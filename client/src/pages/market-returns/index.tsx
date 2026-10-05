import { memo, useCallback, useMemo, useState } from "react";
import { Button, Empty, Input, Pagination } from "antd";
import {
  AlertTriangle,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import {
  useMarketHandover,
  type ConsentSession,
} from "../../shared/api/hooks/useMarketHandover";
import { useApiNotification } from "../../shared/hooks/useApiNotification";
import ConsentModal from "./ConsentModal";

const PAGE_SIZE = 20;

const money = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("uz-UZ")} so'm`;

/**
 * Yosh bo'yicha rang — market "qancha vaqt bizda turgan"ini KO'Z BILAN
 * ko'rishi kerak. Oyiga ~4 500 qaytarish oqimida ro'yxat raqamlardan
 * iborat devor bo'lib qoladi; rang uni o'qiladigan qiladi.
 *
 * ⚠️ Sinflar LITERAL — Tailwind shablon ifodasidan sinf yasay olmaydi.
 */
const ageTone = (days: number) =>
  days >= 7
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : days >= 3
      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

/**
 * MARKET — MARKAZDA TURGAN QAYTARISHLAR.
 *
 * ⚠️ NEGA BU SAHIFA BOR. Avval bekor qilingan posilka markaz uni qabul
 * qilgan zahoti "yopilgan" bo'lib ketardi va market HECH NARSANI
 * tasdiqlamasdi — mol omborda turgan bo'lsa ham. Endi market shu yerdan
 * ko'radi: nechta posilka markazda, qanchadan beri turgan, va
 * «Topshirishga ruxsat beraman» tugmasi bilan ruxsat (QR + PIN) beradi.
 */
function MarketReturns() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [session, setSession] = useState<ConsentSession | null>(null);

  const { getMyReturns, getMyReturnCounts, createConsent } =
    useMarketHandover();
  const { handleApiError } = useApiNotification();

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [page, search],
  );

  const { data, isLoading, isFetching, refetch } = getMyReturns(params);
  const { data: counts } = getMyReturnCounts();

  const requestConsent = useCallback(() => {
    setModalOpen(true);
    createConsent.mutate(undefined, {
      onSuccess: (res) => setSession(res),
      onError: (err) => {
        setModalOpen(false);
        handleApiError(err, "Ruxsat yaratilmadi");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSession(null);
  }, []);

  const orders = data?.orders ?? [];
  const awaiting = Number(counts?.awaiting ?? 0);
  const oldestDays = Number(counts?.oldest_age_days ?? 0);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 lg:px-8">
      {/* ─────── Sarlavha ─────── */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Warehouse className="h-5 w-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Qaytarilgan buyurtmalar
            </h1>
            <p className="text-sm text-gray-500">
              Markazda sizni kutayotgan bekor qilingan posilkalar
            </p>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<ShieldCheck className="h-4 w-4" />}
          disabled={awaiting === 0}
          loading={createConsent.isPending && modalOpen}
          onClick={requestConsent}
        >
          Topshirishga ruxsat beraman
        </Button>
      </div>

      {/* ─────── Xulosa ─────── */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Markazda turgan
          </div>
          <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {awaiting} dona
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Eng uzoq turgani
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {oldestDays} kun
            </span>
            {oldestDays >= 7 && (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Qanday olinadi
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Ruxsat bering → QR/PIN'ni xodimga ko'rsating → posilkalarni oling
          </div>
        </div>
      </div>

      {/* ─────── Qidiruv ─────── */}
      <div className="mb-3 flex items-center gap-2">
        <Input
          allowClear
          prefix={<Search className="h-4 w-4 text-gray-400" />}
          placeholder="Buyurtma raqami yoki QR kodi"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Button
          icon={<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}
          onClick={() => void refetch()}
        >
          Yangilash
        </Button>
      </div>

      {/* ─────── Ro'yxat ─────── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-10 dark:border-gray-800 dark:bg-gray-900">
          <Empty
            description={
              search.trim()
                ? "Qidiruv bo'yicha hech narsa topilmadi"
                : "Markazda kutayotgan qaytarish yo'q"
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <Package className="h-4 w-4 text-gray-500" />
              </div>
              <div className="min-w-[110px]">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  #{o.order_number}
                </div>
                <div className="text-xs text-gray-500">{money(o.total_price)}</div>
              </div>

              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                Markazda
              </span>

              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${ageTone(o.age_days)}`}
              >
                {o.age_days} kun
              </span>

              {o.is_replacement_return && (
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  Almashtirish
                </span>
              )}

              {o.escalated && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3" />
                  Muddati o'tdi
                </span>
              )}

              {/* ⚠️ Xom QR token ATAYLAB ko'rsatilmaydi: u xodim skanerlaydigan
                  yorliq, market uchun ma'nosiz shovqin. O'rniga posilka
                  qachon markazga kelgani ko'rsatiladi. */}
              <span className="ml-auto text-xs text-gray-400">
                {o.center_received_at
                  ? new Date(Number(o.center_received_at)).toLocaleDateString(
                      "uz-UZ",
                      { day: "2-digit", month: "2-digit", year: "numeric" },
                    )
                  : ""}
              </span>
            </div>
          ))}

          {Number(data?.total ?? 0) > PAGE_SIZE && (
            <div className="mt-3 flex justify-end">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={Number(data?.total ?? 0)}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      <ConsentModal
        open={modalOpen}
        onClose={closeModal}
        session={session}
        loading={createConsent.isPending}
        onRegenerate={requestConsent}
      />
    </div>
  );
}

export default memo(MarketReturns);
