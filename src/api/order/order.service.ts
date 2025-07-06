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
import { DataSource } from 'typeorm';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { OrderItemRepository } from 'src/core/repository/order-item.repository';
import { Order_status, Roles } from 'src/common/enums';
import { generateQrToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { ProductRepository } from 'src/core/repository/product.repository';
import { MarketRepository } from 'src/core/repository/market.repository';
import { ProductEntity } from 'src/core/entity/product.entity';
import { MarketEntity } from 'src/core/entity/market.entity';
import { BaseService } from 'src/infrastructure/lib/baseServise';

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
        district_id,
        client_name,
        client_phone_number,
        address,
        comment,
        total_price,
        order_item_info,
      } = createOrderDto;

      const qr_code_token = generateQrToken();
      const newOrder = this.orderRepo.create({
        market_id,
        district_id,
        client_name,
        client_phone_number,
        address,
        comment,
        total_price,
        status: Order_status.RECEIVED,
        qr_code_token,
      });
      const savedNewOrder = await transaction.manager.save(newOrder);

      let product_quantity: number = 0;
      for (const o_item of order_item_info) {
        const isExistProduct = await this.productRepo.findOne({
          where: { id: o_item.product_id },
        });
        if (!isExistProduct) {
          throw new NotFoundException('Product not found');
        }
        const newOrderItem = this.orderItemRepo.create({
          productId: o_item.product_id,
          quantity: o_item.quantity,
          orderId: savedNewOrder.id,
        });
        await transaction.manager.save(newOrderItem);
        product_quantity += o_item.quantity;
      }
      await transaction.manager.update(
        this.orderRepo.target,
        {
          id: savedNewOrder.id,
        },
        { product_quantity },
      );
      await transaction.commitTransaction();
      return successRes(savedNewOrder, 201, 'New order created');
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

  updateStatus(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
