import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { DataSource, In } from 'typeorm';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { OrderItemRepository } from 'src/core/repository/order-item.repository';
import {
  Cashbox_type,
  Group_type,
  Operation_type,
  Order_status,
  Post_status,
  Roles,
  Source_type,
  Where_deliver,
} from 'src/common/enums';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { ProductRepository } from 'src/core/repository/product.repository';
import { ProductEntity } from 'src/core/entity/product.entity';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { SellCancelOrderDto } from './dto/sellCancel-order.dto';
import { OrdersArrayDto } from './dto/orders-array.dto';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { generateComment } from 'src/common/utils/generate-comment';
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
import {
  getSafeLimit,
  PAGINATION,
} from 'src/common/constants/pagination';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { ExternalIntegrationService } from '../external-integration/external-integration.service';
import { FieldMapping } from 'src/core/entity/external-integration.entity';

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
        .leftJoinAndSelect('customerDistrict.assignedToRegion', 'customerAssignedRegion')
        // Order ning o'z district (yetkazib berish manzili)
        .leftJoinAndSelect('order.district', 'orderDistrict')
        .leftJoinAndSelect('orderDistrict.region', 'orderRegion')
        .leftJoinAndSelect('orderDistrict.assignedToRegion', 'orderAssignedRegion')
        .leftJoinAndSelect('order.market', 'market')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('order.post', 'post')
        .leftJoinAndSelect('post.courier', 'courier')
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
        qb.andWhere('order.status IN (:...statuses)', { statuses: statusArray });
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
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search)',
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
  ): Promise<Object> {
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

      if (user.role === Roles.MARKET && !market.add_order) {
        throw new BadRequestException('You can not create order and product');
      }

      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: customer_id, role: Roles.CUSTOMER },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const qr_code_token = generateCustomToken();

      // Agar manzil berilmagan bo'lsa, mijozning default manzilini olish
      const orderDistrictId = district_id || customer.district_id;
      const orderAddress = address !== undefined ? address : customer.address;

      const newOrder = queryRunner.manager.create(OrderEntity, {
        user_id: market_id,
        comment,
        operator,
        total_price,
        where_deliver: where_deliver || Where_deliver.CENTER,
        status: Order_status.NEW,
        qr_code_token,
        customer_id,
        district_id: orderDistrictId,
        address: orderAddress,
      });

      await queryRunner.manager.save(newOrder);

      // ✅ Batch: Barcha productlarni bir so'rovda olish
      const productIds = order_item_info.map((item) => item.product_id);
      const existingProducts = await queryRunner.manager.find(ProductEntity, {
        where: { id: In(productIds) },
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

      await queryRunner.commitTransaction();
      return successRes(newOrder, 201, 'New order created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
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

      const currentOperator = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });
      if (!currentOperator) {
        throw new NotFoundException('Operator not found');
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

      const newOrder = queryRunner.manager.create(OrderEntity, {
        customer_id: customer.id,
        user_id: currentOperator.market_id,
        operator: operator ? operator : currentOperator.name,
        total_price,
        where_deliver: where_deliver || Where_deliver.CENTER,
        status: Order_status.CREATED,
        qr_code_token,
        comment,
      });
      await queryRunner.manager.save(newOrder);

      // ✅ Batch: Barcha productlarni bir so'rovda olish
      const productIds = order_item_info.map((item) => item.product_id);
      const existingProducts = await queryRunner.manager.find(ProductEntity, {
        where: { id: In(productIds) },
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

      const telegramGroups = await queryRunner.manager.find(TelegramEntity, {
        where: { market_id: order.user_id, group_type: Group_type.CREATE },
      });
      // created_at string yoki bigint bo'lishi mumkin

      if (telegramGroups.length) {
        const sendResults = await Promise.all(
          telegramGroups.map((g) =>
            this.orderBotService.sendOrderForApproval(
              g.group_id || null,
              order,
            ),
          ),
        );

        const messageRefs = sendResults
          .map((res) => res.sentMessage)
          .filter(Boolean) as { chatId: number; messageId: number }[];

        if (messageRefs.length) {
          order.create_bot_messages = [
            ...(order.create_bot_messages || []),
            ...messageRefs,
          ];
          await queryRunner.manager.save(order);
        }
      }

      await queryRunner.commitTransaction();
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
      const query = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('order.market', 'market')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region.name')
        .where('order.status = :status', { status: Order_status.NEW })
        .andWhere('order.user_id = :userId', { userId: user.id });

      if (search) {
        query.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search)',
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
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .where('order.user_id = :id', { id })
        .andWhere('order.status = :status', { status: Order_status.NEW });

      if (search) {
        query.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search)',
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
        `${market.name}'s new Orders`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string) {
    try {
      const newOrder = await this.orderRepo.findOne({
        where: { id },
        relations: ['items', 'items.product', 'market', 'customer', 'post', 'post.courier'],
      });

      if (!newOrder) {
        throw new NotFoundException('Order not found');
      }
      return successRes(newOrder, 200, 'Order by id');
    } catch (error) {
      return catchError(error);
    }
  }

  async findByQrCode(token: string) {
    try {
      const order = await this.orderRepo.findOne({
        where: { qr_code_token: token },
        relations: ['customer', 'customer.district', 'items', 'items.product'],
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
  ): Promise<Object> {
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
            const isExistProduct = await queryRunner.manager.findOne(
              ProductEntity,
              {
                where: { id: o_item.product_id },
              },
            );
            if (!isExistProduct) {
              throw new NotFoundException('Product not found');
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
        if (updateOrderDto.where_deliver !== undefined) {
          editingOrder.where_deliver = updateOrderDto.where_deliver;
        }
        if (updateOrderDto.total_price !== undefined) {
          editingOrder.total_price = updateOrderDto.total_price;
        }
        if (updateOrderDto.comment !== undefined) {
          editingOrder.comment = updateOrderDto.comment;
        }

        await queryRunner.manager.save(editingOrder);

        await queryRunner.commitTransaction();
        return successRes(editingOrder, 200, 'Order updated');
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
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search)',
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
      const districtIds = newOrders.map((o) => {
        const customer = customerMap.get(o.customer_id);
        return o.district_id || customer?.district_id;
      }).filter(Boolean);

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

  async receiveWithScaner(id: string, orderDto: OrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (!orderDto.marketId) {
        throw new BadRequestException('Market id is required');
      }
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: {
          qr_code_token: id,
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
        return successRes({}, 200, 'Order closed');
      }
      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: order.customer_id, role: Roles.CUSTOMER },
        relations: ['district'],
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      let newPost = await queryRunner.manager.findOne(PostEntity, {
        where: {
          region_id: customer.district.assigned_region,
          status: Post_status.NEW,
        },
      });
      if (!newPost) {
        newPost = queryRunner.manager.create(PostEntity, {
          region_id: customer.district.assigned_region,
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
      const {
        page = 1,
        search,
        status,
        startDate,
        endDate,
        regionId,
      } = query;
      const fetchAll =
        query.fetchAll === true || (query.fetchAll as any) === 'true';
      const limit = getSafeLimit(query.limit, fetchAll);

      const qb = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .where('order.user_id = :userId', { userId: user.id })
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
        qb.andWhere('order.status IN (:...statuses)', { statuses: statusArray });
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
        .leftJoinAndSelect('customer.district', 'district')
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
            Order_status.ON_THE_ROAD,
          ],
        });
      }

      // search filter
      if (query.search) {
        qb.andWhere(
          '(customer.name ILIKE :search OR customer.phone_number ILIKE :search)',
          { search: `%${query.search}%` },
        );
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
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id, status: Order_status.WAITING },
      });
      if (!order)
        throw new NotFoundException('Order not found or not in waiting status');

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

      const marketTarif =
        order.where_deliver === Where_deliver.CENTER
          ? market.tariff_center
          : market.tariff_home;

      const courierTarif =
        order.where_deliver === Where_deliver.CENTER
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
        // Sotilgan paytdagi tariflarni saqlash (tarix uchun)
        market_tariff: marketTarif,
        courier_tariff: courierTarif,
      });

      await queryRunner.manager.save(order);

      // === Extra cost (agar bo'lsa) ===
      // Telefon brauzerdan kelishi mumkin bo'lgan formatlar uchun raqamga aylantirish
      const extraCost = sellDto.extraCost
        ? Number(String(sellDto.extraCost).replace(/[^\d.-]/g, ''))
        : 0;

      if (extraCost > 0) {
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

      await queryRunner.commitTransaction();
      await this.orderBotService.syncStatusButton(order.id);
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
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
        relations: ['items', 'items.product'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const marketId = order.user_id;
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: marketId, role: Roles.MARKET },
      });
      if (!market) {
        throw new NotFoundException('This orders owner is not found');
      }

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
      });
      await queryRunner.manager.save(order);
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

      await this.botService.sendMessageToGroup(
        telegramGroup?.group_id || null,
        `*❌ Buyurtma bekor qilindi!*\n\n` +
          `👤 *Mijoz:* ${customer?.name}\n` +
          `📞 *Telefon:* ${customer?.phone_number}\n` +
          `📍 *Manzil:* ${customer?.district.region.name}, ${customer?.district.name}\n\n` +
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

      await queryRunner.commitTransaction();
      await this.orderBotService.syncStatusButton(order.id);
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

      // 1️⃣ Check order
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id, status: Order_status.WAITING },
        relations: ['items', 'items.product'],
      });
      if (!order)
        throw new NotFoundException('Order not found or not in Waiting status');

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

      // 4️⃣ Tariffs
      const marketBalanceBefore = Number(marketCashbox.balance);

      const marketTarif =
        order.where_deliver === Where_deliver.CENTER
          ? market.tariff_center
          : market.tariff_home;

      const courierTarif =
        order.where_deliver === Where_deliver.CENTER
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
        comment: finalComment,
        product_quantity: totalNewQty,
        sold_at: order.sold_at ?? Date.now(),
        // Sotilgan paytdagi tariflarni saqlash (tarix uchun)
        market_tariff: order.market_tariff ?? marketTarif,
        courier_tariff: order.courier_tariff ?? courierTarif,
      });
      await queryRunner.manager.save(order);

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
              `📍 *Manzil:* ${customer?.district.region.name}, ${customer?.district.name}\n\n` +
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
          `📍 *Manzil:* ${customer?.district.region.name}, ${customer?.district.name}\n\n` +
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
      await this.orderBotService.syncStatusButton(order.id);
      return successRes({}, 200, 'Order qisman sotildi');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async rollbackOrderToWaiting(user: JwtPayload, id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
        relations: ['market', 'post'],
      });
      if (!order) throw new NotFoundException('Order not found');

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

      // Qo'shimcha xarajatni olish (agar mavjud bo‘lsa)
      const extraCostHistory = await queryRunner.manager.findOne(
        CashboxHistoryEntity,
        {
          where: {
            source_id: order.id,
            source_type: Source_type.EXTRA_COST,
            cashbox_id: marketCashbox.id,
          },
          order: { created_at: 'DESC' },
        },
      );

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

        // Qo'shimcha xarajat rollback (agar mavjud va vaqti yaqin bo‘lsa)
        const soldTime = Number(order.sold_at);
        const extraCostTime = Number(extraCostHistory?.created_at);
        const diff = Math.abs(soldTime - extraCostTime);

        if (extraCostHistory && diff <= 5000) {
          const extraAmount = Number(extraCostHistory.amount);

          // Market kassasiga qaytarish
          marketCashbox.balance += extraAmount;
          await queryRunner.manager.save(marketCashbox);
          await queryRunner.manager.save(
            queryRunner.manager.create(CashboxHistoryEntity, {
              operation_type: Operation_type.INCOME,
              cashbox_id: marketCashbox.id,
              source_id: order.id,
              source_type: Source_type.CORRECTION,
              amount: extraAmount,
              balance_after: marketCashbox.balance,
              comment: "Qo'shimcha xarajat orqaga qaytarildi",
              created_by: user.id,
            }),
          );

          // Courier kassasiga qaytarish
          courierCashbox.balance += extraAmount;
          await queryRunner.manager.save(courierCashbox);
          await queryRunner.manager.save(
            queryRunner.manager.create(CashboxHistoryEntity, {
              operation_type: Operation_type.INCOME,
              cashbox_id: courierCashbox.id,
              source_id: order.id,
              source_type: Source_type.CORRECTION,
              amount: extraAmount,
              balance_after: courierCashbox.balance,
              comment: "Qo'shimcha xarajat orqaga qaytarildi",
              created_by: user.id,
            }),
          );
        }
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

        // Qo'shimcha xarajat rollback (agar mavjud va vaqti yaqin bo‘lsa)
        const soldTime = Number(order.sold_at);
        const extraCostTime = Number(extraCostHistory?.created_at);
        const diff = Math.abs(soldTime - extraCostTime);

        if (extraCostHistory && diff <= 5000) {
          const extraAmount = Number(extraCostHistory.amount);

          marketCashbox.balance += extraAmount;
          await queryRunner.manager.save(marketCashbox);
          await queryRunner.manager.save(
            queryRunner.manager.create(CashboxHistoryEntity, {
              operation_type: Operation_type.INCOME,
              cashbox_id: marketCashbox.id,
              source_id: order.id,
              source_type: Source_type.CORRECTION,
              amount: extraAmount,
              balance_after: marketCashbox.balance,
              comment: "Qo'shimcha xarajat orqaga qaytarildi",
              created_by: user.id,
            }),
          );

          courierCashbox.balance += extraAmount;
          await queryRunner.manager.save(courierCashbox);
          await queryRunner.manager.save(
            queryRunner.manager.create(CashboxHistoryEntity, {
              operation_type: Operation_type.INCOME,
              cashbox_id: courierCashbox.id,
              source_id: order.id,
              source_type: Source_type.CORRECTION,
              amount: extraAmount,
              balance_after: courierCashbox.balance,
              comment: "Qo'shimcha xarajat orqaga qaytarildi",
              created_by: user.id,
            }),
          );
        }
      }

      // === ROLLBACK FOR CANCELLED ===
      if (
        (order.status === Order_status.CANCELLED && extraCostHistory) ||
        (order.status === Order_status.CLOSED && extraCostHistory)
      ) {
        const orderLastUpdateTime = Number(order.updated_at);
        const extraCostTime = Number(extraCostHistory?.created_at);
        const diff = Math.abs(orderLastUpdateTime - extraCostTime);

        if (diff <= 5000) {
          const extraAmount = Number(extraCostHistory.amount);

          marketCashbox.balance += extraAmount;
          await queryRunner.manager.save(marketCashbox);
          await queryRunner.manager.save(
            queryRunner.manager.create(CashboxHistoryEntity, {
              operation_type: Operation_type.INCOME,
              cashbox_id: marketCashbox.id,
              source_id: order.id,
              source_type: Source_type.CORRECTION,
              amount: extraAmount,
              balance_after: marketCashbox.balance,
              comment:
                "Bekor qilingan buyurtmaga yozilgan qo'shimcha xarajat orqaga qaytarildi",
              created_by: user.id,
            }),
          );

          courierCashbox.balance += extraAmount;
          await queryRunner.manager.save(courierCashbox);
          await queryRunner.manager.save(
            queryRunner.manager.create(CashboxHistoryEntity, {
              operation_type: Operation_type.INCOME,
              cashbox_id: courierCashbox.id,
              source_id: order.id,
              source_type: Source_type.CORRECTION,
              amount: extraAmount,
              balance_after: courierCashbox.balance,
              comment:
                "Bekor qilingan buyurtmaga yozilgan qo'shimcha xarajat orqaga qaytarildi",
              created_by: user.id,
            }),
          );
        }
      }

      // === Update order status ===
      if (isSuperAdmin && [Order_status.PAID, Order_status.PARTLY_PAID].includes(order.status)) {
        Object.assign(order, {
          status: Order_status.WAITING,
          paid_amount: 0,
          sold_at: null,
        });
      } else {
        Object.assign(order, {
          status: Order_status.WAITING,
          sold_at: null,
          to_be_paid: 0,
        });
      }
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
      await this.orderBotService.syncStatusButton(order.id);
      return successRes({}, 200, 'Order WAITING holatiga qaytarildi');
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
          `COUNT(CASE WHEN o.created_at BETWEEN :start AND :end THEN 1 END)`,
          'acceptedCount',
        )
        .addSelect(
          `COUNT(CASE WHEN o.updated_at BETWEEN :start AND :end AND o.status = :cancelledStatus THEN 1 END)`,
          'cancelled',
        )
        .addSelect(
          `COUNT(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...soldStatuses) THEN 1 END)`,
          'soldAndPaid',
        )
        .setParameters({
          start,
          end,
          cancelledStatus: Order_status.CANCELLED,
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

      // 1) totalOrders: created_at oralig'ida yaratilgan buyurtmalar soni per market
      const totalsRaw = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'user_id')
        .addSelect('COUNT(*)', 'total')
        .where('o.created_at BETWEEN :start AND :end', { start, end })
        .andWhere('o.user_id IS NOT NULL')
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
      const now = Date.now();
      let start: number;
      let end: number;
      let groupFormat: string;
      let labelFormat: string;

      // Default oraliqlar
      if (startDate && endDate) {
        // String formatdagi sana keladi (YYYY-MM-DD), timestamp ga o'giramiz
        start = new Date(startDate).setHours(0, 0, 0, 0);
        end = new Date(endDate).setHours(23, 59, 59, 999);
      } else {
        end = now;
        switch (period) {
          case 'daily':
            start = now - 30 * 24 * 60 * 60 * 1000; // Oxirgi 30 kun
            break;
          case 'weekly':
            start = now - 12 * 7 * 24 * 60 * 60 * 1000; // Oxirgi 12 hafta
            break;
          case 'monthly':
            start = now - 12 * 30 * 24 * 60 * 60 * 1000; // Oxirgi 12 oy
            break;
          case 'yearly':
            start = now - 5 * 365 * 24 * 60 * 60 * 1000; // Oxirgi 5 yil
            break;
        }
      }

      // SQL formatlar
      switch (period) {
        case 'daily':
          groupFormat = "TO_CHAR(TO_TIMESTAMP(o.sold_at / 1000), 'YYYY-MM-DD')";
          labelFormat = 'DD.MM';
          break;
        case 'weekly':
          groupFormat = "TO_CHAR(TO_TIMESTAMP(o.sold_at / 1000), 'IYYY-IW')";
          labelFormat = 'WW';
          break;
        case 'monthly':
          groupFormat = "TO_CHAR(TO_TIMESTAMP(o.sold_at / 1000), 'YYYY-MM')";
          labelFormat = 'MM.YYYY';
          break;
        case 'yearly':
          groupFormat = "TO_CHAR(TO_TIMESTAMP(o.sold_at / 1000), 'YYYY')";
          labelFormat = 'YYYY';
          break;
      }

      const result = await this.orderRepo.query(
        `
        SELECT
          ${groupFormat} as period,
          TO_CHAR(TO_TIMESTAMP(MIN(o.sold_at) / 1000), '${labelFormat}') as label,
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
        .select(
          `COUNT(CASE WHEN o.updated_at BETWEEN :start AND :end THEN 1 END)`,
          'totalOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) THEN 1 END)`,
          'soldOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.updated_at BETWEEN :start AND :end AND o.status = :cancelledStatus THEN 1 END)`,
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
          cancelledStatus: Order_status.CANCELLED,
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
      const oldOrdersProfit = oldAddressCount * tariffHome + oldCenterCount * tariffCenter;
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

      const validStatuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ];

      // Bitta optimallashtirilgan query - barcha statistikani olish
      const statsResult = await this.orderRepo
        .createQueryBuilder('o')
        .select(
          `COUNT(CASE WHEN o.created_at BETWEEN :start AND :end THEN 1 END)`,
          'totalOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.created_at BETWEEN :start AND :end AND o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) THEN 1 END)`,
          'soldOrders',
        )
        .addSelect(
          `COUNT(CASE WHEN o.created_at BETWEEN :start AND :end AND o.updated_at BETWEEN :start AND :end AND o.status = :cancelledStatus THEN 1 END)`,
          'canceledOrders',
        )
        .addSelect(
          `SUM(CASE WHEN o.created_at BETWEEN :start AND :end AND o.sold_at BETWEEN :start AND :end AND o.status IN (:...validStatuses) THEN o.to_be_paid ELSE 0 END)`,
          'profit',
        )
        .where('o.user_id = :marketId', { marketId: user.id })
        .setParameters({
          start,
          end,
          validStatuses,
          cancelledStatus: Order_status.CANCELLED,
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

  async remove(id: string) {
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
      const acceptedStatuses = [Order_status.NEW, Order_status.RECEIVED];
      if (!acceptedStatuses.includes(order.status)) {
        throw new BadRequestException('You can not delete...!!!');
      }

      // Post ID ni olish (oddiy post yoki canceled post)
      const postId = order.post_id || order.canceled_post_id;

      // Orderni o'chirish
      await queryRunner.manager.delete(OrderEntity, { id });

      // Agar order postga tegishli bo'lsa, postni yangilash
      if (postId) {
        const post = await queryRunner.manager.findOne(PostEntity, {
          where: { id: postId },
        });

        if (post) {
          // Post ichidagi qolgan orderlar sonini hisoblash
          const remainingOrdersCount = await queryRunner.manager.count(
            OrderEntity,
            {
              where: [{ post_id: postId }, { canceled_post_id: postId }],
            },
          );

          if (remainingOrdersCount === 0) {
            // Agar orderlar qolmagan bo'lsa, postni ham o'chirish
            await queryRunner.manager.delete(PostEntity, { id: postId });
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
          qb.andWhere('order.status IN (:...statuses)', { statuses: statusArray });
        } else {
          qb.andWhere('order.status != :createdStatus', {
            createdStatus: Order_status.CREATED,
          });
        }

        if (filters.marketId) {
          qb.andWhere('order.user_id = :marketId', { marketId: filters.marketId });
        }

        if (filters.regionId) {
          qb.andWhere('region.id = :regionId', { regionId: filters.regionId });
        }

        if (filters.search) {
          qb.andWhere(
            '(customer.name ILIKE :search OR customer.phone_number ILIKE :search)',
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
            region: order.customer?.district?.region?.name || '-',
            district: order.customer?.district?.name || '-',
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
        res.status(500).json({ message: 'Excel export failed', error: error.message });
      }
    }
  }

  // Buyurtma manzilini yangilash (faqat buyurtma uchun, mijozga tegmaydi)
  async updateOrderAddress(
    id: string,
    updateOrderAddressDto: UpdateOrderAddressDto,
  ): Promise<Object> {
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
          'Bu holatdagi buyurtma manzilini o\'zgartirish mumkin emas',
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
      }

      if (updateOrderAddressDto.address !== undefined) {
        order.address = updateOrderAddressDto.address;
      }

      await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

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
      const defaultWhereDeliver =
        market.default_tariff || Where_deliver.CENTER;

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

      for (const extOrder of orders) {
        // Field mapping orqali qiymatlarni olish
        const externalId = this.getFieldValue(extOrder, field_mapping.id_field);
        const qrCode = this.getFieldValue(
          extOrder,
          field_mapping.qr_code_field,
        );
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

      return successRes(
        {
          created_orders: createdOrders.length,
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
        `${createdOrders.length} ta tashqi buyurtma qabul qilindi (${integration.name})`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
