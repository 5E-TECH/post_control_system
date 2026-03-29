import { memo, useState } from "react";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { buildAdminPath } from "../../../../shared/const";
import {
  User,
  Phone,
  Lock,
  Percent,
  Landmark,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Coins,
  Scale,
} from "lucide-react";

const CreateInvestor = () => {
  const { t } = useTranslation("users");
  const { createInvestor } = useUser();
  const navigate = useNavigate();
  const { handleApiError, handleSuccess } = useApiNotification();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "+998 ",
    password: "",
    committed_amount: "",
    share_percent: "",
    initial_balance: "",
  });
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

  const handleAmountChange = (value: string) => {
    const onlyNums = value.replace(/\D/g, "");
    const formatted = onlyNums.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setFormData((prev) => ({ ...prev, committed_amount: formatted }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = t("enterName");
    if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(formData.phone_number))
      newErrors.phone_number = t("phoneNumberPattern");
    if (!formData.password) newErrors.password = t("enterPassword");
    if (!isPartner && !formData.committed_amount)
      newErrors.committed_amount = "Investitsiya summasini kiriting";
    if (!formData.share_percent || Number(formData.share_percent) <= 0 || Number(formData.share_percent) > 100)
      newErrors.share_percent = "Foiz 0.01 dan 100 gacha bo'lishi kerak";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    const initialBal = formData.initial_balance
      ? Number(formData.initial_balance.replace(/,/g, "").replace(/\s/g, ""))
      : undefined;

    const payload: any = {
      name: formData.name,
      phone_number: formData.phone_number.split(" ").join(""),
      password: formData.password,
      committed_amount: isPartner ? 0 : Number(formData.committed_amount.replace(/,/g, "")),
      share_percent: Number(formData.share_percent),
    };
    if (initialBal) payload.initial_balance = initialBal;

    createInvestor.mutate(payload, {
      onSuccess: () => {
        handleSuccess("Investor muvaffaqiyatli yaratildi");
        navigate(buildAdminPath("investors"));
      },
      onError: (err: any) => {
        handleApiError(err, "Investor yaratishda xatolik");
        setIsLoading(false);
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
            Yangi investor yaratish
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Investor ma'lumotlarini kiriting
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
              className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${errors.name ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-700 focus:border-rose-500"} bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all`}
              placeholder="Investor ismi"
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
              className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${errors.phone_number ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-700 focus:border-rose-500"} bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all`}
              placeholder="+998 90 123 45 67"
            />
          </div>
          {errors.phone_number && <p className="text-red-500 text-xs mt-1">{errors.phone_number}</p>}
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
              className={`w-full h-10 sm:h-11 pl-10 pr-10 text-sm sm:text-base rounded-lg sm:rounded-xl border ${errors.password ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-700 focus:border-rose-500"} bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all`}
              placeholder="Parol"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
        </div>

        {/* Partner toggle */}
        <div
          onClick={() => setIsPartner(!isPartner)}
          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isPartner ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${isPartner ? "bg-blue-500 border-blue-500" : "border-gray-300 dark:border-gray-600"}`}>
            {isPartner && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-white">Sherik (pul tikmasdan)</p>
            <p className="text-xs text-gray-500">Investitsiya summasi 0 bo'ladi</p>
          </div>
        </div>

        {/* Committed amount */}
        {!isPartner && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Investitsiya summasi <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.committed_amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${errors.committed_amount ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-700 focus:border-rose-500"} bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all`}
                placeholder="100,000,000"
              />
            </div>
            {errors.committed_amount && <p className="text-red-500 text-xs mt-1">{errors.committed_amount}</p>}
          </div>
        )}

        {/* Share percent */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Foiz ulushi (%) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              step="any"
              min="0.01"
              max="100"
              value={formData.share_percent}
              onChange={(e) => setFormData((p) => ({ ...p, share_percent: e.target.value }))}
              className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${errors.share_percent ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-700 focus:border-rose-500"} bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all`}
              placeholder="20"
            />
          </div>
          {errors.share_percent && <p className="text-red-500 text-xs mt-1">{errors.share_percent}</p>}
        </div>

        {/* Boshlang'ich balans (ixtiyoriy) */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Boshlang'ich balans (ixtiyoriy)
          </label>
          <div className="relative">
            <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={formData.initial_balance}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d-]/g, "");
                setFormData((p) => ({ ...p, initial_balance: raw }));
              }}
              className="w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 focus:border-rose-500 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
              placeholder="Masalan: -500000 (qarz) yoki 100000 (foyda)"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Manfiy = oldingi qarz (ko'p to'langan). Musbat = ajratilmagan foyda. Bo'sh = 0.
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
