import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Empty, Pagination, type PaginationProps } from "antd";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ChevronRight,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  Store,
  Warehouse,
} from "lucide-react";
import { useMarketHandover } from "../../../../../shared/api/hooks/useMarketHandover";
import { formatPhone } from "../../../../../shared/helpers/formatPhone";
import SearchInput from "../../../../../shared/components/search-input";
import BatchList from "../../../../handovers/BatchList";
import {
  formatMoment,
  returnAgeTone,
} from "../../../../../shared/lib/returnStage";
import { useDebouncedValue } from "../../../../../shared/hooks/useDebouncedValue";

const PAGE_SIZE = 30;

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
  <div className="animate-pulse rounded-xl bg-white p-4 dark:bg-[#2A263D]">
    <div className="mb-3 flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
  </div>
);

/**
 * XODIM NAVBATI — «Markazda, market kutilmoqda».
 *
 * ⚠️ MARKET BO'YICHA guruhlangan, POCHTA bo'yicha emas: market omborga O'Z
 * posilkalarini olishga keladi. Avval bu holat UMUMAN ko'rinmasdi (qabul
 * qilingan bekor pochta hech bir faol ro'yxatda yo'q edi), shuning uchun
 * posilkalar oylab jim qotib qolardi.
 *
 * Ko'rinish loyihaning ro'yxat naqshini ko'chiradi (`order-view`):
 * mobilda karta (`block lg:hidden`), desktopda jadval (`hidden lg:block`),
 * gradient sarlavha, skeleton yuklanish, antd `Empty`, markazlashgan
 * `Pagination`.
 */
