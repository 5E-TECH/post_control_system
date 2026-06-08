import { useState } from "react";
import {
  Table,
  Tag,
  Button,
  Segmented,
  Modal,
  Tooltip,
  message,
  Popconfirm,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { RotateCcw, RefreshCw, Code2, Trash2 } from "lucide-react";
import {
  useLdgAdmin,
  type LdgWebhookLog,
} from "../../../shared/api/hooks/useLdgAdmin";

const statusColor = (status: string): string => {
  switch (status) {
    case "success":
      return "green";
    case "skipped":
      return "orange";
    case "failed":
      return "red";
    case "invalid_signature":
      return "magenta";
    default:
      return "default";
  }
};

export const LdgWebhookLogsTab = () => {
  const { getWebhookLogs, reprocessWebhook, deleteWebhookLog } = useLdgAdmin();
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [payloadView, setPayloadView] = useState<LdgWebhookLog | null>(null);
  const limit = 20;

  const { data, isLoading, isFetching, refetch } = getWebhookLogs({
    page,
    limit,
    status: status === "all" ? undefined : status,
  });

  const handleReprocess = async (deliveryId: string) => {
    try {
      const result = await reprocessWebhook.mutateAsync(deliveryId);
      message.info(result.message);
    } catch {
      message.error("Qayta ishlashda xatolik");
    }
  };

  const handleDelete = async (deliveryId: string) => {
    try {
      const result = await deleteWebhookLog.mutateAsync(deliveryId);
      result.success ? message.success(result.message) : message.warning(result.message);
    } catch {
      message.error("O'chirishda xatolik");
    }
  };

  const columns: ColumnsType<LdgWebhookLog> = [
    {
      title: "Vaqt",
      dataIndex: "received_at",
      key: "received_at",
      render: (v: number) => (
        <span className="text-xs">
          {new Date(v).toLocaleString("uz-UZ")}
        </span>
      ),
    },
    {
      title: "Event",
      dataIndex: "event_type",
      key: "event_type",
      render: (v: string) => <span className="font-mono text-xs">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: "Imzo",
      dataIndex: "signature_valid",
      key: "signature_valid",
      render: (v: boolean) =>
        v ? <Tag color="green">valid</Tag> : <Tag color="red">invalid</Tag>,
    },
    {
      title: "Xato",
      dataIndex: "error_message",
      key: "error_message",
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span className="text-red-500 text-xs line-clamp-2 max-w-[220px] inline-block">
              {v}
            </span>
          </Tooltip>
        ) : (
          "—"
        ),
    },
    {
      title: "Amal",
      key: "action",
      fixed: "right",
      render: (_: unknown, row) => (
        <div className="flex gap-1.5">
          <Button
            size="small"
            icon={<Code2 className="w-3.5 h-3.5" />}
            onClick={() => setPayloadView(row)}
          >
            Payload
          </Button>
          <Popconfirm
            title="Qayta ishlash"
            description="Bu webhookni saqlangan payload asosida qayta ishlashni xohlaysizmi?"
            okText="Ha"
            cancelText="Yo'q"
            onConfirm={() => handleReprocess(row.delivery_id)}
          >
            <Button
              size="small"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              loading={reprocessWebhook.isPending}
            >
              Qayta ishlash
            </Button>
          </Popconfirm>
          <Popconfirm
            title="O'chirish"
            description="Bu webhook log yozuvini o'chirishni xohlaysizmi?"
            okText="Ha, o'chir"
            cancelText="Yo'q"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(row.delivery_id)}
          >
            <Button
              size="small"
              danger
              icon={<Trash2 className="w-3.5 h-3.5" />}
              loading={deleteWebhookLog.isPending}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Segmented
          value={status}
          onChange={(v) => {
            setStatus(v as string);
            setPage(1);
          }}
          options={[
            { label: "Barchasi", value: "all" },
            { label: "Success", value: "success" },
            { label: "Skipped", value: "skipped" },
            { label: "Invalid signature", value: "invalid_signature" },
            { label: "Failed", value: "failed" },
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

      <Table<LdgWebhookLog>
        rowKey="delivery_id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.data ?? []}
        scroll={{ x: 900 }}
        size="small"
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.total ?? 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />

      <Modal
        title={
          <span className="flex items-center gap-2">
            <Code2 className="w-4 h-4" /> Webhook payload
          </span>
        }
        open={!!payloadView}
        onCancel={() => setPayloadView(null)}
        footer={null}
        width={700}
      >
        {payloadView && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">
              delivery_id:{" "}
              <span className="font-mono">{payloadView.delivery_id}</span>
            </div>
            <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-auto max-h-[400px]">
              {JSON.stringify(payloadView.raw_payload, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
};
