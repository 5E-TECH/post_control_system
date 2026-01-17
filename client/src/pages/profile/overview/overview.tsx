import { memo, useState, useMemo } from "react";
import { Spin, message } from "antd";
import { useProfile } from "../../../shared/api/hooks/useProfile";
import EditProfileModal from "../ui/Popap";
import { setEditing } from "../../../shared/lib/features/profile/profileEditSlice";
import { useDispatch } from "react-redux";
import {
  User,
  Phone,
  MapPin,
  Shield,
  Briefcase,
  Home,
  Edit3,
  Wallet,
} from "lucide-react";
import { AvatarDisplay } from "../../../shared/components/AvatarSelector";
import AvatarSelectorModal from "../../../shared/components/AvatarSelector";

const Overview = () => {
  const dispatch = useDispatch();
  const { getUser, updateAvatar } = useProfile();
  const { data, isLoading, refetch } = getUser();
  const [open, setOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  // Maosh progress hisoblash
  const salaryProgress = useMemo(() => {
    if (!data?.data?.salary) return null;

    const salary = data.data.salary;
    const today = new Date();
    const currentDay = today.getDate();
    const paymentDay = salary.payment_day || 30;

    // Oyning necha kuni borligini aniqlash
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();

    // Progress foizini hisoblash
    let progress: number;
    let daysRemaining: number;

    if (currentDay <= paymentDay) {
      progress = (currentDay / paymentDay) * 100;
      daysRemaining = paymentDay - currentDay;
    } else {
      // Agar to'lov kuni o'tgan bo'lsa, keyingi oyga
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
                  editable
                  onClick={() => setAvatarModalOpen(true)}
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
                  onClick={() => {
                    setOpen(true);
                    dispatch(
                      setEditing({
                        phone_number: user?.phone_number,
                      })
                    );
                  }}
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

      {user && (
        <EditProfileModal
          open={open}
          onClose={() => setOpen(false)}
          user={user}
          refetch={refetch}
        />
      )}

      <AvatarSelectorModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        currentAvatarId={user?.avatar_id}
        onSelect={async (avatarId) => {
          try {
            await updateAvatar.mutateAsync(avatarId);
            message.success("Avatar muvaffaqiyatli o'zgartirildi!");
            setAvatarModalOpen(false);
          } catch {
            message.error("Xatolik yuz berdi!");
          }
        }}
        loading={updateAvatar.isPending}
      />
    </div>
  );
};

export default memo(Overview);
