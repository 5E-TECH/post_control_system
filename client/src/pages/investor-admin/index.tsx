import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input, InputNumber, Button, Select, message } from "antd";
import { UserPlus, Banknote, PieChart, HandCoins } from "lucide-react";
import { useInvestorAdmin } from "../../shared/api/hooks/useInvestorAdmin";
import { formatMoney } from "../investor/components/format";

const InvestorAdmin = () => {
  const { t } = useTranslation(["investor"]);
  const {
    getInvestors,
    getInvestorSummary,
    createInvestor,
    recordCapital,
    setOwnership,
    recordDistribution,
  } = useInvestorAdmin();

  const { data: listRes, isLoading } = getInvestors();
  const investors = Array.isArray(listRes?.data) ? listRes.data : [];

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const { data: sumRes } = getInvestorSummary(selectedId);
  const summary = sumRes?.data ?? {};

  // Yangi investor formasi
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Amal formalari
  const [capital, setCapital] = useState<number | null>(null);
  const [ownershipPct, setOwnershipPct] = useState<number | null>(null);
  const [distribution, setDistribution] = useState<number | null>(null);

  const handleCreate = () => {
    if (!name || !phone || !password)
      return message.error(t("fillAll", "Barcha maydonlarni to'ldiring"));
    createInvestor.mutate(
      { name, phone_number: phone, password },
      {
        onSuccess: () => {
          message.success(t("investorCreated", "Investor yaratildi"));
          setName("");
          setPhone("");
          setPassword("");
        },
        onError: (e: any) =>
          message.error(
            e?.response?.data?.message || t("error", "Xatolik yuz berdi"),
          ),
      },
    );
  };

  const guardSel = () => {
    if (!selectedId) {
      message.error(t("selectInvestor", "Avval investorni tanlang"));
      return false;
    }
    return true;
  };

  const handleCapital = () => {
    if (!guardSel() || !capital) return;
    recordCapital.mutate(
      { id: selectedId!, body: { amount: capital } },
      {
        onSuccess: () => {
          message.success(t("capitalRecorded", "Kapital yozildi"));
          setCapital(null);
        },
        onError: (e: any) =>
          message.error(e?.response?.data?.message || t("error", "Xatolik")),
      },
    );
  };

  const handleOwnership = () => {
    if (!guardSel() || ownershipPct == null) return;
    setOwnership.mutate(
      { id: selectedId!, body: { ownership_bps: Math.round(ownershipPct * 100) } },
      {
        onSuccess: () => {
          message.success(t("ownershipSet", "Ulush o'rnatildi"));
          setOwnershipPct(null);
        },
        onError: (e: any) =>
          message.error(e?.response?.data?.message || t("error", "Xatolik")),
      },
    );
  };

  const handleDistribution = () => {
    if (!guardSel() || !distribution) return;
    recordDistribution.mutate(
      { id: selectedId!, body: { amount: distribution } },
      {
        onSuccess: () => {
          message.success(t("distributionRecorded", "Taqsimot yozildi"));
          setDistribution(null);
        },
        onError: (e: any) =>
          message.error(e?.response?.data?.message || t("error", "Xatolik")),
      },
    );
  };

  const card = "bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm";

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
          {t("adminTitle", "Investor boshqaruvi (equity)")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("adminSubtitle", "Investor yaratish, kapital, ulush va taqsimot kiritish")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Yangi investor */}
        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-5 h-5 text-violet-500" />
            <h3 className="font-semibold text-gray-800 dark:text-white">
              {t("newInvestor", "Yangi investor")}
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            <Input placeholder={t("name", "Ism")} value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="+998901234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input.Password placeholder={t("password", "Parol")} value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="primary" loading={createInvestor.isPending} onClick={handleCreate}>
              {t("create", "Yaratish")}
            </Button>
          </div>
        </div>

        {/* Investor tanlash + xulosa */}
        <div className={card}>
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
            {t("selectInvestorTitle", "Investorni tanlang")}
          </h3>
          <Select
            className="w-full"
            loading={isLoading}
            placeholder={t("selectInvestor", "Investorni tanlang")}
            value={selectedId}
            onChange={setSelectedId}
            options={investors.map((i: any) => ({
              value: i.id,
              label: `${i.name} (${i.phone_number})`,
            }))}
          />
          {selectedId && (
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
                <p className="text-gray-500 dark:text-gray-400">{t("ownership", "Ulush")}</p>
                <p className="font-bold text-gray-800 dark:text-white">{summary.ownershipPct ?? 0}%</p>
              </div>
              <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
                <p className="text-gray-500 dark:text-gray-400">{t("capitalInvested", "Kapital")}</p>
                <p className="font-bold text-gray-800 dark:text-white">{formatMoney(summary.capitalInvested)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
                <p className="text-gray-500 dark:text-gray-400">{t("accruedShare", "Hisoblangan ulush")}</p>
                <p className="font-bold text-gray-800 dark:text-white">{formatMoney(summary.accruedProfitShare)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
                <p className="text-gray-500 dark:text-gray-400">{t("totalDistributions", "Taqsimotlar")}</p>
                <p className="font-bold text-gray-800 dark:text-white">{formatMoney(summary.distributionsPaid)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Amal formalari */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-800 dark:text-white">{t("recordCapital", "Kapital kiritish")}</h3>
          </div>
          <InputNumber
            className="w-full"
            placeholder={t("amountUzs", "Miqdor (so'm)")}
            min={1}
            value={capital}
            onChange={(v) => setCapital(v as number)}
          />
          <Button className="mt-2 w-full" loading={recordCapital.isPending} onClick={handleCapital}>
            {t("save", "Saqlash")}
          </Button>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-gray-800 dark:text-white">{t("setOwnership", "Ulush o'rnatish")}</h3>
          </div>
          <InputNumber
            className="w-full"
            placeholder={t("ownershipPctPh", "Ulush foizi (masalan 20)")}
            min={0}
            max={100}
            step={0.01}
            value={ownershipPct}
            onChange={(v) => setOwnershipPct(v as number)}
          />
          <Button className="mt-2 w-full" loading={setOwnership.isPending} onClick={handleOwnership}>
            {t("save", "Saqlash")}
          </Button>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <HandCoins className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-800 dark:text-white">{t("recordDistribution", "Taqsimot kiritish")}</h3>
          </div>
          <InputNumber
            className="w-full"
            placeholder={t("amountUzs", "Miqdor (so'm)")}
            min={1}
            value={distribution}
            onChange={(v) => setDistribution(v as number)}
          />
          <Button className="mt-2 w-full" loading={recordDistribution.isPending} onClick={handleDistribution}>
            {t("save", "Saqlash")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(InvestorAdmin);
