import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, message } from "antd";
import {
  Bot,
  ArrowLeft,
  Sparkles,
  Phone,
  MapPin,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  User,
  Trash2,
  Store,
  Check,
  Loader2,
  Wallet,
  ClipboardList,
  Truck,
  Repeat,
  Plus,
} from "lucide-react";
import type { RootState } from "../../../../../app/store";
import { api } from "../../../../../shared/api";
import { buildAdminPath } from "../../../../../shared/const";

const som = (n?: number | null) =>
  (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// Telefonni +998XXXXXXXXX ga keltiradi (davlat kodi/trunk prefiksni yechadi);
// noto'g'ri bo'lsa "" qaytaradi. Backend DTO ham shu formatni talab qiladi.
const cleanPhone = (raw?: string): string => {
  const d = (raw || "").replace(/\D/g, "");
  const nat =
    d.length === 12 && d.startsWith("998")
      ? d.slice(3)
      : d.length === 10 && /^[08]/.test(d)
        ? d.slice(1)
        : d;
  return nat.length === 9 ? `+998${nat}` : "";
};

// Buyurtma imzosi (dublikatni aniqlash: telefon + mahsulotlar + narx + almashtirish).
const previewSig = (p: {
  phone_number?: string;
  items: { product_id?: string; quantity: number }[];
  total_price?: number;
  replaced_order_id?: string;
}): string => {
  const phone9 = cleanPhone(p.phone_number).slice(-9);
  const items = p.items
    .map((i) => `${i.product_id || ""}:${i.quantity}`)
    .sort()
    .join(",");
  return `${phone9}|${items}|${p.total_price ?? ""}|${p.replaced_order_id || ""}`;
};

const formatDate = (ts?: number | null) => {
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

// Asosiy buyurtmalar jadvali bilan bir xil formatlar
const formatPhone = (phone?: string) =>
  !phone
    ? "—"
    : phone
        .replace(/\D/g, "")
        .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
const formatDateTime = (ts?: number | null) => {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
};

// Zich (compact) inputlar — ko'p buyurtma tasdiqlashda kam scroll uchun.
const inputCls =
  "w-full h-8 px-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all";
const okBorder = "border-gray-200 dark:border-gray-600";
const errBorder = "border-red-300 dark:border-red-700/70 bg-red-50/50 dark:bg-red-900/10";
const labelCls =
  "text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5";

// Maydon ostidagi qizil kamchilik izohi — qayeri to'ldirilishi kerakligi aniq.
const FieldHint = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-red-500 dark:text-red-400">
    <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
    {children}
  </span>
);
// Antd Select'ni h-8 va rounded-lg qilib native inputlarga moslash.
const selSel =
  "[&_.ant-select-selector]:!h-8 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!flex [&_.ant-select-selector]:!items-center [&_.ant-select-selection-search-input]:!h-8";

// ─── Turlar ───
interface PItem {
  name: string;
  quantity: number;
  product_id?: string;
  resolved_name?: string;
  candidates?: { id: string; name: string }[];
}
interface ReplacementCandidate {
  id: string;
  order_number: number;
  created_at: number;
  total_price: number;
  items: string;
}
interface DistrictCandidate {
  id: string;
  label: string;
  region_name?: string;
  district_name?: string;
}
interface Preview {
  id: string;
  customer_name?: string;
  phone_number?: string;
  extra_number?: string;
  district_id?: string;
  district_name?: string;
  region_id?: string;
  region_name?: string;
  region_given?: boolean;
  district_candidates?: DistrictCandidate[];
  address?: string;
  items: PItem[];
  total_price?: number;
  comment?: string;
  operator?: string;
  where_deliver?: "center" | "address";
  is_replacement?: boolean;
  replaced_order_id?: string;
  replacement_candidates?: ReplacementCandidate[];
  // Operator ANIQ tasdiqlamaguncha almashtirish kuchga kirmaydi (avto-topilsa ham).
  replacement_confirmed?: boolean;
  createError?: string; // yaratishда server xatosi (kartada ko'rsatiladi)
}
interface CreatedRow {
  order_number?: number;
  customer_name?: string;
  phone_number?: string;
  district_label?: string;
  total_price?: number;
  items: number;
  is_replacement?: boolean;
  created_at?: number;
}
interface ParseResponse {
  ok: boolean;
  reason?: string;
  balance?: number;
  price?: number;
  orders?: Omit<Preview, "id">[];
  reanalysis_charged?: boolean;
}
interface ConfirmResponse {
  results: {
    ok: boolean;
    reason?: string;
    order_number?: number;
    balance?: number;
    customer_name?: string;
  }[];
}

function evalPreview(p: Preview): { ready: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!p.customer_name?.trim()) issues.push("mijoz ismi yo'q");
  if (!p.phone_number?.trim()) issues.push("telefon yo'q");
  else if (!cleanPhone(p.phone_number)) issues.push("telefon noto'g'ri");
  if (!p.region_id) issues.push("viloyat tanlang");
  else if (!p.district_id) issues.push("tuman/shahar tanlang");
  // Almashtirish faqat operator TASDIQLAGANDA kuchga kiradi (avto-topilsa ham).
  const isRepl = !!(p.replacement_confirmed && p.replaced_order_id);
  if (p.replacement_confirmed && !p.replaced_order_id)
    issues.push("eski buyurtmani tanlang");
  // Narx: tasdiqlangan almashtirishda 0 ruxsat; aks holda > 0.
  if (isRepl) {
    if (p.total_price == null) issues.push("narx yozing (0 bo'lsa 0)");
  } else if (p.total_price == null || p.total_price <= 0) {
    issues.push("narx noto'g'ri");
  } else if (p.total_price < 1000) {
    // "250 ming" -> 250 kabi 1000x kam o'qish — ogohlantiramiz.
    issues.push("narx juda kichik — tekshiring");
  }
  if (!p.items.length) issues.push("mahsulot yo'q");
  p.items.forEach((it) => {
    if (!it.product_id)
      issues.push(
        `"${it.name}": ${it.candidates?.length ? "tanlang" : "katalogda yo'q"}`
      );
  });
  return { ready: issues.length === 0, issues };
}

