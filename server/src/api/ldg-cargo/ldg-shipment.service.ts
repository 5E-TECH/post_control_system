import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LdgShipmentEntity } from 'src/core/entity/ldg-shipment.entity';
import { LdgConfigEntity } from 'src/core/entity/ldg-config.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { LdgApiService } from './ldg-api.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Status } from 'src/common/enums';
import {
  LdgCreateOrderRequestDto,
  LdgCreateOrderResponseDto,
} from './dto/ldg-create-order.dto';
import { LDG_FINAL_ORDER_STATUSES } from './utils/ldg-status.guard';

// Yakunlangan (terminal) order statuslari — bularni LDG'ga JO'NATMAYMIZ.
// Faqat faol (NEW/RECEIVED/ON_THE_ROAD/WAITING) buyurtmalar LDG'ga ketadi:
// yakunlangan buyurtma LDG'da qayta yaratilsa, LDG o'z statusini qaytarib
// bizning yakuniy status bilan keraksiz "mismatch" chiqaradi.
// Yagona manba — utils/ldg-status.guard.ts (webhook/reconcile tomoni ham shundan
// foydalanadi, shunda "LDG tegmaydigan statuslar" ta'rifi ikkiga bo'linmaydi).
const LDG_SKIP_ORDER_STATUSES = LDG_FINAL_ORDER_STATUSES;

@Injectable()
export class LdgShipmentService {
  private readonly logger = new Logger(LdgShipmentService.name);

