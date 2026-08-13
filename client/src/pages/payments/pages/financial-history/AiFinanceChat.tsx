import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFinancialAI } from "../../../../shared/api/hooks/useFinancialAI";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  X,
  Maximize2,
  Minimize2,
  Paperclip,
  FileSpreadsheet,
  Image as ImageIcon,
} from "lucide-react";
import AiResponseRenderer from "./AiResponseRenderer";

type Msg = { role: "user" | "ai"; text: string; tools?: string[]; file?: string };

const SUGGESTIONS = [
  "Shu oy sof foydam qancha?",
  "Xarajatni qaysi kategoriya bo'yicha kamaytirsam bo'ladi?",
  "Oxirgi 3 oy foyda trendi qanday?",
  "Bu Excelni platforma bilan solishtir, farqni top",
];

const ACCEPT = "image/*,.xlsx,.xls,.csv";

// Pastki-o'ng suzuvchi Elchin: dumaloq FAB + ochiluvchi (kattalashtiriladigan)
// chat oynasi. Rasm/Excel biriktirib tahlil qildirish mumkin.
const AiFinanceChat: React.FC = () => {
  const { askFinance, analyzeFile } = useFinancialAI();
  const [open, setOpen] = useState(false);
  const [maxed, setMaxed] = useState(false);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = askFinance.isPending || analyzeFile.isPending;

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pending, open]);

  const pushAi = (res: any) => {
    const d = res?.data;
    setMsgs((m) => [
      ...m,
      { role: "ai", text: d?.answer || "Javob topilmadi.", tools: d?.toolsUsed || [] },
    ]);
  };
  const pushErr = () =>
    setMsgs((m) => [
      ...m,
      { role: "ai", text: "Xatolik yuz berdi. Qayta urinib ko'ring." },
    ]);

  const send = (override?: string) => {
    const text = (override ?? q).trim();
    const f = file;
    if ((!text && !f) || pending) return;
    setMsgs((m) => [
      ...m,
      { role: "user", text: text || "Faylni tahlil qil", file: f?.name },
    ]);
    setQ("");
    setFile(null);

    if (f) {
      const form = new FormData();
      form.append("file", f);
      if (text) form.append("question", text);
      analyzeFile.mutate(form, { onSuccess: pushAi, onError: pushErr });
    } else {
      askFinance.mutate(
        { question: text },
        { onSuccess: pushAi, onError: pushErr },
      );
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      setMsgs((m) => [
        ...m,
        { role: "ai", text: "Fayl juda katta (maks. 15MB)." },
      ]);
    } else {
      setFile(f);
    }
    e.target.value = "";
  };

  const boxClass = maxed
    ? "fixed inset-0 m-auto z-40 w-[95vw] max-w-[1000px] h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50 shadow-2xl overflow-hidden"
    : "fixed z-40 flex flex-col rounded-2xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50 shadow-2xl overflow-hidden bottom-24 right-6 w-[400px] max-w-[calc(100vw-3rem)] h-[70vh] max-h-[600px] max-[650px]:bottom-40 max-[650px]:left-3 max-[650px]:right-3 max-[650px]:w-auto max-[650px]:h-[65vh]";

  return (
    <>
      {/* ===== FAB (pastki-o'ng, fix, dumaloq) ===== */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Elchin — moliyaviy AI yordamchingiz"
        className="fixed bottom-6 right-6 max-[650px]:bottom-24 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <Sparkles className="w-6 h-6" />
            <span className="absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-40 animate-ping" />
          </>
        )}
      </button>

      {/* ===== Chat popup ===== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ transformOrigin: "bottom right" }}
            className={boxClass}
          >
            {/* Sarlavha */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Elchin</h3>
                  <p className="text-[11px] text-white/70">
                    Moliyaviy AI maslahatchingiz
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMaxed((v) => !v)}
                  title={maxed ? "Kichraytirish" : "Kattalashtirish"}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                >
                  {maxed ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Xabarlar */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {msgs.length === 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Savol bering, yoki rasm/Excel biriktiring:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-xs text-left px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 transition-colors"
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
                    className={`rounded-2xl px-3.5 py-2 ${
                      m.role === "user"
                        ? "max-w-[80%] bg-purple-600 text-white rounded-br-sm text-sm whitespace-pre-wrap"
                        : `${maxed ? "max-w-[75%]" : "max-w-[88%]"} bg-gray-100 dark:bg-gray-800 rounded-bl-sm`
                    }`}
                  >
                    {m.file && (
                      <div className="mb-1 flex items-center gap-1 text-[11px] opacity-80">
                        <Paperclip className="w-3 h-3" /> {m.file}
                      </div>
                    )}
                    {m.role === "ai" ? (
                      <AiResponseRenderer text={m.text} />
                    ) : (
                      m.text
                    )}
                    {m.tools && m.tools.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.tools.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400"
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

              {pending && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="rounded-2xl px-3.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {analyzeFile.isPending ? "Faylni tahlil qilyapman..." : "Tahlil qilyapman..."}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Biriktirilgan fayl preview */}
            {file && (
              <div className="px-3 pt-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="w-4 h-4 shrink-0" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-purple-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => setFile(null)}
                    className="p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-800/40"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Kiritish */}
            <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-100 dark:border-gray-700/50">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                onChange={onPick}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Rasm yoki Excel biriktirish"
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={
                  file ? "Fayl haqida so'rov yozing..." : "Savolingizni yozing..."
                }
                className="flex-1 resize-none max-h-28 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => send()}
                disabled={(!q.trim() && !file) || pending}
                className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AiFinanceChat;