function reasonText(r?: string): string {
  switch (r) {
    case "ai_off":
      return "AI sozlanmagan.";
    case "no_market":
      return "Market aniqlanmadi. Marketni qaytadan tanlang.";
    case "disabled":
      return "Bu market uchun AI yoqilmagan.";
    case "insufficient":
      return "AI balansi yetarli emas — to'lov qiling yoki qo'lda to'ldiring.";
    case "ai_error":
      return "AI matndan buyurtma topa olmadi. Matnni aniqroq yozing.";
    case "invalid_price":
      return "Narx noto'g'ri (0 dan katta bo'lishi kerak).";
    case "duplicate":
      return "Dublikat — bu buyurtma allaqachon yuborilgan.";
    case "create_failed":
      return "Yaratilmadi — maydonlarni tekshiring (mahsulot/tuman).";
    default:
      return "Xatolik yuz berdi.";
  }
}

// ─── Qadam ko'rsatkichi (qo'lda buyurtma sahifasi bilan bir xil) ───
type StepState = "done" | "current" | "pending";
const StepCircle = ({
  state,
  nextState,
  children,
  last,
}: {
  state: StepState;
  nextState?: StepState;
  children: React.ReactNode;
  last?: boolean;
}) => (
  <div className="flex flex-col items-center">
    <div
      className={
        state === "done"
          ? "w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg"
          : state === "current"
          ? "w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg ring-4 ring-purple-100 dark:ring-purple-900/30"
          : "w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600"
      }
    >
      {children}
    </div>
    {!last && (
      <div
        className={`w-0.5 h-12 mt-2 ${
          state === "done"
            ? nextState === "current"
              ? "bg-gradient-to-b from-green-500 to-purple-500"
              : "bg-green-500"
            : "bg-gray-200 dark:bg-gray-700"
        }`}
      />
    )}
  </div>
);

const StepBadge = ({ state, label }: { state: StepState; label: string }) => (
  <span
    className={
      state === "done"
        ? "text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full"
        : state === "current"
        ? "text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full"
        : "text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full"
    }
  >
    {label}
  </span>
);

