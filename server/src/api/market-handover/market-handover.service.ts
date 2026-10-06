import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { MarketReturnHandoverSessionEntity } from 'src/core/entity/market-return-handover-session.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import {
  CancelReturnStage,
  Order_status,
  Replacement_state,
  Roles,
} from 'src/common/enums';
import {
  awaitingMarketSql,
  awaitingMarketWhere,
} from 'src/common/utils/cancel-return.util';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { successRes } from 'src/infrastructure/lib/response';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  MARKET_HANDOVER_AUTH_TTL_MS,
  MARKET_HANDOVER_HEARTBEAT_GRACE_MS,
  MARKET_HANDOVER_HEARTBEAT_INTERVAL_MS,
  MARKET_HANDOVER_PIN_MAX_ATTEMPTS,
  MARKET_HANDOVER_QR_TTL_MS,
  MarketHandoverChannel,
  MarketHandoverCloseReason,
  MarketHandoverMode,
  MarketHandoverSessionStatus,
} from './market-handover.enums';
import {
  AwaitingQueryDto,
  CompleteHandoverDto,
  OfflineHandoverDto,
  ScanHandoverDto,
} from './dto/market-handover.dto';

/**
 * BEKOR QAYTARISHNI MARKETGA TOPSHIRISH — 2-BOSQICH.
 *
 * 1-bosqich (viloyatdan markazga qabul) `post.service.ts` va
 * `order.service.ts` da qoladi va MEXANIKASI O'ZGARMADI — u faqat
 * `center_received_at` dalilini yozadi.
 *
 * Bu servis esa YOPISHNI boshqaradi: posilka faqat MARKET RUXSATI bilan
 * (yoki offline akt bilan) `CLOSED` bo'ladi.
 *
 * ⚠️ NEGA ALOHIDA MODUL: `order.service.ts` 8000+ qator. Sessiya, TTL,
 * heartbeat, partiya atomikligi va offline akt o'z joyida turishi kerak.
 */
/** `listAwaitingByMarket` ning xom SQL qatori (pg SATR qaytaradi). */
interface AwaitingMarketRow {
  market_id: string;
  market_name: string | null;
  market_phone: string | null;
  consent_required: boolean;
  parcel_count: number | string;
  total_price: number | string;
  oldest_center_received_at: number | string;
  newest_center_received_at: number | string;
  escalated_count: number | string;
  /** Posilkalar QAYSI viloyatlardan kelgan («Navoiy, Andijon»). */
  regions: string | null;
  district_count: number | string;
  item_count: number | string;
  replacement_count: number | string;
}

@Injectable()
export class MarketHandoverService {
  private readonly logger = new Logger(MarketHandoverService.name);

