// deploy: bigint migration rollout (2026-04-21)
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { DatePicker, Pagination, Drawer, Tooltip } from "antd";
import dayjs from "dayjs";
import {
  Clock,
  Loader2,
  ArrowRight,
  User,
  Package,
  XCircle,
  CheckCircle,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Search,
  X,
  FileText,
  LogIn,
  Smartphone,
  Monitor,
  Tablet,
  Wallet,
  TrendingUp,
  TrendingDown,
  Truck,
  Send,
  Receipt,
  Coins,
  Briefcase,
  LockKeyhole,
  LockOpen,
  Globe,
  ShoppingCart,
  ChevronRight,
  Activity,
  Code2,
  Hash,
} from "lucide-react";

const { RangePicker } = DatePicker;

// ============================================================================
// CATEGORIES & TABS
// ============================================================================
type TabKey = "all" | "logins" | "orders" | "cashbox" | "users";

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: "all", label: "Hammasi", icon: Activity, color: "text-indigo-500" },
  { key: "logins", label: "Kirishlar", icon: LogIn, color: "text-cyan-500" },
  { key: "orders", label: "Buyurtmalar", icon: ShoppingCart, color: "text-purple-500" },
  { key: "cashbox", label: "Kassa", icon: Wallet, color: "text-emerald-500" },
  { key: "users", label: "Foydalanuvchilar", icon: User, color: "text-amber-500" },
];

// ============================================================================
// ACTION CONFIG — rich metadata per action
// ============================================================================
type ActionCfg = {
  icon: any;
  tone: "green" | "red" | "blue" | "purple" | "amber" | "cyan" | "emerald" | "rose" | "indigo" | "gray" | "orange";
  label: string;
  category: "login" | "order" | "cashbox" | "shift" | "user" | "other";
};

const ACTION_CONFIG: Record<string, ActionCfg> = {
  // Auth
  login: { icon: LogIn, tone: "cyan", label: "Tizimga kirdi", category: "login" },
  // Order
  created: { icon: Package, tone: "blue", label: "Yaratildi", category: "order" },
  updated: { icon: FileText, tone: "indigo", label: "Yangilandi", category: "order" },
  sold: { icon: CheckCircle, tone: "green", label: "Sotildi", category: "order" },
  partly_sold: { icon: CheckCircle, tone: "emerald", label: "Qisman sotildi", category: "order" },
  cancelled: { icon: XCircle, tone: "red", label: "Bekor qilindi", category: "order" },
  rollback: { icon: RotateCcw, tone: "amber", label: "Orqaga qaytarildi", category: "order" },
  courier_changed: { icon: Truck, tone: "indigo", label: "Kuryer o'zgartirildi", category: "order" },
  status_change: { icon: ArrowRight, tone: "purple", label: "Holat o'zgardi", category: "order" },
  return_requested: { icon: AlertTriangle, tone: "orange", label: "Qaytarish so'rovi", category: "order" },
  return_approved: { icon: CheckCircle, tone: "green", label: "Qaytarish tasdiqlandi", category: "order" },
  return_rejected: { icon: XCircle, tone: "red", label: "Qaytarish rad etildi", category: "order" },
  reassigned: { icon: Send, tone: "purple", label: "Qayta biriktirildi", category: "order" },
  deleted: { icon: Trash2, tone: "rose", label: "O'chirildi", category: "order" },
  // Cashbox
  courier_payment: { icon: TrendingUp, tone: "emerald", label: "Kuryerdan to'lov", category: "cashbox" },
  market_payment: { icon: TrendingDown, tone: "purple", label: "Marketga to'lov", category: "cashbox" },
  manual_income: { icon: TrendingUp, tone: "green", label: "Qo'lda kirim", category: "cashbox" },
  manual_expense: { icon: TrendingDown, tone: "rose", label: "Qo'lda chiqim", category: "cashbox" },
  salary: { icon: Coins, tone: "amber", label: "Maosh to'landi", category: "cashbox" },
  // Shift
  opened: { icon: LockOpen, tone: "green", label: "Smena ochildi", category: "shift" },
  closed: { icon: LockKeyhole, tone: "gray", label: "Smena yopildi", category: "shift" },
};

