import { memo, useCallback, useMemo, useState } from "react";
import { Button, Empty, Input, Pagination, type PaginationProps } from "antd";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Calendar,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  useMarketHandover,
  type ConsentSession,
} from "../../shared/api/hooks/useMarketHandover";
import { useApiNotification } from "../../shared/hooks/useApiNotification";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { formatPhone } from "../../shared/helpers/formatPhone";
import {
  formatMoment,
  returnAgeTone,
} from "../../shared/lib/returnStage";
import ReplacementBadge from "../../shared/components/replacement-badge";
import ConsentModal from "./ConsentModal";

const PAGE_SIZE = 20;

const money = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("uz-UZ")} so'm`;

/**
 * Yosh bo'yicha rang — market "qancha vaqt bizda turgan"ini KO'Z BILAN
 * ko'rishi kerak. Sinflar LITERAL (Tailwind shablondan sinf yasamaydi).
 */
const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
      </td>
    ))}
  </tr>
);

const MobileCardSkeleton = () => (
  <div className="animate-pulse rounded-xl bg-white p-4 dark:bg-[#2A263D]">
    <div className="mb-3 flex items-center justify-between">
      <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
  </div>
);

/**
 * MARKET — MARKAZDA TURGAN QAYTARISHLAR.
 *
 * ⚠️ TELEFON BIRINCHI. Market QR'ni amalda TELEFONDAN ko'rsatadi — shuning
 * uchun mobilda karta ro'yxati (`block lg:hidden`), asosiy tugma butun
 * kenglikda va yuqorida, telefon raqami `tel:` havolasi. Desktopda esa
 * loyihaning standart jadvali (`hidden lg:block`, gradient sarlavha).
 *
 * ⚠️ NEGA BU SAHIFA BOR. Avval bekor qilingan posilka markaz uni qabul
 * qilgan zahoti "yopilgan" bo'lib ketardi va market HECH NARSANI
 * tasdiqlamasdi — mol omborda turgan bo'lsa ham.
 */
