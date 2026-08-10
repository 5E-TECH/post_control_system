import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { message } from "antd";
import {
  PieChart,
  Banknote,
  Wallet,
  TrendingUp,
  HandCoins,
  CalendarDays,
  Info,
} from "lucide-react";
import { useInvestor } from "../../../shared/api/hooks/useInvestor";
import DateRangeFilter from "../components/DateRangeFilter";
import ExportButton from "../components/ExportButton";
import { formatMoney } from "../components/format";

// 'YYYY-MM-DD' → 'DD.MM.YYYY'
const fmtYmd = (ymd?: string) => {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return d && m && y ? `${d}.${m}.${y}` : ymd;
};

const fmtDate = (ms?: number) => {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  return d.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const InvestorMyInvestment = () => {
  const { t } = useTranslation(["investor"]);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { getMyInvestment, getMyLedger, getMyDaily, getMyBasisRequest, approveBasis, rejectBasis } = useInvestor();
  const { data: basisReqRes } = getMyBasisRequest();
  const basisReq = basisReqRes?.data;
  const { data: miRes, isLoading } = getMyInvestment({ startDate: from, endDate: to });
  const { data: ledRes } = getMyLedger({ page, limit: 20 });
  const { data: dailyRes } = getMyDaily({ startDate: from, endDate: to });
  const daily = dailyRes?.data ?? {};
  const dailyDays: any[] = Array.isArray(daily.days) ? daily.days : [];
  const dailyTotals = daily.totals ?? { revenue: 0, postProfit: 0, investorShare: 0, distributed: 0 };
  // Eng yangi kun yuqorida
  const daysDesc = [...dailyDays].reverse();

  const mi = miRes?.data ?? {};
  const led = ledRes?.data ?? {};
  const items = Array.isArray(led.items) ? led.items : [];
  const totalPages = Math.max(1, Math.ceil((led.total ?? 0) / (led.limit ?? 20)));

  // "Hozir olishingiz mumkin" = ishlab topilgan − yechib olingan. Manfiy bo'lsa
  // (ishlab topilgandan ko'proq olingan) — yechishga narsa yo'q (0), ortig'i AVANS.
  const undistributedRaw = Number(mi.undistributed) || 0;
  const availableToWithdraw = Math.max(0, undistributedRaw);
  const advanceTaken = undistributedRaw < 0 ? -undistributedRaw : 0;

  const typeLabel: Record<string, string> = {
    capital: t("typeCapital", "Kapital kiritish"),
    capital_withdrawal: t("typeCapitalWithdrawal", "Kapital qaytarish"),
    distribution: t("typeDistribution", "Foyda olish"),
    stake: t("typeStake", "Ulush o'zgarishi"),
  };

  const dash = "—";

  return (
    <div className="flex flex-col gap-5">
      {/* Sarlavha */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {t("myMoneyTitle", "Mening foydam")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("myMoneySubtitle", "Qancha foyda topdingiz, qanchasini oldingiz va qancha qoldi")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
          <ExportButton scope="personal" from={from} to={to} />
        </div>
      </div>

      {/* Foyda asosi o'zgarishi taklifi — tasdiqlash */}
      {basisReq && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              {t("basisRequestTitle", "Foyda asosini o'zgartirish taklifi")}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-300/80">
              {t("basisRequestBody", "Yangi asos")}:{" "}
              <b>{basisReq.requested_basis === "net" ? t("basisNet", "Sof foyda") : t("basisGross", "Yalpi marja")}</b>
              {" — "}
              {t("basisRequestConfirm", "tasdiqlaysizmi?")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                approveBasis.mutate(undefined, {
                  onSuccess: () => message.success(t("basisApproved", "Tasdiqlandi")),
                })
              }
              className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              {t("approve", "Tasdiqlash")}
            </button>
            <button
              onClick={() =>
                rejectBasis.mutate(undefined, {
                  onSuccess: () => message.success(t("basisRejected", "Rad etildi")),
                })
              }
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-colors"
            >
              {t("reject", "Rad etish")}
            </button>
          </div>
        </div>
      )}

      {/* HERO — 3 ta asosiy raqam (sodda til) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Jami ishlab topilgan foyda */}
        <div className="bg-gradient-to-br from-[#8247ff] to-[#5b21b6] text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{mi.ownershipPct ?? 0}% {t("share", "ulush")}</span>
          </div>
          <p className="text-sm opacity-90 mt-4">{t("totalEarned", "Jami ishlab topgan foydangiz")}</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? "…" : formatMoney(mi.accruedProfitShare)}</p>
        </div>

        {/* Yechib olingan */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <HandCoins className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm opacity-90 mt-4">{t("totalWithdrawn", "Yechib olgan pulingiz")}</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? "…" : formatMoney(mi.distributionsPaid)}</p>
        </div>

        {/* Qoldiq — olishingiz mumkin (hech qachon manfiy emas; ortig'i = avans) */}
        <div
          className={`text-white p-6 rounded-2xl shadow-lg ${
            advanceTaken > 0
              ? "bg-gradient-to-br from-slate-500 to-slate-700"
              : "bg-gradient-to-br from-emerald-500 to-green-600 ring-2 ring-emerald-300/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{t("available", "mavjud")}</span>
          </div>
          <p className="text-sm opacity-90 mt-4">{t("availableToWithdraw", "Hozir olishingiz mumkin")}</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? "…" : formatMoney(availableToWithdraw)}</p>
          {advanceTaken > 0 && (
            <p className="text-xs mt-2 bg-white/15 rounded-lg px-2 py-1 leading-snug">
              {t("advanceNote", "Ishlab topilgandan ko'proq olingan")}:{" "}
              <b>{formatMoney(advanceTaken)}</b>.{" "}
              {t("advanceNote2", "Bu qarz emas — kelgusi foydadan hisobga olinadi.")}
            </p>
          )}
        </div>
      </div>

      {/* Ikkilamchi — kapital, ulush, ROI (kichik, aniq izohli) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("capitalInvested", "Kiritilgan kapital")}</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{formatMoney(mi.capitalInvested)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("ownership", "Egalik ulushi")}</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{mi.ownershipPct ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("roiPlain", "Qaytim (foyda / kapital)")}</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">
              {mi.accruedRoiPct != null ? `${mi.accruedRoiPct}%` : dash}
            </p>
          </div>
        </div>
      </div>

      {/* KUNLIK JADVAL — asosiy: qaysi kuni qancha tushum + sizning foydangiz + yechib olgan */}
      <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-5 h-5 text-gray-400" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">
            {t("dailyTitle2", "Kunlik hisobot")}
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-start gap-1">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {t("dailyHint", "Har kuni qancha tushum bo'lgani, undан biznes foydasi va sizning ulushingiz, hamda o'sha kuni yechib olgan pulingiz.")}
        </p>

        {/* Jami strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
          <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("totalRevenue", "Jami tushum")}</p>
            <p className="font-bold text-gray-800 dark:text-white text-sm sm:text-base">{formatMoney(dailyTotals.revenue)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("totalProfit", "Jami foyda")}</p>
            <p className="font-bold text-gray-800 dark:text-white text-sm sm:text-base">{formatMoney(dailyTotals.postProfit)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("totalYourProfit", "Jami sizning foydangiz")}</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">{formatMoney(dailyTotals.investorShare)}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("totalWithdrawnShort", "Jami yechib olgan")}</p>
            <p className="font-bold text-amber-600 dark:text-amber-400 text-sm sm:text-base">{formatMoney(dailyTotals.distributed)}</p>
          </div>
        </div>

        {daysDesc.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">{t("noData", "Ma'lumot yo'q")}</p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-gray-100 dark:border-[#3B3656]">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-[#332f49] z-10">
                <tr className="text-left text-gray-500 dark:text-gray-300">
                  <th className="py-2.5 px-3">{t("date", "Sana")}</th>
                  <th className="py-2.5 px-3 text-right">{t("dayRevenue", "Tushum")}</th>
                  <th className="py-2.5 px-3 text-right">{t("dayExpense", "Xarajat")}</th>
                  <th className="py-2.5 px-3 text-right">{t("dayProfit", "Foyda")}</th>
                  <th className="py-2.5 px-3 text-center">{t("share", "Ulush")}</th>
                  <th className="py-2.5 px-3 text-right">{t("yourProfit", "Sizning foydangiz")}</th>
                  <th className="py-2.5 px-3 text-right">{t("withdrawnDay", "Yechib olgan")}</th>
                </tr>
              </thead>
              <tbody>
                {daysDesc.map((d: any) => (
                  <tr
                    key={d.date}
                    className={`border-t border-gray-50 dark:border-[#332f49] ${d.distributed > 0 ? "bg-amber-50/40 dark:bg-amber-500/5" : ""}`}
                  >
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtYmd(d.date)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-200">{formatMoney(d.revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-500 dark:text-rose-400">{d.opex > 0 ? formatMoney(d.opex) : dash}</td>
                    <td className={`py-2.5 px-3 text-right ${d.postProfit < 0 ? "text-rose-500 dark:text-rose-400" : "text-gray-700 dark:text-gray-200"}`}>{formatMoney(d.postProfit)}</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">{d.ownershipPct}%</td>
                    <td className={`py-2.5 px-3 text-right font-semibold ${d.investorShare < 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{formatMoney(d.investorShare)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-amber-600 dark:text-amber-400">
                      {d.distributed > 0 ? formatMoney(d.distributed) : dash}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ledger tarixi */}
      <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
          {t("ledgerHistory", "Barcha amallar tarixi")}
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {t("noData", "Ma'lumot yo'q")}
          </p>
        ) : (
          <>
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
                    <tr
                      key={`${i}-${e.type}-${e.occurred_at}`}
                      className="border-b border-gray-50 dark:border-[#332f49] last:border-0"
                    >
                      <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">
                        {fmtDate(e.occurred_at)}
                      </td>
                      <td className="py-2 pr-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#3B3656] text-gray-600 dark:text-gray-300">
                          {typeLabel[e.type] ?? e.type}
                        </span>
                      </td>
                      <td className="py-2 pr-2 font-medium text-gray-700 dark:text-gray-200">
                        {e.type === "stake" && e.ownershipBps != null
                          ? `${(e.ownershipBps / 100).toFixed(2)}%`
                          : formatMoney(e.amount)}
                      </td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">
                        {e.note || dash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 mt-3 text-sm">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-[#3B3656] disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="text-gray-500 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-[#3B3656] disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(InvestorMyInvestment);
