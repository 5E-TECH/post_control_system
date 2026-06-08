import { useState } from "react";
import { Table, Tag, Button, Tooltip, message, Popconfirm } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  RotateCcw,
  RefreshCw,
  DownloadCloud,
  AlertTriangle,
  CheckCircle2,
  PackageX,
  PackageCheck,
  Layers,
  XCircle,
} from "lucide-react";
import {
  useLdgAdmin,
  type LdgShipmentRow,
} from "../../../shared/api/hooks/useLdgAdmin";
import { FilterPills } from "./FilterPills";

const ldgStatusColor = (status: string | null): string => {
  if (!status) return "default";
  const s = status.toUpperCase();
  if (s === "DELIVERED") return "green";
  if (s === "CANCELLED" || s === "RETURNED") return "red";
  if (s === "IN_TRANSIT" || s === "OUT_FOR_DELIVERY") return "blue";
  if (s === "RECEIVED") return "cyan";
  if (s === "8") return "geekblue"; // Filialda
  return "default";
};

// LDG status code → o'qishga qulay nom (LDG GET /statuses asosida)
const LDG_STATUS_LABELS: Record<string, string> = {
  CREATED: "Yaratildi",
  NEW: "Yangi",
  RECEIVED: "Qabul qilindi",
  "8": "Filialda",
  IN_TRANSIT: "Tranzit",
  OUT_FOR_DELIVERY: "Yetkazilmoqda",
  DELIVERED: "Yetkazildi",
  RETURNED: "Qaytarildi",
  CANCELLED: "Bekor qilindi",
};

const ldgStatusLabel = (status: string | null): string => {
  if (!status) return "—";
  return LDG_STATUS_LABELS[status.toUpperCase()] ?? status;
};

