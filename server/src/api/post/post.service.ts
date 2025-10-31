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
import { DataSource, In, IsNull, Not } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import {
  Order_status,
  Post_status,
  Roles,
  Where_deliver,
} from 'src/common/enums';
import { ReceivePostDto } from './dto/receive-post.dto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { PostDto } from './dto/postId.dto';

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

  async findAll(page = 1, limit = 10): Promise<object> {
    try {
      // Sahifani to‘g‘rilab olamiz
      const take = limit > 100 ? 100 : limit; // limit maksimal 100 ta
      const skip = (page - 1) * take;

      // 🔎 Umumiy ma’lumotlar
      const [data, total] = await this.postRepo.findAndCount({
        where: { status: Not(Post_status.NEW) },
        relations: ['region'],
        order: { created_at: 'DESC' },
        skip,
        take,
      });

      // Hisob-kitoblar
      const totalPages = Math.ceil(total / take);

      return successRes(
        {
          data,
          total,
          page,
          totalPages,
          limit: take,
        },
        200,
        'All posts (paginated)',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async newPosts(): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1️⃣ RECEIVED statusida va post_id null bo‘lgan orderlarni olish
      const orphanOrders = await queryRunner.manager.find(OrderEntity, {
        where: { status: Order_status.RECEIVED, post_id: IsNull() },
        relations: ['customer', 'customer.district'],
      });

      const regionPostMap = new Map<string, PostEntity>();

      // 2️⃣ Region bo‘yicha grouping (post obyektlarini yaratish)
      for (const order of orphanOrders) {
        const district = order.customer?.district;
        if (!district) {
          throw new NotFoundException(
            `District not found for order ${order.id}`,
          );
        }

        const regionId = district.assigned_region;
        if (!regionPostMap.has(regionId)) {
          const newPost = queryRunner.manager.create(PostEntity, {
            region_id: regionId,
            qr_code_token: generateCustomToken(),
            post_total_price: 0,
            order_quantity: 0,
            status: Post_status.NEW,
          });
          regionPostMap.set(regionId, newPost);
        }

        // keyin statistikani to‘plash uchun
        const post = regionPostMap.get(regionId)!;
        post.post_total_price =
          (post.post_total_price ?? 0) + (order.total_price ?? 0);
        post.order_quantity = (post.order_quantity ?? 0) + 1;
      }

      // 3️⃣ Avval yangi postlarni saqlaymiz (IDlar hosil bo‘lishi uchun)
      const savedPosts = await queryRunner.manager.save(
        Array.from(regionPostMap.values()),
      );

      // 4️⃣ regionId → yangi post.id mapping
      const idMap = new Map<string, string>();
      savedPosts.forEach((post) => idMap.set(post.region_id, post.id));

      // 5️⃣ Endi orderlarga post_id biriktiramiz
      for (const order of orphanOrders) {
        const regionId = order.customer?.district?.assigned_region;
        const postId = idMap.get(regionId);
        order.post_id = postId!;
      }

      await queryRunner.manager.save(orphanOrders);

      // 6️⃣ Mavjud + yangi yaratilgan NEW postlarni olish
      const allPosts = await this.postRepo.find({
        where: { status: Post_status.NEW },
        relations: ['region'],
        order: { created_at: 'DESC' },
      });

      await queryRunner.commitTransaction();
      return successRes(allPosts, 200, 'All new posts');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async rejectedPosts(): Promise<object> {
    try {
      const allPosts = await this.postRepo.find({
        where: {
          status: In([Post_status.CANCELED]),
        },
        relations: ['region'],
        order: { created_at: 'DESC' },
      });
      return successRes(allPosts, 200, 'All new posts');
    } catch (error) {
      return catchError(error);
    }
  }

  async onTheRoadPosts(user: JwtPayload): Promise<object> {
    try {
      const allPosts = await this.postRepo.find({
        where: {
          status: Post_status.SENT,
          courier_id: user.id,
        },
        relations: ['region'],
        order: { created_at: 'DESC' },
      });
      return successRes(allPosts, 200, 'All new posts');
    } catch (error) {
      return catchError(error);
    }
  }

  async oldPostsForCourier(user: JwtPayload): Promise<object> {
    try {
      const allOldPosts = await this.postRepo.find({
        where: {
          status: Not(In([Post_status.SENT, Post_status.NEW])),
          courier_id: user.id,
        },
        relations: ['region'],
        order: { created_at: 'DESC' },
      });
      return successRes(allOldPosts, 200, 'All old posts');
    } catch (error) {
      return catchError(error);
    }
  }

  async rejectedPostsForCourier(user: JwtPayload) {
    try {
      const allRejectedPosts = await this.postRepo.find({
        where: {
          status: In([Post_status.CANCELED]),
          courier_id: user.id,
        },
        order: { created_at: 'DESC' },
      });
      return successRes(
        allRejectedPosts,
        200,
        'All rejected posts for courier',
      );
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
      const moreThanOneCourier: boolean = couriers.length === 1 ? false : true;
      return successRes(
        {
          moreThanOneCourier,
          couriers,
        },
        200,
        'Couriers for this post',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getPostsOrders(id: string, user: JwtPayload) {
    try {
      const post = await this.postRepo.findOne({ where: { id } });
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      let allOrdersByPostId = await this.orderRepo.find({
        where: [{ post_id: id }, { canceled_post_id: id }],
        relations: [
          'customer',
          'market',
          'customer.district',
          'items',
          'items.product',
        ],
      });

      if (post.status === Post_status.SENT && user.role === Roles.COURIER) {
        allOrdersByPostId = allOrdersByPostId.filter(
          (o) => o.status === Order_status.ON_THE_ROAD,
        );
      }

      let homeOrders: number = 0;
      let centerOrders: number = 0;
      let homeOrdersTotalPrice: number = 0;
      let centerOrdersTotalPrice: number = 0;

      for (const order of allOrdersByPostId) {
        if (order.where_deliver === Where_deliver.ADDRESS) {
          homeOrders++;
          homeOrdersTotalPrice =
            homeOrdersTotalPrice + Number(order.total_price);
        } else {
          centerOrders++;
          centerOrdersTotalPrice =
            centerOrdersTotalPrice + Number(order.total_price);
        }
      }

      return successRes(
        {
          allOrdersByPostId,
          homeOrders: { homeOrders, homeOrdersTotalPrice },
          centerOrders: { centerOrders, centerOrdersTotalPrice },
        },
        200,
        'All orders by post id',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getRejectedPostsOrders(id: string) {
    try {
      const allOrdersByPostId = await this.orderRepo.find({
        where: { canceled_post_id: id },
        relations: ['customer', 'customer.district', 'items', 'items.product'],
      });
      return successRes(allOrdersByPostId, 200, 'All orders by post id');
    } catch (error) {
      return catchError(error);
    }
  }

  async checkPost(id: string, postDto: PostDto) {
    try {
      const { postId } = postDto;
      if (!postId) {
        throw new BadRequestException('Pochta topilmadi');
      }
      const order = await this.orderRepo.findOne({
        where: {
          qr_code_token: id,
          status: Order_status.RECEIVED,
          post_id: postId,
        },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      return successRes({}, 200, "Order checked and it's exist");
    } catch (error) {
      return catchError(error);
    }
  }

  async sendPost(id: string, dto: SendPostDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { orderIds, courierId } = dto;

      /**
       * 1️⃣ Postni topish
       */
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id },
      });
      if (!post) throw new NotFoundException('Post not found');

      /**
       * 2️⃣ Kuryerni tekshirish
       */
      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: courierId, role: Roles.COURIER },
      });
      if (!courier) throw new NotFoundException('Courier not found');

      /**
       * 3️⃣ Order IDs tekshirish
       */
      if (!orderIds || orderIds.length === 0)
        throw new BadRequestException('You can not send an empty post');

      /**
       * 4️⃣ Eski va yangi orderlarni olish
       */
      const oldOrders = await queryRunner.manager.find(OrderEntity, {
        where: { post_id: id },
      });
      const newOrders = await queryRunner.manager.find(OrderEntity, {
        where: { id: In(orderIds) },
        relations: ['market', 'customer', 'customer.district'],
      });

      if (newOrders.length !== orderIds.length)
        throw new BadRequestException('Some orders not found');

      /**
       * 5️⃣ Postdan chiqarilgan orderlarni topish (removedOrders)
       * - status o‘zgartirilmaydi
       * - faqat post_id null qilinadi
       */
      const removedOrders = oldOrders.filter((o) => !orderIds.includes(o.id));
      for (const order of removedOrders) {
        order.post_id = null;
        await queryRunner.manager.save(order);
      }

      const postTotalInfo = {
        total: newOrders.length,
        sum: 0,
      };
      /**
       * 6️⃣ Yangi orderlarni ON_THE_ROAD holatiga o‘tkazish
       */
      for (const order of newOrders) {
        postTotalInfo.sum += order.total_price;
        order.post_id = post.id;
        order.status = Order_status.ON_THE_ROAD;
        await queryRunner.manager.save(order);
      }

      /**
       * 7️⃣ Postning yangilangan ichki buyurtmalarini olish
       */
      const activeOrders = await queryRunner.manager.find(OrderEntity, {
        where: { post_id: id },
      });

      const total_price = activeOrders.reduce(
        (sum, o) => sum + Number(o.total_price),
        0,
      );
      const quantity = activeOrders.length;

      /**
       * 8️⃣ Bo‘sh post jo‘natilmasin!
       */
      if (quantity === 0) {
        throw new BadRequestException(
          'Post cannot be empty. At least one order is required.',
        );
      }

      /**
       * 9️⃣ Postni yangilash
       */
      post.courier_id = courierId;
      post.post_total_price = total_price;
      post.order_quantity = quantity;
      post.status = Post_status.SENT;
      await queryRunner.manager.save(post);

      /**
       * 🔟 Natijani qaytarish
       */
      const updatedPost = await queryRunner.manager.findOne(PostEntity, {
        where: { id },
        relations: ['courier', 'region'],
      });

      await queryRunner.commitTransaction();
      return successRes(
        { updatedPost, newOrders, postTotalInfo },
        200,
        'Post sent successfully',
      );
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
      if (post.status != Post_status.SENT) {
        throw new BadRequestException('Can not reveive post with this status!');
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

      const allOrdersInThePost = await queryRunner.manager.find(OrderEntity, {
        where: { id: In(waitingOrderIds) },
      });

      await queryRunner.commitTransaction();
      return successRes(allOrdersInThePost, 200, 'Post received successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async receiveOrderWithScanerCourier(user: JwtPayload, id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1) Orderni topamiz
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (!order.post_id) {
        throw new NotFoundException('Order has no post');
      }

      // 2) Shu order tegishli bo'lgan postni faqat shu courierga bog‘langanini tekshiramiz
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id: order.post_id, courier_id: user.id },
      });
      if (!post) {
        throw new NotFoundException(
          'Post not found or not assigned to this courier',
        );
      }

      // 3) Order statusini o‘zgartiramiz
      order.status = Order_status.WAITING;
      await queryRunner.manager.save(order);

      // 4) Post ichida hali "ON_THE_ROAD" order bor yoki yo‘qligini tekshiramiz
      const activeOrdersCount = await queryRunner.manager.count(OrderEntity, {
        where: { post_id: post.id, status: Order_status.ON_THE_ROAD },
      });

      if (activeOrdersCount === 0) {
        post.status = Post_status.RECEIVED;
        await queryRunner.manager.save(post);
      }

      // 5) Commit
      await queryRunner.commitTransaction();
      return successRes({}, 200, 'Order received');
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

      let canceledPost = await queryRunner.manager.findOne(PostEntity, {
        where: {
          courier_id: courier.id,
          status: Post_status.CANCELED,
        },
      });

      if (!canceledPost) {
        const customToken = generateCustomToken();
        canceledPost = queryRunner.manager.create(PostEntity, {
          courier_id: courier.id,
          region_id: courier.region_id,
          post_total_price: 0,
          order_quantity: orders.length,
          qr_code_token: customToken,
          status: Post_status.CANCELED,
        });
        await queryRunner.manager.save(canceledPost);
      }

      for (const order of orders) {
        order.canceled_post_id = canceledPost.id;
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

  async recCanOrderWithScaner(orderToken: string) {}

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
      if (post.status != Post_status.CANCELED) {
        throw new BadRequestException(
          'Post with this status can not be received!',
        );
      }

      // DTO orqali kelgan order_id lar
      const canceledOrderIds = ordersArrayDto.order_ids;

      // Kelgan id-lar => CLOSED
      if (canceledOrderIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(canceledOrderIds) },
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
          { id: In(remainingIds) },
          { status: Order_status.CANCELLED, canceled_post_id: null },
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