function AwaitingMarket() {
  const navigate = useNavigate();
  const { t } = useTranslation("marketReturns");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  /**
   * TAB: navbat (hali topshirilmagan) yoki TOPSHIRILGANLAR tarixi.
   *
   * ⚠️ Alohida menyu bandi EMAS: ikkisi bitta ishning ikki tomoni —
   * «kim kutyapti» va «kimga berdik». Yon menyuda alohida band bo'lsa
   * xodim ikki joyni aylanib yurardi; mobil navda esa joy ham yo'q.
   *
   * ⚠️ HOLAT URL DA — partiya ichidan «Orqaga» qaytganda tab
   * tiklanishi uchun (mahalliy holat qayta mountda yo'qolardi).
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: "queue" | "handed" =
    searchParams.get("tab") === "handed" ? "handed" : "queue";
  const setTab = useCallback(
    (next: "queue" | "handed") => {
      const params = new URLSearchParams(searchParams);
      if (next === "queue") params.delete("tab");
      else params.set("tab", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  // ⚠️ Har harfda so'rov ketmasin — loyihadagi qidiruvlar debounce bilan.
  const debouncedSearch = useDebouncedValue(search, 400);

  const { getAwaitingMarkets } = useMarketHandover();
  const params = useMemo(
    () => ({
      page,
      limit,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [page, limit, debouncedSearch],
  );
  const { data, isLoading, isFetching, refetch } = getAwaitingMarkets(params);

  const markets = data?.markets ?? [];
  const total = Number(data?.total_markets ?? 0);

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    setPage(newPage);
    if (newLimit && newLimit !== limit) setLimit(newLimit);
  };

  const open = (marketId: string) => navigate(`/awaiting-market/${marketId}`);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-6 lg:px-8">
      {/* ─────── Sarlavha ─────── */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
            <Warehouse className="h-5 w-5 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-800 sm:text-xl dark:text-white">
              {t("queueTitle")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("queueSubtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            className="flex-1 sm:max-w-xs"
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            loading={isFetching && search !== debouncedSearch}
            placeholder={t("searchMarkets")}
          />
          <button
            type="button"
            aria-label={t("refresh")}
            title={t("refresh")}
            onClick={() => void refetch()}
            className="h-10 shrink-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-[#2A263D] dark:text-gray-300 dark:hover:bg-[#352F4A] flex items-center justify-center"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ─────── Xulosa ─────── */}
      {/* ─────── Tablar ─────── */}
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-[#2A263D]">
        {(["queue", "handed"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            // ⚠️ `whitespace-nowrap` — uzun nom ikkinchi qatorga tushib,
            // tab paneli qalinlashib ketardi.
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              tab === key
                ? "bg-white text-purple-700 shadow-sm dark:bg-[#3d3759] dark:text-purple-300"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {key === "queue" ? t("tabQueue") : t("tabHandedOver")}
            {key === "queue" && total > 0 && (
              <span className="ml-1.5 rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                {total}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "handed" ? (
        <BatchList mode="staff" />
      ) : (
      <>
      {/* ⚠️ Plitkalar OMBORNING umumiy holati: qidiruv ularni toraytirmaydi
          (server ham shu mantiqda hisoblaydi). */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-[#2A263D]">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("statTotalParcels")}
          </div>
          <div className="text-xl font-bold tabular-nums text-gray-800 sm:text-2xl dark:text-white">
            {Number(data?.total_parcels ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-[#2A263D]">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("statWaitingMarkets")}
          </div>
          <div className="text-xl font-bold tabular-nums text-gray-800 sm:text-2xl dark:text-white">
            {total}
          </div>
        </div>
        {/* Omborda turgan PUL — admin uchun bu bosim o'lchovi. */}
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-[#2A263D]">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("statTotalSum")}
          </div>
          <div className="text-xl font-bold tabular-nums text-gray-800 sm:text-2xl dark:text-white">
            {money(Number(data?.total_price ?? 0))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-[#2A263D]">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("statEscalated")}
          </div>
          <div
            className={`text-xl font-bold tabular-nums sm:text-2xl ${
              Number(data?.total_escalated ?? 0) > 0
                ? "text-red-600 dark:text-red-400"
                : "text-gray-800 dark:text-white"
            }`}
          >
            {Number(data?.total_escalated ?? 0)}
          </div>
        </div>
      </div>

      {/* ─────── Mobil: karta ro'yxati ─────── */}
      <div className="block space-y-3 lg:hidden">
        {isLoading ? (
          [...Array(4)].map((_, i) => <MobileCardSkeleton key={i} />)
        ) : markets.length === 0 ? (
          <div className="rounded-xl bg-white py-12 dark:bg-[#2A263D]">
            <Empty description={t("emptyQueue")} />
          </div>
        ) : (
          markets.map((m) => (
            <button
              key={m.market_id}
              type="button"
              onClick={() => open(m.market_id)}
              className="w-full rounded-xl bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.98] dark:bg-[#2A263D]"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500">
                    <Store className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate font-bold text-gray-800 dark:text-white">
                      {m.market_name || "—"}
                    </p>
                    {m.market_phone && (
                      <a
                        href={`tel:${m.market_phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="m-0 inline-flex items-center gap-1.5 py-1 text-base font-semibold tabular-nums text-purple-700 dark:text-purple-300"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-emerald-500" />
                        {formatPhone(m.market_phone)}
                      </a>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <Package className="h-3.5 w-3.5" />
                  {t("parcelsCount", { count: m.parcel_count })}
                </span>
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {t("pcs", { count: m.item_count })}
                  {m.district_count > 0 &&
                    ` · ${t("districtsCount", { count: m.district_count })}`}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${returnAgeTone(m.oldest_age_days)}`}
                  title={t("oldestAgeHint")}
                >
                  {t("days", { count: m.oldest_age_days })}
                </span>
                {m.active_session && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    title={t("activeSessionHint")}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {t("activeSession")}
                  </span>
                )}
                {m.replacement_count > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    title={t("replacementReturnsHint")}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t("replacementReturns", { count: m.replacement_count })}
                  </span>
                )}
                {m.escalated_count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" />
                    {t("escalatedCount", { count: m.escalated_count })}
                  </span>
                )}
                {m.consent_required && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    title={t("consentRequiredHint")}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {t("consentRequired")}
                  </span>
                )}
                <span className="ml-auto text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                  {money(m.total_price)}
                </span>
              </div>

              {/* Aniq sana — market bilan gaplashganda dalil kerak. */}
              <div
                className="mt-2 flex items-center gap-1 text-xs tabular-nums text-gray-500 dark:text-gray-400"
                title={t("oldestAgeHint")}
              >
                <Warehouse className="h-3 w-3 shrink-0" />
                {formatMoment(m.oldest_center_received_at)}
                {m.newest_center_received_at !==
                  m.oldest_center_received_at && (
                  <span title={t("newestReceivedHint")}>
                    → {formatMoment(m.newest_center_received_at)}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* ─────── Desktop: jadval ─────── */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block dark:border-gray-800 dark:bg-[#2A263D]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <th className="w-14 px-4 py-4 text-left text-sm font-semibold">
                  {t("colIndex")}
                </th>
                <th className="min-w-[200px] px-4 py-4 text-left text-sm font-semibold">
                  {t("colMarket")}
                </th>
                <th className="min-w-[160px] whitespace-nowrap px-4 py-4 text-left text-sm font-semibold">
                  {t("colPhone")}
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-left text-sm font-semibold">
                  {t("colParcels")}
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold">
                  {t("colPrice")}
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-left text-sm font-semibold">
                  {t("colReceived")}
                </th>
                <th className="min-w-[220px] px-4 py-4 text-left text-sm font-semibold">
                  {t("colStatus")}
                </th>
                <th className="w-10 px-4 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                [...Array(8)].map((_, i) => <TableRowSkeleton key={i} />)
              ) : markets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <Empty description={t("emptyQueue")} />
                  </td>
                </tr>
              ) : (
                markets.map((m, index) => (
                  <tr
                    key={m.market_id}
                    onClick={() => open(m.market_id)}
                    className="group cursor-pointer transition-colors hover:bg-purple-50 dark:hover:bg-[#3d3759]"
                  >
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 transition-transform group-hover:scale-110">
                          <Store className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate font-semibold text-gray-800 dark:text-white">
                            {m.market_name || "—"}
                          </span>
                          {/* Ism OSTIDA viloyatlar: admin «qaysi viloyatdan
                              yig'ilib qolgan» ni shu yerdan ko'radi. */}
                          <span
                            className="block truncate text-xs text-gray-500 dark:text-gray-400"
                            title={t("regionsHint")}
                          >
                            {m.regions || t("noRegion")}
                          </span>
                        </div>
                      </div>
                    </td>
                    {/* ⚠️ TELEFON KATTA va alohida ustunda: ruxsat kelmasa
                        xodim marketga AYNAN shu yerdan qo'ng'iroq qiladi.
                        `stopPropagation` — qator ochilib ketmasin. */}
                    <td
                      className="whitespace-nowrap px-4 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.market_phone ? (
                        <a
                          href={`tel:${m.market_phone}`}
                          className="text-base font-semibold tabular-nums text-purple-700 hover:underline dark:text-purple-300"
                        >
                          {formatPhone(m.market_phone)}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm tabular-nums text-gray-700 dark:text-gray-200">
                      <div className="font-semibold">
                        {t("parcelsCount", { count: m.parcel_count })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t("pcs", { count: m.item_count })}
                        {m.district_count > 0 &&
                          ` · ${t("districtsCount", { count: m.district_count })}`}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-gray-800 dark:text-white">
                      {money(m.total_price)}
                    </td>
                    {/* Yosh yorlig'i «3 kun» deydi, LEKIN admin aniq sanani
                        so'raydi (market bilan gaplashganda dalil kerak).
                        Birinchi = eng keksa, ikkinchi = eng oxirgi. */}
                    <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-gray-600 dark:text-gray-300">
                      <div title={t("oldestAgeHint")}>
                        {formatMoment(m.oldest_center_received_at)}
                      </div>
                      {m.newest_center_received_at !==
                        m.oldest_center_received_at && (
                        <div
                          className="text-xs text-gray-500 dark:text-gray-400"
                          title={t("newestReceivedHint")}
                        >
                          → {formatMoment(m.newest_center_received_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${returnAgeTone(m.oldest_age_days)}`}
                          title={t("oldestAgeHint")}
                        >
                          {t("days", { count: m.oldest_age_days })}
                        </span>
                        {m.active_session && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            title={t("activeSessionHint")}
                          >
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            {t("activeSession")}
                          </span>
                        )}
                        {m.replacement_count > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            title={t("replacementReturnsHint")}
                          >
                            <RefreshCw className="h-3 w-3" />
                            {t("replacementReturns", {
                              count: m.replacement_count,
                            })}
                          </span>
                        )}
                        {m.escalated_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            {t("escalatedCount", { count: m.escalated_count })}
                          </span>
                        )}
                        {m.consent_required && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                            title={t("consentRequiredHint")}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {t("consentRequired")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────── Sahifalash ─────── */}
      {total > 0 && (
        <div className="flex justify-center py-4">
          <Pagination
            showSizeChanger
            current={page}
            total={total}
            pageSize={limit}
            onChange={onChange}
            className="[&_.ant-pagination-item-active]:border-purple-600 [&_.ant-pagination-item-active]:bg-purple-600 [&_.ant-pagination-item-active_a]:text-white"
          />
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default memo(AwaitingMarket);
