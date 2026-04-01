import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { DatePicker, Select, Pagination } from "antd";
import dayjs from "dayjs";
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
  Search,
  Filter,
  X,
  FileText,
} from "lucide-react";

const { RangePicker } = DatePicker;

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  created: { icon: Package, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30", label: "Yaratildi" },
  status_change: { icon: ArrowRight, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30", label: "Holat o'zgardi" },
  sold: { icon: CheckCircle, color: "text-green-500 bg-green-100 dark:bg-green-900/30", label: "Sotildi" },
  cancelled: { icon: XCircle, color: "text-red-500 bg-red-100 dark:bg-red-900/30", label: "Bekor qilindi" },
  rollback: { icon: RotateCcw, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30", label: "Qaytarildi" },
  deleted: { icon: Trash2, color: "text-red-600 bg-red-100 dark:bg-red-900/30", label: "O'chirildi" },
  return_requested: { icon: AlertTriangle, color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30", label: "Qaytarish so'rovi" },
  updated: { icon: ArrowRight, color: "text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30", label: "Yangilandi" },
  payment: { icon: FileText, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30", label: "To'lov" },
};

const defaultConfig = { icon: Clock, color: "text-gray-500 bg-gray-100 dark:bg-gray-800", label: "Harakat" };

const entityTypeOptions = [
  { value: "", label: "Barchasi" },
  { value: "order", label: "Buyurtma" },
  { value: "post", label: "Pochta" },
  { value: "user", label: "Foydalanuvchi" },
  { value: "cashbox", label: "Kassa" },
];

const actionOptions = [
  { value: "", label: "Barchasi" },
  { value: "created", label: "Yaratildi" },
  { value: "status_change", label: "Holat o'zgardi" },
  { value: "sold", label: "Sotildi" },
  { value: "cancelled", label: "Bekor qilindi" },
  { value: "rollback", label: "Qaytarildi" },
  { value: "deleted", label: "O'chirildi" },
  { value: "return_requested", label: "Qaytarish so'rovi" },
];

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

const LogsPage = () => {
  const [filters, setFilters] = useState({
    entity_type: "",
    action: "",
    search: "",
    fromDate: "",
    toDate: "",
    page: 1,
    limit: 30,
  });
  const [searchInput, setSearchInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params: any = { page: filters.page, limit: filters.limit };
  if (filters.entity_type) params.entity_type = filters.entity_type;
  if (filters.action) params.action = filters.action;
  if (filters.search) params.search = filters.search;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", params],
    queryFn: () => api.get("activity-log", { params }).then((res) => res.data),
  });

  const logs = data?.data?.logs || [];
  const total = data?.data?.total || 0;

  const clearFilters = () => {
    setFilters({ entity_type: "", action: "", search: "", fromDate: "", toDate: "", page: 1, limit: 30 });
    setSearchInput("");
  };

  const hasFilters = filters.entity_type || filters.action || filters.search || filters.fromDate || filters.toDate;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                Tizim loglari
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Barcha o'zgarishlar tarixi
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setFilters((p) => ({ ...p, search: searchInput, page: 1 }));
                  }
                }}
                onBlur={() => {
                  if (searchInput !== filters.search) {
                    setFilters((p) => ({ ...p, search: searchInput, page: 1 }));
                  }
                }}
                placeholder="Qidirish (ism, tavsif, ID)..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>

            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />

            <Select
              value={filters.entity_type || undefined}
              onChange={(v) => setFilters((p) => ({ ...p, entity_type: v || "", page: 1 }))}
              placeholder="Turi"
              allowClear
              className="min-w-[130px]"
              options={entityTypeOptions.filter((o) => o.value)}
            />

            <Select
              value={filters.action || undefined}
              onChange={(v) => setFilters((p) => ({ ...p, action: v || "", page: 1 }))}
              placeholder="Harakat"
              allowClear
              className="min-w-[150px]"
              options={actionOptions.filter((o) => o.value)}
            />

            <RangePicker
              value={[
                filters.fromDate ? dayjs(filters.fromDate) : null,
                filters.toDate ? dayjs(filters.toDate) : null,
              ]}
              onChange={(dates) => {
                setFilters((p) => ({
                  ...p,
                  fromDate: dates?.[0] ? dates[0].format("YYYY-MM-DD") : "",
                  toDate: dates?.[1] ? dates[1].format("YYYY-MM-DD") : "",
                  page: 1,
                }));
              }}
              placeholder={["Boshlanish", "Tugash"]}
              format="YYYY-MM-DD"
              className="!rounded-xl"
            />

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {total} ta yozuv
            </span>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 flex-1">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-12 text-center flex-1">
            <Clock className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Loglar topilmadi
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasFilters ? "Filtrlarni o'zgartiring" : "Hozircha loglar yo'q"}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log: any) => {
                const config = actionConfig[log.action] || defaultConfig;
                const Icon = config.icon;
                const isExpanded = expandedId === log.id;

                return (
                  <div
                    key={log.id}
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {log.description || config.label}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {/* Entity type badge */}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium uppercase">
                                {log.entity_type}
                              </span>
                              {/* Action badge */}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${config.color}`}>
                                {config.label}
                              </span>
                              {/* User */}
                              {log.user_name && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <User className="w-3 h-3" />
                                  {log.user_name}
                                  {log.user_role && (
                                    <span className={`text-[10px] px-1 py-0.5 rounded ${getRoleBadge(log.user_role)}`}>
                                      {log.user_role}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                            {formatDate(log.created_at)}
                          </span>
                        </div>

                        {/* Status change indicator */}
                        {log.old_value?.status && log.new_value?.status && (
                          <div className="flex items-center gap-2 mt-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              {log.old_value.status}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                              {log.new_value.status}
                            </span>
                          </div>
                        )}

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2 text-xs">
                            <div className="flex gap-2">
                              <span className="text-gray-500 w-16 flex-shrink-0">ID:</span>
                              <span className="text-gray-700 dark:text-gray-300 font-mono break-all">
                                {log.entity_id}
                              </span>
                            </div>
                            {log.old_value && (
                              <div className="flex gap-2">
                                <span className="text-gray-500 w-16 flex-shrink-0">Oldingi:</span>
                                <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                                  {JSON.stringify(log.old_value, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_value && (
                              <div className="flex gap-2">
                                <span className="text-gray-500 w-16 flex-shrink-0">Yangi:</span>
                                <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                                  {JSON.stringify(log.new_value, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-center flex-shrink-0">
              <Pagination
                current={filters.page}
                total={total}
                pageSize={filters.limit}
                showSizeChanger
                onChange={(page, limit) => setFilters((p) => ({ ...p, page, limit }))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(LogsPage);
