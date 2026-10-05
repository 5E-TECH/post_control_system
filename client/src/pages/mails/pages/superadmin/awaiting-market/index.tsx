import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Empty, Input, Pagination } from "antd";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Warehouse,
} from "lucide-react";
import { useMarketHandover } from "../../../../../shared/api/hooks/useMarketHandover";

const PAGE_SIZE = 30;

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
 * XODIM NAVBATI — «Markazda, market kutilmoqda».
 *
 * ⚠️ MARKET BO'YICHA guruhlangan, POCHTA bo'yicha emas: market omborga O'Z
 * posilkalarini olishga keladi — pochta bo'yicha emas. Avval bu holat
 * UMUMAN ko'rinmasdi (qabul qilingan bekor pochta hech bir faol ro'yxatda
 * yo'q edi), shuning uchun posilkalar oylab jim qotib qolardi.
 *
 * Eng uzoq kutayotgan market birinchi turadi — kuniga ~150 qaytarish
 * oqimida "kim eng ko'p kutgan" savoli ro'yxatning ASOSIY ma'nosi.
 */
function AwaitingMarket() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { getAwaitingMarkets } = useMarketHandover();
  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [page, search],
  );
  const { data, isLoading, isFetching, refetch } = getAwaitingMarkets(params);

  const markets = data?.markets ?? [];

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
            <Warehouse className="h-5 w-5 text-sky-700 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Market kutilmoqda
            </h1>
            <p className="text-sm text-gray-500">
              Markazda turgan bekor posilkalar — market ruxsati bilan
              topshiriladi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            allowClear
            prefix={<Search className="h-4 w-4 text-gray-400" />}
            placeholder="Market nomi"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Button
            icon={
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            }
            onClick={() => void refetch()}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Jami posilka
          </div>
          <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {Number(data?.total_parcels ?? 0)} dona
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Kutayotgan market
          </div>
          <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {Number(data?.total_markets ?? 0)} ta
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : markets.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-10 dark:border-gray-800 dark:bg-gray-900">
          <Empty description="Markazda topshirishni kutayotgan posilka yo'q" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {markets.map((m) => (
            <button
              key={m.market_id}
              type="button"
              onClick={() => navigate(`/awaiting-market/${m.market_id}`)}
              className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/40 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-sky-800 dark:hover:bg-sky-900/10"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <Store className="h-4 w-4 text-gray-500" />
              </div>

              <div className="min-w-[160px] flex-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {m.market_name || "—"}
                </div>
                {m.market_phone && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone className="h-3 w-3" />
                    {m.market_phone}
                  </div>
                )}
              </div>

              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <Package className="h-3.5 w-3.5" />
                {m.parcel_count} dona
              </span>

              <span className="text-xs text-gray-500 tabular-nums">
                {money(m.total_price)}
              </span>

              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${ageTone(m.oldest_age_days)}`}
                title="Eng keksa posilkaning yoshi"
              >
                {m.oldest_age_days} kun
              </span>

              {m.escalated_count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3" />
                  {m.escalated_count} eskalatsiya
                </span>
              )}

              {m.consent_required && (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                  title="Bu marketda topshirish uchun market QR/PIN ruxsati MAJBURIY"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Ruxsat majburiy
                </span>
              )}

              <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
            </button>
          ))}

          {Number(data?.total_markets ?? 0) > PAGE_SIZE && (
            <div className="mt-3 flex justify-end">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={Number(data?.total_markets ?? 0)}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(AwaitingMarket);
