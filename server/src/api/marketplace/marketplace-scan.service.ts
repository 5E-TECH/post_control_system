import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceScanSessionEntity } from 'src/core/entity/marketplace-scan-session.entity';
import { MarketplaceSellerEntity } from 'src/core/entity/marketplace-seller.entity';
import { MarketplaceApiService } from './marketplace-api.service';
import {
  MarketplaceParcelStatus,
  MarketplaceRejectReason,
  MarketplaceScanSessionStatus,
  MarketplaceScanState,
} from './marketplace.enums';
import { checkMarketplaceToken } from './utils/marketplace-token.util';
import { parseLookupPayload } from './utils/marketplace-payload.util';
import { MarketplaceErrorInfo } from './utils/marketplace-error.util';

/** Ularda bu statusda bo'lgan posilkani QABUL QILMAYMIZ. */
const REFUSED_REMOTE_STATUSES = new Set<string>([
  MarketplaceParcelStatus.VOIDED,
  MarketplaceParcelStatus.CANCELLED,
  MarketplaceParcelStatus.RETURNED,
  MarketplaceParcelStatus.DELIVERED,
  MarketplaceParcelStatus.ACCEPTED_BY_BEEPOST,
  MarketplaceParcelStatus.REJECTED_BY_BEEPOST,
]);

export interface ScanOutcome {
  parcel_id: string;
  external_parcel_id: string;
  external_order_id: string;
  qr_token: string;
  seller_id: string | null;
  seller_name: string | null;
  customer_name: string;
  phone: string;
  district_name: string | null;
  address: string | null;
  cod_amount: number;
  prepaid: boolean;
  parcel_index: number;
  parcel_count: number;
  where_deliver: 'center' | 'address';
  /** Qabul qilishni to'sadigan muammolar — bo'sh bo'lsa posilka tayyor. */
  blockers: string[];
  warnings: string[];
  /** Ayni posilka avval ham shu sessiyada skanerlangan (takroriy skan). */
  duplicate_in_session: boolean;
}

/**
 * SKAN SERVISI — operator qopni skanerlaydigan oqim, SERVER tomonda.
 *
 * Bugungi tashqi-sayt oqimidan tubdan farq qiladi:
 *
 *   · skan natijasi BAZAGA yoziladi (brauzer state'ida emas) — sahifa
 *     yangilansa yoki brauzer qulasa qop yo'qolmaydi;
 *   · har qanday HTTP xatosi «topilmadi» deb ko'rsatilmaydi — tasniflanadi;
 *   · marketplace o'lganda «baribir qo'sh» TAKLIF QILINMAYDI;
 *   · tuman topilmasa jimgina birinchi tumanga tushirilmaydi — bloker;
 *   · ikki operator bir posilkani skanerlasa ikkinchisi 409 oladi.
 */
@Injectable()
export class MarketplaceScanService {
  private readonly logger = new Logger(MarketplaceScanService.name);

  constructor(
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    @InjectRepository(MarketplaceParcelEntity)
    private readonly parcelRepo: Repository<MarketplaceParcelEntity>,
    @InjectRepository(MarketplaceScanSessionEntity)
    private readonly sessionRepo: Repository<MarketplaceScanSessionEntity>,
    @InjectRepository(MarketplaceSellerEntity)
    private readonly sellerRepo: Repository<MarketplaceSellerEntity>,
    @InjectRepository(DistrictEntity)
    private readonly districtRepo: Repository<DistrictEntity>,
    private readonly api: MarketplaceApiService,
  ) {}

  // ═══════════════════ INTEGRATSIYA ═══════════════════

  async resolveIntegration(slug: string): Promise<MarketplaceIntegrationEntity> {
    const integration = await this.integrationRepo.findOne({ where: { slug } });
    if (!integration) {
      throw new NotFoundException(`Marketplace ulanishi topilmadi: ${slug}`);
    }
    if (!integration.is_active) {
      throw new ServiceUnavailableException(
        `«${integration.name}» ulanishi o'chirilgan. Sozlamadan yoqing.`,
      );
    }
    return integration;
  }

  // ═══════════════════ SESSIYA ═══════════════════

