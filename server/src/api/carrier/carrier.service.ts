import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Cashbox_type, Order_status } from 'src/common/enums';
import {
  toUzbekistanDateString,
  toUzbekistanTimestamp,
} from 'src/common/utils/date.util';
import { normalizeQrToken } from 'src/infrastructure/lib/qr-token/normalize';
import { successRes } from 'src/infrastructure/lib/response';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { OrderService } from 'src/api/order/order.service';
import { PostService } from 'src/api/post/post.service';
import { ActivityLogService } from 'src/api/activity-log/activity-log.service';
import { SellCancelOrderDto } from 'src/api/order/dto/sellCancel-order.dto';
import { PartlySoldDto } from 'src/api/order/dto/partly-sold.dto';
import { RollbackTarget } from 'src/api/order/dto/rollback-order.dto';
import { ReceivePostDto } from 'src/api/post/dto/receive-post.dto';
import {
  CARRIER_ERROR_CODES,
  CarrierPrincipal,
  carrierActor,
  carrierHttpError,
} from './carrier-error-codes';
import {
  CarrierIdempotencyService,
  carrierOpBinding,
} from './carrier-idempotency.service';
import { isOldItemRequired, toCarrierOrderView } from './carrier-order-view';
import { toCarrierCashboxView } from './carrier-cashbox-view';
import {
  CARRIER_ORDER_LIST_STATUSES,
  CARRIER_UUID_RE,
  CancelReason,
  CarrierCashboxQueryDto,
  CarrierOrderListQueryDto,
  CarrierOrderStatus,
  CarrierOrderStatusRequestDto,
  CarrierPartlySoldItemDto,
} from './dto/carrier-public.dto';

/**
 * Buyurtma topilmadi YOKI shu kompaniyaga tegishli emas — BIR XIL javob
 * (Elchi bilan aynan bir xil matn). Boshqa kuryerning yoki Elchi nazoratidagi
 * buyurtma BORLIGI ham bilinmasin: QR/ID taxmin qilib bazani "skanerlash"
 * mumkin bo'lmasin.
 */
export const NOT_YOURS_MESSAGE =
  'Buyurtma topilmadi yoki sizga biriktirilmagan';

/**
 * Har bir amaldan keyin kutiladigan holatlar (Elchi `STATUS_TARGETS` ning
 * BeePost varianti). Ikki joyda ishlatiladi:
 *   - eski kalit (`CARRIER_IDEMPOTENCY_KEY_STALE`): qayta o'qilgan holat
 *     maqsadda emas va amaldan oldingi holatda qolgan — amal bajarilmagan;
 *   - xato xaritasi: PCS servisi xato bersa-yu buyurtma baribir maqsad
 *     holatda bo'lsa — amal bajarilgan (commit'dan keyingi yiqilish yoki
 *     parallel ayni amal), mijozga muvaffaqiyat.
 *
 * BeePost'da `returned_to_market` yo'q; o'rniga qaytarish oxiri `closed`.
 */
export const CARRIER_STATUS_TARGETS: Record<
  CarrierOrderStatus,
  readonly string[]
> = {
  [CarrierOrderStatus.SOLD]: [
    Order_status.SOLD,
    Order_status.PAID,
    Order_status.PARTLY_PAID,
  ],
  [CarrierOrderStatus.PARTLY_SOLD]: [
    Order_status.SOLD,
    Order_status.PAID,
    Order_status.PARTLY_PAID,
  ],
  // Bekor + keyin qaytarilgan (`/carrier/returns`) — ayni kalit takrori ham muvaffaqiyat.
  [CarrierOrderStatus.CANCELLED]: [
    Order_status.CANCELLED,
    Order_status.CANCELLED_SENT,
    Order_status.CLOSED,
  ],
  [CarrierOrderStatus.ROLLBACK]: [Order_status.WAITING],
};

/** Kompaniya o'zi qaytargan (qaytarish pochtasidagi) posilka holatlari. */
const RETURNED_STATUSES: readonly string[] = [
  Order_status.CANCELLED_SENT,
  Order_status.CLOSED,
];

/** Skanda bir nechta mos qator bo'lsa — yakunlanmagan holat afzal. */
const FINAL_STATUSES: ReadonlySet<string> = new Set([
  Order_status.SOLD,
  Order_status.PAID,
  Order_status.PARTLY_PAID,
  Order_status.CANCELLED,
  Order_status.CANCELLED_SENT,
  Order_status.CLOSED,
]);

/** BeePost `order.status` enumidagi qiymatlar (PG enum — begona qiymat SQL xatosi beradi). */
const PCS_ORDER_STATUSES: ReadonlySet<string> = new Set(
  Object.values(Order_status),
);

/**
 * `control_owner` bo'sh — buyurtmani BeePost boshqaradi. `assertControlAllowed`
 * bilan AYNI qoida (bo'sh satr ham "ega yo'q"). Elchi nazoratidagi posilka
 * (`'elchi'`) kompaniyaga ko'rinmaydi — aks holda u Elchi ham, BeePost ham
 * "sotildi" yozadigan posilkani skanerlab olardi (pul ikki daftarda).
 */
const NOT_CONTROLLED_SQL = "COALESCE(TRIM(o.control_owner), '') = ''";

// ─────────────────────────── Isbot fayli ───────────────────────────

/**
 * Isbot fayli — Elchi `assertProofFile` bilan BIR XIL qoida (kontrakt):
 * rasm/pdf ≤10 MB, video ≤50 MB. BeePost'da isbot faqat qo'shimcha xarajat
 * yoki yashirin chegirmada kerak — v1 da ikkalasi ham yo'q. Shu bois fayl
 * TEKSHIRILADI (kompaniya kodi ikkala tizimda bir xil ishlasin), lekin
 * SAQLANMAYDI (ega qarori Q6).
 */
const PROOF_FILE_MIME: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);
const PROOF_VIDEO_MIME: ReadonlySet<string> = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const MB = 1024 * 1024;
const PROOF_FILE_MAX_MB = 10;
const PROOF_VIDEO_MAX_MB = 50;
/** Multer chegarasi — eng katta ruxsat (video); undan oshsa multer rad etadi. */
export const CARRIER_PROOF_MULTER_MAX_BYTES = PROOF_VIDEO_MAX_MB * MB;

export type CarrierProofFile = {
  mimetype?: string | null;
  size?: number | null;
  buffer?: Buffer | null;
};

export function assertCarrierProofFile(
  status: CarrierOrderStatus,
  file: CarrierProofFile | null | undefined,
): void {
  if (!file) return;
  if (status === CarrierOrderStatus.ROLLBACK) {
    throw new BadRequestException('rollback uchun proof kerak emas');
  }
  const mime = String(file.mimetype ?? '').toLowerCase();
  const size = Number(file.size ?? file.buffer?.length ?? 0);
  if (PROOF_VIDEO_MIME.has(mime)) {
    if (size > PROOF_VIDEO_MAX_MB * MB) {
      throw new BadRequestException(
        `Video isbot ${PROOF_VIDEO_MAX_MB} MB dan oshmasin`,
      );
    }
    return;
  }
  if (!PROOF_FILE_MIME.has(mime)) {
    throw new BadRequestException(
      'Isbot fayli turi qabul qilinmaydi: rasm (jpeg, png, webp), pdf yoki video (mp4, mov, webm)',
    );
  }
  if (size > PROOF_FILE_MAX_MB * MB) {
    throw new BadRequestException(
      `Isbot fayli ${PROOF_FILE_MAX_MB} MB dan oshmasin (video — ${PROOF_VIDEO_MAX_MB} MB)`,
    );
  }
}

// ─────────────────────────── Kassa oynasi ───────────────────────────

/**
 * `/carrier/returns` navbat qulfini kutish chegarasi. Odatiy qaytarish
 * yuzlab millisekund; 15 s — bir nechta parallel takrorga yetarli, lekin
 * osilgan so'rov pool ulanishlarini cheksiz ushlab turmaydi.
 */
const CARRIER_RETURNS_LOCK_TIMEOUT_MS = 15_000;

/** Kassa tarixi oynasi: sukut 30 kun, eng ko'pi 92 kun (Elchi bilan bir xil). */
const CASHBOX_DEFAULT_DAYS = 30;
const CASHBOX_MAX_DAYS = 92;

