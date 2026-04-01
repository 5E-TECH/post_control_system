import { memo } from "react";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import {
  Clock,
  Loader2,
  ArrowRight,
  User,
  Package,
  Truck,
  XCircle,
  CheckCircle,
  RotateCcw,
  Trash2,
  AlertTriangle,
} from "lucide-react";

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  created: { icon: Package, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30", label: "Yaratildi" },
  status_change: { icon: ArrowRight, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30", label: "Holat o'zgardi" },
  sold: { icon: CheckCircle, color: "text-green-500 bg-green-100 dark:bg-green-900/30", label: "Sotildi" },
  cancelled: { icon: XCircle, color: "text-red-500 bg-red-100 dark:bg-red-900/30", label: "Bekor qilindi" },
  rollback: { icon: RotateCcw, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30", label: "Qaytarildi" },
  deleted: { icon: Trash2, color: "text-red-600 bg-red-100 dark:bg-red-900/30", label: "O'chirildi" },
  return_requested: { icon: AlertTriangle, color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30", label: "Qaytarish so'rovi" },
  updated: { icon: ArrowRight, color: "text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30", label: "Yangilandi" },
};

const defaultConfig = { icon: Clock, color: "text-gray-500 bg-gray-100 dark:bg-gray-800", label: "Harakat" };

const OrderTracking = ({ orderId }: { orderId: string }) => {
  const { getOrderActivityLog } = useOrder();
  const { data, isLoading } = getOrderActivityLog(orderId, !!orderId);

  const logs = data?.data?.logs || [];

  const formatDate = (timestamp: number) => {
    const date = new Date(Number(timestamp));
    return date.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      superadmin: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      admin: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
      registrator: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      courier: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      market: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      operator: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
    };
    return styles[role] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-6 text-center">
        <Clock className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Tracking tarix topilmadi</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white">Tracking tarix</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{logs.length} ta yozuv</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-4">
            {logs.map((log: any, idx: number) => {
              const config = actionConfig[log.action] || defaultConfig;
              const Icon = config.icon;

              return (
                <div key={log.id || idx} className="relative flex gap-4">
                  {/* Icon */}
                  <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {log.description || config.label}
                      </p>
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                        {formatDate(log.created_at)}
                      </span>
                    </div>

                    {/* User info */}
                    {log.user_name && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <User className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-300">{log.user_name}</span>
                        {log.user_role && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getRoleBadge(log.user_role)}`}>
                            {log.user_role}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Old → New value */}
                    {log.old_value?.status && log.new_value?.status && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {log.old_value.status}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                          {log.new_value.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderTracking);
