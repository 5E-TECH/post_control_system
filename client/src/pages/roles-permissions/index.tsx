import React from "react";
import {
  ShieldCheck,
  Crown,
  UserCog,
  ClipboardList,
  Headphones,
  Truck,
  Store,
  Headset,
  Construction,
} from "lucide-react";

interface RoleInfo {
  key: string;
  label: string;
  icon: typeof Crown;
  desc: string;
  accent: string;
}

const ROLES: RoleInfo[] = [
  {
    key: "superadmin",
    label: "Superadmin",
    icon: Crown,
    desc: "To'liq nazorat — barcha sozlamalar, rollar va tizim boshqaruvi.",
    accent: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "admin",
    label: "Admin",
    icon: UserCog,
    desc: "Kunlik boshqaruv — buyurtma, to'lov, foydalanuvchilar (cheklangan sozlamalar).",
    accent: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  {
    key: "registrator",
    label: "Registrator",
    icon: ClipboardList,
    desc: "Buyurtma va pochtalarni ro'yxatga olish, qabul qilish.",
    accent: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    key: "logist",
    label: "Logist",
    icon: Headphones,
    desc: "O'z viloyati logistikasi va kuryerlarini muvofiqlashtirish.",
    accent: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  {
    key: "courier",
    label: "Kuryer",
    icon: Truck,
    desc: "Pochtalarni qabul qilish va buyurtmalarni yetkazib berish.",
    accent: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    key: "market",
    label: "Market",
    icon: Store,
    desc: "Do'kon — buyurtma yaratish, kassa va operatorlarini boshqarish.",
    accent: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    key: "operator",
    label: "Operator",
    icon: Headset,
    desc: "Market operatori — buyurtmalarni qabul qilish va kiritish.",
    accent: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
  },
];

const RolesPermissions = () => {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            Rollar va ruxsatlar
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tizim rollari va ularning vakolatlari
          </p>
        </div>
      </div>

      {/* Coming soon banner */}
      <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40">
        <Construction className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Ruxsatlarni tahrirlash tez orada
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
            Hozircha rollar quyida ko'rsatilgan. Kelajakda har bir rol uchun
            ruxsatlarni shu yerda sozlash mumkin bo'ladi.
          </p>
        </div>
      </div>

      {/* Roles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <div
              key={role.key}
              className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-[#2A263D] hover:shadow-sm transition-shadow"
            >
              <span
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${role.accent}`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-gray-800 dark:text-white">
                  {role.label}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {role.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(RolesPermissions);
