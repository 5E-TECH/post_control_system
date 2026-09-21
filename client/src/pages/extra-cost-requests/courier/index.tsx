import { memo, useEffect, useState } from "react";
import { Button, Modal, Pagination } from "antd";
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Receipt,
  RotateCcw,
  Store,
  User,
  X,
  XCircle,
} from "lucide-react";
import {
  useExtraCost,
  type ExtraCostRequest,
  type ExtraCostStatus,
} from "../../../shared/api/hooks/useExtraCost";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";
import ProofMedia from "../../../shared/components/ProofMedia";
import ProofPicker from "../../../shared/components/ProofPicker";
import ProofCountdown from "../../../shared/components/ProofCountdown";

type TabKey = ExtraCostStatus | "";

const PAGE_SIZE = 20;

const money = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("uz-UZ")} so'm`;

const day = (ts?: number | null) => {
  if (!ts) return "—";
  try {
    return new Date(Number(ts)).toLocaleDateString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const dayTime = (ts?: number | null) => {
  if (!ts) return "—";
  try {
    return new Date(Number(ts)).toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

/** Har bir holat uchun kuryerga TUSHUNARLI matn va rang. */
const statusView = (s: ExtraCostStatus) => {
  switch (s) {
    case "awaiting_proof":
      return {
        text: "Isbot kutilmoqda",
        cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
        icon: <Camera className="h-3.5 w-3.5" />,
      };
    case "pending":
      return {
        text: "Market tasdiqlashini kutmoqda",
        cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
        icon: <Clock className="h-3.5 w-3.5" />,
      };
    case "approved":
      // ⚠️ "To'landi" EMAS. Tizimda kuryerga naqd berish endpointi yo'q —
      // to'lov kassa qarzini kamaytirish orqali bo'ladi. Noto'g'ri so'z
      // kuryerni kassaga "pulimni bering" deb yuborardi.
      return {
        text: "Tasdiqlandi — hisobingizga o'tkazildi",
        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case "rejected":
      return {
        text: "Rad etildi",
        cls: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
        icon: <XCircle className="h-3.5 w-3.5" />,
      };
    case "void":
      return {
        text: "Bekor bo'ldi",
        cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        icon: <RotateCcw className="h-3.5 w-3.5" />,
      };
    case "reversed":
      return {
        text: "Teskari qaytarildi",
        cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        icon: <RotateCcw className="h-3.5 w-3.5" />,
      };
  }
};

/**
 * KURYER — O'Z XARAJAT SO'ROVLARI VA HOLATLARI.
 *
 * ⚠️ NEGA BU SAHIFA MUHIM. Kuryerga Telegram orqali xabar yuborishning
 * hech qanday yo'li YO'Q (`telegram_id` faqat market va operatorga
 * to'ldiriladi, WebSocket gateway esa o'lik kod). Ya'ni "qaroringiz tayyor"
 * degan xabar KUZATILADIGAN yagona joy — shu sahifa va asosiy ekrandagi
 * banner.
 *
 * ⚠️ ENG MUHIM AMAL — «Isbot biriktirish». Busiz "isbotsiz davom etish"
 * TUZOQ edi: so'rov `awaiting_proof` da qolib, 24 soatdan keyin bekor
 * bo'lardi va kuryer pulini butunlay yo'qotardi.
 */
const CourierExtraCostRequests = () => {
  const [tab, setTab] = useState<TabKey>("");
  const [page, setPage] = useState(1);
  const [attaching, setAttaching] = useState<ExtraCostRequest | null>(null);
  const [attachIds, setAttachIds] = useState<string[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { handleSuccess, handleApiError } = useApiNotification();
  const { getCourierRequests, getCourierCounts, attachProof, markSeen } =
    useExtraCost();

  const { data: counts } = getCourierCounts();
  const needProof = Number(counts?.awaiting_proof ?? 0);

  const { data, isLoading, isFetching, refetch } = getCourierRequests({
    status: tab || undefined,
    page,
    limit: PAGE_SIZE,
  });

  // Sahifa ochilishi = kuryer qarorlarni ko'rdi. Banner shu bilan yopiladi.
  useEffect(() => {
    markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: ExtraCostRequest[] = data?.items ?? [];
  const total = Number(data?.total ?? 0);

  /**
   * TELEFON SOATINING OG'ISHI.
   *
   * ⚠️ Teskari sanoq SERVER vaqtida yurishi kerak: muddatni CRON belgilaydi.
   * Arzon Android telefonlarda soat bir necha soatga adashishi odatiy hol —
   * og'ishsiz kuryer "6 soat bor" deb ko'rib turganda so'rov allaqachon
   * bekor bo'lgan bo'lardi.
   *
   * `server_now` har so'rovda yangilanadi, ya'ni og'ish o'zi to'g'rilanadi.
   */
  const clockOffsetMs = data?.server_now
    ? Number(data.server_now) - Date.now()
    : 0;

  /** Eng yaqin muddat — bannerda ko'rsatish uchun. */
  const nearestDeadlineAt = items
    .filter((r) => r.status === "awaiting_proof")
    .reduce<number | null>(
      (min, r) =>
        min === null || Number(r.created_at) < min ? Number(r.created_at) : min,
      null,
    );

  // ⚠️ JAMI IKKIGA BO'LINDI.
  //
  // Avval bitta "Tasdiq kutilmoqda" raqami bor edi va u `awaiting_proof`
  // summalarini ham qo'shib hisoblardi — ya'ni kuryer marketga UMUMAN
  // yuborilmagan pulni ham "kutmoqda" deb ko'rardi. Ikkisi butunlay boshqa
  // holat: biri MENDAN ish talab qiladi, ikkinchisi marketdan.
  const pendingTotal = Number(data?.pending_total ?? 0);
  const awaitingTotal = Number(data?.awaiting_total ?? 0);

  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: "", label: "Hammasi" },
    { key: "awaiting_proof", label: "Isbot kerak", badge: needProof },
    { key: "pending", label: "Kutilmoqda" },
    { key: "approved", label: "Tasdiqlangan" },
    { key: "rejected", label: "Rad etilgan" },
  ];

  const openAttach = (r: ExtraCostRequest) => {
    setAttaching(r);
    setAttachIds([]);
  };

  const submitAttach = () => {
    if (!attaching || !attachIds.length) return;
    attachProof.mutate(
      { id: attaching.id, proof_ids: attachIds },
      {
        onSuccess: () => {
          handleSuccess(
            `#${attaching.order_number} — isbot yuborildi, market ko'rib chiqadi`,
          );
          setAttaching(null);
          setAttachIds([]);
          void refetch();
        },
        onError: (e) => handleApiError(e, "Isbot biriktirilmadi"),
      },
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/25">
          <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
            Qo'shimcha xarajatlarim
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Yuborgan so'rovlaringiz va ularning holati
          </p>
        </div>
      </div>

      {/* ⚠️ ENG TEPADA — ISH TALAB QILADIGANI. Isbot biriktirilmasa pul
          butunlay yo'qoladi, shuning uchun u "kutilmoqda"dan muhimroq. */}
      {needProof > 0 && (
        <button
          type="button"
          onClick={() => {
            setTab("awaiting_proof");
            setPage(1);
          }}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4 text-left dark:border-orange-800/50 dark:bg-orange-900/20"
        >
          <Camera className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
          <div>
            <div className="text-sm font-semibold text-orange-800 dark:text-orange-300">
              {needProof} ta so'rovga isbot kerak
              {awaitingTotal > 0 && ` — ${money(awaitingTotal)}`}
            </div>
            <div className="text-[11px] leading-snug text-orange-700 dark:text-orange-400">
              Isbot biriktirmasangiz bu so'rovlar marketga yuborilmaydi va
              bekor bo'ladi.
            </div>
            {nearestDeadlineAt !== null && (
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-orange-700 dark:text-orange-400">
                Eng yaqini:
                <ProofCountdown
                  createdAt={nearestDeadlineAt}
                  clockOffsetMs={clockOffsetMs}
                  variant="banner"
                />
              </div>
            )}
          </div>
        </button>
      )}

      {/* Kutilayotgan jami — marketga YUBORILGANLARI */}
      {pendingTotal > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/15">
          <div className="text-xs text-amber-700 dark:text-amber-400">
            Tasdiq kutilmoqda
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {money(pendingTotal)}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
            Bu summa market tasdiqlagandan keyin hisobingizga o'tkaziladi.
            Naqdni kassaga <b>to'liq</b> topshirasiz.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              tab === t.key
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#2A263D] dark:text-gray-300 dark:hover:bg-[#332F47]"
            }`}
          >
            {t.label}
            {!!t.badge && t.badge > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10px] font-semibold ${
                  tab === t.key
                    ? "bg-white/25 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {tab === "awaiting_proof"
            ? "Isbot kutayotgan so'rov yo'q"
            : "So'rov yo'q"}
        </div>
      ) : (
        <div className={`grid gap-3 ${isFetching ? "opacity-60" : ""}`}>
          {items.map((r) => {
            const v = statusView(r.status);
            const needsProof = r.status === "awaiting_proof";
            return (
              <div
                key={r.id}
                className={`rounded-xl border bg-white p-4 dark:bg-[#2A263D] ${
                  needsProof
                    ? "border-orange-300 dark:border-orange-800/60"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        #{r.order_number}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${v.cls}`}
                      >
                        {v.icon}
                        {v.text}
                      </span>
                    </div>

                    {/* ⚠️ QAYSI MARKETNING buyurtmasi — kuryer kuniga
                        o'nlab marketning buyurtmasini tashiydi. */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">
                        <Store className="h-3 w-3 shrink-0" />
                        <b>{r.market_name ?? "Market"}</b>
                      </span>
                      {r.customer_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          {r.customer_name}
                        </span>
                      )}
                      {r.customer_phone && (
                        <a
                          href={`tel:${r.customer_phone}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Phone className="h-3 w-3 shrink-0" />
                          {r.customer_phone}
                        </a>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {(r.region_name || r.district_name) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[r.region_name, r.district_name]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        Sotuv: {day(r.order_action_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        So'rov: {dayTime(r.created_at)}
                      </span>
                      {r.reviewed_at && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          Qaror: {day(r.reviewed_at)}
                        </span>
                      )}
                    </div>

                    {/* Rad etish sababi — kuryer buni BILISHI kerak */}
                    {r.status === "rejected" && r.review_note && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{r.review_note}</span>
                      </div>
                    )}

                    {needsProof && (
                      <div className="mt-2 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs leading-snug text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-semibold">Qolgan vaqt:</span>
                          <ProofCountdown
                            createdAt={r.created_at}
                            clockOffsetMs={clockOffsetMs}
                          />
                        </div>
                        Bu so'rov marketga <b>hali yuborilmagan</b> — isbot
                        biriktirilishi kerak. Biriktirilmasa so'rov bekor
                        bo'ladi; sotuvingizga ta'sir qilmaydi, faqat xarajat
                        to'lanmaydi.
                      </div>
                    )}
                  </div>

                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {money(r.amount)}
                  </div>
                </div>

                {r.proof_ids?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.proof_ids.map((pid) => (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setLightbox(`${r.id}/${pid}`)}
                        className="h-14 w-14 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <ProofMedia
                          requestId={r.id}
                          proofId={pid}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {needsProof && (
                  <Button
                    className="mt-3"
                    type="primary"
                    icon={<Camera className="h-4 w-4" />}
                    onClick={() => openAttach(r)}
                  >
                    Isbot biriktirish
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex justify-center overflow-x-auto">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      )}

      {/* ISBOTNI KEYINROQ BIRIKTIRISH */}
      <Modal
        open={!!attaching}
        title={`#${attaching?.order_number ?? ""} — isbot biriktirish`}
        onCancel={() => setAttaching(null)}
        onOk={submitAttach}
        okText="Yuborish"
        cancelText="Bekor qilish"
        okButtonProps={{
          disabled: attachIds.length === 0 || attachBusy,
          loading: attachProof.isPending,
        }}
        destroyOnHidden
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Qolgan vaqt:
          </span>
          {/* Kuryer aynan shu yerda ishlaydi — sanoq ko'z oldida tursin. */}
          <ProofCountdown
            createdAt={attaching?.created_at}
            clockOffsetMs={clockOffsetMs}
            variant="banner"
          />
        </div>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          {money(attaching?.amount)} — isbot yuborilgandan keyin so'rov{" "}
          <b>{attaching?.market_name ?? "marketga"}</b> ko'rib chiqishga
          tushadi.
        </p>
        <ProofPicker
          onChange={setAttachIds}
          resetKey={attaching?.id}
          onBusyChange={setAttachBusy}
        />
      </Modal>

      {/* Isbot lightbox — rasm ham, video ham */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <ProofMedia
              requestId={lightbox.split("/")[0]}
              proofId={lightbox.split("/")[1]}
              variant="full"
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(CourierExtraCostRequests);
