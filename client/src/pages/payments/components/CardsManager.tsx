import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Select, message } from "antd";
import TextArea from "antd/es/input/TextArea";
import {
  CreditCard,
  Plus,
  Pencil,
  Check,
  X,
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Loader2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useCashBox } from "../../../shared/api/hooks/useCashbox";
import { SELECT_CLS, SELECT_POPUP_CLS } from "../../../shared/ui/select-styles";
import type { AxiosError } from "axios";
import type { ChangeEvent } from "react";

type CardItem = {
  id: string;
  name: string;
  balance: number;
  is_default: boolean;
  is_active: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");
const parseAmount = (s: string) => Number(String(s).replace(/\D/g, "")) || 0;
const apiMsg = (e: unknown, fallback: string) => {
  const err = e as AxiosError<{ message?: string; error?: string }>;
  return (
    err?.response?.data?.message || err?.response?.data?.error || fallback
  );
};

export const CardsManager = ({ open, onClose, onChanged }: Props) => {
  const navigate = useNavigate();
  const {
    getCards,
    createCard,
    renameCard,
    transferCards,
    convertCard,
  } = useCashBox();

  // Kartaga kirish — alohida sahifa (asosiy kassa ko'rinishida)
  const openCard = (cardId: string) => {
    onClose();
    navigate(`/payments/card-detail/${cardId}`);
  };

  const { data, refetch } = getCards({ includeInactive: true });
  const payload = data?.data;
  const cards: CardItem[] = payload?.cards || [];
  const balanceCash: number = payload?.balance_cash || 0;
  const balanceCard: number = payload?.balance_card || 0;
  const inSync: boolean = payload?.inSync ?? true;

  const activeCards = useMemo(() => cards.filter((c) => c.is_active), [cards]);
  const cardName = (cardId?: string) =>
    cards.find((c) => c.id === cardId)?.name || "";

  // Add card
  const [newName, setNewName] = useState("");
  // Rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [tFrom, setTFrom] = useState<string | undefined>();
  const [tTo, setTTo] = useState<string | undefined>();
  const [tAmount, setTAmount] = useState("");
  const [tComment, setTComment] = useState("");

  // Convert dialog
  const [convertOpen, setConvertOpen] = useState(false);
  const [cDir, setCDir] = useState<"card_to_cash" | "cash_to_card">(
    "card_to_cash",
  );
  const [cCard, setCCard] = useState<string | undefined>();
  const [cAmount, setCAmount] = useState("");
  const [cComment, setCComment] = useState("");

  const afterChange = () => {
    refetch();
    onChanged?.();
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    createCard.mutate(
      { name },
      {
        onSuccess: () => {
          message.success("Karta qo'shildi");
          setNewName("");
          afterChange();
        },
        onError: (e) => message.error(apiMsg(e, "Xatolik yuz berdi")),
      },
    );
  };

  const handleRename = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    renameCard.mutate(
      { id, name },
      {
        onSuccess: () => {
          message.success("Nomi o'zgartirildi");
          setEditingId(null);
          setEditName("");
          afterChange();
        },
        onError: (e) => message.error(apiMsg(e, "Xatolik yuz berdi")),
      },
    );
  };

  const handleTransfer = () => {
    const amount = parseAmount(tAmount);
    if (!tFrom || !tTo || amount <= 0) return;
    if (!tComment.trim()) {
      message.warning("O'tkazma uchun izoh (sabab) majburiy");
      return;
    }
    transferCards.mutate(
      { from_card_id: tFrom, to_card_id: tTo, amount, comment: tComment },
      {
        onSuccess: () => {
          message.success("O'tkazma bajarildi");
          setTransferOpen(false);
          setTFrom(undefined);
          setTTo(undefined);
          setTAmount("");
          setTComment("");
          afterChange();
        },
        onError: (e) => message.error(apiMsg(e, "Xatolik yuz berdi")),
      },
    );
  };

  const handleConvert = () => {
    const amount = parseAmount(cAmount);
    if (!cCard || amount <= 0) return;
    if (!cComment.trim()) {
      message.warning("Konvertatsiya uchun izoh (sabab) majburiy");
      return;
    }
    convertCard.mutate(
      { type: cDir, card_id: cCard, amount, comment: cComment },
      {
        onSuccess: () => {
          message.success("Konvertatsiya bajarildi");
          setConvertOpen(false);
          setCCard(undefined);
          setCAmount("");
          setCComment("");
          afterChange();
        },
        onError: (e) => message.error(apiMsg(e, "Xatolik yuz berdi")),
      },
    );
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={560}
        title={
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            <span>Virtual kartalar</span>
          </div>
        }
      >
        {/* Summary — kartalar umumiy balansi */}
        <div className="mb-4 rounded-xl p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" /> Kartalar (jami)
          </p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            {fmt(balanceCard)} <span className="text-xs font-normal">UZS</span>
          </p>
        </div>

        {!inSync && (
          <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4" />
            Diqqat: kartalar yig'indisi umumiy karta summasiga teng emas!
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTransferOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Kartalararo
          </button>
          <button
            onClick={() => setConvertOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            <Banknote className="w-4 h-4" /> Karta↔Naqd
          </button>
        </div>

        {/* Cards list */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => editingId !== card.id && openCard(card.id)}
              className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                card.is_active
                  ? "border-gray-200 dark:border-gray-700"
                  : "border-dashed border-gray-300 dark:border-gray-600 opacity-60"
              } ${
                editingId !== card.id
                  ? "cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 hover:shadow-sm"
                  : ""
              }`}
            >
              {editingId === card.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setEditName(e.target.value)
                    }
                    onKeyDown={(e: React.KeyboardEvent) =>
                      e.key === "Enter" && handleRename(card.id)
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-purple-300 bg-white dark:bg-[#312D4B] text-sm outline-none"
                  />
                  <button
                    onClick={() => handleRename(card.id)}
                    className="w-9 h-9 rounded-lg bg-green-500 text-white flex items-center justify-center"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditName("");
                    }}
                    className="w-9 h-9 rounded-lg bg-gray-300 dark:bg-gray-600 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  {/* Karta ikonkasi */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                  </div>

                  {/* Nom + balans */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-800 dark:text-white truncate flex items-center gap-1.5">
                      {card.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                          ★ Asosiy
                        </span>
                      )}
                      {card.name}
                      {!card.is_active && (
                        <span className="text-[10px] text-gray-400">
                          (arxiv)
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-0.5">
                      {fmt(card.balance)}{" "}
                      <span className="text-[11px] font-normal text-gray-400">
                        UZS
                      </span>
                    </p>
                  </div>

                  {/* Nomini o'zgartirish (default kartada yo'q) */}
                  {!card.is_default && (
                    <button
                      title="Nomini o'zgartirish"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(card.id);
                        setEditName(card.name);
                      }}
                      className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 flex items-center justify-center text-gray-600 dark:text-gray-300 flex-shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add card */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <input
            value={newName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setNewName(e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent) =>
              e.key === "Enter" && handleAdd()
            }
            placeholder="Yangi karta nomi (masalan: Humo 8600)"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] text-sm outline-none focus:border-purple-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || createCard.isPending}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            {createCard.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Qo'shish
          </button>
        </div>
      </Modal>

      {/* Transfer dialog */}
      <Modal
        open={transferOpen}
        onCancel={() => setTransferOpen(false)}
        onOk={handleTransfer}
        okText="O'tkazish"
        cancelText="Bekor"
        okButtonProps={{
          loading: transferCards.isPending,
          disabled:
            !tFrom || !tTo || parseAmount(tAmount) <= 0 || !tComment.trim(),
        }}
        title="Kartalararo o'tkazma"
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bir kartadan boshqasiga pul ko'chirish. Umumiy kassa balansi
            o'zgarmaydi.
          </p>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Qaysi kartadan{" "}
              <span className="text-red-500 font-normal">(pul ayiriladi)</span>
            </label>
            <Select
              size="large"
              value={tFrom}
              onChange={setTFrom}
              placeholder="Manba kartani tanlang"
              className={SELECT_CLS}
              popupClassName={SELECT_POPUP_CLS}
              options={activeCards.map((c) => ({
                value: c.id,
                label: `${c.name} — ${fmt(c.balance)} UZS`,
              }))}
            />
          </div>
          <div className="flex justify-center">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-purple-600 dark:text-purple-300 rotate-90" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Qaysi kartaga{" "}
              <span className="text-emerald-600 font-normal">
                (pul qo'shiladi)
              </span>
            </label>
            <Select
              size="large"
              value={tTo}
              onChange={setTTo}
              placeholder="Maqsad kartani tanlang"
              className={SELECT_CLS}
              popupClassName={SELECT_POPUP_CLS}
              options={activeCards
                .filter((c) => c.id !== tFrom)
                .map((c) => ({
                  value: c.id,
                  label: `${c.name} — ${fmt(c.balance)} UZS`,
                }))}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Summa
            </label>
            <input
              value={tAmount}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setTAmount(fmt(parseAmount(e.target.value)))
              }
              placeholder="0"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] outline-none text-lg font-semibold"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Sabab <span className="text-red-500">*</span>
            </label>
            <TextArea
              value={tComment}
              onChange={(e) => setTComment(e.target.value)}
              placeholder="O'tkazma sababi (majburiy)"
              autoSize={{ minRows: 1, maxRows: 3 }}
            />
          </div>
          {tFrom && tTo && parseAmount(tAmount) > 0 && (
            <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-3 text-sm text-gray-700 dark:text-gray-200">
              <b>{cardName(tFrom)}</b> kartasidan{" "}
              <b>{cardName(tTo)}</b> kartasiga{" "}
              <b className="text-purple-700 dark:text-purple-300">
                {fmt(parseAmount(tAmount))} so'm
              </b>{" "}
              o'tkaziladi
            </div>
          )}
        </div>
      </Modal>

      {/* Convert dialog */}
      <Modal
        open={convertOpen}
        onCancel={() => setConvertOpen(false)}
        onOk={handleConvert}
        okText="Bajarish"
        cancelText="Bekor"
        okButtonProps={{
          loading: convertCard.isPending,
          disabled: !cCard || parseAmount(cAmount) <= 0 || !cComment.trim(),
        }}
        title="Karta ↔ Naqd"
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Yo'nalishni tanlang. Adashmaslik uchun pastдa natija ko'rsatiladi.
          </p>

          {/* Yo'nalish — katta, tushunarli tugmalar */}
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => setCDir("card_to_cash")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                cDir === "card_to_cash"
                  ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <CreditCard className="w-5 h-5 text-purple-500" />
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Banknote className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-800 dark:text-white">
                  Kartadan → Naqdga
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Kartadagi pulni naqd qilasiz (bankomatdan yechildi)
                </p>
              </div>
            </button>
            <button
              onClick={() => setCDir("cash_to_card")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                cDir === "cash_to_card"
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Banknote className="w-5 h-5 text-green-500" />
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <CreditCard className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-800 dark:text-white">
                  Naqddan → Kartaga
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Naqd pulni kartaga solasiz
                </p>
              </div>
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              {cDir === "card_to_cash"
                ? "Qaysi kartadan pul yechiladi"
                : "Qaysi kartaga pul solinadi"}
            </label>
            <Select
              size="large"
              value={cCard}
              onChange={setCCard}
              placeholder="Kartani tanlang"
              className={SELECT_CLS}
              popupClassName={SELECT_POPUP_CLS}
              options={activeCards.map((c) => ({
                value: c.id,
                label: `${c.name} — ${fmt(c.balance)} UZS`,
              }))}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Summa
            </label>
            <input
              value={cAmount}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setCAmount(fmt(parseAmount(e.target.value)))
              }
              placeholder="0"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] outline-none text-lg font-semibold"
            />
            <p className="text-xs text-gray-400 mt-1">
              Joriy naqd kassa: {fmt(balanceCash)} UZS
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Sabab <span className="text-red-500">*</span>
            </label>
            <TextArea
              value={cComment}
              onChange={(e) => setCComment(e.target.value)}
              placeholder="Konvertatsiya sababi (majburiy)"
              autoSize={{ minRows: 1, maxRows: 3 }}
            />
          </div>

          {/* Natija — adashmaslik uchun aniq tasdiq */}
          {cCard && parseAmount(cAmount) > 0 && (
            <div
              className={`rounded-xl p-3 text-sm border ${
                cDir === "card_to_cash"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300"
                  : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {cDir === "card_to_cash" ? (
                <>
                  🔻 <b>{cardName(cCard)}</b> kartasidan{" "}
                  <b>{fmt(parseAmount(cAmount))} so'm</b> ayiriladi va naqd
                  kassaga qo'shiladi
                </>
              ) : (
                <>
                  🔺 Naqd kassadan <b>{fmt(parseAmount(cAmount))} so'm</b>{" "}
                  ayiriladi va <b>{cardName(cCard)}</b> kartasiga qo'shiladi
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default CardsManager;
