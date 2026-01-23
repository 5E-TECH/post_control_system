import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { DistrictRepository } from 'src/core/repository/district.repository';
import { RegionRepository } from 'src/core/repository/region.repository';
import { OrderRepository } from 'src/core/repository/order.repository';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { regions } from 'src/infrastructure/lib/data/district';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictNameDto } from './dto/update-name.dto';
import { UpdateDistrictSatoCodeDto } from './dto/update-sato-code.dto';
import { MergeDistrictsDto } from './dto/merge-districts.dto';
import { Not, In, DataSource } from 'typeorm';
import { matchDistricts } from 'src/infrastructure/lib/utils/sato-matcher';

@Injectable()
export class DistrictService implements OnModuleInit {
  constructor(
    @InjectRepository(DistrictEntity)
    private readonly districtRepository: DistrictRepository,

    @InjectRepository(RegionEntity)
    private readonly regionRepository: RegionRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepository: OrderRepository,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * OnModuleInit - faqat bir marta boshlang'ich ma'lumotlarni yaratish uchun
   * Agar DB da allaqachon tumanlar mavjud bo'lsa, HECH NARSA qilmaydi
   * Bu to'g'irlangan nomlarni qayta yozishdan saqlaydi
   */
  async onModuleInit() {
    // Agar DB da allaqachon tumanlar mavjud bo'lsa, hech narsa qilmaymiz
    const existingDistrictsCount = await this.districtRepository.count();
    if (existingDistrictsCount > 0) {
      console.log(
        `✅ DB da ${existingDistrictsCount} ta tuman mavjud. Boshlang'ich yaratish o'tkazib yuborildi.`,
      );
      return;
    }

    console.log('📦 Boshlang\'ich tumanlar yaratilmoqda...');

    for (const region of regions) {
      const regionEntity = await this.regionRepository.findOne({
        where: { name: region.name },
      });

      if (!regionEntity) {
        continue;
      }

      for (const districtName of region.districts) {
        await this.districtRepository.save({
          name: districtName,
          region: regionEntity,
          assigned_region: regionEntity.id,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }
    }

    console.log('✅ Boshlang\'ich tumanlar yaratildi');
  }

  async create(createDistrictDto: CreateDistrictDto) {
    try {
      const { name, region_id } = createDistrictDto;

      const existRegion = await this.regionRepository.findOne({
        where: { id: region_id },
      });

      if (!existRegion) {
        throw new NotFoundException('Region not found');
      }

      const newDistrict = this.districtRepository.create({
        name,
        region_id,
        assigned_region: region_id,
      });
      await this.districtRepository.save(newDistrict);

      return successRes(newDistrict, 201, 'New district added');
    } catch (error) {
      return catchError(error);
    }
  }

  async findAll() {
    try {
      const district = await this.districtRepository.find({
        relations: ['region'],
      });
      return successRes(district);
    } catch (error) {
      return catchError(error);
    }
  }

  async findById(id: string) {
    try {
      // UUID formatini tekshirish
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || id === 'undefined' || id === 'null' || !uuidRegex.test(id)) {
        throw new NotFoundException('Invalid district ID');
      }

      const district = await this.districtRepository.findOne({
        where: { id },
        relations: ['region', 'assignedToRegion'],
      });

      if (!district) {
        throw new NotFoundException('district not found');
      }

      return successRes(district);
    } catch (error) {
      return catchError(error);
    }
  }

  async update(id: string, updateDistrictDto: UpdateDistrictDto) {
    try {
      const district = await this.districtRepository.findOne({ where: { id } });
      if (!district) {
        throw new NotFoundException('District not found');
      }
      if (district.assigned_region === updateDistrictDto.assigned_region) {
        throw new BadRequestException(
          'The district already assigned to this region',
        );
      }

      const assigningRegion = await this.regionRepository.findOne({
        where: { id: updateDistrictDto.assigned_region },
      });
      if (!assigningRegion) {
        throw new NotFoundException(
          'The region you are trying to assign does not exist',
        );
      }

      if (district.assignedToRegionId === assigningRegion.id) {
        throw new BadRequestException(
          'This district is already assigned to this region',
        );
      }

      // 🔑 ikkala fieldni yangilab qo‘yamiz
      district.assigned_region = assigningRegion.id; // column
      district.assignedToRegion = assigningRegion; // relation

      await this.districtRepository.save(district);

      return successRes(district, 200, 'District assigned to new region');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateName(id: string, updateNameDto: UpdateDistrictNameDto) {
    try {
      const district = await this.districtRepository.findOne({ where: { id } });
      if (!district) {
        throw new NotFoundException('District not found');
      }
      const { name } = updateNameDto;
      district.name = name;
      await this.districtRepository.save(district);

      return successRes({}, 200, 'District name updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateSatoCode(id: string, dto: UpdateDistrictSatoCodeDto) {
    try {
      const district = await this.districtRepository.findOne({ where: { id } });
      if (!district) {
        throw new NotFoundException('Tuman topilmadi');
      }

      // SATO code unikalligi tekshirish
      const existingWithCode = await this.districtRepository.findOne({
        where: { sato_code: dto.sato_code, id: Not(id) },
      });
      if (existingWithCode) {
        throw new BadRequestException(
          `Bu SATO code allaqachon "${existingWithCode.name}" tumaniga biriktirilgan`,
        );
      }

      district.sato_code = dto.sato_code;
      await this.districtRepository.save(district);

      return successRes(district, 200, 'Tuman SATO code yangilandi');
    } catch (error) {
      return catchError(error);
    }
  }

  async findBySatoCode(satoCode: string) {
    try {
      const district = await this.districtRepository.findOne({
        where: { sato_code: satoCode },
        relations: ['region', 'assignedToRegion'],
      });
      if (!district) {
        throw new NotFoundException('Bu SATO code bilan tuman topilmadi');
      }
      return successRes(district);
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * SATO kodlarini mavjud tumanlar bilan moslashtirish (preview)
   */
  async matchSatoCodes() {
    try {
      const dbDistricts = await this.districtRepository.find({
        relations: ['region'],
      });
      const result = matchDistricts(dbDistricts);
      return successRes(result, 200, 'SATO matching natijasi');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Mos kelgan tumanlarga SATO kodlarini avtomatik qo'shish
   */
  async applySatoCodes() {
    try {
      const dbDistricts = await this.districtRepository.find({
        relations: ['region'],
      });
      const matchResult = matchDistricts(dbDistricts);

      let appliedCount = 0;
      const applied: { id: string; name: string; sato_code: string }[] = [];

      for (const match of matchResult.matched) {
        // Faqat yangi kodlarni qo'shish (allaqachon mavjud bo'lmaganlarni)
        if (match.satoName !== '(allaqachon mavjud)') {
          await this.districtRepository.update(match.dbId, {
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
        `${appliedCount} ta tumanga SATO code qo'shildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Tumanlarni birlashtirish (TRANSACTION bilan)
   * - source_district_ids dagi barcha tumanlardan buyurtmalarni target_district_id ga ko'chiradi
   * - source tumanlarni o'chiradi
   */
  async mergeDistricts(dto: MergeDistrictsDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { source_district_ids, target_district_id } = dto;

      // Source va target bir xil bo'lmasligi kerak
      if (source_district_ids.includes(target_district_id)) {
        throw new BadRequestException(
          "Maqsadli tuman o'chiriladigan tumanlar ro'yxatida bo'lmasligi kerak",
        );
      }

      // Target tuman mavjudligini tekshirish
      const targetDistrict = await queryRunner.manager.findOne(DistrictEntity, {
        where: { id: target_district_id },
        relations: ['region'],
      });
      if (!targetDistrict) {
        throw new NotFoundException('Maqsadli tuman topilmadi');
      }

      // Source tumanlarni tekshirish
      const sourceDistricts = await queryRunner.manager.find(DistrictEntity, {
        where: { id: In(source_district_ids) },
        relations: ['region'],
      });
      if (sourceDistricts.length !== source_district_ids.length) {
        throw new NotFoundException(
          "Ba'zi tumanlar topilmadi. Iltimos, ro'yxatni tekshiring",
        );
      }

      console.log('🔄 MERGE BOSHLANDI (TRANSACTION)');
      console.log(`📍 Target: ${targetDistrict.name} (${target_district_id})`);
      console.log(`📍 Sources: ${sourceDistricts.map(d => `${d.name} (${d.id})`).join(', ')}`);

      // Har bir source district uchun buyurtmalarni va userlarni ko'chirish
      let totalOrdersMoved = 0;
      let totalUsersMoved = 0;
      const mergeDetails: {
        sourceId: string;
        sourceName: string;
        ordersMoved: number;
        usersMoved: number;
      }[] = [];

      for (const sourceDistrict of sourceDistricts) {
        // ========== 1. ORDER larni ko'chirish ==========
        const ordersCount = await queryRunner.manager.count(OrderEntity, {
          where: { district_id: sourceDistrict.id },
        });
        console.log(`📦 ${sourceDistrict.name}: ${ordersCount} ta buyurtma (order.district_id)`);

        if (ordersCount > 0) {
          const updateResult = await queryRunner.manager
            .createQueryBuilder()
            .update(OrderEntity)
            .set({ district_id: target_district_id })
            .where('district_id = :sourceId', { sourceId: sourceDistrict.id })
            .execute();
          console.log(`✅ Orders: ${updateResult.affected} ta ko'chirildi`);
        }

        // ========== 2. USER larni ko'chirish (MUHIM!) ==========
        const usersCount = await queryRunner.manager.count(UserEntity, {
          where: { district_id: sourceDistrict.id },
        });
        console.log(`👤 ${sourceDistrict.name}: ${usersCount} ta user (user.district_id)`);

        if (usersCount > 0) {
          const updateUsersResult = await queryRunner.manager
            .createQueryBuilder()
            .update(UserEntity)
            .set({ district_id: target_district_id })
            .where('district_id = :sourceId', { sourceId: sourceDistrict.id })
            .execute();
          console.log(`✅ Users: ${updateUsersResult.affected} ta ko'chirildi`);
        }

        // Ko'chirilganini tekshirish
        const remainingOrders = await queryRunner.manager.count(OrderEntity, {
          where: { district_id: sourceDistrict.id },
        });
        const remainingUsers = await queryRunner.manager.count(UserEntity, {
          where: { district_id: sourceDistrict.id },
        });
        console.log(`🔍 ${sourceDistrict.name}: ${remainingOrders} order, ${remainingUsers} user qoldi (0 bo'lishi kerak)`);

        if (remainingOrders > 0 || remainingUsers > 0) {
          throw new Error(`Ma'lumotlar to'liq ko'chirilmadi! ${sourceDistrict.name} da ${remainingOrders} order, ${remainingUsers} user qoldi`);
        }

        mergeDetails.push({
          sourceId: sourceDistrict.id,
          sourceName: sourceDistrict.name,
          ordersMoved: ordersCount,
          usersMoved: usersCount,
        });

        totalOrdersMoved += ordersCount;
        totalUsersMoved += usersCount;
      }

      // Target tumandagi ma'lumotlarni tekshirish
      const targetOrdersAfter = await queryRunner.manager.count(OrderEntity, {
        where: { district_id: target_district_id },
      });
      const targetUsersAfter = await queryRunner.manager.count(UserEntity, {
        where: { district_id: target_district_id },
      });
      console.log(`📊 Target tumanda: ${targetOrdersAfter} order, ${targetUsersAfter} user`);

      // Source tumanlarni o'chirish
      console.log(`🗑️ ${source_district_ids.length} ta tuman o'chirilmoqda...`);

      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(DistrictEntity)
        .where('id IN (:...ids)', { ids: source_district_ids })
        .execute();

      console.log('✅ Tumanlar o\'chirildi');

      // O'chirilgandan keyin tekshirish
      const targetOrdersFinal = await queryRunner.manager.count(OrderEntity, {
        where: { district_id: target_district_id },
      });
      const targetUsersFinal = await queryRunner.manager.count(UserEntity, {
        where: { district_id: target_district_id },
      });
      console.log(`📊 O'chirilgandan keyin: ${targetOrdersFinal} order, ${targetUsersFinal} user`);

      if (targetOrdersFinal !== targetOrdersAfter) {
        throw new Error(`Buyurtmalar yo'qoldi! Oldin: ${targetOrdersAfter}, Keyin: ${targetOrdersFinal}`);
      }

      // Transaction ni commit qilish
      await queryRunner.commitTransaction();
      console.log('✅ TRANSACTION COMMIT QILINDI');

      return successRes(
        {
          targetDistrict: {
            id: targetDistrict.id,
            name: targetDistrict.name,
            region: targetDistrict.region?.name,
          },
          mergedDistricts: mergeDetails,
          totalOrdersMoved,
          totalUsersMoved,
          deletedDistrictsCount: sourceDistricts.length,
        },
        200,
        `${sourceDistricts.length} ta tuman birlashtirildi. ${totalOrdersMoved} ta buyurtma, ${totalUsersMoved} ta user ko'chirildi.`,
      );
    } catch (error) {
      // Xatolik bo'lsa rollback
      await queryRunner.rollbackTransaction();
      console.log('❌ TRANSACTION ROLLBACK QILINDI');
      return catchError(error);
    } finally {
      // QueryRunner ni yopish
      await queryRunner.release();
    }
  }

  /**
   * DEBUG: Tumandagi buyurtmalar haqida to'liq ma'lumot
   */
  async debugDistrictOrders(id: string) {
    try {
      const district = await this.districtRepository.findOne({
        where: { id },
        relations: ['region'],
      });

      if (!district) {
        throw new NotFoundException('Tuman topilmadi');
      }

      // TypeORM count
      const countByTypeorm = await this.orderRepository.count({
        where: { district_id: id },
      });

      // Raw SQL count
      const rawCount = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM "order" WHERE district_id = $1`,
        [id],
      );

      // Barcha buyurtmalarni olish
      const orders = await this.orderRepository.find({
        where: { district_id: id },
        select: ['id', 'district_id', 'status', 'created_at'],
      });

      // Address orqali qidirish
      const addressOrders = await this.dataSource.query(
        `SELECT id, district_id, address, status FROM "order" WHERE address ILIKE $1 LIMIT 10`,
        [`%${district.name}%`],
      );

      return successRes({
        district: {
          id: district.id,
          name: district.name,
          region: district.region?.name,
        },
        typeormCount: countByTypeorm,
        rawSqlCount: parseInt(rawCount[0].count),
        orders: orders.slice(0, 10),
        addressMatchOrders: addressOrders,
      });
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Tumanni o'chirish (buyurtmalari bilan birga)
   */
  async deleteDistrict(id: string) {
    try {
      const district = await this.districtRepository.findOne({
        where: { id },
        relations: ['region'],
      });
      if (!district) {
        throw new NotFoundException('Tuman topilmadi');
      }

      // Bu tumandagi buyurtmalar sonini tekshirish
      const ordersCount = await this.orderRepository.count({
        where: { district_id: id },
      });

      if (ordersCount > 0) {
        throw new BadRequestException(
          `Bu tumanda ${ordersCount} ta buyurtma bor. Avval tumanlarni birlashtiring yoki buyurtmalarni boshqa tumanga ko'chiring.`,
        );
      }

      await this.districtRepository.delete({ id });

      return successRes(
        { deletedDistrict: { id: district.id, name: district.name } },
        200,
        'Tuman muvaffaqiyatli o\'chirildi',
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
