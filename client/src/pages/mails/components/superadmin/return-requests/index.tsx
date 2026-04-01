import { memo, useState } from "react";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import {
  RotateCcw,
  Check,
  X,
  Loader2,
  Package,
  Phone,
  MapPin,
  User,
  Truck,
  Home,
  CheckSquare,
  Square,
} from "lucide-react";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";

const ReturnRequests = () => {
  const { getReturnRequests, approveReturnRequests, rejectReturnRequests } =
    usePost();
  const { data, isLoading } = getReturnRequests();
  const { handleSuccess, handleApiError } = useApiNotification();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | null
  >(null);

  const groups = data?.data?.groups || [];
  const total = data?.data?.total || 0;

  const allOrderIds: string[] = groups.flatMap((g: any) =>
    g.orders.map((o: any) => o.id)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === allOrderIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds([...allOrderIds]);
    }
  };

  const handleApprove = () => {
    if (selectedIds.length === 0) return;
    approveReturnRequests.mutate(
      { order_ids: selectedIds },
      {
        onSuccess: () => {
          handleSuccess(
            `${selectedIds.length} ta buyurtma pochtaga qaytarildi`
          );
          setSelectedIds([]);
          setConfirmAction(null);
        },
        onError: (err: any) =>
          handleApiError(err, "Tasdiqlashda xatolik yuz berdi"),
      }
    );
  };

  const handleReject = () => {
    if (selectedIds.length === 0) return;
    rejectReturnRequests.mutate(
      { order_ids: selectedIds },
      {
        onSuccess: () => {
          handleSuccess(
            `${selectedIds.length} ta so'rov rad etildi — buyurtmalar kuryerda qoldi`
          );
          setSelectedIds([]);
          setConfirmAction(null);
        },
        onError: (err: any) =>
          handleApiError(err, "Rad etishda xatolik yuz berdi"),
      }
    );
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    return phone
      .replace(/\D/g, "")
      .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-12 text-center">
        <RotateCcw className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
          Qaytarish so'rovlari yo'q
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Hozircha kurierlardan qaytarish so'rovi kelmagan
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full pb-4">
      {/* Top Actions */}
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
          >
            {selectedIds.length === allOrderIds.length ? (
              <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            {selectedIds.length === allOrderIds.length
              ? "Barchasini bekor qilish"
              : "Barchasini tanlash"}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedIds.length} / {total} ta tanlangan
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedIds.length > 0 && setConfirmAction("approve")}
            disabled={selectedIds.length === 0}
            className={`h-9 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
              selectedIds.length === 0
                ? "opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-500"
                : "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-lg shadow-emerald-500/25"
            }`}
          >
            <Check className="w-4 h-4" />
            Tasdiqlash
          </button>
          <button
            onClick={() => selectedIds.length > 0 && setConfirmAction("reject")}
            disabled={selectedIds.length === 0}
            className={`h-9 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
              selectedIds.length === 0
                ? "opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-500"
                : "bg-red-500 text-white hover:bg-red-600 cursor-pointer shadow-lg shadow-red-500/25"
            }`}
          >
            <X className="w-4 h-4" />
            Rad etish
          </button>
        </div>
      </div>

      {/* Courier Groups */}
      {groups.map((group: any, gIdx: number) => (
        <div
          key={gIdx}
          className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden"
        >
          {/* Courier Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-amber-50 dark:bg-amber-900/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                  {group.courier?.name || "Noma'lum kuryer"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {group.orders.length} ta buyurtma qaytarish so'rovi
                </p>
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="p-3 space-y-2">
            {group.orders.map((order: any) => {
              const isSelected = selectedIds.includes(order.id);
              return (
                <div
                  key={order.id}
                  onClick={() => toggleSelect(order.id)}
                  className={`p-3 rounded-xl transition-all border cursor-pointer ${
                    isSelected
                      ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50"
                      : "bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/30 hover:bg-amber-50/50 dark:hover:bg-amber-900/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Customer + Price */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                            {order.customer?.name || "Noma'lum"}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-800 dark:text-white whitespace-nowrap">
                          {(order.total_price || 0).toLocaleString()} so'm
                        </span>
                      </div>

                      {/* Info Row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <Phone className="w-3 h-3" />
                          {formatPhone(order.customer?.phone_number)}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {order.district?.region?.name || "-"},{" "}
                          {order.district?.name || "-"}
                        </span>
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            order.where_deliver === "address"
                              ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                              : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {order.where_deliver === "address" ? (
                            <Home className="w-3 h-3" />
                          ) : (
                            <Truck className="w-3 h-3" />
                          )}
                          {order.where_deliver === "address"
                            ? "Uyga"
                            : "Markazga"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Confirm Popup */}
      <ConfirmPopup
        isShow={confirmAction === "approve"}
        title={`${selectedIds.length} ta buyurtmani pochtaga qaytarishni tasdiqlaysizmi?`}
        description="Tanlangan buyurtmalar kuryer hisobidan olinib pochtaga qaytariladi."
        confirmText="Ha, tasdiqlash"
        cancelText="Bekor qilish"
        confirmClassName="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600"
        onConfirm={handleApprove}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmPopup
        isShow={confirmAction === "reject"}
        title={`${selectedIds.length} ta qaytarish so'rovini rad etasizmi?`}
        description="Buyurtmalar kuryerda qolib ketadi va oddiy buyurtma sifatida ko'rinadi."
        confirmText="Ha, rad etish"
        cancelText="Bekor qilish"
        confirmClassName="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
        onConfirm={handleReject}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default memo(ReturnRequests);
