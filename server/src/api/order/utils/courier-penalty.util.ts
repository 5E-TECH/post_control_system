/**
 * KURYER SHTRAF / BONUS HISOBI — YAGONA MANBA.
 *
 * ── NEGA SOF FUNKSIYA ───────────────────────────────────────────────────
 *
 * Tarif hisobi loyihada HOZIR TO'RT joyda takrorlangan (`sellOrder`,
 * `partlySold`, `cancelOrder`, `rollbackOrderToWaiting`) va bu tarixiy
 * nuqson manbai deb qayd etilgan: «qoida har joyda qaytadan yozilsa,
 * vaqt o'tib ular AJRALIB ketadi va kuryer eng bo'sh yo'lni topib
 * ishlatadi» (`extra-cost-limit.util.ts`). Shtraf qoidasi shu xatoni
 * takrorlamasligi uchun BITTA joyda, DB'siz va testlanadigan holda
 * yashaydi.
 *
 * ── QULFLANGAN QARORLAR ─────────────────────────────────────────────────
 *
 *   · POL — 0. Shtraf tarifdan OSHMAYDI: eng yomon holatda kuryer shu
 *     buyurtmadan hech narsa olmaydi, lekin USTIGA PUL TO'LAMAYDI.
 *   · KALENDAR KUN — kuryerlar har kuni ishlaydi, ish kuni hisobi yo'q.
 *   · SOAT POCHTA JO'NATILGANDA boshlanadi, kuryer qabul qilganda EMAS —
 *     aks holda kuryerlar pochtani kech qabul qilib soatni kechiktirardi.
 *   · GRANDFATHERING — modul yoqilgandan KEYIN jo'natilgan
 *     buyurtmalargagina tegadi.
 *
 * ── NEGA DAFTARGA «AMALDAGI» SUMMA YOZILADI ─────────────────────────────
 *
 * Nazariy shtraf (kun × narx) tarifdan katta bo'lishi mumkin. Daftarga
 * nazariy son yozilsa, uning yig'indisi kassadagi haqiqiy yozuvlar
 * yig'indisiga MOS KELMAY qolardi va invariant yiqilardi. Shuning uchun
 * funksiya DOIM chegaradan keyingi summani qaytaradi.
 */

/** Hodisa turlari — qoida jadvalidagi `event` qiymatlari. */
export enum CourierPenaltyEvent {
  /** Belgilash muddatidan kech qolindi. */
  LATE_MARK = 'late_mark',
  /** Muddatdan ancha oldin belgilandi — bonus. */
  EARLY_MARK = 'early_mark',
  /** Posilka shikastlandi / yo'qoldi. */
  DAMAGE = 'damage',
}

export enum CourierPenaltyScope {
  GLOBAL = 'global',
  COURIER = 'courier',
  REGION = 'region',
}

export enum CourierPenaltyCalc {
  /** Har kechikkan kun uchun. */
  PER_DAY = 'per_day',
  /** Bir martalik. */
  ONCE = 'once',
}

export interface PenaltyRule {
  id: string;
  scope_type: string;
  scope_id: string | null;
  event: string;
  threshold_days: number;
  calc: string;
  /** ISHORALI: shtraf manfiy, bonus musbat. */
  amount: number;
  max_amount: number | null;
  priority: number;
  active_from: number;
  active_to: number | null;
  is_active: boolean;
}

export interface PenaltyInput {
  /** Pochta jo'natilgan payt — `post.created_at`. */
  dispatchedAt: number | null | undefined;
  /** Kuryer «sotildi»/«bekor» bosgan payt. */
  markedAt: number | null | undefined;
  /** Shu buyurtma uchun kuryer tarifi — CHEGARA shundan olinadi. */
  baseTariff: number | null | undefined;
  courierId: string;
  regionId?: string | null;
  rules: PenaltyRule[];
  /** Modul yoqilgan payt; `null` — hali yoqilmagan (soya). */
  activatedAt?: number | null;
  /** Kuryer istisno qilinganmi (tashqi provayder yoki qo'lda). */
  exempt?: boolean;
}

export interface PenaltyResult {
  /**
   * ISHORALI, AMALDA qo'llanadigan summa:
   *   musbat — kuryer qarzi OSHADI (shtraf);
   *   manfiy — kuryer qarzi KAMAYADI (bonus);
   *   0      — tuzatish yo'q.
   */
  amount: number;
  /** `penalty` | `bonus` | null */
  kind: 'penalty' | 'bonus' | null;
  event: CourierPenaltyEvent | null;
  ruleId: string | null;
  lateDays: number;
  baseTariff: number;
  /** Chegara ishlaganmi — «nolga tushdi» signali. */
  cappedByTariff: boolean;
  /** Tuzatish bo'lmasa — sababi (diagnostika uchun). */
  skipReason: string | null;
}

const DAY_MS = 86_400_000;

const int = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

