import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LdgShipmentEntity } from 'src/core/entity/ldg-shipment.entity';
import { LdgConfigEntity } from 'src/core/entity/ldg-config.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { LdgApiService } from './ldg-api.service';
import {
  LdgCreateOrderRequestDto,
  LdgCreateOrderResponseDto,
} from './dto/ldg-create-order.dto';

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
  ) {}

  /**
   * Tekshiradi: bu order LDG orqali yetkazib berilishi kerakmi?
   * - Sozlamada faol bo'lishi shart
   * - Order district_id bo'lishi shart
   * - Order district sato_code enabled_district_sato_codes ichida bo'lishi shart
   */
  async shouldDeliverViaLdg(order: OrderEntity): Promise<boolean> {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config || !config.is_active) return false;
    if (!order.district_id) return false;

    const district = await this.districtRepo.findOne({
      where: { id: order.district_id },
    });
    if (!district || !district.sato_code) return false;

    const districtSato = Number(district.sato_code);
    if (!Number.isFinite(districtSato)) return false;

    return config.enabled_district_sato_codes.includes(districtSato);
  }

  /**
   * Order uchun LDG ga shipment yaratadi (POST /orders).
   * Shu vaqtda LdgShipmentEntity ham yaratiladi/yangilanadi.
   *
   * Idempotent: agar shipment allaqachon mavjud bo'lsa va ldg_order_id bor bo'lsa,
   * qayta yuborilmaydi (return existing).
   */
  async createShipmentForOrder(orderId: string): Promise<LdgShipmentEntity> {
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

    // Agar allaqachon LDG ga muvaffaqiyatli yuborilgan bo'lsa, qaytaramiz
    if (shipment?.ldg_order_id) {
      return shipment;
    }

    if (!shipment) {
      shipment = this.shipmentRepo.create({ order_id: orderId });
    }

    const config = await this.configRepo.findOne({ where: {} });
    if (!config) {
      throw new BadRequestException('LDG sozlamalari yo\'q');
    }

    const body = await this.buildCreateOrderBody(order, config);

    try {
      const response = await this.api.createOrder(body, order.id);
      this.applyLdgResponse(shipment, response);
      shipment.last_error = null;
      shipment.send_attempts = (shipment.send_attempts ?? 0) + 1;
      await this.shipmentRepo.save(shipment);
      this.logger.log(
        `LDG shipment yaratildi: order=${order.id} ldg_order_id=${response.order_id} tracking=${response.tracking_number}`,
      );
      return shipment;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      shipment.last_error = msg;
      shipment.send_attempts = (shipment.send_attempts ?? 0) + 1;
      await this.shipmentRepo.save(shipment);
      this.logger.error(
        `LDG shipment yaratish muvaffaqiyatsiz: order=${order.id} - ${msg}`,
      );
      throw err;
    }
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

  // ===== HELPERS =====

  private applyLdgResponse(
    shipment: LdgShipmentEntity,
    response: LdgCreateOrderResponseDto,
  ): void {
    shipment.ldg_order_id = response.order_id;
    shipment.tracking_number = response.tracking_number;
    shipment.ldg_status = response.status?.code ?? null;
    const createdAtMs = response.created_at
      ? Date.parse(response.created_at)
      : NaN;
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
