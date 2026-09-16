/**
 * SKAN XATOSINI TASNIFLASH — rejadagi ENG KRITIK tuzatish (§15 #1).
 *
 * BUGUNGI XULQ VA NEGA U XAVFLI. `today-orders` sahifasida skan javobi
 * shunday tekshiriladi:
 *
 *     if (response.ok && data.success !== false) { ...topildi... }
 *     else { "Tashqi saytda buyurtma topilmadi. Baribir qo'shilsinmi?" }
 *
 * Ya'ni QUYIDAGILARNING HAMMASI «topilmadi» deb ko'rsatiladi:
 *   · marketplace serveri o'lgan (500)
 *   · integratsiya o'chirilgan (400)
 *   · operator sessiyasi tugagan (401)
 *   · tarmoq uzilgan (timeout)
 *
 * Operator qo'lida 48 ta posilka bilan «Ha» bosadi va HAMMASI narxi 0,
 * mijozi soxta, tumani tasodifiy BO'SH BUYURTMA bo'lib tushadi. Sotuvda esa
 * `price === 0` shoxi market va kuryer kassasidan tarifni YECHADI.
 *
 * Bu modul har bir xatoni ALOHIDA tasniflaydi va faqat HAQIQIY
 * «ularda yo'q» holatida qo'lda qo'shishga yo'l qoldiradi.
 */

export type MarketplaceErrorKind =
  /** Ular aniq «yo'q» dedi (404). YAGONA holat — qo'lda qo'shish mumkin. */
  | 'not_found'
  /** Kalit/imzo noto'g'ri — SOZLAMA muammosi, posilka muammosi emas. */
  | 'auth'
  /** Ularning serveri ishlamayapti (5xx). */
  | 'remote_down'
  /** Javob kelmadi — timeout. */
  | 'timeout'
  /** Tarmoq uzilgan, DNS, ulanish rad etildi. */
  | 'network'
  /** So'rov noto'g'ri (400/422) — bizning tomonda xato. */
  | 'bad_request'
  /** Limit oshdi (429). */
  | 'rate_limited'
  /** Tasniflab bo'lmadi. */
  | 'unknown';

export interface MarketplaceErrorInfo {
  kind: MarketplaceErrorKind;
  /** Operatorga ko'rsatiladigan aniq xabar. */
  message: string;
  /**
   * Operatorga «baribir qo'shish» taklif qilinsinmi.
   *
   * ⚠️ FAQAT `not_found` da `true`. Boshqa hech qanday holatda emas —
   * chunki posilka ularda BOR bo'lishi mumkin, biz shunchaki so'rab
   * ololmadik.
   */
  allowManualAdd: boolean;
  /** Skan navbatini to'xtatish kerakmi (ketma-ket xatolarda). */
  countsTowardBreaker: boolean;
  /** Keyinroq qayta urinish mantiqiymi. */
  retryable: boolean;
  httpStatus: number | null;
}

/**
 * ⚠️ NEGA XATO OBYEKTI EMAS, TASNIF. Chaqiruvchi `catch` da nima
 * qilishini bilishi uchun tasnif kerak — xato matnini parse qilish
 * (`message.includes('404')`) eng mo'rt yechim bo'lardi.
 */
export function classifyMarketplaceError(err: unknown): MarketplaceErrorInfo {
  const e = err as {
    response?: { status?: number };
    code?: string;
    message?: string;
  };
  const status = e?.response?.status ?? null;
  const code = e?.code ?? '';

  // ── Timeout ─────────────────────────────────────────────────────────
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(e?.message ?? '')) {
    return {
      kind: 'timeout',
      message: 'Marketplace javob bermadi (vaqt tugadi). Qayta urinib ko\'ring.',
      allowManualAdd: false,
      countsTowardBreaker: true,
      retryable: true,
      httpStatus: null,
    };
  }

  // ── Tarmoq ──────────────────────────────────────────────────────────
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH'
  ) {
    return {
      kind: 'network',
      message: "Marketplace bilan aloqa yo'q. Internetni va sozlamani tekshiring.",
      allowManualAdd: false,
      countsTowardBreaker: true,
      retryable: true,
      httpStatus: null,
    };
  }

  if (status === null) {
    return {
      kind: 'unknown',
      message: `Noma'lum xato: ${e?.message ?? 'sabab ko\'rsatilmagan'}`,
      allowManualAdd: false,
      countsTowardBreaker: true,
      retryable: true,
      httpStatus: null,
    };
  }

  // ── 404 — YAGONA haqiqiy «topilmadi» ────────────────────────────────
  if (status === 404) {
    return {
      kind: 'not_found',
      message: 'Bu posilka marketplace tizimida topilmadi.',
      allowManualAdd: true,
      countsTowardBreaker: false, // ular ishlayapti — bu normal javob
      retryable: false,
      httpStatus: status,
    };
  }

  // ── 401/403 — sozlama muammosi ──────────────────────────────────────
  if (status === 401 || status === 403) {
    return {
      kind: 'auth',
      message:
        'Marketplace ulanish kaliti qabul qilinmadi. Bu posilka muammosi EMAS — sozlamani tekshiring.',
      allowManualAdd: false,
      countsTowardBreaker: true,
      retryable: false,
      httpStatus: status,
    };
  }

  // ── 429 — limit ─────────────────────────────────────────────────────
  if (status === 429) {
    return {
      kind: 'rate_limited',
      message: 'Marketplace so\'rov limitiga yetdi. Biroz kutib qayta urining.',
      allowManualAdd: false,
      countsTowardBreaker: true,
      retryable: true,
      httpStatus: status,
    };
  }

  // ── 5xx — ularning serveri ──────────────────────────────────────────
  if (status >= 500) {
    return {
      kind: 'remote_down',
      message: 'Marketplace serverida xato. Posilka ularda BOR bo\'lishi mumkin.',
      allowManualAdd: false,
      countsTowardBreaker: true,
      retryable: true,
      httpStatus: status,
    };
  }

  // ── Qolgan 4xx ──────────────────────────────────────────────────────
  return {
    kind: 'bad_request',
    message: `Marketplace so'rovni qabul qilmadi (${status}).`,
    allowManualAdd: false,
    countsTowardBreaker: true,
    retryable: false,
    httpStatus: status,
  };
}

/**
 * CIRCUIT BREAKER — ketma-ket xatolardan keyin skan navbatini to'xtatadi.
 *
 * Nega kerak: manifest qurilmagani uchun (qaror O4) `parcels/lookup` —
 * qabul jarayonining YAGONA bog'lanish nuqtasi. Ular o'lsa, operator
 * 60 ta posilkani ketma-ket urinib, 60 ta xato ko'rishi shart emas —
 * uchinchisidayoq to'xtatib, aniq xabar berish kerak.
 */
export class MarketplaceCircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 60_000,
  ) {}

  /** Navbat to'xtatilganmi (va hali sovish davri tugamaganmi). */
  isOpen(now = Date.now()): boolean {
    if (this.openedAt === null) return false;
    if (now - this.openedAt >= this.cooldownMs) {
      // Sovish davri tugadi — bitta sinov so'roviga ruxsat beriladi.
      this.openedAt = null;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  /** `true` qaytsa — navbat endi to'xtatildi. */
  recordFailure(info: MarketplaceErrorInfo, now = Date.now()): boolean {
    if (!info.countsTowardBreaker) return false;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.threshold && this.openedAt === null) {
      this.openedAt = now;
      return true;
    }
    return false;
  }

  get failures(): number {
    return this.consecutiveFailures;
  }
}