const DEFAULT_ACTION: ActionCfg = { icon: Clock, tone: "gray", label: "Harakat", category: "other" };

const TONE_CLASSES: Record<ActionCfg["tone"], { soft: string; text: string; solid: string; border: string; dot: string }> = {
  green: { soft: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400", solid: "bg-green-500", border: "border-green-200 dark:border-green-900/40", dot: "bg-green-500" },
  red: { soft: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400", solid: "bg-red-500", border: "border-red-200 dark:border-red-900/40", dot: "bg-red-500" },
  rose: { soft: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400", solid: "bg-rose-500", border: "border-rose-200 dark:border-rose-900/40", dot: "bg-rose-500" },
  blue: { soft: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", solid: "bg-blue-500", border: "border-blue-200 dark:border-blue-900/40", dot: "bg-blue-500" },
  cyan: { soft: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-600 dark:text-cyan-400", solid: "bg-cyan-500", border: "border-cyan-200 dark:border-cyan-900/40", dot: "bg-cyan-500" },
  purple: { soft: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400", solid: "bg-purple-500", border: "border-purple-200 dark:border-purple-900/40", dot: "bg-purple-500" },
  amber: { soft: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", solid: "bg-amber-500", border: "border-amber-200 dark:border-amber-900/40", dot: "bg-amber-500" },
  orange: { soft: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400", solid: "bg-orange-500", border: "border-orange-200 dark:border-orange-900/40", dot: "bg-orange-500" },
  emerald: { soft: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", solid: "bg-emerald-500", border: "border-emerald-200 dark:border-emerald-900/40", dot: "bg-emerald-500" },
  indigo: { soft: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400", solid: "bg-indigo-500", border: "border-indigo-200 dark:border-indigo-900/40", dot: "bg-indigo-500" },
  gray: { soft: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", solid: "bg-gray-500", border: "border-gray-200 dark:border-gray-700", dot: "bg-gray-500" },
};

// ============================================================================
// STATUS & ENTITY LABELS
// ============================================================================
const STATUS_LABEL: Record<string, string> = {
  new: "Yangi",
  received: "Qabul qilindi",
  on_the_road: "Yo'lda",
  waiting: "Kutilmoqda",
  sold: "Sotildi",
  cancelled: "Bekor qilingan",
  paid: "To'langan",
  partly_paid: "Qisman to'langan",
  cancelled_sent: "Bekor yuborilgan",
  closed: "Yopilgan",
  partly_sold: "Qisman sotilgan",
};

const ENTITY_LABEL: Record<string, string> = {
  order: "Buyurtma",
  post: "Pochta",
  user: "Foydalanuvchi",
  cashbox: "Kassa",
  shift: "Smena",
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  registrator: "Registrator",
  courier: "Kuryer",
  market: "Market",
  operator: "Operator",
  logist: "Logist",
  investor: "Investor",
  customer: "Mijoz",
};

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  registrator: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  courier: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  market: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  operator: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  logist: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  investor: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  transfer: "O'tkazma",
  click: "Click",
  payme: "Payme",
};

// ============================================================================
// HELPERS
// ============================================================================
const parseUserAgent = (ua?: string) => {
  if (!ua) return { device: "Noma'lum", os: "", browser: "", icon: Monitor };
  const lower = ua.toLowerCase();
  let device: "mobile" | "tablet" | "desktop" = "desktop";
  let icon: any = Monitor;
  if (/ipad|tablet/.test(lower)) {
    device = "tablet";
    icon = Tablet;
  } else if (/mobile|android|iphone|ipod/.test(lower)) {
    device = "mobile";
    icon = Smartphone;
  }
  let os = "";
  if (/windows/.test(lower)) os = "Windows";
  else if (/mac os/.test(lower)) os = "macOS";
  else if (/android/.test(lower)) os = "Android";
  else if (/iphone|ipad|ipod|ios/.test(lower)) os = "iOS";
  else if (/linux/.test(lower)) os = "Linux";
  let browser = "";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/opr|opera/i.test(ua)) browser = "Opera";
  const deviceLabel = device === "mobile" ? "Mobil" : device === "tablet" ? "Planshet" : "Kompyuter";
  return { device: deviceLabel, os, browser, icon };
};

const formatDate = (ts: number | string) => {
  const d = new Date(Number(ts));
  return d.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTime = (ts: number | string) => {
  const d = new Date(Number(ts));
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
};

const formatRelative = (ts: number | string) => {
  const diff = Date.now() - Number(ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "hozir";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} daqiqa oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} kun oldin`;
  return formatDate(ts);
};

const formatPrice = (n?: number | string | null) => {
  if (n == null) return "0";
  return new Intl.NumberFormat("uz-UZ").format(Number(n));
};

const shortId = (id?: string) => (id ? id.slice(0, 8) : "");

const statusPill = (s?: string) => STATUS_LABEL[String(s)] || s || "—";

// ============================================================================
// LOG CARD RENDERER
// ============================================================================
type LogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value?: any;
  new_value?: any;
  description?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  metadata?: any;
  created_at: number | string;
};

const RoleBadge: React.FC<{ role?: string }> = ({ role }) => {
  if (!role) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_BADGE[role] || "bg-gray-100 text-gray-600"}`}>
      {ROLE_LABEL[role] || role}
    </span>
  );
};

const UserChip: React.FC<{ name?: string; role?: string; compact?: boolean }> = ({ name, role, compact }) => {
  if (!name && !role) return <span className="text-xs text-gray-400">Tizim</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? "text-xs" : "text-sm"} text-gray-700 dark:text-gray-300`}>
      <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="truncate">{name || "—"}</span>
      <RoleBadge role={role} />
    </span>
  );
};

const StatusTransition: React.FC<{ from?: string; to?: string }> = ({ from, to }) => {
  if (!from && !to) return null;
  return (
    <div className="inline-flex items-center gap-2 text-xs">
      {from && (
        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
          {statusPill(from)}
        </span>
      )}
      {from && to && <ArrowRight className="w-3 h-3 text-gray-400" />}
      {to && (
        <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
          {statusPill(to)}
        </span>
      )}
    </div>
  );
};

const AmountPill: React.FC<{ amount?: number | string; positive?: boolean }> = ({ amount, positive }) => {
  if (amount == null) return null;
  const cls = positive === undefined
    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
    : positive
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${cls}`}>
      {positive === true ? "+" : positive === false ? "−" : ""}
      {formatPrice(amount)} so'm
    </span>
  );
};

// Render the "title line" and "meta line" based on action type
const describeLog = (log: LogRow): { title: string; extras: React.ReactNode } => {
  const nv = log.new_value || {};
  const ov = log.old_value || {};
  const desc = log.description || ACTION_CONFIG[log.action]?.label || "Harakat";

  if (log.action === "login") {
    const meta = log.metadata || {};
    const { device, os, browser, icon: DeviceIcon } = parseUserAgent(meta.user_agent);
    return {
      title: desc,
      extras: (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400">
            <DeviceIcon className="w-3 h-3" />
            {device}
            {os && ` · ${os}`}
            {browser && ` · ${browser}`}
          </span>
          {meta.ip && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono">
              <Globe className="w-3 h-3" />
              {meta.ip}
            </span>
          )}
          {meta.source && meta.source !== "web" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              {meta.source}
            </span>
          )}
        </div>
      ),
    };
  }

  if (log.entity_type === "order") {
    const amount = nv.total_price ?? nv.paid_amount;
    const fromStatus = ov.status;
    const toStatus = nv.status;
    return {
      title: desc,
      extras: (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <StatusTransition from={fromStatus} to={toStatus} />
          {amount != null && <AmountPill amount={amount} />}
          {nv.courier_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
              <Truck className="w-3 h-3" />
              {nv.courier_name}
            </span>
          )}
          {ov.courier_name && nv.courier_name && ov.courier_name !== nv.courier_name && (
            <span className="text-[10px] text-gray-400">({ov.courier_name} → {nv.courier_name})</span>
          )}
        </div>
      ),
    };
  }

  if (log.entity_type === "cashbox") {
    const amount = nv.amount;
    const positive = log.action === "courier_payment" || log.action === "manual_income";
    return {
      title: desc,
      extras: (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {amount != null && <AmountPill amount={amount} positive={positive} />}
          {nv.payment_method && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">
              <Receipt className="w-3 h-3" />
              {PAYMENT_METHOD_LABEL[nv.payment_method] || nv.payment_method}
            </span>
          )}
          {nv.staff_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
              <Briefcase className="w-3 h-3" />
              {nv.staff_name}
            </span>
          )}
          {nv.comment && (
            <span className="text-xs text-gray-500 dark:text-gray-400 italic">
              "{nv.comment}"
            </span>
          )}
        </div>
      ),
    };
  }

  if (log.entity_type === "shift") {
    return {
      title: desc,
      extras: (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          {(nv.opening_balance_cash != null || nv.closing_balance_cash != null) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              Naqd: {formatPrice(nv.opening_balance_cash ?? nv.closing_balance_cash)}
            </span>
          )}
          {(nv.opening_balance_card != null || nv.closing_balance_card != null) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
              Karta: {formatPrice(nv.opening_balance_card ?? nv.closing_balance_card)}
            </span>
          )}
        </div>
      ),
    };
  }

  if (log.entity_type === "user") {
    const target = nv.name || ov.name;
    const targetRole = nv.role || ov.role;
    return {
      title: desc,
      extras: (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          {target && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <User className="w-3 h-3" />
              {target}
            </span>
          )}
          <RoleBadge role={targetRole} />
        </div>
      ),
    };
  }

  return { title: desc, extras: null };
};

