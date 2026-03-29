import { memo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import {
  ArrowLeft,
  BarChart2,
  ShoppingBag,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  User,
  Phone,
  Loader2,
  CalendarDays,
  Wallet,
  CreditCard,
  History,
  Plus,
  X,
} from "lucide-react";

const statusColors: Record<string, string> = {
  sold: "bg-green-500",
  paid: "bg-green-500",
  partly_paid: "bg-emerald-400",
  closed: "bg-teal-500",
  cancelled: "bg-red-500",
  "cancelled (sent)": "bg-red-400",
  new: "bg-blue-500",
  received: "bg-indigo-500",
  "on the road": "bg-violet-500",
  waiting: "bg-amber-500",
  created: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  sold: "Sotildi",
  paid: "To'landi",
  partly_paid: "Qisman to'landi",
  closed: "Yopildi",
  cancelled: "Bekor qilindi",
  "cancelled (sent)": "Bekor (yuborilgan)",
  new: "Yangi",
  received: "Qabul qilindi",
  "on the road": "Yo'lda",
  waiting: "Kutilmoqda",
  created: "Yaratildi",
};

const fmt = (val: number) =>
  Number(val || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";

const fmtDate = (ts: string | number) => {
  if (!ts) return "—";
  return new Date(Number(ts)).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const StatCard = ({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className={`rounded-2xl p-4 ${color}`}>
    <div className="mb-2 opacity-80">{icon}</div>
    <p className="text-2xl font-bold mb-0.5">{value}</p>
    <p className="text-xs opacity-70">{label}</p>
  </div>
);

const OperatorStats = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getOperatorStats, getOperatorBalance, payOperator } = useUser();
  const { handleApiError, handleSuccess } = useApiNotification();

  const { data, isLoading, isError } = getOperatorStats(id ?? null);
  const { data: balData, isLoading: balLoading } = getOperatorBalance(id ?? null);

  const stats = data?.data;
  const bal = balData?.data;

  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const handlePay = () => {
    if (!id || !payAmount || Number(payAmount) <= 0) return;
    payOperator.mutate(
      { id, data: { amount: Number(payAmount), note: payNote || undefined } },
      {
        onSuccess: () => {
          handleSuccess("To'lov amalga oshirildi");
          setShowPayForm(false);
          setPayAmount("");
          setPayNote("");
        },
        onError: (err: any) => handleApiError(err, "To'lovda xatolik"),
      }
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/market-operators")}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              Operator statistikasi
            </h1>
            {stats?.operator && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.operator.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-60">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        </div>
      ) : isError || !stats ? (
        <div className="flex flex-col items-center justify-center h-60 text-gray-400">
          <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Ma'lumot topilmadi</p>
        </div>
      ) : (
        <>
          {/* Operator Info */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5 mb-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-800 dark:text-white">
                    {stats.operator.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {stats.operator.phone_number}
                    </p>
                  </div>
                </div>
              </div>
              <div className="sm:ml-auto flex items-center gap-3">
                <span
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                    stats.operator.status === "active"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  }`}
                >
                  {stats.operator.status === "active" ? "Faol" : "Nofaol"}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{fmtDate(stats.operator.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard
              icon={<ShoppingBag className="w-4 h-4" />}
              label="Jami buyurtma"
              value={stats.stats.total}
              color="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
            />
            <StatCard
              icon={<CheckCircle className="w-4 h-4" />}
              label="Sotilgan"
              value={stats.stats.sold}
              color="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
            />
            <StatCard
              icon={<XCircle className="w-4 h-4" />}
              label="Bekor"
              value={stats.stats.cancelled}
              color="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
            />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Jarayonda"
              value={stats.stats.pending}
              color="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
            />
          </div>

          {/* Success Rate + Revenue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Muvaffaqiyat darajasi
                </span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.stats.success_rate}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                  style={{ width: `${stats.stats.success_rate}%` }}
                />
              </div>
            </div>
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Sotilgan buyurtmalar summasi
                </span>
              </div>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                {fmt(stats.stats.total_revenue)}
              </p>
            </div>
          </div>

          {/* ─── BALANCE & PAYMENTS SECTION ─── */}
          {balLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
          ) : bal && bal.operator?.commission_type ? (
            <>
              {/* Balance Cards */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 text-center">
                  <Wallet className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                  <p className="text-xs text-indigo-500 dark:text-indigo-400">
                    Ishlab topdi
                  </p>
                  <p className="text-base font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                    {fmt(bal.total_earned)}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
                  <CreditCard className="w-4 h-4 text-green-500 mx-auto mb-1" />
                  <p className="text-xs text-green-500 dark:text-green-400">
                    To'langan
                  </p>
                  <p className="text-base font-bold text-green-700 dark:text-green-300 mt-0.5">
                    {fmt(bal.total_paid)}
                  </p>
                </div>
                <div
                  className={`rounded-2xl p-4 text-center ${
                    bal.balance > 0
                      ? "bg-amber-50 dark:bg-amber-900/20"
                      : "bg-gray-50 dark:bg-gray-800/40"
                  }`}
                >
                  <TrendingUp
                    className={`w-4 h-4 mx-auto mb-1 ${
                      bal.balance > 0
                        ? "text-amber-500"
                        : "text-gray-400"
                    }`}
                  />
                  <p
                    className={`text-xs ${
                      bal.balance > 0
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-gray-400"
                    }`}
                  >
                    Qoldiq
                  </p>
                  <p
                    className={`text-base font-bold mt-0.5 ${
                      bal.balance > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-gray-500"
                    }`}
                  >
                    {fmt(bal.balance)}
                  </p>
                </div>
              </div>

              {/* Commission info */}
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-700/50 p-4 mb-5 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Har bir sotuvdan komissiya:
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-2">
                    {bal.operator.commission_type === "percent"
                      ? `${bal.operator.commission_value}%`
                      : `${Number(bal.operator.commission_value).toLocaleString()} so'm`}
                  </span>
                </div>
                {bal.balance > 0 && (
                  <button
                    onClick={() => setShowPayForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    To'lov qilish
                  </button>
                )}
              </div>

              {/* Pay Form */}
              {showPayForm && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-200 dark:border-indigo-700/50 p-4 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      Operatorga to'lov
                    </p>
                    <button
                      onClick={() => {
                        setShowPayForm(false);
                        setPayAmount("");
                        setPayNote("");
                      }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="number"
                      min="1"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder={`Maksimum: ${fmt(bal.balance)}`}
                      className="w-full h-9 px-3 text-sm rounded-xl border border-indigo-200 dark:border-indigo-600 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <input
                      type="text"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      placeholder="Izoh (ixtiyoriy)"
                      className="w-full h-9 px-3 text-sm rounded-xl border border-indigo-200 dark:border-indigo-600 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <button
                      onClick={handlePay}
                      disabled={payOperator.isPending || !payAmount || Number(payAmount) <= 0}
                      className="w-full h-9 rounded-xl bg-indigo-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {payOperator.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "To'lovni tasdiqlash"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Payment History */}
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden mb-5">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    To'lov tarixi
                  </h2>
                </div>
                {!bal.payments?.length ? (
                  <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                    <p className="text-sm">Hech qanday to'lov yo'q</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
                    {bal.payments.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-5 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                            + {fmt(p.amount)}
                          </p>
                          {p.note && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {p.note}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {fmtDate(p.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* Recent Orders Table */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                So'nggi buyurtmalar
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Oxirgi {stats.recent_orders?.length || 0} ta buyurtma
              </p>
            </div>
            {!stats.recent_orders?.length ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <ShoppingBag className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Hech qanday buyurtma yo'q</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
                {stats.recent_orders.map((order: any, idx: number) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#312D4B] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5 text-right">
                        {idx + 1}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          statusColors[order.status] ?? "bg-gray-400"
                        }`}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                        {statusLabels[order.status] ?? order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {fmt(order.total_price)}
                      </span>
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {fmtDate(order.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default memo(OperatorStats);