const NONE = (skipReason: string, baseTariff = 0): PenaltyResult => ({
  amount: 0,
  kind: null,
  event: null,
  ruleId: null,
  lateDays: 0,
  baseTariff,
  cappedByTariff: false,
  skipReason,
});

/**
 * Qamrov aniqligi — KATTA son ustun keladi.
 *
 * Kuryerga maxsus qoida viloyat qoidasidan, viloyat qoidasi esa global
 * qoidadan ustun: aks holda «falon kuryerga boshqacha muddat» talabini
 * bajarib bo'lmasdi.
 */
function scopeRank(scope: string): number {
  if (scope === CourierPenaltyScope.COURIER) return 3;
  if (scope === CourierPenaltyScope.REGION) return 2;
  if (scope === CourierPenaltyScope.GLOBAL) return 1;
  return 0;
}

/** Qoida shu kuryer/viloyat va shu paytga tegishlimi. */
function matches(
  rule: PenaltyRule,
  event: CourierPenaltyEvent,
  at: number,
  courierId: string,
  regionId: string | null | undefined,
): boolean {
  if (!rule.is_active) return false;
  if (rule.event !== event) return false;
  if (int(rule.active_from) > at) return false;
  if (rule.active_to != null && int(rule.active_to) < at) return false;

  if (rule.scope_type === CourierPenaltyScope.GLOBAL) return true;
  if (rule.scope_type === CourierPenaltyScope.COURIER)
    return String(rule.scope_id) === String(courierId);
  if (rule.scope_type === CourierPenaltyScope.REGION)
    return regionId != null && String(rule.scope_id) === String(regionId);
  return false;
}

/**
 * Eng mos qoidani tanlaydi: avval qamrov aniqligi, keyin `priority`,
 * keyin eng yangi.
 */
export function pickRule(
  rules: PenaltyRule[],
  event: CourierPenaltyEvent,
  at: number,
  courierId: string,
  regionId: string | null | undefined,
): PenaltyRule | null {
  const found = rules.filter((r) => matches(r, event, at, courierId, regionId));
  if (!found.length) return null;
  return found.sort(
    (a, b) =>
      scopeRank(b.scope_type) - scopeRank(a.scope_type) ||
      int(b.priority) - int(a.priority) ||
      int(b.active_from) - int(a.active_from),
  )[0];
}

/**
 * Kechikkan KALENDAR kunlar soni (muddat ayirilgan, manfiy bo'lmaydi).
 *
 * ⚠️ `floor` — 4 kun 23 soat hali 4-kun. Kuryer soat farqi uchun
 * jazolanmasligi kerak.
 */
export function lateDaysOf(
  dispatchedAt: number | null | undefined,
  markedAt: number | null | undefined,
  deadlineDays: number,
): number {
  const from = int(dispatchedAt);
  const to = int(markedAt);
  if (from <= 0 || to <= 0 || to < from) return 0;
  const elapsed = Math.floor((to - from) / DAY_MS);
  return Math.max(0, elapsed - Math.max(0, int(deadlineDays)));
}

/**
 * MUDDAT HOLATI — kuryerga ko'rsatiladigan sanoq.
 *
 * ⚠️ NEGA ANIQ PAYT, «qolgan kun» EMAS. `lateDaysOf` o'tgan vaqtni
 * `floor` bilan kunga aylantiradi, ya'ni shtraf AYNI bir onda boshlanadi:
 * jo'natilgandan `(muddat + 1)` kun o'tganda. Agar kuryerga faqat «3 kun
 * qoldi» deb ko'rsatilsa, u kunning qaysi soatida chegara o'tishini
 * BILMASDI va «hali 3 kun bor edi» degan haqli e'tiroz tug'ilardi.
 * Shuning uchun aniq payt ham qaytariladi — ekranda soat bilan ko'rsatish
 * uchun.
 *
 * Misol (muddat 4 kun): jo'natilgan dushanba 09:00 →
 * `penaltyStartsAt` = shanba 09:00. Juma kuni kech bosilsa ham shtraf yo'q.
 */
export interface DeadlineState {
  /** Birinchi shtraf kuni AYNI shu paytda boshlanadi. */
  penaltyStartsAt: number;
  /** Shu paytgacha qolgan vaqt (ms). Manfiy — muddat o'tgan. */
  msLeft: number;
  /** Kechikkan kunlar (muddat ayirilgan). */
  lateDays: number;
  /** Muddat tugashiga qolgan to'liq kun; o'tgan bo'lsa `null`. */
  daysLeft: number | null;
  /** Bugun oxirgi kun — ya'ni ertaga shtraf boshlanadi. */
  dueToday: boolean;
}