/** `YYYY-MM-DD` haqiqiy sanami (`2026-02-31` — yo'q). */
const isRealDay = (day: string): boolean => {
  const parsed = new Date(`${day}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day
  );
};

const shiftDay = (day: string, deltaDays: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

const dayDiff = (from: string, to: string): number =>
  Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() -
      new Date(`${from}T00:00:00Z`).getTime()) /
      86_400_000,
  );

// ─────────────────────────── Yordamchilar ───────────────────────────

/** Xatoning HTTP holati. PCS servislari `catchError` bilan klassni yo'qotadi — faqat status ishonchli. */
const httpStatusOf = (error: unknown): number => {
  if (error instanceof HttpException) return error.getStatus();
  const e = error as { status?: unknown; statusCode?: unknown } | null;
  const n = Number(e?.status ?? e?.statusCode);
  return Number.isInteger(n) && n >= 100 && n <= 599 ? n : 500;
};

const messageOf = (error: unknown): string => {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    const message = (response as { message?: unknown } | null)?.message;
    if (Array.isArray(message)) return message.map(String).join('; ');
    if (typeof message === 'string') return message;
  }
  return String((error as Error)?.message ?? '');
};

const temporarilyUnavailable = (detail: string): HttpException =>
  carrierHttpError(
    503,
    `${detail} — birozdan keyin ayni Idempotency-Key bilan qayta urining`,
    CARRIER_ERROR_CODES.TEMPORARILY_UNAVAILABLE,
  );

const staleKeyConflict = (): HttpException =>
  carrierHttpError(
    409,
    'Bu Idempotency-Key oldingi urinishga tegishli — amal qayta bajarilmadi. Yangi kalit bilan yuboring',
    CARRIER_ERROR_CODES.IDEMPOTENCY_KEY_STALE,
  );

/** Id qiymati satr ko'rinishida (obyekt `[object Object]` bo'lib ketmasin). */
const idText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'bigint'
      ? String(value)
      : '';

const hasValue = (value: unknown): boolean => idText(value) !== '';

/** UUID registrga bog'liq emas — mijoz katta harf bilan yuborishi mumkin. */
const sameId = (a: unknown, b: unknown): boolean =>
  idText(a).toLowerCase() === idText(b).toLowerCase();

/** Egalik/holat tekshiruvi uchun yengil qator. */
type RawOrder = Pick<
  OrderEntity,
  | 'id'
  | 'status'
  | 'parent_order_id'
  | 'replacement_of_order_id'
  | 'replacement_state'
  | 'total_price'
  | 'original_total_price'
>;

const sameNullableNumber = (a: unknown, b: unknown): boolean =>
  a === null || a === undefined
    ? b === null || b === undefined
    : b !== null && b !== undefined && Number(a) === Number(b);

/**
 * PCS servisi xato berdi-yu buyurtma maqsad holatda — bu AYNAN SHU amal
 * natijasimi? Faqat holatga qarash yetmaydi: `partly_sold` va `sold` ning
 * maqsad holatlari bir xil. Ikki xil kalit bilan bir vaqtda `sold` va
 * `partly_sold` kelsa, yutqazgan so'rov "muvaffaqiyat" olib, kompaniya
 * qisman summani yig'gan, BeePost esa to'liq sotuv yozgan bo'lardi.
 * Farq ma'lumotda bor: `partlySold` `total_price` ni yangi summaga
 * o'zgartiradi va `original_total_price` ni to'ldiradi, `sellOrder` esa
 * ikkalasiga ham tegmaydi.
 */
function isSameActionOutcome(
  status: CarrierOrderStatus,
  before: RawOrder,
  after: RawOrder,
  requestedPrice: number | undefined,
): boolean {
  if (!CARRIER_STATUS_TARGETS[status].includes(after.status)) return false;
  if (status === CarrierOrderStatus.SOLD) {
    return (
      Number(after.total_price) === Number(before.total_price) &&
      sameNullableNumber(
        after.original_total_price,
        before.original_total_price,
      )
    );
  }
  if (status === CarrierOrderStatus.PARTLY_SOLD) {
    return (
      after.original_total_price !== null &&
      after.original_total_price !== undefined &&
      Number(after.total_price) === Number(requestedPrice)
    );
  }
  // `cancelled` / `rollback` maqsad holatiga boshqa carrier amali olib bormaydi.
  return true;
}

/**
 * Qayta egallangan kalit (`priorAttemptMayHaveRun`): avvalgi urinish shu
 * amalni ALLAQACHON bajarganmi — faqat JORIY holatdan (amaldan oldingi
 * nusxa yo'q: u o'lgan jarayonda qolgan).
 *
 *   - `sold`        — maqsad holat va `original_total_price` bo'sh: to'liq
 *     sotuv uni to'ldirmaydi, qisman sotuv to'ldiradi, rollback esa
 *     tozalaydi (`rollbackOrderToWaiting`), ya'ni bo'sh qiymat "oxirgi
 *     sotuv to'liq bo'lgan" degani;
 *   - `partly_sold` — maqsad holat, `original_total_price` to'la va summa
 *     aynan so'ralgan summa (`isSameActionOutcome` bilan bir xil qoida);
 *   - `cancelled` / `rollback` — maqsad holat yetarli.
 */
function isRecoveredOutcome(
  status: CarrierOrderStatus,
  current: RawOrder,
  requestedPrice: number | undefined,
): boolean {
  if (!CARRIER_STATUS_TARGETS[status].includes(current.status)) return false;
  if (status === CarrierOrderStatus.SOLD) {
    return (
      current.original_total_price === null ||
      current.original_total_price === undefined
    );
  }
  if (status === CarrierOrderStatus.PARTLY_SOLD) {
    return (
      current.original_total_price !== null &&
      current.original_total_price !== undefined &&
      Number(current.total_price) === Number(requestedPrice)
    );
  }
  return true;
}

type PreparedAction = {
  run: (actor: JwtPayload) => Promise<unknown>;
  /** Activity-log metadata qo'shimchasi (masalan bekor sababi). */
  logMeta?: Record<string, unknown>;
};

/**
 * Idempotency barmoq izi uchun amal "niyati" — Elchi gateway order-service'ga
 * yuboradigan `dto` bilan AYNI shakl (`carrier-gateway.controller.ts`).
 * Mijoz tanasidan quriladi (adapter avtomatik qo'shadigan qiymatlar
 * kirmaydi): ayni so'rovning takrori har doim ayni bog'lanish beradi.
 */
export function buildCarrierOpIntent(
  dto: CarrierOrderStatusRequestDto,
): Record<string, unknown> {
  let intent: Record<string, unknown>;
  switch (dto.status) {
    case CarrierOrderStatus.SOLD:
      intent = {
        comment: dto.comment,
        oldItemCollected: dto.old_item_collected,
      };
      break;
    case CarrierOrderStatus.PARTLY_SOLD:
      intent = {
        order_item_info: (dto.items ?? []).map((item) => ({
          ...(item.order_item_id ? { order_item_id: item.order_item_id } : {}),
          ...(item.product_id ? { product_id: item.product_id } : {}),
          quantity: item.quantity,
        })),
        totalPrice: dto.total_price,
        comment: dto.comment,
        oldItemCollected: dto.old_item_collected,
      };
      break;
    case CarrierOrderStatus.CANCELLED:
      intent = { reason: dto.reason, comment: dto.comment };
      break;
    default:
      intent = { target_status: 'waiting' };
  }
  return Object.fromEntries(
    Object.entries(intent).filter(([, value]) => value !== undefined),
  );
}

/**
 * CARRIER API — asosiy xulq (`/api/v1/carrier/*`).
 *
 * Tashqi yetkazuvchi kompaniya BeePost'da BITTA kuryer user sifatida ishlaydi
 * (`carrier_account.courier_user_id`, `external_provider = 'carrier'`). Har bir
 * amal shu kuryer nomidan MAVJUD kuryer amallariga yo'naltiriladi
 * (`sellOrder`, `partlySold`, `cancelOrder`, `rollbackOrderToWaiting`,
 * `receiveOrderForCourierById`, `createCanceledPost`) — `carrierActor` (xuddi
 * LDG/Elchi webhooklaridagi `elchiActor` naqshi). Ya'ni egalik, status
 * mashinasi, kuryer/market kassasi, shtraf, marketplace va Telegram oqimi
 * oddiy kuryerdagidek ishlaydi; bu yerda YANGI PUL MANTIQI YO'Q.
 *
 * Bu qatlam faqat qo'shadi:
 *   - kontrakt egaligi (begona / Elchi nazoratidagi buyurtma → 404);
 *   - kontrakt shartlari (PCS bermaydigan tekshiruvlar: qisman sotuv
 *     qoidalari, rollback cheklovlari);
 *   - `Idempotency-Key` va xato xaritasi;
 *   - barqaror javob ko'rinishi (`toCarrierOrderView`).
 *
 * ⚠️ `bypassControlGuard` HECH QACHON berilmaydi.
 */
@Injectable()
export class CarrierService {
  private readonly logger = new Logger(CarrierService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,
    @InjectRepository(CashEntity)
    private readonly cashRepo: Repository<CashEntity>,
    @InjectRepository(CashboxHistoryEntity)
    private readonly historyRepo: Repository<CashboxHistoryEntity>,
    private readonly orderService: OrderService,
    private readonly postService: PostService,
    private readonly idempotency: CarrierIdempotencyService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ═══════════════════════════ Egalik ═══════════════════════════

  /**
   * EGALIK PREDIKATI — barcha endpointlarda BITTA.
   *
   * Buyurtma kompaniyaniki, agar:
   *   (a) uning pochtasi (`order.post_id → post.courier_id`) bog'langan
   *       kuryerga biriktirilgan — PCS `assertCourierOwnsOrder` bilan ayni
   *       zanjir; yoki
   *   (b) u kompaniyaning O'ZI qaytargan posilkasi: qaytarish pochtasi
   *       (`canceled_post_id → post.courier_id`) shu kuryerniki va holati
   *       `cancelled (sent)` / `closed`. Takroriy `/returns` va skan uni
   *       "begona" demasin (Elchi `ownReturnPostIds` bilan bir xil).
   *       Holat sharti ATAYLAB: almashtirishning ESKI buyurtmasi ham kuryer
   *       qaytarish pochtasiga biriktiriladi (status SOLD qoladi) — u
   *       kompaniyaga ko'rinmasin (rollback qilib boshqa kuryerning sotuvini
   *       buzolmasin).
   * VA har doim `control_owner` bo'sh.
   */
  private ownedOrders(courierId: string): SelectQueryBuilder<OrderEntity> {
    return this.orderRepo
      .createQueryBuilder('o')
      .leftJoin(PostEntity, 'carrier_post', 'carrier_post.id = o.post_id')
      .leftJoin(
        PostEntity,
        'carrier_return_post',
        'carrier_return_post.id = o.canceled_post_id',
      )
      .where(NOT_CONTROLLED_SQL)
      .andWhere(
        new Brackets((qb) => {
          qb.where('carrier_post.courier_id = :carrierCourierId').orWhere(
            '(carrier_return_post.courier_id = :carrierCourierId AND o.status IN (:...carrierReturnedStatuses))',
          );
        }),
      )
      .setParameter('carrierCourierId', courierId)
      .setParameter('carrierReturnedStatuses', RETURNED_STATUSES);
  }

  /**
   * Javob ko'rinishi uchun bog'lanishlar — FAQAT `toCarrierOrderView`
   * o'qiydigan ustunlar (mijoz/market qatorining qolgan maydonlari, masalan
   * tarif yoki telefon tokeni, umuman o'qilmaydi).
   */
  private withViewRelations(
    qb: SelectQueryBuilder<OrderEntity>,
  ): SelectQueryBuilder<OrderEntity> {
    return qb
      .leftJoin('o.customer', 'customer')
      .leftJoin('customer.district', 'customer_district')
      .leftJoin('customer_district.region', 'customer_region')
      .leftJoin('o.district', 'district')
      .leftJoin('district.region', 'region')
      .leftJoin('o.market', 'market')
      .leftJoin('o.items', 'item')
      .leftJoin('item.product', 'product')
      .addSelect([
        'customer.id',
        'customer.name',
        'customer.phone_number',
        'customer.extra_number',
        'customer.address',
        'customer_district.id',
        'customer_district.sato_code',
        'customer_region.id',
        'customer_region.sato_code',
        'district.id',
        'district.sato_code',
        'region.id',
        'region.sato_code',
        'market.id',
        'market.name',
        'item.id',
        'item.productId',
        'item.quantity',
        'item.created_at',
        'product.id',
        'product.name',
      ]);
  }

  /** Egalik + holat tekshiruvi uchun xom qator; begona/topilmagan — `null`. */
  private findOwnedRaw(
    courierId: string,
    orderId: string,
  ): Promise<RawOrder | null> {
    return this.ownedOrders(courierId)
      .select([
        'o.id',
        'o.status',
        'o.parent_order_id',
        'o.replacement_of_order_id',
        'o.replacement_state',
        'o.total_price',
        'o.original_total_price',
      ])
      .andWhere('o.id = :orderId', { orderId })
      .getOne();
  }

  /** Javob uchun to'liq (bog'lanishli) qator; begona/topilmagan — `null`. */
  private findOwnedView(
    courierId: string,
    orderId: string,
  ): Promise<OrderEntity | null> {
    return this.withViewRelations(this.ownedOrders(courierId))
      .andWhere('o.id = :orderId', { orderId })
      .getOne();
  }

  // ═══════════════════════════ Skan ═══════════════════════════

  /**
   * POSILKANI SKANERLASH. Faqat kompaniyaga tegishli buyurtma ko'rinadi.
   * `on the road` bo'lsa — kuryer nomidan QABUL QILINADI (`waiting`): sotish
   * va bekor qilish faqat shundan keyin mumkin. Boshqa holatda faqat
   * ma'lumot (takroriy skan xavfsiz).
   *
   * ⚠️ PCS `receiveOrderByQrTokenForCourier` ishlatilmaydi: u tokenni EGASIZ
   * qayta qidiradi va token takrorlangan bo'lsa (marketplace/tashqi yorliq —
   * indeks noyob emas) BOSHQA qatorni olib "pochta topilmadi" deb yiqilardi.
   * Bu yerda egalik bilan topilgan aniq buyurtma id bo'yicha qabul qilinadi.
   */
  async scan(carrier: CarrierPrincipal, rawToken: string) {
    const courierId = carrier.courier_user_id;
    // Normalizatsiya (RU klaviatura, Caps Lock) — PCS skanerlari bilan bir xil;
    // xom qiymat ham sinaladi: tashqi yorliq katta harf bilan saqlangan bo'lishi
    // mumkin. Ikkalasi ham indeksli tenglik — ketma-ket skan yo'q.
    const tokens = [
      ...new Set(
        [normalizeQrToken(rawToken), String(rawToken ?? '').trim()].filter(
          Boolean,
        ),
      ),
    ];
    if (!tokens.length) throw new NotFoundException(NOT_YOURS_MESSAGE);

    const candidates = await this.ownedOrders(courierId)
      .select(['o.id', 'o.status', 'o.created_at'])
      .andWhere('o.qr_code_token IN (:...tokens)', { tokens })
      .getMany();
    // Token noyob emas: yakunlanmagan holat afzal, keyin eng yangisi.
    const target = [...candidates].sort(
      (a, b) =>
        Number(FINAL_STATUSES.has(a.status)) -
          Number(FINAL_STATUSES.has(b.status)) ||
        Number(b.created_at ?? 0) - Number(a.created_at ?? 0) ||
        String(a.id).localeCompare(String(b.id)),
    )[0];
    if (!target) throw new NotFoundException(NOT_YOURS_MESSAGE);

    let received = false;
    if (target.status === Order_status.ON_THE_ROAD) {
      try {
        await this.postService.receiveOrderForCourierById(
          target.id,
          carrierActor(courierId),
        );
        received = true;
        this.logger.log(
          `carrier ${carrier.id} received order ${target.id} by scan`,
        );
      } catch (error) {
        await this.resolveScanFailure(courierId, target.id, error);
      }
    }

    let fresh: OrderEntity | null = null;
    try {
      fresh = await this.findOwnedView(courierId, target.id);
    } catch (error) {
      this.logger.warn(
        `carrier scan refresh failed (order ${target.id}): ${messageOf(error)}`,
      );
      if (!received) {
        throw temporarilyUnavailable("Buyurtma ma'lumotini o'qib bo'lmadi");
      }
    }
    if (!fresh) {
      /**
       * Qabul COMMIT bo'lgan — 5xx BERMAYMIZ (qayta skan `received:false`
       * deb chalg'itardi). Kompaniya buyurtmani keyinroq qayta skanerlaydi.
       */
      if (received) {
        return successRes(
          { received: true, order: null, refreshed: false },
          200,
          'Posilka qabul qilindi',
        );
      }
      throw new NotFoundException(NOT_YOURS_MESSAGE);
    }

    return successRes(
      { received, order: toCarrierOrderView(fresh), refreshed: true },
      200,
      received ? 'Posilka qabul qilindi' : 'Buyurtma topildi',
    );
  }

  /**
   * Skan qabulida xato — qayta o'qib qaror qilinadi:
   *   - endi begona → 404;
   *   - holat `on the road` emas (parallel qabul / boshqa qurilma) → xato
   *     YUTILADI, javob `received: false` + joriy ma'lumot;
   *   - hali `on the road` va PCS 400 bergan (masalan pochta SENT emas) →
   *     400 o'z matni bilan; boshqa xato → 503 (qayta urinish xavfsiz).
   */
  private async resolveScanFailure(
    courierId: string,
    orderId: string,
    error: unknown,
  ): Promise<void> {
    let after: RawOrder | null;
    try {
      after = await this.findOwnedRaw(courierId, orderId);
    } catch (readError) {
      this.logger.error(
        `carrier scan: receive failed (${messageOf(error)}) and re-read failed (${messageOf(readError)}) for order ${orderId}`,
      );
      throw temporarilyUnavailable("Posilkani qabul qilib bo'lmadi");
    }
    if (!after) throw new NotFoundException(NOT_YOURS_MESSAGE);
    if (after.status !== Order_status.ON_THE_ROAD) return;
    if (httpStatusOf(error) === 400) {
      throw new BadRequestException(messageOf(error));
    }
    this.logger.error(
      `carrier scan: receive of order ${orderId} failed (${httpStatusOf(error)}): ${messageOf(error)}`,
    );
    throw temporarilyUnavailable("Posilkani qabul qilib bo'lmadi");
  }

  // ═══════════════════════════ Holat amallari ═══════════════════════════

  /**
   * `POST /carrier/orders/:id/status`. Tartib Elchi bilan bir xil:
   * egalik (404) → isbot fayli (400) → Idempotency-Key → kontrakt shartlari →
   * PCS amali → qayta o'qish (eski kalit 409) → javob.
   *
   * Kalit `acquire` dan keyin buyurtma QAYTA o'qiladigan ikki holat (qaror
   * kalit olinishidan oldingi nusxaga tayanmasin):
   *   - `completed` kalit takrori — 200 yoki 409 STALE joriy holatdan;
   *   - qayta egallangan kalit (`priorAttemptMayHaveRun`) — buyurtma
   *     allaqachon shu amal natijasida bo'lsa pre-checksiz 200.
   *
   * `orderId` va `idempotencyKey` controller'da tekshirilgan (UUID, ≤255).
   */
  async updateStatus(
    carrier: CarrierPrincipal,
    orderId: string,
    dto: CarrierOrderStatusRequestDto,
    idempotencyKey: string,
    proof?: CarrierProofFile | null,
  ) {
    const courierId = carrier.courier_user_id;
    // Egalik — kalit ochilishidan OLDIN: begona buyurtmaga daftar yozuvi
    // ham qolmasin.
    const initial = await this.findOwnedRaw(courierId, orderId);
    if (!initial) throw new NotFoundException(NOT_YOURS_MESSAGE);

    assertCarrierProofFile(dto.status, proof);

    const lease = await this.idempotency.acquire({
      accountId: carrier.id,
      key: idempotencyKey,
      action: dto.status,
      orderId,
      binding: carrierOpBinding(dto.status, orderId, buildCarrierOpIntent(dto)),
    });
    const targets = CARRIER_STATUS_TARGETS[dto.status];

    if (lease.kind === 'completed') {
      /**
       * Ayni kalit bilan amal AVVAL bajarilgan — qayta yuritilmaydi.
       * Maqsadda bo'lsa — qonuniy takror (200), aks holda kalit eski
       * urinishniki (masalan sold → rollback → ayni kalit bilan sold) — 409.
       *
       * ⚠️ Holat `acquire` dan KEYIN qayta o'qiladi, `initial` emas: ayni
       * kalitning birinchi so'rovi hali ishlayotganda kelgan takror
       * `initial` ni `waiting` deb o'qiydi, birinchisi esa shu orada commit
       * qilib `complete()` ni yozib ulguradi. Eski nusxa bo'yicha
       * bajarilgan sotuvga "amal bajarilmadi" (409 STALE) berilardi.
       */
      const current = await this.rereadForReplay(courierId, orderId);
      if (!targets.includes(current.status)) throw staleKeyConflict();
      return this.statusResponse(courierId, orderId);
    }

    let before = initial;
    if (lease.priorAttemptMayHaveRun) {
      /**
       * CRASH OYNASI. Avvalgi urinish pul amalini COMMIT qilgan bo'lishi
       * mumkin, lekin `complete()` ga yetmagan (deploy/OOM, post-commit
       * Telegram chaqiruvi 90 s dan oshgan, yoki xatodan keyin qayta o'qish
       * yiqilgan). Kontrakt: ayni kalit bilan qayta urinish xavfsiz va amal
       * ikkinchi marta bajarilmaydi. Shuning uchun kontrakt pre-checklaridan
       * ("faqat waiting", "rollback faqat sold/cancelled") OLDIN — buyurtma
       * allaqachon shu amal natijasidami? Ha bo'lsa — muvaffaqiyat; aks
       * holda 400 "waiting emas" bajarilgan sotuvni kompaniyaga "bajarilmadi,
       * qayta urinmang" deb ko'rsatardi.
       */
      const current = await this.rereadAfterTakeover(
        courierId,
        orderId,
        lease.id,
      );
      if (isRecoveredOutcome(dto.status, current, dto.total_price)) {
        await this.idempotency.complete(lease.id, 200);
        this.logger.warn(
          `carrier ${carrier.id} ${dto.status} order ${orderId}: kalit qayta egallandi, buyurtma allaqachon ${current.status} — avvalgi urinish bajarilgan deb qabul qilindi`,
        );
        // Avvalgi urinishning audit yozuvi (commit'dan keyin yoziladi)
        // yo'qolgan bo'lishi mumkin — kanal izi tiklanadi, belgisi bilan.
        this.logAction(carrier, orderId, dto.status, null, current.status, {
          idempotency_key_hash: lease.keyHash.slice(0, 12),
          recovered_after_takeover: true,
          ...(dto.status === CarrierOrderStatus.CANCELLED && dto.reason
            ? { reason: dto.reason }
            : {}),
        });
        return this.statusResponse(courierId, orderId);
      }
      // Amal bajarilmagan — eng yangi holat bilan odatdagi yo'l.
      before = current;
    }

    let prepared: PreparedAction;
    try {
      prepared = await this.prepareAction(before, dto);
    } catch (error) {
      // Kontrakt sharti bajarilmadi (yoki tekshiruv uchun o'qib bo'lmadi) —
      // hech narsa yozilmadi, kalit bo'shaydi.
      if (error instanceof HttpException) {
        await this.idempotency.fail(lease.id, error.getStatus());
        throw error;
      }
      this.logger.error(
        `carrier ${dto.status} order ${orderId}: pre-check read failed: ${messageOf(error)}`,
      );
      await this.idempotency.fail(lease.id, 503);
      throw temporarilyUnavailable("Buyurtma ma'lumotini o'qib bo'lmadi");
    }

    try {
      await prepared.run(carrierActor(courierId));
    } catch (error) {
      // Muvaffaqiyat deb topilsa qaytadi, aks holda kontrakt xatosini otadi.
      await this.resolveActionFailure({
        courierId,
        before,
        status: dto.status,
        requestedPrice: dto.total_price,
        leaseId: lease.id,
        error,
      });
    }

    await this.idempotency.complete(lease.id, 200);
    this.logger.log(
      `carrier ${carrier.id} (${carrier.name}) → ${dto.status} order ${orderId}`,
    );

    /**
     * ESKI KALIT tekshiruvi (Elchi `:839-869`): qayta o'qilgan holat maqsadda
     * emas va amaldan oldingi holatda qolgan — amal amalda bajarilmagan.
     * O'qib bo'lmasa — amal BAJARILGAN (PCS servisi xatosiz qaytdi yoki
     * maqsad holat tasdiqlandi): 5xx emas, `refreshed: false`.
     */
    let fresh: OrderEntity | null = null;
    try {
      fresh = await this.findOwnedView(courierId, orderId);
    } catch (error) {
      this.logger.warn(
        `carrier status refresh failed (order ${orderId}): ${messageOf(error)}`,
      );
    }
    this.logAction(carrier, orderId, dto.status, before.status, fresh?.status, {
      idempotency_key_hash: lease.keyHash.slice(0, 12),
      ...(prepared.logMeta ?? {}),
    });

    if (
      fresh &&
      !targets.includes(fresh.status) &&
      fresh.status === before.status
    ) {
      throw staleKeyConflict();
    }
    if (!fresh) {
      return successRes(
        { order: null, refreshed: false },
        200,
        'Holat qabul qilindi',
      );
    }
    return successRes(
      { order: toCarrierOrderView(fresh), refreshed: true },
      200,
      'Holat qabul qilindi',
    );
  }

  /**
   * `completed` kalit takrori uchun JORIY holat. Amal bu so'rovda
   * yuritilmaydi, ya'ni o'qib bo'lmasa qaror ham qilib bo'lmaydi — 503
   * (ayni kalit bilan qayta urinish xavfsiz); endi begona — 404.
   */
  private async rereadForReplay(
    courierId: string,
    orderId: string,
  ): Promise<RawOrder> {
    let current: RawOrder | null;
    try {
      current = await this.findOwnedRaw(courierId, orderId);
    } catch (error) {
      this.logger.warn(
        `carrier replay re-read failed (order ${orderId}): ${messageOf(error)}`,
      );
      throw temporarilyUnavailable("Buyurtma ma'lumotini o'qib bo'lmadi");
    }
    if (!current) throw new NotFoundException(NOT_YOURS_MESSAGE);
    return current;
  }

  /**
   * Qayta egallangan kalit uchun JORIY holat. Kalit shu so'rovda `in_progress`
   * — xatoda bo'shatiladi (`fail`), aks holda keyingi takror 90 s 409 olardi.
   */
  private async rereadAfterTakeover(
    courierId: string,
    orderId: string,
    leaseId: string,
  ): Promise<RawOrder> {
    let current: RawOrder | null;
    try {
      current = await this.findOwnedRaw(courierId, orderId);
    } catch (error) {
      this.logger.error(
        `carrier takeover re-read failed (order ${orderId}): ${messageOf(error)}`,
      );
      await this.idempotency.fail(leaseId, 503);
      throw temporarilyUnavailable("Buyurtma ma'lumotini o'qib bo'lmadi");
    }
    if (!current) {
      await this.idempotency.fail(leaseId, 404);
      throw new NotFoundException(NOT_YOURS_MESSAGE);
    }
    return current;
  }

  /** Bajarilgan amal javobi — yangi o'qishdan; o'qib bo'lmasa `refreshed: false`. */
  private async statusResponse(courierId: string, orderId: string) {
    let fresh: OrderEntity | null = null;
    try {
      fresh = await this.findOwnedView(courierId, orderId);
    } catch (error) {
      this.logger.warn(
        `carrier status replay refresh failed (order ${orderId}): ${messageOf(error)}`,
      );
    }
    return successRes(
      fresh
        ? { order: toCarrierOrderView(fresh), refreshed: true }
        : { order: null, refreshed: false },
      200,
      'Holat qabul qilindi',
    );
  }

  /**
   * Kontrakt shartlari — PCS servisini chaqirishdan OLDIN. Hammasi 400
   * (buyurtma bu amal uchun mos holatda emas yoki tana noto'g'ri) va hech
   * narsa yozilmaydi. Qaytgan `run` — aynan qaysi PCS amali qanday DTO
   * bilan chaqirilishi.
   */
  private async prepareAction(
    before: RawOrder,
    dto: CarrierOrderStatusRequestDto,
  ): Promise<PreparedAction> {
    switch (dto.status) {
      case CarrierOrderStatus.SOLD:
        return this.prepareSell(before, dto);
      case CarrierOrderStatus.PARTLY_SOLD:
        return this.preparePartlySell(before, dto);
      case CarrierOrderStatus.CANCELLED:
        return this.prepareCancel(before, dto);
      case CarrierOrderStatus.ROLLBACK:
        return this.prepareRollback(before);
      default:
        throw new BadRequestException("status noto'g'ri");
    }
  }

  private assertWaiting(before: RawOrder): void {
    if (before.status === Order_status.WAITING) return;
    const hint =
      before.status === Order_status.ON_THE_ROAD
        ? ' Posilka hali qabul qilinmagan — avval POST /carrier/scan.'
        : '';
    throw new BadRequestException(
      `Bu amal faqat "waiting" holatidagi buyurtmada mumkin (hozirgi holat: ${before.status}).${hint}`,
    );
  }

  private prepareSell(
    before: RawOrder,
    dto: CarrierOrderStatusRequestDto,
  ): PreparedAction {
    this.assertWaiting(before);

    let oldItemCollected = dto.old_item_collected;
    if (before.replacement_of_order_id) {
      if (isOldItemRequired(before)) {
        if (dto.old_item_collected !== true) {
          throw new BadRequestException(
            `Bu almashtirish buyurtmasi (eski #${before.replacement_of_order_id} o'rniga). ` +
              'Avval eski mahsulotni mijozdan olganingizni tasdiqlang ' +
              '("Eskisini oldim", old_item_collected: true) — tasdiqsiz sotib bo\'lmaydi',
          );
        }
      } else {
        /**
         * ⚠️ TASDIQ ALLAQACHON OLINGAN (critique M2). Sotuvdan keyingi
         * rollback `replacement_state` ni tozalamaydi: ko'rinishda
         * `old_item_required: false`, lekin PCS `sellOrder` HAR QANDAY
         * almashtirish buyurtmasi uchun `old_item_collected: true` talab
         * qiladi. Kontraktga amal qilgan kompaniya 400 olmasin — bayroqni
         * adapter o'zi qo'yadi (eski mahsulot haqiqatan avval olingan).
         */
        oldItemCollected = true;
      }
    }

    const sellDto = {
      comment: dto.comment,
      old_item_collected: oldItemCollected,
    } as SellCancelOrderDto;
    return {
      run: (actor) => this.orderService.sellOrder(actor, before.id, sellDto),
    };
  }

  /**
   * QISMAN SOTUV — Elchi kontrakti qoidalari (`partlySellOrder` +
   * `matchPartlySellItems`) shu yerda, chunki PCS `partlySold` ularni
   * tekshirmaydi:
   *   - summa yuqori chegarasi yo'q (faqat `@Min(0)`);
   *   - qatorlar faqat `product_id` bilan, birinchi moslik bo'yicha;
   *   - qator bo'yicha "sotilgan ≤ asl" yo'q — +1/−1 bilan yig'indi teng
   *     qolsa PCS buni "dona o'zgarmagan narx tushishi" deb ko'radi va
   *     tashqi provayderda chegirma isbotsiz avtomatik o'tadi (critique A8).
   */
  private async preparePartlySell(
    before: RawOrder,
    dto: CarrierOrderStatusRequestDto,
  ): Promise<PreparedAction> {
    this.assertWaiting(before);

    if (before.replacement_of_order_id) {
      // PCS `partlySold` da almashtirish darvozasi YO'Q — eski mahsulot
      // tasdig'isiz qisman sotuv o'tib ketardi.
      throw new BadRequestException(
        "Almashtirish buyurtmasini qisman sotib bo'lmaydi — to'liq soting (sold) yoki bekor qiling (cancelled)",
      );
    }

    const price = Number(dto.total_price);
    if (!Number.isInteger(price) || price < 0) {
      // Kassa ustunlari bigint: kasr summa PCS ichida INSERT xatosi (500) berardi.
      throw new BadRequestException(
        "total_price manfiy bo'lmagan butun son (so'm) bo'lishi kerak",
      );
    }
    const oldTotalPrice = Number(before.total_price ?? 0);
    if (price > oldTotalPrice) {
      throw new BadRequestException(
        `Qisman sotuv summasi (${price} so'm) buyurtma summasidan ` +
          `(${oldTotalPrice} so'm) oshmasligi kerak`,
      );
    }

    const rows = await this.orderItemRepo.find({
      where: { orderId: before.id },
      select: ['id', 'productId', 'quantity', 'created_at'],
      order: { created_at: 'ASC', id: 'ASC' },
    });
    if (!rows.length) {
      // Marketplace / tashqi integratsiya buyurtmalarida tovar qatorlari
      // yo'q (critique M4) — bo'sh ro'yxat bilan PCS buni oddiy narx
      // tushirishga aylantirardi.
      throw new BadRequestException(
        "Bu buyurtmani qisman sotib bo'lmaydi: tovar qatorlari yo'q",
      );
    }
    const productIds = rows.map((row) => String(row.productId).toLowerCase());
    if (new Set(productIds).size !== productIds.length) {
      // PCS qatorni `product_id` bo'yicha birinchi moslik bilan topadi —
      // ikki qatorli mahsulotda dona noto'g'ri qatordan ayiriladi.
      throw new BadRequestException(
        "Bu buyurtmada bitta mahsulot bir necha qatorda — qisman sotuvni API orqali bajarib bo'lmaydi, BeePost operatoriga murojaat qiling",
      );
    }

    const items = dto.items ?? [];
    const oldQty = rows.reduce(
      (sum, row) => sum + Number(row.quantity ?? 0),
      0,
    );
    const newQty = items.reduce((sum, item) => {
      const qty = Number(item.quantity ?? 0);
      if (!Number.isFinite(qty) || qty < 0) {
        throw new BadRequestException("Mahsulot soni manfiy bo'lmasligi kerak");
      }
      return sum + qty;
    }, 0);
    if (newQty > oldQty) {
      throw new BadRequestException(
        'Qisman sotish soni asl sondan oshmasligi kerak',
      );
    }

    const matches = this.matchPartlySellItems(rows, items);

    if (
      !matches.some(({ row, quantity }) => Number(row.quantity) - quantity > 0)
    ) {
      throw new BadRequestException(
        'Qisman sotishda kamida bitta mahsulot soni kamaytirilishi kerak',
      );
    }
    const soldQty = matches.reduce((sum, { quantity }) => sum + quantity, 0);
    if (soldQty < 1) {
      throw new BadRequestException(
        'Qisman sotishda kamida bitta mahsulot sotilishi kerak, aks holda bekor qilishdan foydalaning',
      );
    }

    const partlyDto = {
      // PCS ma'nosi ham "SOTILGAN (yangi) dona" — kontrakt bilan bir xil.
      order_item_info: matches.map(({ row, quantity }) => ({
        product_id: row.productId,
        quantity,
      })),
      totalPrice: price,
      comment: dto.comment,
    } as PartlySoldDto;
    return {
      run: (actor) => this.orderService.partlySold(actor, before.id, partlyDto),
    };
  }

  /**
   * So'rov qatorlarini buyurtma qatorlariga moslash — Elchi
   * `matchPartlySellItems` porti (xabarlar ham aynan): avval `order_item_id`,
   * keyin `product_id`. Qo'shimcha (BeePost): har bir so'rov qatori AYNAN
   * BITTA buyurtma qatoriga to'g'ri kelishi shart — bir qatorni ikki marta
   * berib, qaysi biri hisoblanishini tasodifga qoldirib bo'lmaydi.
   */
  private matchPartlySellItems(
    rows: Array<Pick<OrderItemEntity, 'id' | 'productId' | 'quantity'>>,
    items: CarrierPartlySoldItemDto[],
  ): Array<{
    row: Pick<OrderItemEntity, 'id' | 'productId' | 'quantity'>;
    quantity: number;
  }> {
    const usage = new Map<CarrierPartlySoldItemDto, number>();
    const matches = rows.map((row) => {
      const requestItem =
        items.find(
          (item) =>
            hasValue(item.order_item_id) && sameId(item.order_item_id, row.id),
        ) ??
        items.find(
          (item) =>
            hasValue(item.product_id) && sameId(item.product_id, row.productId),
        );
      if (!requestItem) {
        throw new BadRequestException(
          `Product not found in request: ${row.productId}`,
        );
      }
      const quantity = Number(requestItem.quantity);
      if (quantity > Number(row.quantity)) {
        throw new BadRequestException(
          `Quantity cannot exceed original amount for product ${row.productId}`,
        );
      }
      usage.set(requestItem, (usage.get(requestItem) ?? 0) + 1);
      return { row, quantity };
    });

    for (const item of items) {
      if (hasValue(item.order_item_id)) {
        if (!rows.some((row) => sameId(row.id, item.order_item_id))) {
          throw new BadRequestException(
            `Order item not found in order: ${item.order_item_id}`,
          );
        }
      } else if (!rows.some((row) => sameId(row.productId, item.product_id))) {
        throw new BadRequestException(
          `Product not found in order: ${item.product_id}`,
        );
      }
      if ((usage.get(item) ?? 0) !== 1) {
        throw new BadRequestException(
          `Buyurtma qatori so'rovda bir necha marta berilgan: ${
            item.order_item_id ?? item.product_id
          }`,
        );
      }
    }
    return matches;
  }

  private prepareCancel(
    before: RawOrder,
    dto: CarrierOrderStatusRequestDto,
  ): PreparedAction {
    this.assertWaiting(before);

    const reason = dto.reason;
    if (!reason) {
      throw new BadRequestException('Bekor qilish sababi (reason) majburiy');
    }
    const comment = String(dto.comment ?? '').trim();
    if (reason === CancelReason.OTHER && !comment) {
      throw new BadRequestException(
        "Sabab 'boshqa' (OTHER) bo'lsa izoh (comment) majburiy",
      );
    }
    /**
     * BeePost'da sabab ustuni yo'q (ega qarori Q5): sabab izoh boshiga
     * yoziladi — operator buyurtma izohida ko'radi — va activity-log
     * metadata'siga alohida maydon bo'lib tushadi (hisobot uchun).
     */
    const cancelDto = {
      comment: comment ? `[${reason}] ${comment}` : `[${reason}]`,
    } as SellCancelOrderDto;
    return {
      run: (actor) =>
        this.orderService.cancelOrder(actor, before.id, cancelDto),
      logMeta: { reason },
    };
  }

  /**
   * ROLLBACK — faqat `sold` / `cancelled` (Elchi semantikasi; `paid` /
   * `partly_paid` ni BeePost operatori tuzatadi). Qo'shimcha cheklovlar:
   *   - qisman sotuvdan ajralgan BOLA buyurtma qaytarilmaydi: PCS uni
   *     to'sib qo'ymaydi, lekin faqat ota rollback'i bolani birlashtiradi —
   *     bola alohida `waiting` ga tushsa bitta posilka ikki marta sotilishi
   *     mumkin bo'lardi;
   *   - ota buyurtmaning bolasi `cancelled` dan chiqqan yoki qaytarish
   *     pochtasiga tushgan bo'lsa (critique M1): PCS faqat `cancelled`
   *     bolalarni birlashtiradi, lekin narxni DOIM asl summaga tiklaydi —
   *     ota qaytarib yuborilgan tovar narxi bilan `waiting` ga tushib,
   *     qayta sotuvda kassaga yo'q tovar puli yozilardi.
   */
  private async prepareRollback(before: RawOrder): Promise<PreparedAction> {
    const allowed: string[] = [Order_status.SOLD, Order_status.CANCELLED];
    if (!allowed.includes(before.status)) {
      throw new BadRequestException(
        `Rollback mumkin emas (holat: ${before.status}) — faqat "sold" yoki "cancelled" ` +
          'buyurtma qaytariladi; "paid" / "partly_paid" ni BeePost operatori tuzatadi',
      );
    }
    if (before.parent_order_id) {
      throw new BadRequestException(
        "Qisman sotuvdan ajralgan qismni alohida qaytarib bo'lmaydi — asl buyurtmani (parent_order_id) qaytaring",
      );
    }
    const children = await this.orderRepo.find({
      where: { parent_order_id: before.id },
      select: ['id', 'status', 'canceled_post_id'],
    });
    const blocked = children.filter(
      (child) =>
        child.status !== Order_status.CANCELLED || !!child.canceled_post_id,
    );
    if (blocked.length) {
      throw new BadRequestException(
        "Rollback mumkin emas: qisman sotuvning sotilmagan qismi allaqachon qaytarilgan yoki holati o'zgargan — BeePost operatoriga murojaat qiling",
      );
    }
    return {
      run: (actor) =>
        this.orderService.rollbackOrderToWaiting(actor, before.id, {
          target_status: RollbackTarget.WAITING,
        }),
    };
  }

  /**
   * PCS servisi xato berdi — HTTP status bo'yicha EMAS, buyurtmani QAYTA
   * O'QIB qaror qilinadi (critique I1). Sabab: PCS'da "waiting emas" — 404
   * (`sellOrder` `NotFoundException`), ya'ni status bo'yicha xaritalasak
   * "allaqachon sotilgan" posilka 503 bo'lib, kompaniya cheksiz qayta
   * urinardi.
   *
   *   1. hali bizniki va holat MAQSADDA, natija AYNAN shu amalniki
   *      (`isSameActionOutcome`) → amal bajarilgan (commit'dan keyingi xato
   *      yoki parallel ayni amal) → muvaffaqiyat. Qayta egallangan kalit
   *      takrori bu yerga yetmaydi — u pre-checklardan OLDIN
   *      (`isRecoveredOutcome`) aniqlanadi;
   *   2. `control_owner` guardi (409) yoki endi begona → 404 (yalang'och 409
   *      kompaniyaga idempotentlik to'qnashuvi bo'lib ko'rinardi);
   *   3. holat boshqa tomonga o'zgargan (boshqa amal ulgurgan) → 400;
   *   4. holat o'zgarmagan: PCS 400 → 400 o'z matni bilan; qolgani → 503
   *      (vaqtinchalik — ayni kalit bilan qayta urinish xavfsiz) + ERROR log.
   *
   * Muvaffaqiyatda qaytadi; aks holda kalitni `failed` qilib kontrakt
   * xatosini otadi.
   */
  private async resolveActionFailure(ctx: {
    courierId: string;
    before: RawOrder;
    status: CarrierOrderStatus;
    requestedPrice?: number;
    leaseId: string;
    error: unknown;
  }): Promise<void> {
    const { courierId, before, status, requestedPrice, leaseId, error } = ctx;
    const errorStatus = httpStatusOf(error);
    const errorMessage = messageOf(error);

    let after: RawOrder | null;
    try {
      after = await this.findOwnedRaw(courierId, before.id);
    } catch (readError) {
      this.logger.error(
        `carrier ${status} order ${before.id}: action failed (${errorStatus} ${errorMessage}) and re-read failed (${messageOf(readError)})`,
      );
      await this.idempotency.fail(leaseId, 503);
      throw temporarilyUnavailable("Amal natijasini tekshirib bo'lmadi");
    }

    if (after && isSameActionOutcome(status, before, after, requestedPrice)) {
      this.logger.warn(
        `carrier ${status} order ${before.id}: PCS xato berdi (${errorStatus} ${errorMessage}), lekin holat ${after.status} — muvaffaqiyat deb qabul qilindi`,
      );
      return;
    }
    if (errorStatus === 409 || !after) {
      await this.idempotency.fail(leaseId, 404);
      throw new NotFoundException(NOT_YOURS_MESSAGE);
    }
    if (after.status !== before.status) {
      await this.idempotency.fail(leaseId, 400);
      throw new BadRequestException(
        `Buyurtma holati o'zgardi: ${after.status}`,
      );
    }
    if (errorStatus === 400) {
      await this.idempotency.fail(leaseId, 400);
      throw new BadRequestException(errorMessage || "So'rov bajarilmadi");
    }

    this.logger.error(
      `carrier ${status} order ${before.id}: PCS ${errorStatus} → 503: ${errorMessage}`,
    );
    await this.idempotency.fail(leaseId, 503);
    throw temporarilyUnavailable(
      errorStatus === 404 && errorMessage
        ? `Ichki ma'lumot topilmadi (${errorMessage})`
        : "Amalni hozir bajarib bo'lmadi",
    );
  }

  /** Audit izi — kanal (Carrier API) va kalit iz'i bilan. Best-effort. */
  private logAction(
    carrier: CarrierPrincipal,
    orderId: string,
    action: CarrierOrderStatus,
    /** `null` — amaldan oldingi holat noma'lum (qayta egallangan kalit). */
    beforeStatus: string | null,
    afterStatus: string | null | undefined,
    meta: Record<string, unknown>,
  ): void {
    try {
      void this.activityLog
        .log({
          // ⚠️ `'order'` — PCS buyurtma tarixi shu `entity_type` bo'yicha
          // o'qiladi (`getLogsByEntity`); boshqa nom bilan yozilsa amal
          // buyurtma tarixida ko'rinmasdi.
          entity_type: 'order',
          entity_id: orderId,
          action: `carrier.${action}`,
          old_value: beforeStatus ? { status: beforeStatus } : null,
          new_value: afterStatus ? { status: afterStatus } : null,
          description: `Carrier API (${carrier.name}): ${action}`,
          user: carrierActor(carrier.courier_user_id),
          metadata: {
            source: 'carrier_api',
            carrier_account_id: carrier.id,
            carrier_name: carrier.name,
            ...meta,
          },
        })
        .catch(() => undefined);
    } catch {
      // Audit yozuvi asosiy amalni hech qachon to'xtatmaydi.
    }
  }

  // ═══════════════════════════ Qaytarish ═══════════════════════════

  /**
   * BEKOR QILINGAN POSILKALARNI QAYTARISH — PCS `createCanceledPost`
   * (kuryerning yagona CANCELED pochtasi, advisory lock). Elchi semantikasi:
   *   - allaqachon SHU kompaniyaning qaytarish pochtasida (`cancelled (sent)`
   *     / `closed`) — takror xavfsiz, o'sha `post_id` qaytadi (PCS o'zi 400
   *     berardi);
   *   - begona (yoki Elchi nazoratida) bittasi bo'lsa ham — butun so'rov 404,
   *     id'lar xabarda;
   *   - `cancelled` emas — 400;
   *   - qolganlari PCS'ga.
   */
  async createReturns(carrier: CarrierPrincipal, orderIds: string[]) {
    const courierId = carrier.courier_user_id;
    const ids = [
      ...new Set(
        (orderIds ?? []).map((id) =>
          String(id ?? '')
            .trim()
            .toLowerCase(),
        ),
      ),
    ];
    const badIds = ids.filter((id) => !CARRIER_UUID_RE.test(id));
    if (!ids.length || badIds.length) {
      throw new BadRequestException(
        `Buyurtma id noto'g'ri: ${badIds.join(', ') || '(bo‘sh)'}`,
      );
    }

    return this.withReturnsLock(courierId, () =>
      this.createReturnsLocked(carrier, ids),
    );
  }

  /**
   * Bitta kompaniyaning `/carrier/returns` so'rovlari KETMA-KET bajariladi.
   *
   * NEGA. Kontrakt "takroriy so'rov xavfsiz" deydi — provayder ayni
   * ro'yxatni parallel ham yuboradi. Ikkala so'rovning oldindan o'qishi
   * (qulfsiz) posilkani `cancelled` deb ko'radi va ikkalasi ham
   * `createCanceledPost` ga boradi. PCS u yerda buyurtmalarni advisory
   * lock'dan OLDIN o'qiydi va qulfdan keyin qayta tekshirmaydi: ikkinchi
   * tranzaksiya posilkani qaytarish pochtasiga YANA qo'shib, pochtadagi
   * `order_quantity` / `post_total_price` ni ikki marta oshiradi (markaz
   * qabul qilguncha son va summa noto'g'ri). Bu yerda kompaniya so'rovlari
   * navbatga turadi: ikkinchisi birinchisi commit bo'lgach o'qiydi va
   * posilkani "allaqachon qaytarilgan" (o'sha `post_id`) deb ko'radi.
   *
   * Qulf alohida tranzaksiyada va BOSHQA kalit bilan (`carrier_returns:*`):
   * PCS ichidagi `canceled_post:*` qulfi bilan bir xil kalit o'z-o'zini
   * kutib qolardi (ikki ulanish). Carrier kuryeri nomidan bu metodni faqat
   * Carrier API chaqiradi (kuryer sessiyasi yo'q), ya'ni boshqa yo'l bilan
   * poyga qolmaydi. Kutish `lock_timeout` bilan cheklangan — ulanishlar
   * cheksiz band bo'lib qolmasin; vaqt tugasa 503 (takror xavfsiz).
   */
  private async withReturnsLock<T>(
    courierId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await this.orderRepo.manager.transaction(async (lockManager) => {
        await lockManager.query(
          `SET LOCAL lock_timeout = '${CARRIER_RETURNS_LOCK_TIMEOUT_MS}ms'`,
        );
        await lockManager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `carrier_returns:${courierId}`,
        ]);
        return work();
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `carrier returns (courier ${courierId}) failed: ${messageOf(error)}`,
      );
      throw carrierHttpError(
        503,
        "Qaytarishni hozir bajarib bo'lmadi — birozdan keyin ayni so'rovni qayta yuboring (takror xavfsiz)",
        CARRIER_ERROR_CODES.TEMPORARILY_UNAVAILABLE,
      );
    }
  }

  private async createReturnsLocked(carrier: CarrierPrincipal, ids: string[]) {
    const courierId = carrier.courier_user_id;
    const rows: Array<{
      id: string;
      status: string;
      canceled_post_id: string | null;
      control_owner: string | null;
      post_courier_id: string | null;
      return_post_courier_id: string | null;
    }> = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin(PostEntity, 'carrier_post', 'carrier_post.id = o.post_id')
      .leftJoin(
        PostEntity,
        'carrier_return_post',
        'carrier_return_post.id = o.canceled_post_id',
      )
      .select('o.id', 'id')
      .addSelect('o.status', 'status')
      .addSelect('o.canceled_post_id', 'canceled_post_id')
      .addSelect('o.control_owner', 'control_owner')
      .addSelect('carrier_post.courier_id', 'post_courier_id')
      .addSelect('carrier_return_post.courier_id', 'return_post_courier_id')
      .where('o.id IN (:...ids)', { ids })
      .getRawMany();
    const byId = new Map(
      rows.map((row) => [String(row.id).toLowerCase(), row]),
    );

    const toSend: string[] = [];
    const alreadySent: Array<{ id: string; canceled_post_id: string }> = [];
    const notYours: string[] = [];
    const wrongStatus: string[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      const controlled = !!String(row?.control_owner ?? '').trim();
      if (
        row &&
        !controlled &&
        row.canceled_post_id &&
        sameId(row.return_post_courier_id, courierId) &&
        RETURNED_STATUSES.includes(row.status)
      ) {
        alreadySent.push({
          id,
          canceled_post_id: String(row.canceled_post_id),
        });
      } else if (
        !row ||
        controlled ||
        !sameId(row.post_courier_id, courierId)
      ) {
        notYours.push(id);
      } else if (row.status !== String(Order_status.CANCELLED)) {
        wrongStatus.push(`${id} (${row.status})`);
      } else {
        toSend.push(id);
      }
    }
    if (notYours.length) {
      throw new NotFoundException(
        `${NOT_YOURS_MESSAGE}: ${notYours.join(', ')}`,
      );
    }
    if (wrongStatus.length) {
      throw new BadRequestException(
        `Faqat bekor qilingan (cancelled) posilkani qaytarish mumkin: ${wrongStatus.join(', ')}`,
      );
    }

    let postId = alreadySent[0]?.canceled_post_id ?? '';
    if (toSend.length) {
      const result = (await this.postService.createCanceledPost(
        carrierActor(courierId),
        { order_ids: toSend } as ReceivePostDto,
      )) as { data?: { post_id?: unknown } } | undefined;
      const created = result?.data?.post_id;
      postId = (typeof created === 'string' && created) || postId;
      this.logger.log(
        `carrier ${carrier.id} returned ${toSend.length} cancelled order(s) → post ${postId}`,
      );
    }

    return successRes(
      { post_id: postId, order_ids: ids },
      200,
      'Qaytarish pochtasi tayyor',
    );
  }

  // ═══════════════════════════ Ro'yxat ═══════════════════════════

  /**
   * KOMPANIYADAGI BUYURTMALAR (solishtirish uchun).
   *
   * ⚠️ `allCouriersOrders` ishlatilmaydi: u kuryerning BARCHA pochta id'larini
   * `IN (...)` ro'yxatiga yuklaydi (kompaniya = bitta kuryer, ro'yxat vaqt
   * o'tib cheksiz o'sadi), qaytarilgan posilkalarni qoldiradi va
   * `control_owner` ni bilmaydi. Bu yerda bitta JOIN + sahifalash.
   *
   * Qaytarilgan posilka (qaytarish pochtasida, `cancelled (sent)` / `closed`)
   * ro'yxatdan chiqadi — u endi kompaniyada emas (kontrakt §5.5).
   */
  async listOrders(carrier: CarrierPrincipal, query: CarrierOrderListQueryDto) {
    const statuses = String(query.status ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = statuses.filter(
      (s) => !CARRIER_ORDER_LIST_STATUSES.includes(s),
    );
    if (unknown.length) {
      throw new BadRequestException(`Noma'lum holat: ${unknown.join(', ')}`);
    }
    // DTO regex'i oy/kun oralig'ini tekshiradi, lekin `2026-02-31` ni
    // o'tkazib yuboradi — `toUzbekistanTimestamp` uni JIMGINA 3-martga
    // aylantirardi (kompaniya boshqa oynani olardi). Kassa bilan bir xil 400.
    for (const day of [query.from, query.to]) {
      if (day && !isRealDay(day)) {
        throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
      }
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    // Elchi holati BeePost'da yo'q (`waiting_customer`, `returned_to_market`)
    // — 400 emas, bo'sh natija. PG enumiga begona qiymat yuborilmaydi (SQL xatosi).
    const pcsStatuses = [...new Set(statuses)].filter((s) =>
      PCS_ORDER_STATUSES.has(s),
    );
    if (statuses.length && !pcsStatuses.length) {
      return successRes({ items: [], total: 0, page, limit }, 200, 'orders');
    }

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .innerJoin(
        PostEntity,
        'carrier_post',
        'carrier_post.id = o.post_id AND carrier_post.courier_id = :carrierCourierId',
        { carrierCourierId: carrier.courier_user_id },
      )
      .where(NOT_CONTROLLED_SQL)
      .andWhere(
        'NOT (o.canceled_post_id IS NOT NULL AND o.status IN (:...carrierReturnedStatuses))',
        { carrierReturnedStatuses: RETURNED_STATUSES },
      );
    if (pcsStatuses.length) {
      qb.andWhere('o.status IN (:...carrierStatuses)', {
        carrierStatuses: pcsStatuses,
      });
    }
    // `from`/`to` — BUYURTMA YARATILGAN Toshkent kuni (chegaralar kiradi).
    if (query.from) {
      qb.andWhere('o.created_at >= :carrierFrom', {
        carrierFrom: toUzbekistanTimestamp(query.from),
      });
    }
    if (query.to) {
      qb.andWhere('o.created_at <= :carrierTo', {
        carrierTo: toUzbekistanTimestamp(query.to, true),
      });
    }

    const [rows, total] = await this.withViewRelations(qb)
      .orderBy('o.created_at', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return successRes(
      { items: rows.map((row) => toCarrierOrderView(row)), total, page, limit },
      200,
      'orders',
    );
  }

  // ═══════════════════════════ Kassa ═══════════════════════════

  /**
   * KURYER KASSASI: balans (oynaga bog'liq emas) va oynadagi harakatlar.
   *
   * Oyna MAJBURIY (sukut — oxirgi 30 Toshkent kuni, eng ko'pi 92): kompaniya
   * = bitta kuryer, ya'ni tarix vaqt o'tib juda katta bo'ladi — oynasiz
   * so'rov sekinlashib ketardi (Elchi bilan bir xil qoida). PCS `myCashbox`
   * ishlatilmaydi: sukuti "bugun", chegarasi yo'q va xodim ma'lumotlarini
   * (`createdByUser`, `sourceUser`) yuklaydi.
   */
  async cashbox(carrier: CarrierPrincipal, query: CarrierCashboxQueryDto) {
    const to = query.to ?? toUzbekistanDateString(Date.now());
    const from = query.from ?? shiftDay(to, -(CASHBOX_DEFAULT_DAYS - 1));
    if (!isRealDay(from) || !isRealDay(to)) {
      throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
    }
    const span = dayDiff(from, to);
    if (span < 0) {
      throw new BadRequestException('from to dan keyin bo‘lmasin');
    }
    if (span + 1 > CASHBOX_MAX_DAYS) {
      throw new BadRequestException(
        `Oraliq ${CASHBOX_MAX_DAYS} kundan oshmasin — bo‘lib so‘rang`,
      );
    }

    const cashbox = await this.cashRepo.findOne({
      where: {
        user_id: carrier.courier_user_id,
        cashbox_type: Cashbox_type.FOR_COURIER,
      },
      select: ['id', 'balance'],
    });
    const history = cashbox
      ? await this.historyRepo.find({
          where: {
            cashbox_id: cashbox.id,
            created_at: Between(
              toUzbekistanTimestamp(from),
              toUzbekistanTimestamp(to, true),
            ),
          },
          // Faqat allowlist ustunlari — xodim bog'lanishlari umuman yuklanmaydi.
          select: [
            'id',
            'operation_type',
            'source_type',
            'source_id',
            'amount',
            'balance_after',
            'payment_method',
            'comment',
            'created_at',
          ],
          order: { created_at: 'DESC', id: 'DESC' },
        })
      : [];

    return successRes(
      {
        from,
        to,
        ...toCarrierCashboxView({ balance: cashbox?.balance ?? 0, history }),
      },
      200,
      'cashbox',
    );
  }
}
