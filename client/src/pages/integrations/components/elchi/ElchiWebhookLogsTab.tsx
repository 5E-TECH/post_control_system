import { useState } from "react";
import { Button, Card, Input, Modal, Table, Tag, Tooltip, message } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  RefreshCcwDot,
  RotateCw,
  ShieldOff,
  SkipForward,
  XCircle,
} from "lucide-react";
import FilterPills from "../FilterPills";
import {
  useElchiAdmin,
  type ElchiWebhookLogRow,
} from "../../../../shared/api/hooks/useElchiAdmin";

const when = (ts?: number | null) =>
  ts ? new Date(ts).toLocaleString("uz-UZ") : "—";

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  success: { color: "green", label: "ishlandi" },
  failed: { color: "red", label: "xato" },
  skipped: { color: "default", label: "e'tiborsiz" },
  replay: { color: "blue", label: "takror" },
  invalid_signature: { color: "volcano", label: "imzo xato" },
};

/**
 * Webhook jurnali — Elchi'dan kelgan hodisalar.
 *
 * Har bir hodisa `event_id` bo'yicha bir marta ishlanadi. `replay` — Elchi
 * ayni hodisani qayta yuborgani, xato EMAS; `skipped` — posilka topilmagani
 * (masalan boshqa muhitning webhooki).
 */
