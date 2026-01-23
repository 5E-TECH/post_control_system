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
  DollarSign,
  Calendar,
  ArrowRight,
  Loader2,
  ClipboardList,
  Eye,
  EyeOff,
} from "lucide-react";

const CreateRegistrator = () => {
  const { t } = useTranslation("users");
  const { createUser } = useUser("registrator");
  const navigate = useNavigate();
  const { handleApiError, handleSuccess } = useApiNotification();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "+998 ",
    password: "",
    salary: "",
    payment_day: "",
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

  const handleSalaryChange = (value: string) => {
    const onlyNums = value.replace(/\D/g, "");
    const formatted = onlyNums.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setFormData((prev) => ({ ...prev, salary: formatted }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("enterName");
    }

    if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(formData.phone_number)) {
      newErrors.phone_number = t("phoneNumberPattern");
    }

    if (!formData.password) {
      newErrors.password = t("enterPassword");
    }

    if (!formData.salary) {
      newErrors.salary = t("enterSalary");
    }

    if (formData.payment_day) {
      const day = Number(formData.payment_day);
      if (day < 1 || day > 31) {
        newErrors.payment_day = t("paymentDayRange");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    const newRegistrator = {
      name: formData.name,
      phone_number: formData.phone_number.split(" ").join(""),
      password: formData.password,
      salary: Number(formData.salary.replace(/,/g, "")),
      payment_day: formData.payment_day ? Number(formData.payment_day) : undefined,
    };

    createUser.mutate(newRegistrator, {
      onSuccess: () => {
        handleSuccess("Registrator muvaffaqiyatli yaratildi");
        navigate(buildAdminPath("all-users"));
      },
      onError: (err: any) => {
        handleApiError(err, "Foydalanuvchi yaratishda xatolik yuz berdi");
        setIsLoading(false);
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
            {t("registratorTitle")}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t("registratorDescription")}
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                errors.name
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
              } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
              placeholder={t("enterName")}
            />
          </div>
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
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
              className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                errors.phone_number
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
              } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              className={`w-full h-10 sm:h-11 pl-10 pr-10 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                errors.password
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
              } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
              placeholder={t("enterPassword")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
          )}
        </div>

        {/* Salary */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Maosh <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={formData.salary}
              onChange={(e) => handleSalaryChange(e.target.value)}
              className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                errors.salary
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
              } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
              placeholder={t("enterSalary")}
            />
          </div>
          {errors.salary && (
            <p className="text-red-500 text-xs mt-1">{errors.salary}</p>
          )}
        </div>

        {/* Payment Day */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            To'lov kuni (1-31)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              min="1"
              max="31"
              value={formData.payment_day}
              onChange={(e) => {
                let val = e.target.value;
                if (Number(val) > 31) val = "31";
                setFormData((prev) => ({ ...prev, payment_day: val }));
              }}
              className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                errors.payment_day
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
              } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
              placeholder={t("enterPaymentDay")}
            />
          </div>
          {errors.payment_day && (
            <p className="text-red-500 text-xs mt-1">{errors.payment_day}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || createUser.isPending}
          className="w-full h-10 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-sm sm:text-base font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-4 sm:mt-6"
        >
          {isLoading || createUser.isPending ? (
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

export default memo(CreateRegistrator);
