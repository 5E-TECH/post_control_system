import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SendPostDto } from './dto/send-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { PostRepository } from 'src/core/repository/post.repository';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import {
  Between,
  DataSource,
  In,
  IsNull,
  Not,
  QueryRunner,
  Repository,
} from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import {
  Group_type,
  Order_status,
  Post_status,
  Replacement_state,
  Roles,
  Status,
  Where_deliver,
} from 'src/common/enums';
import { ReceivePostDto } from './dto/receive-post.dto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { normalizeQrToken } from 'src/infrastructure/lib/qr-token/normalize';
import { PostDto } from './dto/postId.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { LdgShipmentService } from '../ldg-cargo/ldg-shipment.service';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { BotService } from '../bots/notify-bot/bot.service';
import { CourierRegionEntity } from 'src/core/entity/courier-region.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';

// Eski pochtalar (old posts) ro'yxatiga beriladigan filtrlar.
export interface OldPostsFilter {
  region_id?: string;
  courier_id?: string;
  status?: string;
  startDate?: string; // YYYY-MM-DD (UZB)
  endDate?: string; // YYYY-MM-DD (UZB)
}

// YYYY-MM-DD oralig'ini created_at (epoch ms) bo'yicha TypeORM Between'ga
// aylantiradi. Faqat bittasi berilsa — o'sha kunning boshi..oxiri olinadi.
function buildCreatedAtRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  const from = startDate || endDate!;
  const to = endDate || startDate!;
  return Between(
    toUzbekistanTimestamp(from, false),
    toUzbekistanTimestamp(to, true),
  );
}

