import { useState } from "react";
import { Modal, Switch, InputNumber, Button, message, Spin, Tag, Empty } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { api } from "../../../../shared/api";

interface MarketLite {
  id: string;
  name?: string;
  role?: string;
}

const som = (n: number) =>
  (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function AiBalanceContent({ marketId }: { marketId: string }) {
  const qc = useQueryClient();
  const stateQ = useQuery({
    queryKey: ["ai-balance", marketId],
    queryFn: () => api.get(`ai-balance/${marketId}`).then((r) => r.data.data),
  });
  const historyQ = useQuery({
    queryKey: ["ai-balance-history", marketId],
    queryFn: () =>
      api.get(`ai-balance/${marketId}/history`).then((r) => r.data.data),
  });

  const [topup, setTopup] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ai-balance", marketId] });
    qc.invalidateQueries({ queryKey: ["ai-balance-history", marketId] });
  };

  const toggleM = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch(`ai-balance/${marketId}/toggle`, { enabled }),
    onSuccess: (r) => {
      message.success(r.data?.message || "OK");
      refresh();
    },
    onError: () => message.error("Xatolik"),
  });
  const topupM = useMutation({
    mutationFn: (amount: number) =>
      api.post(`ai-balance/${marketId}/topup`, { amount }),
    onSuccess: () => {
      message.success("Balans to'ldirildi");
      setTopup(null);
      refresh();
    },
    onError: () => message.error("Xatolik"),
  });
  const priceM = useMutation({
    mutationFn: (p: number) =>
      api.patch(`ai-balance/${marketId}/price`, { price: p }),
    onSuccess: () => {
      message.success("Narx yangilandi");
      refresh();
    },
    onError: () => message.error("Xatolik"),
  });

  if (stateQ.isLoading)
    return (
      <div className="py-8 text-center">
        <Spin />
      </div>
    );

  const s = stateQ.data as
    | { enabled: boolean; balance: number; price: number }
    | null;
  if (!s) return <Empty description="Ma'lumot topilmadi" />;

  const history = Array.isArray(historyQ.data) ? historyQ.data : [];

  return (
    <div className="space-y-4">
      {/* Holat */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div>
          <div className="text-xs text-gray-500 mb-1">AI holati</div>
          <Tag color={s.enabled ? "green" : "red"}>
            {s.enabled ? "Yoqilgan" : "O'chirilgan"}
          </Tag>
        </div>
        <Switch
          checked={s.enabled}
          loading={toggleM.isPending}
          onChange={(c) => toggleM.mutate(c)}
        />
      </div>

      {/* Balans */}
      <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
        <div className="text-xs text-gray-500">Balans</div>
        <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
          {som(s.balance)} so'm
        </div>
      </div>

      {/* To'ldirish */}
      <div>
        <div className="text-xs text-gray-500 mb-1">
          Balansni to'ldirish (to'lov kelganda)
        </div>
        <div className="flex gap-2">
          <InputNumber
            min={1}
            value={topup ?? undefined}
            onChange={(v) => setTopup((v as number) ?? null)}
            placeholder="Summa (so'm)"
            style={{ width: "100%" }}
          />
          <Button
            type="primary"
            loading={topupM.isPending}
            disabled={!topup}
            onClick={() => topup && topupM.mutate(topup)}
          >
            Qo'shish
          </Button>
        </div>
      </div>

      {/* Narx */}
      <div>
        <div className="text-xs text-gray-500 mb-1">
          Bir buyurtma narxi (hozir: {som(s.price)} so'm)
        </div>
        <div className="flex gap-2">
          <InputNumber
            min={0}
            value={price ?? undefined}
            onChange={(v) => setPrice((v as number) ?? null)}
            placeholder="Yangi narx"
            style={{ width: "100%" }}
          />
          <Button
            loading={priceM.isPending}
            disabled={price == null}
            onClick={() => price != null && priceM.mutate(price)}
          >
            Saqlash
          </Button>
        </div>
      </div>

      {/* Tarix */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Tarix</div>
        <div className="max-h-52 overflow-auto rounded-lg border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {history.length === 0 ? (
            <div className="p-3 text-center text-xs text-gray-400">
              Hozircha yo'q
            </div>
          ) : (
            history.map((tx: any) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="flex items-center gap-1 min-w-0">
                  <Tag
                    color={
                      tx.type === "topup"
                        ? "green"
                        : tx.type === "refund"
                          ? "blue"
                          : "orange"
                    }
                  >
                    {tx.type}
                  </Tag>
                  <span className="truncate text-gray-500 text-xs">
                    {tx.note}
                  </span>
                </span>
                <span
                  className={`whitespace-nowrap ${
                    tx.type === "usage" ? "text-red-500" : "text-green-600"
                  }`}
                >
                  {tx.type === "usage" ? "−" : "+"}
                  {som(tx.amount)} → {som(tx.balance_after)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AiBalanceButton({ user }: { user: MarketLite }) {
  const [open, setOpen] = useState(false);
  if (user?.role !== "market") return null;
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="AI balans"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
      >
        <Bot className="w-4 h-4" />
      </button>
      <Modal
        title={`🤖 AI balans — ${user.name || ""}`}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        {open && <AiBalanceContent marketId={user.id} />}
      </Modal>
    </>
  );
}