const AiCreateOrder = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useSelector((s: RootState) => s.roleSlice.role);
  const isAdmin =
    role === "admin" || role === "superadmin" || role === "registrator";
  const isMarketOrOperator = role === "market" || role === "operator";

  const market = useMemo(
    () => JSON.parse(localStorage.getItem("aiMarket") ?? "null"),
    []
  );

  // #7: admin marketsiz to'g'ridan kirsa — market tanlashga qaytaramiz
  useEffect(() => {
    if (isAdmin && !market?.id) {
      navigate(buildAdminPath("orders/choose-market"), { replace: true });
    }
  }, [isAdmin, market, navigate]);

  const [text, setText] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [created, setCreated] = useState<CreatedRow[]>([]);
  const [parseErr, setParseErr] = useState<ParseResponse | null>(null);
  // Yaratilgan buyurtmalar imzosi — qayta tahlilда ular qayta chiqib, ikkinchi
  // marta yaratilib qolmasin (dublikat himoya).
  const createdSigs = useRef<Set<string>>(new Set());

  // Barcha viloyat + tuman/shaharlar (tahrirlash Select'lari uchun) — bir marta.
  const geoQ = useQuery({
    queryKey: ["ai-geo"],
    queryFn: () =>
      api.get("order/ai-geo").then(
        (r) =>
          r.data as {
            regions: { id: string; name: string }[];
            districts: { id: string; name: string; region_id: string }[];
          }
      ),
    staleTime: 1000 * 60 * 60,
  });
  const regions = geoQ.data?.regions ?? [];
  const allDistricts = geoQ.data?.districts ?? [];

  // Market mahsulotlari (topilmasa/noaniqda qo'lda tanlash uchun).
  const productsQ = useQuery({
    queryKey: ["ai-products", market?.id],
    queryFn: () =>
      api
        .get("order/ai-products", { params: { market_id: market?.id } })
        .then((r) => r.data as { id: string; name: string }[]),
    staleTime: 1000 * 60 * 10,
    // Market/operator uchun market_id yo'q bo'lsa ham backend JWT'dan oladi.
    enabled: !!market?.id || isMarketOrOperator,
  });
  const allProducts = productsQ.data ?? [];

  const parseM = useMutation({
    mutationFn: () =>
      api
        .post("order/ai-parse", { text: text.trim(), market_id: market?.id })
        .then((r) => r.data as ParseResponse),
    onSuccess: (data) => {
      if (data.ok && data.orders?.length) {
        setParseErr(null);
        const mapped = data.orders.map((o, i) => ({
          ...o,
          id: `p${Date.now()}_${i}`,
        }));
        // Allaqachon yaratilgan buyurtmalarni qayta ko'rsatmaymiz (dublikat himoya).
        const fresh = mapped.filter(
          (o) => !createdSigs.current.has(previewSig(o))
        );
        setPreviews(fresh);
        const skipped = mapped.length - fresh.length;
        if (skipped > 0) {
          message.info(
            `${skipped} ta allaqachon yaratilgan buyurtma o'tkazib yuborildi`
          );
        }
        if (data.reanalysis_charged) {
          message.warning(
            "3 tahlildan oshdi — 1 buyurtma narxida balansdan yechildi."
          );
          qc.invalidateQueries({ queryKey: ["ai-availability"] });
        }
      } else {
        setPreviews([]);
        setParseErr(data);
      }
    },
    onError: () => message.error("Server xatosi. Qayta urinib ko'ring."),
  });

  const createM = useMutation({
    mutationFn: (toCreate: Preview[]) =>
      api
        .post("order/ai-create-confirmed", {
          market_id: market?.id,
          orders: toCreate.map((p) => ({
            customer_name: p.customer_name,
            phone_number: cleanPhone(p.phone_number),
            extra_number: p.extra_number || undefined,
            district_id: p.district_id,
            address: p.address || undefined,
            order_item_info: p.items.map((i) => ({
              product_id: i.product_id,
              quantity: i.quantity,
            })),
            total_price: p.total_price,
            comment: p.comment || undefined,
            operator: p.operator || undefined,
            where_deliver: p.where_deliver || undefined,
            // Faqat operator tasdiqlagan bo'lsa almashtirish sifatida jo'natiladi.
            replaced_order_id:
              p.replacement_confirmed && p.replaced_order_id
                ? p.replaced_order_id
                : undefined,
          })),
        })
        .then((r) => r.data as ConfirmResponse),
    onSuccess: (data, toCreate) => {
      const okRows: CreatedRow[] = [];
      const createdIds = new Set<string>();
      let insuff = 0;
      let dup = 0;
      let other = 0;
      const errById = new Map<string, string>();
      const failNames: string[] = [];
      data.results.forEach((r, i) => {
        if (r.ok) {
          createdIds.add(toCreate[i].id);
          createdSigs.current.add(previewSig(toCreate[i])); // dublikat himoya
          okRows.push({
            order_number: r.order_number,
            customer_name: r.customer_name || toCreate[i].customer_name,
            phone_number: toCreate[i].phone_number,
            district_label: toCreate[i].district_name,
            total_price: toCreate[i].total_price,
            items: toCreate[i].items.length,
            is_replacement: !!(
              toCreate[i].replacement_confirmed &&
              toCreate[i].replaced_order_id
            ),
            created_at: Date.now(),
          });
        } else {
          if (r.reason === "insufficient") insuff++;
          else if (r.reason === "duplicate") dup++;
          else other++;
          // Kartaga aynan sababni yozamiz (yashil "Tayyor" bo'lib qolmasin).
          errById.set(toCreate[i].id, reasonText(r.reason));
          failNames.push(
            `${toCreate[i].customer_name || "Ismsiz"}: ${reasonText(r.reason)}`
          );
        }
      });
      if (okRows.length) {
        setCreated((prev) => [...okRows, ...prev]);
        message.success(`✅ ${okRows.length} ta buyurtma yaratildi`);
        qc.invalidateQueries();
        // Matnni tozalaymiz — xuddi shu matnni qayta tahlil qilib buyurtmani
        // ikkinchi marta yaratib qo'ymaslik uchun (parse tugmasi ham o'chadi).
        setText("");
        setParseErr(null);
      }
      // Yaratilganlarni olib tashlaymiz, muvaffaqiyatsizlarga xato belgisini qo'yamiz.
      setPreviews((prev) =>
        prev
          .filter((p) => !createdIds.has(p.id))
          .map((p) =>
            errById.has(p.id)
              ? { ...p, createError: errById.get(p.id) }
              : p
          )
      );
      if (insuff)
        message.warning(`${insuff} ta buyurtma yaratilmadi — balans yetmadi`);
      if (dup) message.warning(`${dup} ta dublikat o'tkazib yuborildi`);
      if (other && failNames.length)
        message.error(failNames.join(" · "));
    },
    onError: () => message.error("Server xatosi. Qayta urinib ko'ring."),
  });

  const busy = createM.isPending;
  const updatePreview = (id: string, patch: Partial<Preview>) =>
    setPreviews((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  const updateItem = (id: string, idx: number, patch: Partial<PItem>) =>
    setPreviews((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              items: p.items.map((it, i) =>
                i === idx ? { ...it, ...patch } : it
              ),
            }
          : p
      )
    );
  const removePreview = (id: string) =>
    setPreviews((prev) => prev.filter((p) => p.id !== id));
  const addItem = (id: string) =>
    setPreviews((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, items: [...p.items, { name: "", quantity: 1 }] }
          : p
      )
    );
  const removeItem = (id: string, idx: number) =>
    setPreviews((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, items: p.items.filter((_, i) => i !== idx) }
          : p
      )
    );

  const readyList = previews.filter((p) => evalPreview(p).ready);

  // Qayta tahlil joriy (tahrirlangan, tasdiqlanmagan) kartalarni o'chiradi —
  // avval tasdiq so'raymiz (tahrirlar bekorga yo'qolmasin).
  const handleParse = () => {
    if (
      previews.length > 0 &&
      !window.confirm(
        "Joriy tasdiqlanmagan buyurtmalar (va tahrirlaringiz) o'chib, matn qayta tahlil qilinadi. Davom etasizmi?"
      )
    )
      return;
    parseM.mutate();
  };
  const createdTotal = created.reduce((s, c) => s + (c.total_price || 0), 0);

  // Qadam holatlari
  const hasPreviews = previews.length > 0;
  const step2: StepState = hasPreviews ? "done" : "current";
  const step3: StepState = hasPreviews ? "current" : "pending";

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate(buildAdminPath("orders"))}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-[#2A263D] shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              AI orqali buyurtma
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Matn yozing — AI buyurtma(lar)ni to'ldiradi, siz tasdiqlaysiz
            </p>
          </div>
        </div>

        <div className="flex gap-6 max-[1100px]:flex-col">
          {/* Steps Sidebar */}
          <div className="w-full max-w-xs max-[1100px]:max-w-full flex-shrink-0">
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-5 sticky top-6">
              {/* Step 1 — Market (faqat admin/registrator) */}
              {!isMarketOrOperator && (
                <div className="flex items-start gap-4">
                  <StepCircle state="done" nextState={step2}>
                    <Check className="w-5 h-5 text-white" />
                  </StepCircle>
                  <div className="flex-1 pt-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StepBadge state="done" label="1-qadam" />
                      <Check className="w-4 h-4 text-green-500" />
                    </div>
                    <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                      Market tanlandi
                    </h3>
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <Store className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <p
                          className="font-medium text-gray-800 dark:text-white text-sm capitalize truncate"
                          title={market?.name}
                        >
                          {market?.name || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 — Matn kiritish */}
              <div className="flex items-start gap-4">
                <StepCircle state={step2} nextState={step3}>
                  {step2 === "done" ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </StepCircle>
                <div className="flex-1 pt-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StepBadge
                      state={step2}
                      label={isMarketOrOperator ? "1-qadam" : "2-qadam"}
                    />
                    {step2 === "current" && (
                      <span className="text-xs text-purple-500">Hozirgi</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    Matn kiritish
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Buyurtma matnini yozing va tahlil qiling
                  </p>
                </div>
              </div>

              {/* Step 3 — Tasdiqlash & yaratish */}
              <div className="flex items-start gap-4">
                <StepCircle state={step3} last>
                  <CheckCircle2
                    className={`w-5 h-5 ${
                      step3 === "pending"
                        ? "text-gray-400 dark:text-gray-500"
                        : "text-white"
                    }`}
                  />
                </StepCircle>
                <div className="flex-1 pt-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StepBadge
                      state={step3}
                      label={isMarketOrOperator ? "2-qadam" : "3-qadam"}
                    />
                    {step3 === "current" && (
                      <span className="text-xs text-purple-500">Hozirgi</span>
                    )}
                  </div>
                  <h3
                    className={`font-semibold text-sm ${
                      step3 === "pending"
                        ? "text-gray-400 dark:text-gray-500"
                        : "text-gray-800 dark:text-white"
                    }`}
                  >
                    Tasdiqlash & yaratish
                  </h3>

                  {(hasPreviews || created.length > 0) && (
                    <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 space-y-1">
                      {hasPreviews && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">
                            Topildi / tayyor:
                          </span>
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            {previews.length} / {readyList.length}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">
                          Yaratildi:
                        </span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {created.length} ta
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-5 min-w-0">
            {/* Textarea card */}
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Buyurtma matni
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Bir yoki bir nechta buyurtmani alohida qatorlarda yozing
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={4000}
                  placeholder={
                    "Masalan:\n" +
                    "Dilnoza, 901112233, Toshkent Chilonzor, 2 dona olma, 150 ming\n" +
                    "Akmal, 935556677, Andijon Asaka, 1 televizor, 3 mln"
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-y leading-relaxed min-h-[120px] max-h-[70vh]"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-gray-400">
                    {text.length}/4000 belgi
                  </span>
                  <button
                    onClick={handleParse}
                    disabled={!text.trim() || parseM.isPending}
                    className={`h-11 px-6 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                      !text.trim() || parseM.isPending
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/25 cursor-pointer"
                    }`}
                  >
                    {parseM.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Tahlil
                        qilinmoqda...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Tahlil qilish
                      </>
                    )}
                  </button>
                </div>

                {parseErr && !parseErr.ok && (
                  <div
                    className={`rounded-xl p-3 text-sm flex items-start gap-2 ${
                      parseErr.reason === "insufficient"
                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div>{reasonText(parseErr.reason)}</div>
                      {parseErr.reason === "insufficient" &&
                        parseErr.balance != null &&
                        parseErr.price != null && (
                          <div className="text-xs mt-1 flex items-center gap-1">
                            <Wallet className="w-3 h-3" /> Balans:{" "}
                            {som(parseErr.balance)} so'm · kerak:{" "}
                            {som(parseErr.price)} so'm
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation cards */}
            {hasPreviews && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-purple-500" />
                    Tasdiqlash
                    <span className="text-sm font-normal text-gray-400">
                      ({previews.length} ta topildi)
                    </span>
                  </h2>
                  <button
                    onClick={() => createM.mutate(readyList)}
                    disabled={readyList.length === 0 || busy}
                    className={`h-11 px-5 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                      readyList.length === 0 || busy
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/25 cursor-pointer"
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Tayyorlarni yaratish ({readyList.length})
                  </button>
                </div>

                {previews.map((p, cardIdx) => {
                  const { ready, issues } = evalPreview(p);
                  return (
                    <div
                      key={p.id}
                      className={`bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden border border-l-[5px] ${
                        ready
                          ? "border-green-200 dark:border-green-900/40 border-l-green-500"
                          : "border-amber-200 dark:border-amber-900/40 border-l-amber-500"
                      }`}
                    >
                      {/* header — buyurtmani ajratib turadi (raqam + mijoz ismi) */}
                      <div
                        className={`px-3 py-2.5 flex items-center justify-between gap-2 border-b ${
                          ready
                            ? "bg-green-50/60 dark:bg-green-900/10 border-green-100 dark:border-green-900/30"
                            : "bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              ready
                                ? "bg-green-500 text-white"
                                : "bg-amber-500 text-white"
                            }`}
                          >
                            {cardIdx + 1}
                          </span>
                          <span className="font-semibold text-sm text-gray-800 dark:text-white truncate">
                            {p.customer_name?.trim() || "Ismsiz buyurtma"}
                          </span>
                          {ready ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> Tayyor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                              <AlertTriangle className="w-3 h-3" />{" "}
                              {issues.length} ta kamchilik
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => createM.mutate([p])}
                            disabled={!ready || busy}
                            className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${
                              !ready || busy
                                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-md cursor-pointer"
                            }`}
                          >
                            Yaratish
                          </button>
                          <button
                            onClick={() => removePreview(p.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 space-y-2.5">
                        {/* fields — zich 3 ustun */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <div>
                            <label className={labelCls}>
                              <User className="w-3.5 h-3.5" /> Mijoz
                            </label>
                            <input
                              value={p.customer_name || ""}
                              placeholder="Ism"
                              onChange={(e) =>
                                updatePreview(p.id, {
                                  customer_name: e.target.value,
                                })
                              }
                              className={`${inputCls} ${
                                p.customer_name?.trim() ? okBorder : errBorder
                              }`}
                            />
                            {!p.customer_name?.trim() && (
                              <FieldHint>Mijoz ismi kerak</FieldHint>
                            )}
                          </div>
                          <div>
                            <label className={labelCls}>
                              <Phone className="w-3.5 h-3.5" /> Telefon
                            </label>
                            <input
                              value={p.phone_number || ""}
                              placeholder="+998..."
                              onChange={(e) =>
                                updatePreview(p.id, {
                                  phone_number: e.target.value,
                                })
                              }
                              className={`${inputCls} ${
                                p.phone_number?.trim() ? okBorder : errBorder
                              }`}
                            />
                            {!p.phone_number?.trim() ? (
                              <FieldHint>Telefon raqam kerak</FieldHint>
                            ) : !cleanPhone(p.phone_number) ? (
                              <FieldHint>
                                Telefon noto'g'ri (+998XXXXXXXXX)
                              </FieldHint>
                            ) : null}
                          </div>
                          <div>
                            <label className={labelCls}>
                              <Phone className="w-3.5 h-3.5" /> Qo'shimcha raqam
                            </label>
                            <input
                              value={p.extra_number || ""}
                              placeholder="ixtiyoriy"
                              onChange={(e) =>
                                updatePreview(p.id, {
                                  extra_number: e.target.value,
                                })
                              }
                              className={`${inputCls} ${okBorder}`}
                            />
                          </div>
                          {/* Viloyat — barcha viloyatlar (DB), tahrirlanadi */}
                          <div>
                            <label className={labelCls}>
                              <MapPin className="w-3.5 h-3.5" /> Viloyat
                            </label>
                            <Select
                              showSearch
                              optionFilterProp="label"
                              className={`w-full ${selSel}`}
                              placeholder="Viloyatni tanlang"
                              status={!p.region_id ? "error" : undefined}
                              value={p.region_id}
                              loading={geoQ.isLoading}
                              options={regions.map((r) => ({
                                value: r.id,
                                label: r.name,
                              }))}
                              onChange={(v) => {
                                const r = regions.find((x) => x.id === v);
                                updatePreview(p.id, {
                                  region_id: v,
                                  region_name: r?.name,
                                  district_id: undefined,
                                  district_name: undefined,
                                });
                              }}
                            />
                            {!p.region_id && (
                              <FieldHint>Viloyat tanlanmagan</FieldHint>
                            )}
                          </div>
                          {/* Tuman / Shahar — tanlangan viloyat tumanlari (DB) */}
                          <div>
                            <label className={labelCls}>
                              <MapPin className="w-3.5 h-3.5" /> Tuman / Shahar
                            </label>
                            <Select
                              showSearch
                              optionFilterProp="label"
                              className={`w-full ${selSel}`}
                              placeholder={
                                p.region_id
                                  ? "Tuman/shaharni tanlang"
                                  : "Avval viloyatni tanlang"
                              }
                              status={!p.district_id ? "error" : undefined}
                              value={p.district_id}
                              disabled={!p.region_id}
                              options={allDistricts
                                .filter((d) => d.region_id === p.region_id)
                                .map((d) => ({ value: d.id, label: d.name }))}
                              onChange={(v) => {
                                const d = allDistricts.find((x) => x.id === v);
                                updatePreview(p.id, {
                                  district_id: v,
                                  district_name: d?.name,
                                });
                              }}
                            />
                            {p.region_id && !p.district_id && (
                              <FieldHint>Tuman/shahar tanlanmagan</FieldHint>
                            )}
                          </div>
                          <div>
                            <label className={labelCls}>
                              <Wallet className="w-3.5 h-3.5" /> Narx (so'm)
                            </label>
                            <input
                              inputMode="numeric"
                              value={
                                p.total_price != null ? som(p.total_price) : ""
                              }
                              placeholder="0"
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "");
                                updatePreview(p.id, {
                                  total_price: digits ? Number(digits) : undefined,
                                });
                              }}
                              className={`${inputCls} ${
                                p.replacement_confirmed && p.replaced_order_id
                                  ? p.total_price != null
                                    ? okBorder
                                    : errBorder
                                  : p.total_price && p.total_price >= 1000
                                    ? okBorder
                                    : errBorder
                              }`}
                            />
                            {p.replacement_confirmed && p.replaced_order_id ? (
                              p.total_price == null && (
                                <FieldHint>Narx kerak (0 bo'lsa 0 yozing)</FieldHint>
                              )
                            ) : !(p.total_price && p.total_price > 0) ? (
                              <FieldHint>Narx kerak (0 dan katta)</FieldHint>
                            ) : p.total_price < 1000 ? (
                              <FieldHint>Juda kichik — "ming"da?</FieldHint>
                            ) : null}
                          </div>
                          {/* Mutaxassis (operator) */}
                          <div>
                            <label className={labelCls}>
                              <User className="w-3.5 h-3.5" /> Mutaxassis
                            </label>
                            <input
                              value={p.operator || ""}
                              placeholder="ixtiyoriy"
                              onChange={(e) =>
                                updatePreview(p.id, { operator: e.target.value })
                              }
                              className={`${inputCls} ${okBorder}`}
                            />
                          </div>
                          {/* Manzil */}
                          <div className="sm:col-span-2 md:col-span-3">
                            <label className={labelCls}>
                              <MapPin className="w-3.5 h-3.5" /> Manzil (ixtiyoriy)
                            </label>
                            <input
                              value={p.address || ""}
                              placeholder="Ko'cha, uy..."
                              onChange={(e) =>
                                updatePreview(p.id, { address: e.target.value })
                              }
                              className={`${inputCls} ${okBorder}`}
                            />
                          </div>
                        </div>

                        {/* Yetkazish turi */}
                        <div>
                          <label className={labelCls}>
                            <Truck className="w-3.5 h-3.5" /> Yetkazish turi
                          </label>
                          <div className="flex gap-1.5">
                            {(
                              [
                                { v: "center", label: "Markazdan olib ketadi" },
                                { v: "address", label: "Manzilga yetkazish" },
                              ] as const
                            ).map((opt) => {
                              const active =
                                (p.where_deliver || "center") === opt.v;
                              return (
                                <button
                                  key={opt.v}
                                  type="button"
                                  onClick={() =>
                                    updatePreview(p.id, { where_deliver: opt.v })
                                  }
                                  className={`flex-1 h-8 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                    active
                                      ? "bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300"
                                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-purple-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* items */}
                        <div className="space-y-1.5">
                          <label
                            className={`${labelCls} ${
                              p.items.length === 0 ||
                              p.items.some((it) => !it.product_id)
                                ? "!text-red-500 dark:!text-red-400"
                                : ""
                            }`}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" /> Mahsulotlar
                            {p.items.some((it) => !it.product_id) && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                                {p.items.filter((it) => !it.product_id).length}{" "}
                                aniqlanmagan
                              </span>
                            )}
                          </label>
                          {p.items.length === 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-red-500 rounded-lg bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/50 px-2 py-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              Mahsulot topilmadi — pastdan qo'shing
                            </div>
                          )}
                          {p.items.map((it, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border ${
                                it.product_id
                                  ? "bg-gray-50 dark:bg-gray-800/50 border-transparent"
                                  : "bg-red-50 dark:bg-red-900/15 border-red-300 dark:border-red-800/60"
                              }`}
                            >
                              <input
                                inputMode="numeric"
                                value={it.quantity}
                                onChange={(e) =>
                                  updateItem(p.id, idx, {
                                    quantity: Math.max(
                                      1,
                                      Number(e.target.value.replace(/\D/g, "")) ||
                                        1
                                    ),
                                  })
                                }
                                className="w-11 h-8 px-1.5 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                              <span className="text-xs text-gray-400">×</span>
                              {it.product_id ? (
                                <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                  {it.resolved_name || it.name}
                                </span>
                              ) : (
                                <Select
                                  showSearch
                                  optionFilterProp="label"
                                  className={`flex-1 ${selSel}`}
                                  status={it.candidates?.length ? "warning" : "error"}
                                  loading={productsQ.isLoading}
                                  placeholder={
                                    it.candidates?.length
                                      ? `"${it.name}" — qaysi biri?`
                                      : `"${it.name}" topilmadi — ro'yxatdan tanlang`
                                  }
                                  value={undefined}
                                  options={(() => {
                                    const candIds = new Set(
                                      (it.candidates ?? []).map((c) => c.id)
                                    );
                                    const groups: {
                                      label: string;
                                      options: { value: string; label: string }[];
                                    }[] = [];
                                    if (it.candidates?.length) {
                                      groups.push({
                                        label: "AI o'xshashini topdi",
                                        options: it.candidates.map((c) => ({
                                          value: c.id,
                                          label: c.name,
                                        })),
                                      });
                                    }
                                    groups.push({
                                      label: "Barcha mahsulotlar",
                                      options: allProducts
                                        .filter((pr) => !candIds.has(pr.id))
                                        .map((pr) => ({
                                          value: pr.id,
                                          label: pr.name,
                                        })),
                                    });
                                    return groups;
                                  })()}
                                  onChange={(v) => {
                                    const prod =
                                      allProducts.find((x) => x.id === v) ||
                                      it.candidates?.find((x) => x.id === v);
                                    updateItem(p.id, idx, {
                                      product_id: v,
                                      resolved_name: prod?.name,
                                    });
                                  }}
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeItem(p.id, idx)}
                                title="Olib tashlash"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addItem(p.id)}
                            className="flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg px-2 py-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Mahsulot qo'shish
                          </button>
                        </div>

                        {/* Almashtirish (AI avto-aniqladi — operator TASDIQLAYDI) */}
                        {(p.is_replacement ||
                          !!p.replacement_candidates?.length) && (
                          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 p-3 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                              <Repeat className="w-3.5 h-3.5" /> AI buni
                              almashtirish deb topdi
                            </div>
                            {p.replacement_candidates?.length ? (
                              <>
                                <label className="flex items-start gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!p.replacement_confirmed}
                                    onChange={(e) =>
                                      updatePreview(p.id, {
                                        replacement_confirmed: e.target.checked,
                                      })
                                    }
                                    className="mt-0.5 w-4 h-4 accent-amber-600 cursor-pointer flex-shrink-0"
                                  />
                                  <span className="text-xs text-amber-800 dark:text-amber-300">
                                    Ha, almashtirish sifatida yaratilsin — eski
                                    buyurtma kuryer orqali qaytariladi (narx 0
                                    bo'lishi mumkin).
                                  </span>
                                </label>
                                {p.replacement_confirmed ? (
                                  <Select
                                    className={`w-full ${selSel}`}
                                    value={p.replaced_order_id}
                                    placeholder="Eski buyurtmani tanlang"
                                    status={
                                      !p.replaced_order_id ? "error" : undefined
                                    }
                                    allowClear
                                    onChange={(v) =>
                                      updatePreview(p.id, {
                                        replaced_order_id: v || undefined,
                                      })
                                    }
                                    options={p.replacement_candidates.map(
                                      (c) => ({
                                        value: c.id,
                                        label: `#${c.order_number} · ${formatDate(
                                          c.created_at
                                        )} · ${c.items} · ${som(
                                          c.total_price
                                        )} so'm`,
                                      })
                                    )}
                                  />
                                ) : (
                                  <p className="text-[11px] text-gray-400">
                                    Tasdiqlanmasa — oddiy buyurtma sifatida
                                    yaratiladi (narx &gt; 0 kerak).
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                                Bu telefon bo'yicha sotilgan eski buyurtma
                                topilmadi — oddiy buyurtma sifatida yaratiladi.
                              </p>
                            )}
                          </div>
                        )}

                        {p.comment && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                            <span>💬</span>
                            <span>{p.comment}</span>
                          </div>
                        )}
                        {!ready && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>{issues.join(" · ")}</span>
                          </div>
                        )}
                        {p.createError && (
                          <div className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 p-2">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>Yaratilmadi: {p.createError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Created orders — asosiy buyurtmalar jadvali bilan bir xil */}
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <h2 className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                  </div>
                  Yaratilgan buyurtmalar
                  {created.length > 0 && (
                    <span className="text-sm font-normal text-gray-400">
                      ({created.length} ta)
                    </span>
                  )}
                </h2>
                {created.length > 0 && (
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Jami: {som(createdTotal)} so'm
                  </span>
                )}
              </div>

              {created.length === 0 ? (
                <div className="bg-white dark:bg-[#2A2640] rounded-xl shadow-sm py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <ShoppingCart className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-400">
                    Hali buyurtma yaratilmadi
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Yuqorida matn yozib, tasdiqlangach shu yerda ko'rinadi
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#2A2640] rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                          <th className="px-4 py-4 text-left text-sm font-semibold w-12">
                            #
                          </th>
                          <th className="px-4 py-4 text-left text-sm font-semibold min-w-[180px] max-w-[250px]">
                            Mijoz
                          </th>
                          <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">
                            Telefon
                          </th>
                          <th className="px-4 py-4 text-left text-sm font-semibold min-w-[100px]">
                            Tuman
                          </th>
                          <th className="px-4 py-4 text-left text-sm font-semibold min-w-[100px]">
                            Market
                          </th>
                          <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">
                            Holat
                          </th>
                          <th className="px-4 py-4 text-right text-sm font-semibold whitespace-nowrap">
                            Narx
                          </th>
                          <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">
                            Sana
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {created.map((c, i) => (
                          <tr
                            key={i}
                            className="hover:bg-purple-50 dark:hover:bg-[#3d3759] transition-colors group"
                          >
                            <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {i + 1}
                            </td>
                            <td className="px-4 py-4 max-w-[250px]">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                  <User className="w-4 h-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                  <span
                                    className="font-medium text-gray-800 dark:text-white truncate block capitalize"
                                    title={c.customer_name}
                                  >
                                    {c.customer_name || "—"}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    {c.order_number != null && (
                                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                                        #{c.order_number}
                                      </span>
                                    )}
                                    {c.is_replacement && (
                                      <span
                                        title="Almashtirish"
                                        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded"
                                      >
                                        <Repeat className="w-2.5 h-2.5" />
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {formatPhone(c.phone_number)}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate">
                                  {c.district_label || "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                              <span className="truncate block capitalize">
                                {market?.name || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                                Yangi
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                              <span className="font-semibold text-gray-800 dark:text-white">
                                {som(c.total_price)}
                              </span>
                              <span className="text-xs text-gray-500 ml-1">
                                so'm
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {formatDateTime(c.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(AiCreateOrder);
