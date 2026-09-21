import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, message } from "antd";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Building2,
  CheckCircle,
  ChevronRight,
  Home,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  QrCode,
  RotateCcw,
  Search,
  Store,
  Wallet,
  X,
} from "lucide-react";
import {
  MARKETPLACE_REJECT_REASONS,
  useMarketplaceAvailable,
  useMarketplaceScan,
  type MarketplaceRejectReason,
  type MarketplaceScanOutcome,
} from "../../shared/api/hooks/useMarketplaceScan";

const money = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("ru-RU") : "—";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

const errStatus = (e: unknown): number | undefined =>
  (e as { response?: { status?: number } })?.response?.status;

/**
 * Circuit breaker ochilganda server 503 va «N soniyadan keyin» qaytaradi.
 *
 * Xato kontrakti maydonlarni tekislaydi (`{message, error}` — faqat
 * STRING), shuning uchun soniya MATNDAN olinadi. Topilmasa — breaker'ning
 * sovish davri (60 s) zaxira sifatida ishlatiladi.
 */
const PAUSE_FALLBACK_SEC = 60;
const pauseSecondsFrom = (e: unknown): number | null => {
  if (errStatus(e) !== 503) return null;
  const m = /(\d+)\s*soniya/.exec(errText(e, ""));
  return m ? Number(m[1]) : PAUSE_FALLBACK_SEC;
};

/** `+998 90 123 45 67` ko'rinishi — «Tashqi saytlar» oqimidagi bilan bir xil. */
const prettyPhone = (raw: string): string => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 9)
    return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(
      7,
    )}`;
  if (d.length === 12 && d.startsWith("998"))
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(
      8,
      10,
    )} ${d.slice(10)}`;
  return raw;
};

/* ─────────────────────── OVOZLI SIGNAL ───────────────────────
 * Operator ekranga qaramaydi — qo'lida skaner, ko'zi qutida. «Tashqi
 * saytlar» oqimida allaqachon shunday: muvaffaqiyatda «bip», xatoda
 * boshqa ovoz. O'SHA ikki fayl qayta ishlatiladi, yangisi qo'shilmaydi.
 */
const BASE_URL = import.meta.env.BASE_URL || "/";
let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

if (typeof window !== "undefined") {
  try {
    successAudio = new Audio(`${BASE_URL}sound/beep.mp3`);
    successAudio.volume = 0.8;
    successAudio.load();

    errorAudio = new Audio(`${BASE_URL}sound/error.mp3`);
    errorAudio.volume = 1.0;
    errorAudio.load();
  } catch {
    /* ovozsiz ishlayveradi */
  }
}

const playSuccessSound = () => {
  try {
    if (successAudio) {
      successAudio.currentTime = 0;
      successAudio.play().catch(() => {});
    }
  } catch {
    /* ignore */
  }
};

const playErrorSound = () => {
  try {
    if (errorAudio) {
      errorAudio.currentTime = 0;
      errorAudio.play().catch(() => {});
    }
  } catch {
    /* ignore */
  }
};

/**
 * ⚠️ `crypto.randomUUID` HTTPS yoki localhost'dagina bor. Planshet HTTP
 * orqali ochilsa u `undefined` bo'ladi va qabul qilish butunlay ishlamay
 * qolardi — shuning uchun zaxira.
 */
