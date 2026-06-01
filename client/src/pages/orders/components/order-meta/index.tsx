import { memo, useState, type FC } from "react";
import {
  FileText,
  Hash,
  Copy,
  Calendar,
  CheckCircle2,
  XCircle,
  User,
  Phone,
  Home,
  Store,
  Package,
  Truck,
  RotateCcw,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { formatPhone } from "../../../../shared/helpers/formatPhone";

interface IProps {
  order: any;
  role?: string | null;
}

const postStatusLabels: Record<string, string> = {
  new: "Yangi",
  sent: "Jo'natilgan",
  received: "Qabul qilingan",
  canceled: "Bekor qilingan",
  canceled_received: "Qaytarilgan",
};

const formatDateTime = (ts?: string | number | null) => {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const OrderMeta: FC<IProps> = ({ order, role }) => {
  const { handleSuccess } = useApiNotification();
  // Tariflar maxfiy — default yashirin (blur), bosilganda ochiladi.
  const [tariffVisible, setTariffVisible] = useState(false);

  if (!order) return null;

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value);
    handleSuccess(`${label} nusxalandi`);
  };

  const whereDeliver = order?.where_deliver;

  // Rolga qarab qaysi tarif ko'rinadi:
  //  - market  → faqat pochtaga to'laydigan summasi (market_tariff)
  //  - courier → faqat oladigan summasi (courier_tariff)
  //  - admin/superadmin → ikkalasi
  const isAdmin = role === "admin" || role === "superadmin";
  const isMarket = role === "market";
  const isCourier = role === "courier";
  const showTariffRow = isAdmin || isMarket || isCourier;

  const fmt = (v: any) =>
    v != null ? `${Number(v).toLocaleString("uz-UZ")} so'm` : "Standart";

  let tariffLabel = "Tarif";
  let tariffValue = "";
  if (isAdmin) {
    tariffLabel = "Tariflar (pochta/kurier)";
    tariffValue = `${fmt(order?.market_tariff)} / ${fmt(order?.courier_tariff)}`;
  } else if (isMarket) {
    tariffLabel = "Pochta to'lovi";
    tariffValue = fmt(order?.market_tariff);
  } else if (isCourier) {
    tariffLabel = "Sizning tarifingiz";
    tariffValue = fmt(order?.courier_tariff);
  }

  // Qator: label (chap) + value (o'ng)
  const Row = ({
    icon: Icon,
    label,
    children,
  }: {
    icon: typeof Hash;
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800 dark:text-white text-right">
        {children}
      </span>
    </div>
  );

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 dark:text-white">
              Buyurtma ma'lumotlari
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Umumiy tafsilotlar
            </p>
          </div>
          {/* O'qiladigan raqam — nusxalanadi (qidiruv uchun) */}
          {order?.order_number != null && (
            <button
              onClick={() => copy(String(order.order_number), "Raqam")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-bold text-base hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
              title="Raqamni nusxalash"
            >
              #{order.order_number}
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 divide-y divide-gray-100 dark:divide-gray-700/40">
        {/* Identifikatorlar */}
        <div className="pb-2 space-y-0.5">
          <Row icon={Hash} label="UUID">
            <button
              onClick={() => copy(order?.id, "UUID")}
              className="inline-flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              title="Nusxalash"
            >
              {String(order?.id || "").slice(0, 8)}…
              <Copy className="w-3 h-3" />
            </button>
          </Row>
          {order?.external_id && (
            <Row icon={ExternalLink} label="Tashqi ID">
              <button
                onClick={() => copy(order.external_id, "Tashqi ID")}
                className="inline-flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                title="Nusxalash"
              >
                {order.external_id}
                <Copy className="w-3 h-3" />
              </button>
            </Row>
          )}
        </div>

        {/* Sanalar */}
        <div className="py-2 space-y-0.5">
          <Row icon={Calendar} label="Yaratilgan">
            {formatDateTime(order?.created_at)}
          </Row>
          {order?.sold_at && (
            <Row icon={CheckCircle2} label="Sotilgan">
              <span className="text-emerald-600 dark:text-emerald-400">
                {formatDateTime(order.sold_at)}
              </span>
            </Row>
          )}
          {order?.cancelled_at && (
            <Row icon={XCircle} label="Bekor qilingan">
              <span className="text-red-600 dark:text-red-400">
                {formatDateTime(order.cancelled_at)}
              </span>
            </Row>
          )}
        </div>

        {/* Operator */}
        {(order?.operator || order?.operator_phone) && (
          <div className="py-2 space-y-0.5">
            {order?.operator && (
              <Row icon={User} label="Operator">
                {order.operator}
              </Row>
            )}
            {order?.operator_phone && (
              <Row icon={Phone} label="Operator tel">
                <a
                  href={`tel:${order.operator_phone}`}
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {formatPhone(order.operator_phone)}
                </a>
              </Row>
            )}
            {order?.secondary_operator_phone && (
              <Row icon={Phone} label="2-operator tel">
                <a
                  href={`tel:${order.secondary_operator_phone}`}
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {formatPhone(order.secondary_operator_phone)}
                </a>
              </Row>
            )}
          </div>
        )}

        {/* Logistika */}
        <div className="py-2 space-y-0.5">
          <Row
            icon={whereDeliver === "address" ? Home : Store}
            label="Yetkazish"
          >
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                whereDeliver === "address"
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}
            >
              {whereDeliver === "address" ? "Uyga" : "Markazga"}
            </span>
          </Row>
          {order?.product_quantity != null && (
            <Row icon={Package} label="Mahsulot soni">
              {order.product_quantity} dona
            </Row>
          )}
          {order?.post?.status && (
            <Row icon={Truck} label="Pochta holati">
              {postStatusLabels[order.post.status] || order.post.status}
            </Row>
          )}
          {showTariffRow && (
            <Row icon={Truck} label={tariffLabel}>
              <button
                onClick={() => setTariffVisible((v) => !v)}
                className="inline-flex items-center gap-1.5 cursor-pointer group"
                title={tariffVisible ? "Yashirish" : "Ko'rsatish uchun bosing"}
              >
                <span
                  className={`transition-all ${
                    tariffVisible
                      ? ""
                      : "blur-[5px] select-none group-hover:blur-[4px]"
                  }`}
                >
                  {tariffValue}
                </span>
                {tariffVisible ? (
                  <EyeOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                )}
              </button>
            </Row>
          )}
        </div>

        {/* Qaytarish so'rovi */}
        {order?.return_requested && (
          <div className="pt-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
              <RotateCcw className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Kurier bu buyurtmani qaytarishni so'ragan
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(OrderMeta);
