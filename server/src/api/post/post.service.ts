import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SendPostDto } from './dto/send-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { PostRepository } from 'src/core/repository/post.repository';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { DataSource, In } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { Order_status, Post_status, Roles } from 'src/common/enums';
import { ReceivePostDto } from './dto/receive-post.dto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepo: PostRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<object> {
    try {
      const allPosts = await this.postRepo.find({
        relations: ['region'],
      });
      return successRes(allPosts, 200, 'All posts');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string): Promise<object> {
    try {
      const post = await this.postRepo.findOne({ where: { id } });
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      return successRes(post, 200, 'Post found');
    } catch (error) {
      return catchError(error);
    }
  }

  async findAllCouriers(id: string) {
    try {
      const post = await this.postRepo.findOne({ where: { id } });
      if (!post) {
        throw new NotFoundException();
      }
      const couriers = await this.userRepo.find({
        where: { region_id: post.region_id },
      });
      if (couriers.length === 0) {
        throw new NotFoundException(
          'There are not any couriers for this region',
        );
      }
      return successRes(couriers, 200, 'Couriers for this post');
    } catch (error) {
      return catchError(error);
    }
  }

  async sendPost(id: string, sendPostDto: SendPostDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const post = await this.postRepo.findOne({ where: { id } }); // Berilgan id bo'yicha post mavjudligini tekshiramiz
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      const { orderIds, courierId } = sendPostDto;
      const isExistCourier = await this.userRepo.findOne({
        where: { id, role: Roles.COURIER },
      });
      if (!isExistCourier) {
        throw new NotFoundException('Courier not found');
      }
      let total_price = post.post_total_price; // agar orderIds berilmasa, oldingi qiymatlarni saqlab turamiz
      let quantity = post.order_quantity;
      const orders = await this.orderRepo.findBy({ id: In(orderIds) });
      if (orderIds.length > 0 && orders.length !== quantity) {
        total_price = orders.reduce((acc, o) => acc + o.total_price, 0);
        quantity = orders.length;
      }
      if (orderIds.length === 0) {
        throw new BadRequestException('You can not send empty post');
      }
      for (const order of orders) {
        order.status = Order_status.ON_THE_ROAD; // Har bir orderni shu postga bo'glash
        await queryRunner.manager.save(order);
      }

      Object.assign(post, {
        courier_id: courierId,
        post_total_price: total_price,
        order_quantity: quantity,
        status: Post_status.SENT,
      });
      const updatedPost = await queryRunner.manager.save(post);

      await queryRunner.commitTransaction();
      return successRes(updatedPost, 200, 'Post updated');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async receivePost(
    user: JwtPayload,
    id: string,
    ordersArrayDto: ReceivePostDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Postni topamiz
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id, courier_id: user.id },
        relations: ['orders'],
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // DTO orqali kelgan order_id lar
      const waitingOrderIds = ordersArrayDto.order_ids;

      // Kelgan id-lar => WAITING
      if (waitingOrderIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(waitingOrderIds), post_id: id },
          { status: Order_status.WAITING },
        );
      }

      // Qolgan (post ichida bor, lekin dto da yo‘q) orderlar => RECEIVED
      const remainingOrders = post.orders.filter(
        (order) => !waitingOrderIds.includes(order.id),
      );

      if (remainingOrders.length > 0) {
        const remainingIds = remainingOrders.map((o) => o.id);

        await queryRunner.manager.update(
          OrderEntity,
          { id: In(remainingIds), post_id: id },
          { status: Order_status.RECEIVED },
        );
      }

      // Postning statusi har doim RECEIVED bo‘lib qoladi
      await queryRunner.manager.update(
        PostEntity,
        { id },
        { status: Post_status.RECEIVED },
      );

      await queryRunner.commitTransaction();

      return successRes({}, 200, 'Post received successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createCanceledPost(user: JwtPayload, ordersArrayDto: ReceivePostDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { order_ids } = ordersArrayDto;

      const orders = await queryRunner.manager.find(OrderEntity, {
        where: { id: In(order_ids), status: Order_status.CANCELLED },
      });

      if (order_ids.length !== orders.length) {
        throw new BadRequestException(
          'Some orders not found or not in Canceled status',
        );
      }

      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });
      if (!courier) {
        throw new NotFoundException('Courier not found');
      }

      const customToken = generateCustomToken();
      const canceledPost = queryRunner.manager.create(PostEntity, {
        courier_id: courier.id,
        region_id: courier.region_id,
        post_total_price: 0,
        order_quantity: orders.length,
        qr_code_token: customToken,
        status: Post_status.CANCELED,
      });
      await queryRunner.manager.save(canceledPost);

      for (const order of orders) {
        order.post_id = canceledPost.id;
        order.status = Order_status.CANCELLED_SENT;
      }
      await queryRunner.manager.save(orders);

      await queryRunner.commitTransaction();
      return successRes(
        { post_id: canceledPost.id, order_ids },
        200,
        'Canceled Order created and sent to central post',
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async receiveCanceledPost(id: string, ordersArrayDto: ReceivePostDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pochtani topamiz
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id },
        relations: ['orders'],
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // DTO orqali kelgan order_id lar
      const canceledOrderIds = ordersArrayDto.order_ids;

      // Kelgan id-lar => CLOSED
      if (canceledOrderIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(canceledOrderIds), post_id: id },
          { status: Order_status.CLOSED },
        );
      }

      // Qolgan orderlar => CANCELED
      const remainingOrders = post.orders.filter(
        (order) => !canceledOrderIds.includes(order.id),
      );

      if (remainingOrders.length > 0) {
        const remainingIds = remainingOrders.map((o) => o.id);

        await queryRunner.manager.update(
          OrderEntity,
          { id: In(remainingIds), post_id: id },
          { status: Order_status.CANCELLED },
        );
      }

      // Pochtaning statusi har doim Canceled_RECEIVED bo‘lib qoladi
      await queryRunner.manager.update(
        PostEntity,
        { id },
        { status: Post_status.CANCELED_RECEIVED },
      );

      await queryRunner.commitTransaction();

      return successRes({}, 200, 'Post received successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
