import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { RegionEntity } from 'src/core/entity/region.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RegionRepository } from 'src/core/repository/region.repository';
import { successRes, catchError } from 'src/infrastructure/lib/response';
import { regions } from 'src/infrastructure/lib/data/district';
import { UpdateRegionSatoCodeDto } from './dto/update-sato-code.dto';
import { UpdateRegionNameDto } from './dto/update-region-name.dto';
import { Not, Repository, In } from 'typeorm';
import { matchRegions } from 'src/infrastructure/lib/utils/sato-matcher';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { DistrictCourierEntity } from 'src/core/entity/district-courier.entity';
import { Order_status, Roles, Status } from 'src/common/enums';
import {
  getUzbekistanDayRange,
  toUzbekistanTimestamp,
} from 'src/common/utils/date.util';

// ===== Statistika status guruhlari =====
// Buyurtmalar 3 ta o'zaro kesishmaydigan guruhga bo'linadi. CREATED va NEW
// (hali yo'lga chiqmagan/yangi) statistikaga UMUMAN kirmaydi — jamiga ham,
// foizga ham hisoblanmaydi.

// Yetkazilgan: buyurtma to'lov holatiga qarab SOLD/PAID/PARTLY_PAID bo'lib qoladi
// (qarz/qisman to'lov) — uchalasi ham muvaffaqiyatli yetkazilgan hisoblanadi.
const SOLD_STATUSES = [
  Order_status.SOLD,
  Order_status.PAID,
  Order_status.PARTLY_PAID,
];

// Bekor qilingan: bekor + bekor(jo'natilgan) + yopilgan (CLOSED ham bekor deb hisoblanadi).
const CANCELLED_STATUSES = [
  Order_status.CANCELLED,
  Order_status.CANCELLED_SENT,
  Order_status.CLOSED,
];

// Kutilmoqda: qabul qilingan → yo'lda → kutilmoqda oralig'idagi faol holatlar.
// Joriy holat sifatida hisoblanadi (sanaga bog'liq emas). CREATED/NEW kirmaydi.
const PENDING_STATUSES = [
  Order_status.RECEIVED,
  Order_status.ON_THE_ROAD,
  Order_status.WAITING,
];

@Injectable()
export class RegionService implements OnModuleInit {
  constructor(
    @InjectRepository(RegionEntity) private regionRepository: RegionRepository,
    @InjectRepository(PostEntity)
    private postRepository: Repository<PostEntity>,
    @InjectRepository(OrderEntity)
    private orderRepository: Repository<OrderEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(DistrictEntity)
    private districtRepository: Repository<DistrictEntity>,
    @InjectRepository(DistrictCourierEntity)
    private districtCourierRepository: Repository<DistrictCourierEntity>,
  ) {}

  async onModuleInit() {
    try {
      const existingRegions = await this.regionRepository.find();

      if (existingRegions.length === 0) {
        const regionList = regions.map((item) => ({ name: item.name }));
        const regionEntities = this.regionRepository.create(regionList);
        await this.regionRepository.save(regionEntities);
      }
    } catch (error) {
      console.error('❌ Viloyatlar yaratishda xatolik:', error);
    }
  }

