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
import { Order_status, Roles, Status } from 'src/common/enums';
import {
  getUzbekistanDayRange,
  toUzbekistanTimestamp,
} from 'src/common/utils/date.util';

@Injectable()
export class RegionService implements OnModuleInit {
  constructor(
    @InjectRepository(RegionEntity) private regionRepository: RegionRepository,
    @InjectRepository(PostEntity) private postRepository: Repository<PostEntity>,
    @InjectRepository(OrderEntity) private orderRepository: Repository<OrderEntity>,
    @InjectRepository(UserEntity) private userRepository: Repository<UserEntity>,
    @InjectRepository(DistrictEntity) private districtRepository: Repository<DistrictEntity>,
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
      const hasDateFilter = filterStartDate && filterEndDate;
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

          // Ushbu viloyat kuryerlarini olish
          const couriers = await this.userRepository.find({
            where: {
              region_id: region.id,
              role: Roles.COURIER,
              status: Status.ACTIVE,
              is_deleted: false,
            },
            select: ['id', 'name', 'phone_number'],
          });

          // Viloyat pochtalarini olish
          const posts = await this.postRepository.find({
            where: { region_id: region.id },
            select: ['id'],
          });
          const postIds = posts.map((p) => p.id);

          // Buyurtmalar statistikasi
          let totalOrders = 0;
          let deliveredOrders = 0;
          let cancelledOrders = 0;
          let pendingOrders = 0;
          let totalRevenue = 0;

          if (postIds.length > 0) {
            // Jami buyurtmalar
            const ordersQuery = this.orderRepository
              .createQueryBuilder('order')
              .where('order.post_id IN (:...postIds)', { postIds })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              ordersQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            totalOrders = await ordersQuery.getCount();

            // Yetkazilgan buyurtmalar
            const deliveredQuery = this.orderRepository
              .createQueryBuilder('order')
              .where('order.post_id IN (:...postIds)', { postIds })
              .andWhere('order.status = :status', { status: Order_status.SOLD })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              deliveredQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            deliveredOrders = await deliveredQuery.getCount();

            // Bekor qilingan buyurtmalar
            const cancelledQuery = this.orderRepository
              .createQueryBuilder('order')
              .where('order.post_id IN (:...postIds)', { postIds })
              .andWhere('order.status IN (:...statuses)', {
                statuses: [Order_status.CANCELLED, Order_status.CANCELLED_SENT],
              })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              cancelledQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            cancelledOrders = await cancelledQuery.getCount();

            // Kutilayotgan buyurtmalar
            pendingOrders = totalOrders - deliveredOrders - cancelledOrders;

            // Jami tushum (yetkazilgan buyurtmalardan)
            const revenueQuery = this.orderRepository
              .createQueryBuilder('order')
              .select('SUM(order.total_price)', 'revenue')
              .where('order.post_id IN (:...postIds)', { postIds })
              .andWhere('order.status = :status', { status: Order_status.SOLD })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              revenueQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            const revenueResult = await revenueQuery.getRawOne();
            totalRevenue = Number(revenueResult?.revenue || 0);
          }

          const successRate =
            totalOrders > 0
              ? Math.round((deliveredOrders / totalOrders) * 100)
              : 0;

          return {
            id: region.id,
            name: region.name,
            satoCode: region.sato_code,
            districtsCount: region.assignedDistricts.length,
            couriersCount: couriers.length,
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            pendingOrders,
            totalRevenue,
            successRate,
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
          stats.reduce((sum, s) => sum + s.successRate, 0) / (stats.length || 1),
        ),
      };

