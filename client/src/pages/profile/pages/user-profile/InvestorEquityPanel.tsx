import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { DatePicker, message } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PieChart,
  HandCoins,
  MinusCircle,
  TrendingUp,
  Plus,
  CalendarDays,
} from "lucide-react";
import { useInvestorAdmin } from "../../../../shared/api/hooks/useInvestorAdmin";
import type { RootState } from "../../../../app/store";
import { formatMoney, formatMoneyShort, formatNumber } from "../../../investor/components/format";

const fmtDate = (ms?: number) =>
  !ms
    ? "—"
    : new Date(Number(ms)).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });

const InvestorEquityPanel = ({ investorUserId }: { investorUserId: string }) => {
  const { t } = useTranslation(["investor"]);
  const navigate = useNavigate();
  const role = useSelector((s: RootState) => s.roleSlice.role);
  const isSuper = role === "superadmin";

  const { getInvestorSummary, getInvestorLedger, getInvestorDaily, setOwnership } =
    useInvestorAdmin();

  const { data: sumRes } = getInvestorSummary(investorUserId);
  const s = sumRes?.data ?? {};

  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const { data: dailyRes, isLoading: dailyLoading } = getInvestorDaily(investorUserId, {
    startDate: from,
    endDate: to,
  });
  const daily = dailyRes?.data ?? {};
  const days: any[] = Array.isArray(daily.days) ? daily.days : [];
  const dailyTotals = daily.totals ?? { postProfit: 0, investorShare: 0 };

  const [page, setPage] = useState(1);
  const { data: ledRes } = getInvestorLedger(investorUserId, { page, limit: 10 });
  const led = ledRes?.data ?? {};
  const items = Array.isArray(led.items) ? led.items : [];
  const totalPages = Math.max(1, Math.ceil((led.total ?? 0) / (led.limit ?? 10)));

  const go = (action: string) => navigate(`/investor-equity/${investorUserId}/${action}`);

  const changeBasis = (basis: "net" | "gross") => {
    if (basis === s.profitBasis) return;
    setOwnership.mutate(
      { id: investorUserId, body: { ownership_bps: s.ownershipBps ?? 0, profit_basis: basis } },
      {
        onSuccess: () => message.success(t("basisChanged", "Foyda asosi o'zgartirildi")),
        onError: (e: any) => message.error(e?.response?.data?.message || t("error", "Xatolik")),
      }
    );
  };

  const typeLabel: Record<string, string> = {
    capital: t("typeCapital", "Kapital"),
    capital_withdrawal: t("typeCapitalWithdrawal", "Kapital qaytarish"),
    distribution: t("typeDistribution", "Taqsimot"),
    stake: t("typeStake", "Ulush o'zgarishi"),
  };
  const chartData = days.map((d) => ({ label: d.label, investor: d.investorShare, post: d.postProfit }));

  return (
    <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-4">
      {/* Header + basis */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-gray-800 dark:text-white">
            {t("equityTitle", "Investor equity boshqaruvi")}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t("profitBasis", "Foyda asosi")}:</span>
          {isSuper ? (
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
              {(["net", "gross"] as const).map((b) => (
                <button key={b} onClick={() => changeBasis(b)}
                  className={`px-3 py-1 font-medium transition-colors ${(s.profitBasis ?? "net") === b ? "bg-rose-500 text-white" : "bg-white dark:bg-[#2A263D] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A]"}`}>
                  {b === "net" ? t("basisNet", "Sof foyda") : t("basisGross", "Yalpi marja")}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {(s.profitBasis ?? "net") === "net" ? t("basisNet", "Sof foyda") : t("basisGross", "Yalpi marja")}
            </span>
          )}
        </div>
      </div>

      {/* Hero summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-[#8247ff] to-[#5b21b6] text-white p-5 rounded-2xl shadow-lg">
          <div className="flex items-center gap-2 opacity-90 text-sm"><PieChart className="w-4 h-4" />{t("ownership", "Ulush")}</div>
          <p className="text-3xl font-bold mt-1">{s.ownershipPct ?? 0}%</p>
          <p className="text-sm opacity-80 mt-1">{t("capitalInvested", "Sof kapital")}: {formatMoney(s.capitalInvested)}</p>
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("accruedShare", "Hisoblangan foyda")}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatMoney(s.accruedProfitShare)}</p>
          <p className="text-xs text-gray-400 mt-1">{t("accruedRoi", "ROI")}: {s.accruedRoiPct != null ? `${s.accruedRoiPct}%` : "—"}</p>
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("undistributed", "Taqsimlanmagan qoldiq")}</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{formatMoney(s.undistributed)}</p>
          <p className="text-xs text-gray-400 mt-1">{t("totalDistributions", "To'langan")}: {formatMoney(s.distributionsPaid)}</p>
        </div>
      </div>

      {/* Amal tugmalari — alohida sahifaga o'tadi */}
      <div className="flex flex-wrap gap-2">
        {isSuper && (
          <button onClick={() => go("capital")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors">
            <Plus className="w-4 h-4" /> {t("recordCapital", "Kapital kiritish")}
          </button>
        )}
        {isSuper && (
          <button onClick={() => go("ownership")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
            <PieChart className="w-4 h-4" /> {t("setOwnership", "Ulush o'rnatish")}
          </button>
        )}
        <button onClick={() => go("distribution")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">
          <HandCoins className="w-4 h-4" /> {t("recordDistribution", "Taqsimot")}
        </button>
        {isSuper && (
          <button onClick={() => go("withdrawal")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-rose-500 hover:bg-rose-600 text-white transition-colors">
            <MinusCircle className="w-4 h-4" /> {t("recordWithdrawal", "Kapital qaytarish")}
          </button>
        )}
      </div>

      {/* Kunlik foyda breakdown */}
      <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-violet-500" />
            <h4 className="font-semibold text-sm text-gray-800 dark:text-white">{t("dailyTitle", "Kunlik foyda")}</h4>
          </div>
          <DatePicker.RangePicker
            size="small"
            onChange={(dates) => {
              setFrom(dates?.[0] ? dates[0].format("YYYY-MM-DD") : undefined);
              setTo(dates?.[1] ? dates[1].format("YYYY-MM-DD") : undefined);
            }}
            className="dark:bg-[#342d4a]! dark:border-[#4b3b6a]!"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("postProfit", "Pochta foydasi")} ({t("total", "jami")})</p>
            <p className="font-bold text-gray-800 dark:text-white">{formatMoney(dailyTotals.postProfit)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("investorShare", "Investor foydasi")} ({t("total", "jami")})</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(dailyTotals.investorShare)}</p>
          </div>
        </div>

        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#8884aa22" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis tickFormatter={(v) => formatMoneyShort(v)} tick={{ fontSize: 10 }} stroke="#9ca3af" width={44} />
              <Tooltip formatter={(v: any, n: string) => [formatMoney(v), n === "investor" ? t("investorShare", "Investor foydasi") : t("postProfit", "Pochta foydasi")]}
                contentStyle={{ borderRadius: 10, border: "none", background: "#2A263D", color: "#fff", fontSize: 12 }} />
              <Bar dataKey="post" fill="#8247ff55" radius={[3, 3, 0, 0]} />
              <Bar dataKey="investor" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {dailyLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">…</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">{t("noData", "Ma'lumot yo'q")}</p>
        ) : (
          <div className="overflow-x-auto mt-2 max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-[#2A263D]">
                <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#3B3656]">
                  <th className="py-2 pr-2">{t("date", "Sana")}</th>
                  <th className="py-2 pr-2">{t("orders", "Buyurtma")}</th>
                  <th className="py-2 pr-2">{t("postProfit", "Pochta foydasi")}</th>
                  <th className="py-2 pr-2">{t("ownership", "Ulush")}</th>
                  <th className="py-2 text-right">{t("investorShare", "Investor foydasi")}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-b border-gray-50 dark:border-[#332f49] last:border-0">
                    <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">{d.date}</td>
                    <td className="py-2 pr-2 text-gray-500">{formatNumber(d.ordersCount)}</td>
                    <td className="py-2 pr-2 text-gray-700 dark:text-gray-200">{formatMoney(d.postProfit)}</td>
                    <td className="py-2 pr-2 text-gray-500">{d.ownershipPct}%</td>
                    <td className="py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(d.investorShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ledger tarixi */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
          <h4 className="font-semibold text-sm text-gray-800 dark:text-white mb-3">{t("ledgerHistory", "Ledger tarixi")}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#3B3656]">
                  <th className="py-2 pr-2">{t("date", "Sana")}</th>
                  <th className="py-2 pr-2">{t("type", "Tur")}</th>
                  <th className="py-2 pr-2">{t("amount", "Miqdor")}</th>
                  <th className="py-2">{t("note", "Izoh")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e: any, i: number) => (
                  <tr key={`${i}-${e.type}-${e.occurred_at}`} className="border-b border-gray-50 dark:border-[#332f49] last:border-0">
                    <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">{fmtDate(e.occurred_at)}</td>
                    <td className="py-2 pr-2"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-[#3B3656] text-gray-600 dark:text-gray-300">{typeLabel[e.type] ?? e.type}</span></td>
                    <td className="py-2 pr-2 font-medium text-gray-700 dark:text-gray-200">{e.type === "stake" && e.ownershipBps != null ? `${(e.ownershipBps / 100).toFixed(2)}%` : formatMoney(e.amount)}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-3 text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-[#3B3656] disabled:opacity-40">‹</button>
              <span className="text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-[#3B3656] disabled:opacity-40">›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(InvestorEquityPanel);