export const ElchiWebhookLogsTab = () => {
  const { useWebhookLogs, useStats, reprocessWebhook } = useElchiAdmin();

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [payloadRow, setPayloadRow] = useState<ElchiWebhookLogRow | null>(null);

  const { data: stats } = useStats();
  const { data, isLoading, refetch, isRefetching } = useWebhookLogs({
    page,
    limit: 20,
    status,
    search: search.trim() || undefined,
  });

  const rows = data?.data ?? [];

  const handleReprocess = async (row: ElchiWebhookLogRow) => {
    try {
      const res = (await reprocessWebhook.mutateAsync(row.event_id)) as {
        status?: string;
        message?: string;
      };
      message.success(
        `Qayta ishlandi: ${res?.status ?? "—"}${
          res?.message ? ` — ${res.message}` : ""
        }`,
      );
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Qayta ishlashda xatolik");
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Webhook loglar"
        extra={
          <div className="flex gap-2">
            <Input.Search
              allowClear
              placeholder="event_id, buyurtma yoki posilka id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => setPage(1)}
              style={{ width: 300 }}
            />
            <Button
              icon={<RefreshCcwDot className="w-4 h-4" />}
              loading={isRefetching}
              onClick={() => refetch()}
            >
              Yangilash
            </Button>
          </div>
        }
      >
        <FilterPills
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Hammasi", count: stats?.webhooks.total },
            {
              value: "success",
              label: "Ishlandi",
              count: stats?.webhooks.success,
              icon: <CheckCircle2 className="w-3.5 h-3.5" />,
              activeClass: "bg-green-600 text-white border-green-600",
            },
            {
              value: "failed",
              label: "Xato",
              count: stats?.webhooks.failed,
              icon: <XCircle className="w-3.5 h-3.5" />,
              activeClass: "bg-red-600 text-white border-red-600",
            },
            {
              value: "skipped",
              label: "E'tiborsiz",
              icon: <SkipForward className="w-3.5 h-3.5" />,
            },
            {
              value: "replay",
              label: "Takror",
              icon: <RotateCw className="w-3.5 h-3.5" />,
            },
            {
              value: "invalid_signature",
              label: "Imzo xato",
              count: stats?.webhooks.invalid_signature,
              icon: <ShieldOff className="w-3.5 h-3.5" />,
              activeClass: "bg-orange-600 text-white border-orange-600",
            },
          ]}
        />

        <Table<ElchiWebhookLogRow>
          className="mt-3"
          rowKey="event_id"
          size="small"
          scroll={{ x: 1000 }}
          loading={isLoading}
          dataSource={rows}
          pagination={{
            current: data?.page ?? 1,
            pageSize: data?.limit ?? 20,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            {
              title: "Kelgan vaqt",
              width: 165,
              render: (_: unknown, r) => (
                <span className="text-xs">{when(r.received_at)}</span>
              ),
            },
            {
              title: "Holat",
              width: 130,
              render: (_: unknown, r) => {
                const t = STATUS_TAG[r.status] ?? {
                  color: "default",
                  label: r.status,
                };
                return (
                  <div className="space-y-1">
                    <Tag color={t.color}>{t.label}</Tag>
                    {!r.signature_valid && (
                      <Tooltip title="Imzo tekshiruvidan o'tmagan — qayta ishlab bo'lmaydi">
                        <Tag color="volcano">imzo ✗</Tag>
                      </Tooltip>
                    )}
                  </div>
                );
              },
            },
            {
              title: "Elchi holati",
              dataIndex: "elchi_status",
              width: 130,
              render: (v: string | null) => v ?? "—",
            },
            {
              title: "Buyurtma / posilka",
              width: 210,
              render: (_: unknown, r) => (
                <div className="text-xs font-mono">
                  <div>{r.external_order_id?.slice(0, 8) ?? "—"}</div>
                  <div className="text-gray-400">
                    {r.elchi_shipment_id ?? "—"}
                  </div>
                </div>
              ),
            },
            {
              title: "event_id",
              width: 180,
              render: (_: unknown, r) => (
                <div className="text-xs font-mono break-all">
                  {r.event_id.slice(0, 20)}
                  {r.synthesized_key && (
                    <Tooltip title="Elchi `event_id` yubormagan — biz zaxira kalit yasadik. Bu takrorni to'sadi, lekin ikki turli hodisani ajratmasligi mumkin.">
                      <Tag color="gold" className="ml-1">
                        zaxira
                      </Tag>
                    </Tooltip>
                  )}
                </div>
              ),
            },
            {
              title: "Xato",
              width: 200,
              render: (_: unknown, r) =>
                r.error_message ? (
                  <Tooltip title={r.error_message}>
                    <span className="text-xs text-red-500 line-clamp-2">
                      {r.error_message}
                    </span>
                  </Tooltip>
                ) : (
                  <span className="text-gray-300">—</span>
                ),
            },
            {
              title: "Amallar",
              width: 110,
              fixed: "right",
              render: (_: unknown, r) => (
                <div className="flex gap-1">
                  <Tooltip title="Payloadni ko'rish">
                    <Button
                      size="small"
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => setPayloadRow(r)}
                    />
                  </Tooltip>
                  <Tooltip
                    title={
                      !r.signature_valid
                        ? "Imzosi noto'g'ri — qayta ishlab bo'lmaydi"
                        : r.status === "success"
                          ? "Allaqachon ishlangan"
                          : "Qayta ishlash"
                    }
                  >
                    <Button
                      size="small"
                      icon={<RotateCw className="w-3.5 h-3.5" />}
                      disabled={!r.signature_valid || r.status === "success"}
                      loading={reprocessWebhook.isPending}
                      onClick={() => handleReprocess(r)}
                    />
                  </Tooltip>
                </div>
              ),
            },
          ]}
        />

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Imzosi noto'g'ri yozuvlarni qayta ishlab bo'lmaydi: imzo XOM tana
          ustidan tekshiriladi, biz esa faqat parse qilingan JSON'ni saqlaymiz —
          uni qayta imzolash bir xil natija berishiga kafolat yo'q.
        </p>
      </Card>

      <Modal
        open={!!payloadRow}
        title={`Webhook payload — ${payloadRow?.event_id ?? ""}`}
        onCancel={() => setPayloadRow(null)}
        footer={null}
        width={640}
      >
        <pre className="text-xs bg-gray-50 dark:bg-gray-900/60 p-3 rounded-lg overflow-auto max-h-[60vh]">
          {JSON.stringify(payloadRow?.raw_payload ?? {}, null, 2)}
        </pre>
      </Modal>
    </div>
  );
};

export default ElchiWebhookLogsTab;