export const LdgShipmentsTab = () => {
  const {
    getShipments,
    redispatch,
    syncOne,
    resolveMismatch,
    getBulkStatus,
    startBulk,
    getHealth,
  } = useLdgAdmin();
  const { data: health } = getHealth(true);
  const s = health?.shipments;
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const limit = 20;

  const { data, isLoading, isFetching, refetch } = getShipments({
    page,
    limit,
    filter,
  });

  // Server tomonidagi bulk-job holati (progress widget ham shu bilan ishlaydi).
  const { data: bulkStatus } = getBulkStatus(true, true);
  const bulkRunning = !!bulkStatus?.running;

  const handleRedispatch = async (orderId: string) => {
    try {
      const result = await redispatch.mutateAsync(orderId);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(`Qayta jo'natish muvaffaqiyatsiz: ${result.message}`);
      }
    } catch {
      message.error("Qayta jo'natishda xatolik");
    }
  };

  // Yuborilmagan/xatoli barcha (faol) jo'natmalarni qayta jo'natishni boshlaydi.
  // Jarayon SERVER tomonida ishlaydi — sahifa yopilsa/refresh bo'lsa ham davom
  // etadi. Progress global widget'da ko'rinadi va u yerdan to'xtatish mumkin.
  const handleRedispatchAll = async () => {
    try {
      const r = await startBulk.mutateAsync();
      // Global progress panelini ochamiz (qaysi sahifada bo'lishidan qat'i nazar).
      window.dispatchEvent(new Event("ldg-bulk-open"));
      if (r.started) {
        message.success(r.message);
      } else {
        message.info(r.message);
      }
    } catch {
      message.error("Ommaviy qayta jo'natishni boshlashda xatolik");
    }
  };

  const handleSync = async (orderId: string) => {
    setSyncingId(orderId);
    try {
      const result = await syncOne.mutateAsync(orderId);
      if (result.success) {
        message.success(result.message);
      } else {
        message.warning(result.message);
      }
    } catch {
      message.error("LDG'dan tekshirishda xatolik");
    } finally {
      setSyncingId(null);
    }
  };

  const handleResolveMismatch = async (orderId: string) => {
    setResolvingId(orderId);
    try {
      const result = await resolveMismatch.mutateAsync(orderId);
      if (result.success) {
        message.success(result.message);
      } else {
        message.warning(result.message);
      }
    } catch {
      message.error("Mismatch'ni hal qilishda xatolik");
    } finally {
      setResolvingId(null);
    }
  };

  const columns: ColumnsType<LdgShipmentRow> = [
    {
      title: "№",
      dataIndex: "order_number",
      key: "order_number",
      width: 90,
      fixed: "left",
      render: (v: number | null) =>
        v != null ? (
          <span className="font-semibold text-violet-600 dark:text-violet-400">
            #{v}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      title: "Mijoz",
      key: "customer",
      width: 180,
      render: (_: unknown, row) => (
        <div className="leading-tight">
          <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
            {row.customer_name ?? "—"}
          </div>
          {row.customer_phone && (
            <div className="text-xs text-gray-400">{row.customer_phone}</div>
          )}
        </div>
      ),
    },
    {
      title: "Manzil",
      key: "region_district",
      width: 170,
      render: (_: unknown, row) => {
        if (!row.region_name && !row.district_name)
          return <span className="text-gray-400">—</span>;
        return (
          <div className="leading-tight">
            <div className="text-gray-700 dark:text-gray-200 truncate">
              {row.region_name ?? "—"}
            </div>
            {row.district_name && (
              <div className="text-xs text-gray-400 truncate">
                {row.district_name}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Market",
      dataIndex: "market_name",
      key: "market_name",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => v ?? <span className="text-gray-400">—</span>,
    },
    {
      title: "Summa",
      dataIndex: "order_total_price",
      key: "order_total_price",
      width: 120,
      align: "right",
      render: (v: number | null) =>
        v != null ? (
          <span className="font-medium whitespace-nowrap">
            {Number(v).toLocaleString("uz-UZ")} so'm
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      title: "Holat",
      key: "status",
      width: 150,
      render: (_: unknown, row) => (
        <div className="flex flex-col items-start gap-1">
          <Tag className="m-0">{row.order_status ?? "—"}</Tag>
          <Tag color={ldgStatusColor(row.ldg_status)} className="m-0">
            {ldgStatusLabel(row.ldg_status)}
          </Tag>
        </div>
      ),
    },
    {
      title: "LDG paket",
      key: "ldg",
      width: 160,
      render: (_: unknown, row) =>
        row.ldg_order_id ? (
          <div className="leading-tight">
            <div className="text-xs">
              <span className="text-gray-400">ID:</span>{" "}
              <span className="font-semibold">{row.ldg_order_id}</span>
            </div>
            {row.tracking_number && (
              <div
                className="font-mono text-[11px] text-gray-500 truncate"
                title={row.tracking_number}
              >
                {row.tracking_number}
              </div>
            )}
          </div>
        ) : (
          <Tag color="gold">yuborilmagan</Tag>
        ),
    },
    {
      title: "Urinish",
      key: "attempts",
      width: 100,
      align: "center",
      render: (_: unknown, row) => (
        <Tooltip
          title={
            row.last_synced_at
              ? `Oxirgi tekshiruv: ${new Date(
                  Number(row.last_synced_at),
                ).toLocaleString("uz-UZ")}`
              : "Hali tekshirilmagan"
          }
        >
          <span className="inline-flex min-w-[28px] items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-sm font-medium">
            {row.send_attempts}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Xato / Mismatch",
      key: "error_or_mismatch",
      width: 220,
      render: (_: unknown, row) => {
        if (row.mismatch_at && row.mismatch_reason) {
          return (
            <Tooltip title={row.mismatch_reason}>
              <Tag
                color="volcano"
                icon={<AlertTriangle className="w-3 h-3 inline mr-1" />}
              >
                <span className="text-xs">MISMATCH</span>
              </Tag>
            </Tooltip>
          );
        }
        if (row.last_error) {
          return (
            <Tooltip title={row.last_error}>
              <span className="text-red-500 text-xs line-clamp-2 inline-block">
                {row.last_error}
              </span>
            </Tooltip>
          );
        }
        return <span className="text-gray-400">—</span>;
      },
    },
    {
      title: "Amal",
      key: "action",
      fixed: "right",
      width: 110,
      align: "center",
      render: (_: unknown, row) => (
        <div className="flex items-center justify-center gap-1.5">
          {row.mismatch_at && (
            <Popconfirm
              title="Mismatch hal qilindimi?"
              description="Faqat qo'lda tekshirib, kassa va status mosligini ta'minlagach bosing."
              okText="Ha, hal qilindi"
              cancelText="Yo'q"
              onConfirm={() => handleResolveMismatch(row.order_id)}
            >
              <Tooltip title="Mismatch — hal qilindi deb belgilash">
                <Button
                  size="small"
                  type="primary"
                  danger
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  loading={
                    resolveMismatch.isPending && resolvingId === row.order_id
                  }
                />
              </Tooltip>
            </Popconfirm>
          )}
          {row.ldg_order_id ? (
            <Tooltip title="LDG'dan joriy statusni tortib olish">
              <Button
                size="small"
                icon={<DownloadCloud className="w-3.5 h-3.5" />}
                loading={syncOne.isPending && syncingId === row.order_id}
                onClick={() => handleSync(row.order_id)}
              />
            </Tooltip>
          ) : (
            <Popconfirm
              title="Qayta jo'natish"
              description="Bu buyurtmani LDG'ga qayta jo'natishni xohlaysizmi?"
              okText="Ha"
              cancelText="Yo'q"
              onConfirm={() => handleRedispatch(row.order_id)}
            >
              <Tooltip title="LDG'ga qayta jo'natish">
                <Button
                  size="small"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  loading={redispatch.isPending}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <FilterPills
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            {
              value: "all",
              label: "Barchasi",
              icon: <Layers className="w-3.5 h-3.5" />,
              count: s?.total,
            },
            {
              value: "pending",
              label: "Yuborilmagan",
              icon: <PackageX className="w-3.5 h-3.5" />,
              count: s?.pending,
              activeClass: "bg-blue-600 text-white border-blue-600",
            },
            {
              value: "error",
              label: "Xatoli",
              icon: <XCircle className="w-3.5 h-3.5" />,
              count: s?.with_error,
              activeClass: "bg-red-600 text-white border-red-600",
            },
            {
              value: "delivered",
              label: "Yetkazilgan",
              icon: <PackageCheck className="w-3.5 h-3.5" />,
              count: s?.delivered,
              activeClass: "bg-green-600 text-white border-green-600",
            },
            {
              value: "mismatch",
              label: "Mismatch",
              icon: <AlertTriangle className="w-3.5 h-3.5" />,
              count: s?.mismatch,
              activeClass: "bg-orange-500 text-white border-orange-500",
            },
          ]}
        />
        <div className="flex items-center gap-2">
          <Popconfirm
            title="Hammasini qayta jo'natish"
            description="Barcha yuborilmagan (faol) buyurtmalar LDG'ga jo'natiladi. Jarayon server tomonida ishlaydi — sahifani yopsangiz ham davom etadi. Davom etilsinmi?"
            okText="Ha, boshla"
            cancelText="Yo'q"
            onConfirm={handleRedispatchAll}
            disabled={bulkRunning}
          >
            <Button
              type="primary"
              icon={<RotateCcw className="w-4 h-4" />}
              loading={startBulk.isPending}
              disabled={bulkRunning}
            >
              {bulkRunning
                ? `Jo'natilmoqda ${bulkStatus?.done ?? 0}/${bulkStatus?.total ?? 0}`
                : "Hammasini qayta jo'natish"}
            </Button>
          </Popconfirm>
          <Button
            icon={<RefreshCw className="w-4 h-4" />}
            loading={isFetching}
            onClick={() => refetch()}
          >
            Yangilash
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table<LdgShipmentRow>
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={data?.data ?? []}
          scroll={{ x: 1420 }}
          size="small"
          tableLayout="fixed"
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            className: "px-3",
          }}
        />
      </div>
    </div>
  );
};
