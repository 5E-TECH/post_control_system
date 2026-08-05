import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { InputNumber, Button, DatePicker, message } from "antd";
import type { Dayjs } from "dayjs";
import {
  Banknote,
  PieChart,
  HandCoins,
  MinusCircle,
  TrendingUp,
  Layers,
} from "lucide-react";
import { useInvestorAdmin } from "../../../../shared/api/hooks/useInvestorAdmin";
import type { RootState } from "../../../../app/store";
import { formatMoney } from "../../../investor/components/format";

const card =
  "bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50";

const fmtDate = (ms?: number) => {
  if (!ms) return "—";
  return new Date(Number(ms)).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const InvestorEquityPanel = ({ investorUserId }: { investorUserId: string }) => {
  const { t } = useTranslation(["investor"]);
  const role = useSelector((s: RootState) => s.roleSlice.role);
  const isSuper = role === "superadmin";

  const {
    getInvestorSummary,
    getInvestorLedger,
    recordCapital,
    setOwnership,
    recordDistribution,
    recordWithdrawal,
  } = useInvestorAdmin();

  const { data: sumRes } = getInvestorSummary(investorUserId);
  const s = sumRes?.data ?? {};

  const [page, setPage] = useState(1);
  const { data: ledRes } = getInvestorLedger(investorUserId, { page, limit: 20 });
  const led = ledRes?.data ?? {};
  const items = Array.isArray(led.items) ? led.items : [];
  const totalPages = Math.max(1, Math.ceil((led.total ?? 0) / (led.limit ?? 20)));

  // Har amal: miqdor + (ixtiyoriy) sana
  const [capital, setCapital] = useState<number | null>(null);
  const [capitalDate, setCapitalDate] = useState<Dayjs | null>(null);
  const [ownershipPct, setOwnershipPct] = useState<number | null>(null);
  const [ownershipDate, setOwnershipDate] = useState<Dayjs | null>(null);
  const [distribution, setDistribution] = useState<number | null>(null);
  const [distDate, setDistDate] = useState<Dayjs | null>(null);
  const [withdrawal, setWithdrawal] = useState<number | null>(null);
  const [withDate, setWithDate] = useState<Dayjs | null>(null);

  const err = (e: any) =>
    message.error(e?.response?.data?.message || t("error", "Xatolik"));

  const doCapital = () => {
    if (!capital) return;
    recordCapital.mutate(
      { id: investorUserId, body: { amount: capital, contributed_at: capitalDate?.valueOf() } },
      {
        onSuccess: () => { message.success(t("capitalRecorded", "Kapital yozildi")); setCapital(null); setCapitalDate(null); },
        onError: err,
      }
    );
  };
  const doOwnership = () => {
    if (ownershipPct == null || ownershipPct < 0 || ownershipPct > 100) return;
    setOwnership.mutate(
      { id: investorUserId, body: { ownership_bps: Math.round(ownershipPct * 100), effective_from: ownershipDate?.valueOf() } },
      {
        onSuccess: () => { message.success(t("ownershipSet", "Ulush o'rnatildi")); setOwnershipPct(null); setOwnershipDate(null); },
        onError: err,
      }
    );
  };
  const doDistribution = () => {
    if (!distribution) return;
    recordDistribution.mutate(
      { id: investorUserId, body: { amount: distribution, distributed_at: distDate?.valueOf() } },
      {
        onSuccess: () => { message.success(t("distributionRecorded", "Taqsimot yozildi")); setDistribution(null); setDistDate(null); },
        onError: err,
      }
    );
  };
  const doWithdrawal = () => {
    if (!withdrawal) return;
    recordWithdrawal.mutate(
      { id: investorUserId, body: { amount: withdrawal, withdrawn_at: withDate?.valueOf() } },
      {
        onSuccess: () => { message.success(t("withdrawalRecorded", "Kapital qaytarildi")); setWithdrawal(null); setWithDate(null); },
        onError: err,
      }
    );
  };

  const dp = "w-full dark:bg-[#342d4a]! dark:border-[#4b3b6a]!";
  const typeLabel: Record<string, string> = {
    capital: t("typeCapital", "Kapital"),
    capital_withdrawal: t("typeCapitalWithdrawal", "Kapital qaytarish"),
    distribution: t("typeDistribution", "Taqsimot"),
    stake: t("typeStake", "Ulush o'zgarishi"),
  };

  return (
    <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-rose-500" />
        <h3 className="text-base font-semibold text-gray-800 dark:text-white">
          {t("equityTitle", "Investor equity boshqaruvi")}
        </h3>
      </div>

      {/* Xulosa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("ownership", "Ulush")}</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">{s.ownershipPct ?? 0}%</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("capitalInvested", "Sof kapital")}</p>
          <p className="text-lg font-bold text-gray-800 dark:text-white">{formatMoney(s.capitalInvested)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("accruedShare", "Hisoblangan foyda")}</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(s.accruedProfitShare)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("totalDistributions", "Taqsimotlar")}</p>
          <p className="text-lg font-bold text-gray-800 dark:text-white">{formatMoney(s.distributionsPaid)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("totalCapitalIn", "Jami kiritilgan")}</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatMoney(s.capitalContributed)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("capitalWithdrawn", "Qaytarilgan")}</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatMoney(s.capitalWithdrawn)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("accruedRoi", "Hisoblangan ROI")}</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{s.accruedRoiPct != null ? `${s.accruedRoiPct}%` : "—"}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("undistributed", "Taqsimlanmagan")}</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatMoney(s.undistributed)}</p>
        </div>
      </div>

      {/* Amal formalari */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {isSuper && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2"><Banknote className="w-4 h-4 text-blue-500" /><span className="font-semibold text-sm text-gray-800 dark:text-white">{t("recordCapital", "Kapital kiritish")}</span></div>
            <InputNumber className="w-full" placeholder={t("amountUzs", "Miqdor")} min={1} value={capital} onChange={(v) => setCapital(v == null ? null : Number(v))} />
            <DatePicker className={`mt-2 ${dp}`} format="DD-MM-YYYY" placeholder={t("date", "Sana")} value={capitalDate} onChange={setCapitalDate} />
            <Button className="mt-2 w-full" loading={recordCapital.isPending} onClick={doCapital}>{t("save", "Saqlash")}</Button>
          </div>
        )}
        {isSuper && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2"><PieChart className="w-4 h-4 text-emerald-500" /><span className="font-semibold text-sm text-gray-800 dark:text-white">{t("setOwnership", "Ulush o'rnatish")}</span></div>
            <InputNumber className="w-full" placeholder={t("ownershipPctPh", "Ulush %")} min={0} max={100} step={0.01} value={ownershipPct} onChange={(v) => setOwnershipPct(v == null ? null : Number(v))} />
            <DatePicker className={`mt-2 ${dp}`} format="DD-MM-YYYY" placeholder={t("date", "Sana")} value={ownershipDate} onChange={setOwnershipDate} />
            <Button className="mt-2 w-full" loading={setOwnership.isPending} onClick={doOwnership}>{t("save", "Saqlash")}</Button>
          </div>
        )}
        <div className={card}>
          <div className="flex items-center gap-2 mb-2"><HandCoins className="w-4 h-4 text-amber-500" /><span className="font-semibold text-sm text-gray-800 dark:text-white">{t("recordDistribution", "Taqsimot")}</span></div>
          <InputNumber className="w-full" placeholder={t("amountUzs", "Miqdor")} min={1} value={distribution} onChange={(v) => setDistribution(v == null ? null : Number(v))} />
          <DatePicker className={`mt-2 ${dp}`} format="DD-MM-YYYY" placeholder={t("date", "Sana")} value={distDate} onChange={setDistDate} />
          <Button className="mt-2 w-full" loading={recordDistribution.isPending} onClick={doDistribution}>{t("save", "Saqlash")}</Button>
        </div>
        {isSuper && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2"><MinusCircle className="w-4 h-4 text-rose-500" /><span className="font-semibold text-sm text-gray-800 dark:text-white">{t("recordWithdrawal", "Kapital qaytarish")}</span></div>
            <InputNumber className="w-full" placeholder={t("amountUzs", "Miqdor")} min={1} value={withdrawal} onChange={(v) => setWithdrawal(v == null ? null : Number(v))} />
            <DatePicker className={`mt-2 ${dp}`} format="DD-MM-YYYY" placeholder={t("date", "Sana")} value={withDate} onChange={setWithDate} />
            <Button className="mt-2 w-full" loading={recordWithdrawal.isPending} onClick={doWithdrawal}>{t("save", "Saqlash")}</Button>
          </div>
        )}
      </div>

      {/* Ledger */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-gray-400" /><h4 className="font-semibold text-sm text-gray-800 dark:text-white">{t("ledgerHistory", "Ledger tarixi")}</h4></div>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">{t("noData", "Ma'lumot yo'q")}</p>
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
          </>
        )}
      </div>
    </div>
  );
};

export default memo(InvestorEquityPanel);