function MarketReturns() {
  const { t } = useTranslation("marketReturns");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [modalOpen, setModalOpen] = useState(false);
  const [session, setSession] = useState<ConsentSession | null>(null);

  const { getMyReturns, getMyReturnCounts, createConsent } =
    useMarketHandover();
  const { handleApiError } = useApiNotification();

  const params = useMemo(
    () => ({
      page,
      limit,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [page, limit, debouncedSearch],
  );

  const { data, isLoading, isFetching, refetch } = getMyReturns(params);
  const { data: counts } = getMyReturnCounts();

  const requestConsent = useCallback(() => {
    setModalOpen(true);
    createConsent.mutate(undefined, {
      onSuccess: (res) => setSession(res),
      onError: (err) => {
        setModalOpen(false);
        handleApiError(err, t("toastConsentFailed"));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSession(null);
  }, []);

  const orders = data?.orders ?? [];
  const total = Number(data?.total ?? 0);
  const awaiting = Number(counts?.awaiting ?? 0);
  const oldestDays = Number(counts?.oldest_age_days ?? 0);
  const emptyText = debouncedSearch.trim()
    ? t("emptySearch")
    : t("emptyMarket");

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    setPage(newPage);
    if (newLimit && newLimit !== limit) setLimit(newLimit);
  };

  const deliverLabel = (where?: string | null) =>
    where === "center" ? t("deliverCenter") : t("deliverAddress");

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-6 lg:px-8">
      {/* ─────── Sarlavha ─────── */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
          <Warehouse className="h-5 w-5 text-amber-700 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-800 sm:text-xl dark:text-white">
            {t("marketTitle")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("marketSubtitle")}</p>
        </div>
      </div>

      {/*
        ASOSIY AMAL — telefonda BUTUN KENGLIKDA va yuqorida.
        ⚠️ Market shu tugmani bosib QR'ni xodimga ko'rsatadi; u ro'yxatning
        pastida yoki kichik bo'lsa, odam uni telefonda izlab yurardi.
      */}
      <Button
        type="primary"
        size="large"
        block
        className="mb-4 h-12 sm:h-10 sm:w-auto"
        icon={<ShieldCheck className="h-4 w-4" />}
        disabled={awaiting === 0}
        loading={createConsent.isPending && modalOpen}
        onClick={requestConsent}
      >
        {t("consentCta")}
      </Button>

      {/* ─────── Xulosa ─────── */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-[#2A263D]">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("statAtCenter")}
          </div>
          <div className="text-xl font-bold tabular-nums text-gray-800 sm:text-2xl dark:text-white">
            {t("pcs", { count: awaiting })}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-[#2A263D]">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("statOldest")}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tabular-nums text-gray-800 sm:text-2xl dark:text-white">
              {t("days", { count: oldestDays })}
            </span>
            {oldestDays >= 7 && (
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            )}
          </div>
        </div>
        <div className="col-span-2 rounded-xl border border-gray-100 bg-white p-3 sm:p-4 lg:col-span-1 dark:border-gray-800 dark:bg-[#2A263D]">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("statHowTo")}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t("howToSteps")}
          </div>
        </div>
      </div>

      {/* ─────── Qidiruv ─────── */}
      <div className="mb-3 flex items-center gap-2">
        <Input
          allowClear
          size="large"
          prefix={<Search className="h-4 w-4 text-gray-400" />}
          placeholder={t("searchOrders")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-sm"
        />
        <Button
          size="large"
          aria-label={t("refresh")}
          icon={
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          }
          onClick={() => void refetch()}
        />
      </div>

      {/* ─────── Mobil: karta ro'yxati ─────── */}
      <div className="block space-y-3 lg:hidden">
        {isLoading ? (
          [...Array(4)].map((_, i) => <MobileCardSkeleton key={i} />)
        ) : orders.length === 0 ? (
          <div className="rounded-xl bg-white py-12 dark:bg-[#2A263D]">
            <Empty description={emptyText} />
          </div>
        ) : (
          orders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl bg-white p-4 shadow-sm dark:bg-[#2A263D]"
            >
              {/* ISM birinchi, yorliq raqami ostida — market posilkani
                  raqamdan emas, MIJOZdan eslaydi. */}
              <div className="mb-2 min-w-0">
                <div className="truncate text-base font-bold text-gray-800 dark:text-white">
                  {o.customer_name || "—"}
                </div>
                <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  #{o.order_number}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  {t("statAtCenter")}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${returnAgeTone(o.age_days)}`}
                  title={t("ageHint")}
                >
                  {t("days", { count: o.age_days })}
                </span>
                <ReplacementBadge order={o} />
                {o.escalated && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" />
                    {t("overdue")}
                  </span>
                )}
                <span className="ml-auto font-semibold tabular-nums text-gray-800 dark:text-white">
                  {money(o.total_price)}
                </span>
              </div>

              {/* ⚠️ TELEFON KATTA va bosiladigan: market mijozga aynan shu
                  yerdan qo'ng'iroq qiladi, kichik shrift xato o'qiladi. */}
              {o.customer_phone && (
                <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-700">
                  <a
                    href={`tel:${o.customer_phone}`}
                    className="inline-flex items-center gap-2 py-1 text-lg font-semibold tabular-nums text-purple-700 dark:text-purple-300"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-emerald-500" />
                    {formatPhone(o.customer_phone)}
                  </a>
                </div>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                {(o.region_name || o.district_name) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    {[o.region_name, o.district_name]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
                {o.where_deliver && (
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3 w-3 text-gray-400" />
                    {deliverLabel(o.where_deliver)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Package className="h-3 w-3 text-gray-400" />
                  {t("pcs", { count: Number(o.product_quantity ?? 0) })}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  {formatMoment(o.created_at)}
                </span>
                <span
                  className="inline-flex items-center gap-1 tabular-nums text-sky-700 dark:text-sky-300"
                  title={t("centerReceivedHint")}
                >
                  <Warehouse className="h-3 w-3" />
                  {formatMoment(o.center_received_at)}
                </span>
              </div>

              {o.comment && (
                <p
                  className="mt-1.5 line-clamp-2 text-xs italic text-gray-500 dark:text-gray-400"
                  title={o.comment}
                >
                  «{o.comment}»
                </p>
              )}
            </div>
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
                <th className="whitespace-nowrap px-4 py-4 text-left text-sm font-semibold">
                  {t("colStage")}
                </th>
                <th className="min-w-[140px] px-4 py-4 text-left text-sm font-semibold">
                  {t("colCreated")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                [...Array(8)].map((_, i) => <TableRowSkeleton key={i} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <Empty description={emptyText} />
                  </td>
                </tr>
              ) : (
                orders.map((o, index) => (
                  <tr
                    key={o.id}
                    className="transition-colors hover:bg-purple-50 dark:hover:bg-[#3d3759]"
                  >
                    {/* Tartib raqami — buyurtma raqami EMAS (u ism ostida). */}
                    <td className="px-4 py-4 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-gray-800 dark:text-white">
                          {o.customer_name || "—"}
                        </span>
                        {/* Yorliq raqami ism OSTIDA — xodim ikkisini birga
                            o'qiydi, alohida ustun esa jadvalni cho'zardi. */}
                        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                          #{o.order_number}
                        </span>
                        <ReplacementBadge order={o} className="mt-0.5" />
                      </div>
                    </td>
                    {/* Telefon KATTA: market mijozga qo'ng'iroq qilish uchun
                        ekrandan o'qiydi, kichik shriftda xato o'qiladi. */}
                    <td className="whitespace-nowrap px-4 py-4">
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
                        {deliverLabel(o.where_deliver)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-gray-800 dark:text-white">
                      <div>{money(o.total_price)}</div>
                      <div className="text-xs font-normal text-gray-400">
                        {t("pcs", { count: Number(o.product_quantity ?? 0) })}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm tabular-nums text-gray-600 dark:text-gray-300">
                      {formatMoment(o.center_received_at)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                          {t("statAtCenter")}
                        </span>
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
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="tabular-nums">
                        {formatMoment(o.created_at)}
                      </div>
                      {o.comment && (
                        <div className="truncate italic" title={o.comment}>
                          «{o.comment}»
                        </div>
                      )}
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