// Pochta LDG'ga jo'natilganda buyurtmalar orasidagi pauza (ms).
// LDG rate-limitidan (429) oshib ketmaslik uchun ketma-ket so'rovlarni sekinlatamiz.
const LDG_DISPATCH_DELAY_MS = 400;

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepo: PostRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(CourierRegionEntity)
    private readonly courierRegionRepo: Repository<CourierRegionEntity>,

    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,

    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
    private readonly ldgShipmentService: LdgShipmentService,
    private readonly botService: BotService,
  ) {}

  /**
   * Pochta jo'natilganda kuryer LDG vakil bo'lsa, har bir buyurtmani LDG'ga
   * yuboradi (fire-and-forget). Xato bo'lsa shipmentning `last_error` maydonida
   * saqlanadi va asosiy oqimga ta'sir qilmaydi.
   *
   * Bu yer arxitekturaning yagona LDG dispatch nuqtasi: buyurtma yaratish payti
   * emas, balki operator pochtani LDG vakil-kuryerga biriktirgan vaqt.
   */
  private dispatchOrdersToLdg(orderIds: string[]): void {
    void (async () => {
      for (const orderId of orderIds) {
        try {
          await this.ldgShipmentService.createShipmentForOrder(orderId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `LDG'ga jo'natish muvaffaqiyatsiz (order=${orderId}): ${msg}`,
          );
        }
        // LDG rate-limit (429 "Too Many Attempts")ni keltirib chiqarmaslik uchun
        // har bir so'rov orasida kichik pauza — ketma-ket "bombardimon" qilmaymiz.
        // Baribir muvaffaqiyatsiz bo'lganlarni LDG auto-retry cron'i keyin tuzatadi.
        await new Promise((resolve) =>
          setTimeout(resolve, LDG_DISPATCH_DELAY_MS),
        );
      }
    })();
  }

  async findAll(
    page: number,
    limit: number,
    filter: OldPostsFilter = {},
  ): Promise<object> {
    try {
      // Sahifani to'g'rilab olamiz
      const take = limit > 100 ? 100 : limit; // limit maksimal 100 ta
      const skip = (page - 1) * take;

      // Filtrlar: viloyat / kuryer / status / sana oralig'i.
      // Status berilsa o'shani, aks holda NEW'dan boshqa barcha statuslar.
      const where: Record<string, any> = {
        status:
          filter.status && filter.status !== 'all'
            ? (filter.status as Post_status)
            : Not(Post_status.NEW),
      };
      if (filter.region_id) where.region_id = filter.region_id;
      if (filter.courier_id) where.courier_id = filter.courier_id;
      const createdAt = buildCreatedAtRange(filter.startDate, filter.endDate);
      if (createdAt) where.created_at = createdAt;

      // 🔎 Umumiy ma'lumotlar
      const [data, total] = await this.postRepo.findAndCount({
        where,
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

  /**
   * Eski pochtalar filtri uchun (admin) viloyat↔kuryer dropdownlarini o'zaro
   * cheklash ma'lumotlari. Manba — biriktirish (assignment), pochta tarixi
   * emas:
   *  - oddiy kuryer → o'z viloyati (users.region_id);
   *  - super kuryer → unga biriktirilgan viloyatlar (courier_regions);
   *  - super kuryer serves_all_regions → barcha viloyatlar.
   * Shuning uchun super kuryer tanlanganda unga tegishli BARCHA viloyatlar
   * chiqadi (3 ta biriktirilgan bo'lsa 3, hammasiga bo'lsa hammasi).
   *
   * `couriers` — eski pochtasi bor kuryerlar (filtr uchun mazmunli ro'yxat),
   * har biri o'zining biriktirilgan viloyatlari bilan.
   * `regions` — barcha viloyatlar (nom lookup + serves_all uchun).
   * `postRegionIds` — eski pochtasi bor viloyatlar (hech narsa tanlanmaganda
   * asosiy ro'yxat).
   */
  async oldPostsFilterOptions(): Promise<object> {
    try {
      // 1️⃣ Eski (NEW emas) pochtalarda haqiqatan ishtirok etgan kuryer/viloyat
      const postRows = await this.postRepo
        .createQueryBuilder('post')
        .select('post.region_id', 'region_id')
        .addSelect('post.courier_id', 'courier_id')
        .where('post.status != :newStatus', { newStatus: Post_status.NEW })
        .groupBy('post.region_id')
        .addGroupBy('post.courier_id')
        .getRawMany();

      const postRegionIds = [
        ...new Set(postRows.map((r) => r.region_id).filter(Boolean)),
      ];
      const postCourierIds = [
        ...new Set(postRows.map((r) => r.courier_id).filter(Boolean)),
      ];

      // Kuryer → u haqiqatan eski pochta tashigan viloyatlar (assignmentdan
      // tashqari, mosligini kafolatlash uchun union qilamiz).
      const courierPostRegions = new Map<string, Set<string>>();
      for (const r of postRows) {
        if (!r.courier_id || !r.region_id) continue;
        const s = courierPostRegions.get(r.courier_id) || new Set<string>();
        s.add(r.region_id);
        courierPostRegions.set(r.courier_id, s);
      }

      // 2️⃣ Barcha viloyatlar (nom lookup + serves_all kuryer uchun)
      const regionRows = await this.regionRepo.find({
        select: ['id', 'name'],
        order: { name: 'ASC' },
      });
      const regions = regionRows.map((r) => ({ id: r.id, name: r.name }));

      // 3️⃣ Eski pochtasi bor kuryerlar
      const couriersList = postCourierIds.length
        ? await this.userRepo.find({
            where: { id: In(postCourierIds) },
            select: [
              'id',
              'name',
              'region_id',
              'is_super_courier',
              'serves_all_regions',
            ],
          })
        : [];

      // 4️⃣ Super kuryerlarning biriktirilgan viloyatlari (courier_regions)
      const superCourierIds = couriersList
        .filter((c) => c.is_super_courier && !c.serves_all_regions)
        .map((c) => c.id);
      const attachedRows = superCourierIds.length
        ? await this.courierRegionRepo.find({
            where: { courier_id: In(superCourierIds) },
            select: ['courier_id', 'region_id'],
          })
        : [];
      const attachedMap = new Map<string, string[]>();
      for (const a of attachedRows) {
        const arr = attachedMap.get(a.courier_id) || [];
        arr.push(a.region_id);
        attachedMap.set(a.courier_id, arr);
      }

      // 5️⃣ Har bir kuryer uchun viloyatlar ro'yxati: biriktirish ∪ haqiqiy
      // pochta viloyatlari (serves_all bo'lsa — bo'sh, frontend "hammasi" deydi)
      const couriers = couriersList.map((c) => {
        const regionSet = new Set<string>();
        if (!c.serves_all_regions) {
          if (c.is_super_courier) {
            (attachedMap.get(c.id) || []).forEach((rid) => regionSet.add(rid));
          } else if (c.region_id) {
            regionSet.add(c.region_id);
          }
          // Haqiqatan tashigan viloyatlarni ham qo'shamiz
          courierPostRegions.get(c.id)?.forEach((rid) => regionSet.add(rid));
        }
        return {
          id: c.id,
          name: c.name,
          serves_all: c.serves_all_regions,
          region_ids: Array.from(regionSet),
        };
      });

      return successRes(
        { regions, couriers, postRegionIds },
        200,
        'Old posts filter options',
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
      const orphanOrders =
        lockedOrders.length > 0
          ? await queryRunner.manager.find(OrderEntity, {
              where: { id: In(lockedOrders.map((o) => o.id)) },
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
          (Number(post.post_total_price) || 0) +
          (Number(order.total_price) || 0);
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
        const regionId = (order.district || order.customer?.district)
          ?.assigned_region;
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
    filter: OldPostsFilter = {},
  ): Promise<object> {
    try {
      const take = limit > 100 ? 100 : limit; // limit maksimal 100 ta
      const skip = (page - 1) * take;

      // Kuryer uchun: status (pochta turi — qabul qilingan / bekor qilingan)
      // berilsa o'shani, aks holda SENT/NEW'dan boshqa barcha statuslar.
      const where: Record<string, any> = {
        status:
          filter.status && filter.status !== 'all'
            ? (filter.status as Post_status)
            : Not(In([Post_status.SENT, Post_status.NEW])),
        courier_id: user.id,
      };
      const createdAt = buildCreatedAtRange(filter.startDate, filter.endDate);
      if (createdAt) where.created_at = createdAt;

      const [data, total] = await this.postRepo.findAndCount({
        where,
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
        where: { qr_code_token: normalizeQrToken(id) },
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
      // Oddiy (regional) kuryerlar — mavjud xatti-harakat: post regioni bo'yicha.
      // Super kuryerlarni bu ro'yxatdan chiqaramiz (ular alohida qaytariladi).
      const couriers = await this.userRepo.find({
        where: {
          region_id: post.region_id,
          status: Status.ACTIVE,
          is_super_courier: false,
        },
      });

      // Super kuryerlar: barcha viloyatlarga xizmat qiladiganlar (LDG kabi)
      // YOKI shu viloyatga aniq biriktirilganlar.
      const superCouriersMap = new Map<string, UserEntity>();
      const allRegionSupers = await this.userRepo.find({
        where: {
          is_super_courier: true,
          serves_all_regions: true,
          status: Status.ACTIVE,
        },
      });
      for (const c of allRegionSupers) superCouriersMap.set(c.id, c);

      const attached = await this.courierRegionRepo.find({
        where: { region_id: post.region_id },
        relations: ['courier'],
      });
      for (const a of attached) {
        const c = a.courier;
        if (c && c.status === Status.ACTIVE && c.is_super_courier) {
          superCouriersMap.set(c.id, c);
        }
      }
      const superCouriers = Array.from(superCouriersMap.values());

      if (couriers.length === 0 && superCouriers.length === 0) {
        throw new NotFoundException(
          'There are not any active couriers for this region',
        );
      }

      // Super kuryer mavjud bo'lsa, hech qachon avtomatik jo'natilmaydi —
      // operator aniq tanlashi shart (xato dispatch oldini olish).
      const moreThanOneCourier: boolean =
        superCouriers.length > 0 ? true : couriers.length !== 1;

      return successRes(
        {
          moreThanOneCourier,
          couriers,
          superCouriers,
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
          'replacementOf', // almashtirish: yangi buyurtmada eski #raqam ko'rsatish
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
          post: {
            id: post.id,
            status: post.status,
            order_quantity: post.order_quantity,
            qr_code_token: post.qr_code_token,
            courier_id: post.courier_id,
          },
        },
        200,
        'All orders by post id',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getRejectedPostsOrders(id: string, user: JwtPayload) {
    try {
      // IDOR himoyasi: kuryer faqat o'ziga tegishli bekor qilingan pochta
      // buyurtmalarini ko'ra oladi (courier-order-ownership remediatsiyasiga
      // mos). Admin/superadmin/registrator/logist cheklanmaydi.
      const post = await this.postRepo.findOne({ where: { id } });
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      if (user?.role === Roles.COURIER && post.courier_id !== user.id) {
        throw new ForbiddenException('Bu pochta sizga tegishli emas');
      }
      const allOrdersByPostId = await this.orderRepo.find({
        where: { canceled_post_id: id },
        relations: [
          'customer',
          'district',
          'district.region',
          'customer.district',
          'items',
          'items.product',
          'market',
          'replacementOf', // almashtirish: yangi buyurtmada eski #raqam ko'rsatish
        ],
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
      // Caps Lock yoki RU layout muammosini bartaraf qilamiz
      const order = await this.orderRepo.findOne({
        where: {
          qr_code_token: normalizeQrToken(id),
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
      // Caps Lock yoki RU layout muammosini bartaraf qilamiz
      const order = await this.orderRepo.findOne({
        where: {
          qr_code_token: normalizeQrToken(id),
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
  async reassignCourier(
    postId: string,
    newCourierId: string,
    user: JwtPayload,
  ) {
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
        throw new BadRequestException(
          "Faqat jo'natilgan pochtani o'tkazish mumkin",
        );
      }

      const oldCourier = post.courier;
      const oldCourierId = post.courier_id;

      if (oldCourierId === newCourierId) {
        throw new BadRequestException('Pochta allaqachon shu kuryerda');
      }

      const newCourier = await queryRunner.manager.findOne(UserEntity, {
        where: {
          id: newCourierId,
          role: Roles.COURIER,
          status: Status.ACTIVE,
        },
      });
      if (!newCourier) {
        throw new NotFoundException(
          "Faol kuryer topilmadi (bloklangan kuryerga pochta biriktirib bo'lmaydi)",
        );
      }

      // Kuryerni o'zgartirish — update() ishlatamiz
      // save() da yuklangan courier relation yangi courier_id ni bekor qiladi
      await queryRunner.manager.update(
        PostEntity,
        { id: postId },
        {
          courier_id: newCourierId,
        },
      );

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
        {
          post_id: postId,
          old_courier: oldCourier?.name,
          new_courier: newCourier.name,
        },
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

  async sendPost(
    id: string,
    dto: SendPostDto,
    user?: JwtPayload,
  ): Promise<object> {
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
        throw new BadRequestException(
          "Post topilmadi yoki artiq jo'natib bo'lmaydi",
        );
      }

      /**
       * 2️⃣ Kuryerni tekshirish — faqat ACTIVE statusidagi kuryerga
       * pochta jo'natilishi mumkin (bloklangan kuryerlar chiqarib tashlanadi).
       */
      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: {
          id: courierId,
          role: Roles.COURIER,
          status: Status.ACTIVE,
        },
      });
      if (!courier) {
        throw new NotFoundException(
          "Faol kuryer topilmadi. Iltimos, ro'yxatdan boshqa kuryerni tanlang.",
        );
      }

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
        relations: [
          'market',
          'customer',
          'district',
          'district.region',
          'customer.district',
        ],
      });

      if (newOrders.length === 0)
        throw new BadRequestException(
          'Tanlangan buyurtmalar bu pochtada topilmadi',
        );

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
       * Super kuryer: order'ga to'g'ri kuryer tarifini SNAPSHOT qilamiz.
       * Region tarifi bo'lsa (courier_regions) — shuni, yo'q bo'lsa kuryerning
       * umumiy flat tarifiga (users.tariff_*) fallback. Sotish/qisman/bekor
       * oqimlari `order.courier_tariff` ni ustun ko'radi — shuning uchun bu
       * snapshot multi-region tarifni to'g'ri qo'llaydi (moliyaviy yadro o'zgarmaydi).
       */
      let superTariffHome: number | null = null;
      let superTariffCenter: number | null = null;
      if (courier.is_super_courier) {
        const cr = await queryRunner.manager.findOne(CourierRegionEntity, {
          where: { courier_id: courierId, region_id: originalPost.region_id },
        });
        superTariffHome = cr?.tariff_home ?? courier.tariff_home ?? null;
        superTariffCenter = cr?.tariff_center ?? courier.tariff_center ?? null;
      }

      /**
       * 6️⃣ Tanlangan orderlarni yangi sentPost ga ko'chirish va ON_THE_ROAD qilish
       */
      for (const order of newOrders) {
        order.post_id = sentPost.id;
        order.status = Order_status.ON_THE_ROAD;
        if (courier.is_super_courier) {
          const t =
            order.where_deliver === Where_deliver.CENTER
              ? superTariffCenter
              : superTariffHome;
          if (t != null) order.courier_tariff = t;
        }
        await queryRunner.manager.save(order);
      }

      /**
       * 7️⃣ Original postni yangilash.
       * Yuborilgan orderlar chiqib ketdi — qolganlarni qayta hisoblaymiz.
       *
       * MUHIM: originalPost bu yerda DOIM NEW (yuqorida tekshirilgan) — ya'ni
       * hali hech qayerga jo'natilmagan yig'ish "savati". Agar undan aktiv
       * buyurtma qolmasa, uni saqlashning audit qiymati yo'q (buyurtma auditi
       * order qatori + activity_log'da turadi). Shu sababli bo'sh qolgan NEW
       * postni O'CHIRAMIZ — soft-deleted buyurtmalar bo'lsa ham. Ular FK
       * (onDelete: SET NULL) orqali ajraladi, audit ma'lumotlari saqlanadi.
       *
       * Bu — "jo'natilgandan keyin 0-buyurtmali bo'sh pochta yana qolib
       * ketishi" muammosining oldini oladi (avval soft-deleted'lar tufayli
       * post o'chmasdan cheksiz takrorlanardi).
       */
      const remainingOrders = await queryRunner.manager.find(OrderEntity, {
        where: { post_id: id },
      });

      if (remainingOrders.length === 0) {
        await queryRunner.manager.delete(PostEntity, { id });
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

      // Activity log — har bir buyurtma uchun (kim jo'natganini saqlab qoldiramiz)
      for (const order of newOrders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: order.id,
          action: 'status_change',
          old_value: { status: Order_status.RECEIVED },
          new_value: {
            status: Order_status.ON_THE_ROAD,
            courier: updatedPost?.courier?.name,
          },
          description: `Pochta jo'natildi — kuryer: ${updatedPost?.courier?.name || '-'}`,
          user,
          metadata: {
            post_id: sentPost.id,
            courier_id: courierId,
            courier_name: updatedPost?.courier?.name,
          },
        });
      }

      // LDG dispatch — kuryer external_provider='ldg' bo'lsa, buyurtmalarni LDG'ga
      // yuboramiz. Aks holda hech narsa qilmaymiz (oddiy ichki kuryer).
      // Operator qaysi buyurtmani LDG kuryeriga, qaysini boshqa kuryerga
      // jo'natishni o'zi tanlaydi — tuman bo'yicha avtomatik filtr yo'q.
      if (courier.external_provider === 'ldg') {
        this.dispatchOrdersToLdg(newOrders.map((o) => o.id));
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
        where: { qr_code_token: normalizeQrToken(id), courier_id: user.id },
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

  /**
   * QR token bo'yicha bittalab buyurtmani qabul qilish (kuryer skaneri).
   * Postdagi har bir buyurtma uchun bir marta chaqiriladi — ON_THE_ROAD → WAITING.
   * Oxirgi buyurtma qabul qilinganda post.status avtomatik RECEIVED bo'ladi.
   *
   * Bu metod xuddi receiveOrderWithScanerCourier kabi, lekin order ID o'rniga
   * QR token oladi — frontend skanerdan to'g'ridan-to'g'ri token kelganda qulay.
   */
  async receiveOrderByQrTokenForCourier(token: string, user: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1) Tokenga qarab buyurtmani topamiz — faqat qaysi pochta ekanini bilish
      //    uchun (Caps Lock / RU layout uchun normalize). Lock keyin postda.
      const normToken = normalizeQrToken(token);
      const orderRef = await queryRunner.manager.findOne(OrderEntity, {
        where: { qr_code_token: normToken },
        select: ['id', 'post_id'],
      });
      if (!orderRef) {
        throw new NotFoundException('QR koddagi buyurtma topilmadi');
      }
      if (!orderRef.post_id) {
        throw new BadRequestException(
          'Bu buyurtma hali pochtaga biriktirilmagan',
        );
      }

      // 2) Postni PESSIMISTIC_WRITE lock bilan olamiz — shu post uchun barcha
      //    qabul qilishlar ketma-ket bajariladi. Bir vaqtda 2 skan/retry (yoki
      //    2 qurilma) post'ni 2 marta RECEIVED qilib, RECEIVED nojo'ya
      //    ta'sirlarini 2 marta otishining oldini oladi.
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id: orderRef.post_id, courier_id: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post) {
        throw new NotFoundException(
          'Pochta topilmadi yoki sizga biriktirilmagan',
        );
      }
      if (post.status !== Post_status.SENT) {
        throw new BadRequestException(
          "Bu pochta allaqachon qabul qilingan yoki yo'lda emas",
        );
      }

      // 3) Buyurtmani post lock'idan KEYIN qayta o'qiymiz — statusi endi eng
      //    yangi (parallel qabul qilingan bo'lsa, u allaqachon commit bo'lgan).
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: orderRef.id },
        relations: ['customer'],
      });
      if (!order) {
        throw new NotFoundException('QR koddagi buyurtma topilmadi');
      }
      if (order.status !== Order_status.ON_THE_ROAD) {
        throw new BadRequestException(
          `Bu buyurtma allaqachon qabul qilingan (${order.status})`,
        );
      }

      // 4) Buyurtmani WAITING ga o'tkazamiz
      order.status = Order_status.WAITING;
      await queryRunner.manager.save(order);

      // 5) Postda yana ON_THE_ROAD buyurtma qolganmi?
      const remaining = await queryRunner.manager.count(OrderEntity, {
        where: { post_id: post.id, status: Order_status.ON_THE_ROAD },
      });

      let postReceived = false;
      if (remaining === 0) {
        post.status = Post_status.RECEIVED;
        await queryRunner.manager.save(post);
        postReceived = true;
      }

      await queryRunner.commitTransaction();

      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'status_change',
        old_value: { status: Order_status.ON_THE_ROAD },
        new_value: {
          status: Order_status.WAITING,
          post_id: post.id,
        },
        description: `Kuryer QR skaner orqali bittalab qabul qildi`,
        user,
        metadata: {
          source: 'scanner',
          scan_target: 'order',
          token,
        },
      });

      return successRes(
        {
          order_id: order.id,
          customer_name: order.customer?.name || null,
          remaining,
          postReceived,
        },
        200,
        postReceived
          ? 'Oxirgi buyurtma qabul qilindi — pochta RECEIVED'
          : 'Buyurtma qabul qilindi',
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Kuryer YANGI (SENT) pochta ichidagi hali skanerlanmagan buyurtmani
   * "kelmagan/kelmay qoldi" deb belgilab, qaytarish so'rovini yuboradi.
   *
   * Mantiq:
   *  - Buyurtma ON_THE_ROAD bo'lishi kerak (hali qabul qilinmagan)
   *  - Post SENT bo'lishi kerak (hali yo'lda)
   *  - Buyurtma WAITING ga o'tadi + return_requested = true bo'ladi
   *  - Agar oxirgi ON_THE_ROAD buyurtma bo'lsa — post avtomatik RECEIVED bo'ladi
   *    (xuddi skaner orqali oxirgini qabul qilgandagiday)
   */
  async markOrderForReturnRequestByCourier(orderId: string, user: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: orderId },
      });
      if (!order) {
        throw new NotFoundException('Buyurtma topilmadi');
      }
      if (!order.post_id) {
        throw new BadRequestException(
          'Bu buyurtma pochtaga biriktirilmagan',
        );
      }

      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id: order.post_id, courier_id: user.id },
      });
      if (!post) {
        throw new NotFoundException(
          'Pochta topilmadi yoki sizga biriktirilmagan',
        );
      }
      if (post.status !== Post_status.SENT) {
        throw new BadRequestException(
          "Bu pochta allaqachon qabul qilingan yoki yo'lda emas",
        );
      }
      if (order.status !== Order_status.ON_THE_ROAD) {
        throw new BadRequestException(
          `Bu buyurtmani qaytarishga belgilab bo'lmaydi (status: ${order.status})`,
        );
      }

      order.status = Order_status.WAITING;
      order.return_requested = true;
      await queryRunner.manager.save(order);

      const remaining = await queryRunner.manager.count(OrderEntity, {
        where: { post_id: post.id, status: Order_status.ON_THE_ROAD },
      });

      let postReceived = false;
      if (remaining === 0) {
        post.status = Post_status.RECEIVED;
        await queryRunner.manager.save(post);
        postReceived = true;
      }

      await queryRunner.commitTransaction();

      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'return_requested',
        old_value: { status: Order_status.ON_THE_ROAD },
        new_value: {
          status: Order_status.WAITING,
          return_requested: true,
        },
        description: `Kuryer buyurtmani qaytarishga belgiladi (skanerlanmagan)`,
        user,
        metadata: { source: 'courier_return_button' },
      });

      return successRes(
        {
          order_id: order.id,
          return_requested: true,
          remaining,
          postReceived,
        },
        200,
        postReceived
          ? "Qaytarish so'rovi yuborildi — pochta to'liq qabul qilindi"
          : "Qaytarish so'rovi yuborildi",
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Kuryer noto'g'ri belgilagan return-request'ni bekor qilishi mumkin
   * (admin hali approve/reject qilib ulgurmagan paytda).
   */
  async cancelReturnRequestByCourier(orderId: string, user: JwtPayload) {
    try {
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['post'],
      });
      if (!order) {
        throw new NotFoundException('Buyurtma topilmadi');
      }
      if (!order.post || order.post.courier_id !== user.id) {
        throw new NotFoundException(
          'Buyurtmaning pochtasi sizga biriktirilmagan',
        );
      }
      if (!order.return_requested) {
        throw new BadRequestException(
          "Bu buyurtmada qaytarish so'rovi yo'q",
        );
      }

      order.return_requested = false;
      await this.orderRepo.save(order);

      this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'return_request_cancelled',
        new_value: { return_requested: false },
        description: `Kuryer qaytarish so'rovini bekor qildi`,
        user,
      });

      return successRes(
        { order_id: order.id, return_requested: false },
        200,
        "Qaytarish so'rovi bekor qilindi",
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bekor qilingan (CANCELLED) buyurtmalarni kuryerning YAGONA qaytarish-postiga
   * (CANCELED status post) biriktiruvchi yadro mantiq.
   * `createCanceledPost` (tanlangan order_ids) va `sendAllCanceledOrders`
   * (barcha bekor qilinganlar) shu yordamchini ishlatadi.
   *
   * MUHIM:
   *  - `orders` chaqirilishidan oldin validatsiya qilingan va kuryerga tegishli
   *    (egalik tekshirilgan) bo'lishi shart.
   *  - Bu yerda kuryer bo'yicha tranzaksiya-darajali advisory lock olinadi —
   *    shu sababli bir kuryer uchun ayni vaqtda faqat bitta CANCELED post
   *    bo'ladi (ikki marta bosish / retry tufayli dublikat post yaratilmaydi).
   */
  private async attachOrdersToCanceledPost(
    queryRunner: QueryRunner,
    courier: UserEntity,
    orders: OrderEntity[],
  ): Promise<PostEntity> {
    // Kuryer bo'yicha tranzaksiya-darajali advisory lock. Parallel so'rovlar
    // bir-birini kutadi — "bir kuryer = bitta CANCELED post" invarianti saqlanadi.
    await queryRunner.manager.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`canceled_post:${courier.id}`],
    );

    let canceledPost = await queryRunner.manager.findOne(PostEntity, {
      where: { courier_id: courier.id, status: Post_status.CANCELED },
    });

    if (!canceledPost) {
      canceledPost = queryRunner.manager.create(PostEntity, {
        courier_id: courier.id,
        region_id: courier.region_id, // optional, faqat qo'shimcha info sifatida
        post_total_price: 0,
        order_quantity: 0,
        qr_code_token: generateCustomToken(),
        status: Post_status.CANCELED,
      });
      canceledPost = await queryRunner.manager.save(canceledPost);
    }

    let canceledOrderQt = Number(canceledPost.order_quantity) || 0;
    let canPostTotalPrice = Number(canceledPost.post_total_price) || 0;

    for (const order of orders) {
      order.canceled_post_id = canceledPost.id;
      order.status = Order_status.CANCELLED_SENT;
      canceledOrderQt++;
      canPostTotalPrice += Number(order.total_price) || 0;
    }

    await queryRunner.manager.save(orders);

    canceledPost.order_quantity = canceledOrderQt;
    canceledPost.post_total_price = canPostTotalPrice;
    await queryRunner.manager.save(canceledPost);

    return canceledPost;
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
      const uniqueIds = Array.from(new Set(order_ids));

      // 2️⃣ Faqat CANCELLED holatdagi VA shu kuryerga biriktirilgan orderlarni topish.
      //    Egalik post.courier_id orqali tekshiriladi — kuryer faqat o'zining
      //    bekor qilingan buyurtmalarini qaytarish-postiga yig'a oladi (IDOR oldini olish).
      const orders = await queryRunner.manager
        .createQueryBuilder(OrderEntity, 'o')
        .innerJoin('o.post', 'p')
        .where('o.id IN (:...ids)', { ids: uniqueIds })
        .andWhere('o.status = :st', { st: Order_status.CANCELLED })
        .andWhere('p.courier_id = :uid', { uid: user.id })
        .getMany();

      // 3️⃣ Aniq xato: qaysi buyurtma(lar) muammoli ekanini ko'rsatamiz.
      if (orders.length !== uniqueIds.length) {
        const foundIds = new Set(orders.map((o) => o.id));
        const problemIds = uniqueIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Quyidagi buyurtmalar topilmadi, "bekor qilingan" holatida emas yoki sizga tegishli emas: ${problemIds.join(', ')}`,
        );
      }

      // 4️⃣ Courierni tekshirish
      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });
      if (!courier) {
        throw new NotFoundException('Courier not found');
      }

      // 5️⃣ Yagona CANCELED postga biriktirish (advisory lock yordamchi ichida)
      const canceledPost = await this.attachOrdersToCanceledPost(
        queryRunner,
        courier,
        orders,
      );

      await queryRunner.commitTransaction();

      const attachedIds = orders.map((o) => o.id);
      for (const oid of attachedIds) {
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
        { post_id: canceledPost.id, order_ids: attachedIds },
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

  /**
   * Kuryerning BARCHA bekor qilingan (CANCELLED) buyurtmalarini bir martada
   * qaytarish-postiga yig'adi — sahifalashdan (pagination) qat'i nazar.
   * Avval kuryer har sahifani (10 talab) alohida yuborishga majbur edi; bu
   * endpoint butun ro'yxatni bitta amalda yuboradi.
   */
  async sendAllCanceledOrders(user: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Kuryerga tegishli (post.courier_id) barcha CANCELLED buyurtmalar.
      const orders = await queryRunner.manager
        .createQueryBuilder(OrderEntity, 'o')
        .innerJoin('o.post', 'p')
        .where('o.status = :st', { st: Order_status.CANCELLED })
        .andWhere('p.courier_id = :uid', { uid: user.id })
        .getMany();

      if (!orders.length) {
        throw new BadRequestException(
          "Qaytariladigan bekor qilingan buyurtma yo'q",
        );
      }

      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user.id },
      });
      if (!courier) {
        throw new NotFoundException('Courier not found');
      }

      const canceledPost = await this.attachOrdersToCanceledPost(
        queryRunner,
        courier,
        orders,
      );

      await queryRunner.commitTransaction();

      const orderIds = orders.map((o) => o.id);
      for (const oid of orderIds) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: oid,
          action: 'status_change',
          new_value: { status: Order_status.CANCELLED_SENT },
          description: `Bekor qilingan buyurtma pochtaga qaytarildi (barchasi)`,
          user,
        });
      }

      return successRes(
        { post_id: canceledPost.id, count: orderIds.length, order_ids: orderIds },
        200,
        `${orderIds.length} ta bekor qilingan buyurtma pochtaga yuborildi`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async receiveCanceledPost(
    id: string,
    ordersArrayDto: ReceivePostDto,
    user?: JwtPayload,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pochtani pessimistic_write lock bilan topamiz — relations'siz
      // (Postgres outer-join + FOR UPDATE'ni qabul qilmaydi). Lock tufayli
      // ayni paytda createCanceledPost/double-submit bilan poyga bo'lmaydi.
      const post = await queryRunner.manager.findOne(PostEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
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

      // Almashtirish (kafolat-swap) qatorlarini ajratamiz: ular SOTILGAN qoladi,
      // puli/statusi O'ZGARMAYDI; qabul qilinsa OLD_RETURNED bo'ladi (CLOSED emas).
      const isRepl = (o: OrderEntity) => o.is_replacement_return === true;
      const acceptedIdSet = new Set(canceledOrderIds);
      const acceptedOrders = allOrders.filter((o) => acceptedIdSet.has(o.id));
      const acceptedNormalIds = acceptedOrders
        .filter((o) => !isRepl(o))
        .map((o) => o.id);
      const acceptedReplOrders = acceptedOrders.filter(isRepl);

      const remainingOrders = allOrders.filter((o) => !acceptedIdSet.has(o.id));
      const remainingNormalIds = remainingOrders
        .filter((o) => !isRepl(o))
        .map((o) => o.id);
      // Qolgan ALMASHTIRISH qatorlari ATAYLAB tegilmaydi (SOLD + canceled_post_id
      // qoladi — keyingi qabulda olinishi mumkin; CANCELLED'ga aylantirilmaydi,
      // aks holda sotuvdan tushib hisobot buzilardi).

      // Qabul qilingan ODDIY buyurtmalar => CLOSED
      if (acceptedNormalIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(acceptedNormalIds) },
          { status: Order_status.CLOSED },
        );
      }

      // Qabul qilingan ALMASHTIRISH (eski) buyurtmalar => OLD_RETURNED.
      // Status SOTILGAN QOLADI, canceled_post_id QOLADI, PUL O'ZGARMAYDI —
      // "marketga qaytarildi" dalili: vaqt + qabul qilgan shaxs.
      const returnedAt = Date.now();
      if (acceptedReplOrders.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(acceptedReplOrders.map((o) => o.id)) },
          {
            replacement_state: Replacement_state.OLD_RETURNED,
            old_product_returned_at: returnedAt,
            old_returned_by: user?.id ?? null,
          },
        );
      }

      // Qabul qilinMAGAN ODDIY buyurtmalar => CANCELLED, postdan ajratiladi.
      // WHERE'da status=CANCELLED_SENT sharti: agar pochtadagi buyurtma allaqachon
      // boshqa yo'l bilan yakunlangan bo'lsa (masalan global skaner orqali CLOSED,
      // yoki qandaydir sabab bilan SOLD), uni ORQAGA qaytarmaymiz — CLOSED "faqat
      // skanerdan va qaytmaydi" invarianti buzilmasin.
      if (remainingNormalIds.length > 0) {
        await queryRunner.manager.update(
          OrderEntity,
          { id: In(remainingNormalIds), status: Order_status.CANCELLED_SENT },
          { status: Order_status.CANCELLED, canceled_post_id: null },
        );
      }

      // Post statistikasi: dona = qabul qilingan barcha buyurtmalar (jismoniy);
      // summa = faqat ODDIY buyurtmalar narxi (almashtirish narxi real sotuvda
      // hisoblangan, qaytarish summasiga qo'shilmaydi).
      const acceptedTotalPrice = acceptedOrders
        .filter((o) => !isRepl(o))
        .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

      // Pochtaning statusi har doim Canceled_RECEIVED bo'lib qoladi
      await queryRunner.manager.update(
        PostEntity,
        { id },
        {
          status: Post_status.CANCELED_RECEIVED,
          order_quantity: acceptedOrders.length,
          post_total_price: acceptedTotalPrice,
        },
      );

      await queryRunner.commitTransaction();

      // Activity log — ODDIY qabul (CLOSED)
      for (const oid of acceptedNormalIds) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: oid,
          action: 'status_change',
          new_value: { status: Order_status.CLOSED },
          description: `Bekor qilingan buyurtma qabul qilindi (CLOSED)`,
          user,
        });
      }
      // Activity log — ALMASHTIRISH qaytarildi (OLD_RETURNED, status SOLD qoladi)
      for (const o of acceptedReplOrders) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: o.id,
          action: 'replacement_returned',
          new_value: {
            order_number: o.order_number,
            replacement_state: Replacement_state.OLD_RETURNED,
          },
          description: `Almashtirish: eski buyurtma #${o.order_number} marketga qaytarildi`,
          user,
        });
      }
      // Activity log — qabul qilinmagan ODDIY buyurtmalar (CANCELLED)
      for (const oid of remainingNormalIds) {
        this.activityLog.log({
          entity_type: 'order',
          entity_id: oid,
          action: 'status_change',
          new_value: { status: Order_status.CANCELLED },
          description: `Buyurtma qabul qilinmadi — kuryerga qaytarildi`,
          user,
        });
      }

      // Market Telegram xabari (commit'dan keyin — xato qabulni buzmaydi):
      // har bir qaytarilgan almashtirish uchun "mahsulot qaytarildi".
      for (const o of acceptedReplOrders) {
        try {
          const returnGroup = await this.dataSource
            .getRepository(TelegramEntity)
            .findOne({
              where: { market_id: o.user_id, group_type: Group_type.CANCEL },
            });
          await this.botService.sendMessageToGroup(
            returnGroup?.group_id || null,
            `*✅ Almashtirish — mahsulot qaytarildi!*\n\n` +
              `📦 Eski buyurtma *#${o.order_number}* mahsuloti sizga (marketga) qaytarib topshirildi.\n`,
          );
        } catch {}
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
        relations: [
          'customer',
          'district',
          'district.region',
          'post',
          'post.courier',
        ],
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
  async approveReturnRequests(
    ordersArrayDto: { order_ids: string[] },
    user?: JwtPayload,
  ) {
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
      const oldPostUpdates = new Map<
        string,
        { count: number; total: number }
      >();
      for (const order of orders) {
        if (order.post_id) {
          const existing = oldPostUpdates.get(order.post_id) || {
            count: 0,
            total: 0,
          };
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
          await queryRunner.manager.update(
            PostEntity,
            { id: oldPostId },
            {
              order_quantity: Math.max(
                0,
                (Number(oldPost.order_quantity) || 0) - delta.count,
              ),
              post_total_price: Math.max(
                0,
                (Number(oldPost.post_total_price) || 0) - delta.total,
              ),
            },
          );
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
          await queryRunner.manager.update(
            OrderEntity,
            { id: order.id },
            {
              status: Order_status.RECEIVED,
              return_requested: false,
              post_id: newPost.id,
            },
          );

          // LDG buyurtma bo'lsa — eski (qaytarilgan) shipment ma'lumotini
          // tozalaymiz: reconcile stale statusni qo'llamasin va keyingi dispatch
          // toza holatdan yangi LDG buyurtmasi yaratsin.
          await this.ldgShipmentService.resetForRedelivery(
            order.id,
            queryRunner.manager,
          );

          totalAdded += Number(order.total_price) || 0;
          countAdded += 1;
        }

        if (countAdded > 0) {
          await queryRunner.manager.update(
            PostEntity,
            { id: newPost.id },
            {
              order_quantity:
                (Number(newPost.order_quantity) || 0) + countAdded,
              post_total_price:
                (Number(newPost.post_total_price) || 0) + totalAdded,
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
          user,
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
  async rejectReturnRequests(
    ordersArrayDto: { order_ids: string[] },
    user?: JwtPayload,
  ) {
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
          user,
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
