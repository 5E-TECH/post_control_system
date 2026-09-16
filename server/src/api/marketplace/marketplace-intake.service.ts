import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import {
  Order_status,
  OrderCreatedSource,
  Post_status,
  Roles,
  Where_deliver,
} from 'src/common/enums';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceScanSessionEntity } from 'src/core/entity/marketplace-scan-session.entity';
import { MarketplaceTariffEntity } from 'src/core/entity/marketplace-tariff.entity';
import { MarketplaceApiService } from './marketplace-api.service';
import { MarketplaceOutboxService } from './marketplace-outbox.service';
import {
  MarketplaceEventType,
  MarketplaceScanSessionStatus,
  MarketplaceScanState,
} from './marketplace.enums';
import { normalizeUzPhone } from './utils/marketplace-payload.util';

export interface AcceptResult {
  batch_id: string;
  accepted: Array<{
    external_parcel_id: string;
    order_id: string;
    order_number: number;
  }>;
  rejected: string[];
  failed: Array<{ external_parcel_id: string; reason: string }>;
  /** Marketplace'ga tasdiq yuborildimi. */
  confirmed_remotely: boolean;
}

/**
 * QABUL SERVISI — «Qabul qilish» tugmasi ortidagi oqim.
 *
 * ⚠️ NEGA `receiveExternalOrders` QAYTA ISHLATILMAYDI. U ataylab YUMSHOQ
 * yozilgan va aynan shu yumshoqlik rejadagi buglar manbai:
 *
 *   · tuman topilmasa `allDistricts[0]` ga tushiradi (§15 #7);
 *   · telefon yo'q bo'lsa `unknown_<ts>` soxta mijoz yaratadi;
 *   · narx 0 bo'lsa buyurtma yaratadi, sotuvda esa kassadan tarif yechiladi (§15 #8);
 *   · bitta buzuq qator BUTUN partiyani rollback qiladi (§15 #4);
 *   · `where_deliver` ni ULARNING so'zidan emas, market sozlamasidan oladi (B9);
 *   · dublikat oynasi faqat `WAITING`/`ON_THE_ROAD` ni ko'radi (B2).
 *
 * Bu servis qat'iy: bloker bo'lsa posilka O'TKAZILMAYDI, har posilka
 * o'z SAVEPOINT'ida yaratiladi va tarif QABUL PAYTIDA muzlatiladi.
 *
 * ⚠️ `order_item` YARATILMAYDI. `order_item.productId` bizning katalogga
 * FK, marketplace SKU'lari esa unda yo'q. Har SKU uchun soxta mahsulot
 * ochish katalogni buzardi. Mahsulot ro'yxati `marketplace_parcel.raw_payload`
 * da saqlanadi — qisman sotuv hodisasi (4-bosqich) o'shandan quriladi.
 */
@Injectable()
export class MarketplaceIntakeService {
  private readonly logger = new Logger(MarketplaceIntakeService.name);

  constructor(
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    @InjectRepository(MarketplaceParcelEntity)
    private readonly parcelRepo: Repository<MarketplaceParcelEntity>,
    @InjectRepository(MarketplaceScanSessionEntity)
    private readonly sessionRepo: Repository<MarketplaceScanSessionEntity>,
    @InjectRepository(MarketplaceTariffEntity)
    private readonly tariffRepo: Repository<MarketplaceTariffEntity>,
    private readonly dataSource: DataSource,
    private readonly api: MarketplaceApiService,
    private readonly outbox: MarketplaceOutboxService,
  ) {}

  /** Amaldagi tarif versiyasi (`effective_to IS NULL`). */
  async getActiveTariff(integrationId: string): Promise<MarketplaceTariffEntity> {
    const t = await this.tariffRepo.findOne({
      where: { integration_id: integrationId, effective_to: IsNull() },
    });
    if (!t) {
      // ⚠️ Tarifsiz qabul qilish — keyin sotuvda market kassasiga NOTO'G'RI
      // summa yozilishi demak. Ochiq xato yaxshiroq.
      throw new BadRequestException(
        "Marketplace tarifi sozlanmagan. Avval tarifni kiriting (markaz/uy).",
      );
    }
    return t;
  }

