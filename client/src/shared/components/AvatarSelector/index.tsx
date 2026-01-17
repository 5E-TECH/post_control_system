import { memo, useState } from "react";
import { Modal } from "antd";
import {
  User,
  ShieldCheck,
  Store,
  Truck,
  UserCircle,
  Users,
  Crown,
  Briefcase,
  Building2,
  Package,
  HeadphonesIcon,
  Bot,
  Check,
} from "lucide-react";

// Avatar variantlari - har biri unikal ID va icon bilan
export const avatarVariants = [
  { id: "user-1", icon: User, bg: "from-blue-500 to-cyan-500" },
  { id: "user-2", icon: UserCircle, bg: "from-purple-500 to-indigo-500" },
  { id: "user-3", icon: Users, bg: "from-green-500 to-emerald-500" },
  { id: "crown", icon: Crown, bg: "from-amber-500 to-orange-500" },
  { id: "briefcase", icon: Briefcase, bg: "from-slate-600 to-slate-800" },
  { id: "building", icon: Building2, bg: "from-teal-500 to-cyan-600" },
  { id: "package", icon: Package, bg: "from-rose-500 to-pink-500" },
  { id: "headphones", icon: HeadphonesIcon, bg: "from-violet-500 to-purple-600" },
  { id: "bot", icon: Bot, bg: "from-sky-500 to-blue-600" },
  { id: "shield", icon: ShieldCheck, bg: "from-red-500 to-rose-600" },
  { id: "store", icon: Store, bg: "from-emerald-500 to-green-600" },
  { id: "truck", icon: Truck, bg: "from-orange-500 to-amber-600" },
];

// Rolga qarab default avatar
export const getDefaultAvatarByRole = (role: string): string => {
  const defaults: Record<string, string> = {
    superadmin: "shield",
    admin: "crown",
    market: "store",
    courier: "truck",
    operator: "headphones",
    customer: "user-1",
  };
  return defaults[role] || "user-1";
};

// Avatar ID bo'yicha avatar ma'lumotlarini olish
export const getAvatarById = (id: string) => {
  return avatarVariants.find((a) => a.id === id) || avatarVariants[0];
};

interface AvatarDisplayProps {
  avatarId?: string | null;
  role?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  editable?: boolean;
}

// Avatar ko'rsatish komponenti
export const AvatarDisplay = memo(
  ({ avatarId, role = "user", size = "lg", onClick, editable = false }: AvatarDisplayProps) => {
    const finalAvatarId = avatarId || getDefaultAvatarByRole(role);
    const avatar = getAvatarById(finalAvatarId);
    const Icon = avatar.icon;

    const sizeClasses = {
      sm: "w-10 h-10",
      md: "w-16 h-16",
      lg: "w-28 h-28 md:w-36 md:h-36",
      xl: "w-40 h-40",
    };

    const iconSizes = {
      sm: "w-5 h-5",
      md: "w-8 h-8",
      lg: "w-14 h-14 md:w-16 md:h-16",
      xl: "w-20 h-20",
    };

    return (
      <div
        onClick={onClick}
        className={`
          ${sizeClasses[size]}
          rounded-2xl
          bg-gradient-to-br ${avatar.bg}
          flex items-center justify-center
          shadow-xl
          border-4 border-white dark:border-[#1e1e2d]
          ${editable ? "cursor-pointer hover:scale-105 transition-transform relative group" : ""}
        `}
      >
        <Icon className={`${iconSizes[size]} text-white`} />
        {editable && (
          <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-medium">O'zgartirish</span>
          </div>
        )}
      </div>
    );
  }
);

AvatarDisplay.displayName = "AvatarDisplay";

interface AvatarSelectorModalProps {
  open: boolean;
  onClose: () => void;
  currentAvatarId?: string | null;
  onSelect: (avatarId: string) => void;
  loading?: boolean;
}

// Avatar tanlash modali
const AvatarSelectorModal = ({
  open,
  onClose,
  currentAvatarId,
  onSelect,
  loading = false,
}: AvatarSelectorModalProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(currentAvatarId || null);

  const handleSelect = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#8C57FF] to-[#6366F1] flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white m-0">
              Avatar tanlash
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
              O'zingizga yoqqan avatarni tanlang
            </p>
          </div>
        </div>
      }
      footer={null}
      centered
      width={480}
    >
      <div className="mt-6">
        <div className="grid grid-cols-4 gap-4">
          {avatarVariants.map((avatar) => {
            const Icon = avatar.icon;
            const isSelected = selectedId === avatar.id;

            return (
              <div
                key={avatar.id}
                onClick={() => setSelectedId(avatar.id)}
                className={`
                  relative
                  aspect-square
                  rounded-2xl
                  bg-gradient-to-br ${avatar.bg}
                  flex items-center justify-center
                  cursor-pointer
                  transition-all duration-200
                  ${isSelected ? "ring-4 ring-[#8C57FF] ring-offset-2 scale-105" : "hover:scale-105"}
                `}
              >
                <Icon className="w-10 h-10 text-white" />
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#8C57FF] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedId || loading}
            className="flex-1 h-11 rounded-lg bg-[#8C57FF] hover:bg-[#7C3AED] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(AvatarSelectorModal);
