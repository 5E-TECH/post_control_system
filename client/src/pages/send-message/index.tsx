import React, { useState } from "react";
import { Alert, Button, Input, Modal, message } from "antd";
import { useMutation } from "@tanstack/react-query";
import { Megaphone, Send, Bot } from "lucide-react";
import { api } from "../../shared/api";

const MAX_LEN = 4000;

// Yangi AI funksiyasi haqida tayyor e'lon (bir tugma bilan to'ldirish uchun).
const AI_TEMPLATE = `🎉 Yangilik! Endi bot orqali buyurtmani MATN bilan yaratishingiz mumkin!

Shunchaki buyurtma ma'lumotini yozib yuboring (mijoz ismi, telefon, manzil, mahsulot, narx) — AI o'zi tahlil qilib, tayyor karta qaytaradi.

Kamchilik bo'lsa "✏️ Tuzatish" tugmasi orqali shu yerda to'g'rilaysiz, so'ng "✅ Yaratish" bilan tasdiqlaysiz.

Sinab ko'ring! 🤖`;

interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
}

const SendMessage: React.FC = () => {
  const [text, setText] = useState("");
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const sendM = useMutation({
    mutationFn: (msg: string) =>
      api.post("bot-broadcast", { message: msg }).then((r) => r.data),
    onSuccess: (r) => {
      const data = (r?.data || {}) as BroadcastResult;
      setResult(data);
      message.success(
        `E'lon yuborildi: ${data.sent} ta / ${data.total} ta foydalanuvchi`
      );
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Yuborishda xatolik";
      message.error(msg);
    },
  });

  const handleSend = () => {
    const msg = text.trim();
    if (!msg) {
      message.warning("Xabar matnini yozing");
      return;
    }
    Modal.confirm({
      title: "E'lonni yuborishni tasdiqlang",
      icon: <Megaphone className="w-5 h-5 text-purple-600" />,
      content: (
        <div className="text-sm">
          <p className="mb-2 text-gray-600 dark:text-gray-300">
            Ushbu xabar <b>botda ro'yxatdan o'tgan BARCHA foydalanuvchilarga</b>{" "}
            (marketlar + operatorlar) yuboriladi. Bu amalni qaytarib bo'lmaydi.
          </p>
          <div className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-gray-800 dark:text-gray-100 max-h-48 overflow-auto">
            {msg}
          </div>
        </div>
      ),
      okText: "Ha, yuborish",
      cancelText: "Bekor",
      okButtonProps: { danger: false },
      onOk: () => sendM.mutateAsync(msg),
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
          <Megaphone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">
            Bildirishnomalar
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Foydalanuvchilarga xabar yuborish (hozircha Telegram bot orqali)
          </p>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="Xabar marketlar va operatorlarga (Telegram bot orqali ulanganlarga) yuboriladi. Foydalanuvchiga /start berish shart emas."
      />

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Xabar matni
          </label>
          <Button
            size="small"
            icon={<Bot className="w-3.5 h-3.5" />}
            onClick={() => setText(AI_TEMPLATE)}
          >
            AI e'loni namunasi
          </Button>
        </div>

        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          placeholder="Foydalanuvchilarga yubormoqchi bo'lgan e'lon matnini yozing…"
          autoSize={{ minRows: 6, maxRows: 16 }}
          maxLength={MAX_LEN}
          showCount
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button onClick={() => setText("")} disabled={!text}>
            Tozalash
          </Button>
          <Button
            type="primary"
            icon={<Send className="w-4 h-4" />}
            loading={sendM.isPending}
            onClick={handleSend}
          >
            Yuborish
          </Button>
        </div>
      </div>

      {result && (
        <Alert
          type={result.failed ? "warning" : "success"}
          showIcon
          className="mt-4"
          message={`Yuborildi: ${result.sent} ta / ${result.total} ta${
            result.failed ? ` — ${result.failed} ta yetkazilmadi (bloklagan)` : ""
          }`}
        />
      )}
    </div>
  );
};

export default React.memo(SendMessage);