  async accept(
    slug: string,
    input: { session_id: string; idempotency_key: string },
    user: JwtPayload,
  ): Promise<AcceptResult> {
    const integration = await this.integrationRepo.findOne({ where: { slug } });
    if (!integration) throw new NotFoundException(`Ulanish topilmadi: ${slug}`);

    const session = await this.sessionRepo.findOne({
      where: { id: input.session_id },
    });
    if (!session) throw new NotFoundException('Skan sessiyasi topilmadi');
    if (session.operator_id !== user.id) {
      throw new ConflictException('Bu sessiya boshqa operatorga tegishli');
    }

    // ── IDEMPOTENTLIK ────────────────────────────────────────────────
    // ⚠️ §15 #3: qabul timeout bo'lib operator qayta bossa, bugungi kodda
    // BUTUN QOP IKKI MARTA yaratiladi va sotuvda pul ikki marta yoziladi.
    if (session.status === MarketplaceScanSessionStatus.ACCEPTED) {
      if (session.accept_idempotency_key === input.idempotency_key) {
        return this.rebuildResult(session);
      }
      throw new ConflictException(
        'Bu sessiya allaqachon qabul qilingan (boshqa kalit bilan).',
      );
    }
    if (session.status !== MarketplaceScanSessionStatus.OPEN) {
      throw new ConflictException('Sessiya yopilgan');
    }

    const tariff = await this.getActiveTariff(integration.id);

    const parcels = await this.parcelRepo.find({
      where: {
        scan_session_id: session.id,
        scan_state: MarketplaceScanState.SCANNED,
      },
      order: { scanned_at: 'ASC' },
    });
    if (parcels.length === 0) {
      throw new BadRequestException("Sessiyada qabul qilinadigan posilka yo'q");
    }

    // ── KO'P QUTILI BUYURTMA TO'LIQLIGI (qaror O1) ───────────────────
    // Bitta buyurtmaning 3 qutisidan 2 tasi skanerlangan bo'lsa, uchinchisi
    // yo'qolgan yoki hali skanerlanmagan. Yarim buyurtmani qabul qilish —
    // mijozga chala posilka yuborish demak.
    const incomplete = this.findIncompleteOrders(parcels);

    const batchId = randomUUID();
    const accepted: AcceptResult['accepted'] = [];
    const failed: AcceptResult['failed'] = [];

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      for (const [i, parcel] of parcels.entries()) {
        const bad = incomplete.get(parcel.external_order_id);
        if (bad) {
          failed.push({ external_parcel_id: parcel.external_parcel_id, reason: bad });
          continue;
        }

        // ⚠️ HAR POSILKA O'Z SAVEPOINT'ida. Bitta buzuq qator 29 ta
        // yaxshisini yiqitmasligi kerak (§15 #4).
        const sp = `mp_sp_${i}`;
        await qr.query(`SAVEPOINT ${sp}`);
        try {
          const created = await this.createOrderForParcel(
            qr.manager,
            integration,
            tariff,
            parcel,
            batchId,
          );
          await qr.query(`RELEASE SAVEPOINT ${sp}`);
          accepted.push(created);
        } catch (e) {
          await qr.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          const reason = e instanceof Error ? e.message : 'nomalum xato';
          failed.push({ external_parcel_id: parcel.external_parcel_id, reason });
          this.logger.warn(
            `⚠️ qabul qilinmadi ${parcel.external_parcel_id}: ${reason}`,
          );
        }
      }

      session.status = MarketplaceScanSessionStatus.ACCEPTED;
      session.accept_idempotency_key = input.idempotency_key;
      session.accepted_count = accepted.length;
      session.accepted_at = Date.now();
      await qr.manager.save(MarketplaceScanSessionEntity, session);

      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }

    // ── MARKETPLACE'GA TASDIQ ────────────────────────────────────────
    // ⚠️ IKKI KANAL, ATAYLAB.
    //   · Bu yerdagi to'plamli chaqiruv — TEZ YO'L: operator «qabul qilindi»
    //     javobini darhol ko'radi va ularning tizimida ham darhol o'zgaradi.
    //   · Yuqorida tranzaksiya ichida yozilgan `parcel.accepted` hodisalari —
    //     KAFOLATLANGAN YO'L: bu chaqiruv yiqilsa ham ular outbox orqali
    //     yetib boradi va `seq` tartibini boshlab beradi.
    //
    // Ikkalasi ham idempotent (`batch_id` va `event_id`), shuning uchun
    // ikkisi ham yetib borishi NORMAL va xavfsiz. Tez yo'l yiqilsa lokal
    // qabul BEKOR QILINMAYDI — posilka jismonan bizda.
    let confirmed = false;
    if (accepted.length > 0) {
      try {
        await this.api.confirmAccept(integration, {
          batch_id: batchId,
          accepted_at: Date.now(),
          items: accepted.map((a) => ({
            external_parcel_id: a.external_parcel_id,
            beepost_order_id: a.order_id,
            beepost_order_number: a.order_number,
          })),
        });
        confirmed = true;
      } catch (e) {
        this.logger.error(
          `❌ qabul tasdig'i yuborilmadi (batch ${batchId}): ` +
            `${e instanceof Error ? e.message : e}. Solishtiruv CRON tiklaydi.`,
        );
      }
    }

