import { memo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { buildAdminPath } from "../../../../shared/const";
import {
  User,
  Phone,
  Lock,
  Home,
  Building2,
  ArrowRight,
  Loader2,
  Store,
  Eye,
  EyeOff,
  ChevronDown,
  Truck,
} from "lucide-react";

const CreateMarket = () => {
  const { t } = useTranslation("users");
  const { createUser } = useUser("market");
  const navigate = useNavigate();
  const { handleApiError, handleSuccess } = useApiNotification();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deliveryDropdownOpen, setDeliveryDropdownOpen] = useState(false);
  const deliveryDropdownRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "+998 ",
    password: "",
    tariff_home: "",
    tariff_center: "",
    default_tariff: "center",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const deliveryOptions = [
    { value: "center", label: "Markazgacha" },
    { value: "address", label: "Manzilgacha" },
  ];

  const selectedDelivery = deliveryOptions.find(
    (d) => d.value === formData.default_tariff
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        deliveryDropdownRef.current &&
        !deliveryDropdownRef.current.contains(event.target as Node)
      ) {
        setDeliveryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleTariffChange = (field: string, value: string) => {
    const onlyNums = value.replace(/\D/g, "");
    const formatted = onlyNums.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setFormData((prev) => ({ ...prev, [field]: formatted }));
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

    if (!formData.tariff_home) {
      newErrors.tariff_home = t("enterHomeTariff");
    }

    if (!formData.tariff_center) {
      newErrors.tariff_center = t("enterCenterTariff");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    const newMarket = {
      name: formData.name,
      phone_number: formData.phone_number.split(" ").join(""),
      password: formData.password,
      tariff_home: Number(formData.tariff_home.replace(/,/g, "")),
      tariff_center: Number(formData.tariff_center.replace(/,/g, "")),
      default_tariff: formData.default_tariff,
    };

    createUser.mutate(newMarket, {
      onSuccess: () => {
        handleSuccess("Market muvaffaqiyatli yaratildi");
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
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
            {t("marketTitle")}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {t("marketDescription")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Market nomi <span className="text-red-500">*</span>
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
                  ? "border-red-300 dark:border-red-700"
                  : "border-gray-200 dark:border-gray-700 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                  ? "border-red-300 dark:border-red-700"
                  : "border-gray-200 dark:border-gray-700 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                  ? "border-red-300 dark:border-red-700"
                  : "border-gray-200 dark:border-gray-700 focus:ring-emerald-500/20 focus:border-emerald-500"
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

        {/* Tariffs */}
        <div className="grid grid-cols-2 gap-3">
          {/* Home Tariff */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Uyga <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.tariff_home}
                onChange={(e) =>
                  handleTariffChange("tariff_home", e.target.value)
                }
                className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                  errors.tariff_home
                    ? "border-red-300 dark:border-red-700"
                    : "border-gray-200 dark:border-gray-700 focus:ring-emerald-500/20 focus:border-emerald-500"
                } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
                placeholder={t("enterHomeTariff")}
              />
            </div>
            {errors.tariff_home && (
              <p className="text-red-500 text-xs mt-1">{errors.tariff_home}</p>
            )}
          </div>

          {/* Center Tariff */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Markazga <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.tariff_center}
                onChange={(e) =>
                  handleTariffChange("tariff_center", e.target.value)
                }
                className={`w-full h-10 sm:h-11 pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                  errors.tariff_center
                    ? "border-red-300 dark:border-red-700"
                    : "border-gray-200 dark:border-gray-700 focus:ring-emerald-500/20 focus:border-emerald-500"
                } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
                placeholder={t("enterCenterTariff")}
              />
            </div>
            {errors.tariff_center && (
              <p className="text-red-500 text-xs mt-1">
                {errors.tariff_center}
              </p>
            )}
          </div>
        </div>

        {/* Default Delivery */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Yetkazib berish turi
          </label>
          <div className="relative" ref={deliveryDropdownRef}>
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
            <button
              type="button"
              onClick={() => setDeliveryDropdownOpen(!deliveryDropdownOpen)}
              className="w-full h-10 sm:h-11 pl-10 pr-10 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-left flex items-center justify-between cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
            >
              <span className="text-gray-800 dark:text-white">
                {selectedDelivery?.label}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${deliveryDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {deliveryDropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#312D4B] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                {deliveryOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        default_tariff: option.value,
                      }));
                      setDeliveryDropdownOpen(false);
                    }}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                      formData.default_tariff === option.value
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || createUser.isPending}
          className="w-full h-10 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm sm:text-base font-medium flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-4 sm:mt-6"
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

export default memo(CreateMarket);
