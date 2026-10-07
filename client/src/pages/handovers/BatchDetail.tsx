import { memo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Empty } from "antd";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  FileSignature,
  MapPin,
  Package,
  Phone,
  QrCode,
} from "lucide-react";
import { useMarketHandover } from "../../shared/api/hooks/useMarketHandover";
import { formatPhone } from "../../shared/helpers/formatPhone";
import { formatMoment } from "../../shared/lib/returnStage";
import { summarizeProducts } from "../../shared/lib/orderProducts";
import ReplacementBadge from "../../shared/components/replacement-badge";
import OrderEvidenceModal from "./OrderEvidenceModal";
import type { HandoverBatchOrder } from "../../shared/api/hooks/useMarketHandover";

const money = (n: number) => `${Number(n || 0).toLocaleString()} so'm`;

const RowSkeleton = () => (
  <tr className="animate-pulse">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
      </td>
    ))}
  </tr>
);

/**
 * BITTA PARTIYA ICHI — topshirilgan posilkalar, MAHSULOTLARI bilan.
 *
 * ⚠️ Market faqat O'Z partiyasini ocha oladi — bu SERVERDA qo'riqlanadi
 * (`market_id` tokendan WHERE shartiga qo'shiladi), begona sessiya 404
 * beradi. Klientda qo'shimcha tekshiruv YO'Q: ruxsatni ko'rinish
 * darajasida hal qilish IDOR'ga qarshi himoya EMAS.
 */
function BatchDetail() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("marketReturns");
  const { getHandoverBatch } = useMarketHandover();
  const { data, isLoading } = getHandoverBatch(sessionId);

  const orders = data?.orders ?? [];
  /**
   * Bosilgan posilka — to'liq DALIL oynasi uchun.
   *
   * ⚠️ Qatorga hammasi sig'maydi, lekin bahs chiqqanda aynan shu
   * savollar so'raladi: QANDAY topshirildi, KIM topshirdi, KIM markazga
   * qabul qilgan edi.
   */
  const [picked, setPicked] = useState<HandoverBatchOrder | null>(null);
  const session = data?.session;

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-[#2A263D] dark:text-gray-300 dark:hover:bg-[#352F4A]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToHistory")}
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-800 sm:text-xl dark:text-white">
            {t("batchDetailTitle")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("batchOf", { count: data?.total ?? 0 })} ·{" "}
            {money(data?.total_price ?? 0)}
          </p>
        </div>

        {session?.channel === "offline" ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <FileSignature className="h-3.5 w-3.5" />
            {t("channelOffline")}
          </span>
        ) : (
          session && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <QrCode className="h-3.5 w-3.5" />
              {t("channelWeb")}
            </span>
          )
        )}
      </div>

      {/* Offline akt bo'lsa VAKIL dalili — hisobotda shu dalil so'raladi. */}
      {session?.channel === "offline" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
          <span className="font-semibold text-amber-800 dark:text-amber-300">
            {session.representative_name || "—"}
          </span>
          {session.representative_phone && (
            <span className="ml-2 tabular-nums text-amber-700 dark:text-amber-300/80">
              {formatPhone(session.representative_phone)}
            </span>
          )}
          {session.override_reason && (
            <span className="ml-2 italic text-amber-700/80 dark:text-amber-300/70">
              «{session.override_reason}»
            </span>
          )}
        </div>
      )}

      {/* ─────── Mobil: karta ro'yxati ─────── */}
      <div className="block space-y-3 lg:hidden">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-white dark:bg-[#2A263D]"
            />
          ))
        ) : orders.length === 0 ? (
          <div className="rounded-xl bg-white py-12 dark:bg-[#2A263D]">
            <Empty description={t("emptyHistory")} />
          </div>
        ) : (
          orders.map((o) => {
            const p = summarizeProducts(o.items, o.product_quantity);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setPicked(o)}
                className="w-full rounded-xl bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99] dark:bg-[#2A263D]"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-bold text-gray-800 dark:text-white">
                    {o.customer_name || "—"}
                  </div>
                  <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    #{o.order_number}
                  </div>
                </div>
                {o.customer_phone && (
                  <a
                    href={`tel:${o.customer_phone}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-base font-semibold tabular-nums text-purple-700 dark:text-purple-300"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-emerald-500" />
                    {formatPhone(o.customer_phone)}
                  </a>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    {[o.region_name, o.district_name].filter(Boolean).join(", ")}
                  </span>
                  <span
                    className="inline-flex min-w-0 items-center gap-1"
                    title={p.nameless ? t("noProductName") : p.fullText}
                  >
                    <Package className="h-3 w-3 shrink-0 text-gray-400" />
                    <span className="truncate">
                      {p.nameless
                        ? t("pcs", { count: p.totalQuantity })
                        : p.visible
                            .map((it) => `${it.name} x${it.quantity}`)
                            .join(", ")}
                      {p.hiddenCount > 0 &&
                        ` ${t("moreProducts", { count: p.hiddenCount })}`}
                    </span>
                  </span>
                  <span className="ml-auto font-semibold tabular-nums text-gray-800 dark:text-white">
                    {money(o.total_price)}
                  </span>
                </div>
                <ReplacementBadge order={o} className="mt-1.5" />
              </button>
            );
          })
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
                <th
                  className="min-w-[160px] px-4 py-4 text-left text-sm font-semibold"
                  title={t("productsHint")}
                >
                  {t("colProduct")}
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold">
                  {t("colPrice")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                [...Array(6)].map((_, i) => <RowSkeleton key={i} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <Empty description={t("emptyHistory")} />
                  </td>
                </tr>
              ) : (
                orders.map((o, index) => {
                  const p = summarizeProducts(o.items, o.product_quantity);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setPicked(o)}
                      className="cursor-pointer transition-colors hover:bg-purple-50 dark:hover:bg-[#3d3759]"
                    >
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
                      </td>
                      <td className="max-w-[200px] px-4 py-4 text-sm">
                        {p.nameless ? (
                          <span
                            className="text-gray-400"
                            title={t("noProductName")}
                          >
                            {t("pcs", { count: p.totalQuantity })}
                          </span>
                        ) : (
                          <div className="min-w-0" title={p.fullText}>
                            {p.visible.map((it) => (
                              <div
                                key={it.name}
                                className="truncate text-gray-800 dark:text-gray-200"
                              >
                                {it.name}
                                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                  x{it.quantity}
                                </span>
                              </div>
                            ))}
                            {p.hiddenCount > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t("moreProducts", { count: p.hiddenCount })}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white">
                          {money(o.total_price)}
                        </div>
                        <div
                          className="text-xs tabular-nums text-gray-500 dark:text-gray-400"
                          title={t("handedAt")}
                        >
                          {formatMoment(o.market_handover_at)}
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

      <OrderEvidenceModal
        order={picked}
        session={session}
        onClose={() => setPicked(null)}
      />
    </div>
  );
}

export default memo(BatchDetail);
