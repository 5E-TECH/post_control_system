import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvestorAdmin } from "../../../../shared/api/hooks/useInvestorAdmin";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { buildAdminPath } from "../../../../shared/const";
import {
  User,
  Phone,
  Lock,
  DollarSign,
  Percent,
  Calendar,
  ArrowRight,
  Loader2,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";

const CreateInvestor = () => {
  const { t } = useTranslation("users");
  const { createInvestor, recordCapital, setOwnership } = useInvestorAdmin();
  const navigate = useNavigate();
  const { handleApiError, handleSuccess } = useApiNotification();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "+998 ",
    password: "",
    capital: "",
    ownership: "",
  });
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePhoneChange = (value: string) => {
    let input = value;
    if (!input.startsWith("+998 ")) input = "+998 ";
    let val = input.replace(/\D/g, "").slice(3);
    if (val.length > 9) val = val.slice(0, 9);
    let formatted = "+998 ";
    if (val.length > 0) {
      formatted += val
        .replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, d) =>
          [a, b, c, d].filter(Boolean).join(" ")
        )
        .trim();
    }
    setFormData((prev) => ({ ...prev, phone_number: formatted }));
  };

  const handleCapitalChange = (value: string) => {
    const onlyNums = value.replace(/\D/g, "");
    const formatted = onlyNums.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setFormData((prev) => ({ ...prev, capital: formatted }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = t("enterName");
    if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(formData.phone_number)) {
      newErrors.phone_number = t("phoneNumberPattern");
    }
    if (!formData.password) newErrors.password = t("enterPassword");
    if (formData.ownership) {
      const pct = Number(formData.ownership);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        newErrors.ownership = t("ownershipRange", "Ulush 0..100 oralig'ida");
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    // Backdating: kapital/ulush sanasi (bo'sh bo'lsa — hozir). Ulush effective_from
    // shu sanaga qo'yilgani uchun tizim o'sha kundan foydani AVTOMATIK hisoblaydi.
    const occurredMs = startDate ? startDate.valueOf() : undefined;
    const capitalNum = formData.capital
      ? Number(formData.capital.replace(/,/g, ""))
      : 0;
    const ownershipPct = formData.ownership ? Number(formData.ownership) : null;

    try {
      const res: any = await createInvestor.mutateAsync({
        name: formData.name,
        phone_number: formData.phone_number.split(" ").join(""),
        password: formData.password,
      });
      const investorId = res?.data?.data?.id;

      if (investorId && capitalNum > 0) {
        await recordCapital.mutateAsync({
          id: investorId,
          body: { amount: capitalNum, contributed_at: occurredMs },
        });
      }
      if (investorId && ownershipPct != null) {
        await setOwnership.mutateAsync({
          id: investorId,
          body: {
            ownership_bps: Math.round(ownershipPct * 100),
            effective_from: occurredMs,
          },
        });
      }

      handleSuccess(t("investorCreated", "Investor muvaffaqiyatli yaratildi"));
      navigate(buildAdminPath("all-users"));
    } catch (err: any) {
      handleApiError(err, t("createError", "Yaratishda xatolik yuz berdi"));
      setIsLoading(false);
    }
  };

  const inputCls = (bad?: string) =>
    `w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
      bad
        ? "border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500"
        : "border-gray-200 dark:border-gray-700 focus:ring-purple-500/20 focus:border-purple-500"
    } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
            {t("investorTitle", "Investor yaratish")}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t("investorDescription", "Investor va uning boshlang'ich investitsiyasini kiriting")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Ism <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className={inputCls(errors.name)}
              placeholder={t("enterName")}
            />
          </div>
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Telefon raqam <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={formData.phone_number}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className={inputCls(errors.phone_number)}
              placeholder={t("enterPhoneNumber")}
            />
          </div>
          {errors.phone_number && (
            <p className="text-red-500 text-xs mt-1">{errors.phone_number}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Parol <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              className={`${inputCls(errors.password)} pr-10!`}
              placeholder={t("enterPassword")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
          )}
        </div>

        {/* Boshlang'ich kapital */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("initialCapital", "Boshlang'ich kapital (so'm)")}
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={formData.capital}
              onChange={(e) => handleCapitalChange(e.target.value)}
              className={inputCls()}
              placeholder="100,000,000"
            />
          </div>
        </div>

        {/* Ulush % */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("ownershipPct", "Ulush (%)")}
          </label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={formData.ownership}
              onChange={(e) => setFormData((p) => ({ ...p, ownership: e.target.value }))}
              className={inputCls(errors.ownership)}
              placeholder="5"
            />
          </div>
          {errors.ownership && (
            <p className="text-red-500 text-xs mt-1">{errors.ownership}</p>
          )}
        </div>

        {/* Boshlanish sanasi (backdating) */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("startDate", "Boshlanish sanasi")}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
            <DatePicker
              value={startDate}
              onChange={(d) => setStartDate(d)}
              format="DD-MM-YYYY"
              placeholder={t("selectDate", "Sanani tanlang")}
              className="w-full h-10 sm:h-11 pl-10! text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200! dark:border-gray-700! bg-white! dark:bg-[#312D4B]! dark:[&_.ant-picker-input>input]:text-white! dark:[&_.ant-picker-input>input]:placeholder-gray-400!"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {t("startDateHint", "O'tmish sanani kiriting — tizim o'sha kundan foydani avtomatik hisoblaydi")}
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || createInvestor.isPending}
          className="w-full h-10 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm sm:text-base font-medium flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-4 sm:mt-6"
        >
          {isLoading || createInvestor.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Yaratilmoqda...
            </>
          ) : (
            <>
              {t("create")}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default memo(CreateInvestor);