  constructor(
    @InjectRepository(LdgShipmentEntity)
    private readonly shipmentRepo: Repository<LdgShipmentEntity>,
    @InjectRepository(LdgConfigEntity)
    private readonly configRepo: Repository<LdgConfigEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(DistrictEntity)
    private readonly districtRepo: Repository<DistrictEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly api: LdgApiService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Order uchun LDG ga shipment yaratadi (POST /orders).
   * Shu vaqtda LdgShipmentEntity ham yaratiladi/yangilanadi.
   *
   * Idempotentlik post bo'yicha: agar shipment allaqachon shu POST uchun
   * muvaffaqiyatli yuborilgan bo'lsa (ldg_order_id bor va post_id bir xil),
   * qayta yuborilmaydi. Lekin buyurtma qaytarilib YANGI post bilan qayta
   * jo'natilsa (post_id farq qiladi), bu yangi urinish — LDG'ga qaytadan
   * dispatch qilamiz (yangi idempotency-key bilan).
   */
  async createShipmentForOrder(
    orderId: string,
    actor?: JwtPayload,
  ): Promise<LdgShipmentEntity> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer', 'district'],
    });
    if (!order) {
      throw new NotFoundException(`Order topilmadi: ${orderId}`);
    }

    let shipment = await this.shipmentRepo.findOne({
      where: { order_id: orderId },
    });

    // Bir xil post uchun allaqachon yuborilgan bo'lsa — idempotent (qaytaramiz).
    // (post_id null bo'lgan eski yozuvlar uchun ham eski xatti-harakat saqlanadi.)
    if (
      shipment?.ldg_order_id &&
      shipment.post_id &&
      order.post_id &&
      shipment.post_id === order.post_id
    ) {
      return shipment;
    }
    // Eski yozuv (post_id yo'q) bo'lsa-yu, lekin order ham post_id'siz bo'lsa —
    // avvalgi idempotent xatti-harakat (takror dispatch'ni bloklash).
    if (shipment?.ldg_order_id && !shipment.post_id && !order.post_id) {
      return shipment;
    }

    // ===== KILL SWITCH — LDG'ga jo'natishning YAGONA to'sig'i =====
    // Bu tekshiruv barcha dispatch yo'llari uchun amal qiladi (pochta jo'natish,
    // admin qo'lda qayta jo'natish, auto-retry cron) — chunki hammasi shu metodga
    // keladi. Off/blok bo'lsa shipment yozuvi ham YARATILMAYDI (toza "o'chirish").
    const config = await this.assertLdgDispatchEnabled();

    // YAKUNLANGAN buyurtmalarni LDG'ga jo'natmaymiz (mismatch oldini olish).
    // Allaqachon yuborilgan bo'lsa — mavjud shipmentni qaytaramiz (idempotent),
    // aks holda aniq xabar bilan to'xtatamiz.
    if (LDG_SKIP_ORDER_STATUSES.includes(order.status)) {
      if (shipment) return shipment;
      throw new BadRequestException(
        `Buyurtma yakunlangan (status=${order.status}) — LDG'ga jo'natilmaydi`,
      );
    }

    if (!shipment) {
      shipment = this.shipmentRepo.create({ order_id: orderId });
    }

    // Qayta dispatch (yangi urinish) — eski LDG ma'lumotini tozalaymiz, aks holda
    // jo'natish muvaffaqiyatsiz bo'lsa stale ldg_order_id qolib, reconcile uni
    // noto'g'ri ishlatishi mumkin.
    shipment.post_id = order.post_id ?? null;
    shipment.ldg_order_id = null;
    shipment.tracking_number = null;
    shipment.ldg_status = null;
    shipment.ldg_status_changed_at = null;

    const body = await this.buildCreateOrderBody(order, config);

    try {
      // Idempotency-key urinishga xos: order + post. Qayta topshirish (yangi post)
      // LDG'da yangi buyurtma yaratadi; bir xil urinish takrori esa idempotent.
      const idempotencyKey = order.post_id
        ? `${order.id}:${order.post_id}`
        : order.id;
      const response = await this.api.createOrder(body, idempotencyKey);
      this.applyLdgResponse(shipment, response);
      // LDG "success" qaytardi-yu, lekin javobdan order_id chiqmasa — bu parsing
      // nomuvofiqligi. Jimgina null saqlab, keyin dublikat yaratib yurmaslik
      // uchun aniq xato beramiz (idempotency-key tufayli qayta urinish dublikat
      // yaratmaydi — LDG ayni buyurtmani qaytaradi).
      if (shipment.ldg_order_id == null) {
        throw new Error(
          `LDG javobida order_id topilmadi (javob shakli kutilmagan): ${JSON.stringify(
            response,
          ).slice(0, 300)}`,
        );
      }
      shipment.last_error = null;
      shipment.send_attempts = (shipment.send_attempts ?? 0) + 1;
      await this.shipmentRepo.save(shipment);
      this.logger.log(
        `LDG shipment yaratildi: order=${order.id} post=${order.post_id} ldg_order_id=${response.order_id} tracking=${response.tracking_number}`,
      );
      // Audit: buyurtma LDG'ga jo'natildi (dispatch hodisasi)
      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'dispatched',
        new_value: {
          order_number: order.order_number,
          ldg_order_id: shipment.ldg_order_id,
          ldg_tracking: shipment.tracking_number,
          total_price: order.total_price,
        },
        description: `Buyurtma #${order.order_number} LDG'ga jo'natildi (kuzatuv: ${shipment.tracking_number ?? '-'})`,
        user: actor,
        metadata: { source: 'ldg', ldg_order_id: shipment.ldg_order_id },
      });
      return shipment;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Rate-limit (429 "Too Many Attempts") VAQTINCHALIK xato — send_attempts'ni
      // oshirmaymiz, aks holda flood paytida 8 ta urinish "yeyilib", auto-retry
      // buyurtmani butunlay tashlab ketadi. Global yozish navbati buni kamaytiradi,
      // lekin baribir limitga sanamaymiz.
      if (!this.isRateLimitError(msg)) {
        shipment.send_attempts = (shipment.send_attempts ?? 0) + 1;
      }

      // LDG "already exists" (tracking_code/barcode/external_order_id band) —
      // buyurtma LDG'da ALLAQACHON yaratilgan. Bu hard-failure EMAS: qayta
      // jo'natishga urinmaymiz (aks holda har safar shu dublikat xatosi chiqadi).
      // LDG'ning package.created webhook'i ldg_order_id'ni avtomatik bog'laydi.
      if (this.isAlreadyExistsError(msg)) {
        shipment.last_error = `LDG'da allaqachon mavjud — webhook orqali bog'lanadi (${msg.slice(0, 160)})`;
        await this.shipmentRepo.save(shipment);
        this.logger.warn(
          `LDG shipment allaqachon mavjud (qayta yaratilmaydi): order=${order.id} - ${msg}`,
        );
        return shipment;
      }

      shipment.last_error = msg;
      await this.shipmentRepo.save(shipment);
      this.logger.error(
        `LDG shipment yaratish muvaffaqiyatsiz: order=${order.id} - ${msg}`,
      );
      throw err;
    }
  }

  /**
   * LDG javobidagi xato "allaqachon mavjud" (unique/duplicate) ekanini aniqlaydi.
   * LDG buni har xil so'z bilan yuborishi mumkin, shuning uchun keng tekshiramiz.
   */
  private isAlreadyExistsError(msg: string): boolean {
    const m = msg.toLowerCase();
    return (
      m.includes('already exists') ||
      m.includes('duplicate') ||
      m.includes('tracking_code') ||
      m.includes('already_exists') ||
      m.includes('uniqueviolation') ||
      m.includes('unique constraint')
    );
  }

  /**
   * LDG javobi rate-limit (429) ekanini aniqlaydi — vaqtinchalik xato, qayta
   * urinsa o'tadi. send_attempts cap'iga sanamaslik uchun ishlatiladi.
   */
  private isRateLimitError(msg: string): boolean {
    const m = msg.toLowerCase();
    return (
      m.includes('429') ||
      m.includes('too many') ||
      m.includes('rate limit') ||
      m.includes('rate-limit')
    );
  }

  /**
   * LDG'ga dispatch ruxsat etilganini tekshiradi — YAGONA "kill switch".
   * Off yoki vakil-kuryer bloklangan bo'lsa xato tashlaydi (buyurtma LDG'ga
   * jo'natilmaydi, shipment yozuvi ham yaratilmaydi). Config'ni qaytaradi
   * (chaqiruvchi qayta so'rov qilmasin).
   *
   *  - KILL SWITCH 1: `config.is_active === false` → integratsiya o'chirilgan.
   *  - KILL SWITCH 2: LDG vakil-kuryer (ldg_courier_user_id) status !== ACTIVE
   *    → admin uni bloklab qo'ygan; buyurtmalar LDG tizimiga ketmaydi.
   */
  private async assertLdgDispatchEnabled(): Promise<LdgConfigEntity> {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config) {
      throw new BadRequestException('LDG sozlamalari yo\'q');
    }
    if (!config.is_active) {
      throw new ServiceUnavailableException(
        "LDG integratsiyasi o'chirilgan — buyurtma LDG'ga jo'natilmaydi",
      );
    }
    if (config.ldg_courier_user_id) {
      const courier = await this.userRepo.findOne({
        where: { id: config.ldg_courier_user_id },
        select: ['id', 'status'],
      });
      if (!courier || courier.status !== Status.ACTIVE) {
        throw new ServiceUnavailableException(
          "LDG vakil-kuryer bloklangan — buyurtma LDG'ga jo'natilmaydi",
        );
      }
    }
    return config;
  }

  /**
   * Buyurtma qaytarilib qayta jo'natish pipeline'iga kirganda eski LDG
   * shipment ma'lumotini tozalaydi (ldg_order_id, tracking, status). Shu orqali:
   *  - reconcile poller ESKI (qaytarilgan) LDG buyurtmasini kuzatib, order
   *    statusini noto'g'ri o'zgartirib yubormaydi;
   *  - keyingi dispatch toza holatdan yangi LDG buyurtmasi yaratadi.
   *
   * Tranzaksiya ichidan chaqirilsa `manager` beriladi.
   */
  async resetForRedelivery(
    orderId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LdgShipmentEntity)
      : this.shipmentRepo;
    await repo.update(
      { order_id: orderId },
      {
        ldg_order_id: null,
        tracking_number: null,
        ldg_status: null,
        ldg_status_changed_at: null,
        last_error: null,
      },
    );
  }

  /**
   * LDG webhook orqali kelgan tracking_number/order_id bo'yicha shipmentni topish.
   * Webhook controller status update qilishdan oldin chaqiradi.
   */
  async findShipmentByLdgRef(args: {
    ldg_order_id?: number;
    tracking_number?: string;
    external_order_id?: string;
  }): Promise<LdgShipmentEntity | null> {
    if (args.ldg_order_id) {
      const found = await this.shipmentRepo.findOne({
        where: { ldg_order_id: args.ldg_order_id },
      });
      if (found) return found;
    }
    if (args.tracking_number) {
      const found = await this.shipmentRepo.findOne({
        where: { tracking_number: args.tracking_number },
      });
      if (found) return found;
    }
    if (args.external_order_id) {
      const found = await this.shipmentRepo.findOne({
        where: { order_id: args.external_order_id },
      });
      if (found) return found;
    }
    return null;
  }

  /**
   * Webhook bizga LDG package id (va tracking) ni beradi — shipmentda ular
   * yo'q bo'lsa, BACKFILL qilamiz. Bu LDG'da allaqachon yaratilgan, lekin
   * bizda ldg_order_id'siz qolgan buyurtmalarni avtomatik bog'laydi → qayta
   * jo'natish (va "tracking_code already exists" dublikat xatosi) shart emas.
   *
   * Shipment webhookda external_order_id (bizning order UUID) yoki tracking
   * bo'yicha topilgan bo'lishi mumkin, ammo ldg_order_id'si hali bo'sh.
   */
  async backfillLdgRef(
    shipment: LdgShipmentEntity,
    ref: { ldg_order_id?: number; tracking_number?: string },
  ): Promise<void> {
    let changed = false;
    if (ref.ldg_order_id != null && shipment.ldg_order_id == null) {
      shipment.ldg_order_id = ref.ldg_order_id;
      changed = true;
    }
    if (ref.tracking_number && !shipment.tracking_number) {
      shipment.tracking_number = ref.tracking_number;
      changed = true;
    }
    if (changed) {
      // Endi LDG bilan bog'landi — eski "yuborilmadi" xatosini tozalaymiz.
      shipment.last_error = null;
      await this.shipmentRepo.save(shipment);
      this.logger.log(
        `LDG backfill: order=${shipment.order_id} ldg_order_id=${shipment.ldg_order_id} tracking=${shipment.tracking_number}`,
      );
    }
  }

  /**
   * Webhook ishlovi paytida shipmentning oxirgi LDG statusini yozib qo'yamiz.
   */
  async updateShipmentStatus(
    shipment: LdgShipmentEntity,
    ldgStatusCode: string,
    changedAt?: Date,
  ): Promise<LdgShipmentEntity> {
    shipment.ldg_status = ldgStatusCode;
    shipment.ldg_status_changed_at = changedAt
      ? changedAt.getTime()
      : Date.now();
    return this.shipmentRepo.save(shipment);
  }

  /**
   * Shipment'ni umumiy saqlash — mismatch belgilari va h.k. uchun.
   */
  async saveShipment(shipment: LdgShipmentEntity): Promise<LdgShipmentEntity> {
    return this.shipmentRepo.save(shipment);
  }

  // ===== HELPERS =====

  private applyLdgResponse(
    shipment: LdgShipmentEntity,
    response: LdgCreateOrderResponseDto,
  ): void {
    // Himoyaviy parsing — LDG javobi kutilgan tekis shaklda ham, ichki
    // (data.order / data.package) shaklda ham kelishi mumkin. Bir qat'iy
    // maydonga tayanmaymiz.
    const r = response as unknown as Record<string, any>;
    const orderIdRaw =
      r.order_id ?? r.id ?? r.package_id ?? r.order?.id ?? r.package?.id;
    const tracking =
      r.tracking_number ??
      r.tracking ??
      r.order?.tracking_number ??
      r.package?.tracking_number;
    const statusCode =
      r.status?.code ??
      r.order?.status?.code ??
      (typeof r.status === 'string' ? r.status : null);
    const createdRaw = r.created_at ?? r.order?.created_at;

    shipment.ldg_order_id =
      orderIdRaw != null && /^\d+$/.test(String(orderIdRaw))
        ? Number(orderIdRaw)
        : null;
    shipment.tracking_number =
      typeof tracking === 'string' && tracking ? tracking : null;
    shipment.ldg_status = statusCode ?? null;
    const createdAtMs = createdRaw ? Date.parse(createdRaw) : NaN;
    shipment.ldg_created_at = Number.isFinite(createdAtMs)
      ? createdAtMs
      : Date.now();
  }

  private async buildCreateOrderBody(
    order: OrderEntity,
    config: LdgConfigEntity,
  ): Promise<LdgCreateOrderRequestDto> {
    if (
      !config.sender_name ||
      !config.sender_phone ||
      !config.sender_region_sato ||
      !config.sender_district_sato ||
      !config.sender_address
    ) {
      throw new BadRequestException(
        'LDG sender (markaziy filial) sozlamalari to\'liq emas',
      );
    }

    if (!order.district_id) {
      throw new BadRequestException('Order district_id yo\'q');
    }

    const district = order.district
      ? order.district
      : await this.districtRepo.findOne({
          where: { id: order.district_id },
          relations: ['region'],
        });
    if (!district || !district.sato_code) {
      throw new BadRequestException(
        `Order tumani LDG ga yuborish uchun SOATO kodisiz`,
      );
    }

    const region = district.region
      ? district.region
      : await this.districtRepo
          .findOne({
            where: { id: district.id },
            relations: ['region'],
          })
          .then((d) => d?.region ?? null);
    if (!region || !region.sato_code) {
      throw new BadRequestException(
        `Tuman regionining SOATO kodi yo\'q (district=${district.id})`,
      );
    }

    const customer = order.customer;
    if (!customer || !customer.phone_number) {
      throw new BadRequestException('Mijoz ma\'lumoti to\'liq emas');
    }

    const description = this.buildPackageDescription(order);

    // LDG'da xizmat hududlari sozlanmagan tenant'lar uchun branch_id explicit yuboramiz.
    // Ikkala tomonga ham bitta filial: tenant odatda bitta markaziy filial orqali
    // ishlaydi va bu LDG'ning BRANCH_NOT_FOUND_FOR_LOCATION xatosini chetlab o'tadi.
    const branchId = config.sender_branch_id ?? undefined;

    return {
      external_order_id: order.id,
      sender: {
        name: config.sender_name,
        phone: config.sender_phone,
        region_soato: String(config.sender_region_sato),
        district_soato: String(config.sender_district_sato),
        address: config.sender_address,
        ...(branchId ? { branch_id: branchId } : {}),
      },
      receiver: {
        name: customer.name ?? 'Mijoz',
        phone: customer.phone_number,
        region_soato: String(region.sato_code),
        district_soato: String(district.sato_code),
        address: order.address ?? district.name ?? '-',
        ...(branchId ? { branch_id: branchId } : {}),
      },
      package: {
        // Bizning chek QR-tokeni — LDG kuryer skanlaganda buyurtmani avtomatik qabul qiladi
        ...(order.qr_code_token ? { barcode: order.qr_code_token } : {}),
        weight: config.default_weight,
        length: config.default_length,
        width: config.default_width,
        height: config.default_height,
        seats: config.default_seats,
        description,
        declared_value: Number(order.total_price) || 0,
      },
      payment: {
        payer_type:
          (config.default_payer_type as 'receiver' | 'sender' | 'third_party') ??
          'receiver',
        cod_amount: Number(order.total_price) || 0,
      },
      comment: order.comment ?? '',
    };
  }

  /**
   * Order itemlardan paket tavsifini yig'amiz: "Mahsulot1 x2, Mahsulot2 x1".
   * 200 belgidan oshmasligi uchun kesilarmiz.
   */
  private buildPackageDescription(order: OrderEntity): string {
    const items = order.items ?? [];
    if (items.length === 0) return 'Buyurtma';

    const parts: string[] = [];
    for (const item of items) {
      const name = item.product?.name ?? 'Mahsulot';
      parts.push(`${name} x${item.quantity}`);
    }
    const joined = parts.join(', ');
    return joined.length > 200 ? joined.slice(0, 197) + '...' : joined;
  }
}
