import { memo, useMemo, useState } from "react";
import { Button, Input, Modal, Pagination } from "antd";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Receipt,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react";
import {
  EXTRA_COST_STATUS_LABEL,
  useExtraCost,
  type ExtraCostRequest,
  type ExtraCostStatus,
} from "../../../shared/api/hooks/useExtraCost";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";
import ProofMedia from "../../../shared/components/ProofMedia";

type TabKey = "pending" | "overdue" | "approved" | "rejected";

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

/** Necha kun oldin — "muddati o'tgan"ni ko'z bilan ilg'ash uchun. */
const daysAgo = (ts?: number | null): number => {
  if (!ts) return 0;
  return Math.floor((Date.now() - Number(ts)) / 86_400_000);
};

const statusChip: Record<ExtraCostStatus, string> = {
  awaiting_proof:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  void: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  reversed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

/**
 * MARKET — QO'SHIMCHA XARAJAT SO'ROVLARI.
 *
 * ⚠️ Bu sahifa `market_id` ni HECH QAYERDAN olmaydi — u tokendan keladi.
 * `GET order/market/:id` da mavjud IDOR bor (market egaligini tekshirmaydi);
 * o'sha naqshni bu yerga ko'chirmaslik uchun marketni tanlash imkoniyati
 * umuman yo'q.
 *
 * ⚠️ `awaiting_proof` SO'ROVLAR BU YERDA UMUMAN YO'Q — ularni server
 * filtrlaydi. Bunday so'rov hali YUBORILMAGAN: kuryer isbotni keyin
 * biriktiradi. Avval ular ko'rinardi va "Tasdiqlash" tugmasi doim 409
 * qaytarardi (tasdiqlash darvozasi faqat `pending` ni qabul qiladi).
 */
const MarketExtraCostRequests = () => {
  const [tab, setTab] = useState<TabKey>("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<ExtraCostRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { handleSuccess, handleApiError } = useApiNotification();
  const { getMarketRequests, getMarketCounts, approve, reject, bulkApprove } =
    useExtraCost();

  const { data: counts } = getMarketCounts();
  const openCount = Number(counts?.open ?? 0);
  const overdueCount = Number(counts?.escalated ?? 0);
  const openAmount = Number(counts?.amount ?? 0);

  const { data, isLoading, isFetching, refetch } = getMarketRequests({
    status: tab === "overdue" ? undefined : (tab as ExtraCostStatus),
    escalated: tab === "overdue" ? "true" : undefined,
    page,
    limit: PAGE_SIZE,
  });

  const total = Number(data?.total ?? 0);

  /**
   * ⚠️ TASHQI KARGO (Elchi/LDG) SO'ROVLARI MARKETGA KO'RSATILMAYDI.
   *
   * Ular avval alohida tabda turardi, lekin market uchun bu faqat shovqin
   * edi: tasdiqlash talab qilmaydi, isbot ham yo'q (o'sha kuryerlar bizning
   * ilovadan foydalanmaydi), ya'ni market ko'rib hech narsa qila olmasdi.
   *
   * Tashqi kargo xarajatlariga ham xuddi shunday isbot/tasdiq oqimi
   * KEYINCHALIK qilinadi — o'shanda ular oddiy so'rovlar qatorida, shu
   * yerdagi tablarda ko'rinadi va alohida tab kerak bo'lmaydi.
   */
  const items: ExtraCostRequest[] = useMemo(() => {
    const all: ExtraCostRequest[] = data?.items ?? [];
    return all.filter((r) => r.decision_mode !== "external_auto");
  }, [data]);

  const isOpenTab = tab === "pending" || tab === "overdue";

  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: "pending", label: "Kutilmoqda", badge: openCount },
    { key: "overdue", label: "Muddati o'tgan", badge: overdueCount },
    { key: "approved", label: "Tasdiqlangan" },
    { key: "rejected", label: "Rad etilgan" },
    // ⚠️ "Narx pasaytirilgan" va "Tashqi kargo" TABLARI ATAYLAB YO'Q.
    //
    // Narx pasaytirish (dona o'zgarmasdan narx tushirilishi)
    // `extra_cost_request` yozuvi YARATMAYDI — u kassaga ham tegmaydi,
    // shuning uchun tasdiqlangan so'rov sifatida yozilsa rekonsiliatsiya
    // invarianti I1 buzilardi. U activity-log'dagi `hidden_price_cut` da.
    //
    // Tashqi kargo esa market uchun shovqin edi: tasdiq talab qilmaydi,
    // isboti yo'q, market ko'rib hech narsa qila olmasdi.
    //
    // Doim bo'sh yoki amal talab qilmaydigan tab "hammasi joyida" degan
    // noto'g'ri xulosaga olib boradi.
  ];

  const switchTab = (key: TabKey) => {
    setTab(key);
    setPage(1);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectableIds = items
    .filter((r) => r.status === "pending")
    .map((r) => r.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const onApprove = (r: ExtraCostRequest) =>
    approve.mutate(r.id, {
      onSuccess: () => {
        handleSuccess(`#${r.order_number} — ${money(r.amount)} tasdiqlandi`);
        void refetch();
      },
      onError: (e) => handleApiError(e, "Tasdiqlashda xatolik"),
    });

  const onReject = () => {
    if (!rejecting) return;
    reject.mutate(
      { id: rejecting.id, review_note: rejectNote },
      {
        onSuccess: () => {
          handleSuccess(`#${rejecting.order_number} — rad etildi`);
          setRejecting(null);
          setRejectNote("");
          void refetch();
        },
        onError: (e) => handleApiError(e, "Rad etishda xatolik"),
      },
    );
  };

  const onBulk = () =>
    bulkApprove.mutate([...selected], {
      onSuccess: (res: unknown) => {
        const body = res as {
          data?: { approved?: number; skipped?: unknown[] };
          approved?: number;
          skipped?: unknown[];
        };
        const d = body?.data ?? body;
        handleSuccess(
          `${d?.approved ?? 0} ta tasdiqlandi` +
            (d?.skipped?.length ? `, ${d.skipped.length} tasi o'tmadi` : ""),
        );
        setSelected(new Set());
        void refetch();
      },
      onError: (e) => handleApiError(e, "Tasdiqlashda xatolik"),
    });

  const emptyText =
    tab === "pending"
      ? "Hozircha tasdiq kutayotgan xarajat yo'q"
      : tab === "overdue"
        ? "Muddati o'tgan so'rov yo'q — barchasiga o'z vaqtida javob berilgan"
        : "So'rov yo'q";

  return (
    <div className="p-4 md:p-6">
      {/* ─────────── Sarlavha ─────────── */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/25">
          <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
            Qo'shimcha xarajatlar
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Kuryerlar yozgan xarajatlarni ko'rib chiqing — tasdiqlanmaguncha
            pul hisobdan yechilmaydi
          </p>
        </div>
      </div>

      {/* ─────────── Qisqacha holat ─────────── */}
      {(openCount > 0 || overdueCount > 0) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/15">
            <div className="text-[11px] text-amber-700 dark:text-amber-400">
              Javobingizni kutmoqda
            </div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
              {openCount} ta · {money(openAmount)}
            </div>
          </div>
          {overdueCount > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800/40 dark:bg-red-900/15">
              <div className="text-[11px] text-red-700 dark:text-red-400">
                Muddati o'tgan
              </div>
              <div className="text-xl font-bold text-red-700 dark:text-red-300">
                {overdueCount} ta
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-red-700 dark:text-red-400">
                Javob berilmasa bu so'rovlar avtomatik tasdiqlanadi.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─────────── Tablar ─────────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
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

      {/* ─────────── Bulk panel ─────────── */}
      {isOpenTab && selectableIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800/40 dark:bg-amber-900/15">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(selectableIds))
              }
            />
            {selected.size > 0
              ? `${selected.size} ta tanlandi`
              : "Hammasini tanlash"}
          </label>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <Button size="small" onClick={() => setSelected(new Set())}>
                Bekor qilish
              </Button>
              <Button
                size="small"
                type="primary"
                loading={bulkApprove.isPending}
                onClick={onBulk}
              >
                Tasdiqlash ({selected.size})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─────────── Ro'yxat ─────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {emptyText}
        </div>
      ) : (
        <div className={`grid gap-3 ${isFetching ? "opacity-60" : ""}`}>
          {items.map((r) => {
            const atLimit = r.limit_max > 0 && r.amount >= r.limit_max;
            const overdue = !!r.escalated_at;
            const waited = daysAgo(r.created_at);
            return (
              <div
                key={r.id}
                className={`rounded-xl border bg-white p-4 dark:bg-[#2A263D] ${
                  overdue
                    ? "border-red-300 dark:border-red-800/60"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {isOpenTab && r.status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="mt-1.5 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      {/* Qator 1 — buyurtma va holat */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-800 dark:text-white">
                          #{r.order_number}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] ${statusChip[r.status]}`}
                        >
                          {EXTRA_COST_STATUS_LABEL[r.status]}
                        </span>
                        {overdue && (
                          <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-900/25 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Muddati o'tgan
                          </span>
                        )}
                      </div>

                      {/* Qator 2 — KIM va QAYERGA (band 2) */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          Kuryer: <b>{r.courier_name ?? "—"}</b>
                        </span>
                        {r.customer_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0" />
                            Mijoz: {r.customer_name}
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

                      {/* Qator 3 — manzil va sanalar */}
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3 shrink-0" />
                          {r.where_deliver === "center"
                            ? "Markazga"
                            : "Uyga yetkazish"}
                        </span>
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
                          {r.status === "pending" && waited >= 1 && (
                            <b
                              className={
                                waited >= 5
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                              }
                            >
                              ({waited} kun kutmoqda)
                            </b>
                          )}
                        </span>
                      </div>

                      {/* Qator 4 — pul konteksti */}
                      <div className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                        Buyurtma {money(r.order_total_price)} · kuryer tarifi{" "}
                        {money(r.courier_tariff_snapshot)} · ruxsat etilgan
                        maksimum <b>{money(r.limit_max)}</b>
                      </div>

                      {r.reason && (
                        <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">
                          Sabab: {r.reason}
                        </p>
                      )}
                      {r.review_note && (
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Izoh: {r.review_note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {money(r.amount)}
                    </div>
                    {atLimit && (
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        maksimumga teng
                      </div>
                    )}
                  </div>
                </div>

                {/* Dublikat isbot — qizil signal */}
                {r.dup_proof_count > 1 && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Bu isbot yana {r.dup_proof_count - 1} ta so'rovda
                    ishlatilgan
                  </div>
                )}

                {/* Isbot — rasm yoki video */}
                {r.proof_ids?.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.proof_ids.map((pid) => (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setLightbox(`${r.id}/${pid}`)}
                        className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <ProofMedia
                          requestId={r.id}
                          proofId={pid}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
                    Isbot biriktirilmagan
                  </div>
                )}

                {/* Amallar — FAQAT `pending`. `awaiting_proof` bu yerga
                    umuman tushmaydi, qolgan holatlar esa yakunlangan. */}
                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="primary"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      loading={approve.isPending}
                      onClick={() => onApprove(r)}
                    >
                      Tasdiqlash
                    </Button>
                    <Button
                      danger
                      icon={<XCircle className="h-4 w-4" />}
                      onClick={() => {
                        setRejecting(r);
                        setRejectNote("");
                      }}
                    >
                      Rad etish
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sahifalash — market kuniga yuzlab so'rov ko'rishi mumkin */}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex justify-center overflow-x-auto">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={(p) => {
              setPage(p);
              setSelected(new Set());
            }}
          />
        </div>
      )}

      {/* Rad etish — SABAB MAJBURIY */}
      <Modal
        open={!!rejecting}
        title={`#${rejecting?.order_number ?? ""} — rad etish`}
        onCancel={() => setRejecting(null)}
        onOk={onReject}
        okText="Rad etish"
        cancelText="Bekor qilish"
        okButtonProps={{
          danger: true,
          disabled: rejectNote.trim().length < 3,
          loading: reject.isPending,
        }}
      >
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
          Kuryer sababni ko'radi — aks holda u xuddi shu xatoni takrorlaydi.
        </p>
        <Input.TextArea
          rows={3}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Masalan: chek rasmida summa ko'rinmayapti"
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

export default memo(MarketExtraCostRequests);
