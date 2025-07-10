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
  Order_status,
  Roles,
  Where_deliver,
} from 'src/common/enums';
import { generateQrToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { ProductRepository } from 'src/core/repository/product.repository';
import { MarketRepository } from 'src/core/repository/market.repository';
import { ProductEntity } from 'src/core/entity/product.entity';
import { MarketEntity } from 'src/core/entity/market.entity';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { CustomerInfoEntity } from 'src/core/entity/customer-info.entity';
import { CustomerInfoRepository } from 'src/core/repository/customer-info.repository';
import { UpdateStatusDto } from './dto/status-order.dto';
import { UpdateManyStatusesDto } from './dto/update-many-statuses.dto';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { generateComment } from 'src/common/utils/generate-comment';

@Injectable()
export class OrderService extends BaseService<CreateOrderDto, OrderEntity> {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: OrderItemRepository,

    @InjectRepository(ProductEntity)
    private readonly productRepo: ProductRepository,

    @InjectRepository(MarketEntity)
    private readonly marketRepo: MarketRepository,

    @InjectRepository(CustomerInfoEntity)
    private readonly customerInfoRepo: CustomerInfoRepository,

    @InjectRepository(CashEntity)
    private readonly cashboxRepo: CashRepository,

    private readonly dataSource: DataSource,
  ) {
    super(orderRepo);
  }
  async createOrder(
    user: any,
    createOrderDto: CreateOrderDto,
  ): Promise<object> {
    const transaction = this.dataSource.createQueryRunner();
    await transaction.connect();
    await transaction.startTransaction();

    try {
      const { id, role } = user;
      let { market_id } = createOrderDto;
      if (role === Roles.REGISTRATOR) {
        const isExistMarket = await this.marketRepo.findOne({
          where: { id: market_id },
        });
        if (!isExistMarket) {
          throw new NotFoundException('Market not found');
        }
      }
      if (role === Roles.MARKET) {
        market_id = id;
      }
      const {
        where_deliver,
        total_price,
        comment,
        client_name,
        client_phone_number,
        address,
        district_id,
        order_item_info,
      } = createOrderDto;

      const qr_code_token = generateQrToken();

      const newOrder = transaction.manager.create(OrderEntity, {
        market_id,
        comment,
        total_price,
        where_deliver: where_deliver || Where_deliver.CENTER,
        status: Order_status.RECEIVED,
        qr_code_token,
      });
      await transaction.manager.save(newOrder);

      let product_quantity: number = 0;
      for (const o_item of order_item_info) {
        const isExistProduct = await this.productRepo.findOne({
          where: { id: o_item.product_id },
        });
        if (!isExistProduct) {
          throw new NotFoundException('Product not found');
        }
        const newOrderItem = transaction.manager.create(OrderItemEntity, {
          productId: o_item.product_id,
          quantity: o_item.quantity,
          orderId: newOrder.id,
        });
        await transaction.manager.save(newOrderItem);
        product_quantity += o_item.quantity;
      }
      await transaction.manager.update(
        this.orderRepo.target,
        {
          id: newOrder.id,
        },
        { product_quantity },
      );

      const customer_info = transaction.manager.create(CustomerInfoEntity, {
        order_id: newOrder.id,
        name: client_name,
        phone_number: client_phone_number,
        address,
        district_id,
      });
      await transaction.manager.save(customer_info);

      await transaction.commitTransaction();
      return successRes(newOrder, 201, 'New order created');
    } catch (error) {
      await transaction.rollbackTransaction();
      return catchError(error);
    } finally {
      await transaction.release();
    }
  }

  async findOne(id: string) {
    try {
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

          await queryRunner.manager.update(
            this.orderRepo.target,
            { id: editingOrder.id },
            { product_quantity },
          );
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
          await queryRunner.manager.update(
            OrderEntity,
            { id: editingOrder.id },
            updateOrderFields,
          );
        }

        // 🟡 3. Edit customer info
        if (
          updateOrderDto.name ||
          updateOrderDto.phone_number ||
          updateOrderDto.address ||
          updateOrderDto.district_id
        ) {
          const customer = await this.customerInfoRepo.findOne({
            where: { order_id: editingOrder.id },
          });

          if (!customer) {
            throw new NotFoundException('Customer info not found');
          }

          const updateCustomerFields: Partial<CustomerInfoEntity> = {};
          if (updateOrderDto.name)
            updateCustomerFields.name = updateOrderDto.name;
          if (updateOrderDto.phone_number)
            updateCustomerFields.phone_number = updateOrderDto.phone_number;
          if (updateOrderDto.address)
            updateCustomerFields.address = updateOrderDto.address;
          if (updateOrderDto.district_id)
            updateCustomerFields.district_id = updateOrderDto.district_id;

          await queryRunner.manager.update(
            CustomerInfoEntity,
            { order_id: editingOrder.id },
            updateCustomerFields,
          );
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

  async updateManyStatuses(dto: UpdateManyStatusesDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { order_ids, status } = dto;

      const orders = await this.orderRepo.find({
        where: { id: In(order_ids) },
      });

      if (orders.length === 0) {
        throw new NotFoundException('No orders found');
      }

      // Mavjud bo'lmagan IDlar uchun xatolik chiqarish
      const foundIds = orders.map((o) => o.id);
      const notFoundIds = order_ids.filter((id) => !foundIds.includes(id));
      if (notFoundIds.length > 0) {
        throw new NotFoundException(
          'There is error on changing some orders status',
        );
      }

      await queryRunner.manager.update(
        this.orderRepo.target,
        { id: In(order_ids) },
        { status },
      );

      await queryRunner.commitTransaction();
      return successRes(
        {},
        200,
        `Updated ${order_ids.length} orders to status '${status}'`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(id: string, updateStatusDto: UpdateStatusDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { status, extraCost, comment } = updateStatusDto;
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      const deliveringPlace = order.where_deliver;
      const marketId = order.market_id;
      const market = await queryRunner.manager.findOne(MarketEntity, {
        where: { id: marketId },
      });
      if (!market) {
        throw new NotFoundException(
          'This orders owner is not found or blocked by admins',
        );
      }
      const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.FOR_MARKET, user_id: marketId },
      });
      if (!marketCashbox) {
        throw new NotFoundException('Market cashbox not found');
      }

      // Sotilgan holatdagi logika ====================================

      if (status === Order_status.SOLD) {
        const tarif: number =
          deliveringPlace === Where_deliver.CENTER
            ? market.tariff_center
            : market.tariff_home;

        const to_be_paid: number = extraCost
          ? order.total_price - extraCost - tarif
          : order.total_price - tarif;

        const finalComment = generateComment(order.comment, comment, extraCost);

        await queryRunner.manager.update(
          this.orderRepo.target,
          { id },
          { status, to_be_paid, comment: finalComment },
        );

        marketCashbox.balance += to_be_paid;
        await queryRunner.manager.save(marketCashbox);
      }
      // Bekor qilingan holatdagi logika =========================================
      if (status === Order_status.CANCELLED) {
        if (extraCost) {
          marketCashbox.balance -= extraCost;
          await queryRunner.manager.save(marketCashbox);
        }

        const finalComment = generateComment(order.comment, comment, extraCost);

        await queryRunner.manager.update(
          this.orderRepo.target,
          { id },
          { status, comment: finalComment },
        );
      }
      await queryRunner.commitTransaction();
      return successRes({}, 200, `Order satus changed to ${status}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      queryRunner.release();
    }
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
