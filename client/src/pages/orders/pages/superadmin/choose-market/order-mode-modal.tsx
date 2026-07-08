import { useState } from "react";
import { Modal, Button, Input, message, Alert, Spin } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bot, PencilLine } from "lucide-react";
import { api } from "../../../../../shared/api";
import { buildAdminPath } from "../../../../../shared/const";

const som = (n: number) =>
  (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

interface AiResult {
  ok: boolean;
  reason?: string;
  balance?: number;
  price?: number;
  missing?: string[];
  draft?: {
    district_resolved?: boolean;
    items?: { name: string; resolved?: boolean }[];
  };
}

function reasonText(r?: string): string {
  switch (r) {
    case "ai_off":
      return "AI sozlanmagan.";
    case "no_market":
      return "Market aniqlanmadi.";
    case "disabled":
      return "Bu market uchun AI yoqilmagan.";
    case "insufficient":
      return "AI balansi yetarli emas.";
    case "ai_error":
      return "AI matnni o'qiy olmadi. Qayta urinib ko'ring.";
    case "incomplete":
      return "Ma'lumot to'liq emas — quyidagilarni aniqlashtiring:";
    case "create_failed":
      return "Buyurtma yaratilmadi — market sozlamalarini tekshiring yoki qo'lda to'ldiring. (Pul yechilmadi)";
    default:
      return "Xatolik.";
  }
}

interface Props {
  marketId: string;
  marketName?: string;
  onManual: () => void;
  onClose: () => void;
}

export default function OrderModeModal({
  marketId,
  marketName,
  onManual,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choice" | "ai">("choice");
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);

  const availQ = useQuery({
    queryKey: ["ai-availability"],
    queryFn: () => api.get("order/ai-availability").then((r) => r.data),
  });
  const avail = availQ.data as
    | { available: boolean; reason?: string; balance?: number; price?: number }
    | undefined;

  const createM = useMutation({
    mutationFn: () =>
      api
        .post("order/ai-create", { text: text.trim(), market_id: marketId })
        .then((r) => r.data as AiResult),
    onSuccess: (data) => {
      setResult(data);
      if (data.ok) {
        message.success("✅ Buyurtma yaratildi");
        qc.invalidateQueries();
        onClose();
        navigate(buildAdminPath("orders"));
      }
    },
    onError: () => message.error("Server xatosi. Qayta urinib ko'ring."),
  });

  return (
    <Modal
      title={`Buyurtma yaratish${marketName ? ` — ${marketName}` : ""}`}
      open
      onCancel={onClose}
      footer={null}
    >
      {mode === "choice" ? (
        availQ.isLoading ? (
          <div className="py-8 text-center">
            <Spin />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Buyurtmani qanday yaratamiz?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {avail?.available && (
                <button
                  onClick={() => setMode("ai")}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-purple-200 hover:border-purple-500 hover:bg-purple-50 transition-all cursor-pointer"
                >
                  <Bot className="w-7 h-7 text-purple-600" />
                  <span className="font-semibold text-gray-800">AI orqali</span>
                  <span className="text-xs text-gray-500 text-center">
                    Matn yozing — AI to'ldiradi
                  </span>
                </button>
              )}
              <button
                onClick={onManual}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer"
              >
                <PencilLine className="w-7 h-7 text-indigo-600" />
                <span className="font-semibold text-gray-800">
                  Qo'lda to'ldirish
                </span>
                <span className="text-xs text-gray-500 text-center">
                  Maydonlarni o'zingiz to'ldirasiz
                </span>
              </button>
            </div>
            {!avail?.available && avail?.reason === "insufficient" && (
              <Alert
                type="warning"
                showIcon
                message="AI balansi tugagan — to'lov qilib qayta urinib ko'ring yoki qo'lda to'ldiring."
              />
            )}
            {!avail?.available && avail?.reason === "disabled" && (
              <Alert
                type="info"
                showIcon
                message="Bu market uchun AI yoqilmagan."
              />
            )}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <Input.TextArea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mijoz, telefon, tuman, mahsulotlar, narx... (masalan: Dilnoza, 901112233, Toshkent Chilonzor, 2 dona olma, 150 ming)"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setMode("choice");
                setResult(null);
              }}
            >
              ← Orqaga
            </Button>
            <Button
              type="primary"
              block
              loading={createM.isPending}
              disabled={!text.trim()}
              onClick={() => {
                setResult(null);
                createM.mutate();
              }}
            >
              🤖 AI bilan yaratish
            </Button>
          </div>
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
                      Katalogda topilmadi:{" "}
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
                        Balans: {som(result.balance)} so'm, kerak:{" "}
                        {som(result.price)} so'm.
                      </div>
                    )}
                </div>
              }
            />
          )}
        </div>
      )}
    </Modal>
  );
}
