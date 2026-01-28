import { memo, useState, useMemo } from "react";
import { Spin, Modal, Form, Input, Button, InputNumber, Switch, Select } from "antd";
import { useDispatch } from "react-redux";
import { AvatarDisplay } from "../../../../shared/components/AvatarSelector";
import { setEditing } from "../../../../shared/lib/features/profile/profileEditSlice";
import { useParams } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import {
  Check,
  Copy,
  User,
  Phone,
  MapPin,
  Shield,
  Briefcase,
  Home,
  Edit3,
  Key,
  ToggleLeft,
  Wallet,
  Lock,
  Truck,
} from "lucide-react";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";

const UserProfile = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { getUserById, updateUser } = useUser();
  const { data, isLoading, refetch } = getUserById(id);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form] = Form.useForm();

  // Local state to control formatted phone input display
  const [phoneDisplay, setPhoneDisplay] = useState<string>("+998 ");

  // Maosh progress hisoblash
  const salaryProgress = useMemo(() => {
    if (!data?.data?.salary) return null;

    const salary = data.data.salary;
    const today = new Date();
    const currentDay = today.getDate();
    const paymentDay = salary.payment_day || 30;

    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();

    let progress: number;
    let daysRemaining: number;

    if (currentDay <= paymentDay) {
      progress = (currentDay / paymentDay) * 100;
      daysRemaining = paymentDay - currentDay;
    } else {
      const daysUntilEndOfMonth = daysInMonth - currentDay;
      const totalDays = daysUntilEndOfMonth + paymentDay;
      progress = 100;
      daysRemaining = totalDays;
    }

    return {
      progress: Math.min(progress, 100),
      daysRemaining,
      paymentDay,
      currentDay,
    };
  }, [data?.data?.salary]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spin size="large" tip="Loading profile..." />
      </div>
    );
  }

  const user = data?.data;

  // helper: remove all non-digits and keep leading + if present
  const normalizePhone = (phone?: string | null) => {
    if (!phone) return "";
    // remove non-digits
    const digits = phone.replace(/\D/g, "");
    // If already contains country code 998 at start, ensure prefix +998
    if (digits.startsWith("998")) {
      return `+${digits.slice(0, 3)}${digits.slice(3) ? digits.slice(3) : ""}`; // +998...
    }
    // If user input like 90..., assume it's local mobile number (9 digits)
    if (digits.length === 9) {
      return `+998${digits}`;
    }
    // Fallback: if shorter/longer, try to return with + and digits
    return `+${digits}`;
  };

  // helper: format display as "+998 XX XXX XX XX"
  const formatPhoneForDisplay = (raw?: string | null) => {
    // Get only digits
    let digits = (raw || "").replace(/\D/g, "");

    // If digits start with 998, strip it for grouping
    if (digits.startsWith("998")) {
      digits = digits.slice(3);
    }

    // If user pasted full like +998990000000, above removed 998 -> left 990000000 (9 digits)
    // Ensure we only take up to 9 digits for formatting
    digits = digits.slice(0, 9);

    const parts: string[] = [];
    if (digits.length >= 2) {
      parts.push(digits.slice(0, 2)); // XX
    } else if (digits.length > 0) {
      parts.push(digits);
    }

    if (digits.length > 2) {
      const rest = digits.slice(2); // remaining 7
      // next 3
      if (rest.length >= 3) {
        parts.push(rest.slice(0, 3)); // XXX
        if (rest.length > 3) {
          const rest2 = rest.slice(3);
          if (rest2.length >= 2) {
            parts.push(rest2.slice(0, 2)); // XX
            if (rest2.length > 2) {
              parts.push(rest2.slice(2, 4)); // XX (maybe 0-2 digits)
            }
          } else {
            parts.push(rest2);
          }
        }
      } else {
        parts.push(rest);
      }
    }

    // Join into "+998 " + groups separated by space
    const grouped = parts.join(" ");
    return grouped ? `+998 ${grouped}` : "+998 ";
  };

  // When opening modal, prefill phone formatted and keep in local state
  const handleOpenModal = () => {
    form.setFieldsValue({
      name: user.name,
      phone_number: formatPhoneForDisplay(user.phone_number || "+998"),
      password: "",
      ...(user.role === "market" || user.role === "courier"
        ? {
            tariff_center: Number(user.tariff_center) || 0,
            tariff_home: Number(user.tariff_home) || 0,
          }
        : {}),
      ...(user.role === "market"
        ? {
            default_tariff: user.default_tariff || "center",
          }
        : {}),
    });

    // set phoneDisplay state too
    setPhoneDisplay(formatPhoneForDisplay(user.phone_number || "+998"));

    setOpen(true);
    dispatch(
      setEditing({
        phone_number: user?.phone_number,
      })
    );
  };

  // Input change handler to keep formatted appearance while storing formatted value in form
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Normalize input as user types: allow deleting/backspace; format accordingly
    const formatted = formatPhoneForDisplay(raw);
    setPhoneDisplay(formatted);
    // Update form field to keep consistency
    form.setFieldsValue({ phone_number: formatted });
  };

  const handleUpdate = (values: any) => {
    const payload: any = { ...values };

    // Normalize phone for backend: +998990000000
    if (payload.phone_number) {
      const normalized = normalizePhone(payload.phone_number);
      // If normalized is just "+", treat as empty
      if (normalized === "+") {
        delete payload.phone_number;
      } else {
        payload.phone_number = normalized;
      }
    }

    // Normalize user.phone_number for comparison
    const userPhoneNormalized = normalizePhone(user?.phone_number);

    // Compare normalized values to avoid unnecessary update
    if (payload.name === user.name) delete payload.name;
    if (payload.phone_number === userPhoneNormalized)
      delete payload.phone_number;
    if (!payload.password) delete payload.password;
    if (payload.default_tariff === user.default_tariff)
      delete payload.default_tariff;

    if (Object.keys(payload).length === 0) {
      setOpen(false);
      return;
    }

    updateUser.mutate(
      {
        role: user.role,
        id: user.id,
        data: payload,
      },
      {
        onSuccess: () => {
          refetch().then(() => {
            form.resetFields(); // Formni yangilangan ma'lumot bilan tozalash
            setOpen(false);
          });
        },
      }
    );
  };

  const { handleSuccess, handleApiError } = useApiNotification();

  const onChangeChecked = (checked: boolean, user: any) => {
    const id = user?.id;
    const role = user?.role;
    const add_order = checked;

    updateUser.mutate(
      { role, id, data: { add_order } },
      {
        onSuccess: () =>
          handleSuccess(`Foydalanuvchini holati muvaffaqiyatli yangilandi`),
        onError: (err) =>
          handleApiError(err, `Foydalanuvchini holatini yangilashda xatolik`),
      }
    );
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      superadmin: "from-red-500 to-pink-500",
      admin: "from-blue-500 to-cyan-500",
      market: "from-green-500 to-emerald-500",
      courier: "from-orange-500 to-amber-500",
    };
    return colors[role] || "from-purple-500 to-indigo-500";
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      superadmin: "bg-red-500/10 text-red-500 border-red-500/20",
      admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      market: "bg-green-500/10 text-green-500 border-green-500/20",
      courier: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    };
    return colors[role] || "bg-purple-500/10 text-purple-500 border-purple-500/20";
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Profile Header Card */}
        <div className="relative bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-xl overflow-hidden mb-6">
          {/* Gradient Banner */}
          <div
            className={`h-32 md:h-40 bg-gradient-to-r ${getRoleColor(
              user?.role
            )} relative`}
          >
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white dark:from-[#1e1e2d] to-transparent"></div>
          </div>

          {/* Profile Content */}
          <div className="relative px-6 pb-6">
            {/* Avatar */}
            <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16 md:-mt-20">
              <div className="relative">
                <AvatarDisplay
                  avatarId={user?.avatar_id}
                  role={user?.role}
                  size="lg"
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-white dark:border-[#1e1e2d] ${
                    user?.status === "active" ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
              </div>

              {/* Name & Status */}
              <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-2 md:mt-0 md:pb-2">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
                    {user?.name}
                  </h1>
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full border ${getRoleBadgeColor(
                        user?.role
                      )}`}
                    >
                      {user?.role?.toUpperCase()}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        user?.status === "active"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {user?.status === "active" ? "Faol" : "Faol emas"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleOpenModal}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8C57FF] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105"
                >
                  <Edit3 size={18} />
                  Tahrirlash
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {user?.name && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    To'liq ism
                  </p>
                  <p className="text-base font-semibold text-gray-800 dark:text-white mt-0.5">
                    {user.name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {user?.phone_number && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Phone className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    Telefon raqam
                  </p>
                  <p className="text-base font-semibold text-gray-800 dark:text-white mt-0.5">
                    {user.phone_number}
                  </p>
                </div>
              </div>
            </div>
          )}

          {user?.region_id && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MapPin className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    Hudud
                  </p>
                  <p className="text-base font-semibold text-gray-800 dark:text-white mt-0.5">
                    {user?.region?.name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {user?.role && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    Rol
                  </p>
                  <p className="text-base font-semibold text-gray-800 dark:text-white mt-0.5 capitalize">
                    {user.role}
                  </p>
                </div>
              </div>
            </div>
          )}

          {user?.tariff_center && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Briefcase className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    Tarif (Markaz)
                  </p>
                  <p className="text-base font-semibold text-gray-800 dark:text-white mt-0.5">
                    {user.tariff_center?.toLocaleString()} so'm
                  </p>
                </div>
              </div>
            </div>
          )}

          {user?.tariff_home && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Home className="w-6 h-6 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    Tarif (Uy)
                  </p>
                  <p className="text-base font-semibold text-gray-800 dark:text-white mt-0.5">
                    {user.tariff_home?.toLocaleString()} so'm
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Default Delivery Type - Only for Market */}
          {user?.role === "market" && user?.default_tariff && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Truck className="w-6 h-6 text-teal-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    Yetkazib berish turi
                  </p>
                  <p className="text-base font-semibold text-gray-800 dark:text-white mt-0.5">
                    {user.default_tariff === "center" ? "Markazgacha" : "Manzilgacha"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TG Token Card */}
          {user?.market_tg_token && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800 md:col-span-2 lg:col-span-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                    <Key className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                      Telegram Token
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white mt-0.5 font-mono truncate">
                      {user.market_tg_token}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user.market_tg_token);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 flex-shrink-0 ${
                    copied
                      ? "bg-green-500/10 text-green-600"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                  <span className="text-xs sm:text-sm font-medium">
                    {copied ? "Nusxalandi!" : "Nusxalash"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Add Order Switch - Only for Market */}
          {user?.role === "market" && (
            <div className="group bg-white dark:bg-[#1e1e2d] rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ToggleLeft className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                      Mahsulot qo'shish
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {user.add_order ? "Ruxsat berilgan" : "Ruxsat berilmagan"}
                    </p>
                  </div>
                </div>
                <Switch
                  className={`${
                    user?.add_order ? "bg-green-600!" : "bg-[#F76659]!"
                  }`}
                  checked={user?.add_order}
                  onChange={(checked, event) => {
                    event.stopPropagation();
                    onChangeChecked(checked, user);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Salary Card - faqat salary mavjud bo'lganda ko'rsatish */}
        {user?.salary && salaryProgress && (
          <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#8C57FF] to-[#6366F1] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-block px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                    Oylik maosh
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
                    {user.salary.salary_amount?.toLocaleString()}{" "}
                    <span className="text-lg font-normal opacity-80">so'm</span>
                  </h2>
                  {user.salary.have_to_pay > 0 && (
                    <p className="text-white/70 text-sm mt-1">
                      To'lanishi kerak: {user.salary.have_to_pay?.toLocaleString()} so'm
                    </p>
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl backdrop-blur-sm flex items-center justify-center">
                    <Wallet className="w-10 h-10 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  <span>To'lov kunigacha</span>
                  <span className="text-purple-600 dark:text-purple-400">
                    {salaryProgress.currentDay} / {salaryProgress.paymentDay} kun
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8C57FF] to-[#6366F1] rounded-full transition-all duration-500"
                    style={{ width: `${salaryProgress.progress}%` }}
                  ></div>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                  {salaryProgress.daysRemaining} kun qoldi
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {user && (
        <Modal
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          centered
          width={440}
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#8C57FF] to-[#6366F1] flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white m-0">
                  Profilni tahrirlash
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
                  Foydalanuvchi ma'lumotlarini yangilang
                </p>
              </div>
            </div>
          }
        >
          <Form form={form} layout="vertical" onFinish={handleUpdate} className="mt-6">
            <Form.Item
              label={
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                  <User className="w-4 h-4" />
                  Ism
                </span>
              }
              name="name"
              className="mb-4"
            >
              <Input
                placeholder="Ismini kiriting"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              label={
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                  <Phone className="w-4 h-4" />
                  Telefon raqam
                </span>
              }
              name="phone_number"
              className="mb-4"
            >
              <Input
                value={phoneDisplay}
                onChange={handlePhoneInputChange}
                maxLength={20}
                placeholder="+998 99 000 00 00"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>

            {(user.role === "market" || user.role === "courier") && (
              <>
                <Form.Item
                  label={
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Briefcase className="w-4 h-4" />
                      Tarif (Markaz)
                    </span>
                  }
                  name="tariff_center"
                  className="mb-4"
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    size="large"
                    className="rounded-lg"
                    formatter={(value) =>
                      `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Home className="w-4 h-4" />
                      Tarif (Uy)
                    </span>
                  }
                  name="tariff_home"
                  className="mb-4"
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    size="large"
                    className="rounded-lg"
                    formatter={(value) =>
                      `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                  />
                </Form.Item>
              </>
            )}

            {user.role === "market" && (
              <Form.Item
                label={
                  <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                    <Truck className="w-4 h-4" />
                    Yetkazib berish turi
                  </span>
                }
                name="default_tariff"
                className="mb-4"
              >
                <Select
                  size="large"
                  className="w-full"
                  options={[
                    { value: "center", label: "Markazgacha" },
                    { value: "address", label: "Manzilgacha" },
                  ]}
                />
              </Form.Item>
            )}

            <Form.Item
              label={
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                  <Lock className="w-4 h-4" />
                  Yangi parol
                </span>
              }
              name="password"
              className="mb-6"
            >
              <Input.Password
                placeholder="Yangi parol kiriting"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>

            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button
                onClick={() => setOpen(false)}
                size="large"
                className="flex-1 rounded-lg font-medium"
              >
                Bekor qilish
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={updateUser.isPending}
                className="flex-1 rounded-lg font-medium bg-[#8C57FF] hover:bg-[#7C3AED]!"
              >
                Saqlash
              </Button>
            </div>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default memo(UserProfile);
