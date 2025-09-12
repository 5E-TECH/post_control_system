import {
  BadRequestException,
  Injectable,
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

    private readonly dataSource: DataSource,
    private readonly orderGateaway: OrderGateaway,
  ) {
    super(orderRepo);
  }

  async allOrders() {
    try {
      const allOrders = await this.orderRepo.find({
        order: { created_at: 'DESC' },
        relations: ['customer', 'customer.district', 'market', 'items'],
      });
    } catch (error) {}
  }

  async createOrder(createOrderDto: CreateOrderDto): Promise<Object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const {
        market_id,
        customer_id,
        order_item_info,
        total_price,
        where_deliver,
        comment,
      } = createOrderDto;

      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: market_id, role: Roles.MARKET },
      });
      if (!market) {
        throw new NotFoundException('Market not found');
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

  async haveNewOrderMarkets() {
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

      const allUniqueMarkets = await this.userRepo.find({
        where: { id: In(uniqueMarketIds), role: Roles.MARKET },
      });

      const todaysOrdersInfos: any[] = allUniqueMarkets.map(async (market) => {
        const marketsNewOrders = await this.orderRepo.find({
          where: { status: Order_status.NEW, user_id: market.id },
        });
        const orderTotalPrice: object = marketsNewOrders.map((order) => {
          let total_price: number = 0;
          total_price = order.total_price;
        });
      });

      // const marketsNewOrders;

      return successRes(
        {
          count: allUniqueMarkets.length,
          markets: allUniqueMarkets,
        },
        200,
        'Markets with new orders',
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async myNewOrders(user: JwtPayload) {
    try {
      const myNewOrders = await this.orderRepo.find({
        where: { status: Order_status.NEW, user_id: user.id },
        relations: ['customer', 'items', 'items.product'],
      });
      return successRes(myNewOrders, 200, 'My new orders');
    } catch (error) {
      return catchError(error);
    }
  }

  async newOrdersByMarketId(id: string) {
    try {
      const market = await this.userRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      const allNewOrders = await this.orderRepo.find({
        where: {
          user_id: id,
          status: Order_status.NEW,
        },
        relations: ['customer', 'customer.district', 'items', 'items.product'],
      });
      return successRes(allNewOrders, 200, `${market.name}'s new Orders`);
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string) {
    try {
      const newOrder = await this.orderRepo.findOne({ where: { id } });
      if (!newOrder) {
        throw new NotFoundException('Order not found');
      }
      return successRes(newOrder, 200, 'Order by id');
    } catch (error) {
      return catchError(error);
    }
  }

  async editOrder(id: string, updateOrderDto: UpdateOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const editingOrder = await this.orderRepo.findOne({ where: { id } });
      if (!editingOrder) {
        throw new NotFoundException('Order not found');
      }

      if (
        editingOrder.status === Order_status.NEW ||
        editingOrder.status === Order_status.RECEIVED
      ) {
        let product_quantity = 0;

        // 🟡 1. Edit order items
        if (
          updateOrderDto.order_item_info &&
          updateOrderDto.order_item_info.length > 0
        ) {
          // Old order items ni o'chiramiz
          await queryRunner.manager.delete(OrderItemEntity, {
            orderId: editingOrder.id,
          });

          for (const o_item of updateOrderDto.order_item_info) {
            const isExistProduct = await this.productRepo.findOne({
              where: { id: o_item.product_id },
            });
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

          Object.assign(editingOrder, {
            product_quantity,
          });
          await queryRunner.manager.save(editingOrder);
        }

        // 🟡 2. Edit order info
        const updateOrderFields: Partial<OrderEntity> = {};
        if (updateOrderDto.where_deliver)
          updateOrderFields.where_deliver = updateOrderDto.where_deliver;
        if (updateOrderDto.total_price)
          updateOrderFields.total_price = updateOrderDto.total_price;
        if (updateOrderDto.comment)
          updateOrderFields.comment = updateOrderDto.comment;

        if (Object.keys(updateOrderFields).length > 0) {
          Object.assign(editingOrder, {
            updateOrderFields,
          });
          await queryRunner.manager.save(editingOrder);
        }

        await queryRunner.commitTransaction();
        return successRes(null, 200, 'Order updated');
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

  async receiveNewOrders(ordersArray: OrdersArrayDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { order_ids } = ordersArray;

      // 1. Find new orders
      const newOrders = await queryRunner.manager.find(OrderEntity, {
        where: { id: In(order_ids), status: Order_status.NEW },
      });

      if (newOrders.length === 0) {
        throw new NotFoundException('No orders found!');
      }

      if (order_ids.length !== newOrders.length) {
        throw new BadRequestException(
          'Some orders are not found or not in NEW status',
        );
      }

      // 2. Fetch related data in bulk
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
      const posts = await queryRunner.manager.find(PostEntity, {
        where: { region_id: In(regionIds), status: Post_status.NEW },
      });
      const postMap = new Map(posts.map((p) => [p.region_id, p]));

      // 3. Assign orders to posts
      const newPosts: PostEntity[] = [];

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

        // Agar mavjud bo'lmasa yangi post yaratamiz
        if (!post) {
          post = queryRunner.manager.create(PostEntity, {
            region_id: district.assigned_region,
            qr_code_token: generateCustomToken(),
            post_total_price: 0,
            order_quantity: 0,
            status: Post_status.NEW,
          });
          newPosts.push(post);
          postMap.set(district.assigned_region, post);
        }

        // post statistikalarini yangilash
        post.post_total_price =
          (post.post_total_price ?? 0) + (order.total_price ?? 0);
        post.order_quantity = (post.order_quantity ?? 0) + 1;

        order.status = Order_status.RECEIVED;
        order.post_id = post.id; // yangi post bo‘lsa keyin save qilinganda id tushadi
      }

      // 4. Save new posts (yangi id olish uchun)
      if (newPosts.length > 0) {
        await queryRunner.manager.save(PostEntity, newPosts);

        // yangilangan post.id larni update qilamiz
        for (const order of newOrders) {
          if (!order.post_id) {
            const customer = customerMap.get(order.customer_id)!;
            const district = districtMap.get(customer.district_id)!;
            const post = postMap.get(district.assigned_region)!;
            order.post_id = post.id;
          }
        }
      }

      // 5. Save updated orders
      await queryRunner.manager.save(OrderEntity, newOrders);

      await queryRunner.commitTransaction();
      return successRes({}, 200, 'Orders received');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async sellOrder(
    user: JwtPayload,
    id: string,
    sellOrderDto: SellCancelOrderDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { extraCost, comment } = sellOrderDto;
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const deliveringPlace = order.where_deliver;
      const marketId = order.user_id;
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: marketId, role: Roles.MARKET },
      });
      if (!market) {
        throw new NotFoundException('This orders owner is not found');
      }
      const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.FOR_MARKET, user_id: marketId },
      });
      if (!marketCashbox) {
        throw new NotFoundException('Market cashbox not found');
      }

      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });
      if (!courier) {
        throw new NotFoundException('Courier not found');
      }

      const courierCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.FOR_COURIER, user_id: courier?.id },
      });

      if (!courierCashbox) {
        throw new NotFoundException('Courier cashbox not found');
      }

      const marketTarif: number =
        deliveringPlace === Where_deliver.CENTER
          ? market.tariff_center
          : market.tariff_home;

      const courierTarif: number =
        deliveringPlace === Where_deliver.CENTER
          ? courier.tariff_center
          : courier.tariff_home;

      const to_be_paid: number = extraCost
        ? order.total_price - extraCost - marketTarif
        : order.total_price - marketTarif;

      const courier_to_be_paid: number = extraCost
        ? order.total_price - extraCost - courierTarif
        : order.total_price - courierTarif;

      const finalComment = generateComment(order.comment, comment, extraCost);

      Object.assign(order, {
        status: Order_status.SOLD,
        to_be_paid,
        comment: finalComment,
      });
      await queryRunner.manager.save(order);

      marketCashbox.balance += to_be_paid;
      await queryRunner.manager.save(marketCashbox);
      const marketCashboxHistory = queryRunner.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.INCOME,
          cashbox_id: marketCashbox.id,
          source_id: order.id,
          source_type: Source_type.SELL,
          amount: to_be_paid,
          balance_after: marketCashbox.balance,
          comment: finalComment,
          created_by: courier.id,
        },
      );
      await queryRunner.manager.save(marketCashboxHistory);

      courierCashbox.balance += courier_to_be_paid;
      await queryRunner.manager.save(courierCashbox);
      const courierCashboxHistory = queryRunner.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.INCOME,
          cashbox_id: courierCashbox.id,
          source_type: Source_type.SELL,
          source_id: order.id,
          amount: courier_to_be_paid,
          balance_after: courierCashbox.balance,
          comment: finalComment,
          created_by: courier.id,
        },
      );
      await queryRunner.manager.save(courierCashboxHistory);
      await queryRunner.commitTransaction();

      this.orderGateaway;
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
      const { extraCost, comment } = cancelOrderDto;
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
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

      const finalComment = generateComment(order.comment, comment, extraCost);
      if (extraCost) {
        const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
          where: { cashbox_type: Cashbox_type.FOR_MARKET, user_id: marketId },
        });
        if (!marketCashbox) {
          throw new NotFoundException('Market cashbox not found');
        }
        marketCashbox.balance -= extraCost;
        await queryRunner.manager.save(marketCashbox);

        const history = queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: marketCashbox.id,
          source_type: Source_type.CANCEL,
          source_id: order.id,
          amount: extraCost,
          balance_after: marketCashbox.balance,
          comment: finalComment,
          created_by: currentUser.id,
        });
        await queryRunner.manager.save(history);
      }

      Object.assign(order, {
        status: Order_status.CANCELLED,
        comment: finalComment,
      });
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
      return successRes({}, 200, 'Order canceled');
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

    try {
      const { order_item_info, totalPrice, extraCost, comment } = partlySoldDto;

      // 🔎 1. Check order (must be WAITING)
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id, status: Order_status.WAITING },
      });
      if (!order)
        throw new NotFoundException('Order not found or not in Waiting status');

      // 🔎 2. Get old items
      const oldOrderItems = await queryRunner.manager.find(OrderItemEntity, {
        where: { orderId: order.id },
      });

      // 🔎 3. Market + cashbox
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: order.user_id, role: Roles.MARKET },
      });
      if (!market) throw new NotFoundException('Market not found');

      const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: {
          cashbox_type: Cashbox_type.FOR_MARKET,
          user_id: order.user_id,
        },
      });
      if (!marketCashbox)
        throw new NotFoundException('Market cashbox not found');

      // 🔎 4. Courier + cashbox
      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });
      if (!courier) throw new NotFoundException('Courier not found');

      const courierCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.FOR_COURIER, user_id: courier.id },
      });
      if (!courierCashbox)
        throw new NotFoundException('Courier cashbox not found');

      // 🔎 5. Tariffs
      const marketTarif =
        order.where_deliver === Where_deliver.CENTER
          ? market.tariff_center
          : market.tariff_home;

      const courierTarif =
        order.where_deliver === Where_deliver.CENTER
          ? courier.tariff_center
          : courier.tariff_home;

      // 🔎 6. Calculate payments
      const to_be_paid: number = extraCost
        ? totalPrice - extraCost - marketTarif
        : totalPrice - marketTarif;

      const courier_to_be_paid: number = extraCost
        ? totalPrice - extraCost - courierTarif
        : totalPrice - courierTarif;

      // 🔎 7. Calculate sold product quantity
      const soldProductQuantity = order_item_info.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );

      // 🔎 8. Update old items (reduce quantities)
      for (const dtoItem of order_item_info) {
        const foundItem = oldOrderItems.find(
          (i) => i.productId === dtoItem.product_id,
        );
        if (!foundItem) {
          throw new NotFoundException(
            `Product not found in order: ${dtoItem.product_id}`,
          );
        }
        if (dtoItem.quantity > foundItem.quantity) {
          throw new BadRequestException(
            `Product quantity (${dtoItem.quantity}) exceeds original quantity`,
          );
        }
        foundItem.quantity -= dtoItem.quantity;
        await queryRunner.manager.save(foundItem);
      }

      // 🔎 9. Update original order → SOLD
      const finalComment = generateComment(order.comment, comment, extraCost, [
        'Buyurtmaning bir qismi sotildi',
      ]);

      Object.assign(order, {
        status: Order_status.SOLD,
        to_be_paid,
        comment: finalComment,
        product_quantity: soldProductQuantity,
      });
      await queryRunner.manager.save(order);

      // Market cashbox update
      marketCashbox.balance += to_be_paid;
      await queryRunner.manager.save(marketCashbox);

      await queryRunner.manager.save(
        queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.INCOME,
          cashbox_id: marketCashbox.id,
          source_id: order.id,
          source_type: Source_type.SELL,
          amount: to_be_paid,
          balance_after: marketCashbox.balance,
          comment: finalComment,
          created_by: courier.id,
        }),
      );

      // Courier cashbox update
      courierCashbox.balance += courier_to_be_paid;
      await queryRunner.manager.save(courierCashbox);

      await queryRunner.manager.save(
        queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.INCOME,
          cashbox_id: courierCashbox.id,
          source_id: order.id,
          source_type: Source_type.SELL,
          amount: courier_to_be_paid,
          balance_after: courierCashbox.balance,
          comment: finalComment,
          created_by: courier.id,
        }),
      );

      // 🔎 10. Create CANCELLED order for remaining items
      const remainingItems = oldOrderItems.filter((item) => item.quantity > 0);
      const remainingQuantity = remainingItems.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );

      if (remainingItems.length > 0) {
        const cancelledOrder = queryRunner.manager.create(OrderEntity, {
          market_id: order.user_id,
          customer_id: order.customer_id, // ✅ same customer
          comment: 'Qolgan mahsulotlar bekor qilindi',
          total_price: 0,
          to_be_paid: 0,
          where_deliver: order.where_deliver,
          status: Order_status.CANCELLED,
          qr_code_token: generateCustomToken(),
          parent_order_id: id,
          product_quantity: remainingQuantity,
        });
        await queryRunner.manager.save(cancelledOrder);

        for (const item of remainingItems) {
          await queryRunner.manager.save(
            queryRunner.manager.create(OrderItemEntity, {
              productId: item.productId,
              quantity: item.quantity,
              orderId: cancelledOrder.id,
            }),
          );
        }
      }

      await queryRunner.commitTransaction();
      return successRes({}, 200, 'Order qisman sotildi');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // async rollbackOrderToWaiting(user: JwtPayload, id: string) {
  //   const queryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   await queryRunner.startTransaction();

  //   try {
  //     // 1. Orderni olish
  //     const order = await queryRunner.manager.findOne(OrderEntity, {
  //       where: { id },
  //       relations: ['market', 'courier'],
  //     });
  //     if (!order) throw new NotFoundException('Order not found');

  //     if (![Order_status.SOLD, Order_status.CANCELLED].includes(order.status)) {
  //       throw new BadRequestException(
  //         `Order rollback uchun mos emas (status: ${order.status})`,
  //       );
  //     }

  //     const market = await queryRunner.manager.findOne(MarketEntity, {
  //       where: { id: order.market_id },
  //     });
  //     if (!market) throw new NotFoundException('Market not found');

  //     const courier = await queryRunner.manager.findOne(UserEntity, {
  //       where: { id: order.post.courier_id },
  //     });
  //     if (!courier) throw new NotFoundException('Courier not found');

  //     const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
  //       where: { cashbox_type: Cashbox_type.FOR_MARKET, market_id: market.id },
  //     });
  //     if (!marketCashbox)
  //       throw new NotFoundException('Market cashbox not found');

  //     const courierCashbox = await queryRunner.manager.findOne(CashEntity, {
  //       where: { cashbox_type: Cashbox_type.FOR_COURIER, user_id: courier.id },
  //     });
  //     if (!courierCashbox)
  //       throw new NotFoundException('Courier cashbox not found');

  //     const rollbackComment = `[ROLLBACK] ${order.comment || ''}`;

  //     const

  //     // 2. SOLD / PARTLY_SOLD → pulni qaytarish
  //     if (order.status === Order_status.SOLD) {
  //       const deliveringPlace = order.where_deliver;

  //       const marketTarif: number =
  //         deliveringPlace === Where_deliver.CENTER
  //           ? market.tariff_center
  //           : market.tariff_home;

  //       const courierTarif: number =
  //         deliveringPlace === Where_deliver.CENTER
  //           ? courier.tariff_center
  //           : courier.tariff_home;

  //       const to_be_paid: number = extraCost
  //         ? order.total_price - extraCost - marketTarif
  //         : order.total_price - marketTarif;

  //       const courier_to_be_paid: number = extraCost
  //         ? order.total_price - extraCost - courierTarif
  //         : order.total_price - courierTarif;
  //       if (order.to_be_paid && order.to_be_paid > 0) {
  //         marketCashbox.balance -= order.to_be_paid;
  //         await queryRunner.manager.save(marketCashbox);

  //         await queryRunner.manager.save(
  //           queryRunner.manager.create(CashboxHistoryEntity, {
  //             operation_type: Operation_type.EXPENSE,
  //             cashbox_id: marketCashbox.id,
  //             source_id: order.id,
  //             source_type: Source_type.CORRECTION,
  //             amount: order.to_be_paid,
  //             balance_after: marketCashbox.balance,
  //             comment: rollbackComment,
  //             created_by: user.id,
  //           }),
  //         );
  //       }

  //       // courier rollback
  //       const courierPayment = order.to_be_paid ?? 0;
  //       if (courierPayment > 0) {
  //         courierCashbox.balance -= courierPayment;
  //         await queryRunner.manager.save(courierCashbox);

  //         await queryRunner.manager.save(
  //           queryRunner.manager.create(CashboxHistoryEntity, {
  //             operation_type: Operation_type.EXPENSE,
  //             cashbox_id: courierCashbox.id,
  //             source_id: order.id,
  //             source_type: Source_type.ROLLBACK,
  //             amount: courierPayment,
  //             balance_after: courierCashbox.balance,
  //             comment: rollbackComment,
  //             created_by: user.id,
  //           }),
  //         );
  //       }

  //       // agar PARTLY_SOLD bo‘lsa → yaratilgan CANCELLED order’ni ham qaytarish
  //       if (order.status === Order_status.PARTLY_SOLD) {
  //         const childOrders = await queryRunner.manager.find(OrderEntity, {
  //           where: {
  //             parent_order_id: order.id,
  //             status: Order_status.CANCELLED,
  //           },
  //         });
  //         for (const child of childOrders) {
  //           child.status = Order_status.WAITING;
  //           await queryRunner.manager.save(child);
  //         }
  //       }
  //     }

  //     // 3. CANCELLED → agar extraCost bo‘lsa, qaytarib yozamiz
  //     if (order.status === Order_status.CANCELLED && order.extraCost) {
  //       marketCashbox.balance += order.extraCost;
  //       await queryRunner.manager.save(marketCashbox);

  //       await queryRunner.manager.save(
  //         queryRunner.manager.create(CashboxHistoryEntity, {
  //           operation_type: Operation_type.INCOME,
  //           cashbox_id: marketCashbox.id,
  //           source_id: order.id,
  //           source_type: Source_type.ROLLBACK,
  //           amount: order.extraCost,
  //           balance_after: marketCashbox.balance,
  //           comment: rollbackComment,
  //           created_by: user.id,
  //         }),
  //       );
  //     }

  //     // 4. Asosiy orderni WAITING ga qaytarish
  //     order.status = Order_status.WAITING;
  //     await queryRunner.manager.save(order);

  //     await queryRunner.commitTransaction();
  //     return successRes({}, 200, 'Order WAITING ga qaytarildi');
  //   } catch (err) {
  //     await queryRunner.rollbackTransaction();
  //     throw err;
  //   } finally {
  //     await queryRunner.release();
  //   }
  // }

  async getStats(filter: { startDate?: string; endDate?: string }) {
    try {
      const qb = this.orderRepo.createQueryBuilder('o');

      if (filter.startDate) {
        qb.andWhere('o.createdAt >= :startDate', {
          startDate: filter.startDate,
        });
      }
      if (filter.endDate) {
        qb.andWhere('o.createdAt <= :endDate', { endDate: filter.endDate });
      }

      const total = await qb.getCount();
    } catch (error) {}
  }

  async remove(id: string) {
    try {
      const order = await this.orderRepo.findOne({
        where: { id, status: Order_status.NEW },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      await this.orderRepo.delete({ id });

      return successRes({}, 200, 'Order deleted');
    } catch (error) {
      return catchError(error);
    }
  }
}
