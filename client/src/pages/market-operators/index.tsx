import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../shared/api/hooks/useRegister";
import { useApiNotification } from "../../shared/hooks/useApiNotification";
import {
  User,
  Phone,
  Lock,
  Trash2,
  Plus,
  Loader2,
  Eye,
  EyeOff,
  Users,
  ArrowRight,
  BarChart2,
  Settings2,
  Check,
} from "lucide-react";
import { Modal } from "antd";

const MarketOperators = () => {
  const navigate = useNavigate();
  const { createOperator, getMyOperators, deleteOperator, updateOperatorCommission } =
    useUser();
  const { handleApiError, handleSuccess } = useApiNotification();

  const { data, isLoading } = getMyOperators();
  const operators = data?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commissionEdits, setCommissionEdits] = useState<
    Record<string, { type: string; value: string; show: boolean }>
  >({});

  const [formData, setFormData] = useState({
    name: "",
    phone_number: "+998 ",
    password: "",
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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Ism kiritilishi shart";
    if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(formData.phone_number))
      newErrors.phone_number = "To'g'ri telefon raqam kiriting";
    if (!formData.password) newErrors.password = "Parol kiritilishi shart";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    createOperator.mutate(
      {
        name: formData.name,
        phone_number: formData.phone_number.split(" ").join(""),
        password: formData.password,
      },
      {
        onSuccess: () => {
          handleSuccess("Operator muvaffaqiyatli yaratildi");
          setFormData({ name: "", phone_number: "+998 ", password: "" });
          setShowForm(false);
          setIsSubmitting(false);
        },
        onError: (err: any) => {
          handleApiError(err, "Operator yaratishda xatolik");
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: "Operatorni o'chirish",
      content: `${name} ni o'chirmoqchimisiz?`,
      okText: "O'chirish",
      okType: "danger",
      cancelText: "Bekor qilish",
      onOk: () => {
        deleteOperator.mutate(id, {
          onSuccess: () => handleSuccess("Operator o'chirildi"),
          onError: (err: any) => handleApiError(err, "Xatolik"),
        });
      },
    });
  };

  const toggleExpand = (op: any) => {
    const id = op.id;
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!commissionEdits[id]) {
        setCommissionEdits((prev) => ({
          ...prev,
          [id]: {
            type: op.commission_type ?? "percent",
            value: op.commission_value?.toString() ?? "",
            show: op.show_earnings ?? false,
          },
        }));
      }
    }
  };

  const saveCommission = (id: string) => {
    const edit = commissionEdits[id];
    if (!edit) return;
    const payload: any = {
      show_earnings: edit.show,
    };
    if (edit.value && Number(edit.value) > 0) {
      payload.commission_type = edit.type;
      payload.commission_value = Number(edit.value);
    } else {
      payload.commission_type = null;
      payload.commission_value = null;
    }
    updateOperatorCommission.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          handleSuccess("Komissiya yangilandi");
          setExpandedId(null);
        },
        onError: (err: any) => handleApiError(err, "Xatolik"),
      }
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              Operatorlar
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Marketingiz operatorlarini boshqaring
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Yangi operator
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-4">
            Yangi operator yaratish
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
                  className={`w-full h-10 pl-10 pr-4 text-sm rounded-xl border ${
                    errors.name
                      ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
                      : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
                  } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
                  placeholder="Operator ismi"
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Telefon raqam <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.phone_number}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className={`w-full h-10 pl-10 pr-4 text-sm rounded-xl border ${
                    errors.phone_number
                      ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
                      : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
                  } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
                  placeholder="+998 XX XXX XX XX"
                />
              </div>
              {errors.phone_number && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.phone_number}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Parol <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className={`w-full h-10 pl-10 pr-10 text-sm rounded-xl border ${
                    errors.password
                      ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
                      : "border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500"
                  } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
                  placeholder="Parol"
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

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmitting || createOperator.isPending}
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting || createOperator.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Yaratish
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Operators List */}
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : operators.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Users className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Hech qanday operator yo'q</p>
            <p className="text-xs mt-1">Yangi operator yarating</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {operators.map((op: any) => {
              const isOpen = expandedId === op.id;
              const edit = commissionEdits[op.id] ?? {
                type: op.commission_type ?? "percent",
                value: op.commission_value?.toString() ?? "",
                show: op.show_earnings ?? false,
              };

              return (
                <div key={op.id}>
                  {/* Operator Row */}
                  <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#312D4B] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">
                          {op.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {op.phone_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Commission badge */}
                      {op.commission_type && op.commission_value > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                          {op.commission_type === "percent"
                            ? `${op.commission_value}%`
                            : `${Number(op.commission_value).toLocaleString()} so'm`}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          op.status === "active"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {op.status === "active" ? "Faol" : "Nofaol"}
                      </span>
                      <button
                        onClick={() => toggleExpand(op)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          isOpen
                            ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600"
                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        title="Komissiya sozlamalari"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/market-operators/${op.id}/stats`)
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 transition-colors cursor-pointer"
                        title="Statistika"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(op.id, op.name)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Commission Settings Panel */}
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 bg-indigo-50/50 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-800/30">
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
                        <Settings2 className="w-3.5 h-3.5" />
                        Komissiya sozlamalari
                      </p>

                      <div className="flex flex-col sm:flex-row gap-3 mb-3">
                        {/* Commission Type */}
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setCommissionEdits((prev) => ({
                                ...prev,
                                [op.id]: { ...edit, type: "percent" },
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              edit.type === "percent"
                                ? "bg-indigo-600 text-white shadow"
                                : "bg-white dark:bg-[#312D4B] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                            }`}
                          >
                            % Foiz
                          </button>
                          <button
                            onClick={() =>
                              setCommissionEdits((prev) => ({
                                ...prev,
                                [op.id]: { ...edit, type: "fixed" },
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              edit.type === "fixed"
                                ? "bg-indigo-600 text-white shadow"
                                : "bg-white dark:bg-[#312D4B] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                            }`}
                          >
                            Aniq summa
                          </button>
                        </div>

                        {/* Commission Value */}
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="number"
                            min="0"
                            value={edit.value}
                            onChange={(e) =>
                              setCommissionEdits((prev) => ({
                                ...prev,
                                [op.id]: {
                                  ...edit,
                                  value: e.target.value,
                                },
                              }))
                            }
                            placeholder={
                              edit.type === "percent"
                                ? "Masalan: 5 (5%)"
                                : "Masalan: 10000 (so'm)"
                            }
                            className="w-full h-9 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Show earnings toggle */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Operatorga daromadini ko'rsatish
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Yoqilsa operator o'z balansi va to'lovlarini ko'ra oladi
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setCommissionEdits((prev) => ({
                              ...prev,
                              [op.id]: { ...edit, show: !edit.show },
                            }))
                          }
                          className={`w-11 h-6 rounded-full transition-all cursor-pointer relative ${
                            edit.show
                              ? "bg-indigo-600"
                              : "bg-gray-200 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              edit.show ? "left-5.5 translate-x-0.5" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setExpandedId(null);
                          }}
                          className="flex-1 h-8 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
                        >
                          Bekor
                        </button>
                        <button
                          onClick={() => saveCommission(op.id)}
                          disabled={updateOperatorCommission.isPending}
                          className="flex-1 h-8 rounded-xl bg-indigo-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {updateOperatorCommission.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              Saqlash
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(MarketOperators);
