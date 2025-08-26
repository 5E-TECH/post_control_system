import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomerEntity } from 'src/core/entity/customer.entity';
import { CustomerRepository } from 'src/core/repository/customer.repository';
import { MarketEntity } from 'src/core/entity/market.entity';
import { MarketRepository } from 'src/core/repository/market.repository';
import { RegionEntity } from 'src/core/entity/region.entity';
import { RegionRepository } from 'src/core/repository/region.repository';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { DistrictRepository } from 'src/core/repository/district.repository';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { CreateOrderDto } from '../order/dto/create-order.dto';
import { DataSource, In, Not } from 'typeorm';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { Order_status, Roles, Where_deliver } from 'src/common/enums';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { OrderItemRepository } from 'src/core/repository/order-item.repository';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { CustomerMarketEntity } from 'src/core/entity/customer-market.entity';
import { CustomerMarketReository } from 'src/core/repository/customer-market.repository';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: CustomerRepository,

    @InjectRepository(MarketEntity)
    private readonly marketRepo: MarketRepository,

    @InjectRepository(RegionEntity)
    private readonly regionRepo: RegionRepository,

    @InjectRepository(DistrictEntity)
    private readonly districtRepo: DistrictRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: OrderItemRepository,

    @InjectRepository(CustomerMarketEntity)
    private readonly customerMarketRepo: CustomerMarketReository,

    private readonly dataSource: DataSource,
  ) {}
  async createCustomer(createCustomerDto: CreateCustomerDto): Promise<Object> {
    try {
      const {
        market_id,
        client_name,
        client_phone_number,
        district_id,
        address,
      } = createCustomerDto;
      const market = await this.marketRepo.findOne({
        where: { id: market_id },
      });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      const district = await this.districtRepo.findOne({
        where: { id: district_id },
      });
      if (!district) {
        throw new NotFoundException('District not found');
      }
      const customer = this.customerRepo.create({
        market_id,
        name: client_name,
        phone_number: client_phone_number,
        district_id,
        address,
      });
      await this.customerRepo.save(customer);
      return successRes(customer, 201, 'New Customer created');
    } catch (error) {
      return catchError(error);
    }
  }

  async createOrder(
    id: string,
    createOrderDto: CreateOrderDto,
  ): Promise<Object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const customer = await queryRunner.manager.findOne(CustomerEntity, {
        where: { id },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const { order_item_info, total_price, where_deliver, comment } =
        createOrderDto;

      const qr_code_token = generateCustomToken();

      const newOrder = queryRunner.manager.create(OrderEntity, {
        market_id: customer.market_id,
        comment,
        total_price,
        where_deliver: where_deliver || Where_deliver.CENTER,
        status: Order_status.NEW,
        qr_code_token,
        customer_id: id,
      });

      let product_quantity: number = 0;
      for (const o_item of order_item_info) {
        const isExistProduct = await queryRunner.manager.findOne(
          OrderItemEntity,
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

      return successRes(newOrder, 201, 'New order created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    try {
      const allCustomers = await this.customerRepo.find();
      return successRes(allCustomers, 200, 'All customers');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string) {
    try {
      const customer = await this.customerRepo.findOne({ where: { id } });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      return successRes(customer, 200, 'Customer by id');
    } catch (error) {
      return catchError(error);
    }
  }

  async findByMarketId(user: JwtPayload) {
    try {
      const customers = await this.customerRepo.find({
        relations: {
          orders: true,
          customerMarkets: { market: true },
        },
        where: {
          customerMarkets: { market: { id: user.id } },
        },
      });

      // faqat shu marketdagi orderlar qolsin
      for (const c of customers) {
        c.orders = c.orders.filter((o) => o.market_id === user.id);
      }

      return successRes(customers, 200, 'All my customers with orders');
    } catch (error) {
      return catchError(error);
    }
  }

  // async update(
  //   user: JwtPayload,
  //   id: string,
  //   updateCustomerDto: UpdateCustomerDto,
  // ) {
  //   try {
  //     const customer = await this.customerRepo.findOne({ where: { id } });
  //     if (!customer) {
  //       throw new NotFoundException('Customer not found');
  //     }
  //      if (user.role === Roles.MARKET) {
  //       const customerMarket = await this.customerMarketRepo.findOne({
  //         where: { customer_id: id },
  //       });
  //       if (customerMarket?.market_id !== user.id) {
  //         throw new BadRequestException(
  //           'This is not your customer and you can not edit it',
  //         );
  //       }
  //     }
  //     const customerOrders = await this.orderRepo.find({
  //       where: { customer_id: id, status: In([Order_status.CANCELLED, Ord]) },
  //     });
  //     if(customerOrders.length > 0)

  //     Object.assign(customer, {
  //       updateCustomerDto,
  //     });
  //     await this.customerRepo.save(customer);
  //   } catch (error) {
  //     return catchError(error);
  //   }
  // }
}