// ============================================================================
// LOG CARD COMPONENT
// ============================================================================
const LogCard: React.FC<{
  log: LogRow;
  onOpenTimeline?: (entityType: string, entityId: string) => void;
  showDetailsBtn?: boolean;
}> = ({ log, onOpenTimeline, showDetailsBtn = true }) => {
  const [showDebug, setShowDebug] = useState(false);
  const cfg = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
  const tone = TONE_CLASSES[cfg.tone];
  const Icon = cfg.icon;
  const { title, extras } = describeLog(log);

  const canOpenTimeline = showDetailsBtn && (log.entity_type === "order" || log.entity_type === "post") && !!onOpenTimeline;

  return (
    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tone.soft}`}>
          <Icon className={`w-5 h-5 ${tone.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium ${tone.soft} ${tone.text}`}>
                  {cfg.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium uppercase">
                  {ENTITY_LABEL[log.entity_type] || log.entity_type}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-white mt-1 break-words">
                {title}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <UserChip name={log.user_name} role={log.user_role} compact />
              </div>
              {extras}
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <Tooltip title={formatDate(log.created_at)}>
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatRelative(log.created_at)}
                </span>
              </Tooltip>
              <span className="text-[10px] text-gray-400 font-mono">
                {formatTime(log.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {log.entity_id && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                <Hash className="w-3 h-3" />
                {shortId(log.entity_id)}
              </span>
            )}
            {canOpenTimeline && (
              <button
                onClick={() => onOpenTimeline!(log.entity_type, log.entity_id)}
                className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
              >
                Tarix
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowDebug((p) => !p)}
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Raw JSON"
            >
              <Code2 className="w-3 h-3" />
              {showDebug ? "Yashirish" : "Tafsilot"}
            </button>
          </div>

          {showDebug && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl space-y-2 text-[11px] border border-gray-200 dark:border-gray-800">
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 flex-shrink-0">Entity ID:</span>
                <span className="text-gray-700 dark:text-gray-300 font-mono break-all">{log.entity_id}</span>
              </div>
              {log.old_value && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 flex-shrink-0">Oldingi:</span>
                  <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all flex-1">
                    {JSON.stringify(log.old_value, null, 2)}
                  </pre>
                </div>
              )}
              {log.new_value && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 flex-shrink-0">Yangi:</span>
                  <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all flex-1">
                    {JSON.stringify(log.new_value, null, 2)}
                  </pre>
                </div>
              )}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 flex-shrink-0">Metadata:</span>
                  <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all flex-1">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TIMELINE DRAWER — shows full history for one order
// ============================================================================
const TimelineDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  entityType: string | null;
  entityId: string | null;
}> = ({ open, onClose, entityType, entityId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["activity-log-entity", entityType, entityId],
    queryFn: () =>
      api
        .get(`activity-log/${entityType}/${entityId}`, { params: { page: 1, limit: 200 } })
        .then((r) => r.data),
    enabled: !!(open && entityType && entityId),
  });

  const logs: LogRow[] = (data?.data?.logs || []).slice().reverse(); // oldest first for timeline

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          <div>
            <div className="font-bold text-gray-800 dark:text-white">
              {ENTITY_LABEL[entityType || ""] || entityType} tarixi
            </div>
            <div className="text-xs text-gray-400 font-mono">{entityId}</div>
          </div>
        </div>
      }
      destroyOnClose
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Loglar topilmadi</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-1">
            {logs.map((log) => {
              const cfg = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
              const tone = TONE_CLASSES[cfg.tone];
              const Icon = cfg.icon;
              const { title, extras } = describeLog(log);
              return (
                <div key={log.id} className="relative pl-12 pb-4">
                  <div className={`absolute left-2 top-2 w-6 h-6 rounded-full flex items-center justify-center ${tone.soft} ring-4 ring-white dark:ring-[#2A263D]`}>
                    <Icon className={`w-3.5 h-3.5 ${tone.text}`} />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tone.soft} ${tone.text}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white mt-1">
                          {title}
                        </p>
                        <div className="mt-1">
                          <UserChip name={log.user_name} role={log.user_role} compact />
                        </div>
                        {extras}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Drawer>
  );
};

