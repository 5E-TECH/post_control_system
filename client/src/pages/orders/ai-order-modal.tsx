import { useState } from "react";
import { Modal, Button, Input, Select, message, Alert, Spin } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { Bot } from "lucide-react";
import { api } from "../../shared/api";
import type { RootState } from "../../app/store";

const som = (n: number) =>
  (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

interface AiResult {
  ok: boolean;
  reason?: string;
  order?: unknown;
  balance?: number;
  price?: number;
  missing?: string[];
  draft?: {
    customer_name?: string;
    phone_number?: string;
    district_label?: string;
    district_resolved?: boolean;
    items?: {
      name: string;
      quantity: number;
      resolved?: boolean;
      resolved_name?: string;
    }[];
    total_price?: number;
  };
}

function reasonText(r?: string): string {
  switch (r) {
    case "ai_off":
      return "AI sozlanmagan (ANTHROPIC_API_KEY yo'q).";
    case "no_market":
      return "Marketni tanlang.";
    case "disabled":
      return "Bu market uchun AI yoqilmagan.";
    case "insufficient":
      return "Market AI balansi yetarli emas.";
    case "ai_error":
      return "AI matnni o'qiy olmadi. Qayta urinib ko'ring.";
    case "incomplete":
      return "Ma'lumot to'liq emas — quyidagilarni aniqlashtiring:";
    default:
      return "Xatolik.";
  }
}

function AiOrderModalContent({ onDone }: { onDone: () => void }) {
  const role = useSelector((state: RootState) => state.roleSlice.role);
  const isAdmin =
    role === "admin" || role === "superadmin" || role === "registrator";

  const qc = useQueryClient();
  const [marketId, setMarketId] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);

  // Marketlar ro'yxati (faqat admin uchun tanlov)
  const marketsQ = useQuery({
    queryKey: ["ai-order-markets"],
    enabled: isAdmin,
    queryFn: () =>
      api
        .get("user", { params: { role: "market", limit: 1000, page: 1 } })
        .then((r) => r.data?.data?.data ?? []),
  });

  const createM = useMutation({
    mutationFn: () =>
      api
        .post("order/ai-create", {
          text: text.trim(),
          market_id: isAdmin ? marketId : undefined,
        })
        .then((r) => r.data as AiResult),
    onSuccess: (data) => {
      setResult(data);
      if (data.ok) {
        message.success("✅ Buyurtma yaratildi");
        qc.invalidateQueries();
        onDone();
      }
    },
    onError: () => message.error("Server xatosi. Qayta urinib ko'ring."),
  });

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Market</div>
          <Select
            showSearch
            placeholder="Marketni tanlang"
            style={{ width: "100%" }}
            loading={marketsQ.isLoading}
            value={marketId}
            onChange={setMarketId}
            optionFilterProp="label"
            options={(marketsQ.data ?? []).map((m: any) => ({
              value: m.id,
              label: m.name,
            }))}
          />
        </div>
      )}

      <div>
        <div className="text-xs text-gray-500 mb-1">Buyurtma matni</div>
        <Input.TextArea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mijoz, telefon, tuman, mahsulotlar, narx... (masalan: Dilnoza, 901112233, Toshkent Chilonzor, 2 dona olma, 150 ming)"
        />
      </div>

      <Button
        type="primary"
        block
        loading={createM.isPending}
        disabled={!text.trim() || (isAdmin && !marketId)}
        onClick={() => {
          setResult(null);
          createM.mutate();
        }}
      >
        🤖 AI bilan yaratish
      </Button>

      {createM.isPending && (
        <div className="text-center py-2">
          <Spin size="small" /> <span className="text-xs">Tahlil qilinyapti...</span>
        </div>
      )}

      {result && !result.ok && (
        <Alert
          type={result.reason === "incomplete" ? "warning" : "error"}
          message={reasonText(result.reason)}
          description={
            <div className="text-xs space-y-1">
              {result.missing?.length ? (
                <div>Yetishmayapti: {result.missing.join(", ")}</div>
              ) : null}
              {result.draft?.items?.some((i) => !i.resolved) && (
                <div>
                  Katalogda topilmagan:{" "}
                  {result.draft.items
                    .filter((i) => !i.resolved)
                    .map((i) => i.name)
                    .join(", ")}
                </div>
              )}
              {result.draft && result.draft.district_resolved === false && (
                <div>Tuman aniqlanmadi.</div>
              )}
              {result.reason === "insufficient" &&
                result.balance != null &&
                result.price != null && (
                  <div>
                    Balans: {som(result.balance)} so'm, kerak: {som(result.price)}{" "}
                    so'm.
                  </div>
                )}
            </div>
          }
        />
      )}
    </div>
  );
}

export default function AiOrderButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="primary"
        icon={<Bot className="w-4 h-4" />}
        onClick={() => setOpen(true)}
        className="!flex !items-center gap-1"
      >
        AI buyurtma
      </Button>
      {open && (
        <Modal
          title="🤖 AI orqali buyurtma yaratish"
          open
          onCancel={() => setOpen(false)}
          footer={null}
        >
          <AiOrderModalContent onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
