import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DatePicker, Pagination, type PaginationProps } from "antd";
import { useTranslation } from "react-i18next";
import dayjs, { type Dayjs } from "dayjs";
import {
  CalendarDays,
  FileSignature,
  Package,
  QrCode,
  RefreshCw,
  Store,
  User,
} from "lucide-react";
import {
  useMarketHandover,
  type HandoverBatch,
} from "../../shared/api/hooks/useMarketHandover";
import { formatPhone } from "../../shared/helpers/formatPhone";
import SearchInput from "../../shared/components/search-input";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";

const PAGE_SIZE = 12;

const money = (n: number) => `${Number(n || 0).toLocaleString()} so'm`;

/** `1759700000000` → `06.10.2026 14:32` (qurilma mintaqasida). */
const momentOf = (ts: number) =>
  new Date(Number(ts)).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const CardSkeleton = () => (
  <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-[#2A263D]">
    <div className="mb-3 h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="mb-2 h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
  </div>
);

interface Props {
  /**
   * `market` — o'z partiyalari (`my/handovers`), market filtri YO'Q;
   * `staff` — barcha marketlar (`handovers`), market nomi ko'rinadi.
   */
  mode: "market" | "staff";
}

/**
 * TOPSHIRILGAN QAYTARISHLAR — PARTIYA RO'YXATI.
 *
 * ⚠️ NEGA PARTIYA, YASSI RO'YXAT EMAS. Market omborga BIR keladi va
 * o'nlab posilkani BIRGA olib ketadi. Yassi buyurtma ro'yxati bu faktni
 * yo'qotadi: market «men falon kuni nima oldim?» degan savolga javob
 * topa olmaydi va bahs chiqqanda dalil ko'rsatolmaydi. Shuning uchun
 * ko'rinish «topshirilgan pochta» naqshini ko'chiradi — KARTA GRID
 * (`old-mails`), har karta bitta topshirish partiyasi.
 *
 * ⚠️ Kun yorlig'ini SERVER beradi (`day`), klient hisoblamaydi: qurilma
 * soati boshqa mintaqada bo'lsa kechqurun topshirilgan partiya ertangi
 * kunga tushib ketardi.
 */
function BatchList({ mode }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("marketReturns");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  const { getMyHandovers, getHandovers } = useMarketHandover();

  const params = useMemo(
    () => ({
      page,
      limit,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      // ⚠️ `YYYY-MM-DD` — server uni TOSHKENT kunining boshi/oxiriga
      // keltiradi (`toUzbekistanTimestamp`), epoch yuborilmaydi.
      ...(range?.[0] ? { from: range[0].format("YYYY-MM-DD") } : {}),
      ...(range?.[1] ? { to: range[1].format("YYYY-MM-DD") } : {}),
    }),
    [page, limit, debouncedSearch, range],
  );

  const isMarket = mode === "market";
  // ⚠️ Ikkala hook ham CHAQIRILADI (React qoidasi), lekin faqat biri
  // yoqiladi — aks holda market `handovers` ga 403 so'rov yuborardi.
  const mine = getMyHandovers(params, isMarket);
  const all = getHandovers(params, !isMarket);
  const query = isMarket ? mine : all;

  /**
   * ⚠️ `useMemo` SHART: `?? []` har renderda YANGI massiv beradi va
   * pastdagi kun-guruhlash `useMemo` si har renderda qayta hisoblanardi
   * (`HandoverSession` dagi `orders` bilan ayni saboq).
   */
  const batches = useMemo(() => query.data?.batches ?? [], [query.data]);
  const total = Number(query.data?.total_batches ?? 0);

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    setPage(newPage);
    if (newLimit && newLimit !== limit) setLimit(newLimit);
  };

  /**
   * KUN BO'YICHA GURUHLASH — ekranda sana sarlavhasi bilan.
   *
   * Server allaqachon `handed_at DESC` bo'yicha saralaydi, shuning uchun
   * ketma-ket bir xil kunlarni yig'ish kifoya (qayta saralash YO'Q —
   * u sahifalash tartibini buzardi).
   */
  const days = useMemo(() => {
    const out: Array<{ day: string; items: HandoverBatch[] }> = [];
    for (const b of batches) {
      const last = out[out.length - 1];
      if (last && last.day === b.day) last.items.push(b);
      else out.push({ day: b.day, items: [b] });
    }
    return out;
  }, [batches]);

  return (
    <div>
      {/* Partiya tushunchasi ravshan emas — bir qatorlik izoh qoladi. */}
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        {t("historySubtitle")}
      </p>

      {/* ─────── Filtr ─────── */}
      {/*
        ⚠️ QIDIRUV MINIMAL KENGLIKKA EGA. Avval u `flex-1` edi, ya'ni
        asosi 0 — sana tanlagich o'z tabiiy kengligini talab qilgani
        uchun qidiruv qisilib, bir-ikki harf sig'adigan darajaga
        tushib qolardi. Endi `min-w` bor: joy yetmasa qator O'RALADI
        va sana tanlagich pastga tushadi, qidiruv esa o'qiladigan
        kenglikda qoladi.
      */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          className="w-full min-w-[220px] flex-1 sm:w-auto sm:max-w-sm"
          value={search}
          onChange={(next) => {
            setSearch(next);
            setPage(1);
          }}
          loading={query.isFetching && search !== debouncedSearch}
          placeholder={isMarket ? t("searchOrders") : t("searchBatches")}
        />
        <DatePicker.RangePicker
          value={range as [Dayjs, Dayjs] | null}
          onChange={(v) => {
            setRange(v as [Dayjs | null, Dayjs | null] | null);
            setPage(1);
          }}
          format="DD.MM.YYYY"
          placeholder={[t("filterFrom"), t("filterTo")]}
          // Telefonda butun qatorni egallaydi — siqilib ketmasin.
          className="h-10 w-full min-w-[250px] sm:w-auto"
          // Kelajakdagi kun tanlab bo'lmaydi — partiya hali yo'q.
          disabledDate={(d) => d && d.isAfter(dayjs(), "day")}
        />
        {/* Filtr aktiv bo'lganda tozalash — `old-mails` naqshi. */}
        {(search || range?.[0] || range?.[1]) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setRange(null);
              setPage(1);
            }}
            className="flex h-10 shrink-0 items-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-[#2A263D] dark:text-gray-300 dark:hover:bg-[#352F4A]"
          >
            {t("filterReset")}
          </button>
        )}
        <button
          type="button"
          aria-label={t("refresh")}
          title={t("refresh")}
          onClick={() => void query.refetch()}
          className="flex h-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-[#2A263D] dark:text-gray-300 dark:hover:bg-[#352F4A]"
        >
          <RefreshCw
            className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* ─────── Partiyalar ─────── */}
      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center sm:p-12 dark:border-gray-800 dark:bg-[#2A263D]">
          <Package className="mx-auto h-12 w-12 text-gray-300 sm:h-16 sm:w-16" />
          <h3 className="mt-3 font-semibold text-gray-800 dark:text-white">
            {t("emptyHistory")}
          </h3>
          <p className="m-0 text-sm text-gray-500 dark:text-gray-400">
            {t("emptyHistoryHint")}
          </p>
        </div>
      ) : (
        days.map((group) => (
          <div key={group.day} className="mb-5">
            {/* Kun sarlavhasi — «istagan kuni» talabi aynan shu. */}
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-white">
                {dayjs(group.day).format("DD.MM.YYYY")}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t("parcelsCount", {
                  count: group.items.reduce((s, b) => s + b.parcel_count, 0),
                })}
              </span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((b) => (
                <button
                  key={b.session_id}
                  type="button"
                  onClick={() => navigate(`/handovers/${b.session_id}`)}
                  className="rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:border-purple-300 hover:shadow-md active:scale-[0.99] dark:border-gray-800 dark:bg-[#2A263D] dark:hover:border-purple-700"
                >
                  {/* Xodim ekranida MARKET nomi birinchi; market o'z
                      ekranida uni bilmaydi — vaqt birinchi bo'ladi. */}
                  {!isMarket && (
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500">
                        <Store className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-800 dark:text-white">
                          {b.market_name || "—"}
                        </div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {formatPhone(b.market_phone)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className="mb-2 text-sm tabular-nums text-gray-600 dark:text-gray-300"
                    title={t("handedAt")}
                  >
                    {momentOf(b.handed_at)}
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-100 pt-2 text-sm dark:border-gray-700">
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {t("parcelsCount", { count: b.parcel_count })}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-gray-800 dark:text-white">
                      {money(b.total_price)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t("pcs", { count: b.item_count })}
                    </span>
                    {b.replacement_count > 0 && (
                      <span className="text-right text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {t("replacementReturns", {
                          count: b.replacement_count,
                        })}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {/* Offline akt — market tasdig'isiz topshirilgan;
                        hisobotda ham AJRATIB ko'rsatiladi. */}
                    {b.channel === "offline" ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        title={b.override_reason ?? undefined}
                      >
                        <FileSignature className="h-3 w-3" />
                        {t("channelOffline")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <QrCode className="h-3 w-3" />
                        {t("channelWeb")}
                      </span>
                    )}
                    {b.staff_name && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"
                        title={t("batchStaff")}
                      >
                        <User className="h-3 w-3" />
                        {b.staff_name}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {total > 0 && (
        <div className="flex justify-center py-4">
          <Pagination
            current={page}
            pageSize={limit}
            total={total}
            onChange={onChange}
            showSizeChanger
            pageSizeOptions={["12", "24", "48"]}
            className="[&_.ant-pagination-item-active]:border-purple-600 [&_.ant-pagination-item-active]:bg-purple-600 [&_.ant-pagination-item-active_a]:text-white"
          />
        </div>
      )}
    </div>
  );
}

export default memo(BatchList);
