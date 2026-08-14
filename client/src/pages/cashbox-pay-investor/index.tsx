import { memo, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Select, message } from "antd";
import {
  ArrowLeft,
  HandCoins,
  DollarSign,
  FileText,
  ArrowRight,
  Loader2,
  Banknote,
  CreditCard,
} from "lucide-react";
import { useCashBox } from "../../shared/api/hooks/useCashbox";
import { useInvestorAdmin } from "../../shared/api/hooks/useInvestorAdmin";
import { formatMoney } from "../investor/components/format";

const CashboxPayInvestor = () => {
  const { t } = useTranslation(["investor"]);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preId = params.get("investorId") || undefined;

  const { payInvestor } = useCashBox();
  const { getInvestors, getInvestorSummary } = useInvestorAdmin();
  const { data: listRes, isLoading: listLoading } = getInvestors();
  const investors = Array.isArray(listRes?.data) ? listRes.data : [];

  const [investorId, setInvestorId] = useState<string | undefined>(preId);
  useEffect(() => {
    if (preId) setInvestorId(preId);
  }, [preId]);

  const { data: sumRes } = getInvestorSummary(investorId);
  const s = sumRes?.data ?? {};

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"cash" | "click">("cash");
  const [comment, setComment] = useState("");

  const amountNum = Number(amount.replace(/\s/g, "")) || 0;
  const onAmount = (v: string) =>
    setAmount(v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " "));

  const submit = () => {
    if (!investorId) return message.error(t("selectInvestor", "Investorni tanlang"));
    if (amountNum <= 0) return message.error(t("enterAmount", "Miqdorni kiriting"));
    payInvestor.mutate(
      { investor_id: investorId, amount: amountNum, type, comment: comment || undefined },
      {
        onSuccess: () => {
          message.success(t("investorPaid", "Investorga to'landi"));
          navigate(-1);
        },
        onError: (e: any) =>
          message.error(e?.response?.data?.message || t("error", "Xatolik yuz berdi")),
      },
    );
  };

  const field =
    "w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all";

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-amber-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <HandCoins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              {t("payInvestorTitle", "Kassadan investorga to'lash")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {t("payInvestorDesc", "Foyda taqsimoti — kassadan yechiladi va ledgerga yoziladi")}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          {/* Forma */}
          <div className="lg:col-span-3 bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-5 sm:p-6 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("investor", "Investor")} <span className="text-red-500">*</span>
              </label>
              <Select
                className="w-full"
                size="large"
                loading={listLoading}
                placeholder={t("selectInvestor", "Investorni tanlang")}
                value={investorId}
                onChange={setInvestorId}
                showSearch
                optionFilterProp="label"
                options={investors.map((i: any) => ({ value: i.id, label: `${i.name} (${i.phone_number})` }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("amountUzs", "Miqdor (so'm)")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" inputMode="numeric" value={amount} onChange={(e) => onAmount(e.target.value)} className={field} placeholder="5 000 000" />
              </div>
              {amountNum > 0 && <p className="text-xs text-gray-400 mt-1">{formatMoney(amountNum)}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("paymentMethod", "To'lov usuli")}
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setType("cash")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-all ${type === "cash" ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white border-transparent shadow" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}>
                  <Banknote className="w-4 h-4" /> {t("cash", "Naqd")}
                </button>
                <button type="button" onClick={() => setType("click")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-all ${type === "click" ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white border-transparent shadow" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}>
                  <CreditCard className="w-4 h-4" /> {t("card", "Karta")}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t("note", "Izoh")}</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} className={field} placeholder={t("note", "Izoh")} />
              </div>
            </div>

            <button onClick={submit} disabled={payInvestor.isPending}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 mt-2">
              {payInvestor.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t("saving", "Saqlanmoqda...")}</>
              ) : (
                <>{t("pay", "To'lash")} <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {/* Kontekst */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {investorId ? (
              <>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white p-4 rounded-2xl shadow-lg">
                  <p className="text-xs opacity-90">{t("undistributed", "Taqsimlanmagan qoldiq")}</p>
                  <p className="text-2xl font-bold mt-0.5">{formatMoney(s.undistributed)}</p>
                </div>
                <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("accruedShare", "Hisoblangan foyda")}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{formatMoney(s.accruedProfitShare)}</p>
                </div>
                <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("totalDistributions", "Jami to'langan")}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{formatMoney(s.distributionsPaid)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t("payInvestorNote", "Kassadan yechiladi (naqd/karta) va investor ledgeriga taqsimot sifatida yoziladi. Sof foydani kamaytirmaydi.")}
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50 text-sm text-gray-400">
                {t("selectInvestor", "Investorni tanlang")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CashboxPayInvestor);