      return successRes({ regions: stats, summary }, 200, 'Viloyatlar statistikasi');
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
      const hasDateFilter = filterStartDate && filterEndDate;
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
        relations: ['assignedDistricts'],
      });

      if (!region) {
        throw new NotFoundException('Viloyat topilmadi');
      }

      // Viloyat kuryerlari va ularning statistikasi
      const couriers = await this.userRepository.find({
        where: {
          region_id: regionId,
          role: Roles.COURIER,
          is_deleted: false,
        },
        select: ['id', 'name', 'phone_number', 'status'],
      });

      // Viloyat pochtalarini olish
      const posts = await this.postRepository.find({
        where: { region_id: regionId },
        select: ['id', 'courier_id'],
      });
      const postIds = posts.map((p) => p.id);

      // Kuryer statistikalari
      const courierStats = await Promise.all(
        couriers.map(async (courier) => {
          const courierPostIds = posts
            .filter((p) => p.courier_id === courier.id)
            .map((p) => p.id);

          let totalOrders = 0;
          let deliveredOrders = 0;
          let cancelledOrders = 0;
          let totalRevenue = 0;

          if (courierPostIds.length > 0) {
            const totalQuery = this.orderRepository
              .createQueryBuilder('order')
              .where('order.post_id IN (:...postIds)', { postIds: courierPostIds })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              totalQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            totalOrders = await totalQuery.getCount();

            const deliveredQuery = this.orderRepository
              .createQueryBuilder('order')
              .where('order.post_id IN (:...postIds)', { postIds: courierPostIds })
              .andWhere('order.status = :status', { status: Order_status.SOLD })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              deliveredQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            deliveredOrders = await deliveredQuery.getCount();

            const cancelledQuery = this.orderRepository
              .createQueryBuilder('order')
              .where('order.post_id IN (:...postIds)', { postIds: courierPostIds })
              .andWhere('order.status IN (:...statuses)', {
                statuses: [Order_status.CANCELLED, Order_status.CANCELLED_SENT],
              })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              cancelledQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            cancelledOrders = await cancelledQuery.getCount();

            const revenueQuery = this.orderRepository
              .createQueryBuilder('order')
              .select('SUM(order.total_price)', 'revenue')
              .where('order.post_id IN (:...postIds)', { postIds: courierPostIds })
              .andWhere('order.status = :status', { status: Order_status.SOLD })
              .andWhere('order.deleted = false');

            if (hasDateFilter) {
              revenueQuery
                .andWhere('order.created_at >= :startDate', { startDate })
                .andWhere('order.created_at <= :endDate', { endDate });
            }

            const revenueResult = await revenueQuery.getRawOne();
            totalRevenue = Number(revenueResult?.revenue || 0);
          }

          return {
            id: courier.id,
            name: courier.name,
            phoneNumber: courier.phone_number,
            status: courier.status,
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue,
            successRate:
              totalOrders > 0
                ? Math.round((deliveredOrders / totalOrders) * 100)
                : 0,
          };
        }),
      );

      // Tuman statistikalari
      const districtStats = await Promise.all(
        region.assignedDistricts.map(async (district) => {
          let totalOrders = 0;
          let deliveredOrders = 0;
          let cancelledOrders = 0;
          let totalRevenue = 0;

          // Tumandagi buyurtmalar
          const districtTotalQuery = this.orderRepository
            .createQueryBuilder('order')
            .where('order.district_id = :districtId', { districtId: district.id })
            .andWhere('order.deleted = false');

          if (hasDateFilter) {
            districtTotalQuery
              .andWhere('order.created_at >= :startDate', { startDate })
              .andWhere('order.created_at <= :endDate', { endDate });
          }

          totalOrders = await districtTotalQuery.getCount();

          const districtDeliveredQuery = this.orderRepository
            .createQueryBuilder('order')
            .where('order.district_id = :districtId', { districtId: district.id })
            .andWhere('order.status = :status', { status: Order_status.SOLD })
            .andWhere('order.deleted = false');

          if (hasDateFilter) {
            districtDeliveredQuery
              .andWhere('order.created_at >= :startDate', { startDate })
              .andWhere('order.created_at <= :endDate', { endDate });
          }

          deliveredOrders = await districtDeliveredQuery.getCount();

          const districtCancelledQuery = this.orderRepository
            .createQueryBuilder('order')
            .where('order.district_id = :districtId', { districtId: district.id })
            .andWhere('order.status IN (:...statuses)', {
              statuses: [Order_status.CANCELLED, Order_status.CANCELLED_SENT],
            })
            .andWhere('order.deleted = false');

          if (hasDateFilter) {
            districtCancelledQuery
              .andWhere('order.created_at >= :startDate', { startDate })
              .andWhere('order.created_at <= :endDate', { endDate });
          }

          cancelledOrders = await districtCancelledQuery.getCount();

          const districtRevenueQuery = this.orderRepository
            .createQueryBuilder('order')
            .select('SUM(order.total_price)', 'revenue')
            .where('order.district_id = :districtId', { districtId: district.id })
            .andWhere('order.status = :status', { status: Order_status.SOLD })
            .andWhere('order.deleted = false');

          if (hasDateFilter) {
            districtRevenueQuery
              .andWhere('order.created_at >= :startDate', { startDate })
              .andWhere('order.created_at <= :endDate', { endDate });
          }

          const revenueResult = await districtRevenueQuery.getRawOne();
          totalRevenue = Number(revenueResult?.revenue || 0);

          return {
            id: district.id,
            name: district.name,
            satoCode: district.sato_code,
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue,
            successRate:
              totalOrders > 0
                ? Math.round((deliveredOrders / totalOrders) * 100)
                : 0,
          };
        }),
      );

      // Umumiy statistika
      let totalOrders = 0;
      let deliveredOrders = 0;
      let cancelledOrders = 0;
      let pendingOrders = 0;
      let totalRevenue = 0;

      if (postIds.length > 0) {
        const overallTotalQuery = this.orderRepository
          .createQueryBuilder('order')
          .where('order.post_id IN (:...postIds)', { postIds })
          .andWhere('order.deleted = false');

        if (hasDateFilter) {
          overallTotalQuery
            .andWhere('order.created_at >= :startDate', { startDate })
            .andWhere('order.created_at <= :endDate', { endDate });
        }

        totalOrders = await overallTotalQuery.getCount();

        const overallDeliveredQuery = this.orderRepository
          .createQueryBuilder('order')
          .where('order.post_id IN (:...postIds)', { postIds })
          .andWhere('order.status = :status', { status: Order_status.SOLD })
          .andWhere('order.deleted = false');

        if (hasDateFilter) {
          overallDeliveredQuery
            .andWhere('order.created_at >= :startDate', { startDate })
            .andWhere('order.created_at <= :endDate', { endDate });
        }

        deliveredOrders = await overallDeliveredQuery.getCount();

        const overallCancelledQuery = this.orderRepository
          .createQueryBuilder('order')
          .where('order.post_id IN (:...postIds)', { postIds })
          .andWhere('order.status IN (:...statuses)', {
            statuses: [Order_status.CANCELLED, Order_status.CANCELLED_SENT],
          })
          .andWhere('order.deleted = false');

        if (hasDateFilter) {
          overallCancelledQuery
            .andWhere('order.created_at >= :startDate', { startDate })
            .andWhere('order.created_at <= :endDate', { endDate });
        }

        cancelledOrders = await overallCancelledQuery.getCount();

        pendingOrders = totalOrders - deliveredOrders - cancelledOrders;

        const overallRevenueQuery = this.orderRepository
          .createQueryBuilder('order')
          .select('SUM(order.total_price)', 'revenue')
          .where('order.post_id IN (:...postIds)', { postIds })
          .andWhere('order.status = :status', { status: Order_status.SOLD })
          .andWhere('order.deleted = false');

        if (hasDateFilter) {
          overallRevenueQuery
            .andWhere('order.created_at >= :startDate', { startDate })
            .andWhere('order.created_at <= :endDate', { endDate });
        }

        const revenueResult = await overallRevenueQuery.getRawOne();
        totalRevenue = Number(revenueResult?.revenue || 0);
      }

      return successRes(
        {
          region: {
            id: region.id,
            name: region.name,
            satoCode: region.sato_code,
          },
          summary: {
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            pendingOrders,
            totalRevenue,
            successRate:
              totalOrders > 0
                ? Math.round((deliveredOrders / totalOrders) * 100)
                : 0,
            totalCouriers: couriers.length,
            activeCouriers: couriers.filter((c) => c.status === Status.ACTIVE).length,
            totalDistricts: region.assignedDistricts.length,
          },
          couriers: courierStats.sort((a, b) => b.deliveredOrders - a.deliveredOrders),
          districts: districtStats.sort((a, b) => b.totalOrders - a.totalOrders),
        },
        200,
        'Viloyat batafsil statistikasi',
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
