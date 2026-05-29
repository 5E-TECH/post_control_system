import { useState } from "react";
import {
  Table,
  Tag,
  Button,
  Segmented,
  Tooltip,
  message,
  Popconfirm,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  RotateCcw,
  RefreshCw,
  DownloadCloud,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  useLdgAdmin,
  type LdgShipmentRow,
} from "../../../shared/api/hooks/useLdgAdmin";

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
  const { getShipments, redispatch, syncOne, resolveMismatch } = useLdgAdmin();
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
      title: "Mijoz",
      dataIndex: "customer_name",
      key: "customer_name",
      render: (_: unknown, row) => (
        <div>
          <div className="font-medium">{row.customer_name ?? "—"}</div>
          <div className="text-xs text-gray-400">{row.customer_phone ?? ""}</div>
        </div>
      ),
    },
    {
      title: "Summa",
      dataIndex: "order_total_price",
      key: "order_total_price",
      render: (v: number | null) =>
        v != null ? `${v.toLocaleString("uz-UZ")} so'm` : "—",
    },
    {
      title: "Order holati",
      dataIndex: "order_status",
      key: "order_status",
      render: (v: string | null) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "LDG status",
      dataIndex: "ldg_status",
      key: "ldg_status",
      render: (v: string | null) => (
        <Tag color={ldgStatusColor(v)}>{ldgStatusLabel(v)}</Tag>
      ),
    },
    {
      title: "Tracking",
      dataIndex: "tracking_number",
      key: "tracking_number",
      render: (v: string | null) =>
        v ? <span className="font-mono text-xs">{v}</span> : "—",
    },
    {
      title: "LDG ID",
      dataIndex: "ldg_order_id",
      key: "ldg_order_id",
      render: (v: number | null) => v ?? <Tag color="orange">yuborilmagan</Tag>,
    },
    {
      title: "Urinish",
      dataIndex: "send_attempts",
      key: "send_attempts",
    },
    {
      title: "Xato / Mismatch",
      key: "error_or_mismatch",
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
              <span className="text-red-500 text-xs line-clamp-2 max-w-[220px] inline-block">
                {row.last_error}
              </span>
            </Tooltip>
          );
        }
        return "—";
      },
    },
    {
      title: "Amal",
      key: "action",
      fixed: "right",
      width: 260,
      render: (_: unknown, row) => (
        <div className="flex gap-1.5 flex-wrap">
          {row.mismatch_at && (
            <Popconfirm
              title="Mismatch'ni hal qilindi deb belgilashmi?"
              description="Faqat qo'lda tekshirib, kassa va status mosligini ta'minlaganingizdan keyin bosing."
              okText="Ha, hal qilindi"
              cancelText="Yo'q"
              onConfirm={() => handleResolveMismatch(row.order_id)}
            >
              <Button
                size="small"
                type="primary"
                danger
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                loading={resolveMismatch.isPending && resolvingId === row.order_id}
              >
                Hal qilindi
              </Button>
            </Popconfirm>
          )}
          {row.ldg_order_id ? (
            <Tooltip title="LDG'dan joriy statusni tortib olib, order holatini yangilaydi">
              <Button
                size="small"
                icon={<DownloadCloud className="w-3.5 h-3.5" />}
                loading={syncOne.isPending && syncingId === row.order_id}
                onClick={() => handleSync(row.order_id)}
              >
                LDG'dan tekshirish
              </Button>
            </Tooltip>
          ) : (
            <Popconfirm
              title="Qayta jo'natish"
              description="Bu buyurtmani LDG'ga qayta jo'natishni xohlaysizmi?"
              okText="Ha"
              cancelText="Yo'q"
              onConfirm={() => handleRedispatch(row.order_id)}
            >
              <Button
                size="small"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                loading={redispatch.isPending}
              >
                Qayta jo'natish
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Segmented
          value={filter}
          onChange={(v) => {
            setFilter(v as string);
            setPage(1);
          }}
          options={[
            { label: "Barchasi", value: "all" },
            { label: "Yuborilmagan", value: "pending" },
            { label: "Xatoli", value: "error" },
            { label: "Yetkazilgan", value: "delivered" },
            {
              label: (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Mismatch
                </span>
              ),
              value: "mismatch",
            },
          ]}
        />
        <Button
          icon={<RefreshCw className="w-4 h-4" />}
          loading={isFetching}
          onClick={() => refetch()}
        >
          Yangilash
        </Button>
      </div>

      <Table<LdgShipmentRow>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.data ?? []}
        scroll={{ x: 1000 }}
        size="small"
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.total ?? 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
};
