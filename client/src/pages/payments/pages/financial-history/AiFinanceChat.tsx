import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFinancialAI } from "../../../../shared/api/hooks/useFinancialAI";
import {
  Sparkles,
  Send,
  Bot,
  User,
  X,
  Maximize2,
  Minimize2,
  Paperclip,
  FileSpreadsheet,
  Image as ImageIcon,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import AiResponseRenderer from "./AiResponseRenderer";

type Msg = {
  role: "user" | "ai";
  text: string;
  tools?: string[];
  file?: string;
  at?: number;
};

const SUGGESTIONS = [
  "Shu oy sof foydam qancha?",
  "Xarajatni qaysi kategoriya bo'yicha kamaytiray?",
  "Oxirgi 3 oy foyda trendi qanday?",
  "Excelni platforma bilan solishtir, farqni top",
];

const ACCEPT = "image/*,.xlsx,.xls,.csv";

const fmtTime = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

// Uch sakraydigan nuqta — "yozyapti" indikatori.
const TypingDots: React.FC = () => (
  <span className="flex gap-1 items-center py-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </span>
);

// Pastki-o'ng suzuvchi Elchin: dumaloq FAB + ochiluvchi (kattalashtiriladigan)
// chat oynasi. Rasm/Excel tahlil, DB tarix, boy javob.
const AiFinanceChat: React.FC = () => {
  const { askFinance, analyzeFile, getChatHistory, clearChatHistory } =
    useFinancialAI();
  const [open, setOpen] = useState(false);
  const [maxed, setMaxed] = useState(false);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const pending = askFinance.isPending || analyzeFile.isPending;

  // Yozishmalar tarixini ochilganда bir marta DB'дан yuklaymiz.
  const { data: histData } = getChatHistory(open && !loadedHistory);
  useEffect(() => {
    if (!open || loadedHistory || !histData?.data) return;
    const restored: Msg[] = [];
    for (const ex of histData.data as any[]) {
      restored.push({
        role: "user",
        text: ex.question,
        file: ex.file_name || undefined,
        at: ex.created_at,
      });
      restored.push({
        role: "ai",
        text: ex.answer,
        tools: ex.tools || [],
        at: ex.created_at,
      });
    }
    setMsgs(restored);
    setLoadedHistory(true);
  }, [open, loadedHistory, histData]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pending, open]);

  // Rasm biriktirilsa eskiz (thumbnail) URL.
  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const grow = () => {
    const el = taRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const pushAi = (res: any) => {
    const d = res?.data;
    setMsgs((m) => [
      ...m,
      {
        role: "ai",
        text: d?.answer || "Javob topilmadi.",
        tools: d?.toolsUsed || [],
        at: Date.now(),
      },
    ]);
  };
  const pushErr = () =>
    setMsgs((m) => [
      ...m,
      { role: "ai", text: "Xatolik yuz berdi. Qayta urinib ko'ring.", at: Date.now() },
    ]);

  const send = (override?: string) => {
    const text = (override ?? q).trim();
    const f = file;
    if ((!text && !f) || pending) return;
    setMsgs((m) => [
      ...m,
      { role: "user", text: text || "Faylni tahlil qil", file: f?.name, at: Date.now() },
    ]);
    setQ("");
    setFile(null);
    setTimeout(grow, 0);

    if (f) {
      const form = new FormData();
      form.append("file", f);
      if (text) form.append("question", text);
      analyzeFile.mutate(form, { onSuccess: pushAi, onError: pushErr });
    } else {
      askFinance.mutate({ question: text }, { onSuccess: pushAi, onError: pushErr });
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      setMsgs((m) => [...m, { role: "ai", text: "Fayl juda katta (maks. 15MB).", at: Date.now() }]);
    } else {
      setFile(f);
    }
    e.target.value = "";
  };

  const copy = (text: string, i: number) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const clearHistory = () => {
    if (!window.confirm("Yozishmalar tarixini o'chirmoqchimisiz?")) return;
    clearChatHistory.mutate(undefined, { onSuccess: () => setMsgs([]) });
  };

  const boxClass = maxed
    ? "fixed z-[60] top-20 bottom-4 max-[650px]:bottom-24 left-0 right-0 mx-auto w-[95vw] max-w-[1000px] flex flex-col rounded-2xl bg-white dark:bg-[#221E33] border border-gray-200 dark:border-gray-700/50 shadow-2xl overflow-hidden"
    : "fixed z-40 flex flex-col rounded-2xl bg-white dark:bg-[#221E33] border border-gray-200 dark:border-gray-700/50 shadow-2xl overflow-hidden bottom-24 right-6 w-[400px] max-w-[calc(100vw-3rem)] h-[70vh] max-h-[600px] max-[650px]:bottom-40 max-[650px]:left-3 max-[650px]:right-3 max-[650px]:w-auto max-[650px]:h-[65vh]";

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
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">Elchin</h3>
                  <p className="text-[11px] text-white/70 leading-tight">
                    Moliyaviy AI maslahatchingiz
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {msgs.length > 0 && (
                  <button
                    onClick={clearHistory}
                    disabled={clearChatHistory.isPending}
                    title="Tarixni tozalash"
                    className="p-1.5 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setMaxed((v) => !v)}
                  title={maxed ? "Kichraytirish" : "Kattalashtirish"}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                >
                  {maxed ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/50 dark:bg-transparent">
              {/* Xush kelibsiz ekrani */}
              {msgs.length === 0 && (
                <div className="flex flex-col items-center text-center pt-4 pb-2">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-3">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white">
                    Salom! Men Elchin 👋
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[280px]">
                    Moliyaviy savollaringizga javob beraman, rasm/Excel tahlil
                    qilaman va biznesni o'stirishga yordam beraman.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-xs text-left px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`group flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={m.role === "user" ? "max-w-[80%]" : maxed ? "max-w-[75%]" : "max-w-[85%]"}>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        m.role === "user"
                          ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-md text-sm whitespace-pre-wrap"
                          : "bg-white dark:bg-[#2A2640] border border-gray-100 dark:border-gray-700/40 rounded-bl-md"
                      }`}
                    >
                      {m.file && (
                        <div
                          className={`mb-1.5 flex items-center gap-1 text-[11px] ${
                            m.role === "user" ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          <Paperclip className="w-3 h-3" /> {m.file}
                        </div>
                      )}
                      {m.role === "ai" ? <AiResponseRenderer text={m.text} /> : m.text}
                      {m.tools && m.tools.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {m.tools.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-300"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Vaqt + nusxalash */}
                    <div
                      className={`mt-1 flex items-center gap-2 px-1 ${
                        m.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {fmtTime(m.at)}
                      </span>
                      {m.role === "ai" && (
                        <button
                          onClick={() => copy(m.text, i)}
                          title="Nusxalash"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-purple-500"
                        >
                          {copiedIdx === i ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {m.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                    </div>
                  )}
                </motion.div>
              ))}

              {pending && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-3.5 py-2 bg-white dark:bg-[#2A2640] border border-gray-100 dark:border-gray-700/40 flex items-center gap-2">
                    <TypingDots />
                    <span className="text-xs text-gray-400">
                      {analyzeFile.isPending ? "Faylni tahlil qilyapman" : "O'ylayapman"}
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Biriktirilgan fayl preview */}
            {file && (
              <div className="px-3 pt-2">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 text-xs">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt=""
                      className="w-9 h-9 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center shrink-0">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="w-4 h-4" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{file.name}</div>
                    <div className="text-purple-400 text-[11px]">
                      {(file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-800/40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Kiritish */}
            <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-white dark:bg-[#221E33]">
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
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-gray-700 transition-colors shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                ref={taRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  grow();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={file ? "Fayl haqida so'rov yozing..." : "Elchin'ga savol bering..."}
                className="flex-1 resize-none max-h-[120px] px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={() => send()}
                disabled={(!q.trim() && !file) || pending}
                className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
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