    this.logger.log(
      `✅ qabul: ${accepted.length} ta, xato ${failed.length} ta, batch ${batchId}`,
    );

    return { batch_id: batchId, accepted, rejected: [], failed, confirmed_remotely: confirmed };
  }

  // ═══════════════════ ICHKI ═══════════════════

  /** Qaysi buyurtmalarning qutilari to'liq skanerlanmagan. */
  private findIncompleteOrders(
    parcels: MarketplaceParcelEntity[],
  ): Map<string, string> {
    const byOrder = new Map<string, MarketplaceParcelEntity[]>();
    for (const p of parcels) {
      const list = byOrder.get(p.external_order_id) ?? [];
      list.push(p);
      byOrder.set(p.external_order_id, list);
    }

    const bad = new Map<string, string>();
    for (const [orderId, list] of byOrder) {
      const expected = Math.max(...list.map((p) => p.parcel_count));
      if (expected > 1 && list.length < expected) {
        const have = list.map((p) => p.parcel_index).sort((a, b) => a - b);
        bad.set(
          orderId,
          `Ko'p qutili buyurtma to'liq emas: ${list.length}/${expected} ` +
            `(skanerlangan: ${have.join(', ')}). Qolgan qutilarni ham skanerlang.`,
        );
      }
    }
    return bad;
  }

  private async createOrderForParcel(
    manager: import('typeorm').EntityManager,
    integration: MarketplaceIntegrationEntity,
    tariff: MarketplaceTariffEntity,
    parcel: MarketplaceParcelEntity,
    batchId: string,
  ) {
    const raw = (parcel.raw_payload ?? {}) as Record<string, any>;
    const cust = (raw.customer ?? {}) as Record<string, any>;

    // ── Qat'iy tekshiruvlar (jimgina zaxira YO'Q) ──
    const phone = normalizeUzPhone(cust.phone);
    if (!phone) throw new Error('Mijoz telefoni yaroqsiz');

    const districtSato = String(cust.district_sato ?? '').trim();
    const district = await manager.findOne(DistrictEntity, {
      where: { sato_code: districtSato },
    });
    if (!district) throw new Error(`Tuman topilmadi (SOATO ${districtSato})`);

    if (!parcel.prepaid && parcel.cod_amount <= 0) {
      throw new Error('COD summasi 0, lekin prepaid emas');
    }

    // ── Yetkazish turi ULARNING payload'idan (bloker B9) ──
    // ⚠️ `receiveExternalOrders` buni `market.default_tariff` dan oladi va
    // ularning so'zini O'QIMAYDI — har «uyga» posilkada 20 000 farq.
    const whereDeliver =
      String(raw.where_deliver ?? 'center') === 'address'
        ? Where_deliver.ADDRESS
        : Where_deliver.CENTER;

    // ── TARIFNI MUZLATISH (blokerlar B7 + B8) ──
    // ⚠️ `sellOrder` tarifni SOTUV paytida jonli o'qiydi. Shu qatorni
    // to'ldirib qo'ysak, u `order.market_tariff` ni ustun ko'radi va
    // yo'ldagi posilka tarif o'zgarishidan ta'sirlanmaydi.
    const marketTariff =
      whereDeliver === Where_deliver.CENTER ? tariff.tariff_center : tariff.tariff_home;

    // ── Mijoz ──
    let customer = await manager.findOne(UserEntity, {
      where: { phone_number: phone, role: Roles.CUSTOMER },
    });
    if (!customer) {
      customer = await manager.save(
        manager.create(UserEntity, {
          name: String(cust.full_name ?? 'Marketplace mijozi'),
          phone_number: phone,
          role: Roles.CUSTOMER,
          district_id: district.id,
          address: String(cust.address ?? ''),
          extra_number: normalizeUzPhone(cust.additional_phone) ?? undefined,
        }),
      );
    }

    // ── Pochta (reys) ──
    const regionId = district.assigned_region || district.region_id;
    let post = await manager.findOne(PostEntity, {
      where: { region_id: regionId, status: Post_status.NEW },
    });
    if (!post) {
      post = await manager.save(
        manager.create(PostEntity, {
          region_id: regionId,
          qr_code_token: generateCustomToken(),
          post_total_price: 0,
          order_quantity: 0,
          status: Post_status.NEW,
        }),
      );
    }

    // ── Buyurtma ──
    // Pul FAQAT birinchi qutida (qaror O1) — qolganlari 0.
    const isMoneyParcel = parcel.parcel_index === 1;
    const totalPrice = isMoneyParcel
      ? parcel.declared_product_amount + parcel.declared_delivery_amount
      : 0;

    const comment = [
      parcel.parcel_count > 1
        ? `Quti ${parcel.parcel_index}/${parcel.parcel_count}`
        : null,
      cust.comment ? String(cust.comment) : null,
      cust.additional_phone ? `Qo'shimcha tel: ${cust.additional_phone}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const order = await manager.save(
      manager.create(OrderEntity, {
        user_id: integration.market_id,
        customer_id: customer.id,
        district_id: district.id,
        post_id: post.id,
        total_price: totalPrice,
        where_deliver: whereDeliver,
        status: Order_status.RECEIVED,
        // ⚠️ NORMALIZATSIYALANGAN token — barcha PCS skanerlari shuni qidiradi.
        qr_code_token: parcel.qr_token_norm,
        comment,
        address: String(cust.address ?? customer.address ?? ''),
        operator: `marketplace_${integration.slug}`,
        external_id: parcel.external_parcel_id,
        product_quantity: Math.max(1, (raw.items ?? []).length || 1),
        // Marketplace ustunlari
        integration_id: integration.id,
        external_seller_id: parcel.seller_id,
        created_source: OrderCreatedSource.MARKETPLACE,
        market_tariff: marketTariff,
      }),
    );

    // ── Pochta statistikasi ──
    post.post_total_price = Number(post.post_total_price ?? 0) + totalPrice;
    post.order_quantity = Number(post.order_quantity ?? 0) + 1;
    await manager.save(post);

    // ── Posilkani bog'lash ──
    parcel.order_id = order.id;
    parcel.scan_state = MarketplaceScanState.ACCEPTED;
    parcel.accepted_at = Date.now();
    parcel.accept_batch_id = batchId;
    await manager.save(MarketplaceParcelEntity, parcel);

    // ── OUTBOX: qabul hodisasi AYNI TRANZAKSIYADA ──────────────────────
    // ⚠️ Bu 3-bosqichning asosiy qoidasi: hodisa PUL/HOLAT bilan bitta
    // tranzaksiyada yoziladi. Commit'dan keyin yozilsa, deploy yoki crash
    // aynan o'sha lahzada bo'lganda hodisa umuman tug'ilmasdi (bloker B3).
    await this.outbox.enqueueParcelEvent(manager, {
      integration,
      parcel,
      event_type: MarketplaceEventType.PARCEL_ACCEPTED,
      status: { from: parcel.remote_status ?? null, to: 'ACCEPTED_BY_BEEPOST' },
      order: { id: order.id, order_number: Number(order.order_number) },
      money: {
        currency: 'UZS',
        product_amount: parcel.declared_product_amount,
        delivery_amount: parcel.declared_delivery_amount,
        beepost_fee: marketTariff,
        beepost_fee_basis: whereDeliver === Where_deliver.CENTER ? 'center' : 'home',
        tariff_version: tariff.version,
        prepaid: parcel.prepaid,
      },
      actor: { type: 'operator' },
    });

    return {
      external_parcel_id: parcel.external_parcel_id,
      order_id: order.id,
      order_number: Number(order.order_number),
    };
  }

  /** Idempotent takroriy so'rovda ayni natijani qayta quradi. */
  private async rebuildResult(
    session: MarketplaceScanSessionEntity,
  ): Promise<AcceptResult> {
    const parcels = await this.parcelRepo.find({
      where: { scan_session_id: session.id },
      relations: { order: true },
    });
    const accepted = parcels
      .filter((p) => p.scan_state === MarketplaceScanState.ACCEPTED && p.order)
      .map((p) => ({
        external_parcel_id: p.external_parcel_id,
        order_id: p.order_id as string,
        order_number: Number(p.order?.order_number ?? 0),
      }));
    return {
      batch_id: parcels.find((p) => p.accept_batch_id)?.accept_batch_id ?? '',
      accepted,
      rejected: parcels
        .filter((p) => p.scan_state === MarketplaceScanState.REJECTED)
        .map((p) => p.external_parcel_id),
      failed: [],
      confirmed_remotely: true,
    };
  }
}
