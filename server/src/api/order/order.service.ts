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
import { OrderBotService } from '../bots/order_create-bot/order-bot.service';

@Injectable()
export class OrderService extends BaseService<CreateOrderDto, OrderEntity> {
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
  ) {
    super(orderRepo);
  }

  async allOrders(query: {
    status?: string;
    marketId?: string;
    regionId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      // 📌 limit default 10, agar 0 bo‘lsa → unlimited
      let { limit = 10, page = 1 } = query;
      const unlimited = limit === 0;

      const qb = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region')
        .leftJoinAndSelect('district.assignedToRegion', 'assignedToRegion')
        .leftJoinAndSelect('order.market', 'market')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .orderBy('order.created_at', 'DESC');

      if (query.status) {
        qb.andWhere('order.status = :status', { status: query.status });
      }

      if (query.marketId) {
        qb.andWhere('order.user_id = :marketId', { marketId: query.marketId });
      }

      if (query.regionId) {
        qb.andWhere('region.id = :regionId', { regionId: query.regionId });
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

      // 🔢 Pagination (faqat limit > 0 bo‘lsa)
      if (!unlimited) {
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);
      }

      const [data, total] = await qb.getManyAndCount();

      return successRes(
        {
          data,
          total,
          page: unlimited ? 1 : page,
          limit: unlimited ? total : limit,
          totalPages: unlimited ? 1 : Math.ceil(total / limit),
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
      } = createOrderDto;

      let { market_id } = createOrderDto;

      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: market_id, role: Roles.MARKET },
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }
      if (!market_id && user.role === Roles.MARKET) {
        market_id = user.id;
      }

      if (user.role === Roles.MARKET && user.id != market_id) {
        throw new BadRequestException('Market Id is not match!');
      }

      if (user.role === Roles.MARKET && market.add_order) {
        throw new BadRequestException('You can not create order and product');
      }

      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id: customer_id, role: Roles.CUSTOMER },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const qr_code_token = generateCustomToken();

      const newOrder = queryRunner.manager.create(OrderEntity, {
        user_id: market_id,
        comment,
        operator,
        total_price,
        where_deliver: where_deliver || Where_deliver.CENTER,
        status: Order_status.NEW,
        qr_code_token,
        customer_id,
      });

      await queryRunner.manager.save(newOrder);

      let product_quantity: number = 0;
      for (const o_item of order_item_info) {
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
          orderId: newOrder.id,
        });
        await queryRunner.manager.save(newOrderItem);
        product_quantity += Number(o_item.quantity);
      }

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
        status: Order_status.NEW,
        qr_code_token,
        comment,
      });
      await queryRunner.manager.save(newOrder);

      let product_quantity: number = 0;
      for (const o_item of order_item_info) {
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
          orderId: newOrder.id,
        });
        await queryRunner.manager.save(newOrderItem);
        product_quantity += Number(o_item.quantity);
      }

      Object.assign(newOrder, {
        product_quantity,
      });

      await queryRunner.manager.save(newOrder);

      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: newOrder.id },
        relations: ['items', 'items.product'],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const telegramGroup = await queryRunner.manager.find(TelegramEntity, {
        where: { market_id: order.user_id, group_type: Group_type.CREATE },
      });
      // created_at string yoki bigint bo'lishi mumkin

      // console.log(telegramGroup);

      await Promise.all(
        telegramGroup.map((groupId: any) => {
          return this.orderBotService.sendMessageToCreateGroup(
            groupId || null,
            `*✅ Yangi buyurtma!*\n\n` +
              `👤 *Mijoz:* ${customer?.name}\n` +
              `📞 *Telefon:* ${customer?.phone_number}\n` +
              `📍 *Manzil:* ${customer?.district.region.name}, ${customer?.district.name}\n\n` +
              `📦 *Buyurtmalar:*\n${order.items
                .map(
                  (item, i) =>
                    `   ${i + 1}. ${item.product.name} — ${item.quantity} dona`,
                )
                .join('\n')}\n\n` +
              `💰 *Narxi:* ${order.total_price} so‘m\n` +
              `🕒 *Yaratilgan vaqti:* ${new Date(
                Number(order.created_at),
              ).toLocaleString('uz-UZ')}\n\n` +
              `🧑‍💻 *Operator:* ${order.operator || '-'}\n\n` +
              `📝 *Izoh:* ${order.comment || '-'}\n`,
          );
        }),
      );

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
        relations: ['items', 'items.product', 'market', 'customer'],
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

      const districtIds = customers.map((c) => c.district_id);
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

      // 3️⃣ Ordersni postlarga bog‘lash
      for (const order of newOrders) {
        const customer = customerMap.get(order.customer_id);
        if (!customer)
          throw new NotFoundException(
            `Customer not found for order ${order.id}`,
          );

        const district = districtMap.get(customer.district_id);
        if (!district)
          throw new NotFoundException(
            `District not found for customer ${customer.id}`,
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
      status?: string;
      regionId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        startDate,
        endDate,
        regionId,
      } = query;

      const qb = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.region', 'region')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .where('order.user_id = :userId', { userId: user.id })
        .orderBy('order.created_at', 'DESC');

      // 🔍 Search by customer name or order ID
      if (search) {
        qb.andWhere(
          '(LOWER(customer.name) LIKE LOWER(:search) OR LOWER(customer.phone_number) LIKE :search OR CAST(order.id AS TEXT) LIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 🎯 Filter by order status
      if (status) {
        qb.andWhere('order.status = :status', { status });
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
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
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
      const limit = query.limit && query.limit > 0 ? query.limit : 10;
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
        qb.andWhere('o.status = :status', { status: query.status });
      } else {
        qb.andWhere('o.status NOT IN (:...excluded)', {
          excluded: [
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

      // === Update order ===
      Object.assign(order, {
        status: Order_status.SOLD,
        to_be_paid,
        comment: finalComment,
        sold_at: Date.now(),
      });
      await queryRunner.manager.save(order);

      // === Extra cost (agar bo‘lsa) ===
      if (sellDto.extraCost) {
        const extra = Number(sellDto.extraCost);
        await Promise.all([
          updateCashbox(
            marketCashbox,
            Operation_type.EXPENSE,
            extra,
            order.id,
            Source_type.EXTRA_COST,
            finalComment,
            courier.id,
          ),
          updateCashbox(
            courierCashbox,
            Operation_type.EXPENSE,
            extra,
            order.id,
            Source_type.EXTRA_COST,
            finalComment,
            courier.id,
          ),
        ]);
      }

      await queryRunner.commitTransaction();
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
      // console.log(cancelOrderDto.extraCost, 'BBBBBBBBBBBBBB');

      if (cancelOrderDto.extraCost) {
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
        courierCashbox.balance -= cancelOrderDto.extraCost;
        await queryRunner.manager.save(courierCashbox);
        marketCashbox.balance -= cancelOrderDto.extraCost;
        await queryRunner.manager.save(marketCashbox);

        const courierHistory = queryRunner.manager.create(
          CashboxHistoryEntity,
          {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: courierCashbox.id,
            source_type: Source_type.EXTRA_COST,
            source_id: order.id,
            amount: cancelOrderDto.extraCost,
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
          amount: cancelOrderDto.extraCost,
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
      // created_at string yoki bigint bo'lishi mumkin

      // console.log(telegramGroup);

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
          `💰 *Narxi:* ${order.total_price} so‘m\n` +
          `🕒 *Yaratilgan vaqti:* ${new Date(Number(order.created_at)).toLocaleString('uz-UZ')}\n\n` +
          `🚚 *Kurier:* ${post?.courier?.name || '-'}\n` +
          `📞 *Kurier bilan aloqa:* ${post?.courier?.phone_number || '-'}\n\n` +
          `📝 *Izoh:* ${order.comment || '-'}\n`,
      );

      await queryRunner.commitTransaction();
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
      Object.assign(order, {
        status: Order_status.SOLD,
        to_be_paid,
        total_price: price,
        comment: finalComment,
        product_quantity: totalNewQty,
        sold_at: order.sold_at ?? Date.now(),
      });
      await queryRunner.manager.save(order);

      // 9️⃣ Extra cost
      if (extraCost) {
        const cost = Number(extraCost);
        await Promise.all([
          updateCashbox(
            marketCashbox,
            Operation_type.EXPENSE,
            cost,
            order.id,
            Source_type.EXTRA_COST,
            finalComment,
            courier.id,
          ),
          updateCashbox(
            courierCashbox,
            Operation_type.EXPENSE,
            cost,
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
              `📞 *Kurier bilan aloqa:* ${post?.courier?.phone_number || '-'}\n\n` +
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
          `💰 *Oldingi narxi:* ${oldTotalPrice} so‘m\n` +
          `💰 *Sotilgan narxi:* ${order.total_price} so‘m\n` +
          `🕒 *Yaratilgan vaqti:* ${new Date(Number(order.created_at)).toLocaleString('uz-UZ')}\n\n` +
          `🚚 *Kurier:* ${post?.courier?.name || '-'}\n` +
          `📞 *Kurier bilan aloqa:* ${post?.courier?.phone_number || '-'}\n\n` +
          `📝 *Izoh:* ${order.comment || '-'}\n`,
      );

      await queryRunner.commitTransaction();
      return successRes({}, 200, 'Order qisman sotildi');
    } catch (error) {
      console.log(error);
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
      if (
        user.role === Roles.SUPERADMIN &&
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

      // === ROLLBACK FOR SOLD ===
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

      // === ROLLBACK FOR PARTLY PAID ===

      if (order.status === Order_status.PARTLY_PAID) {
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
      Object.assign(order, {
        status: Order_status.WAITING,
        sold_at: null,
        to_be_paid: 0,
      });
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
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
      const acceptedCount = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.created_at BETWEEN :start AND :end', {
          start,
          end,
        })
        .getCount();

      const cancelled = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.updated_at BETWEEN :start AND :end', {
          start,
          end,
        })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [Order_status.CANCELLED],
        })
        .getCount();

      const soldAndPaid = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.sold_at BETWEEN :start AND :end', {
          start,
          end,
        })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [
            Order_status.SOLD,
            Order_status.PARTLY_PAID,
            Order_status.PAID,
          ],
        })
        .getCount();

      const allSoldOrders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.sold_at BETWEEN :start AND :end', {
          start,
          end,
        })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [
            Order_status.SOLD,
            Order_status.PAID,
            Order_status.PARTLY_PAID,
          ],
        })
        .getMany();

      let profit = 0;

      for (const order of allSoldOrders) {
        const market = await this.userRepo.findOne({
          where: { id: order.user_id },
        });
        let courier: any = null;

        if (order.post_id) {
          const post = await this.postRepo.findOne({
            where: { id: order.post_id },
          });
          if (post?.courier_id) {
            courier = await this.userRepo.findOne({
              where: { id: post.courier_id },
            });
          }
        }

        profit +=
          order.where_deliver === Where_deliver.ADDRESS
            ? Number(market?.tariff_home ?? 0) -
              Number(courier?.tariff_home ?? 0)
            : Number(market?.tariff_center ?? 0) -
              Number(courier?.tariff_center ?? 0);
      }

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

      // 2) soldOrders: shu davrda yaratilgan AND shu davrda sotilgan AND status IN (...)
      const statuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ];

      const soldsRaw = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'user_id')
        .addSelect('COUNT(*)', 'sold')
        .where('o.created_at BETWEEN :start AND :end', { start, end }) // yaratilgan davr
        .andWhere('o.sold_at BETWEEN :start AND :end', { start, end }) // sotilgan davr
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

      // 🔹 1. Faqat so‘nggi 30 kun ichida yangilangan postlarni olish
      const recentThreshold = end - 30 * 24 * 60 * 60 * 1000;

      const recentPosts = await this.postRepo
        .createQueryBuilder('p')
        .where('p.updated_at > :threshold', { threshold: recentThreshold })
        .select(['p.id', 'p.courier_id'])
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
      // Oxirgi 30 kunlik timestamp (millisekund)
      const lastMonth = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const result = await this.orderRepo
        .createQueryBuilder('order')
        .select('market.id', 'market_id')
        .addSelect('market.name', 'market_name')
        .addSelect('COUNT(order.id)', 'total_orders')
        .addSelect(
          `SUM(CASE WHEN order.status IN (:...statuses) THEN 1 ELSE 0 END)`,
          'successful_orders',
        )
        .addSelect(
          `ROUND(
          (SUM(CASE WHEN order.status IN (:...statuses) THEN 1 ELSE 0 END)::decimal
          / NULLIF(COUNT(order.id), 0)) * 100, 2
        )`,
          'success_rate',
        )
        .innerJoin('order.market', 'market')
        .where('market.role = :role', { role: Roles.MARKET })
        .andWhere('order.created_at >= :lastMonth', { lastMonth })
        .setParameter('statuses', [
          Order_status.SOLD,
          Order_status.PAID,
          Order_status.PARTLY_PAID,
        ])
        .groupBy('market.id')
        .orderBy('success_rate', 'DESC')
        .limit(limit)
        .getRawMany();

      return successRes(result, 200, 'Top Markets (last 30 days)');
    } catch (error) {
      return catchError(error);
    }
  }

  async getTopCouriers(limit = 10) {
    try {
      // Oxirgi 30 kunlik timestamp (millisekund)
      const lastMonth = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const result = await this.orderRepo
        .createQueryBuilder('order')
        .select('courier.id', 'courier_id')
        .addSelect('courier.name', 'courier_name')
        .addSelect('COUNT(order.id)', 'total_orders')
        .addSelect(
          `SUM(CASE WHEN order.status IN (:...statuses) THEN 1 ELSE 0 END)`,
          'successful_orders',
        )
        .addSelect(
          `ROUND(
          (SUM(CASE WHEN order.status IN (:...statuses) THEN 1 ELSE 0 END)::decimal
          / NULLIF(COUNT(order.id), 0)) * 100, 2
        )`,
          'success_rate',
        )
        .innerJoin('order.post', 'post')
        .innerJoin('post.courier', 'courier')
        .where('courier.role = :role', { role: Roles.COURIER })
        .andWhere('order.created_at >= :lastMonth', { lastMonth })
        .setParameter('statuses', [
          Order_status.SOLD,
          Order_status.PAID,
          Order_status.PARTLY_PAID,
        ])
        .groupBy('courier.id')
        .orderBy('success_rate', 'DESC')
        .limit(limit)
        .getRawMany();

      return successRes(result, 200, 'Top Couriers (last 30 days)');
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

      // 🔹 1. Faqat shu kuryerning OXIRGI faol postlari (masalan, so'nggi 30 kun ichida yangilangan)
      const recentThreshold = end - 30 * 24 * 60 * 60 * 1000; // 30 kun oldingi timestamp

      const courierPosts = await this.postRepo
        .createQueryBuilder('p')
        .where('p.courier_id = :courierId', { courierId: user.id })
        .andWhere('p.updated_at > :threshold', { threshold: recentThreshold })
        .select(['p.id'])
        .getMany();

      const postIds = courierPosts.map((p) => p.id);
      if (postIds.length === 0) {
        return successRes(
          {
            totalOrders: 0,
            soldOrders: 0,
            canceledOrders: 0,
            profit: 0,
            successRate: 0,
          },
          200,
          'Couriers stats',
        );
      }

      // 🔹 2. Shu postlar ichidagi shu davrdagi orderlar
      const orderQuery = this.orderRepo
        .createQueryBuilder('o')
        .where('o.post_id IN (:...postIds)', { postIds })
        .andWhere('o.updated_at BETWEEN :start AND :end', { start, end });

      const [totalOrders, soldOrders, canceledOrders, soldOrderEntities] =
        await Promise.all([
          orderQuery.getCount(),
          this.orderRepo
            .createQueryBuilder('o')
            .where('o.post_id IN (:...postIds)', { postIds })
            .andWhere('o.sold_at BETWEEN :start AND :end', { start, end })
            .andWhere('o.status IN (:...validStatuses)', { validStatuses })
            .getCount(),
          this.orderRepo
            .createQueryBuilder('o')
            .where('o.post_id IN (:...postIds)', { postIds })
            .andWhere('o.updated_at BETWEEN :start AND :end', { start, end })
            .andWhere('o.status = :status', { status: Order_status.CANCELLED })
            .getCount(),
          this.orderRepo
            .createQueryBuilder('o')
            .where('o.post_id IN (:...postIds)', { postIds })
            .andWhere('o.sold_at BETWEEN :start AND :end', { start, end })
            .andWhere('o.status IN (:...validStatuses)', { validStatuses })
            .getMany(),
        ]);

      const courier = await this.userRepo.findOne({ where: { id: user.id } });

      let profit = 0;
      for (const order of soldOrderEntities) {
        profit +=
          order.where_deliver === Where_deliver.ADDRESS
            ? Number(courier?.tariff_home ?? 0)
            : Number(courier?.tariff_center ?? 0);
      }

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

      // 1️⃣ Shu davrdagi barcha postlar
      const allOrders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.created_at BETWEEN :start AND :end', { start, end })
        .andWhere('o.user_id = :marketId', { marketId: user.id })
        .getMany();

      const validStatuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
      ];

      const orderIds = allOrders.map((o) => o.id);

      if (orderIds.length === 0) {
        return successRes(
          {
            totalOrders: 0,
            soldOrders: 0,
            canceledOrders: 0,
            profit: 0,
            successRate: 0,
          },
          200,
          'Couriers stats',
        );
      }

      // 🔹 Shu marketning sotilgan orderlari
      const soldOrders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.id IN (:...orderIds)', { orderIds })
        .andWhere('o.sold_at BETWEEN :start AND :end', { start, end })
        .andWhere('o.status IN (:...validStatuses)', { validStatuses })
        .getCount();

      const canceledOrders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.id IN (:...orderIds)', { orderIds })
        .andWhere('o.updated_at BETWEEN :start AND :end', { start, end })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [Order_status.CANCELLED],
        })
        .getCount();

      const allSoldOrders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.id IN (:...orderIds)', { orderIds })
        .andWhere('o.sold_at BETWEEN :start AND :end', { start, end })
        .andWhere('o.status IN (:...validStatuses)', { validStatuses })
        .getMany();

      let profit: number = 0;
      for (const order of allSoldOrders) {
        profit += order.to_be_paid;
      }

      const successRate =
        allOrders.length > 0
          ? Number(((soldOrders * 100) / allOrders.length).toFixed(2))
          : 0;

      return successRes(
        {
          totalOrders: allOrders.length,
          soldOrders,
          canceledOrders,
          profit,
          successRate,
        },
        200,
        'Couriers stats',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string) {
    try {
      const order = await this.orderRepo.findOne({
        where: { id },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      const acceptedStatuses = [Order_status.NEW, Order_status.RECEIVED];
      if (!acceptedStatuses.includes(order.status)) {
        throw new BadRequestException('You can not delete...!!!');
      }
      await this.orderRepo.delete(id);
      return successRes({}, 200, 'Order deleted');
    } catch (error) {
      return catchError(error);
    }
  }
}