const newIdempotencyKey = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  (c?.getRandomValues
    ? c.getRandomValues.bind(c)
    : (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++)
          arr[i] = Math.floor(Math.random() * 256);
        return arr;
      })(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20,
  )}-${h.slice(20)}`;
};

/**
 * MARKETPLACE QABUL EKRANI — operatorning kundalik ishi.
 *
 * ⚠️ HOLAT SERVERDA. Skanerlangan posilkalar ro'yxati brauzerda emas,
 * `marketplace_parcel` jadvalida yashaydi. Planshet o'chsa yoki sahifa
 * yangilansa, operator o'nlab posilkani qaytadan skanerlamaydi — ochiq
 * sessiya qayta tiklanadi.
 *
 * ⚠️ KO'RINISH «Tashqi saytlar» oqimi bilan BIR XIL. Operator kuniga
 * ikkalasida ham ishlaydi; boshqacha ekran uni sekinlashtiradi va xatoga
 * olib keladi. Shuning uchun bu yerda antd jadvali emas — o'sha oqimdagi
 * karta-ro'yxat, pulsatsiyalovchi skaner kartasi va ovozli signal.
 */
type Props = {
  /** Tashqi ro'yxatdan tanlangan ulanish (ichki rejim). */
  slug?: string;
  /** Ichki rejimda «Orqaga» — ro'yxatga qaytaradi, marshrutga EMAS. */
  onBack?: () => void;
};

const MarketplaceIntakePage = ({ slug: slugProp, onBack }: Props = {}) => {
  const navigate = useNavigate();
  /**
   * ⚠️ ICHKI REJIM: ekran «Bugungi buyurtmalar → Tashqi buyurtmalar»
   * ichida, adosh oqimi bilan BIR XIL joyda ochiladi. Operator uchun bu
   * bitta ish joyi — alohida sahifa uni chalg'itardi.
   */
  const embedded = !!slugProp;
  const [slug, setSlug] = useState<string | undefined>(slugProp);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<MarketplaceScanOutcome[]>([]);
  const [rejectFor, setRejectFor] = useState<MarketplaceScanOutcome | null>(
    null,
  );
  const [rejectReason, setRejectReason] =
    useState<MarketplaceRejectReason>("DAMAGED");
  const [rejectNote, setRejectNote] = useState("");
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [query, setQuery] = useState("");
  /**
   * ⚠️ Qidiruv maydoni fokusda bo'lsa skaner maydoniga fokus
   * QAYTARILMAYDI — aks holda yozilayotgan harflar o'g'irlanardi.
   */
  const [searchFocused, setSearchFocused] = useState(false);
  const [result, setResult] = useState<{
    accepted: Array<{ external_parcel_id: string; order_number: number }>;
    failed: Array<{ external_parcel_id: string; reason: string }>;
  } | null>(null);

  /**
   * ⚠️ Qabul kaliti BIR MARTA yaratiladi va muvaffaqiyatgacha SAQLANADI.
   * Qayta urinishda yangi kalit yuborilsa server uni yangi qop deb biladi
   * va buyurtmalar IKKI MARTA yaratilardi.
   */
  const idemKey = useRef<string>(newIdempotencyKey());
  const inputRef = useRef<HTMLInputElement>(null);

  // ⚠️ Sozlash ro'yxati EMAS — u admin-only. Bu endpoint registratorga
  // ham ochiq va faqat yoqilgan ulanishlarning nomini beradi.
  const available = useMarketplaceAvailable();
  const { session, openSession, scan, undoLast, reject, accept } =
    useMarketplaceScan(slug, sessionId);

  const integrations = useMemo(() => available.data ?? [], [available.data]);
  const current = useMemo(
    () => integrations.find((r) => r.slug === slug),
    [integrations, slug],
  );

  useEffect(() => {
    if (slugProp) {
      setSlug(slugProp);
      return;
    }
    if (!slug && integrations.length) setSlug(integrations[0].slug);
  }, [integrations, slug, slugProp]);

  // Ochiq sessiyani olish (yoki yangisini ochish).
  useEffect(() => {
    if (!slug) return;
    setSessionId(undefined);
    setRows([]);
    openSession
      .mutateAsync(slug)
      .then((s) => setSessionId(s.id))
      .catch((e) => message.error(errText(e, "Sessiyani ochib bo'lmadi")));
    // `openSession` mutatsiya obyekti har renderda yangi — bog'liqlikka
    // qo'shilsa cheksiz halqa bo'lardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /**
   * Caps Lock — skaner klaviatura emulyatsiyasi bo'lgani uchun QR kod
   * NOTO'G'RI o'qilishi mumkin. «Tashqi saytlar» oqimidagi bilan bir xil.
   */
  useEffect(() => {
    const onKeyEvent = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        setCapsLockOn(e.getModifierState("CapsLock"));
      }
    };
    window.addEventListener("keydown", onKeyEvent);
    window.addEventListener("keyup", onKeyEvent);
    return () => {
      window.removeEventListener("keydown", onKeyEvent);
      window.removeEventListener("keyup", onKeyEvent);
    };
  }, []);

  /**
   * Serverdagi sessiyani ekranga tiklash.
   *
   * Bazadagi qator `ScanOutcome` emas — `raw_payload` dan mijoz/sotuvchi
   * ma'lumotini qayta yig'amiz. Bloker/ogohlantirish saqlanmagani uchun
   * tiklangan qatorlarda ular bo'sh bo'ladi: ular skan PAYTIDAGI xabar,
   * qabulda server baribir qaytadan tekshiradi.
   */
  useEffect(() => {
    const data = session.data;
    if (!data) return;
    setRows((prev) => {
      // ⚠️ Bloker va ogohlantirishlar SERVERDA saqlanmaydi — ular skan
      // PAYTIDAGI xabar. Sessiya har skandan keyin qayta so'ralgani uchun
      // bu ro'yxat ularni O'CHIRIB yuborardi: operator «tuman topilmadi»
      // ogohlantirishini ko'rib, keyingi skanda uni yo'qotardi.
      const seen = new Map(prev.map((r) => [r.parcel_id, r]));
      return data.parcels
        .filter((p) => p.scan_state === "scanned")
        /**
         * ⚠️ OXIRGI SKAN ENG TEPADA.
         *
         * Server `scanned_at: ASC` qaytaradi (eng eskisi birinchi).
         * Skan paytida yangi qator tepaga qo'yilardi, lekin sessiya
         * qayta o'qilgach u PASTGA tushib ketardi — operator hozirgina
         * skanerlagan posilkasini ro'yxatdan qidirishga majbur bo'lardi.
         */
        .slice()
        .sort((a, b) => Number(b.scanned_at ?? 0) - Number(a.scanned_at ?? 0))
        .map((p) => {
          const raw = (p.raw_payload ?? {}) as Record<string, unknown>;
          const cust = (raw.customer ?? {}) as Record<string, unknown>;
          const seller = (raw.seller ?? {}) as Record<string, unknown>;
          return {
            parcel_id: p.id,
            external_parcel_id: p.external_parcel_id,
            external_order_id: p.external_order_id,
            qr_token: p.qr_token_raw,
            seller_id: p.seller_id,
            seller_name: (seller.seller_name as string | undefined) ?? null,
            customer_name: String(cust.full_name ?? "Marketplace mijozi"),
            phone: String(cust.phone ?? ""),
            district_name: p.district_name ?? null,
            address: cust.address ? String(cust.address) : null,
            cod_amount: Number(p.cod_amount ?? 0),
            prepaid: !!p.prepaid,
            parcel_index: p.parcel_index,
            parcel_count: p.parcel_count,
            where_deliver:
              String(raw.where_deliver ?? "center") === "address"
                ? "address"
                : "center",
            blockers: seen.get(p.id)?.blockers ?? [],
            warnings: seen.get(p.id)?.warnings ?? [],
            duplicate_in_session: false,
          } satisfies MarketplaceScanOutcome;
        });
    });
  }, [session.data]);

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  /**
   * ⚠️ FOKUS QAYTARILADI.
   *
   * Maydon ko'rinmaydi, shuning uchun operator uni yo'qotganini
   * SEZMAYDI — tasodifiy bosishdan keyin skanerlangan kod hech qayerga
   * tushmasdi va posilka «skanerlanmagan» bo'lib qolardi.
   *
   * Oyna ochiq bo'lsa TEGILMAYDI — aks holda fokusni oynadan tortib
   * olardi va u yerda yozib bo'lmasdi.
   */
  const modalOpen = !!rejectFor || confirmAccept || !!result;
  useEffect(() => {
    if (modalOpen || searchFocused) return;
    const t = setInterval(() => {
      const el = inputRef.current;
      if (el && document.activeElement !== el) el.focus();
    }, 700);
    return () => clearInterval(t);
  }, [modalOpen, searchFocused]);

  /**
   * ⚠️ SKANLAR KETMA-KET NAVBATDA ISHLANADI, maydon esa HECH QACHON
   * o'chirilmaydi.
   *
   * Haqiqiy skaner klaviatura kabi ishlaydi va juda tez yuboradi: bitta
   * so'rov ketayotganda ikkinchi kod keladi. Maydon `disabled` bo'lsa
   * o'sha bosishlar JIMGINA yo'qoladi — operator posilkani skanerladim
   * deb o'ylaydi, ro'yxatda esa u yo'q. Navbat bilan har kod o'z
   * navbatida serverga boradi.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [queueLength, setQueueLength] = useState(0);

  /**
   * SKANERLASH TO'XTATILGANI — turg'un holat.
   *
   * Avval faqat `message.error` chiqardi: u 3 soniyada yo'qoladi, keyin
   * operator yana skanerlaydi, yana yo'qoladi — va skaneri buzuq deb
   * o'ylaydi. Skaner kartasi sanoq tugaguncha QIZIL bo'lib turadi.
   */
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const pauseLeft =
    pausedUntil === null
      ? 0
      : Math.max(0, Math.ceil((pausedUntil - nowTick) / 1000));

  useEffect(() => {
    if (pausedUntil === null) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pausedUntil]);

  useEffect(() => {
    if (pausedUntil !== null && pauseLeft === 0) setPausedUntil(null);
  }, [pausedUntil, pauseLeft]);

  const doScan = (raw: string) => {
    const qr = raw.trim();
    if (!qr || !sessionId) return;
    setToken("");
    setQueueLength((n) => n + 1);
    queue.current = queue.current
      .then(() => runScan(qr, sessionId))
      .finally(() => setQueueLength((n) => Math.max(0, n - 1)));
  };

  const runScan = async (qr: string, sid: string) => {
    try {
      const outcome = await scan.mutateAsync({ session_id: sid, qr_token: qr });
      setRows((prev) => {
        // Ayni posilka qayta skanerlansa dublikat qator yaratmaymiz.
        const rest = prev.filter((r) => r.parcel_id !== outcome.parcel_id);
        return [outcome, ...rest];
      });
      if (outcome.blockers.length) {
        playErrorSound();
        message.error(outcome.blockers[0]);
      } else if (outcome.duplicate_in_session) {
        playErrorSound();
        message.warning("Bu posilka allaqachon skanerlangan");
      } else {
        playSuccessSound();
        message.success(`${outcome.external_parcel_id} qo'shildi`);
      }
      setPausedUntil(null); // aloqa tiklandi
    } catch (e) {
      playErrorSound();
      const sec = pauseSecondsFrom(e);
      if (sec !== null) setPausedUntil(Date.now() + sec * 1000);
      message.error(errText(e, "Skan qilib bo'lmadi"));
    } finally {
      focusInput();
    }
  };

  /**
   * KO'P QUTILI BUYURTMA TO'LIQLIGI.
   *
   * Server ham tekshiradi va chala buyurtmani qabul qilmaydi, lekin
   * operator buni QABULDAN OLDIN ko'rishi kerak — yo'qolgan quti hali
   * mashinada bo'lishi mumkin.
   */
  const incomplete = useMemo(() => {
    const byOrder = new Map<string, { seen: Set<number>; total: number }>();
    for (const r of rows) {
      const e = byOrder.get(r.external_order_id) ?? {
        seen: new Set<number>(),
        total: r.parcel_count,
      };
      e.seen.add(r.parcel_index);
      e.total = Math.max(e.total, r.parcel_count);
      byOrder.set(r.external_order_id, e);
    }
    return [...byOrder.entries()]
      .filter(([, v]) => v.seen.size < v.total)
      .map(([orderId, v]) => ({
        order_id: orderId,
        have: v.seen.size,
        total: v.total,
      }));
  }, [rows]);

  /**
   * QIDIRUV — posilka/buyurtma raqami, mijoz ismi yoki telefon bo'yicha.
   *
   * ⚠️ FAQAT KO'RINISHNI filtrlaydi. Jami summa, sanoq va «Qabul qilish»
   * BUTUN ro'yxat bo'yicha ishlaydi — aks holda operator qidiruv yoqiq
   * turganda «3 ta posilka» deb o'ylab, aslida 40 tasini qabul qilardi.
   */
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const digits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (r.external_parcel_id.toLowerCase().includes(q)) return true;
      if (r.external_order_id.toLowerCase().includes(q)) return true;
      if (r.customer_name.toLowerCase().includes(q)) return true;
      // Telefon: `+998 90 …` yozilsa ham, `901234567` yozilsa ham topilsin.
      if (digits && r.phone.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
  }, [rows, query]);

  const blocked = rows.filter((r) => r.blockers.length);
  const totalCod = rows.reduce((s, r) => s + Number(r.cod_amount ?? 0), 0);
  const canAccept = !!rows.length && incomplete.length === 0;
  /** Ish boshlangach skaner kartasi ixchamlashadi — ro'yxatga joy beradi. */
  const compact = rows.length > 0;

  const doAccept = async () => {
    if (!sessionId || !slug) return;
    try {
      const res = await accept.mutateAsync({
        session_id: sessionId,
        idempotency_key: idemKey.current,
      });
      setResult({ accepted: res.accepted, failed: res.failed });
      if (res.failed.length) playErrorSound();
      else playSuccessSound();
      // Muvaffaqiyatdan keyingina yangi kalit — keyingi qop uchun.
      idemKey.current = newIdempotencyKey();
      setRows([]);
      // Yangi sessiya ochamiz: eskisi `accepted` holatiga o'tdi.
      const s = await openSession.mutateAsync(slug);
      setSessionId(s.id);
    } catch (e) {
      playErrorSound();
      message.error(errText(e, "Qabul qilib bo'lmadi"));
    }
  };

  const doReject = async () => {
    if (!sessionId || !rejectFor) return;
    try {
      await reject.mutateAsync({
        session_id: sessionId,
        parcel_id: rejectFor.parcel_id,
        reason: rejectReason,
        note: rejectNote || undefined,
      });
      setRows((prev) => prev.filter((r) => r.parcel_id !== rejectFor.parcel_id));
      message.success("Posilka rad etildi");
      setRejectFor(null);
      setRejectNote("");
    } catch (e) {
      message.error(errText(e, "Rad etib bo'lmadi"));
    } finally {
      focusInput();
    }
  };

  const doUndo = async () => {
    if (!sessionId) return;
    try {
      const res = await undoLast.mutateAsync(sessionId);
      setRows((prev) => prev.filter((r) => r.external_parcel_id !== res.removed));
      message.success(`${res.removed} olib tashlandi`);
    } catch (e) {
      message.error(errText(e, "Qaytarib bo'lmadi"));
    } finally {
      focusInput();
    }
  };

  /* ─────────────────────────── YUKLANISH ─────────────────────────── */
  if (available.isLoading) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700/50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Yuklanmoqda...</p>
      </div>
    );
  }

  if (!integrations.length) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-8 sm:p-12 text-center border border-gray-100 dark:border-gray-700/50">
        <Store className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-2">
          Yoqilgan marketplace ulanishi yo'q
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Administrator «Integratsiyalar → Marketplace» bo'limida sozlashi kerak
        </p>
      </div>
    );
  }

  return (
    /*
     * ⚠️ `h-full flex flex-col` — `space-y-4` EMAS.
     *
     * Ro'yxat qolgan bo'sh joyni egallashi va «Qabul qilish» tugmasi
     * DOIM ko'rinib turishi kerak. Balandlik `vh` bilan hisoblansa
     * (`max-h-[80vh]` kabi) tepadagi skaner kartasi hisobga olinmaydi
     * va tugma ekran ostiga tushib ketadi — operator 10 ta posilkani
     * skanerlab, qabul tugmasini topolmaydi.
     */
    <div className="h-full flex flex-col gap-4">
      {/* ─────────────────────── Sarlavha ─────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
        <button
          onClick={() => (onBack ? onBack() : navigate("/order/markets/new-orders"))}
          className="h-10 px-4 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Orqaga</span>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Adosh oqimidagi bilan BIR XIL: yashil kvadrat + ikonka */}
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md flex-shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white truncate">
              {current?.name ?? "Marketplace"}
            </h2>
            {/*
              ⚠️ MARKET NOMI SHART. Marketplace puli aynan shu market
              kassasiga tushadi — operator qaysi kassaga ishlayotganini
              ko'rmasa, ulanish «hech qanday marketga biriktirilmagan»
              bo'lib tuyuladi.
            */}
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Market: {current?.market_name || "Noma'lum"}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">
          <CheckCircle className="w-3.5 h-3.5" /> Ulangan
        </span>
      </div>

      {/* Bir nechta ulanish bo'lsa — tanlash */}
      {!embedded && integrations.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {integrations.map((r) => (
            <button
              key={r.slug}
              onClick={() => setSlug(r.slug)}
              className={
                r.slug === slug
                  ? "px-4 h-9 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md cursor-pointer transition-all"
                  : "px-4 h-9 rounded-xl text-sm font-medium bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] cursor-pointer transition-all"
              }
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {/* ─────────────────── Skaner holati ─────────────────── */}
      <div
        className={
          pauseLeft > 0
            ? "relative rounded-2xl shadow-sm p-4 border-2 transition-all flex-shrink-0 border-red-400 bg-red-50 dark:bg-red-900/10 dark:border-red-700"
            : queueLength > 0
              ? "relative rounded-2xl shadow-sm p-4 border-2 transition-all flex-shrink-0 border-amber-400 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700"
              : compact
              ? "relative rounded-2xl shadow-sm p-4 border-2 transition-all flex-shrink-0 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-700"
              : "relative rounded-2xl shadow-sm p-6 border-2 transition-all flex-shrink-0 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-700"
        }
      >
        <div className="text-center">
          {pauseLeft > 0 ? (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-left">
                <p className="text-lg font-medium text-red-700 dark:text-red-400">
                  Skanerlash to'xtatildi — {pauseLeft} soniya
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Marketplace javob bermayapti. Skaneringiz soz — muammo tashqi
                  tizimda. Sanoq tugagach o'zi tiklanadi.
                </p>
              </div>
            </div>
          ) : compact ? (
            /*
             * IXCHAM HOLAT — posilka skanerlangandan keyin.
             *
             * ⚠️ Katta karta ekranning yarmini egallaydi va 1080p'da
             * ro'yxatdan atigi 2 ta posilka ko'rinadi. Ish boshlangach
             * operatorga ro'yxat kerak, chaqiriq emas.
             */
            <div className="flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Skaner tayyor — keyingi QR kodni skanerlang
              </span>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 animate-pulse">
                <QrCode className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-lg font-medium text-emerald-700 dark:text-emerald-400">
                Skaner tayyor!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                QR kodni skanerlang - avtomatik qo'shiladi
              </p>
            </>
          )}

          {/*
            KOD MAYDONI KO'RINMAYDI — adosh oqimida ham maydon yo'q,
            operator shunchaki skanerlaydi.

            ⚠️ Lekin maydonning O'ZI saqlanadi (shaffof va fokusda):
            global `keydown` tinglagichdan farqli — brauzer kiritishni
            o'zi yig'adi, klaviatura tartibi/tez skaner bilan
            adashmaydi, planshetda qo'lda kiritish ham ishlayveradi.
            Skanerlanayotgan kod quyida ko'rinadi.
          */}
          <input
            ref={inputRef}
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doScan(token);
            }}
            aria-label="QR kod"
            className="absolute inset-0 w-full h-full opacity-0 cursor-default"
          />

          {token && (
            <div className="mt-4 p-3 bg-white dark:bg-[#2A263D] rounded-lg border border-gray-200 dark:border-gray-700 inline-block">
              <p className="text-xs text-gray-400 mb-1">Skanerlanmoqda:</p>
              <p className="text-lg font-mono font-bold text-gray-800 dark:text-white">
                {token}
              </p>
            </div>
          )}

          {/* Navbat — tez skanerlashda so'rovlar ketma-ket ishlanadi */}
          {queueLength > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Navbatda: {queueLength} ta
              </span>
            </div>
          )}

          {capsLockOn && (
            <div className="mt-3 mx-auto max-w-md px-4 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-center justify-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                Caps Lock yoqiq — QR kodlari noto'g'ri o'qilishi mumkin.
              </span>
            </div>
          )}

          {!compact && (
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Ro'yxat serverda saqlanadi — sahifa yangilansa ham yo'qolmaydi
            </p>
          )}
        </div>
      </div>

      {/* ─────────────────── Ogohlantirishlar ─────────────────── */}
      {incomplete.length > 0 && (
        <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 flex-shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Chala buyurtma bor — qabul qilinmaydi
              </p>
              <div className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-400">
                {incomplete.map((i) => (
                  <div key={i.order_id}>
                    <span className="font-mono text-xs">{i.order_id}</span> —{" "}
                    {i.have}/{i.total} quti skanerlangan
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Yarim buyurtmani qabul qilish mijozga chala posilka yuborish
                demak. Yo'qolgan quti hali mashinada bo'lishi mumkin.
              </p>
            </div>
          </div>
        </div>
      )}

      {blocked.length > 0 && (
        <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-700 dark:text-red-400">
                {blocked.length} ta posilkada to'siq bor
              </p>
              <p className="text-red-600 dark:text-red-400/80">
                Ular qabulda yiqiladi. To'siqni bartaraf eting yoki posilkani
                rad eting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/*
        ─────────────────── Posilkalar ro'yxati ───────────────────

        ⚠️ Balandlik EKRANGA moslanadi (`100vh - 22rem`), qat'iy `80vh`
        EMAS. Tepada skaner kartasi (~290px) va sarlavha turadi: 80vh
        ustiga ular qo'shilganda «Qabul qilish» tugmasi ekran ostiga
        tushib ketardi va operator uni ko'rmasdi — o'lchandi: tugma
        1751px da, ko'rinadigan joy 1757px.
      */}
      {rows.length > 0 && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700/50 flex-1 min-h-[12rem]">
          {/* Sarlavha: sanoq + summa + qaytarish */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-[#252139] flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {/* Filtr yoqiq bo'lsa JAMI ham ko'rinadi — qidiruv
                    natijasini «hammasi shu» deb o'ylamaslik uchun. */}
                {query.trim()
                  ? `${visibleRows.length} / ${rows.length} ta`
                  : `${rows.length} ta skanerlangan`}
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white">
                <Wallet className="w-4 h-4 text-gray-400" />
                {money(totalCod)} so'm
              </span>
            </div>
            <div className="relative flex-1 min-w-[10rem] max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Posilka, mijoz, telefon..."
                className="w-full h-9 pl-9 pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
              />
              {!!query && (
                <button
                  onClick={() => {
                    setQuery("");
                    focusInput();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  title="Tozalash"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={doUndo}
              disabled={!rows.length || undoLast.isPending}
              className="h-9 px-3 rounded-lg bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw
                className={
                  undoLast.isPending ? "w-4 h-4 animate-spin" : "w-4 h-4"
                }
              />
              Oxirgisini qaytarish
            </button>
          </div>

          {/* Ro'yxat — skrollanadi */}
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {!visibleRows.length && (
              <div className="py-10 text-center">
                <Search className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  «{query}» bo'yicha posilka topilmadi
                </p>
              </div>
            )}
            {visibleRows.map((r) => (
              <div
                key={r.parcel_id}
                className={
                  r.blockers.length
                    ? "p-3 sm:p-4 rounded-xl transition-all border bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50"
                    : r.warnings.length
                      ? "p-3 sm:p-4 rounded-xl transition-all border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50"
                      : "p-3 sm:p-4 rounded-xl transition-all border bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                }
              >
                {/* Yuqori qator: ID va belgilar */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300">
                      {r.external_parcel_id}
                    </span>
                    {r.parcel_count > 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                        quti {r.parcel_index}/{r.parcel_count}
                      </span>
                    )}
                    {r.where_deliver === "address" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Uygacha</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Markazgacha</span>
                      </span>
                    )}
                    {r.prepaid && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">
                          Oldindan to'langan
                        </span>
                      </span>
                    )}
                  </div>
                  {!r.blockers.length && !r.warnings.length && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" /> Tayyor
                    </span>
                  )}
                </div>

                {/* Asosiy qator: mijoz + pul + amal */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 flex-1 min-w-0">
                    <span className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white truncate">
                      {r.customer_name}
                    </span>
                    {r.phone && (
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                        {prettyPhone(r.phone)}
                      </span>
                    )}
                    {/*
                      ⚠️ TUMAN va MANZIL ALOHIDA.
                      Avval `district_name ?? address` yozilgan edi: tuman
                      aniqlanmasa ekran hamkorning erkin manzil matnini
                      ko'rsatardi. Marshrutlash esa SOATO kodi bo'yicha
                      ketadi — matn «Yunusobod» deb tursa ham posilka
                      Nurafshonga ketishi mumkin edi. Operator qayerga
                      ketishini ANIQ ko'rishi shart.
                    */}
                    {r.district_name && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs sm:text-sm font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 flex-shrink-0">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        {r.district_name}
                      </span>
                    )}
                    {r.address && (
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                        {r.address}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700/30">
                    <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-white whitespace-nowrap">
                      {money(Number(r.cod_amount ?? 0))} so'm
                    </p>
                    <button
                      onClick={() => setRejectFor(r)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                      title="Rad etish"
                    >
                      <Ban className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>

                {/* To'siq va ogohlantirishlar */}
                {(r.blockers.length > 0 || r.warnings.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {r.blockers.map((b) => (
                      <span
                        key={b}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      >
                        {b}
                      </span>
                    ))}
                    {r.warnings.map((w) => (
                      <span
                        key={w}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Qabul tugmasi — pastda qotgan */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-[#252139] flex-shrink-0">
            <button
              onClick={() => setConfirmAccept(true)}
              disabled={!canAccept || accept.isPending}
              title={
                incomplete.length
                  ? "Chala buyurtma bor — avval qolgan qutilarni skanerlang"
                  : undefined
              }
              className={
                !canAccept || accept.isPending
                  ? "w-full h-12 rounded-xl flex items-center justify-center gap-2 text-base font-medium transition-all opacity-50 cursor-not-allowed bg-gray-300 dark:bg-gray-700 text-gray-500"
                  : "w-full h-12 rounded-xl flex items-center justify-center gap-2 text-base font-medium transition-all bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
              }
            >
              {accept.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PackageCheck className="w-5 h-5" />
              )}
              {accept.isPending
                ? "Qabul qilinmoqda..."
                : `Qabul qilish (${rows.length} ta posilka)`}
            </button>
          </div>
        </div>
      )}

      {/* Bo'sh holat */}
      {rows.length === 0 && !session.isLoading && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-8 sm:p-12 text-center border border-gray-100 dark:border-gray-700/50">
          <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Skanerlangan posilkalar yo'q
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            QR kodni skanerlang — posilkalar avtomatik qo'shiladi
          </p>
        </div>
      )}

      {/* ─────────────────── Qabulni tasdiqlash ─────────────────── */}
      <Modal
        open={confirmAccept}
        onCancel={() => setConfirmAccept(false)}
        footer={null}
        centered
        closable={false}
        width={400}
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <PackageCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            {rows.length} ta posilkani qabul qilasizmi?
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Buyurtmalar yaratiladi va marketplace'ga xabar ketadi.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmAccept(false)}
              className="flex-1 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              onClick={() => {
                setConfirmAccept(false);
                doAccept();
              }}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer"
            >
              Ha, qabul qilish
            </button>
          </div>
        </div>
      </Modal>

      {/* ─────────────────────── Rad etish ─────────────────────── */}
      <Modal
        open={!!rejectFor}
        onCancel={() => setRejectFor(null)}
        footer={null}
        centered
        closable={false}
        width={440}
      >
        <div className="py-2">
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Ban className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Posilkani rad etish
            </h3>
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-1">
              {rejectFor?.external_parcel_id ?? ""}
            </p>
          </div>

          <div className="space-y-2 mb-3">
            {MARKETPLACE_REJECT_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setRejectReason(r.value)}
                className={
                  rejectReason === r.value
                    ? "w-full px-4 py-3 rounded-xl text-sm text-left flex items-center justify-between transition-all cursor-pointer bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-medium"
                    : "w-full px-4 py-3 rounded-xl text-sm text-left flex items-center justify-between transition-all cursor-pointer bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }
              >
                {r.label}
                {rejectReason === r.value && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            maxLength={500}
            placeholder="Izoh (ixtiyoriy)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-gray-800 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all resize-none"
          />

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-4">
            Rad etilgan posilka qabul qilinmaydi va marketplace'ga sabab bilan
            xabar beriladi.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setRejectFor(null)}
              className="flex-1 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              onClick={doReject}
              disabled={reject.isPending}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium hover:shadow-lg hover:shadow-red-500/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {reject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Rad etish
            </button>
          </div>
        </div>
      </Modal>

      {/* ─────────────────────── Natija ─────────────────────── */}
      <Modal
        open={!!result}
        onCancel={() => {
          setResult(null);
          focusInput();
        }}
        footer={null}
        centered
        closable={false}
        width={560}
      >
        <div className="py-2">
          <div className="text-center mb-4">
            <div
              className={
                result?.failed.length
                  ? "w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"
                  : "w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
              }
            >
              {result?.failed.length ? (
                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              {result?.accepted.length ?? 0} ta buyurtma yaratildi
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {result?.failed.length
                ? `${result.failed.length} ta posilka qabul qilinmadi`
                : "Marketplace'ga xabar yuborildi"}
            </p>
          </div>

          {!!result?.accepted.length && (
            <div className="flex gap-2 flex-wrap mb-4 max-h-48 overflow-y-auto">
              {result.accepted.map((a) => (
                <span
                  key={a.external_parcel_id}
                  className="px-2.5 py-1 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                >
                  #{a.order_number}
                </span>
              ))}
            </div>
          )}

          {!!result?.failed.length && (
            <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 mb-4">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                Qabul qilinmaganlar
              </p>
              <div className="text-sm space-y-1 text-red-600 dark:text-red-400/90">
                {result.failed.map((f) => (
                  <div key={f.external_parcel_id}>
                    <span className="font-mono text-xs">
                      {f.external_parcel_id}
                    </span>{" "}
                    — {f.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              focusInput();
            }}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MarketplaceIntakePage;
