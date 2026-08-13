import React, { useEffect, useRef, useState } from "react";
import { useFinancialAI } from "../../../../shared/api/hooks/useFinancialAI";
import { Sparkles, Send, Loader2, Bot, User } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string; tools?: string[] };

const SUGGESTIONS = [
  "Shu oy sof foydam qancha?",
  "Eng ko'p qaysi kategoriyaga xarajat qildik?",
  "Hozir kassada qancha pul bor?",
  "Shu yil daromad o'sdimi?",
];

const AiFinanceChat: React.FC = () => {
  const { askFinance } = useFinancialAI();
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, askFinance.isPending]);

  const send = (question: string) => {
    const text = question.trim();
    if (!text || askFinance.isPending) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ("");
    askFinance.mutate(
      { question: text },
      {
        onSuccess: (res: any) => {
          const d = res?.data;
          setMsgs((m) => [
            ...m,
            {
              role: "ai",
              text: d?.answer || "Javob topilmadi.",
              tools: d?.toolsUsed || [],
            },
          ]);
        },
        onError: () =>
          setMsgs((m) => [
            ...m,
            { role: "ai", text: "Xatolik yuz berdi. Qayta urinib ko'ring." },
          ]),
      },
    );
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50 overflow-hidden">
      {/* Sarlavha */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
            Moliyaviy AI yordamchi
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tabiiy tilda savol bering — foyda, xarajat, naqd holat...
          </p>
        </div>
      </div>

      {/* Xabarlar */}
      <div className="max-h-[320px] overflow-y-auto px-5 py-4 space-y-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Masalan:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "ai" && (
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-purple-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-purple-600 text-white rounded-br-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-bl-sm"
              }`}
            >
              {m.text}
              {m.tools && m.tools.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.tools.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-black/20 text-gray-500 dark:text-gray-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {askFinance.isPending && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <div className="rounded-2xl px-3.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> O'ylayapman...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Kiritish */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(q);
            }
          }}
          rows={1}
          placeholder="Savolingizni yozing..."
          className="flex-1 resize-none max-h-28 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={() => send(q)}
          disabled={!q.trim() || askFinance.isPending}
          className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AiFinanceChat;
