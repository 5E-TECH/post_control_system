import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RollbackOrderDto, RollbackTarget } from './dto/rollback-order.dto';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { DataSource, EntityManager, In, IsNull, QueryRunner } from 'typeorm';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { OrderItemRepository } from 'src/core/repository/order-item.repository';
import {
  Cashbox_type,
  Group_type,
  Operation_type,
  Order_status,
  Post_status,
  Replacement_state,
  Roles,
  Source_type,
  Status,
  Where_deliver,
} from 'src/common/enums';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { normalizeQrToken } from 'src/infrastructure/lib/qr-token/normalize';
import { ProductRepository } from 'src/core/repository/product.repository';
import { ProductEntity } from 'src/core/entity/product.entity';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { SellCancelOrderDto } from './dto/sellCancel-order.dto';
import { OrdersArrayDto } from './dto/orders-array.dto';
import { BulkOrderActionDto } from './dto/bulk-order-action.dto';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { generateComment } from 'src/common/utils/generate-comment';
import { orderStatusUz } from 'src/common/utils/status-label.util';
import { PartlySoldDto } from './dto/partly-sold.dto';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashboxHistoryRepository } from 'src/core/repository/cashbox-history.repository';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { OrderGateaway } from '../socket/order.gateaway';
import { PostRepository } from 'src/core/repository/post.repository';
import { MyLogger } from 'src/logger/logger.service';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { TelegramRepository } from 'src/core/repository/telegram-market.repository';
import { BotService } from '../bots/notify-bot/bot.service';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';
import { OrderDto } from './dto/orderId.dto';
import { CreateOrderByBotDto } from './dto/create-order-bot.dto';
import { UpdateOrderAddressDto } from './dto/update-order-address.dto';
import { OrderBotService } from '../bots/order_create-bot/order-bot.service';
import { getSafeLimit, PAGINATION } from 'src/common/constants/pagination';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { ExternalIntegrationService } from '../external-integration/external-integration.service';
import { FieldMapping } from 'src/core/entity/external-integration.entity';
import { IntegrationSyncService } from '../integration-sync/integration-sync.service';
import { OperatorEarningEntity } from 'src/core/entity/operator-earning.entity';
import { Commission_type, FinancialSource_type } from 'src/common/enums';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { calculateFinancialBalance } from 'src/common/utils/financial-balance.util';
import { ActivityLogService } from '../activity-log/activity-log.service';

/**
 * LDG webhook terminal handler natijasi:
 *  - 'applied'  — biznes oqim bajarildi (sotildi/bekor qilindi/qaytarildi)
 *  - 'skipped'  — idempotent: order allaqachon kerakli holatda yoki topilmadi
 *  - 'mismatch' — LDG holati bizning order holati bilan to'qnashadi (qo'lda
 *                 tekshirilishi kerak — masalan, biz SOLD, LDG CANCELLED)
 */
export type LdgTerminalResult =
  | { kind: 'applied' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'mismatch'; reason: string };

@Injectable()
export class OrderService extends BaseService<CreateOrderDto, OrderEntity> {
  // In-memory cache for top markets/couriers (30 kunlik aggregation og'ir bo'lgani uchun)
  private topMarketsCache: { data: any; expireAt: number } | null = null;
  private topCouriersCache: { data: any; expireAt: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 daqiqa

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: OrderItemRepository,

    @InjectRepository(ProductEntity)
    private readonly productRepo: ProductRepository,

    @InjectRepository(CashEntity)
    private readonly cashboxRepo: CashRepository,

    @InjectRepository(CashboxHistoryEntity)
    private readonly cashboxHistoryRepo: CashboxHistoryRepository,

    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(PostEntity)
    private readonly postRepo: PostRepository,

    @InjectRepository(TelegramEntity)
    private readonly telegramRepo: TelegramRepository,

    private readonly logger: MyLogger,
    private readonly dataSource: DataSource,
    private readonly orderGateaway: OrderGateaway,
    private readonly botService: BotService,
    private readonly orderBotService: OrderBotService,
    private readonly externalIntegrationService: ExternalIntegrationService,
    private readonly integrationSyncService: IntegrationSyncService,
    private readonly activityLog: ActivityLogService,
  ) {
    super(orderRepo);
  }

  // Helper metod - nested field qiymatini olish (masalan: "customer.name")
  private getFieldValue(obj: any, fieldPath: string): any {
    if (!fieldPath || !obj) return undefined;
    return fieldPath.split('.').reduce((o, k) => o?.[k], obj);
  }

  private formatPrice(value: number | string) {
    const numeric = Number(value) || 0;
    return numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  async allOrders(query: {
    status?: string | string[];
    marketId?: string;
    regionId?: string;
    courierId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    fetchAll?: boolean | string;
  }) {
    try {
      const page = query.page || 1;
      // Query params string sifatida keladi, shuning uchun "true" ni ham tekshiramiz
      const fetchAll =
        query.fetchAll === true || (query.fetchAll as any) === 'true';
      const limit = getSafeLimit(query.limit, fetchAll);

      const qb = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('customer.district', 'customerDistrict')
        .leftJoinAndSelect('customerDistrict.region', 'customerRegion')
        .leftJoinAndSelect(
          'customerDistrict.assignedToRegion',
          'customerAssignedRegion',
        )
        // Order ning o'z district (yetkazib berish manzili)
        .leftJoinAndSelect('order.district', 'orderDistrict')
        .leftJoinAndSelect('orderDistrict.region', 'orderRegion')
        .leftJoinAndSelect(
          'orderDistrict.assignedToRegion',
          'orderAssignedRegion',
        )
        .leftJoinAndSelect('order.market', 'market')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('order.post', 'post')
        .leftJoinAndSelect('post.courier', 'courier')
        // Almashtirish: yangi buyurtmada eski #raqamni ko'rsatish uchun
        .leftJoinAndSelect('order.replacementOf', 'replacementOf')
        // Soft-deleted'lar TypeORM tomonidan filter qilinishi kerak,
        // lekin xavfsizlik uchun explicit ham qo'shamiz
        .andWhere('order.deleted_at IS NULL')
        .orderBy('order.created_at', 'DESC');

      // CREATED holatdagi buyurtmalar default ro'yxatda ko'rsatilmaydi
      if (!query.status) {
        qb.andWhere('order.status != :createdStatus', {
          createdStatus: Order_status.CREATED,
        });
      }

      if (query.status) {
        const statusArray = Array.isArray(query.status)
          ? query.status
          : [query.status];
        qb.andWhere('order.status IN (:...statuses)', {
          statuses: statusArray,
        });
      }

      if (query.marketId) {
        qb.andWhere('order.user_id = :marketId', { marketId: query.marketId });
      }

      if (query.regionId) {
        // Order district yoki customer district bo'yicha filter
        qb.andWhere(
          '(orderRegion.id = :regionId OR (orderDistrict.id IS NULL AND customerRegion.id = :regionId))',
          { regionId: query.regionId },
        );
      }

      if (query.courierId) {
        qb.andWhere('post.courier_id = :courierId', {
          courierId: query.courierId,
        });
      }

      if (query.search) {
        qb.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search OR CAST("order".order_number AS TEXT) ILIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      // ✅ Sana filter qo'shildi
      let startMs: number | undefined;
      let endMs: number | undefined;

      if (query.startDate) {
        startMs = toUzbekistanTimestamp(query.startDate, false);
      }
      if (query.endDate) {
        endMs = toUzbekistanTimestamp(query.endDate, true);
      }

      if (startMs && endMs) {
        qb.andWhere('order.created_at BETWEEN :startDate AND :endDate', {
          startDate: startMs,
          endDate: endMs,
        });
      } else if (startMs) {
        qb.andWhere('order.created_at >= :startDate', { startDate: startMs });
      } else if (endMs) {
        qb.andWhere('order.created_at <= :endDate', { endDate: endMs });
      }

      // 🔢 Pagination
      const skip = (page - 1) * limit;
      qb.skip(skip).take(limit);

      const [data, total] = await qb.getManyAndCount();

      return successRes(
        {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        200,
        'All orders',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async createOrder(
    createOrderDto: CreateOrderDto,
    user: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const {
        customer_id,
        order_item_info,
        total_price,
        where_deliver,
        operator,
        comment,
        district_id,
        address,
      } = createOrderDto;

      let { market_id } = createOrderDto;

      // Agar market o'zi buyurtma yaratayotgan bo'lsa, market_id ni user.id ga o'rnatish
      if (!market_id && user.role === Roles.MARKET) {
        market_id = user.id;
      }

      // Agar operator buyurtma yaratayotgan bo'lsa, market_id ni operatorning market_id sidan olish
      if (user.role === Roles.OPERATOR) {
        const operatorUser = await queryRunner.manager.findOne(UserEntity, {
          where: { id: user.id, role: Roles.OPERATOR },
        });
        if (!operatorUser || !operatorUser.market_id) {
          throw new BadRequestException('Operator marketga biriktirilmagan');
        }
        market_id = operatorUser.market_id;
        // operator field yo'q bo'lsa, operator ismini avtomatik to'ldirish
        if (!createOrderDto.operator) {
          createOrderDto.operator = operatorUser.name;
        }
      }

      // Agar market boshqa market uchun buyurtma yaratmoqchi bo'lsa, rad etish
      if (user.role === Roles.MARKET && user.id !== market_id) {
        throw new BadRequestException('Market Id is not match!');
      }

      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: market_id, role: Roles.MARKET },
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }

      if (
        (user.role === Roles.MARKET || user.role === Roles.OPERATOR) &&
        !market.add_order
      ) {
        throw new BadRequestException('You can not create order and product');
      }

      // Operator telefon mantiqi (require_operator_phone toggle bo'yicha):
      //  • toggle OFF                    — default ishlatiladi (mavjud bo'lsa), form'dagi input — 2-raqam
      //  • toggle ON + default bor       — default = 1-raqam, form'dagi input — ixtiyoriy 2-raqam
      //  • toggle ON + default yo'q      — form'dagi input MAJBURIY, u 1-raqam bo'ladi (2-raqam yo'q)
      //  • toggle ON + default yo'q + form'da ham yo'q → 400 xatolik
      const formInputPhone =
        createOrderDto.operator_phone?.trim() ||
        createOrderDto.secondary_operator_phone?.trim() ||
        '';
      const marketDefaultPhone = market.default_operator_phone?.trim() || '';

      let finalOperatorPhone: string | null;
      let finalSecondaryOperatorPhone: string | null;

      if (market.require_operator_phone) {
        if (marketDefaultPhone) {
          finalOperatorPhone = marketDefaultPhone;
          finalSecondaryOperatorPhone =
            formInputPhone && formInputPhone !== marketDefaultPhone
              ? formInputPhone
              : null;
        } else {
          if (!formInputPhone) {
            throw new BadRequestException(
              'Operator telefon raqami majburiy. Iltimos, market profilida default operator raqamini kiriting yoki buyurtma yaratishda raqam kiriting.',
            );
          }
          finalOperatorPhone = formInputPhone;
          finalSecondaryOperatorPhone = null;
        }
      } else {
        finalOperatorPhone = marketDefaultPhone || null;
        finalSecondaryOperatorPhone =
          formInputPhone && formInputPhone !== finalOperatorPhone
            ? formInputPhone
            : null;
      }

      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: customer_id, role: Roles.CUSTOMER },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // === ALMASHTIRISH (kafolat-swap) validatsiyasi ===
      // Bu yangi buyurtma avval yetkazilgan ESKI buyurtma o'rniga ketayotgan
      // bo'lsa: eski buyurtmani LOCK bilan yuklab, shu market+mijozga tegishli,
      // sotilgan va hali almashtirilmagan ekanini tekshiramiz. Eski buyurtmaning
      // PULIGA TEGMAYMIZ (kafolat-swap — reversal yo'q), faqat jismoniy
      // qaytarish uchun belgilaymiz.
      let replacedOrder: OrderEntity | null = null;
      if (createOrderDto.replaced_order_id) {
        replacedOrder = await queryRunner.manager.findOne(OrderEntity, {
          where: { id: createOrderDto.replaced_order_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!replacedOrder) {
          throw new NotFoundException(
            'Almashtirilayotgan eski buyurtma topilmadi',
          );
        }
        if (replacedOrder.user_id !== market_id) {
          throw new BadRequestException(
            'Eski buyurtma boshqa marketga tegishli — almashtirish faqat shu marketning buyurtmasi bilan mumkin',
          );
        }
        // Eslatma: eski buyurtma BOSHQA mijozga tegishli bo'lishi mumkin
        // (ataylab tekshirilmaydi) — masalan mijoz boshqa raqam bilan buyurtma
        // bergan yoki almashtirish boshqa mijoz buyurtmasi o'rniga ketadi.
        // Faqat shu MARKET va yetkazilgan (sotilgan) bo'lishi shart.
        const DELIVERED_STATUSES: Order_status[] = [
          Order_status.SOLD,
          Order_status.PAID,
          Order_status.PARTLY_PAID,
          Order_status.CLOSED,
        ];
        if (!DELIVERED_STATUSES.includes(replacedOrder.status)) {
          throw new BadRequestException(
            'Faqat yetkazib berilgan (sotilgan) buyurtmani almashtirish mumkin',
          );
        }
        if (replacedOrder.is_replacement_return) {
          throw new BadRequestException(
            'Bu buyurtma allaqachon almashtirishga belgilangan',
          );
        }
      }

      const qr_code_token = generateCustomToken();

      // Agar manzil berilmagan bo'lsa, mijozning default manzilini olish
      const orderDistrictId = district_id || customer.district_id;
      const orderAddress = address !== undefined ? address : customer.address;

      // Aniq tuman berilgan bo'lsa — mavjudligini tekshirish (aniq xato xabari
      // + mavjud bo'lmagan district_id bilan buyurtma yozib qo'ymaslik uchun)
      if (district_id) {
        const districtExists = await queryRunner.manager.findOne(
          DistrictEntity,
          { where: { id: district_id }, select: ['id'] },
        );
        if (!districtExists) {
          throw new NotFoundException('Tuman topilmadi');
        }
      }

      // ✅ Batch: Barcha productlarni bir so'rovda olish va tekshirish
      // MUHIM: faqat SHU marketning (user_id === market_id) o'chirilmagan
      // mahsulotlari qabul qilinadi — boshqa marketning mahsuloti buyurtmaga
      // tushmasligi uchun (IDOR himoyasi).
      const productIds = order_item_info.map((item) => item.product_id);
      const existingProducts = await queryRunner.manager.find(ProductEntity, {
        where: { id: In(productIds), user_id: market_id, isDeleted: false },
      });
      const existingProductIds = new Set(existingProducts.map((p) => p.id));
      for (const productId of productIds) {
        if (!existingProductIds.has(productId)) {
          throw new NotFoundException(`Product not found: ${productId}`);
        }
      }

      // product_quantity ni avvaldan hisoblash — DB ga to'g'ri saqlanishi uchun
      const product_quantity = order_item_info.reduce(
        (sum, o_item) => sum + Number(o_item.quantity),
        0,
      );

      const newOrder = queryRunner.manager.create(OrderEntity, {
        user_id: market_id,
        comment,
        operator: createOrderDto.operator,
        operator_phone: finalOperatorPhone,
        secondary_operator_phone: finalSecondaryOperatorPhone,
        operator_id: user.role === Roles.OPERATOR ? user.id : null,
        total_price,
        product_quantity,
        where_deliver: where_deliver || Where_deliver.CENTER,
        status: Order_status.NEW,
        qr_code_token,
        customer_id,
        district_id: orderDistrictId,
        address: orderAddress,
        // Almashtirish bo'lsa — eskiga havola + kuryer "eskisini oldim" gate'i
        replacement_of_order_id: replacedOrder ? replacedOrder.id : null,
        replacement_state: replacedOrder
          ? Replacement_state.AWAITING_OLD_PICKUP
          : null,
      });

      await queryRunner.manager.save(newOrder);

      // Almashtirish: ESKI buyurtmani jismoniy qaytarish uchun belgilash.
      // Statusi (SOTILGAN) va PULI O'ZGARMAYDI — faqat qaytarish ro'yxatida
      // ko'rinishi va kuzatuvi uchun flag qo'yamiz.
      if (replacedOrder) {
        replacedOrder.is_replacement_return = true;
        replacedOrder.replacement_state = Replacement_state.AWAITING_OLD_PICKUP;
        await queryRunner.manager.save(replacedOrder);
      }

      // ✅ Batch: Barcha order itemlarni bir vaqtda yaratish va saqlash
      const orderItems = order_item_info.map((o_item) =>
        queryRunner.manager.create(OrderItemEntity, {
          productId: o_item.product_id,
          quantity: o_item.quantity,
          orderId: newOrder.id,
        }),
      );

      await queryRunner.manager.save(orderItems);

      await queryRunner.commitTransaction();

      // Activity log
      this.activityLog.log({
        entity_type: 'order',
        entity_id: newOrder.id,
        action: 'created',
        new_value: {
          order_number: newOrder.order_number,
          status: Order_status.NEW,
          total_price,
          customer_id,
          market_id,
          ...(replacedOrder
            ? {
                replacement_of_order_id: replacedOrder.id,
                replacement_of_order_number: replacedOrder.order_number,
              }
            : {}),
        },
        description: replacedOrder
          ? `Buyurtma #${newOrder.order_number} yaratildi (ALMASHTIRISH — eski #${replacedOrder.order_number} o'rniga) — ${total_price} so'm`
          : `Buyurtma #${newOrder.order_number} yaratildi — ${total_price} so'm`,
        user,
      });

      return successRes(newOrder, 201, 'New order created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * BOT buyurtmasini guruh-tasdiqlashga yo'naltiradi (yagona, markazlashgan joy).
   * - Market'da CREATE tipidagi guruh bor bo'lsa: buyurtmani CREATED qilib
   *   guruh(lar)ga ✅/❌ tugmalar bilan yuboradi va xabar havolalarini yozadi.
   * - Guruh YO'Q yoki BARCHA yuborish muvaffaqiyatsiz bo'lsa: buyurtmani NEW ga
   *   o'tkazadi — CREATED holatida "qotib" qolmasin (operator navbatida ko'rinsin).
   * Web/platforma buyurtmalari (createOrder) BU HELPERNI CHAQIRMAYDI — ular
   * avvalgidek to'g'ridan NEW qoladi (faqat bot oqimi guruhga tushadi).
   */
  async dispatchOrderForApproval(orderId: string): Promise<'created' | 'new'> {
    const order = await this.dataSource.manager.findOne(OrderEntity, {
      where: { id: orderId },
      relations: [
        'items',
        'items.product',
        'customer',
        'customer.district',
        'customer.district.region',
      ],
    });
    if (!order) return 'new';

    const toNew = async () => {
      if (order.status !== Order_status.NEW || order.deleted_at) {
        await this.dataSource.manager.update(
          OrderEntity,
          { id: order.id },
          { status: Order_status.NEW },
        );
      }
      return 'new' as const;
    };

    const groups = await this.dataSource.manager.find(TelegramEntity, {
      where: { market_id: order.user_id, group_type: Group_type.CREATE },
    });

    // Guruh yo'q — tasdiq talab qilinmaydi, to'g'ridan NEW.
    if (!groups.length) {
      return toNew();
    }

    // Guruhga yuboriladigan xabar CREATED (tasdiq kutilmoqda) holatini ko'rsatsin.
    order.status = Order_status.CREATED;
    const sendResults = await Promise.all(
      groups.map((g) =>
        this.orderBotService.sendOrderForApproval(g.group_id || null, order),
      ),
    );
    const messageRefs = sendResults
      .map((r) => r.sentMessage)
      .filter(Boolean) as { chatId: number; messageId: number }[];

    // Hech qaysi guruhga yuborib bo'lmadi (bot guruhda yo'q / group_id noto'g'ri /
    // rate-limit / tarmoq) — CREATED da qotib qolmasin, NEW ga o'tkazamiz.
    if (!messageRefs.length) {
      this.logger.log(
        `Order ${order.id}: CREATE guruh(lar)iga yuborib bo'lmadi — NEW ga o'tkazildi`,
        'OrderBot',
      );
      return toNew();
    }

    // Yuborildi — CREATED (tasdiq kutilmoqda) + xabar havolalari.
    await this.dataSource.manager.update(
      OrderEntity,
      { id: order.id },
      {
        status: Order_status.CREATED,
        create_bot_messages: [
          ...(order.create_bot_messages || []),
          ...messageRefs,
        ],
      },
    );
    return 'created';
  }

  async createOrderByBot(dto: CreateOrderByBotDto, user: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const {
        name,
        phone_number,
        district_id,
        address,
        order_item_info,
        total_price,
        where_deliver,
        comment,
        extra_number,
        operator,
      } = dto;

      this.logger.log(dto, 'Incoming DTO');

      const currentUser = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });
      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      let marketId: string;
      if (currentUser.role === Roles.MARKET) {
        marketId = currentUser.id;
      } else if (currentUser.role === Roles.OPERATOR) {
        if (!currentUser.market_id) {
          throw new BadRequestException('Operator is not linked to any market');
        }
        marketId = currentUser.market_id;
      } else {
        throw new BadRequestException(
          'Only market or operator can create orders via bot',
        );
      }

      // Tuman mavjudligini tekshirish (aniq xato xabari + noto'g'ri district_id
      // bilan customer yozib qo'ymaslik uchun)
      const districtExists = await queryRunner.manager.findOne(DistrictEntity, {
        where: { id: district_id },
        select: ['id'],
      });
      if (!districtExists) {
        throw new NotFoundException('Tuman topilmadi');
      }

      // ── Dublikat himoyasi ──
      // Tugmani ikki marta bosish, qayta yuborilgan forward yoki tarmoq retry
      // bir xil buyurtmani ikki marta yozib qo'ymasligi uchun: (market + telefon)
      // bo'yicha tranzaksiya-lock bilan bir vaqtli so'rovlarni ketma-ketlashtirib,
      // yaqin vaqtdagi (narx + dona bir xil) aktiv buyurtmani qayta ishlatamiz
      // (idempotent javob — yangi dublikat yaratilmaydi).
      const dedupPhone9 = (phone_number || '').replace(/\D/g, '').slice(-9);
      await queryRunner.manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`order_bot_create:${marketId}:${dedupPhone9}`],
      );

      const incomingQty = order_item_info.reduce(
        (sum, o_item) => sum + Number(o_item.quantity),
        0,
      );

      // Savat imzosi: product_id → umumiy dona (tartibdan mustaqil). Faqat
      // AYNAN bir xil savat dublikat deb hisoblanadi — bir xil narx/dona
      // bo'lgan boshqa mahsulotli HAQIQIY buyurtmani bloklamaslik uchun.
      const cartSignature = (
        pairs: { productId: string; quantity: number }[],
      ): string => {
        const totals = new Map<string, number>();
        for (const p of pairs) {
          totals.set(
            p.productId,
            (totals.get(p.productId) || 0) + Number(p.quantity),
          );
        }
        return [...totals.entries()]
          .map(([pid, qty]) => `${pid}:${qty}`)
          .sort()
          .join('|');
      };
      const incomingSignature = cartSignature(
        order_item_info.map((i) => ({
          productId: i.product_id,
          quantity: Number(i.quantity),
        })),
      );

      if (dedupPhone9.length >= 9) {
        const DEDUP_WINDOW_MS = 2 * 60 * 1000; // 2 daqiqa
        const recentCandidates = await queryRunner.manager
          .createQueryBuilder(OrderEntity, 'order')
          .leftJoinAndSelect('order.customer', 'customer')
          .leftJoinAndSelect('order.items', 'items')
          .leftJoinAndSelect('items.product', 'product')
          .leftJoinAndSelect('customer.district', 'district')
          .leftJoinAndSelect('district.region', 'region')
          .where('order.user_id = :marketId', { marketId })
          .andWhere('order.deleted_at IS NULL')
          .andWhere('order.status IN (:...statuses)', {
            statuses: [
              Order_status.CREATED,
              Order_status.NEW,
              Order_status.RECEIVED,
              Order_status.ON_THE_ROAD,
              Order_status.WAITING,
            ],
          })
          .andWhere('order.total_price = :totalPrice', {
            totalPrice: total_price,
          })
          .andWhere('order.product_quantity = :incomingQty', { incomingQty })
          .andWhere('order.created_at >= :threshold', {
            threshold: Date.now() - DEDUP_WINDOW_MS,
          })
          .orderBy('order.created_at', 'DESC')
          .take(20)
          .getMany();

        // Telefon (raqamlargacha normallashtirilib, oxirgi 9 raqam) VA savat
        // imzosi AYNAN mos kelgan buyurtmagina dublikat hisoblanadi: tugmani
        // ikki marta bosish / tarmoq retry / qayta forward. Saqlangan telefon
        // formatli (bo'shliq/tire) bo'lishi mumkin — shuning uchun ikkala
        // tomon ham raqamlargacha normallashtirib solishtiriladi.
        const recentDuplicate = recentCandidates.find(
          (cand) =>
            (cand.customer?.phone_number || '')
              .replace(/\D/g, '')
              .slice(-9) === dedupPhone9 &&
            cartSignature(
              (cand.items || []).map((it) => ({
                productId: it.productId,
                quantity: Number(it.quantity),
              })),
            ) === incomingSignature,
        );

        if (recentDuplicate) {
          await queryRunner.commitTransaction();
          this.logger.log(
            `Dublikat bot buyurtmasi bloklandi (market ${marketId}) — mavjud ${recentDuplicate.id} qaytarildi`,
            'OrderBot',
          );
          return successRes(
            recentDuplicate,
            200,
            'Bu buyurtma allaqachon yaratilgan',
          );
        }
      }

      const newCustomer = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        district_id,
        role: Roles.CUSTOMER,
        address,
        extra_number,
      });
      await queryRunner.manager.save(newCustomer);

      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: newCustomer.id },
        relations: ['district', 'district.region'],
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const qr_code_token = generateCustomToken();

      // Market default va 2-operator raqamlarini snapshot sifatida olish
      const botMarket = await queryRunner.manager.findOne(UserEntity, {
        where: { id: marketId },
      });

      const newOrder = queryRunner.manager.create(OrderEntity, {
        customer_id: customer.id,
        user_id: marketId,
        operator: operator ? operator : currentUser.name,
        operator_phone: botMarket?.default_operator_phone || null,
        secondary_operator_phone: botMarket?.secondary_operator_phone || null,
        total_price,
        where_deliver: where_deliver || Where_deliver.CENTER,
        status: Order_status.CREATED,
        qr_code_token,
        comment,
      });
      await queryRunner.manager.save(newOrder);

      // ✅ Batch: Barcha productlarni bir so'rovda olish
      // MUHIM: faqat SHU marketning (user_id === marketId) o'chirilmagan
      // mahsulotlari qabul qilinadi (IDOR himoyasi).
      const productIds = order_item_info.map((item) => item.product_id);
      const existingProducts = await queryRunner.manager.find(ProductEntity, {
        where: { id: In(productIds), user_id: marketId, isDeleted: false },
      });

