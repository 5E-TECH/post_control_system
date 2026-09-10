import { useState } from "react";
import { Button, Card, Input, Modal, Table, Tag, Tooltip, message } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCcwDot,
  RotateCcw,
  Send,
  ShieldOff,
  XCircle,
} from "lucide-react";
import FilterPills from "../FilterPills";
import {
  useElchiAdmin,
  type ElchiShipmentFilter,
  type ElchiShipmentRow,
} from "../../../../shared/api/hooks/useElchiAdmin";

const money = (v: unknown) =>
  `${Math.round(Number(v ?? 0)).toLocaleString("uz-UZ")}`;

const when = (ts?: number | null) =>
  ts ? new Date(ts).toLocaleString("uz-UZ") : "—";

/**
 * Jo'natmalar — Elchi'ga uzatilgan buyurtmalar ro'yxati.
 *
 * Filtr pillalari operatorning kunlik savollariga mos: "nima yetmadi?"
 * (xato), "nima hali navbatda?" (kutilmoqda), "qayerda pul farqi bor?"
 * (nomuvofiqlik).
 */
export const ElchiShipmentsTab = () => {
  const {
    useShipments,
    useStats,
    redispatch,
    syncOne,
    resolveMismatch,
    reclaimControl,
  } = useElchiAdmin();

  const [filter, setFilter] = useState<ElchiShipmentFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: stats } = useStats();
  const { data, isLoading, refetch, isRefetching } = useShipments({
    page,
    limit: 20,
    filter,
    search: search.trim() || undefined,
  });

  const rows = data?.data ?? [];

  const act = async (
    fn: () => Promise<unknown>,
    okText: string,
  ): Promise<void> => {
    try {
      await fn();
      message.success(okText);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Amal bajarilmadi");
    }
  };

  /**
   * Boshqaruvni qaytarib olish — ZAXIRA yo'li.
   *
   * Tasdiq oynasi ataylab: bu amal Elchi'dagi posilkani BEKOR qiladi va
   * buyurtmani BeePostga qaytaradi. Tasodifan bosilsa jonli yetkazish
   * to'xtardi.
   */
  const handleReclaim = (row: ElchiShipmentRow) => {
    Modal.confirm({
      title: "Boshqaruvni qaytarib olish",
      icon: <ShieldOff className="w-5 h-5 text-red-500" />,
      content: (
        <div className="space-y-2 text-sm">
          <p>
            Buyurtma <b>#{row.order_number ?? row.order_id.slice(0, 8)}</b>{" "}
            Elchi'dan qaytariladi.
          </p>
          <p>
            Avval Elchi'dagi posilka <b>bekor qilinadi</b>. Bekor qilib
            bo'lmasa (masalan allaqachon yetkazilgan) amal <b>rad etiladi</b> —
            aks holda buyurtma ikki tizimda bir vaqtda faol bo'lib, ikki marta
            sotilishi mumkin edi.
          </p>
        </div>
      ),
      okText: "Qaytarib olish",
      okButtonProps: { danger: true },
      cancelText: "Bekor qilish",
      onOk: () =>
        act(
          () => reclaimControl.mutateAsync({ orderId: row.order_id }),
          "Boshqaruv BeePostga qaytarildi",
        ),
    });
  };

  return (
    <div className="space-y-4">
      <Card
        title="Jo'natmalar"
        extra={
          <div className="flex gap-2">
            <Input.Search
              allowClear
              placeholder="Buyurtma raqami, telefon yoki posilka id"
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
          value={filter}
          onChange={(v) => {
            setFilter(v as ElchiShipmentFilter);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Hammasi", count: stats?.shipments.total },
            {
              value: "pending",
              label: "Kutilmoqda",
              count: stats?.shipments.pending,
              icon: <Clock className="w-3.5 h-3.5" />,
            },
            {
              value: "error",
              label: "Xato",
              count: stats?.shipments.failed,
              icon: <XCircle className="w-3.5 h-3.5" />,
              activeClass: "bg-red-600 text-white border-red-600",
            },
            {
              value: "delivered",
              label: "Yetkazilgan",
              icon: <CheckCircle2 className="w-3.5 h-3.5" />,
              activeClass: "bg-green-600 text-white border-green-600",
            },
            {
              value: "mismatch",
              label: "Nomuvofiqlik",
              count: stats?.shipments.mismatch,
              icon: <AlertTriangle className="w-3.5 h-3.5" />,
              activeClass: "bg-orange-500 text-white border-orange-500",
            },
          ]}
        />

        <Table<ElchiShipmentRow>
          className="mt-3"
          rowKey="id"
          size="small"
          scroll={{ x: 1100 }}
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
              title: "Buyurtma",
              width: 150,
              render: (_: unknown, r) => (
                <div>
                  <div className="font-semibold">
                    #{r.order_number ?? r.order_id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-gray-400">{r.market_name}</div>
                </div>
              ),
            },
            {
              title: "Mijoz",
              width: 180,
              render: (_: unknown, r) => (
                <div>
                  <div>{r.customer_name ?? "—"}</div>
                  <div className="text-xs text-gray-400">
                    {r.customer_phone ?? ""}
                  </div>
                </div>
              ),
            },
            {
              title: "Hudud",
              width: 160,
              render: (_: unknown, r) =>
                `${r.region_name ?? "—"}${
                  r.district_name ? `, ${r.district_name}` : ""
                }`,
            },
            {
              title: "Elchi holati",
              width: 160,
              render: (_: unknown, r) => (
                <div className="space-y-1">
                  {r.elchi_shipment_id ? (
                    <Tag color="blue">{r.elchi_status ?? "yuborilgan"}</Tag>
                  ) : r.last_error ? (
                    <Tag color="red">yetmadi</Tag>
                  ) : (
                    <Tag>navbatda</Tag>
                  )}
                  {r.control_owner === "elchi" && (
                    <Tooltip title="Buyurtma Elchi boshqaruvida — BeePostda sotish/bekor bloklangan">
                      <Tag color="purple">boshqaruv: Elchi</Tag>
                    </Tooltip>
                  )}
                  {!!r.mismatch_at && (
                    <Tooltip title={r.mismatch_reason ?? ""}>
                      <Tag color="orange">nomuvofiqlik</Tag>
                    </Tooltip>
                  )}
                </div>
              ),
            },
            {
              title: "Pul (jo'natilgan → yig'ilgan)",
              width: 190,
              render: (_: unknown, r) => (
                <div className="text-sm">
                  <span>{money(r.cod_amount_sent)}</span>
                  <span className="text-gray-400"> → </span>
                  <span
                    className={
                      r.cod_collected_reported == null
                        ? "text-gray-400"
                        : "font-semibold"
                    }
                  >
                    {r.cod_collected_reported == null
                      ? "—"
                      : money(r.cod_collected_reported)}
                  </span>
                </div>
              ),
            },
            {
              title: "Oxirgi sinxron",
              width: 160,
              render: (_: unknown, r) => (
                <span className="text-xs">{when(r.last_synced_at)}</span>
              ),
            },
            {
              title: "Xato",
              width: 220,
              render: (_: unknown, r) =>
                r.last_error ? (
                  <Tooltip title={r.last_error}>
                    <span className="text-xs text-red-500 line-clamp-2">
                      {r.last_error}
                    </span>
                  </Tooltip>
                ) : (
                  <span className="text-gray-300">—</span>
                ),
            },
            {
              title: "Amallar",
              width: 190,
              fixed: "right",
              render: (_: unknown, r) => (
                <div className="flex flex-wrap gap-1">
                  {!r.elchi_shipment_id && (
                    <Tooltip title="Elchi'ga qayta jo'natish (idempotent)">
                      <Button
                        size="small"
                        icon={<Send className="w-3.5 h-3.5" />}
                        loading={redispatch.isPending}
                        onClick={() =>
                          act(
                            () => redispatch.mutateAsync(r.order_id),
                            "Qayta jo'natildi",
                          )
                        }
                      />
                    </Tooltip>
                  )}
                  {!!r.elchi_shipment_id && (
                    <Tooltip title="Elchi bilan tenglashtirish">
                      <Button
                        size="small"
                        icon={<RefreshCcwDot className="w-3.5 h-3.5" />}
                        loading={syncOne.isPending}
                        onClick={() =>
                          act(
                            () => syncOne.mutateAsync(r.order_id),
                            "Tenglashtirildi",
                          )
                        }
                      />
                    </Tooltip>
                  )}
                  {!!r.mismatch_at && (
                    <Tooltip title="Nomuvofiqlikni yopish (pulga tegmaydi)">
                      <Button
                        size="small"
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        loading={resolveMismatch.isPending}
                        onClick={() =>
                          act(
                            () => resolveMismatch.mutateAsync(r.order_id),
                            "Nomuvofiqlik yopildi",
                          )
                        }
                      />
                    </Tooltip>
                  )}
                  {r.control_owner === "elchi" && (
                    <Tooltip title="Boshqaruvni BeePostga qaytarib olish">
                      <Button
                        size="small"
                        danger
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => handleReclaim(r)}
                      />
                    </Tooltip>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ElchiShipmentsTab;
