import { Modal, Alert, Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { Bot, PencilLine } from "lucide-react";
import { api } from "../../../../../shared/api";

interface Props {
  marketId: string;
  marketName?: string;
  onAi: () => void;
  onManual: () => void;
  onClose: () => void;
}

export default function OrderModeModal({
  marketName,
  onAi,
  onManual,
  onClose,
}: Props) {
  const availQ = useQuery({
    queryKey: ["ai-availability"],
    queryFn: () => api.get("order/ai-availability").then((r) => r.data),
  });
  const avail = availQ.data as
    | { available: boolean; reason?: string; balance?: number; price?: number }
    | undefined;

  return (
    <Modal
      title={`Buyurtma yaratish${marketName ? ` — ${marketName}` : ""}`}
      open
      onCancel={onClose}
      footer={null}
    >
      {availQ.isLoading ? (
        <div className="py-8 text-center">
          <Spin />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Buyurtmani qanday yaratamiz?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {avail?.available && (
              <button
                onClick={onAi}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-purple-200 dark:border-purple-800 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all cursor-pointer"
              >
                <Bot className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                <span className="font-semibold text-gray-800 dark:text-white">
                  AI orqali
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Matn yozing — AI to'ldiradi
                </span>
              </button>
            )}
            <button
              onClick={onManual}
              className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"
            >
              <PencilLine className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-gray-800 dark:text-white">
                Qo'lda to'ldirish
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
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
      )}
    </Modal>
  );
}
