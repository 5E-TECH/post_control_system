import { memo, useCallback, useMemo, useState } from "react";
import { Button, Empty, Input, Pagination } from "antd";
import {
  AlertTriangle,
  Calendar,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  User,
  Warehouse,
} from "lucide-react";
import {
  useMarketHandover,
  type ConsentSession,
} from "../../shared/api/hooks/useMarketHandover";
import { useApiNotification } from "../../shared/hooks/useApiNotification";
import { formatMoment } from "../../shared/lib/returnStage";
import ReplacementBadge from "../../shared/components/replacement-badge";
import ConsentModal from "./ConsentModal";

const PAGE_SIZE = 20;

const money = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("uz-UZ")} so'm`;

/**
 * Yosh bo'yicha rang — market "qancha vaqt bizda turgan"ini KO'Z BILAN
 * ko'rishi kerak. Oyiga ~4 500 qaytarish oqimida ro'yxat raqamlardan iborat
 * devor bo'lib qoladi; rang uni o'qiladigan qiladi.
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
 * ⚠️ TELEFON BIRINCHI. Market QR'ni amalda TELEFONDAN ko'rsatadi, ya'ni bu
 * sahifaning asosiy qurilmasi — telefon, ish stoli emas. Shuning uchun:
 * ro'yxat mobil KARTA (jadval emas), asosiy tugma telefonda butun kenglikda,
 * telefon raqami `tel:` havolasi, sanoq kartalari ikki ustun.
 * (Mobil navigatsiya `fixed bottom` — pastdan joy DashboardLayout da
 * `max-[650px]:pb-24` bilan allaqachon qoldirilgan.)
 *
 * ⚠️ NEGA BU SAHIFA BOR. Avval bekor qilingan posilka markaz uni qabul
 * qilgan zahoti "yopilgan" bo'lib ketardi va market HECH NARSANI
 * tasdiqlamasdi — mol omborda turgan bo'lsa ham.
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
    <div className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-6 lg:px-8">
      {/* ─────── Sarlavha ─────── */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
          <Warehouse className="h-5 w-5 text-amber-700 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl dark:text-gray-100">
            Qaytarilgan buyurtmalar
          </h1>
          <p className="text-sm text-gray-500">
            Markazda sizni kutayotgan bekor qilingan posilkalar
          </p>
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
        Topshirishga ruxsat beraman
      </Button>

      {/* ─────── Xulosa ─────── */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Markazda turgan
          </div>
          <div className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl dark:text-gray-100">
            {awaiting} dona
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Eng uzoq turgani
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl dark:text-gray-100">
              {oldestDays} kun
            </span>
            {oldestDays >= 7 && (
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            )}
          </div>
        </div>
        <div className="col-span-2 rounded-xl border border-gray-100 bg-white p-3 sm:p-4 lg:col-span-1 dark:border-gray-800 dark:bg-gray-900">
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
          size="large"
          prefix={<Search className="h-4 w-4 text-gray-400" />}
          placeholder="Buyurtma raqami yoki QR kodi"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <Button
          size="large"
          aria-label="Yangilash"
          icon={
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          }
          onClick={() => void refetch()}
        />
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
            /*
              MOBIL KARTA — bitta posilka haqida market biladigan HAMMA
              narsa. ⚠️ Market "bu qaysi buyurtma edi?" degan savolga javob
              topa olishi kerak: raqam yetarli emas, MIJOZ va TUMAN kerak
              (pochta ichidagi buyurtma kartasi bilan bir xil to'plam).
            */
            <div
              key={o.id}
              className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              {/* 1-qator: raqam va holat */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  #{o.order_number}
                </span>
                <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  Markazda
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${ageTone(o.age_days)}`}
                  title="Markazda qancha turgani"
                >
                  {o.age_days} kun
                </span>
                <ReplacementBadge order={o} />
                {o.escalated && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" />
                    Muddati o'tdi
                  </span>
                )}
                <span className="ml-auto font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                  {money(o.total_price)}
                </span>
              </div>

              {/* 2-qator: mijoz — market posilkani SHU bo'yicha taniydi */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-sm dark:border-gray-800">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-gray-800 dark:text-gray-200">
                  <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate font-medium">
                    {o.customer_name || "—"}
                  </span>
                </span>
                {o.customer_phone && (
                  /* Telefonda bosilsa qo'ng'iroq qiladi — market mijozga
                     qayta aloqa qilishi odatiy hol. */
                  <a
                    href={`tel:${o.customer_phone}`}
                    className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {o.customer_phone}
                  </a>
                )}
              </div>

              {/* 3-qator: tafsilotlar */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
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
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Package className="h-3 w-3 text-gray-400" />
                  {Number(o.product_quantity ?? 0)} dona
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  {formatMoment(o.created_at)}
                </span>
                <span
                  className="inline-flex items-center gap-1 tabular-nums text-sky-700 dark:text-sky-300"
                  title="Viloyatdan markazga qabul qilingan vaqt"
                >
                  <Warehouse className="h-3 w-3" />
                  {formatMoment(o.center_received_at)}
                </span>
              </div>

              {o.comment && (
                <p
                  className="mt-1.5 line-clamp-2 text-xs italic text-gray-500"
                  title={o.comment}
                >
                  «{o.comment}»
                </p>
              )}
            </div>
          ))}

          {Number(data?.total ?? 0) > PAGE_SIZE && (
            <div className="mt-3 flex justify-center sm:justify-end">
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
