import { memo } from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import {
  FileSignature,
  MapPin,
  Package,
  Phone,
  QrCode,
  ScanLine,
  User,
  Warehouse,
} from "lucide-react";
import type {
  HandoverBatchDetail,
  HandoverBatchOrder,
} from "../../shared/api/hooks/useMarketHandover";
import { formatPhone } from "../../shared/helpers/formatPhone";
import { formatMoment } from "../../shared/lib/returnStage";
import ReplacementBadge from "../../shared/components/replacement-badge";

const money = (n: number | null | undefined) =>
  `${Number(n || 0).toLocaleString()} so'm`;

/** Sessiya darajasidagi rejim yorlig'i. */
const MODE_KEY: Record<string, string> = {
  market_web: "modeMarketWeb",
  offline_signed: "modeOfflineSigned",
  admin_override: "modeAdminOverride",
  partner_auto: "modePartnerAuto",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 border-b border-gray-100 py-2 last:border-0 dark:border-gray-700">
      <span className="w-40 shrink-0 text-xs text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-100">
        {children}
      </span>
    </div>
  );
}

interface Props {
  order: HandoverBatchOrder | null;
  session: HandoverBatchDetail["session"] | undefined;
  onClose: () => void;
}

/**
 * POSILKA DALILI — partiya ichidagi qator bosilganda.
 *
 * ⚠️ NEGA KERAK. Ro'yxat qatoriga hammasi sig'maydi, lekin bahs
 * chiqqanda aynan shu savollarga javob kerak bo'ladi: posilka QANDAY
 * topshirildi (yorliq skanerlandimi, qo'lda belgilandimi, offline akt
 * bilanmi), KIM topshirdi va KIM markazga qabul qilgan edi.
 *
 * ⚠️ IKKI DARAJALI FAKT. `mode` — SESSIYA darajasida (market QR'i /
 * offline akt / admin qarori). `override_reason` — POSILKA darajasida:
 * sessiya market QR'i bilan ochilgan bo'lsa ham ayrim posilkalar
 * yorliqsiz o'tgan bo'lishi mumkin. Ikkisi ALOHIDA ko'rsatiladi,
 * chunki «market tasdiqladi, lekin yorliq o'qilmadi» — haqiqiy va
 * nazorat qilinishi kerak bo'lgan holat.
 */
function OrderEvidenceModal({ order, session, onClose }: Props) {
  const { t } = useTranslation("marketReturns");
  if (!order) return null;

  const manual = Boolean(order.market_handover_override_reason);
  const offline = session?.channel === "offline";
  const items = order.items ?? [];

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={560}
      styles={{ content: { padding: 16 } }}
      title={
        <span className="flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-600" />
          {t("orderDetailTitle")}
        </span>
      }
    >
      {/* ─────── Qanday topshirildi — ENG MUHIM FAKT, tepada ─────── */}
      <div
        className={`mb-3 rounded-xl border px-3 py-2 ${
          manual || offline
            ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-900/10"
            : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-900/10"
        }`}
      >
        <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t("wayLabel")}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {manual ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
              <FileSignature className="h-4 w-4" />
              {t("wayManual")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
              <ScanLine className="h-4 w-4" />
              {t("wayScanned")}
            </span>
          )}
          {/* Sabab — xodim YOPIQ ro'yxatdan tanlagan matn. */}
          {manual && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {order.market_handover_override_reason}
            </span>
          )}
        </div>
        <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          {offline ? (
            <FileSignature className="h-3.5 w-3.5" />
          ) : (
            <QrCode className="h-3.5 w-3.5" />
          )}
          {t(
            MODE_KEY[String(order.market_handover_mode ?? "")] ??
              "modeMarketWeb",
          )}
        </div>
      </div>

      <Row label={t("colOrder")}>
        <span className="font-semibold tabular-nums">#{order.order_number}</span>
        <ReplacementBadge order={order} className="ml-2" />
      </Row>

      <Row label={t("colCustomer")}>{order.customer_name || "—"}</Row>

      <Row label={t("colPhone")}>
        {order.customer_phone ? (
          <a
            href={`tel:${order.customer_phone}`}
            className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-purple-700 dark:text-purple-300"
          >
            <Phone className="h-3.5 w-3.5 text-emerald-500" />
            {formatPhone(order.customer_phone)}
          </a>
        ) : (
          "—"
        )}
      </Row>

      <Row label={t("colAddress")}>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          {[order.region_name, order.district_name].filter(Boolean).join(", ") ||
            "—"}
        </span>
      </Row>

      <Row label={t("productsLabel")}>
        {items.length ? (
          <ul className="m-0 list-none space-y-0.5 p-0">
            {items.map((it) => (
              <li key={it.name} className="truncate">
                {it.name}
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  x{it.quantity}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          // Marketplace buyurtmalarida `order_item` yaratilmaydi.
          <span className="text-gray-400">
            {t("pcs", { count: Number(order.product_quantity ?? 0) })}
          </span>
        )}
      </Row>

      <Row label={t("colPrice")}>
        <span className="font-semibold tabular-nums">
          {money(order.total_price)}
        </span>
      </Row>

      <Row label={t("centerReceivedBy")}>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Warehouse className="h-3.5 w-3.5 text-sky-600" />
          <span className="tabular-nums">
            {formatMoment(order.center_received_at)}
          </span>
          {order.center_received_by_name && (
            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <User className="h-3 w-3 text-gray-400" />
              {order.center_received_by_name}
            </span>
          )}
        </span>
      </Row>

      <Row label={t("handedBy")}>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="tabular-nums">
            {formatMoment(order.market_handover_at)}
          </span>
          {order.market_handover_by_name && (
            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <User className="h-3 w-3 text-gray-400" />
              {order.market_handover_by_name}
            </span>
          )}
        </span>
      </Row>

      {session?.opened_by_name && (
        <Row label={t("sessionOpenedBy")}>{session.opened_by_name}</Row>
      )}

      {/* Offline akt — vakil dalili SESSIYA darajasida saqlanadi. */}
      {offline && (
        <Row label={t("representative")}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {session?.representative_name || "—"}
            </span>
            {session?.representative_phone && (
              <span className="tabular-nums text-gray-600 dark:text-gray-300">
                {formatPhone(session.representative_phone)}
              </span>
            )}
            {session?.override_reason && (
              <span className="italic text-gray-500 dark:text-gray-400">
                «{session.override_reason}»
              </span>
            )}
          </span>
        </Row>
      )}

      {order.comment && (
        <Row label={t("orderComment")}>
          <span className="italic">«{order.comment}»</span>
        </Row>
      )}
    </Modal>
  );
}

export default memo(OrderEvidenceModal);