  async findAll() {
    try {
      const regions = await this.regionRepository.find({
        relations: ['assignedDistricts'],
        order: { created_at: 'ASC' },
      });
      return successRes(regions, 200, 'All regions with assigned districts');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOneById(id: string) {
    try {
      const region = await this.regionRepository.findOne({
        where: { id },
        relations: ['districts'],
      });
      if (!region) {
        throw new NotFoundException('Region topilmadi');
      }
      return successRes(region);
    } catch (error) {
      return catchError(error);
    }
  }

  async updateSatoCode(id: string, dto: UpdateRegionSatoCodeDto) {
    try {
      const region = await this.regionRepository.findOne({ where: { id } });
      if (!region) {
        throw new NotFoundException('Region topilmadi');
      }

      // SATO code unikalligi tekshirish
      const existingWithCode = await this.regionRepository.findOne({
        where: { sato_code: dto.sato_code, id: Not(id) },
      });
      if (existingWithCode) {
        throw new BadRequestException(
          `Bu SATO code allaqachon "${existingWithCode.name}" viloyatiga biriktirilgan`,
        );
      }

      region.sato_code = dto.sato_code;
      await this.regionRepository.save(region);

      return successRes(region, 200, 'Region SATO code yangilandi');
    } catch (error) {
      return catchError(error);
    }
  }

  async findBySatoCode(satoCode: string) {
    try {
      const region = await this.regionRepository.findOne({
        where: { sato_code: satoCode },
        relations: ['districts', 'assignedDistricts'],
      });
      if (!region) {
        throw new NotFoundException('Bu SATO code bilan viloyat topilmadi');
      }
      return successRes(region);
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * SATO kodlarini mavjud viloyatlar bilan moslashtirish (preview)
   */
  async matchSatoCodes() {
    try {
      const dbRegions = await this.regionRepository.find();
      const result = matchRegions(dbRegions);
      return successRes(result, 200, 'SATO matching natijasi');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Mos kelgan viloyatlarga SATO kodlarini avtomatik qo'shish
   */
  async applySatoCodes() {
    try {
      const dbRegions = await this.regionRepository.find();
      const matchResult = matchRegions(dbRegions);

      let appliedCount = 0;
      const applied: { id: string; name: string; sato_code: string }[] = [];

      for (const match of matchResult.matched) {
        // Faqat yangi kodlarni qo'shish (allaqachon mavjud bo'lmaganlarni)
        if (match.satoName !== '(allaqachon mavjud)') {
          await this.regionRepository.update(match.dbId, {
            sato_code: match.satoCode,
          });
          applied.push({
            id: match.dbId,
            name: match.dbName,
            sato_code: match.satoCode,
          });
          appliedCount++;
        }
      }

      return successRes(
        {
          applied,
          appliedCount,
          unmatched: matchResult.unmatched,
          duplicates: matchResult.duplicates,
          stats: matchResult.stats,
        },
        200,
        `${appliedCount} ta viloyatga SATO code qo'shildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Viloyat nomini yangilash
   */
  async updateName(id: string, dto: UpdateRegionNameDto) {
    try {
      const region = await this.regionRepository.findOne({ where: { id } });
      if (!region) {
        throw new NotFoundException('Region topilmadi');
      }

      region.name = dto.name;
      await this.regionRepository.save(region);

      return successRes(region, 200, 'Viloyat nomi yangilandi');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Barcha viloyatlar statistikasi (xarita uchun)
   */
  async getAllRegionsStats(filter: { startDate?: string; endDate?: string }) {
    try {
      const { startDate: filterStartDate, endDate: filterEndDate } = filter;

      // "Barchasi" uchun date filter yo'q
      const hasDateFilter = !!(filterStartDate && filterEndDate);
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (hasDateFilter) {
        const start = toUzbekistanTimestamp(filterStartDate, false);
        const end = toUzbekistanTimestamp(filterEndDate, true);
        startDate = String(start);
        endDate = String(end);
      }

      const regions = await this.regionRepository.find({
        relations: ['assignedDistricts'],
        order: { name: 'ASC' },
      });

      const stats = await Promise.all(
        regions.map(async (region) => {
          // Viloyat tumanlarini olish
          const districtIds = region.assignedDistricts.map((d) => d.id);

          // Viloyat pochtalarini olish (kuryer id'lari bilan — kuryer sonini
          // to'g'ri hisoblash uchun)
          const posts = await this.postRepository.find({
            where: { region_id: region.id },
            select: ['id', 'courier_id'],
          });
          const postIds = posts.map((p) => p.id);

          // Viloyatga biriktirilgan (uy) kuryerlar
          const homeCouriers = await this.userRepository.find({
            where: {
              region_id: region.id,
              role: Roles.COURIER,
              is_deleted: false,
            },
            select: ['id'],
          });

          // Kuryerlar soni = uy kuryerlari ∪ region postlarida HAQIQATAN ishtirok
          // etgan boshqa kuryerlar (super/LDG yoki boshqa regiondan biriktirilgan).
          // Shu orqali super kuryer xizmat qilgan viloyatda ham sanaladi (oldin
          // faqat region_id bo'yicha sanalib, super/LDG kuryerlar tushib qolardi).
          const courierIdSet = new Set<string>(homeCouriers.map((c) => c.id));
          for (const p of posts) {
            if (p.courier_id) courierIdSet.add(p.courier_id);
          }
          const couriersCount = courierIdSet.size;

          // Buyurtmalar statistikasi (harakat modeli — sold_at/cancelled_at)
          const s = await this.getStatsByPostIds(
            postIds,
            hasDateFilter,
            startDate,
            endDate,
          );

          return {
            id: region.id,
            name: region.name,
            satoCode: region.sato_code,
            districtsCount: region.assignedDistricts.length,
            couriersCount,
            totalOrders: s.totalOrders,
            deliveredOrders: s.deliveredOrders,
            cancelledOrders: s.cancelledOrders,
            pendingOrders: s.pendingOrders,
            totalRevenue: s.totalRevenue,
            successRate: s.successRate,
          };
        }),
      );

      // Umumiy statistika
      const summary = {
        totalRegions: regions.length,
        totalOrders: stats.reduce((sum, s) => sum + s.totalOrders, 0),
        totalDelivered: stats.reduce((sum, s) => sum + s.deliveredOrders, 0),
        totalCancelled: stats.reduce((sum, s) => sum + s.cancelledOrders, 0),
        totalRevenue: stats.reduce((sum, s) => sum + s.totalRevenue, 0),
        avgSuccessRate: Math.round(
          stats.reduce((sum, s) => sum + s.successRate, 0) /
            (stats.length || 1),
        ),
      };

      return successRes(
        { regions: stats, summary },
        200,
        'Viloyatlar statistikasi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Berilgan post id'lar to'plami bo'yicha buyurtma statistikasini hisoblaydi.
   * Kuryer kesimi va "biriktirilmagan" (kuryer yo'q) kesimi uchun ishlatiladi.
   *
   * HARAKAT MODELI: davr filtri harakat sanasi bo'yicha qo'llanadi —
   *   Yetkazilgan/Tushum → sold_at, Bekor → cancelled_at. Shuning uchun bir necha
   *   kun oldin yaratilgan buyurtma bugun sotilsa/bekor qilinsa, bugungi davrga
   *   tushadi. Kutilmoqda — joriy holat (sanaga bog'liq emas).
   *   Jami = Yetkazilgan + Bekor, Foiz = Yetkazilgan / Jami.
   */
  private async getStatsByPostIds(
    postIds: string[],
    hasDateFilter: boolean,
    startDate: string | null,
    endDate: string | null,
  ): Promise<{
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    successRate: number;
  }> {
    if (postIds.length === 0) {
      return {
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        successRate: 0,
      };
    }

    // dateCol berilsa — o'sha ustun (sold_at / cancelled_at) bo'yicha davr filtri.
    // null bo'lsa — sanadan qat'i nazar (joriy holat, masalan kutilmoqda).
    const scoped = (dateCol: 'sold_at' | 'cancelled_at' | null) => {
      const qb = this.orderRepository
        .createQueryBuilder('order')
        .where('order.post_id IN (:...postIds)', { postIds })
        .andWhere('order.deleted_at IS NULL');
      if (hasDateFilter && dateCol) {
        qb.andWhere(`order.${dateCol} >= :startDate`, { startDate }).andWhere(
          `order.${dateCol} <= :endDate`,
          { endDate },
        );
      }
      return qb;
    };

    const deliveredOrders = await scoped('sold_at')
      .andWhere('order.status IN (:...soldStatuses)', {
        soldStatuses: SOLD_STATUSES,
      })
      .getCount();

    const cancelledOrders = await scoped('cancelled_at')
      .andWhere('order.status IN (:...cancelledStatuses)', {
        cancelledStatuses: CANCELLED_STATUSES,
      })
      .getCount();

    const revenueResult = await scoped('sold_at')
      .select('SUM(order.total_price)', 'revenue')
      .andWhere('order.status IN (:...soldStatuses)', {
        soldStatuses: SOLD_STATUSES,
      })
      .getRawOne();
    const totalRevenue = Number(revenueResult?.revenue || 0);

    // Kutilmoqda — joriy holat (RECEIVED/ON_THE_ROAD/WAITING), sanaga bog'liq emas
    const pendingOrders = await scoped(null)
      .andWhere('order.status IN (:...pendingStatuses)', {
        pendingStatuses: PENDING_STATUSES,
      })
      .getCount();

    const totalOrders = deliveredOrders + cancelledOrders;

    return {
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      totalRevenue,
      successRate:
        totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
    };
  }

  /**
   * Bitta tuman bo'yicha buyurtma statistikasi (district_id kesimida — region
   * miqyosida, ya'ni shu tumandagi barcha kuryerlar buyurtmalari). Kuryerning
   * "Mening viloyatim" tab'i va admin tuman ko'rinishi shu mantiqdan foydalanadi.
   */
  private async getStatsByDistrictId(
    districtId: string,
    hasDateFilter: boolean,
    startDate: string | null,
    endDate: string | null,
  ): Promise<{
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    successRate: number;
  }> {
    // HARAKAT MODELI (getStatsByPostIds bilan bir xil): yetkazilgan/tushum →
    // sold_at, bekor → cancelled_at, kutilmoqda → joriy holat.
    const scoped = (dateCol: 'sold_at' | 'cancelled_at' | null) => {
      const qb = this.orderRepository
        .createQueryBuilder('order')
        .where('order.district_id = :districtId', { districtId })
        .andWhere('order.deleted_at IS NULL');
      if (hasDateFilter && dateCol) {
        qb.andWhere(`order.${dateCol} >= :startDate`, { startDate }).andWhere(
          `order.${dateCol} <= :endDate`,
          { endDate },
        );
      }
      return qb;
    };

    const deliveredOrders = await scoped('sold_at')
      .andWhere('order.status IN (:...soldStatuses)', {
        soldStatuses: SOLD_STATUSES,
      })
      .getCount();

    const cancelledOrders = await scoped('cancelled_at')
      .andWhere('order.status IN (:...cancelledStatuses)', {
        cancelledStatuses: CANCELLED_STATUSES,
      })
      .getCount();

    const revenueResult = await scoped('sold_at')
      .select('SUM(order.total_price)', 'revenue')
      .andWhere('order.status IN (:...soldStatuses)', {
        soldStatuses: SOLD_STATUSES,
      })
      .getRawOne();
    const totalRevenue = Number(revenueResult?.revenue || 0);

    const pendingOrders = await scoped(null)
      .andWhere('order.status IN (:...pendingStatuses)', {
        pendingStatuses: PENDING_STATUSES,
      })
      .getCount();

    const totalOrders = deliveredOrders + cancelledOrders;

    return {
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      totalRevenue,
      successRate:
        totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
    };
  }

  /**
   * Kuryer o'z viloyati tumanlari statistikasi ("Mening viloyatim" tab'i).
   * Kuryerning region_id'si bo'yicha shu viloyat tumanlarini va har biriga
   * tegishli statistikani qaytaradi (region miqyosida, district_id kesimida).
   */
  async getCourierOwnRegionDistrictStats(
    userId: string,
    filter: { startDate?: string; endDate?: string },
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'name', 'region_id'],
      });
      if (!user) {
        throw new NotFoundException('Foydalanuvchi topilmadi');
      }
      if (!user.region_id) {
        return successRes(
          { region: null, summary: null, districts: [] },
          200,
          'Foydalanuvchiga viloyat biriktirilmagan',
        );
      }

      const region = await this.regionRepository.findOne({
        where: { id: user.region_id },
        relations: ['assignedDistricts'],
      });
      if (!region) {
        return successRes(
          { region: null, summary: null, districts: [] },
          200,
          'Viloyat topilmadi',
        );
      }

      const { startDate: filterStartDate, endDate: filterEndDate } = filter;
      const hasDateFilter = !!(filterStartDate && filterEndDate);
      const startDate = hasDateFilter
        ? String(toUzbekistanTimestamp(filterStartDate!, false))
        : null;
      const endDate = hasDateFilter
        ? String(toUzbekistanTimestamp(filterEndDate!, true))
        : null;

      const districts = await Promise.all(
        region.assignedDistricts.map(async (d) => {
          const s = await this.getStatsByDistrictId(
            d.id,
            hasDateFilter,
            startDate,
            endDate,
          );
          return { id: d.id, name: d.name, satoCode: d.sato_code, ...s };
        }),
      );
      districts.sort((a, b) => b.totalOrders - a.totalOrders);

      const summary = districts.reduce(
        (acc, d) => {
          acc.totalOrders += d.totalOrders;
          acc.deliveredOrders += d.deliveredOrders;
          acc.cancelledOrders += d.cancelledOrders;
          acc.pendingOrders += d.pendingOrders;
          acc.totalRevenue += d.totalRevenue;
          return acc;
        },
        {
          totalOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0,
        },
      );
      const successRate =
        summary.totalOrders > 0
          ? Math.round((summary.deliveredOrders / summary.totalOrders) * 100)
          : 0;

      return successRes(
        {
          region: {
            id: region.id,
            name: region.name,
            satoCode: region.sato_code,
          },
          summary: {
            ...summary,
            successRate,
            districtsCount: districts.length,
          },
          districts,
        },
        200,
        'Viloyat tumanlari statistikasi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Kuryer o'z viloyatiga biriktirilgan tumanlar ro'yxati (filtr dropdown uchun).
   * Faqat kuryerning region_id'siga `assigned_region` orqali bog'langan tumanlar.
   */
  async getMyDistricts(userId: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'region_id'],
      });
      if (!user?.region_id) {
        return successRes([], 200, 'Foydalanuvchiga viloyat biriktirilmagan');
      }
      const districts = await this.districtRepository.find({
        where: { assigned_region: user.region_id },
        select: ['id', 'name', 'sato_code'],
        order: { name: 'ASC' },
      });
      return successRes(districts, 200, 'Viloyat tumanlari');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bitta viloyat batafsil statistikasi
   */
  async getRegionDetailedStats(
    regionId: string,
    filter: { startDate?: string; endDate?: string },
  ) {
    try {
      const { startDate: filterStartDate, endDate: filterEndDate } = filter;

      // "Barchasi" uchun date filter yo'q
      const hasDateFilter = !!(filterStartDate && filterEndDate);
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (hasDateFilter) {
        const start = toUzbekistanTimestamp(filterStartDate, false);
        const end = toUzbekistanTimestamp(filterEndDate, true);
        startDate = String(start);
        endDate = String(end);
      }

      const region = await this.regionRepository.findOne({
        where: { id: regionId },
        relations: ['assignedDistricts', 'mainCourier'],
      });

      if (!region) {
        throw new NotFoundException('Viloyat topilmadi');
      }

      // Tumanlar va ularning kuriyerlari (district_courier jadvalidan)
      const districtIds = region.assignedDistricts.map((d) => d.id);
      const districtCourierMap = new Map<string, any[]>();
      if (districtIds.length > 0) {
        const allDistrictCouriers = await this.districtCourierRepository.find({
          where: { district_id: In(districtIds) },
          select: ['id', 'name', 'phone_number', 'district_id'],
        });
        for (const districtId of districtIds) {
          districtCourierMap.set(
            districtId,
            allDistrictCouriers
              .filter((c) => c.district_id === districtId)
              .map((c) => ({
                id: c.id,
                name: c.name,
                phone_number: c.phone_number,
              })),
          );
        }
      }

      // Viloyat pochtalarini olish (kuryer bo'yicha taqsimlash uchun)
      const posts = await this.postRepository.find({
        where: { region_id: regionId },
        select: ['id', 'courier_id'],
      });
      const postIds = posts.map((p) => p.id);

      // Kuryerlar ro'yxati = viloyatga biriktirilgan kuryerlar (postsiz bo'lsa
      // ham ko'rinsin) + viloyat postlarida HAQIQATAN ishtirok etgan boshqa
      // kuryerlar (super/LDG kuryer, boshqa regiondan biriktirilgan yoki
      // keyinchalik o'chirilgan). Shu orqali har bir buyurtma o'z egasiga
      // taqsimlanadi va kuryerlar yig'indisi viloyat jamiga teng bo'ladi.
      const regionCouriers = await this.userRepository.find({
        where: {
          region_id: regionId,
          role: Roles.COURIER,
          is_deleted: false,
        },
        select: ['id', 'name', 'phone_number', 'status'],
      });
      const regionCourierIds = new Set(regionCouriers.map((c) => c.id));

      const extraCourierIds = [
        ...new Set(
          posts
            .map((p) => p.courier_id)
            .filter((id): id is string => !!id && !regionCourierIds.has(id)),
        ),
      ];
      const extraCouriers = extraCourierIds.length
        ? await this.userRepository.find({
            where: { id: In(extraCourierIds) },
            select: ['id', 'name', 'phone_number', 'status'],
          })
        : [];

      const allCouriers = [...regionCouriers, ...extraCouriers];

      // Kuryer statistikalari
      const courierStats = await Promise.all(
        allCouriers.map(async (courier) => {
          const courierPostIds = posts
            .filter((p) => p.courier_id === courier.id)
            .map((p) => p.id);
          const s = await this.getStatsByPostIds(
            courierPostIds,
            hasDateFilter,
            startDate,
            endDate,
          );
          return {
            id: courier.id,
            name: courier.name,
            phoneNumber: courier.phone_number,
            status: courier.status as string,
            isUnassigned: false,
            ...s,
          };
        }),
      );

      // "Biriktirilmagan" — kuryer biriktirilmagan (courier_id NULL) postlardagi
      // buyurtmalar (masalan hali jo'natilmagan NEW pochta). Bu qator qatorlar
      // yig'indisini viloyat jamiga tenglashtiradi.
      const unassignedPostIds = posts
        .filter((p) => !p.courier_id)
        .map((p) => p.id);
      const unassignedStats = await this.getStatsByPostIds(
        unassignedPostIds,
        hasDateFilter,
        startDate,
        endDate,
      );
      if (unassignedStats.totalOrders > 0) {
        courierStats.push({
          id: 'unassigned',
          name: 'Biriktirilmagan',
          phoneNumber: '',
          status: '',
          isUnassigned: true,
          ...unassignedStats,
        });
      }

      // Tuman statistikalari (harakat modeli — sold_at/cancelled_at)
      const districtStats = await Promise.all(
        region.assignedDistricts.map(async (district) => {
          const s = await this.getStatsByDistrictId(
            district.id,
            hasDateFilter,
            startDate,
            endDate,
          );
          return {
            id: district.id,
            name: district.name,
            satoCode: district.sato_code,
            couriers: districtCourierMap.get(district.id) || [],
            ...s,
          };
        }),
      );

      // Umumiy statistika (harakat modeli — sold_at/cancelled_at)
      const overall = await this.getStatsByPostIds(
        postIds,
        hasDateFilter,
        startDate,
        endDate,
      );

      return successRes(
        {
          region: {
            id: region.id,
            name: region.name,
            satoCode: region.sato_code,
            mainCourier: region.mainCourier
              ? {
                  id: region.mainCourier.id,
                  name: region.mainCourier.name,
                  phone_number: region.mainCourier.phone_number,
                }
              : null,
          },
          summary: {
            totalOrders: overall.totalOrders,
            deliveredOrders: overall.deliveredOrders,
            cancelledOrders: overall.cancelledOrders,
            pendingOrders: overall.pendingOrders,
            totalRevenue: overall.totalRevenue,
            successRate: overall.successRate,
            // Uy kuryerlari + region postlarida ishtirok etgan super/LDG kuryerlar
            // (jadvalda ko'rinadigan qatorlar bilan bir xil — xarita soni bilan mos).
            totalCouriers: allCouriers.length,
            activeCouriers: allCouriers.filter(
              (c) => c.status === Status.ACTIVE,
            ).length,
            totalDistricts: region.assignedDistricts.length,
          },
          couriers: courierStats.sort(
            (a, b) => b.deliveredOrders - a.deliveredOrders,
          ),
          districts: districtStats.sort(
            (a, b) => b.totalOrders - a.totalOrders,
          ),
        },
        200,
        'Viloyat batafsil statistikasi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bitta kuryerning (ayniqsa super kuryer) statistikasini U XIZMAT QILGAN
   * viloyatlar bo'yicha bo'lib qaytaradi. Region modali viloyat-markazli bo'lsa,
   * bu kuryer-markazli: super kuryer qaysi viloyatda qancha ishlaganini
   * bitta joyda ko'rsatadi.
   */
  async getCourierRegionBreakdown(
    courierId: string,
    filter: { startDate?: string; endDate?: string },
  ) {
    try {
      const courier = await this.userRepository.findOne({
        where: { id: courierId },
        select: [
          'id',
          'name',
          'phone_number',
          'is_super_courier',
          'serves_all_regions',
          'region_id',
        ],
      });
      if (!courier) {
        throw new NotFoundException('Kuryer topilmadi');
      }

      const { startDate: filterStartDate, endDate: filterEndDate } = filter;
      const hasDateFilter = !!(filterStartDate && filterEndDate);
      const startDate = hasDateFilter
        ? String(toUzbekistanTimestamp(filterStartDate!, false))
        : null;
      const endDate = hasDateFilter
        ? String(toUzbekistanTimestamp(filterEndDate!, true))
        : null;

      // Kuryerning barcha postlari (viloyat bilan)
      const posts = await this.postRepository.find({
        where: { courier_id: courierId },
        select: ['id', 'region_id'],
      });

      // Viloyat bo'yicha guruhlash
      const postIdsByRegion = new Map<string, string[]>();
      for (const p of posts) {
        if (!p.region_id) continue;
        const arr = postIdsByRegion.get(p.region_id) ?? [];
        arr.push(p.id);
        postIdsByRegion.set(p.region_id, arr);
      }

      const regionIds = [...postIdsByRegion.keys()];
      const regions = regionIds.length
        ? await this.regionRepository.find({
            where: { id: In(regionIds) },
            select: ['id', 'name', 'sato_code'],
          })
        : [];
      const regionMap = new Map(regions.map((r) => [r.id, r]));

      const regionStats = await Promise.all(
        regionIds.map(async (regionId) => {
          const s = await this.getStatsByPostIds(
            postIdsByRegion.get(regionId)!,
            hasDateFilter,
            startDate,
            endDate,
          );
          return {
            regionId,
            regionName: regionMap.get(regionId)?.name ?? '—',
            satoCode: regionMap.get(regionId)?.sato_code ?? null,
            ...s,
          };
        }),
      );

      regionStats.sort((a, b) => b.totalOrders - a.totalOrders);

      // Barcha viloyatlar bo'yicha umumiy yig'indi
      const summary = regionStats.reduce(
        (acc, r) => {
          acc.totalOrders += r.totalOrders;
          acc.deliveredOrders += r.deliveredOrders;
          acc.cancelledOrders += r.cancelledOrders;
          acc.pendingOrders += r.pendingOrders;
          acc.totalRevenue += r.totalRevenue;
          return acc;
        },
        {
          totalOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0,
        },
      );
      const successRate =
        summary.totalOrders > 0
          ? Math.round((summary.deliveredOrders / summary.totalOrders) * 100)
          : 0;

      return successRes(
        {
          courier: {
            id: courier.id,
            name: courier.name,
            phone_number: courier.phone_number,
            is_super_courier: courier.is_super_courier,
            serves_all_regions: courier.serves_all_regions,
          },
          summary: {
            ...summary,
            successRate,
            regionsCount: regionStats.length,
          },
          regions: regionStats,
        },
        200,
        "Kuryer viloyatlar bo'yicha statistikasi",
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== MAIN COURIER ASSIGNMENT ====================

  /**
   * Viloyatga asosiy kuryer biriktirish (yoki olib tashlash)
   */
  async assignMainCourier(regionId: string, courierId: string | null) {
    try {
      const region = await this.regionRepository.findOne({
        where: { id: regionId },
      });
      if (!region) {
        throw new NotFoundException('Viloyat topilmadi');
      }

      if (courierId) {
        const courier = await this.userRepository.findOne({
          where: { id: courierId, role: Roles.COURIER, is_deleted: false },
        });
        if (!courier) {
          throw new NotFoundException('Kuryer topilmadi');
        }
      }

      region.main_courier_id = courierId as any;
      await this.regionRepository.save(region);

      return successRes(
        region,
        200,
        courierId
          ? 'Asosiy kuryer biriktirildi'
          : 'Asosiy kuryer olib tashlandi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== LOGIST ASSIGNMENT ====================

  /**
   * Regionga logist biriktirish
   */
  async assignLogist(regionId: string, logistId: string | null) {
    try {
      const region = await this.regionRepository.findOne({
        where: { id: regionId },
      });
      if (!region) {
        throw new NotFoundException('Viloyat topilmadi');
      }

      if (logistId) {
        const logist = await this.userRepository.findOne({
          where: { id: logistId, role: Roles.LOGIST, is_deleted: false },
        });
        if (!logist) {
          throw new NotFoundException('Logist topilmadi');
        }
      }

      region.logist_id = logistId as any;
      await this.regionRepository.save(region);

      return successRes(
        region,
        200,
        logistId ? 'Logist biriktirildi' : 'Logist olib tashlandi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bir nechta regionga bitta logistni biriktirish (bulk)
   */
  async bulkAssignLogist(logistId: string, regionIds: string[]) {
    try {
      const logist = await this.userRepository.findOne({
        where: { id: logistId, role: Roles.LOGIST, is_deleted: false },
      });
      if (!logist) {
        throw new NotFoundException('Logist topilmadi');
      }

      // Avval bu logistning barcha eski biriktirishlarini olib tashlash
      await this.regionRepository.update(
        { logist_id: logistId },
        { logist_id: null as any },
      );

      // Yangi regionlarga biriktirish
      if (regionIds.length > 0) {
        await this.regionRepository
          .createQueryBuilder()
          .update(RegionEntity)
          .set({ logist_id: logistId })
          .where('id IN (:...regionIds)', { regionIds })
          .execute();
      }

      return successRes(
        {},
        200,
        `Logist ${regionIds.length} ta viloyatga biriktirildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Regionlar ro'yxatini logist ma'lumoti bilan olish
   */
  async findAllWithLogist() {
    try {
      const regions = await this.regionRepository.find({
        relations: ['assignedDistricts', 'logist'],
        order: { created_at: 'ASC' },
      });

      const result = regions.map((r) => ({
        id: r.id,
        name: r.name,
        sato_code: r.sato_code,
        logist_id: r.logist_id,
        logist: r.logist
          ? {
              id: r.logist.id,
              name: r.logist.name,
              phone_number: r.logist.phone_number,
            }
          : null,
        assignedDistricts: r.assignedDistricts,
      }));

      return successRes(result, 200, 'Regions with logist info');
    } catch (error) {
      return catchError(error);
    }
  }
}