  /**
   * Operator uchun ochiq sessiya topadi yoki yangisini ochadi.
   *
   * ⚠️ Bitta operator uchun bir vaqtda BITTA ochiq sessiya. Aks holda
   * operator ikki tabda ishlab, posilkalarni ikki qopga bo'lib yuborardi.
   */
  async openSession(
    slug: string,
    user: JwtPayload,
  ): Promise<MarketplaceScanSessionEntity> {
    const integration = await this.resolveIntegration(slug);

    const existing = await this.sessionRepo.findOne({
      where: {
        integration_id: integration.id,
        operator_id: user.id,
        status: MarketplaceScanSessionStatus.OPEN,
      },
      order: { created_at: 'DESC' },
    });
    if (existing) return existing;

    return this.sessionRepo.save(
      this.sessionRepo.create({
        integration_id: integration.id,
        operator_id: user.id,
        status: MarketplaceScanSessionStatus.OPEN,
      }),
    );
  }

  async getSession(sessionId: string, user: JwtPayload) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Skan sessiyasi topilmadi');
    if (session.operator_id !== user.id) {
      // Boshqa operatorning sessiyasini ko'rish/o'zgartirish mumkin emas.
      throw new ConflictException('Bu sessiya boshqa operatorga tegishli');
    }
    const parcels = await this.parcelRepo.find({
      where: { scan_session_id: sessionId },
      order: { scanned_at: 'ASC' },
    });
    return { session, parcels };
  }

  // ═══════════════════ SKAN ═══════════════════

  async scan(
    slug: string,
    input: { session_id: string; qr_token: string },
    user: JwtPayload,
  ): Promise<ScanOutcome> {
    const integration = await this.resolveIntegration(slug);

    // ── 1. Navbat to'xtatilganmi ──────────────────────────────────────
    // Marketplace o'lganda operator 60 ta posilkani ketma-ket urinib
    // 60 ta xato ko'rishi shart emas (§15 #1).
    if (this.api.isPaused(slug)) {
      throw new ServiceUnavailableException(
        `Marketplace bilan aloqa uzilgan — skanerlash TO'XTATILDI. ` +
          `Bir daqiqadan keyin qayta urining yoki sozlamani tekshiring.`,
      );
    }

    const session = await this.sessionRepo.findOne({
      where: { id: input.session_id },
    });
    if (!session) throw new NotFoundException('Skan sessiyasi topilmadi');
    if (session.operator_id !== user.id) {
      throw new ConflictException('Bu sessiya boshqa operatorga tegishli');
    }
    if (session.status !== MarketplaceScanSessionStatus.OPEN) {
      throw new ConflictException(
        'Bu sessiya yopilgan — yangi sessiya oching',
      );
    }

    // ── 2. Token shakli ────────────────────────────────────────────────
    // Axlat skan ularning API'siga behuda so'rov yubormasin.
    const token = checkMarketplaceToken(input.qr_token);
    if (!token.valid) {
      throw new BadRequestException(token.reason ?? "QR kod yaroqsiz");
    }

    // ── 3. LOKAL tekshiruv — tashqi so'rovdan OLDIN ────────────────────
    const existing = await this.parcelRepo.findOne({
      where: { integration_id: integration.id, qr_token_norm: token.norm },
    });

    if (existing) {
      if (existing.scan_state === MarketplaceScanState.ACCEPTED) {
        throw new ConflictException(
          `Bu posilka allaqachon qabul qilingan (${existing.external_parcel_id}).`,
        );
      }
      if (
        existing.scan_state === MarketplaceScanState.SCANNED &&
        existing.scan_session_id &&
        existing.scan_session_id !== session.id
      ) {
        // ⚠️ Bugungi oqimda ikki operator bir posilkani skanerlasa
        // IKKALASI HAM muvaffaqiyatli bo'lardi (§15 #11).
        throw new ConflictException(
          `Bu posilkani boshqa operator allaqachon skanerlagan. ` +
            `U bilan bog'laning yoki uning sessiyasidan olib tashlang.`,
        );
      }
      if (
        existing.scan_state === MarketplaceScanState.SCANNED &&
        existing.scan_session_id === session.id
      ) {
        // Takroriy skan — xato emas, shunchaki mavjudini qaytaramiz.
        return this.toOutcome(existing, [], [], true);
      }
    }

    // ── 4. TASHQI SO'ROV ───────────────────────────────────────────────
    let payload: unknown;
    try {
      payload = await this.api.lookupParcel(integration, token.raw, user.id);
    } catch (err) {
      const info = (err as { marketplaceError?: MarketplaceErrorInfo })
        .marketplaceError;
      if (!info) throw err;

      // ⚠️ ENG MUHIM FARQ: har tur uchun ALOHIDA xabar va faqat haqiqiy
      // 404 da «qo'lda qo'shish» haqida gap boradi.
      if (info.kind === 'not_found') {
        throw new NotFoundException(
          `Bu posilka marketplace tizimida topilmadi (${token.raw}).`,
        );
      }
      throw new ServiceUnavailableException(info.message);
    }

    // ── 5. Javobni tekshirish ──────────────────────────────────────────
    const parsed = parseLookupPayload(payload);
    const blockers = [...parsed.blockers];
    const warnings = [...parsed.warnings];

    if (!parsed.parcel) {
      // Ma'lumot yetishmayapti — posilkani yozib qo'yib bo'lmaydi, chunki
      // identifikatorlari ham noaniq.
      throw new BadRequestException(
        `Marketplace javobi to'liq emas: ${blockers.join('; ')}`,
      );
    }
    const p = parsed.parcel;

    // ── 6. ULARNING statusi ────────────────────────────────────────────
    if (p.remote_status && REFUSED_REMOTE_STATUSES.has(p.remote_status)) {
      // §15 #9: bugun ular bekor qilgan posilka jimgina qabul qilinardi.
      throw new ConflictException(
        `Marketplace tomonida bu posilka holati «${p.remote_status}» — qabul qilib bo'lmaydi.`,
      );
    }

    // ── 7. Tuman ───────────────────────────────────────────────────────
    // ⚠️ JIMGINA ZAXIRA YO'Q. Bugun topilmasa `allDistricts[0]` ga
    // tushiriladi va posilka boshqa viloyatga ketadi (§15 #7).
    const district = await this.districtRepo.findOne({
      where: { sato_code: p.district_sato },
    });
    if (!district) {
      blockers.push(
        `Tuman topilmadi (SOATO ${p.district_sato}) — bu hududga yetkazib bo'lmaydi`,
      );
    }

    // ── 8. Sotuvchi ────────────────────────────────────────────────────
    let sellerName = p.seller_name;
    if (p.seller_id) {
      const known = await this.sellerRepo.findOne({
        where: { integration_id: integration.id, external_seller_id: p.seller_id },
      });
      if (!known) {
        // Reestrda yo'q — posilka baribir qabul qilinadi, lekin belgilanadi.
        warnings.push(`Sotuvchi reestrda yo'q: ${p.seller_id}`);
        await this.sellerRepo
          .save(
            this.sellerRepo.create({
              integration_id: integration.id,
              external_seller_id: p.seller_id,
              name: p.seller_name,
              is_unknown: true,
            }),
          )
          .catch(() => undefined); // poygada ikkinchi INSERT — muhim emas
      } else {
        sellerName = known.name ?? p.seller_name;
        if (!known.is_active) warnings.push(`Sotuvchi faol emas: ${p.seller_id}`);
      }
    }

    // ── 9. Yozish ──────────────────────────────────────────────────────
    const row = existing ?? this.parcelRepo.create();
    Object.assign(row, {
      integration_id: integration.id,
      external_parcel_id: p.external_parcel_id,
      external_order_id: p.external_order_id,
      parcel_index: p.parcel_index,
      parcel_count: p.parcel_count,
      qr_token_raw: p.qr_token_raw,
      qr_token_norm: p.qr_token_norm,
      seller_id: p.seller_id,
      raw_payload: payload as Record<string, unknown>,
      declared_product_amount: p.product_amount,
      declared_delivery_amount: p.delivery_amount,
      cod_amount: p.cod_amount,
      prepaid: p.prepaid,
      scan_state: MarketplaceScanState.SCANNED,
      scan_session_id: session.id,
      scanned_by: user.id,
      scanned_at: Date.now(),
      reject_reason: null,
      reject_note: null,
      remote_status: p.remote_status,
      remote_status_at: Date.now(),
    });

    let saved: MarketplaceParcelEntity;
    try {
      saved = await this.parcelRepo.save(row);
    } catch (e) {
      // UQ_MP_PARCEL_EXTERNAL / UQ_MP_PARCEL_TOKEN — ayni posilka boshqa
      // token bilan yoki teskarisi. DB darajasidagi qo'riqchi ishladi.
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException(
          `Bu posilka allaqachon ro'yxatda (${p.external_parcel_id}).`,
        );
      }
      throw e;
    }

    // ── 10. Sessiya hisoblagichi ───────────────────────────────────────
    if (!existing) {
      await this.sessionRepo.increment({ id: session.id }, 'scanned_count', 1);
    }

    this.logger.log(
      `📦 skan: ${p.external_parcel_id} (${p.parcel_index}/${p.parcel_count}) ` +
        `sotuvchi=${p.seller_id ?? '—'} blokerlar=${blockers.length}`,
    );

    return this.toOutcome(saved, blockers, warnings, false, district?.name ?? null);
  }

  // ═══════════════════ OXIRGISINI QAYTARISH ═══════════════════

  /**
   * Xato skanni sessiyadan olib tashlash.
   *
   * ⚠️ Faqat QABUL QILINMAGAN posilka. Qabul qilingandan keyin buyurtma
   * yaratilgan va pochtaga biriktirilgan bo'ladi — u yerda «qaytarish»
   * butunlay boshqa amal.
   */
  async undoLastScan(sessionId: string, user: JwtPayload) {
    const { session } = await this.getSession(sessionId, user);
    if (session.status !== MarketplaceScanSessionStatus.OPEN) {
      throw new ConflictException('Sessiya yopilgan');
    }

    const last = await this.parcelRepo.findOne({
      where: {
        scan_session_id: sessionId,
        scan_state: In([MarketplaceScanState.SCANNED, MarketplaceScanState.REJECTED]),
      },
      order: { scanned_at: 'DESC' },
    });
    if (!last) throw new NotFoundException('Qaytariladigan skan yo\'q');

    await this.parcelRepo.remove(last);
    await this.sessionRepo.decrement({ id: sessionId }, 'scanned_count', 1);
    return { removed: last.external_parcel_id };
  }

  // ═══════════════════ RAD ETISH ═══════════════════

  /**
   * Operator posilkani rad etadi (buzilgan, bizniki emas, hududimiz emas).
   *
   * ⚠️ Bugungi oqimda bunday tushuncha YO'Q — operator shunchaki
   * skanerlamaydi va marketplace hech qachon bilmaydi.
   */
  async rejectParcel(
    sessionId: string,
    parcelId: string,
    reason: MarketplaceRejectReason,
    note: string | null,
    user: JwtPayload,
  ) {
    const { session } = await this.getSession(sessionId, user);
    if (session.status !== MarketplaceScanSessionStatus.OPEN) {
      throw new ConflictException('Sessiya yopilgan');
    }

    const parcel = await this.parcelRepo.findOne({
      where: { id: parcelId, scan_session_id: sessionId },
    });
    if (!parcel) throw new NotFoundException('Posilka bu sessiyada topilmadi');
    if (parcel.scan_state === MarketplaceScanState.ACCEPTED) {
      throw new ConflictException('Qabul qilingan posilkani rad etib bo\'lmaydi');
    }

    parcel.scan_state = MarketplaceScanState.REJECTED;
    parcel.reject_reason = reason;
    parcel.reject_note = note;
    await this.parcelRepo.save(parcel);
    await this.sessionRepo.increment({ id: sessionId }, 'rejected_count', 1);

    return { external_parcel_id: parcel.external_parcel_id, reason };
  }

  // ═══════════════════ YORDAMCHI ═══════════════════

  private toOutcome(
    row: MarketplaceParcelEntity,
    blockers: string[],
    warnings: string[],
    duplicateInSession: boolean,
    districtName: string | null = null,
  ): ScanOutcome {
    const raw = (row.raw_payload ?? {}) as Record<string, any>;
    const cust = (raw.customer ?? {}) as Record<string, any>;
    return {
      parcel_id: row.id,
      external_parcel_id: row.external_parcel_id,
      external_order_id: row.external_order_id,
      qr_token: row.qr_token_raw,
      seller_id: row.seller_id,
      seller_name: (raw.seller ?? {}).seller_name ?? null,
      customer_name: String(cust.full_name ?? 'Marketplace mijozi'),
      phone: String(cust.phone ?? ''),
      district_name: districtName,
      address: cust.address ? String(cust.address) : null,
      cod_amount: row.cod_amount,
      prepaid: row.prepaid,
      parcel_index: row.parcel_index,
      parcel_count: row.parcel_count,
      where_deliver:
        String(raw.where_deliver ?? 'center') === 'address' ? 'address' : 'center',
      blockers,
      warnings,
      duplicate_in_session: duplicateInSession,
    };
  }
}