export function deadlineStateOf(
  dispatchedAt: number | null | undefined,
  now: number,
  deadlineDays: number,
): DeadlineState | null {
  const from = int(dispatchedAt);
  if (from <= 0) return null;

  const deadline = Math.max(0, int(deadlineDays));
  /**
   * `(muddat + 1)` — chunki `lateDaysOf` `floor` ishlatadi: o'tgan vaqt
   * ayni `muddat` kun bo'lganda kechikish hali 0. Shtraf keyingi kun
   * to'lgandagina boshlanadi.
   */
  const penaltyStartsAt = from + (deadline + 1) * DAY_MS;
  const msLeft = penaltyStartsAt - int(now);
  const lateDays = lateDaysOf(from, now, deadline);

  return {
    penaltyStartsAt,
    msLeft,
    lateDays,
    daysLeft: msLeft > 0 ? Math.floor(msLeft / DAY_MS) : null,
    // Qolgan vaqt bir kundan kam — bugun bosilmasa ertaga shtraf.
    dueToday: msLeft > 0 && msLeft <= DAY_MS,
  };
}

/**
 * Bitta buyurtma uchun tuzatishni hisoblaydi.
 *
 * ⚠️ Faqat BITTA tuzatish qaytaradi: shtraf VA bonus bir vaqtda bo'la
 * olmaydi — kechikkan buyurtma tez belgilangan bo'lishi mumkin emas.
 */
export function computeCourierAdjustment(
  input: PenaltyInput,
): PenaltyResult {
  const baseTariff = Math.max(0, int(input.baseTariff));
  const dispatchedAt = int(input.dispatchedAt);
  const markedAt = int(input.markedAt);

  if (input.exempt) return NONE('exempt', baseTariff);
  if (dispatchedAt <= 0) return NONE('no_dispatch_anchor', baseTariff);
  if (markedAt <= 0 || markedAt < dispatchedAt)
    return NONE('no_mark_time', baseTariff);

  /**
   * ⚠️ GRANDFATHERING — darvoza JO'NATISH vaqtiga, belgilash vaqtiga
   * EMAS. Yoqilishdan oldin jo'natilib keyin belgilangan buyurtma
   * jazolanmaydi: kuryer uni qoida yo'q paytda olgan.
   */
  if (input.activatedAt != null && dispatchedAt < int(input.activatedAt))
    return NONE('before_activation', baseTariff);

  const rules = input.rules ?? [];

  // ── 1. KECHIKISH ──
  const lateRule = pickRule(
    rules,
    CourierPenaltyEvent.LATE_MARK,
    markedAt,
    input.courierId,
    input.regionId,
  );
  if (lateRule) {
    const lateDays = lateDaysOf(
      dispatchedAt,
      markedAt,
      lateRule.threshold_days,
    );
    if (lateDays > 0) {
      // Qoidadagi `amount` manfiy (shtraf) — mutlaq qiymat olinadi.
      const per = Math.abs(int(lateRule.amount));
      const raw =
        lateRule.calc === CourierPenaltyCalc.ONCE ? per : per * lateDays;
      const byRule =
        lateRule.max_amount != null
          ? Math.min(raw, Math.abs(int(lateRule.max_amount)))
          : raw;
      // ⚠️ POL: shtraf tarifdan oshmaydi.
      const amount = Math.min(byRule, baseTariff);
      return {
        amount,
        kind: amount > 0 ? 'penalty' : null,
        event: CourierPenaltyEvent.LATE_MARK,
        ruleId: lateRule.id,
        lateDays,
        baseTariff,
        cappedByTariff: byRule > baseTariff,
        skipReason: amount > 0 ? null : 'zero_tariff',
      };
    }
  }

  // ── 2. TEZ BELGILASH BONUSI ──
  //
  // Faqat kechikish BO'LMAGANDA. Eng kichik `threshold_days` eng katta
  // bonus beradi, shuning uchun mos keladiganlar ichidan eng qattiqrog'i
  // tanlanadi.
  const elapsedDays = Math.floor((markedAt - dispatchedAt) / DAY_MS);
  const bonusRules = rules
    .filter((r) =>
      matches(
        r,
        CourierPenaltyEvent.EARLY_MARK,
        markedAt,
        input.courierId,
        input.regionId,
      ),
    )
    .filter((r) => elapsedDays <= Math.max(0, int(r.threshold_days)))
    .sort(
      (a, b) =>
        scopeRank(b.scope_type) - scopeRank(a.scope_type) ||
        int(a.threshold_days) - int(b.threshold_days) ||
        int(b.priority) - int(a.priority),
    );

  const bonusRule = bonusRules[0];
  if (bonusRule) {
    const per = Math.abs(int(bonusRule.amount));
    const amount =
      bonusRule.max_amount != null
        ? Math.min(per, Math.abs(int(bonusRule.max_amount)))
        : per;
    if (amount > 0) {
      return {
        // Bonus kuryer qarzini KAMAYTIRADI — ishora manfiy.
        amount: -amount,
        kind: 'bonus',
        event: CourierPenaltyEvent.EARLY_MARK,
        ruleId: bonusRule.id,
        lateDays: 0,
        baseTariff,
        cappedByTariff: false,
        skipReason: null,
      };
    }
  }

  return NONE('no_matching_rule', baseTariff);
}