  constructor(
    @InjectRepository(MarketReturnHandoverSessionEntity)
    private readonly sessionRepo: Repository<MarketReturnHandoverSessionEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ──────────────────────────── YORDAMCHILAR ────────────────────────────

  /** Xom token saqlanmaydi — faqat sha256 hex (izoh: entity faylida). */
  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * PIN hash'i market bilan BIRGA tuzladi: bir xil PIN ikki marketda turlicha
   * hash beradi, ya'ni hash bo'yicha "kimdir shu PIN'ni ishlatgan" deb
   * butun bazani qidirib bo'lmaydi.
   */
  private pinHash(marketId: string, pin: string): string {
    return this.hash(`${marketId}:${pin}`);
  }

  /**
   * Amaldagi topshirish ruxsatini topadi va TO'LIQ tekshiradi.
   *
   * Tekshiruvlar ketma-ketligi ataylab shunday: avval egalik (kim), keyin
   * holat, keyin vaqt, keyin sahifa tirikligi. Muddati/heartbeat'i o'tgan
   * sessiya DARHOL yopiladi — "o'lik lekin ochiq" sessiya qolmaydi.
   */
  private async resolveActiveSession(
    manager: EntityManager,
    rawToken: string,
    user: JwtPayload,
  ): Promise<MarketReturnHandoverSessionEntity> {
    const token = String(rawToken ?? '').trim();
    if (!token.startsWith('MRA-')) {
      throw new BadRequestException('authorization_token noto‘g‘ri');
    }

    const repo = manager.getRepository(MarketReturnHandoverSessionEntity);
    const session = await repo.findOne({
      where: { authorization_token_hash: this.hash(token) },
      lock: { mode: 'pessimistic_write' },
    });
    if (!session) {
      throw new ForbiddenException('Topshirish ruxsati topilmadi');
    }
    if (String(session.scanned_by_user_id ?? '') !== String(user.id)) {
      throw new ForbiddenException('Ruxsat boshqa xodimga tegishli');
    }
    if (session.status !== MarketHandoverSessionStatus.ACTIVE) {
      throw new ForbiddenException(
        'Topshirish ruxsati yopilgan — market yangi QR ko‘rsatsin',
      );
    }

    const now = Date.now();
    if (
      session.authorization_expires_at == null ||
      Number(session.authorization_expires_at) <= now
    ) {
      await this.closeSession(
        repo,
        session.id,
        MarketHandoverCloseReason.EXPIRED,
        now,
      );
      throw new ForbiddenException(
        '10 daqiqalik topshirish oynasi tugadi — market yangi QR ko‘rsatsin',
      );
    }
    // Ruxsat SAHIFAGA bog'langan: `release` kelmasa ham (brauzer qulashi,
    // tarmoq uzilishi) heartbeat eskirib sessiya o'ladi.
    if (
      session.last_seen_at != null &&
      now - Number(session.last_seen_at) > MARKET_HANDOVER_HEARTBEAT_GRACE_MS
    ) {
      await this.closeSession(
        repo,
        session.id,
        MarketHandoverCloseReason.HEARTBEAT_LOST,
        now,
      );
      throw new ForbiddenException(
        'Topshirish sahifasi yopilgan — ruxsat tugadi, market yangi QR ko‘rsatsin',
      );
    }

    return session;
  }

  private async closeSession(
    repo: Repository<MarketReturnHandoverSessionEntity>,
    id: string,
    reason: MarketHandoverCloseReason,
    now = Date.now(),
  ): Promise<void> {
    await repo.update(
      { id },
      {
        status: MarketHandoverSessionStatus.CLOSED,
        closed_at: now,
        close_reason: reason,
      },
    );
  }

  /** Marketni topadi va rol/holatini tekshiradi. */
  private async requireMarket(marketId: string): Promise<UserEntity> {
    const market = await this.userRepo.findOne({
      where: { id: marketId, role: Roles.MARKET },
    });
    if (!market) throw new NotFoundException('Market topilmadi');
    return market;
  }

  // ─────────────────────── MARKET: RUXSAT YARATISH ───────────────────────

  /**
   * Market o'z kabinetida «Topshirishga ruxsat beraman» tugmasini bosdi.
   *
   * ⚠️ `market_id` TOKENDAN olinadi, URL/body'dan EMAS — `extra-cost` dagi
   * IDOR saboqining aynan o'zi.
   */
  async createConsent(user: JwtPayload) {
    const marketId = String(user.id);
    const now = Date.now();

    // Oldingi skanerlanmagan ruxsat BEKOR qilinadi: market ikki marta bossa
    // ikkita amaldagi QR qolib ketmasin (qaysi biri ishlayotgani noma'lum
    // bo'lardi va eski ekran yaroqsiz QR ko'rsatib turardi).
    await this.sessionRepo.update(
      {
        market_id: marketId,
        status: MarketHandoverSessionStatus.PENDING,
      },
      {
        status: MarketHandoverSessionStatus.CLOSED,
        closed_at: now,
        close_reason: MarketHandoverCloseReason.SUPERSEDED,
      },
    );

    /**
     * ⚠️ PREFIKS KICHIK HARFLARDA — ATAYLAB.
     *
     * Apparat (klaviatura-wedge) skaner o'qigan tokenni klient
     * `normalizeQrToken` orqali o'tkazadi, u esa Caps Lock / RU layout
     * himoyasi uchun HAMMASINI kichik harfga tushiradi. Katta harfli
     * prefiks bo'lsa skanerlangan qiymat generatsiya qilinganidan farq
     * qilardi → sha256 MOS KELMASDI va market QR'i HECH QACHON
     * topilmasdi (skaner yo'li butunlay o'lik bo'lardi).
     *
     * Token tanasi `generateCustomToken` dan keladi — u allaqachon
     * kichik harfli hex, ya'ni normalizatsiyadan O'ZGARMASDAN o'tadi.
     */
    const qrToken = `mrc-${generateCustomToken(16)}`;
    // 6 xonali PIN — QR zaxirasi (market telefoni eski/ekrani xira bo'lsa).
    const pin = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = now + MARKET_HANDOVER_QR_TTL_MS;

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        market_id: marketId,
        status: MarketHandoverSessionStatus.PENDING,
        channel: MarketHandoverChannel.WEB,
        qr_token_hash: this.hash(qrToken),
        pin_hash: this.pinHash(marketId, pin),
        qr_expires_at: expiresAt,
        pin_attempts: 0,
        handed_over_count: 0,
      }),
    );

    const awaiting = await this.orderRepo.count({
      where: { user_id: marketId, ...awaitingMarketWhere() },
    });

    return successRes(
      {
        session_id: session.id,
        qr_token: qrToken,
        pin,
        expires_at: expiresAt,
        ttl_seconds: Math.floor(MARKET_HANDOVER_QR_TTL_MS / 1000),
        awaiting_count: awaiting,
      },
      201,
      'Topshirishga ruxsat ochildi — xodimga QR yoki PIN ko‘rsating',
    );
  }

  // ──────────────────────── XODIM: SKAN / PIN ────────────────────────

  /**
   * Xodim market QR'ini skanerladi yoki PIN'ni kiritdi.
   *
   * Natija — 10 daqiqalik ruxsat (`MRA-…`), AYNAN shu xodimga tegishli.
   */
  async scan(dto: ScanHandoverDto, user: JwtPayload) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const repo = qr.manager.getRepository(MarketReturnHandoverSessionEntity);
      const now = Date.now();
      let session: MarketReturnHandoverSessionEntity | null = null;

      // ⚠️ KICHIK HARFGA keltiriladi: apparat skaner Caps Lock bilan
      // KATTA harfda yuborishi mumkin, klient normalizatori esa kichik
      // harfga tushiradi. Ikkisi ham AYNI hashga tushishi kerak.
      const rawQr = String(dto.qr_token ?? '')
        .trim()
        .toLowerCase();
      if (rawQr) {
        if (!rawQr.startsWith('mrc-')) {
          throw new BadRequestException('QR token noto‘g‘ri');
        }
        session = await repo.findOne({
          where: { qr_token_hash: this.hash(rawQr) },
          lock: { mode: 'pessimistic_write' },
        });
      } else {
        // PIN yo'li: market avval tanlanadi (brute-force maydonini bitta
        // marketning 2 daqiqalik sessiyasiga qisadi).
        if (!dto.market_id || !dto.pin) {
          throw new BadRequestException(
            'qr_token yoki (market_id + pin) yuborilishi kerak',
          );
        }
        session = await repo.findOne({
          where: {
            market_id: dto.market_id,
            pin_hash: this.pinHash(dto.market_id, dto.pin),
            status: MarketHandoverSessionStatus.PENDING,
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (!session) {
          // Noto'g'ri PIN sessiyani TOPMAYDI, shuning uchun urinishni
          // marketning amaldagi PENDING sessiyasiga yozamiz — aks holda
          // chegara hech qachon ishlamasdi.
          const blocked = await this.registerPinFailure(
            repo,
            dto.market_id,
            now,
          );
          await qr.commitTransaction();
          throw new ForbiddenException(
            blocked
              ? 'PIN bir necha marta xato kiritildi — market yangi QR/PIN ko‘rsatsin'
              : 'PIN noto‘g‘ri',
          );
        }
      }

      if (!session) {
        throw new NotFoundException('Ruxsat topilmadi yoki yangilangan');
      }
      if (session.status !== MarketHandoverSessionStatus.PENDING) {
        throw new BadRequestException(
          'Bu ruxsat allaqachon ishlatilgan — market yangi QR ko‘rsatsin',
        );
      }
      if (
        session.qr_expires_at == null ||
        Number(session.qr_expires_at) <= now
      ) {
        await this.closeSession(
          repo,
          session.id,
          MarketHandoverCloseReason.EXPIRED,
          now,
        );
        await qr.commitTransaction();
        throw new BadRequestException(
          'Ruxsat muddati tugagan — market yangi QR ko‘rsatsin',
        );
      }

      const authToken = `MRA-${generateCustomToken(16)}`;
      const authExpiresAt = now + MARKET_HANDOVER_AUTH_TTL_MS;
      await repo.update(
        { id: session.id, status: MarketHandoverSessionStatus.PENDING },
        {
          status: MarketHandoverSessionStatus.ACTIVE,
          scanned_at: now,
          scanned_by_user_id: String(user.id),
          authorization_token_hash: this.hash(authToken),
          authorization_expires_at: authExpiresAt,
          last_seen_at: now,
        },
      );

      await qr.commitTransaction();

      void this.activityLog.log({
        entity_type: 'market_handover_session',
        entity_id: session.id,
        action: 'handover_authorized',
        new_value: {
          market_id: session.market_id,
          via: rawQr ? 'qr' : 'pin',
          expires_at: authExpiresAt,
        },
        description: `Market ruxsati ochildi — ${Math.floor(MARKET_HANDOVER_AUTH_TTL_MS / 60000)} daqiqa`,
        user,
      });

      return successRes(
        {
          session_id: session.id,
          market_id: String(session.market_id),
          authorization_token: authToken,
          expires_at: authExpiresAt,
          remaining_seconds: Math.floor(MARKET_HANDOVER_AUTH_TTL_MS / 1000),
          heartbeat_interval_seconds: Math.floor(
            MARKET_HANDOVER_HEARTBEAT_INTERVAL_MS / 1000,
          ),
        },
        200,
        'Topshirishga ruxsat ochildi',
      );
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * Noto'g'ri PIN urinishini sanaydi. Chegaradan oshsa sessiya BLOKLANADI
   * (market yangi QR/PIN ko'rsatishi kerak).
   *
   * @returns sessiya bloklandimi
   */
  private async registerPinFailure(
    repo: Repository<MarketReturnHandoverSessionEntity>,
    marketId: string,
    now: number,
  ): Promise<boolean> {
    const pending = await repo.findOne({
      where: {
        market_id: marketId,
        status: MarketHandoverSessionStatus.PENDING,
      },
      order: { created_at: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!pending) return false;

    const attempts = Number(pending.pin_attempts ?? 0) + 1;
    if (attempts >= MARKET_HANDOVER_PIN_MAX_ATTEMPTS) {
      await repo.update(
        { id: pending.id },
        {
          pin_attempts: attempts,
          status: MarketHandoverSessionStatus.CLOSED,
          closed_at: now,
          close_reason: MarketHandoverCloseReason.PIN_BLOCKED,
        },
      );
      return true;
    }
    await repo.update({ id: pending.id }, { pin_attempts: attempts });
    return false;
  }

  /** Topshirish sahifasi tirik — ruxsat oynasini ushlab turadi. */
  async heartbeat(token: string, user: JwtPayload) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const session = await this.resolveActiveSession(qr.manager, token, user);
      const now = Date.now();
      await qr.manager
        .getRepository(MarketReturnHandoverSessionEntity)
        .update({ id: session.id }, { last_seen_at: now });
      await qr.commitTransaction();

      return successRes(
        {
          session_id: session.id,
          remaining_seconds: Math.max(
            0,
            Math.floor((Number(session.authorization_expires_at) - now) / 1000),
          ),
          handed_over_count: Number(session.handed_over_count ?? 0),
        },
        200,
        'Ruxsat amalda',
      );
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * Ruxsatni YOPADI — xodim «Yakunlash» bosdi yoki sahifadan chiqdi.
   *
   * ⚠️ IDEMPOTENT va kechirimli: allaqachon yopilgan/muddati o'tgan sessiya
   * uchun ham 200 qaytaradi. Sahifadan chiqishda bu chaqiruv `sendBeacon`
   * bilan ketadi — u yerda xatoni ko'rsatadigan odam yo'q, lekin sessiya
   * baribir yopilishi SHART.
   */
  async release(token: string, user: JwtPayload, finished = false) {
    const raw = String(token ?? '').trim();
    if (!raw.startsWith('MRA-')) {
      throw new BadRequestException('authorization_token noto‘g‘ri');
    }
    const session = await this.sessionRepo.findOne({
      where: { authorization_token_hash: this.hash(raw) },
    });
    if (!session) {
      // Topilmasa ham xato bermaymiz: sahifadan chiqish signali kechikib
      // kelgan bo'lishi mumkin (sessiya cron bilan yopilgan).
      return successRes({ closed: false }, 200, 'Ruxsat topilmadi');
    }
    if (String(session.scanned_by_user_id ?? '') !== String(user.id)) {
      throw new ForbiddenException('Ruxsat boshqa xodimga tegishli');
    }
    if (session.status === MarketHandoverSessionStatus.CLOSED) {
      return successRes({ closed: true }, 200, 'Ruxsat allaqachon yopilgan');
    }

    await this.closeSession(
      this.sessionRepo,
      session.id,
      finished
        ? MarketHandoverCloseReason.FINISHED
        : MarketHandoverCloseReason.LEFT_PAGE,
    );
    return successRes(
      {
        closed: true,
        handed_over_count: Number(session.handed_over_count ?? 0),
      },
      200,
      finished ? 'Topshirish yakunlandi' : 'Ruxsat yopildi',
    );
  }

  // ─────────────────────── XODIM: TOPSHIRISH ───────────────────────

  /**
   * Bir PARTIYA posilkani marketga topshiradi.
   *
   * Oyna (10 daqiqa) ichida bu metod KO'P MARTA chaqirilishi mumkin — market
   * bir kelganda 100–200 posilka olib ketadi va xodim ularni bo'lib-bo'lib
   * skanerlaydi. Har partiya O'Z tranzaksiyasida atomik yoziladi: oldingi
   * partiyalar keyingisi yiqilsa ham JOYIDA QOLADI.
   *
   * ⚠️ QISMAN BAJARILMAYDI: tanlangan ro'yxatdagi birorta qator shartga mos
   * kelmasa (boshqa market, markazga qabul qilinmagan, allaqachon
   * topshirilgan, o'chirilgan) — BUTUN partiya rad etiladi. Aks holda xodim
   * nima o'tib, nima o'tmaganini bilmay qolardi.
   */
  async complete(dto: CompleteHandoverDto, user: JwtPayload) {
    const orderIds = Array.from(
      new Set(
        (dto.order_ids ?? []).map((id) => String(id).trim()).filter(Boolean),
      ),
    );
    if (!orderIds.length) {
      throw new BadRequestException('Kamida bitta buyurtma tanlanishi kerak');
    }

    const overrides = new Map<string, string>();
    for (const item of dto.manual_overrides ?? []) {
      const id = String(item.order_id).trim();
      if (overrides.has(id)) {
        throw new BadRequestException(
          'manual_overrides ichida takrorlangan buyurtma bor',
        );
      }
      overrides.set(id, item.reason);
    }
    const strayOverrides = [...overrides.keys()].filter(
      (id) => !orderIds.includes(id),
    );
    if (strayOverrides.length) {
      throw new BadRequestException(
        `manual_overrides faqat tanlangan buyurtmalar uchun bo‘lishi kerak: ${strayOverrides.join(', ')}`,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let handed: OrderEntity[] = [];
    let now = Date.now();
    let sessionId = '';
    try {
      const session = await this.resolveActiveSession(
        qr.manager,
        dto.authorization_token,
        user,
      );
      if (String(session.market_id) !== String(dto.market_id)) {
        throw new ForbiddenException('Ruxsat bu market uchun berilmagan');
      }
      sessionId = session.id;
      now = Date.now();

      const orderRepo = qr.manager.getRepository(OrderEntity);
      handed = await orderRepo.find({
        where: {
          id: In(orderIds),
          user_id: String(dto.market_id),
          ...awaitingMarketWhere(),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (handed.length !== orderIds.length) {
        throw new BadRequestException(
          'Tanlangan buyurtmalarning ayrimlari bu marketga tegishli emas, markazga qabul qilinmagan yoki allaqachon topshirilgan',
        );
      }

      for (const order of handed) {
        await this.applyHandover(orderRepo, order, {
          now,
          mode: MarketHandoverMode.MARKET_WEB,
          sessionId: session.id,
          actorId: String(user.id),
        });
      }

      await qr.manager.getRepository(MarketReturnHandoverSessionEntity).update(
        { id: session.id },
        {
          handed_over_count:
            Number(session.handed_over_count ?? 0) + handed.length,
          last_seen_at: now,
        },
      );

      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }

    this.logHandover(handed, {
      user,
      now,
      mode: MarketHandoverMode.MARKET_WEB,
      sessionId,
      overrides,
    });

    return successRes(
      {
        handed_over: handed.length,
        order_ids: handed.map((o) => o.id),
        return_stage: CancelReturnStage.WITH_MARKET,
      },
      200,
      `${handed.length} ta posilka marketga topshirildi`,
    );
  }

  /**
   * OFFLINE AKT — market panelga kira olmaganda.
   *
   * QR yo'q, lekin DALIL bor: kim olib ketdi, telefoni, nega QR'siz.
   * `market_handover_mode` da `offline_signed` bo'lib qoladi, ya'ni hisobotda
   * market tasdig'idan AJRALADI.
   */
  async offlineHandover(dto: OfflineHandoverDto, user: JwtPayload) {
    const orderIds = Array.from(
      new Set(
        (dto.order_ids ?? []).map((id) => String(id).trim()).filter(Boolean),
      ),
    );
    if (!orderIds.length) {
      throw new BadRequestException('Kamida bitta buyurtma tanlanishi kerak');
    }

    const market = await this.requireMarket(String(dto.market_id));

    // Ruxsat MAJBURIY bo'lgan marketda offline aktni faqat ADMIN/SUPERADMIN
    // yozadi — registrator chetlab o'tmasin. Bayroq o'chiq bo'lsa (default)
    // registrator ham yopishi mumkin, aks holda posilkalar omborda qotardi.
    if (
      market.cancel_handover_consent_required &&
      String(user.role) === String(Roles.REGISTRATOR)
    ) {
      throw new ForbiddenException(
        'Bu marketda market ruxsati majburiy — offline aktni admin yozishi kerak',
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let handed: OrderEntity[] = [];
    const now = Date.now();
    let sessionId = '';
    try {
      const sessionRepo = qr.manager.getRepository(
        MarketReturnHandoverSessionEntity,
      );
      // Offline yo'l ham SESSIYA yozadi: dalil zanjiri bir xil shaklda
      // qolsin (order → sessiya → kim, qanday vakil, nega QR'siz).
      const session = await sessionRepo.save(
        sessionRepo.create({
          market_id: String(dto.market_id),
          status: MarketHandoverSessionStatus.CLOSED,
          channel: MarketHandoverChannel.OFFLINE,
          scanned_at: now,
          scanned_by_user_id: String(user.id),
          closed_at: now,
          close_reason: MarketHandoverCloseReason.OFFLINE_ACT,
          representative_name: dto.representative_name.trim(),
          representative_phone: dto.representative_phone.trim(),
          override_reason: dto.reason.trim(),
          pin_attempts: 0,
          handed_over_count: 0,
        }),
      );
      sessionId = session.id;

      const orderRepo = qr.manager.getRepository(OrderEntity);
      handed = await orderRepo.find({
        where: {
          id: In(orderIds),
          user_id: String(dto.market_id),
          ...awaitingMarketWhere(),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (handed.length !== orderIds.length) {
        throw new BadRequestException(
          'Tanlangan buyurtmalarning ayrimlari bu marketga tegishli emas, markazga qabul qilinmagan yoki allaqachon topshirilgan',
        );
      }

      for (const order of handed) {
        await this.applyHandover(orderRepo, order, {
          now,
          mode: MarketHandoverMode.OFFLINE_SIGNED,
          sessionId: session.id,
          actorId: String(user.id),
        });
      }

      await sessionRepo.update(
        { id: session.id },
        { handed_over_count: handed.length },
      );

      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }

    this.logHandover(handed, {
      user,
      now,
      mode: MarketHandoverMode.OFFLINE_SIGNED,
      sessionId,
      overrides: new Map(),
      offline: {
        representative_name: dto.representative_name,
        representative_phone: dto.representative_phone,
        reason: dto.reason,
      },
    });

    return successRes(
      {
        handed_over: handed.length,
        order_ids: handed.map((o) => o.id),
        mode: MarketHandoverMode.OFFLINE_SIGNED,
      },
      200,
      `${handed.length} ta posilka offline akt bilan topshirildi`,
    );
  }

  /**
   * Bitta buyurtmaga topshirish dalilini yozadi.
   *
   * ⚠️ Nishonli `update` — to'liq-entity `save()` EMAS. `save()` butun qatorni
   * diff qilib yozadi va parallel yozilgan boshqa ustunlarni (masalan
   * `extra_cost_net`) bosib ketishi mumkin.
   *
   * ⚠️ WHERE'da `market_handover_at IS NULL` — poyga holatida ikkinchi yozuv
   * 0 qatorga tegadi, ya'ni dalil bir marta yoziladi.
   */
  private async applyHandover(
    orderRepo: Repository<OrderEntity>,
    order: OrderEntity,
    ctx: {
      now: number;
      mode: MarketHandoverMode;
      sessionId: string;
      actorId: string;
    },
  ): Promise<void> {
    const patch: QueryDeepPartialEntity<OrderEntity> = {
      market_handover_at: ctx.now,
      market_handover_by: ctx.actorId,
      market_handover_mode: ctx.mode,
      market_handover_session_id: ctx.sessionId,
    };

    if (order.is_replacement_return) {
      /**
       * ALMASHTIRISH (kafolat-swap) qatori: STATUSI SOTILGAN QOLADI va puli
       * tegilmaydi (moliyaviy reversal yo'q — bu qoida o'zgarmaydi).
       *
       * "Eski mahsulot marketga qaytarildi" dalili esa AYNAN SHU YERDA
       * yoziladi: avval u markaz qabul qilgan zahoti yozilardi, ya'ni mol
       * omborda turganda marketga "sizga topshirildi" deb xabar ketardi.
       */
      patch.replacement_state = Replacement_state.OLD_RETURNED;
      patch.old_product_returned_at = ctx.now;
      patch.old_returned_by = ctx.actorId;
    } else {
      // Oddiy bekor posilkasi — ZANJIR SHU YERDA YOPILADI.
      patch.status = Order_status.CLOSED;
    }

    await orderRepo.update(
      { id: order.id, market_handover_at: IsNull() },
      patch,
    );

    if (order.is_replacement_return) {
      // Kuzatuv izchilligi: bog'liq YANGI buyurtma ham OLD_RETURNED bo'ladi
      // (`confirmOldReturned` dagi naqshning aynan o'zi).
      await orderRepo.update(
        { replacement_of_order_id: order.id },
        { replacement_state: Replacement_state.OLD_RETURNED },
      );
    }
  }

  /** Commit'dan KEYIN: har posilka uchun audit yozuvi. */
  private logHandover(
    orders: OrderEntity[],
    ctx: {
      user: JwtPayload;
      now: number;
      mode: MarketHandoverMode;
      sessionId: string;
      overrides: Map<string, string>;
      offline?: {
        representative_name: string;
        representative_phone: string;
        reason: string;
      };
    },
  ): void {
    for (const order of orders) {
      const manualReason = ctx.overrides.get(order.id);
      void this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: order.is_replacement_return
          ? 'replacement_returned'
          : 'market_handover',
        old_value: { status: order.status, market_handover_at: null },
        new_value: {
          order_number: order.order_number,
          status: order.is_replacement_return
            ? order.status
            : Order_status.CLOSED,
          market_handover_at: ctx.now,
          market_handover_mode: ctx.mode,
          return_stage: CancelReturnStage.WITH_MARKET,
        },
        description: manualReason
          ? `Buyurtma #${order.order_number} marketga topshirildi — yorliq o‘qilmagani uchun qo‘lda tasdiqlandi: ${manualReason}`
          : `Buyurtma #${order.order_number} market ruxsati bilan marketga topshirildi (${ctx.mode})`,
        user: ctx.user,
        metadata: {
          session_id: ctx.sessionId,
          mode: ctx.mode,
          manual_override: Boolean(manualReason),
          manual_reason: manualReason ?? null,
          ...(ctx.offline ? { offline: ctx.offline } : {}),
        },
      });
    }
  }

  // ─────────────────────────── RO'YXATLAR ───────────────────────────

  /**
   * XODIM NAVBATI — «Markazda, market kutilmoqda», MARKET bo'yicha guruhlab.
   *
   * ⚠️ Pochta bo'yicha EMAS, market bo'yicha: market omborga O'Z posilkalarini
   * olishga keladi, pochta bo'yicha emas. Hajm o'lchovi kuniga ~150 qaytarish,
   * ya'ni navbatda doimiy 450–2000 qator bo'lishi mumkin — shuning uchun
   * agregat SQL'da bajariladi va sahifalanadi.
   */
  async listAwaitingByMarket(query: AwaitingQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .innerJoin(UserEntity, 'm', 'm.id = o.user_id')
      // ⚠️ VILOYAT uchun: admin «qaysi viloyatlardan yig'ilib qolgan» ni
      // bir ko'rishda ko'rishi kerak — tuman nomi yolg'iz holda noaniq.
      // `leftJoin`: tumani o'chirilgan eski buyurtma qatordan TUSHIB
      // qolmasligi uchun (innerJoin bo'lsa posilka sanoqdan chiqardi).
      .leftJoin(DistrictEntity, 'd', 'd.id = o.district_id')
      .leftJoin(RegionEntity, 'r', 'r.id = d.region_id')
      .where(awaitingMarketSql('o'))
      .select('o.user_id', 'market_id')
      .addSelect('m.name', 'market_name')
      .addSelect('m.phone_number', 'market_phone')
      .addSelect('m.cancel_handover_consent_required', 'consent_required')
      .addSelect('COUNT(*)::int', 'parcel_count')
      .addSelect('COALESCE(SUM(o.total_price), 0)::float8', 'total_price')
      .addSelect('COALESCE(SUM(o.product_quantity), 0)::int', 'item_count')
      .addSelect('MIN(o.center_received_at)', 'oldest_center_received_at')
      .addSelect('MAX(o.center_received_at)', 'newest_center_received_at')
      .addSelect(
        'COUNT(*) FILTER (WHERE o.handover_escalated_at IS NOT NULL)::int',
        'escalated_count',
      )
      // Almashtirish qaytarishlari ALOHIDA sanaladi: ular uchun eski
      // mahsulot marketga qaytadi va buxgalteriyada boshqacha yuriladi.
      .addSelect(
        'COUNT(*) FILTER (WHERE o.is_replacement_return = true)::int',
        'replacement_count',
      )
      .addSelect(
        "STRING_AGG(DISTINCT r.name, ', ' ORDER BY r.name)",
        'regions',
      )
      .addSelect('COUNT(DISTINCT o.district_id)::int', 'district_count')
      .groupBy('o.user_id')
      .addGroupBy('m.name')
      .addGroupBy('m.phone_number')
      .addGroupBy('m.cancel_handover_consent_required')
      // Eng keksa posilka oldinda — kim eng uzoq kutayotgani birinchi ko'rinadi.
      .orderBy('MIN(o.center_received_at)', 'ASC');

    if (query.search) {
      qb.andWhere('m.name ILIKE :q', { q: `%${query.search.trim()}%` });
    }

    /**
     * ⚠️ XOM SQL TIPI. `getRawMany()` `any[]` qaytaradi va `bigint`/`numeric`
     * ustunlar SATR bo'lib keladi (pg drayveri). Shuning uchun qator shakli
     * aniq e'lon qilinadi va har son `Number()` bilan o'giriladi — aks holda
     * "450" + 1 = "4501" kabi jim xatolar chiqadi.
     */
    const rows = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<AwaitingMarketRow>();

    const now = Date.now();
    const markets = rows.map((r) => {
      // ⚠️ Xom SQL `bigint`/`numeric` ni SATR qaytaradi — Number() SHART.
      const oldest = Number(r.oldest_center_received_at);
      return {
        market_id: String(r.market_id),
        market_name: r.market_name,
        market_phone: r.market_phone,
        consent_required: Boolean(r.consent_required),
        parcel_count: Number(r.parcel_count),
        total_price: Number(r.total_price),
        oldest_center_received_at: oldest,
        oldest_age_days: Math.floor((now - oldest) / 86_400_000),
        newest_center_received_at: Number(r.newest_center_received_at),
        escalated_count: Number(r.escalated_count),
        regions: r.regions ?? null,
        district_count: Number(r.district_count),
        item_count: Number(r.item_count),
        replacement_count: Number(r.replacement_count),
        /** Shu market uchun topshirish AYNI PAYTDA ochiqmi (pastda to'ldiriladi). */
        active_session: false,
      };
    });

    /**
     * OCHIQ SESSIYA — ikki xodim bir marketni BIR PAYTDA topshirmasligi uchun.
     *
     * ⚠️ NEGA KERAK. Ruxsat 10 daqiqa amal qiladi va shu oynada ikkinchi
     * xodim ayni marketni ochsa, posilkalar ikki manifestga tushib
     * hisobot chalkashardi. Ro'yxatda «topshirilyapti» yorlig'i ko'rinsa
     * ikkinchi xodim kutadi.
     *
     * Bitta so'rov — sahifadagi marketlar uchun (N+1 bo'lmaydi).
     */
    const marketIds = markets.map((m) => m.market_id);
    if (marketIds.length) {
      const open = await this.sessionRepo
        .createQueryBuilder('s')
        .select('DISTINCT s.market_id', 'market_id')
        .where('s.market_id IN (:...ids)', { ids: marketIds })
        .andWhere('s.status = :active', {
          active: MarketHandoverSessionStatus.ACTIVE,
        })
        .andWhere('s.authorization_expires_at > :now', { now })
        .getRawMany<{ market_id: string }>();
      const openSet = new Set(open.map((o) => String(o.market_id)));
      for (const m of markets) m.active_session = openSet.has(m.market_id);
    }

    /**
     * UMUMIY XULOSA — BITTA agregat so'rov.
     *
     * ⚠️ TUZATILGAN NUQSON: `total_parcels` avval `markets.reduce(...)` bilan
     * hisoblanardi, ya'ni FAQAT JORIY SAHIFADAN. Sahifada 50 market bo'lsa va
     * navbatda 80 ta bo'lsa, «Jami posilka» plitkasi kam ko'rsatardi — admin
     * omborda qancha posilka turganini NOTO'G'RI bilardi.
     *
     * ⚠️ Qidiruv filtri ATAYLAB QO'LLANMAYDI: plitkalar «omborda umuman
     * nima turgani» ni ko'rsatadi, qidiruv esa faqat ro'yxatni toraytiradi
     * (`total_markets` ham shu mantiqda ishlagan).
     */
    const totals = await this.orderRepo
      .createQueryBuilder('o')
      .where(awaitingMarketSql('o'))
      .select('COUNT(DISTINCT o.user_id)::int', 'markets')
      .addSelect('COUNT(*)::int', 'parcels')
      .addSelect('COALESCE(SUM(o.total_price), 0)::float8', 'sum_price')
      .addSelect(
        'COUNT(*) FILTER (WHERE o.handover_escalated_at IS NOT NULL)::int',
        'escalated',
      )
      .getRawOne<{
        markets: number | string;
        parcels: number | string;
        sum_price: number | string;
        escalated: number | string;
      }>();

    return successRes(
      {
        markets,
        page,
        limit,
        total_markets: Number(totals?.markets ?? 0),
        total_parcels: Number(totals?.parcels ?? 0),
        total_price: Number(totals?.sum_price ?? 0),
        total_escalated: Number(totals?.escalated ?? 0),
      },
      200,
      'Market kutilmoqda',
    );
  }

  /** Bitta marketning topshirishga tayyor posilkalari (manifest). */
  async listAwaitingOrdersOfMarket(marketId: string, query: AwaitingQueryDto) {
    await this.requireMarket(marketId);
    return this.awaitingOrdersPage(marketId, query, 'Topshirishga tayyor');
  }

  /** MARKET o'z kabinetida ko'radigan ro'yxat (market_id TOKENDAN). */
  async listForMarket(user: JwtPayload, query: AwaitingQueryDto) {
    return this.awaitingOrdersPage(
      String(user.id),
      query,
      'Markazda turgan qaytarishlaringiz',
    );
  }

  private async awaitingOrdersPage(
    marketId: string,
    query: AwaitingQueryDto,
    message: string,
  ) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));

    /**
     * ⚠️ `leftJoinAndSelect` ATAYLAB ISHLATILMAYDI — u `market`/`customer`
     * munosabatlari bilan butun `users` qatorini (parol hash'i, tokenlar)
     * olib kelardi. Shuning uchun `leftJoin` + ANIQ ustunlar: javobda faqat
     * ekranga kerakli maydon bo'ladi.
     *
     * To-many (`items`) ATAYLAB qo'shilmaydi: `skip`/`take` bilan birga u
     * sahifalashni buzadi (DISTINCT subquery) va sekinlashtiradi — dona soni
     * uchun `o.product_quantity` ustuni allaqachon bor.
     */
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.customer', 'customer')
      .leftJoin('o.district', 'district')
      // ⚠️ VILOYAT ham kerak: xodim «Andijon / Asaka» ni bir ko'rishda
      // ajratadi, faqat tuman nomi esa noaniq (bir xil nomli tumanlar bor).
      .leftJoin('district.region', 'region')
      .leftJoin('o.replacementOf', 'replacementOf')
      .addSelect(['customer.id', 'customer.name', 'customer.phone_number'])
      .addSelect(['district.id', 'district.name'])
      .addSelect(['region.id', 'region.name'])
      .addSelect(['replacementOf.id', 'replacementOf.order_number'])
      .where('o.user_id = :marketId', { marketId })
      .andWhere(awaitingMarketSql('o'))
      .orderBy('o.center_received_at', 'ASC');

    if (query.search) {
      const raw = query.search.trim();
      const digits = raw.replace(/[^\d]/g, '');
      const asNumber = Number(raw.replace('#', ''));

      /**
       * ⚠️ SHARTLAR "YOKI" BILAN BIRLASHADI, tarmoqlanmaydi.
       *
       * Avval raqamli kiritma «buyurtma raqami» deb talqin qilinardi va
       * TELEFON bo'yicha qidiruv jimgina 0 natija berardi (telefon
       * bo'lagi ham sof raqam). Market esa posilkani ko'pincha MIJOZ
       * ismi yoki telefonidan eslaydi — yorliq kodini u bilmaydi.
       *
       * Telefon bazada formatlangan (`+998…`), shuning uchun faqat
       * RAQAMLAR bo'yicha solishtiriladi.
       */
      const clauses = [
        'o.qr_code_token ILIKE :tok',
        'customer.name ILIKE :tok',
      ];
      const params: Record<string, unknown> = { tok: `%${raw}%` };

      if (/^#?\d+$/.test(raw) && Number.isFinite(asNumber)) {
        clauses.push('o.order_number = :num');
        params.num = asNumber;
      }
      // 4 raqamdan kam bo'lsa telefon bo'yicha qidiruv butun ro'yxatni
      // qaytarardi — ma'nosiz va sekin.
      if (digits.length >= 4) {
        clauses.push(
          "regexp_replace(customer.phone_number, '[^0-9]', '', 'g') LIKE :phone",
        );
        params.phone = `%${digits}%`;
      }

      qb.andWhere(`(${clauses.join(' OR ')})`, params);
    }

    const [orders, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const now = Date.now();
    return successRes(
      {
        orders: orders.map((o) => ({
          id: o.id,
          order_number: o.order_number,
          qr_code_token: o.qr_code_token,
          total_price: o.total_price,
          status: o.status,
          center_received_at: o.center_received_at,
          age_days: Math.floor(
            (now - Number(o.center_received_at ?? now)) / 86_400_000,
          ),
          escalated: o.handover_escalated_at != null,
          return_stage: CancelReturnStage.AT_CENTER,

          // ─── Topshirish ekranida xodim posilkani TANIY olishi uchun ───
          // (pochta ichidagi buyurtma kartasi bilan bir xil to'plam:
          // mijoz, telefon, tuman, qayerga, sana, dona, izoh.)
          customer_name: o.customer?.name ?? null,
          customer_phone: o.customer?.phone_number ?? null,
          district_name: o.district?.name ?? null,
          region_name: o.district?.region?.name ?? null,
          where_deliver: o.where_deliver,
          created_at: o.created_at,
          product_quantity: o.product_quantity,
          comment: o.comment ?? null,

          // Almashtirish yorlig'i (`ReplacementBadge`) uchun to'plam.
          is_replacement_return: o.is_replacement_return,
          replacement_state: o.replacement_state,
          replacement_of_order_id: o.replacement_of_order_id,
          replacementOf: o.replacementOf
            ? { order_number: o.replacementOf.order_number }
            : null,
        })),
        page,
        limit,
        total,
      },
      200,
      message,
    );
  }

  /** Market sidebar badge'i uchun son + eng keksa posilkaning yoshi. */
  async countsForMarket(user: JwtPayload) {
    const row = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :marketId', { marketId: String(user.id) })
      .andWhere(awaitingMarketSql('o'))
      .select('COUNT(*)::int', 'c')
      .addSelect('MIN(o.center_received_at)', 'oldest')
      .getRawOne<{ c: number; oldest: string | null }>();

    const count = Number(row?.c ?? 0);
    const oldest = row?.oldest == null ? null : Number(row.oldest);
    return successRes(
      {
        awaiting: count,
        oldest_center_received_at: oldest,
        oldest_age_days:
          oldest == null ? 0 : Math.floor((Date.now() - oldest) / 86_400_000),
      },
      200,
      'Soni',
    );
  }

  /**
   * ESKIRISH HISOBOTI — navbat qancha "qarigan" va qanday yopilayotgani.
   *
   * Ikki qismdan iborat:
   *   1) HOZIRGI navbat yosh bucketlari (0-3 / 3-7 / 7-14 / 14+ kun) —
   *      ombor to'lib ketayotganini vaqtida ko'rish uchun;
   *   2) oxirgi 30 kunda posilkalar QANDAY yopilgani (`market_handover_mode`)
   *      — market tasdig'i bilan yopilganlar va CHETLAB O'TILGANLAR
   *      (offline akt / admin override) nisbatini ko'rsatadi.
   *
   * ⚠️ 2-qism nazorat o'lchovi: agar yopishlarning ko'pi `offline_signed`
   * bo'lsa, darvoza amalda ishlamayapti — market hech qachon QR ko'rsatmayapti
   * va xodim har kuni aktga qo'l qo'yib yopyapti.
   *
   * Yosh bucketlari EPOCH-MS chegaralari bilan hisoblanadi (kalendar kun
   * EMAS) — shuning uchun vaqt mintaqasi muammosi yuzaga chiqmaydi.
   */
  async agingReport() {
    const now = Date.now();
    const d3 = now - 3 * 86_400_000;
    const d7 = now - 7 * 86_400_000;
    const d14 = now - 14 * 86_400_000;

    const bucketRows = await this.orderRepo
      .createQueryBuilder('o')
      .where(awaitingMarketSql('o'))
      .select(
        `CASE
           WHEN o.center_received_at >= :d3 THEN '0-3'
           WHEN o.center_received_at >= :d7 THEN '3-7'
           WHEN o.center_received_at >= :d14 THEN '7-14'
           ELSE '14+'
         END`,
        'bucket',
      )
      .addSelect('COUNT(*)::int', 'parcel_count')
      .addSelect('COALESCE(SUM(o.total_price), 0)::float8', 'total_price')
      .addSelect('COUNT(DISTINCT o.user_id)::int', 'market_count')
      .groupBy('bucket')
      .setParameters({ d3, d7, d14 })
      .getRawMany<{
        bucket: string;
        parcel_count: number | string;
        total_price: number | string;
        market_count: number | string;
      }>();

    // Bo'sh bucketlar ham qaytadi — ekranda "0" ko'rinishi "ma'lumot yo'q"
    // dan ANIQROQ (holat yaxshi ekanini bildiradi).
    const order = ['0-3', '3-7', '7-14', '14+'];
    const byBucket = new Map(bucketRows.map((r) => [r.bucket, r]));
    const buckets = order.map((b) => {
      const r = byBucket.get(b);
      return {
        bucket: b,
        parcel_count: Number(r?.parcel_count ?? 0),
        total_price: Number(r?.total_price ?? 0),
        market_count: Number(r?.market_count ?? 0),
      };
    });

    const modeRows = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.market_handover_at >= :since', { since: now - 30 * 86_400_000 })
      .select('o.market_handover_mode', 'mode')
      .addSelect('COUNT(*)::int', 'parcel_count')
      .groupBy('o.market_handover_mode')
      .getRawMany<{ mode: string | null; parcel_count: number | string }>();

    const handedOver30d = modeRows.reduce(
      (sum, r) => sum + Number(r.parcel_count),
      0,
    );
    const marketConsent = modeRows
      .filter((r) => r.mode === MarketHandoverMode.MARKET_WEB)
      .reduce((sum, r) => sum + Number(r.parcel_count), 0);

    return successRes(
      {
        buckets,
        awaiting_total: buckets.reduce((s, b) => s + b.parcel_count, 0),
        handover_modes: modeRows.map((r) => ({
          mode: r.mode ?? 'legacy',
          parcel_count: Number(r.parcel_count),
        })),
        handed_over_30d: handedOver30d,
        /** Market ruxsati bilan yopilganlar ulushi (%) — nazorat o'lchovi. */
        market_consent_rate_30d:
          handedOver30d > 0
            ? Math.round((marketConsent / handedOver30d) * 100)
            : null,
      },
      200,
      'Eskirish hisoboti',
    );
  }

  /** ADMIN: market uchun ruxsat majburiyligini yoqish/o'chirish. */
  async setConsentRequired(
    marketId: string,
    required: boolean,
    user: JwtPayload,
  ) {
    const market = await this.requireMarket(marketId);
    const before = market.cancel_handover_consent_required;
    await this.userRepo.update(
      { id: marketId },
      { cancel_handover_consent_required: required },
    );

    void this.activityLog.log({
      entity_type: 'user',
      entity_id: marketId,
      action: 'handover_consent_flag',
      old_value: { cancel_handover_consent_required: before },
      new_value: { cancel_handover_consent_required: required },
      description: required
        ? `Market «${market.name}» uchun topshirishda market ruxsati MAJBURIY qilindi`
        : `Market «${market.name}» uchun topshirishda market ruxsati majburiyligi o‘chirildi`,
      user,
    });

    return successRes(
      { market_id: marketId, cancel_handover_consent_required: required },
      200,
      'Saqlandi',
    );
  }
}
