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
  Status,
  Where_deliver,
} from 'src/common/enums';
import { ReceivePostDto } from './dto/receive-post.dto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { PostDto } from './dto/postId.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';

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
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(page: number, limit: number): Promise<object> {
    try {
      // Sahifani to'g'rilab olamiz
      const take = limit > 100 ? 100 : limit; // limit maksimal 100 ta
      const skip = (page - 1) * take;

      // 🔎 Umumiy ma'lumotlar
      const [data, total] = await this.postRepo.findAndCount({
        where: { status: Not(Post_status.NEW) },
        relations: ['region', 'courier'],
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
      // 1️⃣ RECEIVED statusida va post_id null bo'lgan orderlarni olish
      // (pessimistic lock — bir vaqtda 2 qurilma bir xil orderlarni 2 ta postga qo'shib qo'ymasin)
      // Avval lock bilan faqat IDlarni olish (LEFT JOIN + FOR UPDATE ishlamaydi)
      const lockedOrders = await queryRunner.manager.find(OrderEntity, {
        where: { status: Order_status.RECEIVED, post_id: IsNull() },
        select: ['id'],
        lock: { mode: 'pessimistic_write' },
      });
      // Keyin relationsni alohida yuklash
      const orphanOrders = lockedOrders.length > 0
        ? await queryRunner.manager.find(OrderEntity, {
            where: { id: In(lockedOrders.map(o => o.id)) },
            relations: ['district', 'customer', 'customer.district'],
          })
        : [];

      const regionPostMap = new Map<string, PostEntity>();

      // 2️⃣ Region bo'yicha grouping (post obyektlarini yaratish)
      for (const order of orphanOrders) {
        const district = order.district || order.customer?.district;
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

        // keyin statistikani to'plash uchun
        const post = regionPostMap.get(regionId)!;
        post.post_total_price =
          (Number(post.post_total_price) || 0) + (Number(order.total_price) || 0);
        post.order_quantity = (Number(post.order_quantity) || 0) + 1;
      }

      // 3️⃣ Avval yangi postlarni saqlaymiz (IDlar hosil bo'lishi uchun)
      const savedPosts = await queryRunner.manager.save(
        Array.from(regionPostMap.values()),
      );

      // 4️⃣ regionId → yangi post.id mapping
      const idMap = new Map<string, string>();
      savedPosts.forEach((post) => idMap.set(post.region_id, post.id));

      // 5️⃣ Endi orderlarga post_id biriktiramiz
      for (const order of orphanOrders) {
        const regionId = (order.district || order.customer?.district)?.assigned_region;
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
        relations: ['region', 'courier'],
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

  async oldPostsForCourier(
    page: number,
    limit: number,
    user: JwtPayload,
  ): Promise<object> {
    try {
      const take = limit > 100 ? 100 : limit; // limit maksimal 100 ta
      const skip = (page - 1) * take;

      const [data, total] = await this.postRepo.findAndCount({
        where: {
          status: Not(In([Post_status.SENT, Post_status.NEW])),
          courier_id: user.id,
        },
        relations: ['region'],
        order: { created_at: 'DESC' },
        skip,
        take,
      });

      const totalPages = Math.ceil(total / take);
      return successRes(
        { data, total, page, totalPages, limit: take },
        200,
        'All old posts',
      );
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

  async findWithQr(id: string, user: JwtPayload): Promise<object> {
    try {
      const post = await this.postRepo.findOne({
        where: { qr_code_token: id },
      });
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
        where: {
          region_id: post.region_id,
          status: Status.ACTIVE,
        },
      });
      if (couriers.length === 0) {
        throw new NotFoundException(
          'There are not any active couriers for this region',
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
          'district',
          'district.region',
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
        relations: ['customer', 'district', 'district.region', 'customer.district', 'items', 'items.product', 'market'],
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
        select: ['id'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      return successRes({ order }, 200, "Order checked and it's exist");
    } catch (error) {
      return catchError(error);
    }
  }

  async checkCancelPost(id: string, postDto: PostDto) {
    try {
      const { postId } = postDto;
      if (!postId) {
        throw new BadRequestException('Pochta topilmadi');
      }
      const order = await this.orderRepo.findOne({
        where: {
          qr_code_token: id,
          status: Order_status.CANCELLED_SENT,
          canceled_post_id: postId,
        },
        select: ['id'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      return successRes({ order }, 200, "Order checked and it's exist");
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Jo'natilgan pochtani boshqa kurierga o'tkazish (faqat superadmin)
   */
  async reassignCourier(postId: string, newCourierId: string, user: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id: postId },
        relations: ['courier', 'region'],
      });
      if (!post) {
        throw new NotFoundException('Pochta topilmadi');
      }
      if (post.status !== Post_status.SENT) {
        throw new BadRequestException("Faqat jo'natilgan pochtani o'tkazish mumkin");
      }

      const oldCourier = post.courier;
      const oldCourierId = post.courier_id;

      if (oldCourierId === newCourierId) {
        throw new BadRequestException('Pochta allaqachon shu kuryerda');
      }

      const newCourier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: newCourierId, role: Roles.COURIER },
      });
      if (!newCourier) {
        throw new NotFoundException('Kuryer topilmadi');
      }

      // Kuryerni o'zgartirish — update() ishlatamiz
      // save() da yuklangan courier relation yangi courier_id ni bekor qiladi
      await queryRunner.manager.update(PostEntity, { id: postId }, {
        courier_id: newCourierId,
      });

      await queryRunner.commitTransaction();

      // Activity log
      this.activityLog.log({
        entity_type: 'post',
        entity_id: postId,
        action: 'reassigned',
        old_value: { courier_id: oldCourierId, courier_name: oldCourier?.name },
        new_value: { courier_id: newCourierId, courier_name: newCourier.name },
        description: `Pochta kuryer o'zgartirildi: ${oldCourier?.name || '-'} → ${newCourier.name}`,
        user,
      });

      // Pochta ichidagi har bir buyurtma uchun ham log
      const orders = await this.orderRepo.find({ where: { post_id: postId } });
      for (const order of orders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: order.id,
          action: 'courier_changed',
          old_value: { courier_name: oldCourier?.name },
          new_value: { courier_name: newCourier.name },
          description: `Kuryer o'zgartirildi: ${oldCourier?.name || '-'} → ${newCourier.name}`,
          user,
        });
      }

      return successRes(
        { post_id: postId, old_courier: oldCourier?.name, new_courier: newCourier.name },
        200,
        `Pochta ${newCourier.name} ga o'tkazildi`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async sendPost(id: string, dto: SendPostDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { orderIds, courierId } = dto;

      /**
       * 1️⃣ Original postni pessimistic lock bilan topish
       * Bu lock faqat shu postni o'qib yozayotgan parallel so'rovlarni navbatga qo'yadi.
       * Har bir device o'z batch'ini alohida yangi post yaratib jo'natadi —
       * shuning uchun bir xil postga 2 device parallel ishlay oladi, lekin
       * o'sha original NEW postni lock qilib, uning statusi va order_quantity ni
       * xavfsiz yangilashni ta'minlaymiz.
       */
      const originalPost = await queryRunner.manager.findOne(PostEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!originalPost) throw new NotFoundException('Post not found');
      if (originalPost.status !== Post_status.NEW) {
        throw new BadRequestException('Post topilmadi yoki artiq jo\'natib bo\'lmaydi');
      }

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
       * 4️⃣ Tanlangan orderlarni olish.
       * MUHIM: faqat shu postga tegishli (post_id = id) va RECEIVED statusidagi
       * orderlar jo'natilishi mumkin. Bu boshqa device allaqachon jo'natib
       * yuborgan orderlarni ikki marta jo'natishni oldini oladi.
       */
      const newOrders = await queryRunner.manager.find(OrderEntity, {
        where: { id: In(orderIds), post_id: id },
        relations: ['market', 'customer', 'district', 'district.region', 'customer.district'],
      });

      if (newOrders.length === 0)
        throw new BadRequestException('Tanlangan buyurtmalar bu pochtada topilmadi');

      // Agar ba'zi orderlar allaqachon boshqa device tomonidan jo'natilgan bo'lsa,
      // faqat mavjud orderlar bilan davom etamiz (xato otmaymiz).

      const postTotalInfo = {
        total: newOrders.length,
        sum: newOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0),
      };

      /**
       * 5️⃣ Ushbu batch uchun YANGI alohida sent post yaratish.
       * Har bir "jo'natish" amali o'z postini yaratadi — original NEW post
       * qolgan orderlar uchun ochiq qoladi. Bu parallel jo'natishga imkon beradi.
       */
      let sentPost = queryRunner.manager.create(PostEntity, {
        region_id: originalPost.region_id,
        status: Post_status.SENT,
        courier_id: courierId,
        qr_code_token: generateCustomToken(),
        order_quantity: postTotalInfo.total,
        post_total_price: postTotalInfo.sum,
      });
      sentPost = await queryRunner.manager.save(sentPost);

      /**
       * 6️⃣ Tanlangan orderlarni yangi sentPost ga ko'chirish va ON_THE_ROAD qilish
       */
      for (const order of newOrders) {
        order.post_id = sentPost.id;
        order.status = Order_status.ON_THE_ROAD;
        await queryRunner.manager.save(order);
      }

      /**
       * 7️⃣ Original postni yangilash.
       * Yuborilgan orderlar chiqib ketdi — qolganlarni qayta hisoblaymiz.
       *
       * MUHIM: aktiv (soft-delete bo'lmagan) orderlar bo'yicha hisoblaymiz,
       * lekin postni o'chirishda HAR QANDAY (soft-deleted'lar bilan) order qolmaganini
       * tekshiramiz — aks holda soft-deleted orderlar yetim qoladi (audit uziladi).
       */
      const remainingOrders = await queryRunner.manager.find(OrderEntity, {
        where: { post_id: id },
      });
      const totalIncludingDeleted = await queryRunner.manager.count(OrderEntity, {
        where: { post_id: id },
        withDeleted: true,
      });

      if (totalIncludingDeleted === 0) {
        await queryRunner.manager.delete(PostEntity, { id });
      } else if (remainingOrders.length === 0) {
        // Aktiv order yo'q, lekin soft-deleted'lar bor — postni o'chirmaymiz, faqat
        // 0 ga tushirib qoldiramiz (post tarix uchun saqlanadi).
        originalPost.order_quantity = 0;
        originalPost.post_total_price = 0;
        await queryRunner.manager.save(originalPost);
      } else {
        const remainingTotal = remainingOrders.reduce(
          (s, o) => s + (Number(o.total_price) || 0),
          0,
        );
        originalPost.order_quantity = remainingOrders.length;
        originalPost.post_total_price = remainingTotal;
        await queryRunner.manager.save(originalPost);
      }

      /**
       * 8️⃣ Natijani qaytarish (frontend uchun sentPost ma'lumotlari)
       */
      const updatedPost = await queryRunner.manager.findOne(PostEntity, {
        where: { id: sentPost.id },
        relations: ['courier', 'region'],
      });

      await queryRunner.commitTransaction();

      // Activity log — har bir buyurtma uchun
      for (const order of newOrders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: order.id,
          action: 'status_change',
          old_value: { status: Order_status.RECEIVED },
          new_value: { status: Order_status.ON_THE_ROAD, courier: updatedPost?.courier?.name },
          description: `Pochta jo'natildi — kuryer: ${updatedPost?.courier?.name || '-'}`,
        });
      }

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
      // 1️⃣ Postni topamiz (pessimistic lock — bir vaqtda 2 qurilmadan qabul qilinmasin)
      // Avval lock bilan postni olish (relations'siz)
      const lockedPost = await queryRunner.manager.findOne(PostEntity, {
        where: { id, courier_id: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedPost) throw new NotFoundException('Post not found');
      // Keyin relations yuklash
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id },
        relations: ['orders'],
      });
      if (!post) throw new NotFoundException('Post not found');
      if (post.status !== Post_status.SENT)
        throw new BadRequestException('Cannot receive post with this status!');

      const waitingOrderIds: string[] = ordersArrayDto.order_ids ?? [];

      // 2️⃣ DTOdagi orderlarni WAITING holatiga qaytaramiz (agar ON_THE_ROAD bo'lsa)
      if (waitingOrderIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          {
            id: In(waitingOrderIds),
            post_id: id,
            status: Order_status.ON_THE_ROAD,
          },
          { status: Order_status.WAITING },
        );
      }

      // 3️⃣ Post ichidagi qolgan ON_THE_ROAD orderlarni topamiz (courier tanlamagan)
      const remainingOrders = post.orders.filter(
        (order) =>
          order.status === Order_status.ON_THE_ROAD &&
          !waitingOrderIds.includes(order.id),
      );

      // 4️⃣ Tanlanmagan orderlarni WAITING statusga o'tkazib, return_requested = true qilamiz
      //    Buyurtmalar courier hisobida qoladi, faqat admin tasdiqlasa pochtaga qaytadi
      if (remainingOrders.length > 0) {
        for (const o of remainingOrders) {
          await queryRunner.manager.update(
            OrderEntity,
            { id: o.id, status: Order_status.ON_THE_ROAD },
            {
              status: Order_status.WAITING,
              return_requested: true,
            },
          );
        }
      }

      // 6️⃣ Asl post holatini RECEIVED qilamiz
      await queryRunner.manager.update(
        PostEntity,
        { id },
        { status: Post_status.RECEIVED },
      );

      // 7️⃣ Javob uchun WAITING orderlarni qaytaramiz
      const allOrdersInThePost = waitingOrderIds.length
        ? await queryRunner.manager.find(OrderEntity, {
            where: { id: In(waitingOrderIds) },
          })
        : [];

      await queryRunner.commitTransaction();

      // Activity log
      for (const orderId of waitingOrderIds) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: orderId,
          action: 'status_change',
          old_value: { status: Order_status.ON_THE_ROAD },
          new_value: { status: Order_status.WAITING },
          description: `Kuryer qabul qildi`,
          user,
        });
      }
      for (const o of remainingOrders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: o.id,
          action: 'return_requested',
          old_value: { status: Order_status.ON_THE_ROAD },
          new_value: { status: Order_status.WAITING, return_requested: true },
          description: `Kuryer qaytarish so'rovi yubordi`,
          user,
        });
      }

      return successRes(allOrdersInThePost, 200, 'Post received successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async receivePostWithScanner(user: JwtPayload, id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { qr_code_token: id, courier_id: user.id },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }
      if (post.status != Post_status.SENT) {
        throw new BadRequestException('Post can not be received!');
      }

      const orders = await queryRunner.manager.find(OrderEntity, {
        where: { post_id: post.id, status: Order_status.ON_THE_ROAD },
      });
      if (orders.length === 0) {
        throw new NotFoundException('There are not orders in this post');
      }

      for (const order of orders) {
        order.status = Order_status.WAITING;
        await queryRunner.manager.save(order);
      }

      post.status = Post_status.RECEIVED;
      await queryRunner.manager.save(post);

      await queryRunner.commitTransaction();

      // Activity log — har bir order uchun (scanner orqali ommaviy qabul qilindi)
      for (const order of orders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: order.id,
          action: 'status_change',
          old_value: { status: Order_status.ON_THE_ROAD },
          new_value: {
            status: Order_status.WAITING,
            post_id: post.id,
            total_price: order.total_price,
          },
          description: `Kuryer QR skaner orqali pochtani qabul qildi`,
          user,
          metadata: { source: 'scanner', post_token: post.qr_code_token },
        });
      }

      return successRes({}, 200, 'Post received successfully');
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

      // 2) Shu order tegishli bo'lgan postni faqat shu courierga bog'langanini tekshiramiz
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id: order.post_id, courier_id: user.id },
      });
      if (!post) {
        throw new NotFoundException(
          'Post not found or not assigned to this courier',
        );
      }

      // 3) Order statusini o'zgartiramiz
      order.status = Order_status.WAITING;
      await queryRunner.manager.save(order);

      // 4) Post ichida hali "ON_THE_ROAD" order bor yoki yo'qligini tekshiramiz
      const activeOrdersCount = await queryRunner.manager.count(OrderEntity, {
        where: { post_id: post.id, status: Order_status.ON_THE_ROAD },
      });

      if (activeOrdersCount === 0) {
        post.status = Post_status.RECEIVED;
        await queryRunner.manager.save(post);
      }

      // 5) Commit
      await queryRunner.commitTransaction();

      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'status_change',
        old_value: { status: Order_status.ON_THE_ROAD },
        new_value: {
          status: Order_status.WAITING,
          post_id: post.id,
          total_price: order.total_price,
        },
        description: `Kuryer QR skaner orqali bittalab qabul qildi`,
        user,
        metadata: { source: 'scanner', post_token: post.qr_code_token },
      });

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

      // 1️⃣ Order IDs tekshiruvi
      if (!order_ids?.length) {
        throw new BadRequestException('No orders provided');
      }

      // 2️⃣ Faqat CANCELLED holatdagi orderlarni topish
      const orders = await queryRunner.manager.find(OrderEntity, {
        where: { id: In(order_ids), status: Order_status.CANCELLED },
      });

      if (orders.length !== order_ids.length) {
        throw new BadRequestException(
          'Some orders not found or not in Canceled status',
        );
      }

      // 3️⃣ Courierni tekshirish
      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });

      if (!courier) {
        throw new NotFoundException('Courier not found');
      }

      // 4️⃣ Mavjud canceled postni topish (faqat courier bo'yicha)
      let canceledPost = await queryRunner.manager.findOne(PostEntity, {
        where: { courier_id: courier.id, status: Post_status.CANCELED },
      });

      // 5️⃣ Agar yo'q bo'lsa, yangi canceled post yaratamiz
      if (!canceledPost) {
        const customToken = generateCustomToken();

        canceledPost = queryRunner.manager.create(PostEntity, {
          courier_id: courier.id,
          region_id: courier.region_id, // optional, faqat qo'shimcha info sifatida
          post_total_price: 0,
          order_quantity: 0,
          qr_code_token: customToken,
          status: Post_status.CANCELED,
        });

        canceledPost = await queryRunner.manager.save(canceledPost);
      }

      // 6️⃣ Canceled postning mavjud qiymatlarini olish
      let canceledOrderQt: number = Number(canceledPost.order_quantity) || 0;
      let canPostTotalPrice: number = Number(canceledPost.post_total_price) || 0;

      // 7️⃣ Har bir orderni yangilash
      for (const order of orders) {
        order.canceled_post_id = canceledPost.id;
        order.status = Order_status.CANCELLED_SENT;
        canceledOrderQt++;
        canPostTotalPrice += Number(order.total_price) || 0;
      }

      // 8️⃣ Orderlarni saqlash
      await queryRunner.manager.save(orders);

      // 9️⃣ Canceled postni yangilash
      canceledPost.order_quantity = canceledOrderQt;
      canceledPost.post_total_price = canPostTotalPrice;
      await queryRunner.manager.save(canceledPost);

      // 🔟 Transactionni yakunlash
      await queryRunner.commitTransaction();

      // Activity log
      for (const oid of order_ids) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: oid,
          action: 'status_change',
          new_value: { status: Order_status.CANCELLED_SENT },
          description: `Bekor qilingan buyurtma pochtaga qaytarildi`,
          user,
        });
      }

      return successRes(
        { post_id: canceledPost.id, order_ids },
        200,
        'Canceled orders successfully sent to central post',
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
      if (post.status != Post_status.CANCELED) {
        throw new BadRequestException(
          'Post with this status can not be received!',
        );
      }

      // DTO orqali kelgan order_id lar (uniq va filter)
      const canceledOrderIds = Array.isArray(ordersArrayDto.order_ids)
        ? Array.from(new Set(ordersArrayDto.order_ids))
        : [];

      // Postga tegishli barcha orderlar
      const allOrders = await queryRunner.manager.find(OrderEntity, {
        where: { canceled_post_id: post.id },
      });

      // Tekshiramiz: DTO dagi id'lar haqiqatan ham shu pochtaga tegishlimi?
      const allOrderIdsForPost = allOrders.map((o) => o.id);
      const invalidIds = canceledOrderIds.filter(
        (id) => !allOrderIdsForPost.includes(id),
      );
      if (invalidIds.length > 0) {
        // ixtiyoriy: xato qilib chiqarish yoki shunchaki e'tiborga olmaslik mumkin.
        throw new BadRequestException(
          `Some order_ids do not belong to this post: ${invalidIds.join(', ')}`,
        );
      }

      // Kelgan id-lar => CLOSED
      if (canceledOrderIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(canceledOrderIds) },
          { status: Order_status.CLOSED },
        );
      }

      // Qolgan orderlar (id lar) => CANCELED
      const remainingOrderIds = allOrderIdsForPost.filter(
        (orderId) => !canceledOrderIds.includes(orderId),
      );

      if (remainingOrderIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(remainingOrderIds) },
          { status: Order_status.CANCELLED, canceled_post_id: null },
        );
      }

      // Pochtaning statusi har doim Canceled_RECEIVED bo'lib qoladi
      await queryRunner.manager.update(
        PostEntity,
        { id },
        { status: Post_status.CANCELED_RECEIVED },
      );

      await queryRunner.commitTransaction();

      // Activity log
      for (const oid of (ordersArrayDto.order_ids || [])) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: oid,
          action: 'status_change',
          new_value: { status: Order_status.CLOSED },
          description: `Bekor qilingan buyurtma qabul qilindi (CLOSED)`,
        });
      }
      for (const oid of remainingOrderIds) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: oid,
          action: 'status_change',
          new_value: { status: Order_status.CANCELLED },
          description: `Buyurtma qabul qilinmadi — kuryerga qaytarildi`,
        });
      }

      return successRes({}, 200, 'Post received successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Qaytarish so'rovi yuborilgan buyurtmalarni olish (admin uchun)
   * Courier bo'yicha guruhlab qaytaradi
   */
  async getReturnRequests() {
    try {
      const orders = await this.orderRepo.find({
        where: {
          return_requested: true,
          status: Order_status.WAITING,
        },
        relations: ['customer', 'district', 'district.region', 'post', 'post.courier'],
        order: { created_at: 'DESC' },
      });

      // Courier bo'yicha guruhlash
      const courierMap = new Map<string, { courier: any; orders: any[] }>();
      for (const order of orders) {
        const courierId = order.post?.courier_id || 'unknown';
        if (!courierMap.has(courierId)) {
          courierMap.set(courierId, {
            courier: order.post?.courier || null,
            orders: [],
          });
        }
        courierMap.get(courierId)!.orders.push(order);
      }

      const grouped = Array.from(courierMap.values());

      return successRes(
        { total: orders.length, groups: grouped },
        200,
        'Return requests',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Qaytarish so'rovlarini tasdiqlash (admin)
   * Buyurtmalar courier hisobidan olinib pochtaga (NEW post) qaytariladi
   */
  async approveReturnRequests(ordersArrayDto: { order_ids: string[] }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderIds = ordersArrayDto.order_ids;
      if (!orderIds || orderIds.length === 0) {
        throw new BadRequestException('Order IDs required');
      }

      const orders = await queryRunner.manager.find(OrderEntity, {
        where: {
          id: In(orderIds),
          return_requested: true,
          status: Order_status.WAITING,
        },
        relations: ['district', 'customer', 'customer.district', 'post'],
      });

      if (orders.length === 0) {
        throw new NotFoundException('No return-requested orders found');
      }

      // Region bo'yicha guruhlash (newPosts() bilan bir xil mantiq)
      const regionOrdersMap = new Map<string, OrderEntity[]>();
      for (const order of orders) {
        const district = order.district || order.customer?.district;
        if (!district) {
          throw new NotFoundException(
            `District not found for order ${order.id}`,
          );
        }
        const regionId = district.assigned_region;
        if (!regionId) continue;
        if (!regionOrdersMap.has(regionId)) {
          regionOrdersMap.set(regionId, []);
        }
        regionOrdersMap.get(regionId)!.push(order);
      }

      // Eski pochtalardan buyurtma soni va summasini kamaytirish uchun
      const oldPostUpdates = new Map<string, { count: number; total: number }>();
      for (const order of orders) {
        if (order.post_id) {
          const existing = oldPostUpdates.get(order.post_id) || { count: 0, total: 0 };
          existing.count += 1;
          existing.total += Number(order.total_price) || 0;
          oldPostUpdates.set(order.post_id, existing);
        }
      }

      // Eski pochtalar statistikasini kamaytirish
      for (const [oldPostId, delta] of oldPostUpdates) {
        const oldPost = await queryRunner.manager.findOne(PostEntity, {
          where: { id: oldPostId },
        });
        if (oldPost) {
          await queryRunner.manager.update(PostEntity, { id: oldPostId }, {
            order_quantity: Math.max(0, (Number(oldPost.order_quantity) || 0) - delta.count),
            post_total_price: Math.max(0, (Number(oldPost.post_total_price) || 0) - delta.total),
          });
        }
      }

      // Har bir region uchun NEW post topish/yaratish va orderlarni ko'chirish
      for (const [regionId, regionOrders] of regionOrdersMap) {
        let newPost = await queryRunner.manager.findOne(PostEntity, {
          where: { region_id: regionId, status: Post_status.NEW },
        });

        if (!newPost) {
          const customToken = generateCustomToken();
          newPost = queryRunner.manager.create(PostEntity, {
            region_id: regionId,
            order_quantity: 0,
            post_total_price: 0,
            status: Post_status.NEW,
            qr_code_token: customToken,
          });
          newPost = await queryRunner.manager.save(newPost);
        }

        let totalAdded = 0;
        let countAdded = 0;

        for (const order of regionOrders) {
          // update() ishlatamiz — save() da yuklangan post relation
          // yangi post_id ni bekor qilib eski qiymatni saqlab qo'yadi
          await queryRunner.manager.update(OrderEntity, { id: order.id }, {
            status: Order_status.RECEIVED,
            return_requested: false,
            post_id: newPost.id,
          });

          totalAdded += Number(order.total_price) || 0;
          countAdded += 1;
        }

        if (countAdded > 0) {
          await queryRunner.manager.update(
            PostEntity,
            { id: newPost.id },
            {
              order_quantity: (Number(newPost.order_quantity) || 0) + countAdded,
              post_total_price: (Number(newPost.post_total_price) || 0) + totalAdded,
            },
          );
        }
      }

      await queryRunner.commitTransaction();

      for (const order of orders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: order.id,
          action: 'return_approved',
          old_value: { status: Order_status.WAITING, return_requested: true },
          new_value: { status: Order_status.RECEIVED, return_requested: false },
          description: `Qaytarish so'rovi tasdiqlandi — buyurtma pochtaga qaytarildi`,
        });
      }

      return successRes(
        { approved: orders.length },
        200,
        'Return requests approved',
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Qaytarish so'rovlarini rad etish (admin)
   * Buyurtmalar courier hisobida qoladi, return_requested = false
   */
  async rejectReturnRequests(ordersArrayDto: { order_ids: string[] }) {
    try {
      const orderIds = ordersArrayDto.order_ids;
      if (!orderIds || orderIds.length === 0) {
        throw new BadRequestException('Order IDs required');
      }

      await this.orderRepo.update(
        {
          id: In(orderIds),
          return_requested: true,
          status: Order_status.WAITING,
        },
        { return_requested: false },
      );

      for (const oid of orderIds) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: oid,
          action: 'return_rejected',
          new_value: { return_requested: false },
          description: `Qaytarish so'rovi rad etildi — buyurtma kuryerda qoldi`,
        });
      }

      return successRes(
        { rejected: orderIds.length },
        200,
        'Return requests rejected — orders remain with courier',
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