// ============================================================================
// MAIN PAGE
// ============================================================================
const LogsPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>("all");
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    fromDate: "",
    toDate: "",
    page: 1,
    limit: 30,
  });
  const [searchInput, setSearchInput] = useState("");
  const [drawerState, setDrawerState] = useState<{ type: string | null; id: string | null; open: boolean }>({
    type: null,
    id: null,
    open: false,
  });

  // Build query params based on tab
  const params: any = useMemo(() => {
    const p: any = { page: filters.page, limit: filters.limit };
    if (filters.search) p.search = filters.search;
    if (filters.action) p.action = filters.action;
    if (filters.fromDate) p.fromDate = filters.fromDate;
    if (filters.toDate) p.toDate = filters.toDate;

    if (tab === "logins") {
      p.entity_type = "user";
      p.action = "login";
    } else if (tab === "orders") {
      p.entity_type = "order";
    } else if (tab === "cashbox") {
      p.entity_type = "cashbox";
    } else if (tab === "users") {
      p.entity_type = "user";
      p.excludeAction = "login";
    }
    return p;
  }, [tab, filters]);

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", params],
    queryFn: () => api.get("activity-log", { params }).then((r) => r.data),
  });

  const logs: LogRow[] = data?.data?.logs || [];
  const rawTotal = data?.data?.total || 0;
  const total = rawTotal;

  // Quick stats for current page
  const stats = useMemo(() => {
    const s = {
      orderActions: 0,
      cashboxAmount: 0,
      logins: 0,
      users: new Set<string>(),
    };
    for (const l of logs) {
      if (l.entity_type === "order") s.orderActions++;
      if (l.entity_type === "cashbox") s.cashboxAmount += Number(l.new_value?.amount || 0);
      if (l.action === "login") s.logins++;
      if (l.user_id) s.users.add(l.user_id);
    }
    return s;
  }, [logs]);

  const clearFilters = () => {
    setFilters({ search: "", action: "", fromDate: "", toDate: "", page: 1, limit: 30 });
    setSearchInput("");
  };

  const hasFilters = !!(filters.search || filters.action || filters.fromDate || filters.toDate);

  const applySearch = () => {
    if (searchInput !== filters.search) {
      setFilters((p) => ({ ...p, search: searchInput, page: 1 }));
    }
  };

  const openTimeline = (type: string, id: string) =>
    setDrawerState({ type, id, open: true });

  const closeTimeline = () => setDrawerState((p) => ({ ...p, open: false }));

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
                Barcha o'zgarishlar, kirishlar va kassa harakatlari
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide mb-3 bg-white dark:bg-[#2A263D] rounded-2xl p-1 shadow-sm">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setFilters((p) => ({ ...p, page: 1, action: "" }));
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard icon={Activity} color="indigo" label="Bu sahifada" value={String(logs.length)} />
            <StatCard icon={User} color="cyan" label="Faol foydalanuvchilar" value={String(stats.users.size)} />
            <StatCard icon={ShoppingCart} color="purple" label="Buyurtma harakati" value={String(stats.orderActions)} />
            <StatCard
              icon={Wallet}
              color="emerald"
              label="Kassa harakati"
              value={`${formatPrice(stats.cashboxAmount)} so'm`}
            />
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-3 flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                onBlur={applySearch}
                placeholder="Ism, tavsif, ID bo'yicha qidirish..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
              />
            </div>

            <RangePicker
              value={[
                filters.fromDate ? dayjs(filters.fromDate) : null,
                filters.toDate ? dayjs(filters.toDate) : null,
              ]}
              onChange={(dates) =>
                setFilters((p) => ({
                  ...p,
                  fromDate: dates?.[0] ? dates[0].format("YYYY-MM-DD") : "",
                  toDate: dates?.[1] ? dates[1].format("YYYY-MM-DD") : "",
                  page: 1,
                }))
              }
              placeholder={["Boshlanish", "Tugash"]}
              format="YYYY-MM-DD"
              className="!rounded-xl"
            />

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="h-10 px-3 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
              >
                <X className="w-4 h-4" />
                Tozalash
              </button>
            )}

            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 font-medium">
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
              {logs.map((log) => (
                <LogCard key={log.id} log={log} onOpenTimeline={openTimeline} />
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-center flex-shrink-0">
              <Pagination
                current={filters.page}
                total={rawTotal}
                pageSize={filters.limit}
                showSizeChanger
                onChange={(page, limit) => setFilters((p) => ({ ...p, page, limit }))}
              />
            </div>
          </div>
        )}
      </div>

      <TimelineDrawer
        open={drawerState.open}
        onClose={closeTimeline}
        entityType={drawerState.type}
        entityId={drawerState.id}
      />
    </div>
  );
};

// ============================================================================
// STAT CARD
// ============================================================================
const StatCard: React.FC<{ icon: any; color: string; label: string; value: string }> = ({
  icon: Icon,
  color,
  label,
  value,
}) => {
  const map: Record<string, string> = {
    indigo: "from-indigo-500 to-indigo-600",
    cyan: "from-cyan-500 to-cyan-600",
    purple: "from-purple-500 to-purple-600",
    emerald: "from-emerald-500 to-emerald-600",
  };
  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${map[color]} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-base font-bold text-gray-800 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
};

export default React.memo(LogsPage);