      // Mavjud productlar ro'yxatini yaratish
      const existingProductIds = new Set(existingProducts.map((p) => p.id));

      // Mavjud bo'lmagan productlarni tekshirish
      for (const productId of productIds) {
        if (!existingProductIds.has(productId)) {
          throw new NotFoundException(`Product not found: ${productId}`);
        }
      }

      // ✅ Batch: Barcha order itemlarni bir vaqtda yaratish va saqlash
      let product_quantity: number = 0;
      const orderItems = order_item_info.map((o_item) => {
        product_quantity += Number(o_item.quantity);
        return queryRunner.manager.create(OrderItemEntity, {
          productId: o_item.product_id,
          quantity: o_item.quantity,
          orderId: newOrder.id,
        });
      });

      // Batch save - bitta so'rovda
      await queryRunner.manager.save(orderItems);

      Object.assign(newOrder, {
        product_quantity,
      });

      await queryRunner.manager.save(newOrder);

      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: newOrder.id },
        relations: [
          'items',
          'items.product',
          'customer',
          'customer.district',
          'customer.district.region',
        ],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Buyurtma va itemlar saqlandi — tranzaksiyani shu yerda YOPAMIZ.
      // Telegram yuborish (tashqi HTTP) tranzaksiyadan TASHQARIDA bo'lishi shart:
      // aks holda advisory lock va DB ulanishi butun Telegram round-trip davomida
      // ushlanib qoladi (sekin/uzilishda lock va connection-pool contention).
      await queryRunner.commitTransaction();

      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'created',
        new_value: {
          order_number: order.order_number,
          status: Order_status.NEW,
          total_price: order.total_price,
          source: 'telegram_bot',
        },
        description: `Buyurtma #${order.order_number} Telegram bot orqali yaratildi — ${order.total_price} so'm`,
        user,
      });

      // Tranzaksiyadan TASHQARIDA (lock ushlamay): guruh-tasdiqlashga yo'naltirish.
      // Yagona helper — guruh bo'lsa CREATED+yuborish, aks holda/xatoda NEW
      // (CREATED da qotib qolmaslik). Xato buyurtmani bekor qilmaydi.
      try {
        await this.dispatchOrderForApproval(order.id);
      } catch (notifyErr) {
        // Guruhga yo'naltirishda kutilmagan xato — buyurtma CREATED da qotib
        // qolmasin, NEW ga o'tkazamiz (fallback).
        this.logger.log(
          `Bot buyurtma ${order.id} guruh-yo'naltirishda xato: ${(notifyErr as Error).message} — NEW ga o'tkazildi`,
          'OrderBot',
        );
        try {
          await this.dataSource.manager.update(
            OrderEntity,
            { id: order.id },
            { status: Order_status.NEW },
          );
        } catch {
          /* ignore */
        }
      }

      return successRes(order, 201, 'New order created');
    } catch (error) {
      this.logger.log(error);
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async haveNewOrderMarkets(search?: string) {
    try {
      const allNewOrders = await this.orderRepo.find({
        where: { status: Order_status.NEW },
      });

      if (!allNewOrders.length) {
        return successRes([], 200, 'No new orders');
      }

      const uniqueMarketIds = Array.from(
        new Set(allNewOrders.map((order) => order.user_id)),
      );

      let query = this.userRepo
        .createQueryBuilder('user')
        .where('user.id IN (:...ids)', { ids: uniqueMarketIds })
        .andWhere('user.role = :role', { role: Roles.MARKET });

      if (search) {
        query = query.andWhere(
          '(user.name ILIKE :search OR user.phone_number ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      const allUniqueMarkets = await query.getMany();

      const todaysOrdersInfos = await Promise.all(
        allUniqueMarkets.map(async (market) => {
          const marketsNewOrders = await this.orderRepo.find({
            where: { status: Order_status.NEW, user_id: market.id },
          });

          const orderTotalPrice = marketsNewOrders.reduce(
            (sum, order) => sum + order.total_price,
            0,
          );

          return {
            market,
            length: marketsNewOrders.length,
            orderTotalPrice,
          };
        }),
      );

      return successRes(todaysOrdersInfos, 200, 'Markets with new orders');
    } catch (error) {
      return catchError(error);
    }
  }

  async myNewOrders(
    user: JwtPayload,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      // Operator uchun market_id ni olish
      let effectiveUserId = user.id;
      if (user.role === Roles.OPERATOR) {
        const operatorUser = await this.userRepo.findOne({
          where: { id: user.id, role: Roles.OPERATOR },
        });
        if (!operatorUser?.market_id) {
          return successRes(
            { data: [], total: 0, page, limit, totalPages: 0 },
            200,
            'No orders',
          );
        }
        effectiveUserId = operatorUser.market_id;
      }

      const query = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('order.market', 'market')
        .leftJoinAndSelect('order.district', 'orderDistrict')
        .leftJoinAndSelect('orderDistrict.region', 'orderRegion')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region.name')
        .where('order.status = :status', { status: Order_status.NEW })
        .andWhere('order.user_id = :userId', { userId: effectiveUserId });

      if (search) {
        query.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search OR CAST("order".order_number AS TEXT) ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      const [orders, total] = await query
        .orderBy('order.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return successRes(
        {
          data: orders,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        200,
        'My new orders',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async newOrdersByMarketId(
    id: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const market = await this.userRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }

      const query = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('order.district', 'orderDistrict')
        .leftJoinAndSelect('orderDistrict.region', 'orderRegion')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .where('order.user_id = :id', { id })
        .andWhere('order.status = :status', { status: Order_status.NEW });

      if (search) {
        query.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search OR CAST("order".order_number AS TEXT) ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      const [orders, total] = await query
        .orderBy('order.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return successRes(
        {
          data: orders,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          market_tariff_home: market.tariff_home,
          market_tariff_center: market.tariff_center,
        },
        200,
        `${market.name}'s new Orders`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string, user?: JwtPayload) {
    try {
      const newOrder = await this.orderRepo.findOne({
        where: { id },
        relations: [
          'items',
          'items.product',
          'market',
          'customer',
          'post',
          'post.courier',
          'district',
          // Almashtirish: eski (almashtirilayotgan) buyurtma to'liq ma'lumoti
          'replacementOf',
          'replacementOf.items',
          'replacementOf.items.product',
          'replacementOf.customer',
        ],
      });

      if (!newOrder) {
        throw new NotFoundException('Order not found');
      }

      // Kurier faqat o'ziga biriktirilgan buyurtma detalini ko'ra oladi.
      // Admin/operator/registrator uchun cheklov yo'q.
      if (
        user?.role === Roles.COURIER &&
        newOrder.post?.courier_id !== user.id
      ) {
        throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
      }

      // Kurier tariflarini hisoblash
      let max_courier_tariff_home = 0;
      let max_courier_tariff_center = 0;
      let assigned_courier_tariff_home = 0;
      let assigned_courier_tariff_center = 0;

      // Viloyatni aniqlash: post orqali yoki district.assigned_region orqali
      let regionId: string | null = null;
      if (newOrder.post_id) {
        const post = await this.postRepo.findOne({
          where: { id: newOrder.post_id },
        });
        regionId = post?.region_id ?? null;
        // Aniq kurier tayinlangan bo'lsa, shu kurierning tarifini qaytarish
        if (post?.courier_id) {
          const courier = await this.userRepo.findOne({
            where: { id: post.courier_id },
          });
          if (courier) {
            assigned_courier_tariff_home = courier.tariff_home ?? 0;
            assigned_courier_tariff_center = courier.tariff_center ?? 0;
          }
        }
      }
      // Agar post orqali viloyat topilmasa, district.assigned_region dan olish
      if (!regionId && newOrder.district) {
        regionId = newOrder.district.assigned_region ?? null;
      }
      // Viloyatdagi kurierlarning eng yuqori tariflarini hisoblash
      if (regionId) {
        const couriersInRegion = await this.userRepo.find({
          where: { region_id: regionId, role: Roles.COURIER },
        });
        max_courier_tariff_home = Math.max(
          ...couriersInRegion.map((c) => c.tariff_home ?? 0),
          0,
        );
        max_courier_tariff_center = Math.max(
          ...couriersInRegion.map((c) => c.tariff_center ?? 0),
          0,
        );
      }

      // Tariflar maxfiy — rolga qarab tozalanadi (UI'da yashirish yetarli emas,
      // tarmoq javobida ham bo'lmasin):
      //  - market_tariff  → admin/superadmin/market ko'radi
      //  - courier_tariff (va kurier tarif yordamchi maydonlari) →
      //    admin/superadmin/courier ko'radi
      const role = user?.role;
      const isAdminLike = role === Roles.ADMIN || role === Roles.SUPERADMIN;
      const canSeeMarketTariff = isAdminLike || role === Roles.MARKET;
      const canSeeCourierTariff = isAdminLike || role === Roles.COURIER;

      const payload: Record<string, any> = {
        ...newOrder,
        max_courier_tariff_home,
        max_courier_tariff_center,
        assigned_courier_tariff_home,
        assigned_courier_tariff_center,
      };

      if (!canSeeMarketTariff) {
        delete payload.market_tariff;
      }
      if (!canSeeCourierTariff) {
        delete payload.courier_tariff;
        delete payload.max_courier_tariff_home;
        delete payload.max_courier_tariff_center;
        delete payload.assigned_courier_tariff_home;
        delete payload.assigned_courier_tariff_center;
      }

      // Almashtirish: agar bu ESKI (qaytarilayotgan) buyurtma bo'lsa — uni qaysi
      // YANGI buyurtma almashtirayotganini topib biriktiramiz (detalda havola).
      if (newOrder.is_replacement_return) {
        const replacedBy = await this.orderRepo.findOne({
          where: { replacement_of_order_id: id },
          relations: ['customer', 'items', 'items.product'],
        });
        payload.replaced_by_order = replacedBy || null;
      }

      return successRes(payload, 200, 'Order by id');
    } catch (error) {
      return catchError(error);
    }
  }

  async findByQrCode(token: string) {
    try {
      const order = await this.orderRepo.findOne({
        where: { qr_code_token: normalizeQrToken(token) },
        relations: [
          'customer',
          'district',
          'district.region',
          'customer.district',
          'items',
          'items.product',
        ],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      return successRes(order, 200, 'Order by QR code');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateOrder(
    id: string,
    updateOrderDto: UpdateOrderDto,
    user?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const editingOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
      });
      if (!editingOrder) {
        throw new NotFoundException('Order not found');
      }

      // Tahrirdan OLDINGI holat — tracking/audit logda "eski → yangi" ko'rsatish uchun.
      const beforeEdit = {
        where_deliver: editingOrder.where_deliver,
        total_price: editingOrder.total_price,
        comment: editingOrder.comment,
        address: editingOrder.address,
        district_id: editingOrder.district_id,
        market_tariff: editingOrder.market_tariff,
        courier_tariff: editingOrder.courier_tariff,
      };

      // Market uchun qo'shimcha tekshiruvlar
      if (user?.role === Roles.MARKET) {
        // Faqat o'z buyurtmasini tahrirlash
        if (editingOrder.user_id !== user.id) {
          throw new BadRequestException('Bu buyurtma sizga tegishli emas');
        }
        // Market faqat NEW statusdagi buyurtmalarni tahrirlashi mumkin
        if (editingOrder.status !== Order_status.NEW) {
          throw new BadRequestException(
            'Faqat yangi buyurtmalarni tahrirlash mumkin',
          );
        }
        // add_order ruxsatini tekshirish
        const market = await queryRunner.manager.findOne(UserEntity, {
          where: { id: user.id },
        });
        if (!market?.add_order) {
          throw new BadRequestException(
            'Sizga buyurtma tahrirlash ruxsati berilmagan',
          );
        }
      }

      // Operator uchun qo'shimcha tekshiruvlar
      if (user?.role === Roles.OPERATOR) {
        const operatorUser = await queryRunner.manager.findOne(UserEntity, {
          where: { id: user.id, role: Roles.OPERATOR },
        });
        if (!operatorUser?.market_id) {
          throw new BadRequestException('Operator marketga biriktirilmagan');
        }
        // Faqat o'z marketining buyurtmasini tahrirlash
        if (editingOrder.user_id !== operatorUser.market_id) {
          throw new BadRequestException(
            'Bu buyurtma sizning marketingizga tegishli emas',
          );
        }
        // Operator faqat NEW statusdagi buyurtmalarni tahrirlashi mumkin
        if (editingOrder.status !== Order_status.NEW) {
          throw new BadRequestException(
            'Faqat yangi buyurtmalarni tahrirlash mumkin',
          );
        }
        // add_order ruxsatini tekshirish
        const market = await queryRunner.manager.findOne(UserEntity, {
          where: { id: operatorUser.market_id },
        });
        if (!market?.add_order) {
          throw new BadRequestException(
            'Marketga buyurtma tahrirlash ruxsati berilmagan',
          );
        }
      }

      if (
        editingOrder.status === Order_status.NEW ||
        editingOrder.status === Order_status.RECEIVED
      ) {
        let product_quantity = 0;

        // 🟡 1. Update order items (agar kelsa)
        if (
          updateOrderDto.order_item_info &&
          updateOrderDto.order_item_info.length > 0
        ) {
          await queryRunner.manager.delete(OrderItemEntity, {
            orderId: editingOrder.id,
          });

          for (const o_item of updateOrderDto.order_item_info) {
            // Faqat SHU buyurtma marketining (editingOrder.user_id)
            // o'chirilmagan mahsuloti qabul qilinadi (IDOR himoyasi).
            const isExistProduct = await queryRunner.manager.findOne(
              ProductEntity,
              {
                where: {
                  id: o_item.product_id,
                  user_id: editingOrder.user_id,
                  isDeleted: false,
                },
              },
            );
            if (!isExistProduct) {
              throw new NotFoundException(
                `Product not found: ${o_item.product_id}`,
              );
            }

            const newOrderItem = queryRunner.manager.create(OrderItemEntity, {
              productId: o_item.product_id,
              quantity: o_item.quantity,
              orderId: editingOrder.id,
            });
            await queryRunner.manager.save(newOrderItem);
            product_quantity += o_item.quantity;
          }

          editingOrder.product_quantity = product_quantity;
        }

        // 🟡 2. Update basic fields
        if (
          updateOrderDto.where_deliver !== undefined &&
          updateOrderDto.where_deliver !== editingOrder.where_deliver
        ) {
          editingOrder.where_deliver = updateOrderDto.where_deliver;
          // Yetkazib berish joyi o'zgarganda eski custom tariflarni tozalash
          if (updateOrderDto.market_tariff === undefined) {
            editingOrder.market_tariff = null;
          }
          if (updateOrderDto.courier_tariff === undefined) {
            editingOrder.courier_tariff = null;
          }
        }
        if (updateOrderDto.total_price !== undefined) {
          editingOrder.total_price = updateOrderDto.total_price;
        }
        if (updateOrderDto.comment !== undefined) {
          editingOrder.comment = updateOrderDto.comment;
        }
        if (updateOrderDto.address !== undefined) {
          editingOrder.address = updateOrderDto.address;
        }

        // 🟡 2.5. Mijoz ma'lumotlarini yangilash
        if (updateOrderDto.client_name || updateOrderDto.client_phone_number) {
          const customer = await queryRunner.manager.findOne(UserEntity, {
            where: { id: editingOrder.customer_id, role: Roles.CUSTOMER },
          });
          if (customer) {
            if (updateOrderDto.client_name) {
              customer.name = updateOrderDto.client_name;
            }
            if (updateOrderDto.client_phone_number) {
              customer.phone_number = updateOrderDto.client_phone_number;
            }
            await queryRunner.manager.save(customer);
          }
        }

        // 🟡 2.6. District o'zgarganda pochtani ham yangilash
        if (
          updateOrderDto.district_id &&
          updateOrderDto.district_id !== editingOrder.district_id
        ) {
          const newDistrict = await queryRunner.manager.findOne(
            DistrictEntity,
            {
              where: { id: updateOrderDto.district_id },
            },
          );
          if (!newDistrict) {
            throw new NotFoundException('District not found');
          }
          editingOrder.district_id = updateOrderDto.district_id;

          // RECEIVED buyurtma uchun: viloyat o'zgarganda pochtani ham yangilash
          if (
            editingOrder.status === Order_status.RECEIVED &&
            editingOrder.post_id
          ) {
            const oldPost = await queryRunner.manager.findOne(PostEntity, {
              where: { id: editingOrder.post_id },
            });

            if (oldPost && oldPost.region_id !== newDistrict.assigned_region) {
              // Yangi viloyat uchun NEW post topish yoki yaratish
              let newPost = await queryRunner.manager.findOne(PostEntity, {
                where: {
                  region_id: newDistrict.assigned_region,
                  status: Post_status.NEW,
                },
              });
              if (!newPost) {
                newPost = queryRunner.manager.create(PostEntity, {
                  region_id: newDistrict.assigned_region,
                  qr_code_token: generateCustomToken(),
                  post_total_price: 0,
                  order_quantity: 0,
                  status: Post_status.NEW,
                });
                await queryRunner.manager.save(newPost);
              }

              // Eski post statistikasini kamaytirish
              oldPost.post_total_price =
                Number(oldPost.post_total_price ?? 0) -
                Number(editingOrder.total_price ?? 0);
              oldPost.order_quantity = Math.max(
                Number(oldPost.order_quantity ?? 0) - 1,
                0,
              );
              await queryRunner.manager.save(oldPost);

              // Yangi post statistikasini oshirish
              newPost.post_total_price =
                Number(newPost.post_total_price ?? 0) +
                Number(editingOrder.total_price ?? 0);
              newPost.order_quantity = Number(newPost.order_quantity ?? 0) + 1;
              await queryRunner.manager.save(newPost);

              // Buyurtmaga yangi post tayinlash
              editingOrder.post_id = newPost.id;
            }
          }
        }

        // 🟡 3. Yetkazib berish tariflarini o'zgartirish (admin/superadmin/registrator)
        if (
          user?.role === Roles.ADMIN ||
          user?.role === Roles.SUPERADMIN ||
          user?.role === Roles.REGISTRATOR
        ) {
          if (
            updateOrderDto.market_tariff !== undefined ||
            updateOrderDto.courier_tariff !== undefined
          ) {
            // Market standart tarifini olish
            const market = await queryRunner.manager.findOne(UserEntity, {
              where: { id: editingOrder.user_id },
            });
            const whereDeliver =
              updateOrderDto.where_deliver ?? editingOrder.where_deliver;
            const marketStandardTariff =
              whereDeliver === Where_deliver.CENTER
                ? (market?.tariff_center ?? 0)
                : (market?.tariff_home ?? 0);

            const effectiveMarket =
              updateOrderDto.market_tariff ?? editingOrder.market_tariff;
            const effectiveCourier =
              updateOrderDto.courier_tariff ?? editingOrder.courier_tariff;

            // Pochta tarifi market standart tarifidan kam bo'lmasligi kerak
            if (
              effectiveMarket != null &&
              effectiveMarket < marketStandardTariff
            ) {
              throw new BadRequestException(
                `Pochta tarifi standart tarifdan (${marketStandardTariff.toLocaleString()} so'm) kam bo'lishi mumkin emas`,
              );
            }

            // Kurier tarifi: NEW/RECEIVED da viloyatdagi kurierlarning eng yuqori tarifidan tekshirish
            if (effectiveCourier != null) {
              // Viloyatni aniqlash: post orqali yoki district.assigned_region orqali
              let regionId: string | null = null;
              if (editingOrder.post_id) {
                const post = await queryRunner.manager.findOne(PostEntity, {
                  where: { id: editingOrder.post_id },
                });
                regionId = post?.region_id ?? null;
              }
              if (!regionId && editingOrder.district_id) {
                const district = await queryRunner.manager.findOne(
                  DistrictEntity,
                  {
                    where: { id: editingOrder.district_id },
                  },
                );
                regionId = district?.assigned_region ?? null;
              }
              if (regionId) {
                const couriersInRegion = await queryRunner.manager.find(
                  UserEntity,
                  {
                    where: { region_id: regionId, role: Roles.COURIER },
                  },
                );
                const maxCourierTariff = Math.max(
                  ...couriersInRegion.map((c) =>
                    whereDeliver === Where_deliver.CENTER
                      ? (c.tariff_center ?? 0)
                      : (c.tariff_home ?? 0),
                  ),
                  0,
                );
                if (effectiveCourier < maxCourierTariff) {
                  throw new BadRequestException(
                    `Kurier tarifi shu viloyatdagi kurierlarning tarifidan (${maxCourierTariff.toLocaleString()} so'm) kam bo'lishi mumkin emas`,
                  );
                }
              }
            }

            if (
              effectiveMarket != null &&
              effectiveCourier != null &&
              effectiveMarket < effectiveCourier
            ) {
              throw new BadRequestException(
                "Pochta tarifi kurier tarifidan kam bo'lishi mumkin emas",
              );
            }
          }
          if (updateOrderDto.market_tariff !== undefined) {
            editingOrder.market_tariff = updateOrderDto.market_tariff;
          }
          if (updateOrderDto.courier_tariff !== undefined) {
            editingOrder.courier_tariff = updateOrderDto.courier_tariff;
          }
        }

        await queryRunner.manager.save(editingOrder);

        await queryRunner.commitTransaction();
        // Tracking/audit uchun "eski → yangi" diff: faqat haqiqatan o'zgargan maydonlar.
        const afterEdit = {
          where_deliver: editingOrder.where_deliver,
          total_price: editingOrder.total_price,
          comment: editingOrder.comment,
          address: editingOrder.address,
          district_id: editingOrder.district_id,
          market_tariff: editingOrder.market_tariff,
          courier_tariff: editingOrder.courier_tariff,
        };
        const oldChanged: Record<string, any> = {};
        const newChanged: Record<string, any> = { order_number: editingOrder.order_number };
        for (const key of Object.keys(afterEdit)) {
          if (
            JSON.stringify((beforeEdit as any)[key]) !==
            JSON.stringify((afterEdit as any)[key])
          ) {
            oldChanged[key] = (beforeEdit as any)[key];
            newChanged[key] = (afterEdit as any)[key];
          }
        }
        // Mahsulotlar o'zgartirilgan bo'lsa — alohida belgilaymiz.
        if (updateOrderDto.order_item_info !== undefined) {
          newChanged.items_changed = true;
        }
        this.activityLog.log({
          entity_type: 'order',
          entity_id: id,
          action: 'updated',
          old_value: oldChanged,
          new_value: newChanged,
          description: `Buyurtma #${editingOrder.order_number} tahrirlandi`,
          user,
        });
        return successRes(editingOrder, 200, 'Order updated');
      } else if (
        (user?.role === Roles.ADMIN ||
          user?.role === Roles.SUPERADMIN ||
          user?.role === Roles.REGISTRATOR) &&
        (updateOrderDto.market_tariff !== undefined ||
          updateOrderDto.courier_tariff !== undefined)
      ) {
        // ON_THE_ROAD, WAITING statuslarda ham tarifni o'zgartirish mumkin
        const market = await queryRunner.manager.findOne(UserEntity, {
          where: { id: editingOrder.user_id },
        });
        const whereDeliver = editingOrder.where_deliver;
        const marketStandardTariff =
          whereDeliver === Where_deliver.CENTER
            ? (market?.tariff_center ?? 0)
            : (market?.tariff_home ?? 0);

        if (updateOrderDto.market_tariff !== undefined) {
          if (updateOrderDto.market_tariff < marketStandardTariff) {
            throw new BadRequestException(
              `Pochta tarifi standart tarifdan (${marketStandardTariff.toLocaleString()} so'm) kam bo'lishi mumkin emas`,
            );
          }
          editingOrder.market_tariff = updateOrderDto.market_tariff;
        }
        if (updateOrderDto.courier_tariff !== undefined) {
          // Yo'lda bo'lsa — aniq kurierning tarifidan tekshirish
          if (editingOrder.post_id) {
            const post = await queryRunner.manager.findOne(PostEntity, {
              where: { id: editingOrder.post_id },
            });
            if (
              post?.courier_id &&
              editingOrder.status === Order_status.ON_THE_ROAD
            ) {
              // Aniq kurier tayinlangan — shu kurierning tarifidan tekshirish
              const courier = await queryRunner.manager.findOne(UserEntity, {
                where: { id: post.courier_id },
              });
              if (courier) {
                const courierTariff =
                  whereDeliver === Where_deliver.CENTER
                    ? (courier.tariff_center ?? 0)
                    : (courier.tariff_home ?? 0);
                if (updateOrderDto.courier_tariff < courierTariff) {
                  throw new BadRequestException(
                    `Kurier tarifi tayinlangan kurier tarifidan (${courierTariff.toLocaleString()} so'm) kam bo'lishi mumkin emas`,
                  );
                }
              }
            } else if (post?.region_id) {
              // Yangi yoki qabul qilingan — viloyatdagi kurierlarning eng yuqori tarifidan tekshirish
              const couriersInRegion = await queryRunner.manager.find(
                UserEntity,
                {
                  where: { region_id: post.region_id, role: Roles.COURIER },
                },
              );
              const maxCourierTariff = Math.max(
                ...couriersInRegion.map((c) =>
                  whereDeliver === Where_deliver.CENTER
                    ? (c.tariff_center ?? 0)
                    : (c.tariff_home ?? 0),
                ),
                0,
              );
              if (updateOrderDto.courier_tariff < maxCourierTariff) {
                throw new BadRequestException(
                  `Kurier tarifi shu viloyatdagi kurierlarning tarifidan (${maxCourierTariff.toLocaleString()} so'm) kam bo'lishi mumkin emas`,
                );
              }
            }
          }
          editingOrder.courier_tariff = updateOrderDto.courier_tariff;
        }
        // Pochta tarifi kurier tarifidan kam bo'lmasligi kerak
        const finalMarket = editingOrder.market_tariff;
        const finalCourier = editingOrder.courier_tariff;
        if (
          finalMarket != null &&
          finalCourier != null &&
          finalMarket < finalCourier
        ) {
          throw new BadRequestException(
            "Pochta tarifi kurier tarifidan kam bo'lishi mumkin emas",
          );
        }

        await queryRunner.manager.save(editingOrder);

        await queryRunner.commitTransaction();
        this.activityLog.log({
          entity_type: 'order',
          entity_id: id,
          action: 'updated',
          new_value: {
            order_number: editingOrder.order_number,
            market_tariff: editingOrder.market_tariff,
            courier_tariff: editingOrder.courier_tariff,
          },
          description: `Buyurtma #${editingOrder.order_number} tarifi yangilandi`,
          user,
        });
        return successRes(editingOrder, 200, 'Order tariff updated');
      } else {
        throw new BadRequestException('You can not edit this order');
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async receiveNewOrders(
    ordersArray: OrdersArrayDto,
    search?: string,
    user?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { order_ids } = ordersArray;

      // this.logger.log(`receiveNewOrders: ${order_ids}`, 'Order service');

      // 1️⃣ Faqat NEW statusdagi orderlarni olish uchun
      const qb = queryRunner.manager
        .createQueryBuilder(OrderEntity, 'order')
        .leftJoinAndSelect('order.customer', 'customer')
        .where('order.id IN (:...ids)', { ids: order_ids })
        .andWhere('order.status = :status', { status: Order_status.NEW });

      if (search) {
        qb.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search OR CAST("order".order_number AS TEXT) ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      const newOrders = await qb.getMany();

      if (newOrders.length === 0) {
        throw new NotFoundException('No orders found!');
      }

      if (order_ids.length !== newOrders.length) {
        throw new BadRequestException(
          'Some orders are not found or not in NEW status',
        );
      }

      // 2️⃣ Kerakli customers, districts va posts
      const customerIds = newOrders.map((o) => o.customer_id);
      const customers = await queryRunner.manager.find(UserEntity, {
        where: { id: In(customerIds), role: Roles.CUSTOMER },
      });
      const customerMap = new Map(customers.map((c) => [c.id, c]));

      // Order dan yoki customer dan district_id olish (order ustunlik qiladi)
      const districtIds = newOrders
        .map((o) => {
          const customer = customerMap.get(o.customer_id);
          return o.district_id || customer?.district_id;
        })
        .filter(Boolean);

      const districts = await queryRunner.manager.find(DistrictEntity, {
        where: { id: In(districtIds) },
      });
      const districtMap = new Map(districts.map((d) => [d.id, d]));

      const regionIds = districts.map((d) => d.assigned_region);
      const existingPosts = await queryRunner.manager.find(PostEntity, {
        where: { region_id: In(regionIds), status: Post_status.NEW },
      });
      const postMap = new Map(existingPosts.map((p) => [p.region_id, p]));

      const newPosts: PostEntity[] = [];
      const postsToUpdate: PostEntity[] = [];

      // 3️⃣ Ordersni postlarga bog'lash
      for (const order of newOrders) {
        const customer = customerMap.get(order.customer_id);
        if (!customer)
          throw new NotFoundException(
            `Customer not found for order ${order.id}`,
          );

        // Order dan yoki customer dan district_id olish (order ustunlik qiladi)
        const orderDistrictId = order.district_id || customer.district_id;
        const district = districtMap.get(orderDistrictId);
        if (!district)
          throw new NotFoundException(
            `District not found for order ${order.id}`,
          );

        let post = postMap.get(district.assigned_region);

        // Yangi post yaratish kerak bo‘lsa
        if (!post) {
          post = queryRunner.manager.create(PostEntity, {
            region_id: district.assigned_region,
            qr_code_token: generateCustomToken(),
            post_total_price: 0,
            order_quantity: 0,
            status: Post_status.NEW,
          });
          await queryRunner.manager.save(post);
          newPosts.push(post);
          postMap.set(district.assigned_region, post);
        }

        // Orderni shu postga bog‘lash
        order.status = Order_status.RECEIVED;
        order.post_id = post.id;
        // this.logger.log(
        //   `order status updated: ${order.status}`,
        //   'Order service',
        // );

        // Statistikalarni vaqtincha yangilash
        post.post_total_price =
          Number(post.post_total_price ?? 0) + Number(order.total_price ?? 0);
        post.order_quantity = Number(post.order_quantity ?? 0) + 1;

        // Agar bu post oldindan mavjud bo‘lsa → keyinroq saqlash uchun update ro‘yxatiga qo‘shamiz
        if (!newPosts.includes(post) && !postsToUpdate.includes(post)) {
          postsToUpdate.push(post);
        }
      }

      // 4️⃣ Avval yangi postlarni saqlash → id generatsiya bo‘ladi
      if (newPosts.length > 0) {
        await queryRunner.manager.save(PostEntity, newPosts);
      }

      // 5️⃣ Ordersni saqlash
      await queryRunner.manager.save(OrderEntity, newOrders);

      // 6️⃣ Mavjud postlarni yangilash
      if (postsToUpdate.length > 0) {
        await queryRunner.manager.save(PostEntity, postsToUpdate);
      }

      await queryRunner.commitTransaction();

      // Har bir buyurtma uchun NEW -> RECEIVED o'tishini loglaymiz, shunda
      // buyurtma tarixida pochtaga biriktirilgani ko'rinadi (avval umuman loglanmasdi).
      for (const o of newOrders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: o.id,
          action: 'status_change',
          old_value: { status: Order_status.NEW },
          new_value: {
            order_number: o.order_number,
            status: Order_status.RECEIVED,
            post_id: o.post_id,
          },
          description: `Buyurtma #${o.order_number} qabul qilindi (pochtaga biriktirildi)`,
          user,
          metadata: { source: 'bulk_receive' },
        });
      }

      await Promise.all(
        newOrders.map((o) => this.orderBotService.syncStatusButton(o.id)),
      );
      return successRes({}, 200, 'Orders received');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async receiveWithScaner(id: string, orderDto: OrderDto, user: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (!orderDto.marketId) {
        throw new BadRequestException('Market id is required');
      }
      // Caps Lock yoki RU layout muammosini bartaraf qilamiz
      const normalizedToken = normalizeQrToken(id);
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: {
          qr_code_token: normalizedToken,
          status: In([Order_status.NEW, Order_status.CANCELLED_SENT]),
          user_id: orderDto.marketId,
        },
      });
      if (!order) {
        throw new NotFoundException('Order not in correct status');
      }
      if (order.status === Order_status.CANCELLED_SENT) {
        order.status = Order_status.CLOSED;
        await queryRunner.manager.save(order);

        await queryRunner.commitTransaction();

        this.activityLog.log({
          entity_type: 'order',
          entity_id: order.id,
          action: 'status_change',
          old_value: { status: Order_status.CANCELLED_SENT },
          new_value: {
            order_number: order.order_number,
            status: Order_status.CLOSED,
            total_price: order.total_price,
          },
          description: `Buyurtma #${order.order_number} QR skaner orqali qabul qilindi va yopildi — ${order.total_price} so'm`,
          user,
          metadata: { source: 'scanner' },
        });

        return successRes({}, 200, 'Order closed');
      }
      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: order.customer_id, role: Roles.CUSTOMER },
        relations: ['district'],
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Order ning o'z district_id sini ishlatish (fallback: customer.district)
      const orderDistrict = order.district_id
        ? await queryRunner.manager.findOne(DistrictEntity, {
            where: { id: order.district_id },
          })
        : customer.district;

      if (!orderDistrict) {
        throw new NotFoundException('District not found for this order');
      }

      let newPost = await queryRunner.manager.findOne(PostEntity, {
        where: {
          region_id: orderDistrict.assigned_region,
          status: Post_status.NEW,
        },
      });
      if (!newPost) {
        newPost = queryRunner.manager.create(PostEntity, {
          region_id: orderDistrict.assigned_region,
          qr_code_token: generateCustomToken(),
          post_total_price: 0,
          order_quantity: 0,
          status: Post_status.NEW,
        });
        await queryRunner.manager.save(newPost);
      }
      order.status = Order_status.RECEIVED;
      order.post_id = newPost.id;
      await queryRunner.manager.save(order);

      newPost.post_total_price =
        Number(newPost.post_total_price) + Number(order.total_price);
      newPost.order_quantity++;
      await queryRunner.manager.save(newPost);

      await queryRunner.commitTransaction();
      await this.orderBotService.syncStatusButton(order.id);

      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'status_change',
        old_value: { status: Order_status.NEW },
        new_value: {
          order_number: order.order_number,
          status: Order_status.RECEIVED,
          total_price: order.total_price,
          post_id: newPost.id,
          region_id: newPost.region_id,
        },
        description: `Buyurtma #${order.order_number} QR skaner orqali qabul qilindi — ${order.total_price} so'm`,
        user,
        metadata: { source: 'scanner' },
      });

      return successRes({}, 200, 'Order received');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async allMarketsOrders(
    user: JwtPayload,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string | string[];
      regionId?: string;
      startDate?: string;
      endDate?: string;
      fetchAll?: boolean | string;
    },
  ) {
    try {
      const { page = 1, search, status, startDate, endDate, regionId } = query;
      const fetchAll =
        query.fetchAll === true || (query.fetchAll as any) === 'true';
      const limit = getSafeLimit(query.limit, fetchAll);

      // Operator uchun market_id ni olish
      let effectiveUserId = user.id;
      if (user.role === Roles.OPERATOR) {
        const operatorUser = await this.userRepo.findOne({
          where: { id: user.id, role: Roles.OPERATOR },
        });
        if (!operatorUser?.market_id) {
          return successRes(
            { data: [], total: 0, page, limit, totalPages: 0 },
            200,
            'No orders',
          );
        }
        effectiveUserId = operatorUser.market_id;
      }

      const qb = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('order.district', 'orderDistrict')
        .leftJoinAndSelect('orderDistrict.region', 'orderRegion')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .where('order.user_id = :userId', { userId: effectiveUserId })
        .orderBy('order.created_at', 'DESC');

      if (!status) {
        qb.andWhere('order.status != :createdStatus', {
          createdStatus: Order_status.CREATED,
        });
      }

      // 🔍 Search by customer name or order ID
      if (search) {
        qb.andWhere(
          '(LOWER(customer.name) LIKE LOWER(:search) OR LOWER(customer.phone_number) LIKE :search OR CAST(order.id AS TEXT) LIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 🎯 Filter by order status
      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        qb.andWhere('order.status IN (:...statuses)', {
          statuses: statusArray,
        });
      }

      // 🌍 Filter by region
      if (regionId) {
        qb.andWhere('region.id = :regionId', { regionId });
      }

      let startMs: number | undefined;
      let endMs: number | undefined;

      if (startDate) {
        startMs = toUzbekistanTimestamp(startDate, false);
      }
      if (endDate) {
        endMs = toUzbekistanTimestamp(endDate, true);
      }

      if (startMs && endMs) {
        qb.andWhere('order.created_at BETWEEN :startDate AND :endDate', {
          startDate: startMs,
          endDate: endMs,
        });
      } else if (startMs) {
        qb.andWhere('order.created_at >= :startDate', { startDate: startMs });
      } else if (endMs) {
        qb.andWhere('order.created_at <= :endDate', { endDate: endMs });
      }

      // 📄 Pagination
      qb.skip((page - 1) * limit).take(limit);

      const [data, total] = await qb.getManyAndCount();

      return successRes(
        {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        200,
        'All market orders fetched successfully',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Kuryer buyurtmalari tab'lari uchun sonlar (badge):
   *  - waiting: kutilayotgan (WAITING)
   *  - cancelled: bekor qilingan (CANCELLED)
   *  - all: "Hammasi" tabidagi kabi (CREATED/NEW/RECEIVED'dan tashqari)
   * Kuryerning o'z postlari ichida sanaladi.
   */
  async allCouriersOrdersCounts(user: JwtPayload) {
    try {
      const allMyPosts = await this.postRepo.find({
        where: { courier_id: user.id },
        select: ['id'],
      });
      const allPostIds = allMyPosts.map((p) => p.id);
      if (!allPostIds.length) {
        return successRes(
          { waiting: 0, all: 0, cancelled: 0 },
          200,
          'No posts',
        );
      }
      const base = () =>
        this.orderRepo
          .createQueryBuilder('o')
          .where('o.post_id IN (:...postIds)', { postIds: allPostIds });

      const waiting = await base()
        .andWhere('o.status = :s', { s: Order_status.WAITING })
        .getCount();
      const cancelled = await base()
        .andWhere('o.status = :s', { s: Order_status.CANCELLED })
        .getCount();
      const all = await base()
        .andWhere('o.status NOT IN (:...excluded)', {
          excluded: [
            Order_status.CREATED,
            Order_status.NEW,
            Order_status.RECEIVED,
          ],
        })
        .getCount();

      return successRes(
        { waiting, all, cancelled },
        200,
        'Courier order counts',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async allCouriersOrders(
    user: JwtPayload,
    query: {
      status?: string | string[];
      search?: string;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      fetchAll?: boolean | string;
      district_id?: string;
      marketId?: string;
      where_deliver?: string;
    },
  ) {
    try {
      const allMyPosts = await this.postRepo.find({
        where: { courier_id: user.id },
      });

      const allPostIds: string[] = allMyPosts.map((post) => post.id);

      if (!allPostIds.length) {
        return successRes([], 200, 'No posts found for this courier');
      }

      // pagination params
      const page = query.page && query.page > 0 ? query.page : 1;
      const fetchAll =
        query.fetchAll === true || (query.fetchAll as any) === 'true';
      const limit = getSafeLimit(query.limit, fetchAll);
      const offset = (page - 1) * limit;

      const qb = this.orderRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('o.market', 'market')
        .leftJoinAndSelect('o.customer', 'customer')
        .leftJoinAndSelect('o.district', 'orderDistrict')
        .leftJoinAndSelect('orderDistrict.region', 'orderRegion')
        .leftJoinAndSelect('customer.district', 'district')
        // Almashtirish: kuryer modalida "eski #X mahsulotini ol" deb ko'rsatish
        .leftJoinAndSelect('o.replacementOf', 'replacementOf')
        .where('o.post_id IN (:...postIds)', { postIds: allPostIds })
        .orderBy('o.created_at', 'DESC')
        .skip(offset)
        .take(limit);

      // status filter
      if (query.status) {
        const statusArray = Array.isArray(query.status)
          ? query.status
          : [query.status];
        qb.andWhere('o.status IN (:...statuses)', { statuses: statusArray });
      } else {
        qb.andWhere('o.status NOT IN (:...excluded)', {
          excluded: [
            Order_status.CREATED,
            Order_status.NEW,
            Order_status.RECEIVED,
          ],
        });
      }

      // search filter
      if (query.search) {
        qb.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search OR CAST(o.order_number AS TEXT) ILIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      // Tuman filtri (kuryer uchun)
      if (query.district_id) {
        qb.andWhere('o.district_id = :districtId', {
          districtId: query.district_id,
        });
      }

      // Market filtri (o.user_id — buyurtmani yaratgan market)
      if (query.marketId) {
        qb.andWhere('o.user_id = :marketId', { marketId: query.marketId });
      }

      // Yetkazish turi (uyga / markazga)
      if (query.where_deliver) {
        qb.andWhere('o.where_deliver = :whereDeliver', {
          whereDeliver: query.where_deliver,
        });
      }

      // ✅ Sana filter
      let startMs: number | undefined;
      let endMs: number | undefined;

      if (query.startDate) {
        startMs = toUzbekistanTimestamp(query.startDate, false);
      }
      if (query.endDate) {
        endMs = toUzbekistanTimestamp(query.endDate, true);
      }

      if (startMs && endMs) {
        qb.andWhere('o.created_at BETWEEN :startDate AND :endDate', {
          startDate: startMs,
          endDate: endMs,
        });
      } else if (startMs) {
        qb.andWhere('o.created_at >= :startDate', { startDate: startMs });
      } else if (endMs) {
        qb.andWhere('o.created_at <= :endDate', { endDate: endMs });
      }

      const [allOrders, total] = await qb.getManyAndCount();

      return successRes(
        {
          data: allOrders,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        200,
        'All my orders',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Buyurtma chaqiruvchi kuryerga tegishliligini tekshiradi.
   * Egalik zanjiri: order.post_id -> post.courier_id === user.id.
   * Faqat biriktirilgan kurier sotuv/bekor/partly amallarini bajara oladi
   * (istisno yo'q — boshqa kurier, hatto admin ham begona buyurtmaga teginolmaydi).
   * `manager` ochiq tranzaksiya/lock ichida ishlash uchun beriladi.
   */
  private async assertCourierOwnsOrder(
    manager: EntityManager,
    order: OrderEntity,
    user: JwtPayload,
  ): Promise<void> {
    const post = order.post_id
      ? await manager.findOne(PostEntity, {
          where: { id: order.post_id },
          select: ['id', 'courier_id'],
        })
      : null;

    // Normal holat: buyurtma posti aynan chaqiruvchi kuryerga biriktirilgan.
    if (post && post.courier_id === user.id) return;

    // LDG istisno: LDG webhook'lari virtual vakil-kuryer (external_provider='ldg')
    // nomidan sotuv/bekor qiladi. Odatda post.courier_id ham aynan shu LDG kuryer
    // bo'ladi (yuqoridagi tekshiruvdan o'tadi). Lekin LDG kuryer qayta bog'langan
    // (rebind) holatda eski buyurtmalar mos kelmasligi mumkin — shuning uchun
    // chaqiruvchi LDG vakil-kuryer bo'lsa egalik tekshiruvini o'tkazib yuboramiz.
    // Bu so'rov faqat mos kelmagan holatda bajariladi (normal oqimga ta'sir yo'q).
    const actor = await manager.findOne(UserEntity, {
      where: { id: user.id },
      select: ['id', 'external_provider'],
    });
    if (actor?.external_provider === 'ldg') return;

    throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
  }

  /**
   * Almashtirish (kafolat-swap): eski (SOTILGAN) buyurtmani SOTUVCHI kuryerning
   * yagona BEKOR (CANCELED) postiga biriktiradi — shunda u mavjud qaytarish reli
   * orqali marketga boradi. STATUS O'ZGARMAYDI (SOLD qoladi; bekor pochta
   * ro'yxatlari canceled_post_id bo'yicha ko'rsatadi, status bo'yicha emas);
   * narx post yig'indisiga QO'SHILMAYDI (puli real sotuvda hisoblangan, qayta
   * sanalmasin); faqat order_quantity +1. Idempotent.
   */
  private async attachReplacementToCanceledPost(
    manager: EntityManager,
    courierId: string,
    oldOrder: OrderEntity,
  ): Promise<void> {
    // Idempotentlik: allaqachon aktiv CANCELED postda bo'lsa qayta biriktirmaymiz
    if (oldOrder.canceled_post_id) {
      const existing = await manager.findOne(PostEntity, {
        where: { id: oldOrder.canceled_post_id, status: Post_status.CANCELED },
        select: ['id'],
      });
      if (existing) return;
    }

    // Bitta kuryer = bitta CANCELED post invarianti (tranzaksiya-darajali lock)
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `canceled_post:${courierId}`,
    ]);

    let canceledPost = await manager.findOne(PostEntity, {
      where: { courier_id: courierId, status: Post_status.CANCELED },
    });
    if (!canceledPost) {
      const courier = await manager.findOne(UserEntity, {
        where: { id: courierId },
        select: ['id', 'region_id'],
      });
      canceledPost = manager.create(PostEntity, {
        courier_id: courierId,
        region_id: courier?.region_id,
        post_total_price: 0,
        order_quantity: 0,
        qr_code_token: generateCustomToken(),
        status: Post_status.CANCELED,
      });
      canceledPost = await manager.save(canceledPost);
    }

    oldOrder.canceled_post_id = canceledPost.id;
    // Faqat dona — narx EMAS (settled revenue qayta sanalmasin)
    canceledPost.order_quantity = (Number(canceledPost.order_quantity) || 0) + 1;
    await manager.save(canceledPost);
  }

  async sellOrder(user: JwtPayload, id: string, sellDto: SellCancelOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const updateCashbox = async (
      cashbox: CashEntity,
      operation: Operation_type,
      amount: number,
      sourceId: string,
      sourceType: Source_type,
      comment: string,
      createdBy: string,
    ) => {
      // Balansni yangilash
      cashbox.balance += operation === Operation_type.INCOME ? amount : -amount;
      await queryRunner.manager.save(cashbox);

      // Tarix yozuvini qo'shish
      const history = queryRunner.manager.create(CashboxHistoryEntity, {
        operation_type: operation,
        cashbox_id: cashbox.id,
        source_id: sourceId,
        source_type: sourceType,
        amount,
        balance_after: cashbox.balance,
        comment,
        created_by: createdBy,
      });
      await queryRunner.manager.save(history);
    };

    try {
      // Pessimistic write lock — ikki marta sotishni bloklaydi
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id, status: Order_status.WAITING },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order)
        throw new NotFoundException('Order not found or not in waiting status');

      // Egalik tekshiruvi: faqat buyurtma biriktirilgan kurier sotishi mumkin
      await this.assertCourierOwnsOrder(queryRunner.manager, order, user);

      // === ALMASHTIRISH (kafolat-swap) GATE ===
      // Almashtirish buyurtmasini sotish uchun kuryer ESKI mahsulotni mijozdan
      // olib, marketga qaytarish uchun olganini tasdiqlashi SHART. Tasdiq
      // (old_item_collected) bo'lmasa — sotuv RAD ETILADI (eski mahsulot
      // yo'qolib ketmasligi uchun). Bulk avto-sotuv bu flagni yubormaydi, shu
      // sababli almashtirishlar bulk'da shu yerda to'xtaydi va faqat bittalab
      // sotuv modalida (kuryer tasdig'i bilan) sotiladi.
      let replacementOldNumber: number | null = null;
      if (order.replacement_of_order_id) {
        if (sellDto.old_item_collected !== true) {
          throw new BadRequestException(
            'Bu almashtirish buyurtmasi. Avval eski mahsulotni mijozdan olib, ' +
              'marketga qaytarish uchun olganingizni tasdiqlang ("Eskisini oldim").',
          );
        }
        const collectedAt = Date.now();
        // Yangi buyurtma: gate holatini OLD_COLLECTED ga o'tkazamiz (pastdagi
        // save(order) bilan saqlanadi).
        order.replacement_state = Replacement_state.OLD_COLLECTED;
        order.old_product_collected_at = collectedAt;
        // ESKI buyurtma: jismoniy qaytarish kuzatuvi uchun belgilaymiz. Statusi
        // (SOTILGAN) va PULI O'ZGARMAYDI — kafolat-swap, reversal YO'Q.
        const oldOrderForSwap = await queryRunner.manager.findOne(OrderEntity, {
          where: { id: order.replacement_of_order_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (oldOrderForSwap) {
          oldOrderForSwap.replacement_state = Replacement_state.OLD_COLLECTED;
          oldOrderForSwap.old_product_collected_at = collectedAt;
          // Eski mahsulotni SOTUVCHI kuryerning BEKOR POCHTASIga biriktiramiz —
          // shunda u qaytarish reli orqali marketga boradi. Status SOTILGAN
          // QOLADI (canceled_post_id bo'yicha ko'rinadi, status bo'yicha emas);
          // narx post yig'indisiga QO'SHILMAYDI (puli allaqachon real sotuvda).
          await this.attachReplacementToCanceledPost(
            queryRunner.manager,
            user.id,
            oldOrderForSwap,
          );
          await queryRunner.manager.save(oldOrderForSwap);
          replacementOldNumber = oldOrderForSwap.order_number;
        }
      }

      const marketId = order.user_id;
      const [market, marketCashbox, courier, courierCashbox] =
        await Promise.all([
          queryRunner.manager.findOne(UserEntity, {
            where: { id: marketId, role: Roles.MARKET },
          }),
          queryRunner.manager.findOne(CashEntity, {
            where: { cashbox_type: Cashbox_type.FOR_MARKET, user_id: marketId },
          }),
          queryRunner.manager.findOne(UserEntity, { where: { id: user.id } }),
          queryRunner.manager.findOne(CashEntity, {
            where: { cashbox_type: Cashbox_type.FOR_COURIER, user_id: user.id },
          }),
        ]);

      if (!market) throw new NotFoundException('Market not found');
      if (!marketCashbox)
        throw new NotFoundException('Market cashbox not found');
      if (!courier) throw new NotFoundException('Courier not found');
      if (!courierCashbox)
        throw new NotFoundException('Courier cashbox not found');

      const marketBalanceBefore = Number(marketCashbox.balance);

      // Agar admin oldindan custom tarif belgilagan bo'lsa, shuni ishlatamiz
      const marketTarif =
        order.market_tariff != null
          ? order.market_tariff
          : order.where_deliver === Where_deliver.CENTER
            ? market.tariff_center
            : market.tariff_home;

      const courierTarif =
        order.courier_tariff != null
          ? order.courier_tariff
          : order.where_deliver === Where_deliver.CENTER
            ? courier.tariff_center
            : courier.tariff_home;

      const finalComment = generateComment(
        order.comment || '',
        sellDto.comment || '',
        sellDto.extraCost || 0,
      );

      let to_be_paid = 0;
      let courier_to_be_paid = 0;

      const price = Number(order.total_price);

      // === CASE 1: 0 so'mlik ===
      if (price === 0) {
        await updateCashbox(
          marketCashbox,
          Operation_type.EXPENSE,
          marketTarif,
          order.id,
          Source_type.SELL,
          '0 so‘mlik mahsulot sotuvi',
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.EXPENSE,
          courierTarif,
          order.id,
          Source_type.SELL,
          '0 so‘mlik mahsulot sotuvi',
          courier.id,
        );
      }
      // === CASE 2: total_price < courierTarif ===
      else if (price < courierTarif) {
        await updateCashbox(
          marketCashbox,
          Operation_type.EXPENSE,
          marketTarif - price,
          order.id,
          Source_type.SELL,
          `${price} so'mlik mahsulot sotuvi`,
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.EXPENSE,
          courierTarif - price,
          order.id,
          Source_type.SELL,
          `${price} so'mlik mahsulot sotuvi`,
          courier.id,
        );
      }
      // === CASE 3: total_price < marketTarif ===
      else if (price < marketTarif) {
        courier_to_be_paid = price - courierTarif;
        await updateCashbox(
          marketCashbox,
          Operation_type.EXPENSE,
          marketTarif - price,
          order.id,
          Source_type.SELL,
          `${price} so'mlik mahsulot sotuvi`,
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.INCOME,
          courier_to_be_paid,
          order.id,
          Source_type.SELL,
          `${price} so'mlik mahsulot sotuvi`,
          courier.id,
        );
      }
      // === CASE 4: Normal case ===
      else {
        to_be_paid = price - marketTarif;
        courier_to_be_paid = price - courierTarif;

        await updateCashbox(
          marketCashbox,
          Operation_type.INCOME,
          to_be_paid,
          order.id,
          Source_type.SELL,
          finalComment,
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.INCOME,
          courier_to_be_paid,
          order.id,
          Source_type.SELL,
          finalComment,
          courier.id,
        );
      }

      const netToBePaid = Math.max(Number(to_be_paid) || 0, 0); // target summa o'zgarmaydi
      const currentPaid = Math.min(
        Math.max(Number(order.paid_amount) || 0, 0),
        netToBePaid,
      );
      const remainingBeforeDebt = netToBePaid - currentPaid;
      const debtBeforeSale =
        marketBalanceBefore < 0 ? Math.abs(marketBalanceBefore) : 0;

      const autoPay = Math.min(remainingBeforeDebt, debtBeforeSale);
      const paidAfter = Math.min(netToBePaid, currentPaid + autoPay);
      const remainingAfter = netToBePaid - paidAfter;

      Object.assign(order, {
        status:
          remainingAfter === 0 && paidAfter > 0
            ? Order_status.PAID
            : paidAfter > 0
              ? Order_status.PARTLY_PAID
              : Order_status.SOLD,
        to_be_paid: netToBePaid,
        paid_amount: paidAfter,
        comment: finalComment,
        sold_at: Date.now(),
        cancelled_at: null,
        return_requested: false,
        // Sotilgan paytdagi tariflarni saqlash (tarix uchun)
        market_tariff: marketTarif,
        courier_tariff: courierTarif,
      });

      await queryRunner.manager.save(order);

      // === Operator earning hisoblash ===
      if (order.operator_id) {
        const operatorUser = await queryRunner.manager.findOne(UserEntity, {
          where: { id: order.operator_id },
        });
        const commVal = Number(operatorUser?.commission_value ?? 0);
        if (operatorUser?.commission_type && commVal > 0) {
          const earningAmount: number =
            operatorUser.commission_type === Commission_type.PERCENT
              ? (order.total_price * commVal) / 100
              : commVal;

          const existing = await queryRunner.manager.findOne(
            OperatorEarningEntity,
            { where: { order_id: order.id } },
          );
          if (existing) {
            existing.amount = earningAmount;
            await queryRunner.manager.save(existing);
          } else {
            const earning = new OperatorEarningEntity();
            earning.operator_id = order.operator_id;
            earning.order_id = order.id;
            earning.market_id = order.user_id;
            earning.amount = earningAmount;
            await queryRunner.manager.save(OperatorEarningEntity, earning);
          }
        }
      }

      // === Extra cost (agar bo'lsa) ===
      // Telefon brauzerdan kelishi mumkin bo'lgan formatlar uchun raqamga aylantirish
      const extraCost = sellDto.extraCost
        ? Number(String(sellDto.extraCost).replace(/[^\d.-]/g, ''))
        : 0;

      if (extraCost > 0) {
        // Uyga yetkaziladigan buyurtmalarda sotishda ortiqcha xarajat yozish mumkin emas
        if (order.where_deliver !== Where_deliver.CENTER) {
          throw new BadRequestException(
            'Uyga yetkaziladigan buyurtmalarda sotishda ortiqcha xarajat yozish mumkin emas',
          );
        }
        // Markazga: ortiqcha xarajat + markaz tarifi <= uy tarifi.
        // Maxsus holat: agar uy va markaz tarifi teng bo'lsa
        // (kuryerda farq belgilanmagan), kuryer o'z xizmat haqqicha
        // (markaz tarifi) ortiqcha xarajat yoza oladi — aks holda
        // bunday kuryerlar umuman extra cost yoza olmasdi.
        const courierHomeTarif = courier.tariff_home;
        const diff = courierHomeTarif - courierTarif;
        const maxExtraCost = diff > 0 ? diff : Math.max(0, courierTarif);
        if (extraCost > maxExtraCost) {
          throw new BadRequestException(
            `Ortiqcha xarajat maksimal ${maxExtraCost.toLocaleString('uz-UZ')} so'm bo'lishi mumkin (yetkazish tarifi: ${courierTarif.toLocaleString('uz-UZ')}, uy tarifi: ${courierHomeTarif.toLocaleString('uz-UZ')})`,
          );
        }
        await Promise.all([
          updateCashbox(
            marketCashbox,
            Operation_type.EXPENSE,
            extraCost,
            order.id,
            Source_type.EXTRA_COST,
            finalComment,
            courier.id,
          ),
          updateCashbox(
            courierCashbox,
            Operation_type.EXPENSE,
            extraCost,
            order.id,
            Source_type.EXTRA_COST,
            finalComment,
            courier.id,
          ),
        ]);
      }

      // === MOLIYAVIY TAROZI: pochta foydasi ===
      // NET ta'sir = marketTarif - courierTarif (pochta foydasi)
      const sellProfit = marketTarif - courierTarif;
      if (sellProfit !== 0) {
        const balanceBefore = await calculateFinancialBalance(
          queryRunner.manager,
        );
        // sell profit allaqachon cashbox balanslarida aks etgan, shuning uchun balance_after = balanceBefore
        // Aslida sell paytida courier va market cashboxlar o'zgargani uchun profit allaqachon hisobga olingan
        const balanceAfter = balanceBefore;

        await queryRunner.manager.save(
          queryRunner.manager.create(FinancialBalanceHistoryEntity, {
            amount: sellProfit,
            balance_before: balanceAfter - sellProfit,
            balance_after: balanceAfter,
            source_type: FinancialSource_type.SELL_PROFIT,
            order_id: order.id,
            related_user_id: marketId,
            comment: `Buyurtma #${order.order_number} — pochta foydasi: ${sellProfit} so'm`,
            created_by: user.id,
          }),
        );
      }

      await queryRunner.commitTransaction();

      // Activity log
      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'sold',
        old_value: { status: Order_status.WAITING },
        new_value: {
          order_number: order.order_number,
          status: order.status,
          total_price: order.total_price,
          paid_amount: order.paid_amount,
        },
        description: `Buyurtma #${order.order_number} sotildi — ${order.total_price} so'm (${orderStatusUz(order.status)})`,
        user,
      });

      await this.orderBotService.syncStatusButton(order.id);

      // Tashqi integratsiya bilan sinxronlash (async, kurierga halaqit bermaydi)
      // Agar order PAID yoki PARTLY_PAID bo'lsa 'paid' action, aks holda 'sold'
      const syncAction = [Order_status.PAID, Order_status.PARTLY_PAID].includes(
        order.status,
      )
        ? 'paid'
        : 'sold';
      this.integrationSyncService.queueStatusSync(
        order.id,
        syncAction,
        Order_status.WAITING,
        order.status,
      );

      // Almashtirish (kafolat-swap): market'ni "eski mahsulot qaytmoqda" deb
      // xabardor qilamiz. Commit'dan KEYIN va try/catch ichida — Telegram xatosi
      // sotuvga ta'sir qilmaydi. Alohida RETURN guruh talab qilmaslik uchun
      // market'ning mavjud CANCEL guruhiga yuboramiz.
      if (order.replacement_of_order_id) {
        try {
          const returnGroup = await this.dataSource
            .getRepository(TelegramEntity)
            .findOne({
              where: { market_id: order.user_id, group_type: Group_type.CANCEL },
            });
          await this.botService.sendMessageToGroup(
            returnGroup?.group_id || null,
            `*🔄 Almashtirish — mahsulot qaytmoqda!*\n\n` +
              (replacementOldNumber != null
                ? `📦 Eski buyurtma *#${replacementOldNumber}* mahsuloti mijozdan olindi va sizga (marketga) qaytarilmoqda.\n`
                : `📦 Eski mahsulot mijozdan olindi va sizga (marketga) qaytarilmoqda.\n`) +
              `🆕 Yangi buyurtma *#${order.order_number}* mijozga topshirildi.\n` +
              `🚚 *Kuryer:* ${courier?.name || '-'}\n` +
              `📞 *Aloqa:* ${courier?.phone_number || '-'}\n`,
          );
        } catch {}
      }

      return successRes({}, 200, 'Order sold');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async cancelOrder(
    currentUser: JwtPayload,
    id: string,
    cancelOrderDto: SellCancelOrderDto,
    options?: { skipNotification?: boolean },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 1) Pessimistic write lock — relations'siz (PG outer join FOR UPDATE'ni qabul qilmaydi)
      const lockedOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOrder) {
        throw new NotFoundException('Order not found');
      }
      // 2) Relations'ni alohida yuklash (lock allaqachon olingan)
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
        relations: ['items', 'items.product', 'district', 'district.region'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Egalik tekshiruvi: faqat buyurtma biriktirilgan kurier bekor qila oladi
      await this.assertCourierOwnsOrder(queryRunner.manager, order, currentUser);

      // Holat qo'riqlovchisi: allaqachon yakunlangan/moliyaviy hisoblangan
      // buyurtmani qayta bekor qilishga yo'l qo'ymaymiz. Aks holda SOLD buyurtma
      // moliyaviy reversiyasiz CANCELLED bo'lib kassa balansini buzar, yoki
      // CANCELLED_SENT buyurtma canceled_post_id'ni "osilgan" holatda qoldirardi.
      // Ruxsat etilgan boshlang'ich holatlar: CREATED/NEW/RECEIVED/ON_THE_ROAD/WAITING.
      // (LDG avto-bekor va bulk-cancel oqimlari bu holatlardan tashqarisini
      //  allaqachon o'zlari filtrlaydi — shu sababli ular buzilmaydi.)
      const NON_CANCELLABLE_STATUSES: Order_status[] = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
        Order_status.CLOSED,
        Order_status.CANCELLED,
        Order_status.CANCELLED_SENT,
      ];
      if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          `Bu holatdagi buyurtmani bekor qilib bo'lmaydi (status: ${order.status})`,
        );
      }
      const previousStatus = order.status;

      const marketId = order.user_id;
      const [market, courier] = await Promise.all([
        queryRunner.manager.findOne(UserEntity, {
          where: { id: marketId, role: Roles.MARKET },
        }),
        queryRunner.manager.findOne(UserEntity, {
          where: { id: currentUser.id },
        }),
      ]);
      if (!market) {
        throw new NotFoundException('This orders owner is not found');
      }
      if (!courier) {
        throw new NotFoundException('Courier not found');
      }

      const courierTarif =
        order.courier_tariff != null
          ? order.courier_tariff
          : order.where_deliver === Where_deliver.CENTER
            ? courier.tariff_center
            : courier.tariff_home;

      const finalComment = generateComment(
        order.comment,
        cancelOrderDto.comment,
        cancelOrderDto.extraCost,
      );
      // Extra cost ni raqamga aylantirish (telefon brauzerdan kelishi mumkin bo'lgan formatlar uchun)
      const extraCost = cancelOrderDto.extraCost
        ? Number(String(cancelOrderDto.extraCost).replace(/[^\d.-]/g, ''))
        : 0;

      if (extraCost > 0) {
        // Bekor qilishda kuryer o'z xizmat haqqigacha (courier_tariff) ortiqcha
        // xarajat yozishi mumkin — sotuv bilan birga emas, mustaqil qoida.
        // Sotuvda mantiq boshqa: extra + yetkazish ≤ uy tarifi (markaz → uy farqi).
        // Bekor qilishda esa kuryer borib qaytdi, vaqt-yoqilg'i sarfladi —
        // shuning uchun maksimal = o'sha buyurtma uchun belgilangan kuryer tarifi.
        const maxExtraCost = Math.max(0, courierTarif);
        if (extraCost > maxExtraCost) {
          throw new BadRequestException(
            `Ortiqcha xarajat o'z xizmat haqqingizdan (${courierTarif.toLocaleString('uz-UZ')} so'm) oshmasligi kerak. Maksimal: ${maxExtraCost.toLocaleString('uz-UZ')} so'm`,
          );
        }
        const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
          where: { cashbox_type: Cashbox_type.FOR_MARKET, user_id: marketId },
        });
        if (!marketCashbox) {
          throw new NotFoundException('Market cashbox not found');
        }
        const courierCashbox = await queryRunner.manager.findOne(CashEntity, {
          where: {
            cashbox_type: Cashbox_type.FOR_COURIER,
            user_id: currentUser.id,
          },
        });
        if (!courierCashbox) {
          throw new NotFoundException();
        }
        courierCashbox.balance -= extraCost;
        await queryRunner.manager.save(courierCashbox);
        marketCashbox.balance -= extraCost;
        await queryRunner.manager.save(marketCashbox);

        const courierHistory = queryRunner.manager.create(
          CashboxHistoryEntity,
          {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: courierCashbox.id,
            source_type: Source_type.EXTRA_COST,
            source_id: order.id,
            amount: extraCost,
            balance_after: courierCashbox.balance,
            comment: finalComment,
            created_by: currentUser.id,
          },
        );
        await queryRunner.manager.save(courierHistory);

        const marketHistory = queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: marketCashbox.id,
          source_type: Source_type.EXTRA_COST,
          source_id: order.id,
          amount: extraCost,
          balance_after: marketCashbox.balance,
          comment: finalComment,
          created_by: currentUser.id,
        });
        await queryRunner.manager.save(marketHistory);
      }

      Object.assign(order, {
        status: Order_status.CANCELLED,
        comment: finalComment,
        return_requested: false,
        cancelled_at: Date.now(),
      });
      await queryRunner.manager.save(order);

      // Operator earning ni o'chirish (agar sotilgan bo'lib, earning yaratilgan bo'lsa)
      if (order.operator_id) {
        const existingEarning = await queryRunner.manager.findOne(
          OperatorEarningEntity,
          { where: { order_id: order.id } },
        );
        if (existingEarning) {
          await queryRunner.manager.remove(
            OperatorEarningEntity,
            existingEarning,
          );
        }
      }

      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: order.customer_id },
        relations: ['district', 'district.region'],
      });

      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id: order?.post_id || '' },
        relations: ['courier'],
      });

      const telegramGroup = await queryRunner.manager.findOne(TelegramEntity, {
        where: { market_id: marketId, group_type: Group_type.CANCEL || null },
      });

      // Bulk amalda har order uchun alohida xabar yuborilmaydi
      if (!options?.skipNotification) {
        await this.botService.sendMessageToGroup(
          telegramGroup?.group_id || null,
          `*❌ Buyurtma bekor qilindi!*\n\n` +
            `👤 *Mijoz:* ${customer?.name}\n` +
            `📞 *Telefon:* ${customer?.phone_number}\n` +
            `📍 *Manzil:* ${order.district?.region?.name || customer?.district?.region?.name || '-'}, ${order.district?.name || customer?.district?.name || '-'}\n\n` +
            `📦 *Buyurtmalar:*\n${order.items
              .map(
                (item, i) =>
                  `   ${i + 1}. ${item.product.name} — ${item.quantity} dona`,
              )
              .join('\n')}\n\n` +
            `💰 *Narxi:* ${this.formatPrice(order.total_price)} so'm\n` +
            `🕒 *Yaratilgan vaqti:* ${new Date(Number(order.created_at)).toLocaleString('uz-UZ')}\n\n` +
            `🚚 *Kurier:* ${post?.courier?.name || '-'}\n` +
            `📞 *Kurier bilan aloqa:* ${post?.courier?.phone_number || '-'}\n` +
            `👨‍💼 *Operator:* ${order.operator || '-'}\n\n` +
            `📝 *Izoh:* ${order.comment || '-'}\n`,
        );
      }

      await queryRunner.commitTransaction();

      // Activity log
      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'cancelled',
        old_value: { status: previousStatus },
        new_value: {
          order_number: order.order_number,
          status: Order_status.CANCELLED,
          comment: order.comment,
          extra_cost: extraCost || undefined,
        },
        description: `Buyurtma #${order.order_number} bekor qilindi — ${order.total_price} so'm${
          extraCost ? ` (qo'shimcha xarajat: ${extraCost} so'm)` : ''
        }`,
        user: currentUser,
      });

      await this.orderBotService.syncStatusButton(order.id);

      // Tashqi integratsiya bilan sinxronlash (async, kurierga halaqit bermaydi)
      this.integrationSyncService.queueStatusSync(
        order.id,
        'canceled',
        Order_status.WAITING,
        Order_status.CANCELLED,
      );

      return successRes({ id: order.id }, 200, 'Order canceled');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async partlySold(
    user: JwtPayload,
    id: string,
    partlySoldDto: PartlySoldDto,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const updateCashbox = async (
      cashbox: CashEntity,
      operation: Operation_type,
      amount: number,
      sourceId: string,
      sourceType: Source_type,
      comment: string,
      createdBy: string,
    ) => {
      cashbox.balance += operation === Operation_type.INCOME ? amount : -amount;
      await queryRunner.manager.save(cashbox);

      const history = queryRunner.manager.create(CashboxHistoryEntity, {
        operation_type: operation,
        cashbox_id: cashbox.id,
        source_id: sourceId,
        source_type: sourceType,
        amount,
        balance_after: cashbox.balance,
        comment,
        created_by: createdBy,
      });
      await queryRunner.manager.save(history);
    };

    try {
      const { order_item_info, totalPrice, extraCost, comment } = partlySoldDto;

      // 1️⃣ Check order — avval lockni faqat order'ga qo'yamiz (PG FOR UPDATE outer join'ni rad etadi)
      const lockedOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { id, status: Order_status.WAITING },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOrder)
        throw new NotFoundException('Order not found or not in Waiting status');
      // Relations'ni alohida yuklash
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id, status: Order_status.WAITING },
        relations: ['items', 'items.product', 'district', 'district.region'],
      });
      if (!order)
        throw new NotFoundException('Order not found or not in Waiting status');

      // Egalik tekshiruvi: faqat buyurtma biriktirilgan kurier qisman sota oladi
      await this.assertCourierOwnsOrder(queryRunner.manager, order, user);

      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: order.customer_id },
        relations: ['district', 'district.region'],
      });

      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id: order?.post_id || '' },
        relations: ['courier'],
      });

      const marketId = order.user_id;
      // 🔹 Eski total_price ni saqlab olamiz
      const oldTotalPrice = Number(order.total_price);

      // 2️⃣ Load items
      const oldOrderItems = await queryRunner.manager.find(OrderItemEntity, {
        where: { orderId: order.id },
      });

      // 🔹 Eski itemlarning original nusxasi
      const originalOldItems = oldOrderItems.map((i) => ({ ...i }));

      // 3️⃣ Get users & cashboxes
      const [market, marketCashbox, courier, courierCashbox] =
        await Promise.all([
          queryRunner.manager.findOne(UserEntity, {
            where: { id: order.user_id, role: Roles.MARKET },
          }),
          queryRunner.manager.findOne(CashEntity, {
            where: {
              cashbox_type: Cashbox_type.FOR_MARKET,
              user_id: order.user_id,
            },
          }),
          queryRunner.manager.findOne(UserEntity, { where: { id: user.id } }),
          queryRunner.manager.findOne(CashEntity, {
            where: { cashbox_type: Cashbox_type.FOR_COURIER, user_id: user.id },
          }),
        ]);

      if (!market) throw new NotFoundException('Market not found');
      if (!marketCashbox)
        throw new NotFoundException('Market cashbox not found');
      if (!courier) throw new NotFoundException('Courier not found');
      if (!courierCashbox)
        throw new NotFoundException('Courier cashbox not found');

      // 4️⃣ Tariffs (admin oldindan belgilagan bo'lsa, shuni ishlatamiz)
      const marketBalanceBefore = Number(marketCashbox.balance);

      const marketTarif =
        order.market_tariff != null
          ? order.market_tariff
          : order.where_deliver === Where_deliver.CENTER
            ? market.tariff_center
            : market.tariff_home;

      const courierTarif =
        order.courier_tariff != null
          ? order.courier_tariff
          : order.where_deliver === Where_deliver.CENTER
            ? courier.tariff_center
            : courier.tariff_home;

      // 5️⃣ Common vars
      const price = Number(totalPrice);
      let to_be_paid = 0;
      let courier_to_be_paid = 0;

      const finalComment = generateComment(
        order.comment || '',
        comment || '',
        extraCost || 0,
        ['Buyurtma arzonroqqa sotildi!'],
      );

      // 🧩 Jami sonlar solishtiriladi
      const totalOldQty = oldOrderItems.reduce((acc, i) => acc + i.quantity, 0);
      const totalNewQty = order_item_info.reduce(
        (acc, i) => acc + i.quantity,
        0,
      );

      // 6️⃣ Update items (faqat kamaygan holatda)
      if (totalNewQty < totalOldQty) {
        for (const oldItem of oldOrderItems) {
          const dtoItem = order_item_info.find(
            (i) => i.product_id === oldItem.productId,
          );
          if (!dtoItem)
            throw new NotFoundException(
              `Product not found in request: ${oldItem.productId}`,
            );

          // faqat kamaygan bo‘lsa ayiramiz
          if (dtoItem.quantity < oldItem.quantity) {
            oldItem.quantity = dtoItem.quantity;
            await queryRunner.manager.save(oldItem);
          }
        }
      }

      // 7️⃣ Cashbox logikasi (o‘zgarmagan)
      if (price === 0) {
        await updateCashbox(
          marketCashbox,
          Operation_type.EXPENSE,
          marketTarif,
          order.id,
          Source_type.SELL,
          `0 so‘mlik mahsulot qisman sotuvi`,
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.EXPENSE,
          courierTarif,
          order.id,
          Source_type.SELL,
          `0 so‘mlik mahsulot qisman sotuvi`,
          courier.id,
        );
      } else if (price < courierTarif) {
        await updateCashbox(
          marketCashbox,
          Operation_type.EXPENSE,
          marketTarif - price,
          order.id,
          Source_type.SELL,
          `${price} so‘mlik mahsulot qisman sotuvi`,
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.EXPENSE,
          courierTarif - price,
          order.id,
          Source_type.SELL,
          `${price} so‘mlik mahsulot qisman sotuvi`,
          courier.id,
        );
      } else if (price < marketTarif) {
        courier_to_be_paid = price - courierTarif;
        await updateCashbox(
          marketCashbox,
          Operation_type.EXPENSE,
          marketTarif - price,
          order.id,
          Source_type.SELL,
          `${price} so‘mlik mahsulot qisman sotuvi`,
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.INCOME,
          courier_to_be_paid,
          order.id,
          Source_type.SELL,
          `${price} so‘mlik mahsulot qisman sotuvi`,
          courier.id,
        );
      } else {
        to_be_paid = price - marketTarif;
        courier_to_be_paid = price - courierTarif;

        await updateCashbox(
          marketCashbox,
          Operation_type.INCOME,
          to_be_paid,
          order.id,
          Source_type.SELL,
          finalComment,
          courier.id,
        );
        await updateCashbox(
          courierCashbox,
          Operation_type.INCOME,
          courier_to_be_paid,
          order.id,
          Source_type.SELL,
          finalComment,
          courier.id,
        );
      }

      // 8️⃣ Order update
      const netToBePaid = Math.max(Number(to_be_paid) || 0, 0); // target summa o'zgarmaydi
      const currentPaid = Math.min(
        Math.max(Number(order.paid_amount) || 0, 0),
        netToBePaid,
      );
      const remainingBeforeDebt = netToBePaid - currentPaid;
      const debtBeforeSale =
        marketBalanceBefore < 0 ? Math.abs(marketBalanceBefore) : 0;

      const autoPay = Math.min(remainingBeforeDebt, debtBeforeSale);
      const paidAfter = Math.min(netToBePaid, currentPaid + autoPay);
      const remainingAfter = netToBePaid - paidAfter;

      Object.assign(order, {
        status:
          remainingAfter === 0 && paidAfter > 0
            ? Order_status.PAID
            : paidAfter > 0
              ? Order_status.PARTLY_PAID
              : Order_status.SOLD,
        to_be_paid: netToBePaid,
        paid_amount: paidAfter,
        total_price: price,
        // Asl summani saqlaymiz — rollback'da total_price aynan shundan tiklanadi
        // (dona kamaymay faqat narx tushgan holatda "bola" order bo'lmaydi).
        original_total_price: order.original_total_price ?? oldTotalPrice,
        comment: finalComment,
        product_quantity: totalNewQty,
        sold_at: order.sold_at ?? Date.now(),
        cancelled_at: null,
        return_requested: false,
        // Sotilgan paytdagi tariflarni saqlash (tarix uchun)
        market_tariff: order.market_tariff ?? marketTarif,
        courier_tariff: order.courier_tariff ?? courierTarif,
      });
      await queryRunner.manager.save(order);

      // === Operator earning hisoblash (partlySold) ===
      if (order.operator_id) {
        const operatorUserPs = await queryRunner.manager.findOne(UserEntity, {
          where: { id: order.operator_id },
        });
        const commValPs = Number(operatorUserPs?.commission_value ?? 0);
        if (operatorUserPs?.commission_type && commValPs > 0) {
          const earningAmount: number =
            operatorUserPs.commission_type === Commission_type.PERCENT
              ? (price * commValPs) / 100
              : commValPs;

          const existingEarning = await queryRunner.manager.findOne(
            OperatorEarningEntity,
            { where: { order_id: order.id } },
          );
          if (existingEarning) {
            existingEarning.amount = earningAmount;
            await queryRunner.manager.save(existingEarning);
          } else {
            const earning = new OperatorEarningEntity();
            earning.operator_id = order.operator_id;
            earning.order_id = order.id;
            earning.market_id = order.user_id;
            earning.amount = earningAmount;
            await queryRunner.manager.save(OperatorEarningEntity, earning);
          }
        }
      }

      // 9️⃣ Extra cost
      // Telefon brauzerdan kelishi mumkin bo'lgan formatlar uchun raqamga aylantirish
      const parsedExtraCost = extraCost
        ? Number(String(extraCost).replace(/[^\d.-]/g, ''))
        : 0;

      if (parsedExtraCost > 0) {
        await Promise.all([
          updateCashbox(
            marketCashbox,
            Operation_type.EXPENSE,
            parsedExtraCost,
            order.id,
            Source_type.EXTRA_COST,
            finalComment,
            courier.id,
          ),
          updateCashbox(
            courierCashbox,
            Operation_type.EXPENSE,
            parsedExtraCost,
            order.id,
            Source_type.EXTRA_COST,
            finalComment,
            courier.id,
          ),
        ]);
      }

      // === MOLIYAVIY TAROZI: pochta foydasi (sellOrder bilan bir xil) ===
      // Qisman sotuv ham yetkazib berish — pochta foydasi (marketTarif −
      // courierTarif) global moliyaviy balansga yoziladi. Avval bu yo'q edi:
      // partlySold foydani yozmasdi-yu, rollback esa uni ayirardi (balans
      // nomutanosibligi). Endi sellOrder bilan to'liq simmetrik.
      const sellProfitPs = marketTarif - courierTarif;
      if (sellProfitPs !== 0) {
        const balanceBeforePs = await calculateFinancialBalance(
          queryRunner.manager,
        );
        // foyda allaqachon kassa balanslarida aks etgan → balance_after = before
        const balanceAfterPs = balanceBeforePs;
        await queryRunner.manager.save(
          queryRunner.manager.create(FinancialBalanceHistoryEntity, {
            amount: sellProfitPs,
            balance_before: balanceAfterPs - sellProfitPs,
            balance_after: balanceAfterPs,
            source_type: FinancialSource_type.SELL_PROFIT,
            order_id: order.id,
            related_user_id: marketId,
            comment: `Buyurtma #${order.order_number} — qisman sotuv pochta foydasi: ${sellProfitPs} so'm`,
            created_by: user.id,
          }),
        );
      }

      const telegramGroup = await queryRunner.manager.findOne(TelegramEntity, {
        where: { market_id: marketId, group_type: Group_type.CANCEL || null },
      });

      // 🔟 ✅ To‘g‘rilangan cancel order logikasi
      if (totalNewQty < totalOldQty) {
        const cancelledItems = originalOldItems
          .map((oldItem) => {
            const dtoItem = order_item_info.find(
              (i) => i.product_id === oldItem.productId,
            );
            if (!dtoItem) return null;
            const diff = oldItem.quantity - dtoItem.quantity;
            return diff > 0
              ? { productId: oldItem.productId, quantity: diff }
              : null;
          })
          .filter(
            (item): item is { productId: string; quantity: number } =>
              item !== null,
          );

        if (cancelledItems.length > 0) {
          const cancelledQty = cancelledItems.reduce(
            (acc, i) => acc + i.quantity,
            0,
          );

          // 🧮 Eski va yangi total_price farqi — bekor qilingan summa
          const cancelledTotalPrice = oldTotalPrice - Number(price);

          const cancelledOrder = queryRunner.manager.create(OrderEntity, {
            user_id: order.user_id,
            customer_id: order.customer_id,
            comment: 'Qisman bekor qilingan mahsulotlar',
            total_price: cancelledTotalPrice, // ✅ to‘g‘ri qiymat
            to_be_paid: 0,
            where_deliver: order.where_deliver,
            status: Order_status.CANCELLED,
            cancelled_at: Date.now(),
            qr_code_token: generateCustomToken(),
            parent_order_id: id,
            product_quantity: cancelledQty,
            post_id: order.post_id,
          });
          await queryRunner.manager.save(cancelledOrder);

          for (const item of cancelledItems) {
            await queryRunner.manager.save(
              queryRunner.manager.create(OrderItemEntity, {
                productId: item.productId,
                quantity: item.quantity,
                orderId: cancelledOrder.id,
              }),
            );
          }

          const canceled = await queryRunner.manager.findOne(OrderEntity, {
            where: { id: cancelledOrder.id },
            relations: ['items', 'items.product'],
          });

          await this.botService.sendMessageToGroup(
            telegramGroup?.group_id || null,
            `*⚠️❌ Qisman bekor qilindi!*\n\n` +
              `👤 *Mijoz:* ${customer?.name}\n` +
              `📞 *Telefon:* ${customer?.phone_number}\n` +
              `📍 *Manzil:* ${order.district?.region?.name || customer?.district?.region?.name || '-'}, ${order.district?.name || customer?.district?.name || '-'}\n\n` +
              `📦 *Buyurtmalar:*\n${canceled?.items
                .map(
                  (item, i) =>
                    `   ${i + 1}. ${item.product.name} — ${item.quantity} dona`,
                )
                .join('\n')}\n\n` +
              `💰 *Narxi:* ${canceled?.total_price} so‘m\n` +
              `🕒 *Yaratilgan vaqti:* ${new Date(Number(canceled?.created_at)).toLocaleString('uz-UZ')}\n\n` +
              `🚚 *Kurier:* ${post?.courier?.name || '-'}\n` +
              `📞 *Kurier bilan aloqa:* ${post?.courier?.phone_number || '-'}\n` +
              `👨‍💼 *Operator:* ${order.operator || '-'}\n\n` +
              `📝 *Izoh:* ${canceled?.comment || '-'}\n`,
          );
        }
      }

      await this.botService.sendMessageToGroup(
        telegramGroup?.group_id || null,
        `*⚠️ Buyurtma arzonroq sotildi!*\n\n` +
          `👤 *Mijoz:* ${customer?.name}\n` +
          `📞 *Telefon:* ${customer?.phone_number}\n` +
          `📍 *Manzil:* ${order.district?.region?.name || customer?.district?.region?.name || '-'}, ${order.district?.name || customer?.district?.name || '-'}\n\n` +
          `📦 *Buyurtmalar:*\n${order.items
            .map(
              (item, i) =>
                `   ${i + 1}. ${item.product.name} — ${item.quantity} dona`,
            )
            .join('\n')}\n\n` +
          `💰 *Oldingi narxi:* ${oldTotalPrice} so'm\n` +
          `💰 *Sotilgan narxi:* ${order.total_price} so'm\n` +
          `🕒 *Yaratilgan vaqti:* ${new Date(Number(order.created_at)).toLocaleString('uz-UZ')}\n\n` +
          `🚚 *Kurier:* ${post?.courier?.name || '-'}\n` +
          `📞 *Kurier bilan aloqa:* ${post?.courier?.phone_number || '-'}\n` +
          `👨‍💼 *Operator:* ${order.operator || '-'}\n\n` +
          `📝 *Izoh:* ${order.comment || '-'}\n`,
      );

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'partly_sold',
        old_value: { status: Order_status.WAITING },
        new_value: {
          order_number: order.order_number,
          status: order.status,
          total_price: order.total_price,
          paid_amount: order.paid_amount,
        },
        description: `Buyurtma #${order.order_number} qisman sotildi — ${order.total_price} so'm (${orderStatusUz(order.status)})`,
        user,
      });
      await this.orderBotService.syncStatusButton(order.id);

      // Tashqi integratsiya bilan sinxronlash (async, kurierga halaqit bermaydi).
      // PAID/PARTLY_PAID → 'paid', aks holda 'sold' (sellOrder bilan bir xil mantiq).
      const partlySyncAction = [
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ].includes(order.status)
        ? 'paid'
        : 'sold';
      this.integrationSyncService.queueStatusSync(
        order.id,
        partlySyncAction,
        Order_status.WAITING,
        order.status,
      );

      return successRes({}, 200, 'Order qisman sotildi');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Buyurtmaga yozilgan qo'shimcha xarajatni (EXTRA_COST) berilgan kassada
   * IDEMPOTENT tarzda teskari qaytaradi.
   *
   * Eski mantiq `Math.abs(order.updated_at - history.created_at) <= 5000` vaqt
   * oynasiga tayanardi — bu deyarli hech qachon ishlamasdi (har save updated_at'ni
   * surardi), ba'zan esa noto'g'ri ishlardi. Yangi mantiq net-balansga tayanadi:
   *
   *   net = SUM(EXTRA_COST chiqim) − SUM(CORRECTION kirim)   [shu kassa, shu order]
   *
   * net > 0 bo'lsa, aynan o'sha (hali qaytarilmagan) miqdor qaytariladi va
   * CORRECTION kirim yoziladi. Takroriy rollback'da net=0 bo'lib, ikkilamchi
   * qaytarish bo'lmaydi; qayta-bekor qilingach yana qaytarish mumkin bo'ladi.
   * (cashbox_history'da CORRECTION+INCOME yozuvlari faqat shu teskari qaytarish
   *  uchun ishlatiladi — sotuv/bekor farqi reversiyasi esa CORRECTION+EXPENSE.)
   *
   * Qaytarilgan miqdorni (>= 0) qaytaradi.
   */
  private async reverseExtraCostForCashbox(
    queryRunner: QueryRunner,
    orderId: string,
    cashbox: CashEntity,
    user: JwtPayload,
    comment: string,
  ): Promise<number> {
    const appliedRaw = await queryRunner.manager
      .createQueryBuilder(CashboxHistoryEntity, 'h')
      .select('COALESCE(SUM(h.amount), 0)', 'sum')
      .where('h.source_id = :orderId', { orderId })
      .andWhere('h.cashbox_id = :cid', { cid: cashbox.id })
      .andWhere('h.source_type = :st', { st: Source_type.EXTRA_COST })
      .andWhere('h.operation_type = :op', { op: Operation_type.EXPENSE })
      .getRawOne<{ sum: string }>();

    const reversedRaw = await queryRunner.manager
      .createQueryBuilder(CashboxHistoryEntity, 'h')
      .select('COALESCE(SUM(h.amount), 0)', 'sum')
      .where('h.source_id = :orderId', { orderId })
      .andWhere('h.cashbox_id = :cid', { cid: cashbox.id })
      .andWhere('h.source_type = :st', { st: Source_type.CORRECTION })
      .andWhere('h.operation_type = :op', { op: Operation_type.INCOME })
      .getRawOne<{ sum: string }>();

    const applied = Number(appliedRaw?.sum) || 0;
    const reversed = Number(reversedRaw?.sum) || 0;
    const net = applied - reversed;
    if (net <= 0) return 0;

    cashbox.balance += net;
    await queryRunner.manager.save(cashbox);
    await queryRunner.manager.save(
      queryRunner.manager.create(CashboxHistoryEntity, {
        operation_type: Operation_type.INCOME,
        cashbox_id: cashbox.id,
        source_id: orderId,
        source_type: Source_type.CORRECTION,
        amount: net,
        balance_after: cashbox.balance,
        comment,
        created_by: user.id,
      }),
    );
    return net;
  }

  /**
   * Qisman sotilgan buyurtma rollback qilinganda undan ajratilgan "bola"
   * (CANCELLED, parent_order_id=order.id) buyurtmalarni asosiy buyurtmaga QAYTA
   * BIRLASHTIRADI — narx, dona va itemlar tiklanadi, bola order soft-delete
   * qilinadi.
   *
   * Asl narx alohida saqlanmaydi — u parent.total_price + SUM(bola.total_price)
   * orqali to'liq tiklanadi (partlySold: bola.total_price = oldTotalPrice − price).
   *
   * XAVFSIZLIK:
   *  - Faqat status hali CANCELLED bo'lgan bolalar birlashtiriladi. Agar bola
   *    allaqachon pochtaga yuborilgan (CANCELLED_SENT)/yopilgan (CLOSED) bo'lsa —
   *    tegmaymiz (boshqa oqimni buzmaslik uchun).
   *  - Bola HARD delete emas, SOFT delete qilinadi (audit izi saqlanadi,
   *    barcha so'rovlardan avtomatik chiqib ketadi). Item rivojiga tegmaymiz
   *    (ularni hech bir agregatsiya order'siz sanamaydi — tekshirildi).
   *  - Qisman sotuvsiz oddiy buyurtmalarda bola bo'lmaydi → bu funksiya no-op.
   *  - Eski ma'lumotdagi bir nechta bola ham qo'llab-quvvatlanadi.
   *
   * `order` obyektining total_price/product_quantity maydonlari shu yerda
   * o'zgartiriladi, lekin saqlash chaqiruvchidagi `save(order)` ga qoldiriladi.
   * Birlashtirilgan bolalar sonini qaytaradi.
   */
  private async mergePartialChildrenBack(
    queryRunner: QueryRunner,
    order: OrderEntity,
  ): Promise<number> {
    const children = await queryRunner.manager.find(OrderEntity, {
      where: {
        parent_order_id: order.id,
        status: Order_status.CANCELLED,
      },
    });

    let restoredChildPrice = 0;
    let restoredQty = 0;

    // 1) Dona kamaytirilgan holat: "bola"(lar)dan itemlar va dona tiklanadi.
    if (children.length) {
      const parentItems = await queryRunner.manager.find(OrderItemEntity, {
        where: { orderId: order.id },
      });
      const parentItemByProduct = new Map<string, OrderItemEntity>();
      for (const it of parentItems) parentItemByProduct.set(it.productId, it);

      for (const child of children) {
        restoredChildPrice += Number(child.total_price) || 0;
        restoredQty += Number(child.product_quantity) || 0;

        const childItems = await queryRunner.manager.find(OrderItemEntity, {
          where: { orderId: child.id },
        });
        for (const ci of childItems) {
          const parentIt = parentItemByProduct.get(ci.productId);
          if (parentIt) {
            parentIt.quantity = Number(parentIt.quantity) + Number(ci.quantity);
            await queryRunner.manager.save(parentIt);
          } else {
            // Ehtiyot chorasi: asosiy buyurtmada bu mahsulot qolmagan bo'lsa
            const recreated = await queryRunner.manager.save(
              queryRunner.manager.create(OrderItemEntity, {
                productId: ci.productId,
                quantity: Number(ci.quantity),
                orderId: order.id,
              }),
            );
            parentItemByProduct.set(ci.productId, recreated);
          }
        }

        // Bola order'ni soft-delete qilamiz (audit saqlanadi, queries chiqaradi)
        await queryRunner.manager.softDelete(OrderEntity, { id: child.id });
      }
    }

    // 2) Narxni tiklash:
    //    - original_total_price MAVJUD bo'lsa (yangi buyurtmalar) — undan aniq
    //      tiklaymiz. Bu HAR IKKI holatni qoplaydi: dona kamaytirilgan ham,
    //      faqat narx tushirilgan ham ("bola"siz discount).
    //    - Aks holda (bu tuzatishdan OLDIN qisman sotilgan eski buyurtma) —
    //      faqat dona kamaytirilgan bo'lsa "bola" summasidan fallback qilamiz.
    if (order.original_total_price != null) {
      order.total_price = Number(order.original_total_price);
    } else if (children.length) {
      order.total_price = (Number(order.total_price) || 0) + restoredChildPrice;
    }
    order.original_total_price = null;
    order.product_quantity =
      (Number(order.product_quantity) || 0) + restoredQty;

    // Tiklash bo'lganini bildirish uchun: bola soni yoki narx tiklangani.
    return children.length;
  }

  async rollbackOrderToWaiting(
    user: JwtPayload,
    id: string,
    dto?: RollbackOrderDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pessimistic write lock — relations'siz (PG outer join'da FOR UPDATE ishlamaydi)
      const lockedOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOrder) throw new NotFoundException('Order not found');
      // Relations'ni alohida yuklash
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
        relations: ['market', 'post'],
      });
      if (!order) throw new NotFoundException('Order not found');

      // Egalik tekshiruvi: kurier faqat o'ziga biriktirilgan buyurtmani
      // qaytara oladi. SUPERADMIN uchun cheklov yo'q.
      if (
        user.role === Roles.COURIER &&
        order.post?.courier_id !== user.id
      ) {
        throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
      }

      if (
        user.role === Roles.COURIER &&
        ![Order_status.SOLD, Order_status.CANCELLED].includes(order.status)
      ) {
        throw new BadRequestException(
          `Rollback mumkin emas (status: ${order.status})`,
        );
      }
      const isSuperAdmin = user.role === Roles.SUPERADMIN;
      if (
        isSuperAdmin &&
        ![
          Order_status.SOLD,
          Order_status.CANCELLED,
          Order_status.CLOSED,
          Order_status.PAID,
          Order_status.PARTLY_PAID,
        ].includes(order.status)
      ) {
        throw new BadRequestException(
          `Rollback mumkin emas (status: ${order.status})`,
        );
      }

      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: order.user_id },
      });
      if (!market) throw new NotFoundException('Market not found');

      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: order.post?.courier_id },
      });
      if (!courier) throw new NotFoundException('Courier not found');

      const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.FOR_MARKET, user_id: market.id },
      });
      if (!marketCashbox)
        throw new NotFoundException('Market cashbox not found');

      const courierCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.FOR_COURIER, user_id: courier.id },
      });
      if (!courierCashbox)
        throw new NotFoundException('Courier cashbox not found');

      const rollbackComment = `[ROLLBACK] ${order.comment || ''}`;

      const marketTarif =
        order.where_deliver === Where_deliver.CENTER
          ? market.tariff_center
          : market.tariff_home;

      const courierTarif =
        order.where_deliver === Where_deliver.CENTER
          ? courier.tariff_center
          : courier.tariff_home;

      // === ROLLBACK FOR SOLD/PAID (courier or superadmin) ===
      if (
        order.status === Order_status.SOLD ||
        order.status === Order_status.PAID
      ) {
        const marketDiff = Number(order.total_price) - Number(marketTarif);
        const courierDiff = Number(order.total_price) - Number(courierTarif);

        // Market kassasidan ayrish
        marketCashbox.balance -= marketDiff;
        await queryRunner.manager.save(marketCashbox);
        await queryRunner.manager.save(
          queryRunner.manager.create(CashboxHistoryEntity, {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: marketCashbox.id,
            source_id: order.id,
            source_type: Source_type.CORRECTION,
            amount: marketDiff,
            balance_after: marketCashbox.balance,
            comment: rollbackComment,
            created_by: user.id,
          }),
        );

        // Courier kassasidan ayrish
        courierCashbox.balance -= courierDiff;
        await queryRunner.manager.save(courierCashbox);
        await queryRunner.manager.save(
          queryRunner.manager.create(CashboxHistoryEntity, {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: courierCashbox.id,
            source_id: order.id,
            source_type: Source_type.CORRECTION,
            amount: courierDiff,
            balance_after: courierCashbox.balance,
            comment: rollbackComment,
            created_by: user.id,
          }),
        );

        // Qo'shimcha xarajat (EXTRA_COST) — IDEMPOTENT teskari qaytarish
        // (eski 5 soniyalik vaqt oynasi o'rniga net-balans bo'yicha).
        await this.reverseExtraCostForCashbox(
          queryRunner,
          order.id,
          marketCashbox,
          user,
          "Qo'shimcha xarajat orqaga qaytarildi",
        );
        await this.reverseExtraCostForCashbox(
          queryRunner,
          order.id,
          courierCashbox,
          user,
          "Qo'shimcha xarajat orqaga qaytarildi",
        );
      }

      // === ROLLBACK FOR PARTLY PAID (superadmin) ===

      if (order.status === Order_status.PARTLY_PAID && isSuperAdmin) {
        const marketDiff = Number(order.paid_amount || 0);
        const courierDiff = Math.max(
          Number(order.total_price) - Number(courierTarif),
          0,
        );

        // Market kassasidan aynan paid_amount miqdorini ayiramiz
        marketCashbox.balance -= marketDiff;
        await queryRunner.manager.save(marketCashbox);
        await queryRunner.manager.save(
          queryRunner.manager.create(CashboxHistoryEntity, {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: marketCashbox.id,
            source_id: order.id,
            source_type: Source_type.CORRECTION,
            amount: marketDiff,
            balance_after: marketCashbox.balance,
            comment: rollbackComment,
            created_by: user.id,
          }),
        );

        // Courier kassasidan sotishda qo'shilgan ulushni ayiramiz
        courierCashbox.balance -= courierDiff;
        await queryRunner.manager.save(courierCashbox);
        await queryRunner.manager.save(
          queryRunner.manager.create(CashboxHistoryEntity, {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: courierCashbox.id,
            source_id: order.id,
            source_type: Source_type.CORRECTION,
            amount: courierDiff,
            balance_after: courierCashbox.balance,
            comment: rollbackComment,
            created_by: user.id,
          }),
        );

        // Qo'shimcha xarajat (EXTRA_COST) — IDEMPOTENT teskari qaytarish
        await this.reverseExtraCostForCashbox(
          queryRunner,
          order.id,
          marketCashbox,
          user,
          "Qo'shimcha xarajat orqaga qaytarildi",
        );
        await this.reverseExtraCostForCashbox(
          queryRunner,
          order.id,
          courierCashbox,
          user,
          "Qo'shimcha xarajat orqaga qaytarildi",
        );
      }

      // === ROLLBACK FOR CANCELLED / CLOSED ===
      // Bekor qilingan/yopilgan buyurtmaga yozilgan qo'shimcha xarajatni
      // IDEMPOTENT (net-balans) tarzda teskari qaytaramiz — har ikki kassa uchun.
      if (
        order.status === Order_status.CANCELLED ||
        order.status === Order_status.CLOSED
      ) {
        const extraReversalComment =
          "Bekor qilingan buyurtmaga yozilgan qo'shimcha xarajat orqaga qaytarildi";
        await this.reverseExtraCostForCashbox(
          queryRunner,
          order.id,
          marketCashbox,
          user,
          extraReversalComment,
        );
        await this.reverseExtraCostForCashbox(
          queryRunner,
          order.id,
          courierCashbox,
          user,
          extraReversalComment,
        );
      }

      // === Operator earning ni o'chirish (rollback) ===
      if (order.operator_id) {
        const existingEarning = await queryRunner.manager.findOne(
          OperatorEarningEntity,
          { where: { order_id: order.id } },
        );
        if (existingEarning) {
          await queryRunner.manager.remove(
            OperatorEarningEntity,
            existingEarning,
          );
        }
      }

      // === Qisman sotuv "bola" buyurtmalarini qayta birlashtirish ===
      // Kassa/extra_cost reversiyasi KAMAYTIRILGAN narx bo'yicha allaqachon
      // bajarildi; endi order entity'sining narxi/dona/itemlarini asl holatiga
      // tiklaymiz va ajratilgan bekor qism bola order'ni soft-delete qilamiz.
      // (Qisman sotilmagan buyurtmalarda bola yo'q → no-op.)
      const mergedChildren = await this.mergePartialChildrenBack(
        queryRunner,
        order,
      );

      // === Update order status ===
      const previousStatus = order.status;
      const targetStatus = dto?.target_status || RollbackTarget.WAITING;

      // Umumiy maydonlarni tozalash
      if (
        isSuperAdmin &&
        [Order_status.PAID, Order_status.PARTLY_PAID].includes(order.status)
      ) {
        order.paid_amount = 0;
        order.sold_at = null;
      } else {
        order.sold_at = null;
        order.to_be_paid = 0;
      }

      if (targetStatus === RollbackTarget.WAITING) {
        order.status = Order_status.WAITING;
        order.cancelled_at = null;
      } else if (targetStatus === RollbackTarget.CANCELLED) {
        order.status = Order_status.CANCELLED;
        order.cancelled_at = Date.now();
      } else if (targetStatus === RollbackTarget.CANCELLED_SENT) {
        // Buyurtmani cancelled pochtaga qo'shish
        if (!order.post?.courier_id) {
          throw new BadRequestException(
            "Bu buyurtmaga kurier tayinlanmagan, pochtaga qo'shib bo'lmaydi",
          );
        }
        const assignedCourier = await queryRunner.manager.findOne(UserEntity, {
          where: { id: order.post.courier_id },
        });
        if (!assignedCourier) {
          throw new BadRequestException('Kurier topilmadi');
        }

        // Shu kurier uchun mavjud cancelled pochta bor-yo'qligini tekshirish
        let canceledPost = await queryRunner.manager.findOne(PostEntity, {
          where: {
            courier_id: assignedCourier.id,
            status: Post_status.CANCELED,
          },
        });

        if (canceledPost) {
          // Mavjud pochtaga qo'shish
          canceledPost.order_quantity = (canceledPost.order_quantity || 0) + 1;
          canceledPost.post_total_price =
            Number(canceledPost.post_total_price || 0) +
            Number(order.total_price);
          await queryRunner.manager.save(canceledPost);
        } else {
          // Yangi cancelled pochta yaratish
          canceledPost = queryRunner.manager.create(PostEntity, {
            courier_id: assignedCourier.id,
            region_id: assignedCourier.region_id,
            post_total_price: Number(order.total_price),
            order_quantity: 1,
            status: Post_status.CANCELED,
            qr_code_token: `CANCEL-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          });
          await queryRunner.manager.save(canceledPost);
        }

        order.canceled_post_id = canceledPost.id;
        order.status = Order_status.CANCELLED_SENT;
        order.cancelled_at = Date.now();
      }

      await queryRunner.manager.save(order);

      // === MOLIYAVIY TAROZI: rollback uchun teskari yozuv ===
      // Faqat shu buyurtma uchun SELL_PROFIT yozuvi MAVJUD bo'lsa teskari
      // qaytaramiz (simmetriya). Aks holda — masalan bu tuzatishdan OLDIN qisman
      // sotilgan eski buyurtma (unda SELL_PROFIT yozilmagan) — balansdan ortiqcha
      // ayirib yubormaymiz. Bu eski ma'lumotlarni xavfsiz qiladi.
      const existingSellProfit = await queryRunner.manager.findOne(
        FinancialBalanceHistoryEntity,
        {
          where: {
            order_id: order.id,
            source_type: FinancialSource_type.SELL_PROFIT,
          },
        },
      );
      const rollbackProfit = -(marketTarif - courierTarif);
      if (
        rollbackProfit !== 0 &&
        existingSellProfit &&
        [
          Order_status.SOLD,
          Order_status.PAID,
          Order_status.PARTLY_PAID,
        ].includes(previousStatus)
      ) {
        const balanceAfter = await calculateFinancialBalance(
          queryRunner.manager,
        );
        await queryRunner.manager.save(
          queryRunner.manager.create(FinancialBalanceHistoryEntity, {
            amount: rollbackProfit,
            balance_before: balanceAfter - rollbackProfit,
            balance_after: balanceAfter,
            source_type: FinancialSource_type.CORRECTION,
            order_id: order.id,
            related_user_id: market.id,
            comment: `[ROLLBACK] Buyurtma #${order.order_number} — pochta foydasi qaytarildi`,
            created_by: user.id,
          }),
        );
      }

      await queryRunner.commitTransaction();
      await this.orderBotService.syncStatusButton(order.id);

      // Activity log
      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'rollback',
        old_value: { status: previousStatus },
        new_value: { order_number: order.order_number, status: order.status },
        description: `Buyurtma #${order.order_number} orqaga qaytarildi: ${orderStatusUz(
          previousStatus,
        )} → ${orderStatusUz(order.status)}${
          mergedChildren > 0
            ? ` (qisman sotuvdan ${mergedChildren} ta bo'lak qayta birlashtirildi)`
            : ''
        }`,
        user,
      });

      // Tashqi integratsiya bilan sinxronlash
      this.integrationSyncService.queueStatusSync(
        order.id,
        'rollback',
        previousStatus,
        order.status,
      );

      const statusMessages: Record<string, string> = {
        [RollbackTarget.WAITING]: 'Order WAITING holatiga qaytarildi',
        [RollbackTarget.CANCELLED]: 'Order CANCELLED holatiga qaytarildi',
        [RollbackTarget.CANCELLED_SENT]:
          "Order bekor qilinib pochtaga qo'shildi",
      };

      return successRes(
        {},
        200,
        statusMessages[targetStatus] || 'Order rollback qilindi',
      );
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw catchError(err);
    } finally {
      await queryRunner.release();
    }
  }

  async getStats(startDate?: string, endDate?: string) {
    try {
      const start = Number(startDate);
      const end = Number(endDate);

      // Bitta optimallashtirilgan SQL query - barcha statistikani oladi
      const statsQuery = await this.orderRepo
        .createQueryBuilder('o')
        .select(
          // Jami = shu davrda YARATILGAN haqiqiy buyurtmalar (market kartasi
          // bilan bir xil ta'rif): draft (CREATED) va partlySold sun'iy
          // bola-orderlari (parent_order_id) chiqarib tashlanadi.
          `COUNT(CASE WHEN o.created_at BETWEEN :start AND :end AND o.status != :createdStatus AND o.parent_order_id IS NULL THEN 1 END)`,
          'acceptedCount',
        )
        .addSelect(
          `COUNT(CASE WHEN o.cancelled_at BETWEEN :start AND :end AND o.status IN (:...cancelledStatuses) THEN 1 END)`,
          'cancelled',
        )
        .addSelect(
          `COUNT(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...soldStatuses) THEN 1 END)`,
          'soldAndPaid',
        )
        .setParameters({
          start,
          end,
          createdStatus: Order_status.CREATED,
          // CANCELLED_SENT (bekor qilinib pochtaga yuborilgan) ham bekor
          // hisoblanadi — aks holda qaytish yo'lida statistikadan yo'qolardi.
          cancelledStatuses: [
            Order_status.CANCELLED,
            Order_status.CANCELLED_SENT,
            Order_status.CLOSED,
          ],
          soldStatuses: [
            Order_status.SOLD,
            Order_status.PAID,
            Order_status.PARTLY_PAID,
          ],
        })
        .getRawOne();

      const acceptedCount = Number(statsQuery?.acceptedCount) || 0;
      const cancelled = Number(statsQuery?.cancelled) || 0;
      const soldAndPaid = Number(statsQuery?.soldAndPaid) || 0;

      // Profit hisoblash - bitta optimallashtirilgan query
      // Saqlangan tariflarni ishlatamiz, agar mavjud bo'lmasa eski usul
      const profitQuery = await this.orderRepo
        .createQueryBuilder('o')
        .select(
          `SUM(
            CASE
              -- Agar saqlangan tariflar mavjud bo'lsa, ularni ishlatamiz
              WHEN o.market_tariff IS NOT NULL AND o.courier_tariff IS NOT NULL THEN
                COALESCE(o.market_tariff, 0) - COALESCE(o.courier_tariff, 0)
              -- Aks holda eski usul (backward compatibility)
              WHEN o.where_deliver = :addressType THEN
                COALESCE(market.tariff_home, 0) - COALESCE(courier.tariff_home, 0)
              ELSE
                COALESCE(market.tariff_center, 0) - COALESCE(courier.tariff_center, 0)
            END
          )`,
          'profit',
        )
        .leftJoin('o.market', 'market')
        .leftJoin('o.post', 'post')
        .leftJoin('post.courier', 'courier')
        .where('o.sold_at BETWEEN :start AND :end', { start, end })
        .andWhere('o.status IN (:...soldStatuses)', {
          soldStatuses: [
            Order_status.SOLD,
            Order_status.PAID,
            Order_status.PARTLY_PAID,
          ],
        })
        .setParameter('addressType', Where_deliver.ADDRESS)
        .getRawOne();

      const profit = Number(profitQuery?.profit) || 0;

      return successRes(
        {
          acceptedCount,
          cancelled,
          soldAndPaid,
          profit,
          from: start,
          to: end,
        },
        200,
        'Overall statistics',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getMarketStats(startDate?: string, endDate?: string) {
    try {
      const start = Number(startDate);
      const end = Number(endDate);

      // 1) totalOrders: shu davrda YARATILGAN haqiqiy buyurtmalar soni per market
      // (market kartasi bilan bir xil ta'rif): draft (CREATED) va partlySold
      // sun'iy bola-orderlari (parent_order_id) chiqarib tashlanadi.
      const totalsRaw = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'user_id')
        .addSelect('COUNT(*)', 'total')
        .where('o.created_at BETWEEN :start AND :end', { start, end })
        .andWhere('o.user_id IS NOT NULL')
        .andWhere('o.status != :createdStatus', {
          createdStatus: Order_status.CREATED,
        })
        .andWhere('o.parent_order_id IS NULL')
        .groupBy('o.user_id')
        .getRawMany();

      // 2) soldOrders: shu davrda SOTILGAN buyurtmalar (qachon yaratilganidan qat'iy nazar)
      const statuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ];

      const soldsRaw = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'user_id')
        .addSelect('COUNT(*)', 'sold')
        .where('o.sold_at BETWEEN :start AND :end', { start, end }) // sotilgan davr
        .andWhere('o.status IN (:...statuses)', { statuses }) // kerakli statuslar
        .andWhere('o.user_id IS NOT NULL')
        .groupBy('o.user_id')
        .getRawMany();

      // 3) Raw natijalarni Map ga aylantirish (fast lookup)
      const totalsMap = new Map<string, number>();
      totalsRaw.forEach((r) => {
        totalsMap.set(String(r.user_id), Number(r.total));
      });

      const soldsMap = new Map<string, number>();
      soldsRaw.forEach((r) => {
        soldsMap.set(String(r.user_id), Number(r.sold));
      });

      // 4) unique market id lar (yaratilgan yoki sotilgan bo'lsa)
      const uniqueMarketIds = Array.from(
        new Set([...totalsMap.keys(), ...soldsMap.keys()]),
      );

      if (uniqueMarketIds.length === 0) {
        return successRes([], 200, 'No markets found in this period');
      }

      // 5) Market ma'lumotlarini olish
      // NOTE: agar user.id UUID bo'lsa, In(...) stringlarni qabul qiladi; agar raqam bo'lsa ham ishlaydi.
      const allUniqueMarkets = await this.userRepo.find({
        where: { id: In(uniqueMarketIds), role: Roles.MARKET },
      });

      // 6) Final statistikani tayyorlash
      const marketWithOrderStats = allUniqueMarkets.map((market) => {
        const totalOrders = totalsMap.get(String(market.id)) ?? 0;
        const soldOrders = soldsMap.get(String(market.id)) ?? 0;
        const sellingRate =
          totalOrders > 0
            ? Number(((soldOrders * 100) / totalOrders).toFixed(2))
            : 0;

        return {
          market,
          totalOrders,
          soldOrders,
          sellingRate,
        };
      });
      // 7) Sort qilish (masalan: sellingRate bo‘yicha kamayish tartibida)
      marketWithOrderStats.sort((a, b) => b.sellingRate - a.sellingRate);

      return successRes(marketWithOrderStats, 200, 'Markets stats');
    } catch (error) {
      return catchError(error);
    }
  }

  async getCourierStats(startDate?: string, endDate?: string) {
    try {
      const start = Number(startDate);
      const end = Number(endDate);

      const validStatuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ];

      // 🔹 1. Tanlangan sana oralig'ida orderlar mavjud bo'lgan postlarni olish
      const recentPosts = await this.postRepo
        .createQueryBuilder('p')
        .innerJoin('p.orders', 'o')
        .where('o.updated_at BETWEEN :start AND :end', { start, end })
        .select(['p.id', 'p.courier_id'])
        .distinct(true)
        .getMany();

      if (recentPosts.length === 0) {
        return successRes([], 200, 'No couriers found in this period');
      }

      const courierMap = new Map<string, string[]>(); // courier_id -> [post_ids]
      for (const p of recentPosts) {
        if (!courierMap.has(p.courier_id)) courierMap.set(p.courier_id, []);
        courierMap.get(p.courier_id)!.push(p.id);
      }

      const courierIds = Array.from(courierMap.keys());
      const allCouriers = await this.userRepo.find({
        where: { id: In(courierIds), role: Roles.COURIER },
      });

      // 🔹 2. Shu postlarga tegishli orderlarni olish (asosiy filtr)
      const orders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.post_id IN (:...postIds)', {
          postIds: recentPosts.map((p) => p.id),
        })
        .andWhere('o.updated_at BETWEEN :start AND :end', { start, end })
        .select(['o.id', 'o.status', 'o.post_id', 'o.sold_at', 'o.created_at'])
        .getMany();

      // 🔹 3. Natijani kuryerlar bo‘yicha guruhlash
      const statsByCourier: Record<number, { total: number; sold: number }> =
        {};

      for (const order of orders) {
        const post = recentPosts.find((p) => p.id === order.post_id);
        if (!post) continue;
        const courierId = post.courier_id;
        if (!statsByCourier[courierId])
          statsByCourier[courierId] = { total: 0, sold: 0 };

        statsByCourier[courierId].total++;
        if (
          validStatuses.includes(order.status) &&
          order.sold_at && // ✅ null emasligini tekshiradi
          order.sold_at >= start &&
          order.sold_at <= end
        ) {
          statsByCourier[courierId].sold++;
        }
      }

      // 🔹 4. Yakuniy natija tuzish
      const courierWithStats = allCouriers.map((courier) => {
        const stats = statsByCourier[courier.id] ?? { total: 0, sold: 0 };
        const successRate =
          stats.total > 0
            ? Number(((stats.sold * 100) / stats.total).toFixed(2))
            : 0;

        return {
          courier,
          totalOrders: stats.total,
          soldOrders: stats.sold,
          successRate,
        };
      });

      courierWithStats.sort((a, b) => b.successRate - a.successRate);

      return successRes(courierWithStats, 200, 'Couriers stats(sorted)');
    } catch (error) {
      return catchError(error);
    }
  }

  async getTopMarkets(limit = 10) {
    try {
      const now = Date.now();
      if (this.topMarketsCache && this.topMarketsCache.expireAt > now) {
        return this.topMarketsCache.data;
      }

      const lastMonth = now - 30 * 24 * 60 * 60 * 1000;

      const result = await this.orderRepo.query(
        `
        SELECT
          u.id as market_id,
          u.name as market_name,
          COUNT(o.id) as total_orders,
          SUM(CASE WHEN o.status IN ('sold', 'paid', 'partly_paid') THEN 1 ELSE 0 END) as successful_orders,
          ROUND(
            (SUM(CASE WHEN o.status IN ('sold', 'paid', 'partly_paid') THEN 1 ELSE 0 END)::decimal
            / NULLIF(COUNT(o.id), 0)) * 100, 2
          ) as success_rate
        FROM "order" o
        INNER JOIN "users" u ON u.id = o.user_id
        WHERE u.role = 'market'
          AND o.created_at >= $1
        GROUP BY u.id
        HAVING COUNT(o.id) >= 30
        ORDER BY success_rate DESC NULLS LAST
        LIMIT $2
        `,
        [lastMonth, limit],
      );

      const response = successRes(result, 200, 'Top Markets (last 30 days)');

      // Cache saqlash
      this.topMarketsCache = {
        data: response,
        expireAt: now + this.CACHE_TTL,
      };

      return response;
    } catch (error) {
      return catchError(error);
    }
  }

  async getTopOperatorsByMarket(user: JwtPayload, limit = 10) {
    try {
      // Market_id ni aniqlash
      let marketId = user.id;
      if (user.role === Roles.OPERATOR) {
        const operatorUser = await this.userRepo.findOne({
          where: { id: user.id, role: Roles.OPERATOR },
        });
        if (operatorUser?.market_id) {
          marketId = operatorUser.market_id;
        }
      }

      const lastMonth = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const result = await this.orderRepo.query(
        `
        SELECT
          u.id as operator_id,
          u.name as operator_name,
          COUNT(o.id) as total_orders,
          SUM(CASE WHEN o.status IN ('sold', 'paid', 'partly_paid') THEN 1 ELSE 0 END) as successful_orders,
          ROUND(
            (SUM(CASE WHEN o.status IN ('sold', 'paid', 'partly_paid') THEN 1 ELSE 0 END)::decimal
            / NULLIF(COUNT(o.id), 0)) * 100, 2
          ) as success_rate
        FROM "order" o
        INNER JOIN "users" u ON u.id = o.operator_id
        WHERE u.role = 'operator'
          AND u.market_id = $1
          AND o.created_at >= $2
        GROUP BY u.id, u.name
        ORDER BY success_rate DESC NULLS LAST
        LIMIT $3
        `,
        [marketId, lastMonth, limit],
      );

      return successRes(result, 200, 'Top Operators (last 30 days)');
    } catch (error) {
      return catchError(error);
    }
  }

  async getTopCouriers(limit = 10) {
    try {
      const now = Date.now();
      if (this.topCouriersCache && this.topCouriersCache.expireAt > now) {
        return this.topCouriersCache.data;
      }

      const lastMonth = now - 30 * 24 * 60 * 60 * 1000;

      const result = await this.orderRepo.query(
        `
        SELECT
          u.id as courier_id,
          u.name as courier_name,
          COUNT(o.id) as total_orders,
          SUM(CASE WHEN o.status IN ('sold', 'paid', 'partly_paid') THEN 1 ELSE 0 END) as successful_orders,
          ROUND(
            (SUM(CASE WHEN o.status IN ('sold', 'paid', 'partly_paid') THEN 1 ELSE 0 END)::decimal
            / NULLIF(COUNT(o.id), 0)) * 100, 2
          ) as success_rate
        FROM "order" o
        INNER JOIN "post" p ON p.id = o.post_id
        INNER JOIN "users" u ON u.id = p.courier_id
        WHERE u.role = 'courier'
          AND o.created_at >= $1
        GROUP BY u.id
        HAVING COUNT(o.id) >= 30
        ORDER BY success_rate DESC NULLS LAST
        LIMIT $2
        `,
        [lastMonth, limit],
      );

      const response = successRes(result, 200, 'Top Couriers (last 30 days)');

      // Cache saqlash
      this.topCouriersCache = {
        data: response,
        expireAt: now + this.CACHE_TTL,
      };

      return response;
    } catch (error) {
      return catchError(error);
    }
  }

  // Daromad statistikasi - kunlik, haftalik, oylik, yillik
  async getRevenueStats(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
    startDate?: string,
    endDate?: string,
  ) {
    try {
      const UZB_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5 (Toshkent vaqti)
      const now = Date.now();
      let start: number;
      let end: number;
      let groupFormat: string;
      let labelFormat: string;

      // Default oraliqlar - Toshkent vaqti bo'yicha
      if (startDate && endDate) {
        // String formatdagi sana keladi (YYYY-MM-DD), Toshkent vaqtiga o'giramiz
        const [startYear, startMonth, startDay] = startDate
          .split('-')
          .map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        // Toshkent vaqtida 00:00:00 va 23:59:59 ni UTC ga o'girish
        start =
          Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) -
          UZB_OFFSET_MS;
        end =
          Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) -
          UZB_OFFSET_MS;
      } else {
        // Toshkent vaqtida hozirgi kunning oxirini olish
        const uzNowMs = now + UZB_OFFSET_MS;
        const uzNow = new Date(uzNowMs);
        const todayYear = uzNow.getUTCFullYear();
        const todayMonth = uzNow.getUTCMonth();
        const todayDay = uzNow.getUTCDate();

        // Bugungi kunning oxiri (23:59:59) Toshkent vaqtida
        end =
          Date.UTC(todayYear, todayMonth, todayDay, 23, 59, 59, 999) -
          UZB_OFFSET_MS;

        switch (period) {
          case 'daily':
            start = end - 30 * 24 * 60 * 60 * 1000; // Oxirgi 30 kun
            break;
          case 'weekly':
            start = end - 12 * 7 * 24 * 60 * 60 * 1000; // Oxirgi 12 hafta
            break;
          case 'monthly':
            start = end - 12 * 30 * 24 * 60 * 60 * 1000; // Oxirgi 12 oy
            break;
          case 'yearly':
            start = end - 5 * 365 * 24 * 60 * 60 * 1000; // Oxirgi 5 yil
            break;
        }
      }

      // SQL formatlar - Toshkent vaqti zonasi bilan (UTC+5)
      // PostgreSQL da timestamp ni Toshkent vaqtiga o'girish
      const tzConvert =
        "TO_TIMESTAMP(o.sold_at / 1000) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'";

      switch (period) {
        case 'daily':
          groupFormat = `TO_CHAR(${tzConvert}, 'YYYY-MM-DD')`;
          labelFormat = 'DD.MM';
          break;
        case 'weekly':
          groupFormat = `TO_CHAR(${tzConvert}, 'IYYY-IW')`;
          labelFormat = 'WW';
          break;
        case 'monthly':
          groupFormat = `TO_CHAR(${tzConvert}, 'YYYY-MM')`;
          labelFormat = 'MM.YYYY';
          break;
        case 'yearly':
          groupFormat = `TO_CHAR(${tzConvert}, 'YYYY')`;
          labelFormat = 'YYYY';
          break;
      }

      const result = await this.orderRepo.query(
        `
        SELECT
          ${groupFormat} as period,
          TO_CHAR(TO_TIMESTAMP(MIN(o.sold_at) / 1000) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent', '${labelFormat}') as label,
          COUNT(o.id) as orders_count,
          COALESCE(SUM(
            CASE
              -- Agar saqlangan tariflar mavjud bo'lsa, ularni ishlatamiz
              WHEN o.market_tariff IS NOT NULL AND o.courier_tariff IS NOT NULL THEN
                COALESCE(o.market_tariff, 0) - COALESCE(o.courier_tariff, 0)
              -- Aks holda eski usul (backward compatibility)
              WHEN o.where_deliver = 'address' THEN
                COALESCE(m.tariff_home, 0) - COALESCE(c.tariff_home, 0)
              ELSE
                COALESCE(m.tariff_center, 0) - COALESCE(c.tariff_center, 0)
            END
          ), 0) as revenue
        FROM "order" o
        LEFT JOIN "users" m ON m.id = o.user_id
        LEFT JOIN "post" p ON p.id = o.post_id
        LEFT JOIN "users" c ON c.id = p.courier_id
        WHERE o.status IN ('sold', 'paid', 'partly_paid')
          AND o.sold_at >= $1
          AND o.sold_at <= $2
          AND o.sold_at IS NOT NULL
        GROUP BY ${groupFormat}
        ORDER BY period ASC
        `,
        [start, end],
      );

      // Ma'lumotni formatlash
      const formattedResult = result.map((item: any) => ({
        period: item.period,
        label: item.label,
        ordersCount: Number(item.orders_count) || 0,
        revenue: Number(item.revenue) || 0,
      }));

      // Jami daromad
      const totalRevenue = formattedResult.reduce(
        (sum: number, item: any) => sum + item.revenue,
        0,
      );
      const totalOrders = formattedResult.reduce(
        (sum: number, item: any) => sum + item.ordersCount,
        0,
      );

      return successRes(
        {
          data: formattedResult,
          summary: {
            totalRevenue,
            totalOrders,
            avgRevenue:
              formattedResult.length > 0
                ? Math.round(totalRevenue / formattedResult.length)
                : 0,
          },
        },
        200,
        `Revenue stats (${period})`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async courierStat(user: JwtPayload, startDate?: string, endDate?: string) {
    try {
      const start = Number(startDate);
      const end = Number(endDate);

      const validStatuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ];

      // Courier ma'lumotlarini olish (tarifflar uchun - fallback)
      const courier = await this.userRepo.findOne({ where: { id: user.id } });
      const tariffHome = Number(courier?.tariff_home ?? 0);
      const tariffCenter = Number(courier?.tariff_center ?? 0);

      // Statistikani olish (profit alohida hisoblanadi)
      const statsResult = await this.orderRepo
        .createQueryBuilder('o')
        // Jami = harakat (davrda sotilgan YOKI bekor qilingan) — harakat modeli
        .select(
          `COUNT(CASE WHEN (o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses)) OR (o.cancelled_at BETWEEN :start AND :end AND o.status IN (:...cancelledStatuses)) THEN 1 END)`,
          'totalOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) THEN 1 END)`,
          'soldOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.cancelled_at BETWEEN :start AND :end AND o.status IN (:...cancelledStatuses) THEN 1 END)`,
          'canceledOrders',
        )
        // Saqlangan tariflar bo'yicha profit (yangi buyurtmalar uchun)
        .addSelect(
          `SUM(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) AND o.courier_tariff IS NOT NULL THEN o.courier_tariff ELSE 0 END)`,
          'savedTariffProfit',
        )
        // Saqlangan tarifsiz buyurtmalar soni (eski buyurtmalar uchun fallback)
        .addSelect(
          `SUM(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) AND o.courier_tariff IS NULL AND o.where_deliver = :addressType THEN 1 ELSE 0 END)`,
          'oldAddressCount',
        )
        .addSelect(
          `SUM(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) AND o.courier_tariff IS NULL AND o.where_deliver != :addressType THEN 1 ELSE 0 END)`,
          'oldCenterCount',
        )
        .innerJoin('o.post', 'post')
        .where('post.courier_id = :courierId', { courierId: user.id })
        .setParameters({
          start,
          end,
          validStatuses,
          cancelledStatuses: [Order_status.CANCELLED, Order_status.CLOSED],
          addressType: Where_deliver.ADDRESS,
        })
        .getRawOne();

      const totalOrders = Number(statsResult?.totalOrders) || 0;
      const soldOrders = Number(statsResult?.soldOrders) || 0;
      const canceledOrders = Number(statsResult?.canceledOrders) || 0;

      // Profit hisoblash - yangi va eski buyurtmalar uchun
      const savedTariffProfit = Number(statsResult?.savedTariffProfit) || 0;
      const oldAddressCount = Number(statsResult?.oldAddressCount) || 0;
      const oldCenterCount = Number(statsResult?.oldCenterCount) || 0;
      const oldOrdersProfit =
        oldAddressCount * tariffHome + oldCenterCount * tariffCenter;
      const profit = savedTariffProfit + oldOrdersProfit;

      const successRate =
        totalOrders > 0
          ? Number(((soldOrders * 100) / totalOrders).toFixed(2))
          : 0;

      return successRes(
        { totalOrders, soldOrders, canceledOrders, profit, successRate },
        200,
        'Couriers stats',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async marketStat(user: JwtPayload, startDate?: string, endDate?: string) {
    try {
      const start = Number(startDate);
      const end = Number(endDate);

      // Operator uchun market_id ni olish
      let effectiveMarketId = user.id;
      if (user.role === Roles.OPERATOR) {
        const operatorUser = await this.userRepo.findOne({
          where: { id: user.id, role: Roles.OPERATOR },
        });
        if (operatorUser?.market_id) {
          effectiveMarketId = operatorUser.market_id;
        }
      }

      const validStatuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ];

      // Har bir ko'rsatkich O'Z sanasi bo'yicha, mustaqil sanaladi:
      //  • Jami (totalOrders)   = shu davrda YARATILGAN haqiqiy buyurtmalar
      //    (created_at). Draft (CREATED) va partlySold sun'iy bola-orderlari
      //    (parent_order_id) CHIQARIB TASHLANADI — ular market qo'ygan buyurtma
      //    emas. Bu market o'zining /orders ro'yxatida ko'radigan ta'rif bilan
      //    bir xil (status != CREATED).
      //  • Sotildi (soldOrders) = shu davrda SOTILGAN (sold_at)
      //  • Bekor (canceledOrders) = shu davrda BEKOR qilingan (cancelled_at)
      // Jami endi "sotildi + bekor" EMAS — u davrda yaratilgan buyurtmalar soni.
      const statsResult = await this.orderRepo
        .createQueryBuilder('o')
        .select(
          `COUNT(CASE WHEN o.created_at BETWEEN :start AND :end AND o.status != :createdStatus AND o.parent_order_id IS NULL THEN 1 END)`,
          'totalOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) THEN 1 END)`,
          'soldOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.cancelled_at BETWEEN :start AND :end AND o.status IN (:...cancelledStatuses) THEN 1 END)`,
          'canceledOrders',
        )
        .addSelect(
          `SUM(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) THEN o.to_be_paid ELSE 0 END)`,
          'profit',
        )
        .where('o.user_id = :marketId', { marketId: effectiveMarketId })
        .setParameters({
          start,
          end,
          validStatuses,
          // CANCELLED_SENT (bekor qilinib pochtaga yuborilgan) ham bekor
          // hisoblanadi — aks holda qaytish yo'lida statistikadan yo'qolardi.
          cancelledStatuses: [
            Order_status.CANCELLED,
            Order_status.CANCELLED_SENT,
            Order_status.CLOSED,
          ],
          createdStatus: Order_status.CREATED,
        })
        .getRawOne();

      const totalOrders = Number(statsResult?.totalOrders) || 0;
      const soldOrders = Number(statsResult?.soldOrders) || 0;
      const canceledOrders = Number(statsResult?.canceledOrders) || 0;
      const profit = Number(statsResult?.profit) || 0;

      const successRate =
        totalOrders > 0
          ? Number(((soldOrders * 100) / totalOrders).toFixed(2))
          : 0;

      return successRes(
        {
          totalOrders,
          soldOrders,
          canceledOrders,
          profit,
          successRate,
        },
        200,
        'Market stats',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string, user?: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Market uchun qo'shimcha tekshiruvlar
      if (user?.role === Roles.MARKET) {
        // Faqat o'z buyurtmasini o'chirish
        if (order.user_id !== user.id) {
          throw new BadRequestException('Bu buyurtma sizga tegishli emas');
        }
        // Market faqat NEW statusdagi buyurtmalarni o'chirishi mumkin
        if (order.status !== Order_status.NEW) {
          throw new BadRequestException(
            "Faqat yangi buyurtmalarni o'chirish mumkin",
          );
        }
        // add_order ruxsatini tekshirish
        const market = await queryRunner.manager.findOne(UserEntity, {
          where: { id: user.id },
        });
        if (!market?.add_order) {
          throw new BadRequestException(
            "Sizga buyurtma o'chirish ruxsati berilmagan",
          );
        }
      }

      // Operator uchun qo'shimcha tekshiruvlar
      if (user?.role === Roles.OPERATOR) {
        const operatorUser = await queryRunner.manager.findOne(UserEntity, {
          where: { id: user.id, role: Roles.OPERATOR },
        });
        if (!operatorUser?.market_id) {
          throw new BadRequestException('Operator marketga biriktirilmagan');
        }
        // Faqat o'z marketining buyurtmasini o'chirish
        if (order.user_id !== operatorUser.market_id) {
          throw new BadRequestException(
            'Bu buyurtma sizning marketingizga tegishli emas',
          );
        }
        // Operator faqat NEW statusdagi buyurtmalarni o'chirishi mumkin
        if (order.status !== Order_status.NEW) {
          throw new BadRequestException(
            "Faqat yangi buyurtmalarni o'chirish mumkin",
          );
        }
        // add_order ruxsatini tekshirish
        const market = await queryRunner.manager.findOne(UserEntity, {
          where: { id: operatorUser.market_id },
        });
        if (!market?.add_order) {
          throw new BadRequestException(
            "Marketga buyurtma o'chirish ruxsati berilmagan",
          );
        }
      }

      const acceptedStatuses = [Order_status.NEW, Order_status.RECEIVED];
      if (!acceptedStatuses.includes(order.status)) {
        throw new BadRequestException('You can not delete...!!!');
      }

      // Activity log — o'chirishdan oldin yozamiz
      this.activityLog.log({
        entity_type: 'order',
        entity_id: id,
        action: 'deleted',
        old_value: {
          order_number: order.order_number,
          status: order.status,
          total_price: order.total_price,
          customer_id: order.customer_id,
        },
        description: `Buyurtma #${order.order_number} o'chirildi — ${order.total_price} so'm (${orderStatusUz(order.status)})`,
        user,
      });

      // Post ID ni olish (oddiy post yoki canceled post)
      const postId = order.post_id || order.canceled_post_id;

      // Orderni soft-delete qilish (deleted_at = NOW). Fizik o'chirilmaydi —
      // moliyaviy audit va activity log uchun saqlanib qoladi.
      await queryRunner.manager.softDelete(OrderEntity, { id });

      // Agar order postga tegishli bo'lsa, postni yangilash
      if (postId) {
        const post = await queryRunner.manager.findOne(PostEntity, {
          where: { id: postId },
        });

        if (post) {
          // Aktiv orderlar (soft-deleted'siz) — post statistikasi uchun
          const remainingOrdersCount = await queryRunner.manager.count(
            OrderEntity,
            {
              where: [{ post_id: postId }, { canceled_post_id: postId }],
            },
          );
          // Hamma orderlar (soft-deleted bilan) — postni o'chirish qarori uchun
          const totalIncludingDeleted = await queryRunner.manager.count(
            OrderEntity,
            {
              where: [{ post_id: postId }, { canceled_post_id: postId }],
              withDeleted: true,
            },
          );

          if (totalIncludingDeleted === 0) {
            // Hech qanday order (soft-deleted ham) qolmagan — postni o'chirish xavfsiz
            await queryRunner.manager.delete(PostEntity, { id: postId });
          } else if (remainingOrdersCount === 0) {
            if (post.status === Post_status.NEW) {
              // Jo'natilmagan (NEW) pochtada aktiv buyurtma qolmadi — bu shunchaki
              // yig'ish "savati", uni saqlashning audit qiymati yo'q (buyurtma
              // auditi order qatori + activity_log'da turadi). O'CHIRAMIZ;
              // soft-deleted buyurtmalar FK (onDelete: SET NULL) orqali ajraladi.
              // Aks holda 0-buyurtmali bo'sh NEW pochta ro'yxatda qolib ketardi.
              await queryRunner.manager.delete(PostEntity, { id: postId });
            } else {
              // Jo'natilgan/qabul qilingan/bekor pochta — soft-deleted'lar bor,
              // audit uchun saqlanadi, faqat 0 ga tushiriladi.
              await queryRunner.manager.update(
                PostEntity,
                { id: postId },
                { order_quantity: 0, post_total_price: 0 },
              );
            }
          } else {
            // Qolgan orderlarning umumiy summasini hisoblash
            const remainingOrders = await queryRunner.manager.find(
              OrderEntity,
              {
                where: [{ post_id: postId }, { canceled_post_id: postId }],
              },
            );

            const newTotalPrice = remainingOrders.reduce(
              (sum, o) => sum + (Number(o.total_price) || 0),
              0,
            );

            // Postni yangilash
            await queryRunner.manager.update(
              PostEntity,
              { id: postId },
              {
                order_quantity: remainingOrdersCount,
                post_total_price: newTotalPrice,
              },
            );
          }
        }
      }

      await queryRunner.commitTransaction();
      return successRes({}, 200, 'Order deleted');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Export orders to Excel with streaming (katta ma'lumotlar uchun)
   * Pagination o'rniga cursor-based streaming ishlatiladi
   */
  async exportOrdersToExcel(
    res: Response,
    filters: {
      status?: string | string[];
      marketId?: string;
      regionId?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    try {
      // Excel workbook yaratish (streaming mode)
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
      });

      const worksheet = workbook.addWorksheet('Orders');

      // Header row
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Buyurtma raqami', key: 'order_number', width: 15 },
        { header: 'Market', key: 'market', width: 20 },
        { header: 'Mijoz ismi', key: 'customer_name', width: 20 },
        { header: 'Telefon', key: 'phone', width: 15 },
        { header: 'Viloyat', key: 'region', width: 15 },
        { header: 'Tuman', key: 'district', width: 15 },
        { header: 'Manzil', key: 'address', width: 25 },
        { header: 'Jami narx', key: 'total_price', width: 15 },
        { header: "To'langan", key: 'paid_amount', width: 15 },
        { header: "To'lanishi kerak", key: 'to_be_paid', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Yaratilgan sana', key: 'created_at', width: 20 },
        { header: 'Kuriyer', key: 'courier', width: 20 },
      ];

      // Header style
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Response headers
      const filename = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      // Cursor-based pagination bilan ma'lumotlarni olish
      const BATCH_SIZE = 500;
      let lastId: string | null = null;
      let hasMore = true;
      let rowNumber = 1;

      while (hasMore) {
        // Query builder
        const qb = this.orderRepo
          .createQueryBuilder('order')
          .leftJoinAndSelect('order.customer', 'customer')
          .leftJoinAndSelect('order.district', 'orderDistrict')
          .leftJoinAndSelect('orderDistrict.region', 'orderRegion')
          .leftJoinAndSelect('customer.district', 'district')
          .leftJoinAndSelect('district.region', 'region')
          .leftJoinAndSelect('order.market', 'market')
          .leftJoinAndSelect('order.post', 'post')
          .leftJoinAndSelect('post.courier', 'courier')
          .orderBy('order.id', 'ASC')
          .take(BATCH_SIZE);

        // Cursor
        if (lastId) {
          qb.andWhere('order.id > :lastId', { lastId });
        }

        // Filters
        if (filters.status) {
          const statusArray = Array.isArray(filters.status)
            ? filters.status
            : [filters.status];
          qb.andWhere('order.status IN (:...statuses)', {
            statuses: statusArray,
          });
        } else {
          qb.andWhere('order.status != :createdStatus', {
            createdStatus: Order_status.CREATED,
          });
        }

        if (filters.marketId) {
          qb.andWhere('order.user_id = :marketId', {
            marketId: filters.marketId,
          });
        }

        if (filters.regionId) {
          qb.andWhere(
            '(orderRegion.id = :regionId OR (orderDistrict.id IS NULL AND region.id = :regionId))',
            { regionId: filters.regionId },
          );
        }

        if (filters.search) {
          qb.andWhere(
            '(customer.name ILIKE :search OR customer.phone_number ILIKE :search OR CAST("order".order_number AS TEXT) ILIKE :search)',
            { search: `%${filters.search}%` },
          );
        }

        // Date filters
        if (filters.startDate) {
          const startMs = toUzbekistanTimestamp(filters.startDate, false);
          qb.andWhere('order.created_at >= :startDate', { startDate: startMs });
        }
        if (filters.endDate) {
          const endMs = toUzbekistanTimestamp(filters.endDate, true);
          qb.andWhere('order.created_at <= :endDate', { endDate: endMs });
        }

        const orders = await qb.getMany();

        if (orders.length === 0) {
          hasMore = false;
          break;
        }

        // Ma'lumotlarni Excel ga yozish
        for (const order of orders) {
          rowNumber++;
          const row = worksheet.addRow({
            id: rowNumber - 1,
            order_number: order.qr_code_token?.slice(-8) || '-',
            market: order.market?.name || '-',
            customer_name: order.customer?.name || '-',
            phone: order.customer?.phone_number || '-',
            region:
              order.district?.region?.name ||
              order.customer?.district?.region?.name ||
              '-',
            district:
              order.district?.name || order.customer?.district?.name || '-',
            address: order.customer?.address || '-',
            total_price: order.total_price || 0,
            paid_amount: order.paid_amount || 0,
            to_be_paid: order.to_be_paid || 0,
            status: order.status,
            created_at: order.created_at
              ? new Date(Number(order.created_at)).toLocaleString('uz-UZ')
              : '-',
            courier: order.post?.courier?.name || '-',
          });

          // Commit row (memory optimization)
          row.commit();
        }

        // Keyingi batch uchun cursor
        lastId = orders[orders.length - 1].id;

        // Agar olingan ma'lumotlar BATCH_SIZE dan kam bo'lsa, boshqa ma'lumot yo'q
        if (orders.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      // Workbook ni yopish va stream'ni tugatish
      await workbook.commit();
    } catch (error) {
      this.logger.error('Excel export error:', error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: 'Excel export failed', error: error.message });
      }
    }
  }

  // Buyurtma manzilini yangilash (faqat buyurtma uchun, mijozga tegmaydi)
  async updateOrderAddress(
    id: string,
    updateOrderAddressDto: UpdateOrderAddressDto,
    user?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Faqat NEW yoki RECEIVED statusdagi orderlarni tahrirlash mumkin
      if (
        order.status !== Order_status.NEW &&
        order.status !== Order_status.RECEIVED
      ) {
        throw new BadRequestException(
          "Bu holatdagi buyurtma manzilini o'zgartirish mumkin emas",
        );
      }

      // District mavjudligini tekshirish
      if (updateOrderAddressDto.district_id) {
        const district = await queryRunner.manager.findOne(DistrictEntity, {
          where: { id: updateOrderAddressDto.district_id },
        });
        if (!district) {
          throw new NotFoundException('District not found');
        }
        order.district_id = updateOrderAddressDto.district_id;

        // RECEIVED buyurtma uchun: viloyat o'zgarganda pochtani ham yangilash
        if (order.status === Order_status.RECEIVED && order.post_id) {
          const oldPost = await queryRunner.manager.findOne(PostEntity, {
            where: { id: order.post_id },
          });

          // Yangi district ning viloyati eski post viloyatidan farq qilsa
          if (oldPost && oldPost.region_id !== district.assigned_region) {
            // Yangi viloyat uchun NEW post topish yoki yaratish
            let newPost = await queryRunner.manager.findOne(PostEntity, {
              where: {
                region_id: district.assigned_region,
                status: Post_status.NEW,
              },
            });
            if (!newPost) {
              newPost = queryRunner.manager.create(PostEntity, {
                region_id: district.assigned_region,
                qr_code_token: generateCustomToken(),
                post_total_price: 0,
                order_quantity: 0,
                status: Post_status.NEW,
              });
              await queryRunner.manager.save(newPost);
            }

            // Eski post statistikasini kamaytirish
            oldPost.post_total_price =
              Number(oldPost.post_total_price ?? 0) -
              Number(order.total_price ?? 0);
            oldPost.order_quantity = Math.max(
              Number(oldPost.order_quantity ?? 0) - 1,
              0,
            );
            await queryRunner.manager.save(oldPost);

            // Yangi post statistikasini oshirish
            newPost.post_total_price =
              Number(newPost.post_total_price ?? 0) +
              Number(order.total_price ?? 0);
            newPost.order_quantity = Number(newPost.order_quantity ?? 0) + 1;
            await queryRunner.manager.save(newPost);

            // Buyurtmaga yangi post tayinlash
            order.post_id = newPost.id;
          }
        }
      }

      if (updateOrderAddressDto.address !== undefined) {
        order.address = updateOrderAddressDto.address;
      }

      // Mijoz ma'lumotlarini yangilash
      if (
        updateOrderAddressDto.client_name ||
        updateOrderAddressDto.client_phone_number
      ) {
        const customer = await queryRunner.manager.findOne(UserEntity, {
          where: { id: order.customer_id, role: Roles.CUSTOMER },
        });
        if (customer) {
          if (updateOrderAddressDto.client_name) {
            customer.name = updateOrderAddressDto.client_name;
          }
          if (updateOrderAddressDto.client_phone_number) {
            customer.phone_number = updateOrderAddressDto.client_phone_number;
          }
          await queryRunner.manager.save(customer);
        }
      }

      await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'updated',
        new_value: {
          order_number: order.order_number,
          district_id: order.district_id,
          address: order.address,
        },
        description: `Buyurtma #${order.order_number} manzili yangilandi`,
        user,
      });

      return successRes(order, 200, 'Order address updated');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Tashqi saytlardan kelgan buyurtmalarni qabul qilish (Universal)
   * Buyurtmalar to'g'ridan-to'g'ri RECEIVED holatida yaratiladi va pochtaga qo'shiladi
   * Field mapping orqali har qanday tashqi API strukturasini qo'llab-quvvatlaydi
   */
  /**
   * Tashqi buyurtma dublikat ekanligini tekshirish
   * Telefon raqami + qr_code bo'yicha bazada mavjud buyurtmani qidiradi
   */
  async checkDuplicateOrder(dto: {
    phone: string;
    qr_code: string;
    integration_id: string;
  }): Promise<object> {
    try {
      const { phone, qr_code, integration_id } = dto;

      // Integratsiya orqali market_id ni olish
      const integration =
        await this.externalIntegrationService.getIntegrationEntity(
          integration_id,
        );

      if (!integration) {
        return successRes({ isDuplicate: false }, 200, 'Integration not found');
      }

      const { market_id } = integration;

      // Telefon raqamni tozalash
      let cleanPhone = phone?.replace(/\D/g, '') || '';
      if (cleanPhone.length === 9) {
        cleanPhone = `998${cleanPhone}`;
      }

      const duplicates: any[] = [];

      // 1. qr_code (external_id) bo'yicha tekshirish - aynan shu buyurtma qayta qabul qilinayaptimi
      // MUHIM: faqat AKTIV holatlar (WAITING, ON_THE_ROAD) dublikat hisoblanadi.
      // Bekor qilingan/sotilgan/yopilgan buyurtmalar — yangi buyurtma deb qabul qilinishi kerak.
      if (qr_code) {
        const existingByQr = await this.orderRepo
          .createQueryBuilder('order')
          .leftJoinAndSelect('order.customer', 'customer')
          .leftJoinAndSelect('order.items', 'items')
          .leftJoinAndSelect('items.product', 'product')
          .where('order.user_id = :marketId', { marketId: market_id })
          .andWhere('order.deleted_at IS NULL')
          .andWhere('order.status IN (:...activeStatuses)', {
            activeStatuses: [Order_status.WAITING, Order_status.ON_THE_ROAD],
          })
          // Case-insensitive comparison — Caps Lock yoqiq paytida skanerlangan
          // QR ham mavjud buyurtmaga to'g'ri ulanishi uchun
          .andWhere(
            '(LOWER(order.external_id) = LOWER(:externalId) OR LOWER(order.qr_code_token) = LOWER(:qrCode))',
            { externalId: String(qr_code), qrCode: String(qr_code) },
          )
          .getMany();

        if (existingByQr.length > 0) {
          duplicates.push(
            ...existingByQr.map((o) => ({
              id: o.id,
              status: o.status,
              total_price: o.total_price,
              created_at: o.created_at,
              customer_name: o.customer?.name,
              customer_phone: o.customer?.phone_number,
              match_type: 'exact_qr',
              items: o.items?.map((i) => ({
                product_name: i.product?.name,
                quantity: i.quantity,
              })),
            })),
          );
        }
      }

      // 2. Telefon raqami bo'yicha shu marketdagi yangi/qabul qilingan buyurtmalarni tekshirish
      if (cleanPhone && cleanPhone.length >= 9) {
        const phonePattern = `%${cleanPhone.slice(-9)}%`;

        const existingByPhone = await this.orderRepo
          .createQueryBuilder('order')
          .leftJoinAndSelect('order.customer', 'customer')
          .leftJoinAndSelect('order.items', 'items')
          .leftJoinAndSelect('items.product', 'product')
          .where('order.user_id = :marketId', { marketId: market_id })
          .andWhere('order.deleted_at IS NULL')
          .andWhere('order.status IN (:...statuses)', {
            statuses: [
              Order_status.NEW,
              Order_status.RECEIVED,
              Order_status.ON_THE_ROAD,
            ],
          })
          .andWhere('customer.phone_number ILIKE :phone', {
            phone: phonePattern,
          })
          .andWhere(
            // Allaqachon qr bo'yicha topilganlarni takrorlamaslik
            duplicates.length > 0 ? 'order.id NOT IN (:...excludeIds)' : '1=1',
            {
              excludeIds:
                duplicates.length > 0 ? duplicates.map((d) => d.id) : [''],
            },
          )
          .orderBy('order.created_at', 'DESC')
          .take(5)
          .getMany();

        if (existingByPhone.length > 0) {
          duplicates.push(
            ...existingByPhone.map((o) => ({
              id: o.id,
              status: o.status,
              total_price: o.total_price,
              created_at: o.created_at,
              customer_name: o.customer?.name,
              customer_phone: o.customer?.phone_number,
              match_type: 'phone',
              items: o.items?.map((i) => ({
                product_name: i.product?.name,
                quantity: i.quantity,
              })),
            })),
          );
        }
      }

      return successRes(
        {
          isDuplicate: duplicates.length > 0,
          duplicates,
        },
        200,
        duplicates.length > 0
          ? `${duplicates.length} ta dublikat topildi`
          : 'Dublikat topilmadi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async receiveExternalOrders(
    dto: {
      integration_id: string;
      orders: any[]; // Dynamic structure based on field_mapping
    },
    user: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { integration_id, orders } = dto;

      if (!orders || orders.length === 0) {
        throw new BadRequestException("Buyurtmalar ro'yxati bo'sh");
      }

      // Integratsiya konfiguratsiyasini olish (entity to'g'ridan-to'g'ri)
      const integration =
        await this.externalIntegrationService.getIntegrationEntity(
          integration_id,
        );

      if (!integration) {
        throw new NotFoundException('Integratsiya topilmadi');
      }

      if (!integration.is_active) {
        throw new BadRequestException('Bu integratsiya faol emas');
      }

      const { market_id, slug: source, field_mapping } = integration;

      // Biriktirilgan marketni olish
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: market_id, role: Roles.MARKET },
      });

      if (!market) {
        throw new NotFoundException('Biriktirilgan market topilmadi');
      }

      // Marketning default tariff ni olish (where_deliver uchun)
      const defaultWhereDeliver = market.default_tariff || Where_deliver.CENTER;

      const createdOrders: OrderEntity[] = [];
      // Region bo'yicha post cache
      const postsByRegion: Map<string, PostEntity> = new Map();

      // OPTIMIZATION: Barcha districtlarni bir marta yuklash
      const allDistricts = await queryRunner.manager.find(DistrictEntity);
      const districtBySatoCode: Map<string, DistrictEntity> = new Map();
      for (const d of allDistricts) {
        if (d.sato_code) {
          districtBySatoCode.set(d.sato_code, d);
        }
      }
      const defaultDistrict = allDistricts[0] || null;
      if (!defaultDistrict) {
        throw new NotFoundException('Tizimda hech qanday tuman topilmadi');
      }

      // OPTIMIZATION: Customerlarni cache qilish
      const customerCache: Map<string, UserEntity> = new Map();

      // DUBLIKAT HIMOYA: Barcha external_id va qr_code'larni oldindan tekshirish
      const allExternalIds: string[] = [];
      const allQrCodes: string[] = [];
      for (const extOrder of orders) {
        const extId = this.getFieldValue(extOrder, field_mapping.id_field);
        const extQr = this.getFieldValue(extOrder, field_mapping.qr_code_field);
        if (extId) allExternalIds.push(String(extId));
        if (extQr) allQrCodes.push(String(extQr));
      }

      // DUBLIKAT MANTIGI: faqat AKTIV holatlardagi (WAITING, ON_THE_ROAD)
      // buyurtmalar dublikat hisoblanadi. Bekor qilingan/sotilgan/yopilgan
      // buyurtmalar — yangi buyurtma sifatida qayta yaratilishi mumkin
      // (mijoz qayta murojaat qilgan bo'lishi mumkin).
      const ACTIVE_DUPLICATE_STATUSES = [
        Order_status.WAITING,
        Order_status.ON_THE_ROAD,
      ];

      // Case-insensitive matching: Set'ga lowercase'da yozamiz, keyin
      // har bir incoming order ham lowercase'da tekshiriladi
      const existingExternalIds = new Set<string>();
      if (allExternalIds.length > 0) {
        const existingByExtId = await queryRunner.manager
          .createQueryBuilder(OrderEntity, 'order')
          .select('order.external_id')
          .where('order.user_id = :marketId', { marketId: market_id })
          .andWhere('order.deleted_at IS NULL')
          .andWhere('order.status IN (:...activeStatuses)', {
            activeStatuses: ACTIVE_DUPLICATE_STATUSES,
          })
          .andWhere('LOWER(order.external_id) IN (:...extIds)', {
            extIds: allExternalIds.map((id) => id.toLowerCase()),
          })
          .getMany();
        existingByExtId.forEach((o) =>
          existingExternalIds.add((o.external_id || '').toLowerCase()),
        );
      }

      const existingQrCodes = new Set<string>();
      if (allQrCodes.length > 0) {
        const existingByQr = await queryRunner.manager
          .createQueryBuilder(OrderEntity, 'order')
          .select('order.qr_code_token')
          .where('order.user_id = :marketId', { marketId: market_id })
          .andWhere('order.deleted_at IS NULL')
          .andWhere('order.status IN (:...activeStatuses)', {
            activeStatuses: ACTIVE_DUPLICATE_STATUSES,
          })
          .andWhere('LOWER(order.qr_code_token) IN (:...qrCodes)', {
            qrCodes: allQrCodes.map((q) => q.toLowerCase()),
          })
          .getMany();
        existingByQr.forEach((o) =>
          existingQrCodes.add((o.qr_code_token || '').toLowerCase()),
        );
      }

      const skippedOrders: string[] = [];

      for (const extOrder of orders) {
        // Field mapping orqali qiymatlarni olish
        const externalId = this.getFieldValue(extOrder, field_mapping.id_field);
        const qrCode = this.getFieldValue(
          extOrder,
          field_mapping.qr_code_field,
        );

        // DUBLIKAT TEKSHIRISH: external_id yoki qr_code allaqachon bazada bormi
        // Case-insensitive: Set lowercase'da to'ldirilgan, shuning uchun
        // tekshirish ham lowercase'da
        if (
          externalId &&
          existingExternalIds.has(String(externalId).toLowerCase())
        ) {
          skippedOrders.push(String(externalId));
          continue; // Bu buyurtma allaqachon qabul qilingan
        }
        if (qrCode && existingQrCodes.has(String(qrCode).toLowerCase())) {
          skippedOrders.push(String(qrCode));
          continue; // Bu buyurtma allaqachon qabul qilingan
        }

        const fullName = this.getFieldValue(
          extOrder,
          field_mapping.customer_name_field,
        );
        const phone = this.getFieldValue(extOrder, field_mapping.phone_field);
        const additionalPhone = this.getFieldValue(
          extOrder,
          field_mapping.extra_phone_field,
        );
        const rawDistrict = this.getFieldValue(
          extOrder,
          field_mapping.district_code_field,
        );
        const address = this.getFieldValue(
          extOrder,
          field_mapping.address_field,
        );
        const comment = this.getFieldValue(
          extOrder,
          field_mapping.comment_field,
        );
        const totalPrice = this.getFieldValue(
          extOrder,
          field_mapping.total_price_field,
        );
        const deliveryPrice = this.getFieldValue(
          extOrder,
          field_mapping.delivery_price_field,
        );
        const totalCount = this.getFieldValue(
          extOrder,
          field_mapping.total_count_field,
        );

        // SATO kod orqali district topish (OPTIMIZED - cache dan)
        const districtCode =
          rawDistrict !== undefined &&
          rawDistrict !== null &&
          rawDistrict !== 'undefined' &&
          rawDistrict !== 'null' &&
          rawDistrict !== ''
            ? String(rawDistrict)
            : '';

        let targetDistrict: DistrictEntity | null = null;

        if (districtCode) {
          // Avval to'liq SATO kod bilan cache dan qidirish
          targetDistrict = districtBySatoCode.get(districtCode) || null;

          // Agar topilmasa, partial match qilish (cache dan)
          if (!targetDistrict) {
            targetDistrict =
              allDistricts.find(
                (d) =>
                  d.sato_code?.endsWith(districtCode) ||
                  d.sato_code?.includes(districtCode),
              ) || null;
          }
        }

        // Agar district topilmasa, default district ishlatish
        if (!targetDistrict) {
          targetDistrict = defaultDistrict;
          if (districtCode) {
            this.logger.warn(
              `District topilmadi SATO kod: ${districtCode}, default ishlatilmoqda`,
            );
          }
        }

        const regionId =
          targetDistrict.assigned_region || targetDistrict.region_id;

        // Region uchun post topish yoki yaratish (cache dan)
        let post: PostEntity | undefined = postsByRegion.get(regionId);

        if (!post) {
          const foundPost = await queryRunner.manager.findOne(PostEntity, {
            where: { region_id: regionId, status: Post_status.NEW },
          });
          post = foundPost || undefined;

          if (!post) {
            post = queryRunner.manager.create(PostEntity, {
              region_id: regionId,
              qr_code_token: generateCustomToken(),
              post_total_price: 0,
              order_quantity: 0,
              status: Post_status.NEW,
            });
            await queryRunner.manager.save(post);
          }

          postsByRegion.set(regionId, post);
        }

        // Telefon raqamni olish va formatlash
        let phoneNumber =
          phone ||
          `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // +998 prefix qo'shish (agar yo'q bo'lsa)
        if (phoneNumber && !phoneNumber.startsWith('unknown_')) {
          // Faqat raqamlarni olish
          const cleanPhone = phoneNumber.replace(/\D/g, '');
          if (cleanPhone.length === 9) {
            // 901234567 -> +998901234567
            phoneNumber = `+998${cleanPhone}`;
          } else if (cleanPhone.length === 12 && cleanPhone.startsWith('998')) {
            // 998901234567 -> +998901234567
            phoneNumber = `+${cleanPhone}`;
          } else if (!phoneNumber.startsWith('+998')) {
            // Boshqa formatlar uchun +998 qo'shish
            phoneNumber = `+998${cleanPhone.slice(-9)}`;
          }
        }

        const customerName = fullName || 'Tashqi mijoz';

        // Mijozni topish yoki yaratish (OPTIMIZED - cache dan)
        let customer = customerCache.get(phoneNumber);

        if (!customer) {
          const foundCustomer = await queryRunner.manager.findOne(UserEntity, {
            where: {
              phone_number: phoneNumber,
              role: Roles.CUSTOMER,
            },
          });

          if (foundCustomer) {
            customer = foundCustomer;
          } else {
            customer = queryRunner.manager.create(UserEntity, {
              name: customerName,
              phone_number: phoneNumber,
              role: Roles.CUSTOMER,
              district_id: targetDistrict.id,
              address: address || '',
              extra_number: additionalPhone || undefined,
            });
            await queryRunner.manager.save(customer);
          }

          customerCache.set(phoneNumber, customer);
        }

        // Narxni hisoblash: total_price + delivery_price
        const productPriceNum = Number(totalPrice) || 0;
        const deliveryPriceNum = Number(deliveryPrice) || 0;
        const finalTotalPrice = productPriceNum + deliveryPriceNum;

        // QR kod token (tashqi QR koddan foydalanish)
        const qrCodeToken = qrCode || generateCustomToken();

        // Izoh yaratish
        const orderComment = [
          comment,
          additionalPhone ? `Qo'shimcha tel: ${additionalPhone}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        // Buyurtma yaratish - to'g'ridan-to'g'ri RECEIVED holatida
        const newOrder = queryRunner.manager.create(OrderEntity, {
          user_id: market_id,
          customer_id: customer.id,
          district_id: targetDistrict.id,
          post_id: post.id,
          total_price: finalTotalPrice,
          where_deliver: defaultWhereDeliver,
          status: Order_status.RECEIVED,
          qr_code_token: qrCodeToken,
          comment: orderComment,
          address: address || customer.address,
          operator: `external_${source}`,
          external_id: String(externalId),
          product_quantity: Number(totalCount) || 1,
        });

        await queryRunner.manager.save(newOrder);

        // Post statistikasini yangilash
        post.post_total_price =
          Number(post.post_total_price ?? 0) + finalTotalPrice;
        post.order_quantity = Number(post.order_quantity ?? 0) + 1;

        createdOrders.push(newOrder);
      }

      // Barcha postlarni saqlash
      for (const post of postsByRegion.values()) {
        await queryRunner.manager.save(post);
      }

      // Integratsiya last_sync_at ni yangilash
      await this.externalIntegrationService.updateLastSync(
        integration_id,
        createdOrders.length,
      );

      await queryRunner.commitTransaction();

      // Tashqi integratsiya orqali yaratilgan har bir buyurtmani loglaymiz —
      // ilgari bu oqim umuman audit jurnaliga yozilmasdi.
      for (const o of createdOrders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: o.id,
          action: 'created',
          new_value: {
            order_number: o.order_number,
            status: o.status,
            total_price: o.total_price,
            source: integration.name,
            external_id: o.external_id,
          },
          description: `Buyurtma #${o.order_number} "${integration.name}" integratsiyasidan qabul qilindi — ${o.total_price} so'm`,
          user,
          metadata: { source: 'external_integration', integration: integration.name },
        });
      }

      const skippedMsg =
        skippedOrders.length > 0
          ? `, ${skippedOrders.length} ta dublikat o'tkazib yuborildi`
          : '';

      return successRes(
        {
          created_orders: createdOrders.length,
          skipped_orders: skippedOrders.length,
          skipped_ids: skippedOrders,
          integration: {
            id: integration.id,
            name: integration.name,
            slug: integration.slug,
          },
          orders: createdOrders.map((o) => ({
            id: o.id,
            external_id: o.external_id,
            total_price: o.total_price,
            status: o.status,
          })),
        },
        201,
        `${createdOrders.length} ta tashqi buyurtma qabul qilindi (${integration.name})${skippedMsg}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== LDG WEBHOOK ENTRY POINTS ====================

  /**
   * LDG webhook'dan `DELIVERED` statusi (terminal_action='sell') kelganda
   * chaqiriladi. LDG vakil-kuryer hisobidan mavjud `sellOrder` oqimini ishga
   * tushiradi — kassa tranzaksiyalari odatdagi kuryer sotuvi kabi yoziladi.
   *
   * Idempotent: agar order allaqachon SOLD bo'lsa, hech narsa qilmaydi.
   * Agar order ON_THE_ROAD/RECEIVED bo'lsa, avval WAITING ga o'tkazadi
   * (LDG webhook bevosita "yetkazib berildi" deganida `kuryer qabul qildi`
   * bosqichini bo'lib o'tkazib yuboramiz).
   */
  /**
   * LDG bilan status nomuvofiqligini audit jurnaliga yozadi.
   * Ilgari bunday hodisalar faqat logger.error'ga tushardi (queryalab bo'lmaydi).
   * Bu moliyaviy yaxlitlik uchun eng muhim hodisalar (LDG yetkazgan/bekor qilgan,
   * lekin bizda pul allaqachon harakatlangan).
   */
  private logLdgMismatch(
    order: { id: string; order_number?: number; status: string },
    terminalAction: string,
    reason: string,
  ): void {
    this.activityLog.log({
      entity_type: 'order',
      entity_id: order.id,
      action: 'ldg_mismatch',
      old_value: { status: order.status },
      new_value: {
        order_number: order.order_number,
        ldg_action: terminalAction,
      },
      description: `⚠️ LDG nomuvofiqligi — Buyurtma #${order.order_number}: LDG "${terminalAction}", bizda "${orderStatusUz(
        order.status,
      )}". ${reason}`,
      metadata: { source: 'ldg', terminal_action: terminalAction },
    });
  }

  async markDeliveredByLdg(
    orderId: string,
    ldgCourierUserId: string,
  ): Promise<LdgTerminalResult> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(`LDG webhook delivered: order topilmadi (${orderId})`);
      return { kind: 'skipped', reason: 'order_not_found' };
    }
    // Idempotent — webhook qayta yuborilgan yoki avval qo'lda sotilgan
    if (
      order.status === Order_status.SOLD ||
      order.status === Order_status.PAID ||
      order.status === Order_status.PARTLY_PAID
    ) {
      return { kind: 'skipped', reason: `already ${order.status}` };
    }
    // MISMATCH: LDG yetkazdi, lekin bizda buyurtma bekor qilingan/yopilgan
    // (kuryer yoki operator allaqachon "bekor qildi" deb belgilagan, ammo
    // LDG haqiqatda yetkazgan ekan — yoki status sinxron emas).
    if (
      order.status === Order_status.CANCELLED ||
      order.status === Order_status.CANCELLED_SENT ||
      order.status === Order_status.CLOSED
    ) {
      const reason = `LDG: yetkazildi, lekin bizda status=${order.status} (qo'lda tekshiring)`;
      this.logger.error(`LDG MISMATCH delivered: order=${orderId} — ${reason}`);
      this.logLdgMismatch(order, 'delivered', reason);
      return { kind: 'mismatch', reason };
    }

    // ON_THE_ROAD yoki RECEIVED bo'lsa avval WAITING ga o'tkazamiz
    if (
      order.status === Order_status.ON_THE_ROAD ||
      order.status === Order_status.RECEIVED
    ) {
      await this.orderRepo.update(
        {
          id: orderId,
          status: In([Order_status.ON_THE_ROAD, Order_status.RECEIVED]),
        },
        { status: Order_status.WAITING },
      );
    }

    const payload: JwtPayload = {
      id: ldgCourierUserId,
      role: Roles.COURIER,
      status: Status.ACTIVE,
    };

    try {
      await this.sellOrder(payload, orderId, {
        comment: 'LDG yetkazib berdi',
        extraCost: 0,
      });
      return { kind: 'applied' };
    } catch (err) {
      // sellOrder `where: status=WAITING` filtrida fail bo'lsa — race condition
      // (manual sell yoki cancel oraliqda bajarildi). Yangi statusni o'qib mismatch
      // yoki skipped sifatida qaytaramiz.
      const fresh = await this.orderRepo.findOne({ where: { id: orderId } });
      if (
        fresh?.status === Order_status.SOLD ||
        fresh?.status === Order_status.PAID ||
        fresh?.status === Order_status.PARTLY_PAID
      ) {
        return { kind: 'skipped', reason: `race: now ${fresh.status}` };
      }
      if (
        fresh?.status === Order_status.CANCELLED ||
        fresh?.status === Order_status.CANCELLED_SENT ||
        fresh?.status === Order_status.CLOSED
      ) {
        const reason = `LDG: yetkazildi (sell race), lekin bizda status=${fresh.status}`;
        this.logger.error(
          `LDG MISMATCH delivered (race): order=${orderId} — ${reason}`,
        );
        this.logLdgMismatch(fresh, 'delivered', reason);
        return { kind: 'mismatch', reason };
      }
      throw err;
    }
  }

  /**
   * LDG webhook'dan `CANCELLED` statusi (terminal_action='cancel') kelganda
   * chaqiriladi. LDG vakil-kuryer hisobidan mavjud `cancelOrder` oqimini ishga
   * tushiradi — order CANCELLED bo'ladi, market guruhiga bildirishnoma yuboriladi.
   *
   * Idempotent: order allaqachon CANCELLED/CANCELLED_SENT/CLOSED/SOLD bo'lsa, skip
   * (terminal holatni qayta o'zgartirmaymiz).
   */
  async markCancelledByLdg(
    orderId: string,
    ldgCourierUserId: string,
  ): Promise<LdgTerminalResult> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(`LDG webhook cancelled: order topilmadi (${orderId})`);
      return { kind: 'skipped', reason: 'order_not_found' };
    }
    if (
      order.status === Order_status.CANCELLED ||
      order.status === Order_status.CANCELLED_SENT ||
      order.status === Order_status.CLOSED
    ) {
      return { kind: 'skipped', reason: `already ${order.status}` };
    }
    // MISMATCH: LDG bekor qildi, lekin bizda allaqachon sotilgan/to'langan.
    // Bu real biznes muammosi: pul market'ga to'langan, lekin LDG yetkazmagan.
    if (
      order.status === Order_status.SOLD ||
      order.status === Order_status.PAID ||
      order.status === Order_status.PARTLY_PAID
    ) {
      const reason = `LDG: bekor qildi, lekin bizda status=${order.status} (pul to'langan! qo'lda tekshiring)`;
      this.logger.error(`LDG MISMATCH cancelled: order=${orderId} — ${reason}`);
      this.logLdgMismatch(order, 'cancelled', reason);
      return { kind: 'mismatch', reason };
    }

    const payload: JwtPayload = {
      id: ldgCourierUserId,
      role: Roles.COURIER,
      status: Status.ACTIVE,
    };

    // skipNotification berilmaydi — market guruhiga "bekor qilindi" xabari ketadi
    await this.cancelOrder(payload, orderId, {
      comment: 'LDG bekor qildi',
      extraCost: 0,
    });
    return { kind: 'applied' };
  }

  /**
   * LDG webhook'dan `RETURNED` statusi (terminal_action='return') kelganda
   * chaqiriladi. LDG buyurtmani BEKOR QILIB, paketni bizga QAYTARMOQDA — lekin
   * paket hali jismonan yetib kelmagan.
   *
   * MUHIM: bu yerda buyurtma CLOSED ("Yopilgan") QILINMAYDI. CLOSED — eng yakuniy
   * status va u FAQAT skaner oqimidan (receiveWithScaner/receiveCanceledPost)
   * qo'yiladi, chunki "mahsulot jismonan qaytib keldi va skaner bilan tasdiqlandi"
   * degan invariantni bildiradi. LDG eng ko'pi bilan buyurtmani CANCELLED_SENT
   * ("Bekor (yuborilgan)" — qaytish yo'lida) holatiga o'tkaza oladi; paket idoraga
   * yetib kelib registrator uni skanerdan o'tkazgandagina CLOSED bo'ladi.
   *
   * Avval (agar hali bekor qilinmagan bo'lsa) `cancelOrder` oqimidan o'tkazamiz
   * (market guruhiga bildirishnoma, tashqi integratsiya sinxron, operator daromadi
   * tozalanadi) — bu buyurtmani CANCELLED qiladi. So'ng ATOMIK ravishda
   * CANCELLED → CANCELLED_SENT ga o'tkazamiz.
   *
   * Idempotent: order allaqachon CANCELLED_SENT/CLOSED bo'lsa skip. SOLD bo'lsa
   * tegmaymiz (nizoli holat — mismatch, qo'lda tekshirilishi kerak).
   */
  async markReturnedByLdg(
    orderId: string,
    ldgCourierUserId: string,
  ): Promise<LdgTerminalResult> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(`LDG webhook returned: order topilmadi (${orderId})`);
      return { kind: 'skipped', reason: 'order_not_found' };
    }
    // Allaqachon qaytish yo'lida (CANCELLED_SENT) yoki skaner bilan yopilgan
    // (CLOSED) — qayta ishlamaymiz (idempotent). CLOSED'ni LDG teskari qaytara
    // olmaydi.
    if (
      order.status === Order_status.CLOSED ||
      order.status === Order_status.CANCELLED_SENT
    ) {
      return { kind: 'skipped', reason: `already ${order.status}` };
    }
    // MISMATCH: LDG paketni bizga qaytardi, lekin bizda allaqachon sotilgan/to'langan
    if (
      order.status === Order_status.SOLD ||
      order.status === Order_status.PAID ||
      order.status === Order_status.PARTLY_PAID
    ) {
      const reason = `LDG: qaytarib berdi, lekin bizda status=${order.status} (pul to'langan! qo'lda tekshiring)`;
      this.logger.error(`LDG MISMATCH returned: order=${orderId} — ${reason}`);
      this.logLdgMismatch(order, 'returned', reason);
      return { kind: 'mismatch', reason };
    }

    const payload: JwtPayload = {
      id: ldgCourierUserId,
      role: Roles.COURIER,
      status: Status.ACTIVE,
    };

    // Hali bekor qilinmagan bo'lsa — bekor qilish oqimini o'tkazamiz (bu buyurtmani
    // CANCELLED qiladi va moliyaviy/bildirishnoma oqimini bajaradi).
    if (order.status !== Order_status.CANCELLED) {
      await this.cancelOrder(payload, orderId, {
        comment: 'LDG bekor qilib qaytardi',
        extraCost: 0,
      });
    }

    // Yakuniy status — CANCELLED_SENT (qaytish yo'lida, skaner kutilmoqda).
    // ATOMIK + status-guard: faqat CANCELLED bo'lsa o'tkazamiz. Poyga holatida
    // (oradan kimdir statusni o'zgartirgan bo'lsa) 0 qator ta'sirlanadi → skipped.
    // canceled_post_id ATAYLAB tegilmaydi (NULL qoladi) — LDG virtual kuryeri
    // qaytarish-pochtasi oqimida qatnashmaydi; buyurtma global skaner orqali
    // yopiladi (receiveWithScaner CANCELLED_SENT'ni pochtasiz ham qabul qiladi).
    const res = await this.orderRepo.update(
      { id: orderId, status: In([Order_status.CANCELLED]) },
      { status: Order_status.CANCELLED_SENT },
    );
    if ((res.affected ?? 0) === 0) {
      const fresh = await this.orderRepo.findOne({ where: { id: orderId } });
      return { kind: 'skipped', reason: `race: now ${fresh?.status ?? 'unknown'}` };
    }

    this.activityLog.log({
      entity_type: 'order',
      entity_id: orderId,
      action: 'ldg_returned',
      old_value: { status: Order_status.CANCELLED },
      new_value: {
        order_number: order.order_number,
        status: Order_status.CANCELLED_SENT,
      },
      description: `Buyurtma #${order.order_number} — LDG bekor qilib qaytardi (qaytish yo'lida, skaner kutilmoqda)`,
      user: payload,
      metadata: { source: 'ldg', ldg_status: 'RETURNED' },
    });
    return { kind: 'applied' };
  }

  // ==================== BULK OPERATIONS (KURIER UCHUN) ====================

  /**
   * Bulk: bir nechta buyurtmani sotildi qilish (default summalar bilan).
   * Har order o'zining alohida tranzaksiyasida ishlaydi (mavjud sellOrder qayta ishlatiladi).
   * Per-order natija qaytariladi — qisman muvaffaqiyat ham mumkin.
   */
  async bulkSellOrders(user: JwtPayload, dto: BulkOrderActionDto) {
    const successful: Array<{ id: string; total_price: number }> = [];
    const failed: Array<{ id: string; reason: string }> = [];

    // Almashtirish (kafolat-swap) buyurtmalarini bulk avto-sotuvdan ISTISNO
    // qilamiz: ular kuryerning "eskisini oldim" tasdig'ini talab qiladi, shuning
    // uchun jimgina avto-sotilib ketmasligi va eski mahsulot yo'qolmasligi uchun
    // faqat bittalab sotuv modalida sotiladi. Bu yerda oldindan ajratib, aniq
    // sabab bilan failed'ga qo'shamiz (sellOrder gate'iga tushib ketmasdan).
    const replacementIds = new Set<string>();
    if (dto.order_ids.length) {
      const rows = await this.dataSource
        .getRepository(OrderEntity)
        .createQueryBuilder('o')
        .select('o.id', 'id')
        .where('o.id IN (:...ids)', { ids: dto.order_ids })
        .andWhere('o.replacement_of_order_id IS NOT NULL')
        .getRawMany();
      rows.forEach((r: { id: string }) => replacementIds.add(r.id));
    }

    for (const orderId of dto.order_ids) {
      if (replacementIds.has(orderId)) {
        failed.push({
          id: orderId,
          reason:
            "Almashtirish buyurtmasi — eskisini olib, bittalab soting (avto-sotilmaydi)",
        });
        continue;
      }
      try {
        // Mavjud sellOrder metodini chaqiramiz (pessimistic lock + barcha logika).
        // Bulk uchun extra_cost yo'q, faqat umumiy izoh.
        const result: any = await this.sellOrder(user, orderId, {
          comment: dto.comment,
        } as any);

        if (result?.statusCode && result.statusCode >= 400) {
          failed.push({
            id: orderId,
            reason: result?.message || "Noma'lum xato",
          });
        } else {
          // sellOrder muvaffaqiyatli bo'lsa orderni qaytaradi
          const orderData = result?.data || result;
          successful.push({
            id: orderId,
            total_price: Number(orderData?.total_price ?? 0),
          });
        }
      } catch (e: any) {
        failed.push({
          id: orderId,
          reason: e?.message || 'Server xatosi',
        });
      }
    }

    const totalAmount = successful.reduce(
      (s, o) => s + (o.total_price || 0),
      0,
    );
    return successRes(
      {
        successful: successful.map((s) => s.id),
        failed,
        totalAmount,
        totalSuccess: successful.length,
        totalFailed: failed.length,
      },
      200,
      `Bulk sotuv yakunlandi: ${successful.length} muvaffaqiyatli, ${failed.length} xato`,
    );
  }

  /**
   * Almashtirish pickeri uchun ALMASHTIRIB BO'LADIGAN buyurtmalar.
   *   - q berilsa: SHU MARKET bo'ylab telefon/ism/buyurtma raqami bo'yicha
   *     qidiradi (boshqa mijoz buyurtmasini ham topadi).
   *   - q bo'lmasa, customer_id berilsa: shu mijozning shu marketdagi buyurtmalari.
   * Faqat YETKAZILGAN (sotilgan) va hali almashtirilmagan buyurtmalar. To'liq
   * detallar (sana, izoh, mahsulotlar, mijoz) qaytadi — bir xil mahsulotni
   * sana/izoh bo'yicha ajratish uchun.
   */
  async getReplaceableOrders(
    user: JwtPayload,
    query: {
      market_id?: string;
      customer_id?: string;
      q?: string;
      limit?: number;
    },
  ) {
    try {
      // Market'ni aniqlash: MARKET o'zini, OPERATOR o'z marketini, qolganlar param.
      let marketId = query.market_id;
      if (user.role === Roles.MARKET) {
        marketId = user.id;
      } else if (user.role === Roles.OPERATOR) {
        const op = await this.userRepo.findOne({
          where: { id: user.id },
          select: ['id', 'market_id'],
        });
        marketId = op?.market_id || marketId;
      }
      if (!marketId) {
        return successRes({ data: [] }, 200, 'market_id kerak');
      }

      const q = (query.q || '').trim();
      if (!q && !query.customer_id) {
        return successRes({ data: [] }, 200, 'Filtr yo‘q');
      }

      const limit = Math.min(Number(query.limit) || 30, 50);
      const DELIVERED: Order_status[] = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
        Order_status.CLOSED,
      ];

      const qb = this.orderRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('o.customer', 'customer')
        .where('o.user_id = :marketId', { marketId })
        .andWhere('o.deleted_at IS NULL')
        .andWhere('o.is_replacement_return = false')
        .andWhere('o.status IN (:...statuses)', { statuses: DELIVERED })
        .orderBy('o.created_at', 'DESC')
        .take(limit);

      if (q) {
        qb.andWhere(
          '(CAST(o.order_number AS TEXT) ILIKE :q OR customer.phone_number ILIKE :q OR customer.extra_number ILIKE :q OR customer.name ILIKE :q)',
          { q: `%${q}%` },
        );
      } else if (query.customer_id) {
        qb.andWhere('o.customer_id = :cid', { cid: query.customer_id });
      }

      const orders = await qb.getMany();

      const data = orders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total_price: o.total_price,
        created_at: o.created_at,
        sold_at: o.sold_at,
        where_deliver: o.where_deliver,
        comment: o.comment,
        customer: {
          name: o.customer?.name || null,
          phone_number: o.customer?.phone_number || null,
        },
        items: (o.items || []).map((i) => ({
          product_name: i.product?.name || '—',
          quantity: i.quantity,
        })),
      }));

      return successRes({ data }, 200, 'Replaceable orders');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Almashtirish (kafolat-swap) QAYTISHLARI ro'yxati — ESKI buyurtmalar
   * (is_replacement_return = true). Markaz/admin qaytayotgan mahsulotlarni
   * ko'rib, marketga topshirilganini tasdiqlaydi. Eski buyurtmalar SOTILGAN
   * holatda qoladi (status emas, flag bo'yicha) — hisobotlar buzilmaydi.
   *   state: 'pending' (kutilmoqda) | 'collected' (olindi) | 'returned' (qaytarildi)
   */
  async getReplacementReturns(
    user: JwtPayload,
    query: { state?: string; page?: number; limit?: number; search?: string },
  ) {
    try {
      const page = query.page && query.page > 0 ? query.page : 1;
      const limit = getSafeLimit(query.limit, false);
      const offset = (page - 1) * limit;

      const qb = this.orderRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('o.market', 'market')
        .leftJoinAndSelect('o.customer', 'customer')
        .where('o.is_replacement_return = :flag', { flag: true })
        .andWhere('o.deleted_at IS NULL')
        .orderBy('o.old_product_returned_at', 'DESC', 'NULLS LAST')
        .addOrderBy('o.created_at', 'DESC')
        .skip(offset)
        .take(limit);

      if (query.state === 'collected') {
        qb.andWhere('o.replacement_state = :st', {
          st: Replacement_state.OLD_COLLECTED,
        });
      } else if (query.state === 'returned') {
        qb.andWhere('o.replacement_state = :st', {
          st: Replacement_state.OLD_RETURNED,
        });
      } else if (query.state === 'pending') {
        qb.andWhere('o.replacement_state = :st', {
          st: Replacement_state.AWAITING_OLD_PICKUP,
        });
      }

      if (query.search) {
        const s = `%${query.search}%`;
        qb.andWhere(
          '(CAST(o.order_number AS TEXT) ILIKE :s OR customer.name ILIKE :s OR customer.phone_number ILIKE :s)',
          { s },
        );
      }

      const [data, total] = await qb.getManyAndCount();

      // Har bir eski buyurtmaga bog'liq YANGI almashtirish buyurtmasini topamiz
      const oldIds = data.map((o) => o.id);
      const newByOld = new Map<string, OrderEntity>();
      if (oldIds.length) {
        const news = await this.orderRepo.find({
          where: { replacement_of_order_id: In(oldIds) },
          select: [
            'id',
            'order_number',
            'replacement_of_order_id',
            'replacement_state',
            'status',
            'sold_at',
          ],
        });
        news.forEach((n) => {
          if (n.replacement_of_order_id) {
            newByOld.set(n.replacement_of_order_id, n);
          }
        });
      }

      // "Marketga qabul qilgan" shaxs ismlarini biriktiramiz (audit dalili)
      const returnerIds = Array.from(
        new Set(data.map((o) => o.old_returned_by).filter(Boolean)),
      ) as string[];
      const returnerMap = new Map<string, string>();
      if (returnerIds.length) {
        const returners = await this.userRepo.find({
          where: { id: In(returnerIds) },
          select: ['id', 'name'],
        });
        returners.forEach((u) => returnerMap.set(u.id, u.name));
      }

      const items = data.map((o) => ({
        ...o,
        replacement_new_order: newByOld.get(o.id) || null,
        old_returned_by_name: o.old_returned_by
          ? returnerMap.get(o.old_returned_by) || null
          : null,
      }));

      return successRes(
        { data: items, total, page, limit, totalPages: Math.ceil(total / limit) },
        200,
        'Replacement returns',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Markaz/admin ESKI almashtirish mahsuloti marketga TOPSHIRILGANINI tasdiqlaydi
   * → replacement_state = OLD_RETURNED. Moliyaga TEGMAYDI (kafolat-swap, reversal
   * yo'q). Market'ga Telegram xabari yuboriladi.
   */
  async confirmOldReturned(user: JwtPayload, id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const oldOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        relations: ['customer'],
      });
      if (!oldOrder) throw new NotFoundException('Buyurtma topilmadi');
      if (!oldOrder.is_replacement_return) {
        throw new BadRequestException('Bu buyurtma almashtirish qaytishi emas');
      }
      // Idempotent
      if (oldOrder.replacement_state === Replacement_state.OLD_RETURNED) {
        await queryRunner.commitTransaction();
        return successRes(
          oldOrder,
          200,
          'Allaqachon qaytarilgan deb belgilangan',
        );
      }

      oldOrder.replacement_state = Replacement_state.OLD_RETURNED;
      if (!oldOrder.old_product_returned_at) {
        oldOrder.old_product_returned_at = Date.now();
      }
      oldOrder.old_returned_by = user.id; // audit: qabul qilgan shaxs
      await queryRunner.manager.save(oldOrder);

      // Yangi buyurtmani ham kuzatuv izchilligi uchun OLD_RETURNED ga o'tkazamiz
      const newOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { replacement_of_order_id: id },
      });
      if (newOrder) {
        newOrder.replacement_state = Replacement_state.OLD_RETURNED;
        await queryRunner.manager.save(newOrder);
      }

      await queryRunner.commitTransaction();

      // Market Telegram xabari (commit'dan keyin — xato sotuvga ta'sir qilmaydi)
      try {
        const returnGroup = await this.dataSource
          .getRepository(TelegramEntity)
          .findOne({
            where: {
              market_id: oldOrder.user_id,
              group_type: Group_type.CANCEL,
            },
          });
        await this.botService.sendMessageToGroup(
          returnGroup?.group_id || null,
          `*✅ Almashtirish — mahsulot qaytarildi!*\n\n` +
            `📦 Eski buyurtma *#${oldOrder.order_number}* mahsuloti sizga (marketga) qaytarib topshirildi.\n` +
            `👤 *Mijoz:* ${oldOrder.customer?.name || '-'}\n`,
        );
      } catch {}

      this.activityLog.log({
        entity_type: 'order',
        entity_id: oldOrder.id,
        action: 'replacement_returned',
        new_value: {
          order_number: oldOrder.order_number,
          replacement_state: Replacement_state.OLD_RETURNED,
        },
        description: `Almashtirish: eski buyurtma #${oldOrder.order_number} marketga qaytarildi`,
        user,
      });

      return successRes(oldOrder, 200, 'Marked as returned to market');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk: bir nechta buyurtmani bekor qilish.
   * Telegram xabari yuborilmaydi (skipNotification: true) — har order uchun alohida xabar
   * juda ko'p shovqin yaratardi.
   */
  async bulkCancelOrders(user: JwtPayload, dto: BulkOrderActionDto) {
    const successful: Array<{ id: string; total_price: number }> = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const orderId of dto.order_ids) {
      try {
        const result: any = await this.cancelOrder(
          user,
          orderId,
          { comment: dto.comment } as any,
          { skipNotification: true },
        );

        if (result?.statusCode && result.statusCode >= 400) {
          failed.push({
            id: orderId,
            reason: result?.message || "Noma'lum xato",
          });
        } else {
          const orderData = result?.data || result;
          successful.push({
            id: orderId,
            total_price: Number(orderData?.total_price ?? 0),
          });
        }
      } catch (e: any) {
        failed.push({
          id: orderId,
          reason: e?.message || 'Server xatosi',
        });
      }
    }

    const totalAmount = successful.reduce(
      (s, o) => s + (o.total_price || 0),
      0,
    );
    return successRes(
      {
        successful: successful.map((s) => s.id),
        failed,
        totalAmount,
        totalSuccess: successful.length,
        totalFailed: failed.length,
      },
      200,
      `Bulk bekor qilish yakunlandi: ${successful.length} muvaffaqiyatli, ${failed.length} xato`,
    );
  }

  /**
   * QR token orqali order topish — kurier scaner paytida tezkor tekshiruv uchun.
   * Faqat asosiy ma'lumot qaytariladi (id, status, total, mijoz, tegishlilik).
   */
  async findByQrTokenForCourier(token: string, user: JwtPayload) {
    try {
      const order = await this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('order.post', 'post')
        .where('order.qr_code_token = :token', {
          token: normalizeQrToken(token),
        })
        .getOne();

      if (!order) {
        throw new NotFoundException('Buyurtma topilmadi');
      }

      const belongsToCourier = order.post?.courier_id === user.id;
      return successRes(
        {
          id: order.id,
          status: order.status,
          total_price: order.total_price,
          customer_name: order.customer?.name,
          customer_phone: order.customer?.phone_number,
          belongs_to_me: belongsToCourier,
          can_act: belongsToCourier && order.status === Order_status.WAITING,
        },
        200,
        'Buyurtma topildi',
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
