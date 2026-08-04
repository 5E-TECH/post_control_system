import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  Cashbox_type,
  Operation_type,
  Order_status,
  PaymentMethod,
  Post_status,
  Roles,
  Source_type,
  Status,
} from 'src/common/enums';
import config from 'src/config';
import { UserEntity } from 'src/core/entity/users.entity';
import {
  CreateCourierDto,
  CourierRegionInputDto,
} from './dto/create-courier.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import { CourierRegionEntity } from 'src/core/entity/courier-region.entity';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { SignInUserDto } from './dto/signInUserDto';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { writeToCookie } from 'src/infrastructure/lib/write-to-cookie/writeToCookie';
import { parseDurationToMs } from 'src/common/utils/parse-duration.util';
import { extractRequestMeta } from 'src/common/utils/request-meta.util';
import { Request, Response } from 'express';
import { UserRepository } from 'src/core/repository/user.repository';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  ILike,
  In,
  Not,
} from 'typeorm';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateInvestorDto } from './dto/create-investor.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { CreateLogistDto } from './dto/create-logist.dto';
import { UpdateLogistDto } from './dto/update-logist.dto';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { UpdateSelfDto } from './dto/self-update.dto';
import { UserSalaryEntity } from 'src/core/entity/user-salary.entity';
import { UserSalaryRepository } from 'src/core/repository/user-salary.repository';
import { RegionEntity } from 'src/core/entity/region.entity';
import { RegionRepository } from 'src/core/repository/region.repository';
import { CreateMarketDto } from './dto/create-market.dto';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { DistrictRepository } from 'src/core/repository/district.repository';
import { CustomerMarketEntity } from 'src/core/entity/customer-market.entity';
import { CustomerMarketReository } from 'src/core/repository/customer-market.repository';
import { UpdateMarketDto } from './dto/update-market.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { OrderEntity } from 'src/core/entity/order.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { OperatorEarningEntity } from 'src/core/entity/operator-earning.entity';
import { OperatorPaymentEntity } from 'src/core/entity/operator-payment.entity';
import { Commission_type } from 'src/common/enums';
import { UpdateOperatorCommissionDto } from './dto/update-operator-commission.dto';
import { PayOperatorDto } from './dto/pay-operator.dto';
import { getSafeLimit } from 'src/common/constants/pagination';
import { TelegramInitData } from './dto/initData.dto';
import { Cron } from '@nestjs/schedule';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { roleUz } from 'src/common/utils/status-label.util';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(CashEntity)
    private readonly cashRepo: CashRepository,

    @InjectRepository(UserSalaryEntity)
    private readonly userSalaryRepo: UserSalaryRepository,

    @InjectRepository(RegionEntity)
    private readonly regionRepo: RegionRepository,

    @InjectRepository(DistrictEntity)
    private readonly districtRepo: DistrictRepository,

    @InjectRepository(CustomerMarketEntity)
    private readonly customerMarketRepo: CustomerMarketReository,

    private readonly bcrypt: BcryptEncryption,
    private readonly token: Token,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Test for CI/CD

  async onModuleInit() {
    console.log("🟢 [SALARY CRON] Oylik maosh cron job ro'yxatga olindi");
    try {
      const isSuperAdmin = await this.userRepo.findOne({
        where: { role: Roles.SUPERADMIN },
      });

      if (!isSuperAdmin) {
        const hashedPassword = await this.bcrypt.encrypt(config.ADMIN_PASSWORD);
        const superAdminthis = this.userRepo.create({
          name: config.ADMIN_NAME,
          phone_number: config.ADMIN_PHONE_NUMBER,
          password: hashedPassword,
          role: Roles.SUPERADMIN,
        });
        await this.userRepo.save(superAdminthis);
      }
    } catch (error) {
      catchError(error);
    }

    // Restart tufayli o'tkazib yuborilgan oylik run'ni tiklash (idempotent).
    // Superadmin seed xatosidan mustaqil ishlashi uchun alohida try ichida.
    try {
      await this.catchUpMissedSalaries();
    } catch (error) {
      this.logger.error(
        `[SALARY CATCHUP] startup xato: ${error.message}`,
        error.stack,
      );
    }
  }

  async createAdmin(
    createAdminDto: CreateAdminDto,
    actor?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { password, phone_number, name, salary } = createAdminDto;
      let { payment_day } = createAdminDto;
      const existAdmin = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number },
      });
      if (existAdmin) {
        throw new ConflictException(
          `User with ${phone_number} number already exists`,
        );
      }
      if (!payment_day) {
        payment_day = new Date(Date.now()).getDate();
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const admin = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        password: hashedPassword,
        role: Roles.ADMIN,
      });
      await queryRunner.manager.save(admin);
      const adminSalary = queryRunner.manager.create(UserSalaryEntity, {
        user_id: admin.id,
        salary_amount: salary,
        have_to_pay: salary,
        payment_day,
      });
      await queryRunner.manager.save(adminSalary);
      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'user',
        entity_id: admin.id,
        action: 'created',
        new_value: { name: admin.name, role: admin.role },
        description: `Admin yaratildi: ${admin.name}`,
        user: actor,
      });
      return successRes(admin, 201, 'New Admin created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // Faqat-o'qish investor (ulushdor) akkaunti. createAdmin patteni bo'yicha,
  // lekin oyliksiz. Kapital/ulush/taqsimot Faza 3 equity-ledger orqali kiritiladi.
  async createInvestor(
    createInvestorDto: CreateInvestorDto,
    actor?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { password, phone_number, name } = createInvestorDto;
      const exist = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number },
      });
      if (exist) {
        throw new ConflictException(
          `User with ${phone_number} number already exists`,
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const investor = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        password: hashedPassword,
        role: Roles.INVESTOR,
      });
      await queryRunner.manager.save(investor);
      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'user',
        entity_id: investor.id,
        action: 'created',
        new_value: { name: investor.name, role: investor.role },
        description: `Investor yaratildi: ${investor.name}`,
        user: actor,
      });
      // Parol hashini javobda qaytarmaymiz.
      const { password: _pw, ...safe } = investor;
      return successRes(safe, 201, 'New Investor created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createRegistrator(
    createAdminDto: CreateAdminDto,
    actor?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { password, phone_number, name, salary } = createAdminDto;
      let { payment_day } = createAdminDto;
      const existUser = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number },
      });
      if (existUser) {
        throw new ConflictException(
          `User with ${phone_number} number already exists`,
        );
      }
      if (!payment_day) {
        const dayToPay = Number(
          new Date(Date.now()).toLocaleDateString('uz-UZ').split('.')[0],
        );
        payment_day = dayToPay;
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const user = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        password: hashedPassword,
        role: Roles.REGISTRATOR,
      });
      await queryRunner.manager.save(user);

      const userSalary = queryRunner.manager.create(UserSalaryEntity, {
        user_id: user.id,
        salary_amount: salary,
        have_to_pay: salary,
        payment_day,
      });
      await queryRunner.manager.save(userSalary);

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'user',
        entity_id: user.id,
        action: 'created',
        new_value: { name: user.name, role: user.role },
        description: `Registrator yaratildi: ${user.name}`,
        user: actor,
      });
      return successRes(user, 201, 'New Admin created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Super kuryerning biriktirilgan viloyatlarini to'liq almashtiradi
   * (eski qatorlarni o'chirib, yangilarini yozadi). Per-region tarif null
   * bo'lsa — kuryerning umumiy flat tarifiga fallback (sendPost'da hal qilinadi).
   */
  private async syncCourierRegions(
    manager: EntityManager,
    courierId: string,
    regions: CourierRegionInputDto[],
  ): Promise<void> {
    await manager.delete(CourierRegionEntity, { courier_id: courierId });
    if (!regions.length) return;
    const rows = regions.map((r) =>
      manager.create(CourierRegionEntity, {
        courier_id: courierId,
        region_id: r.region_id,
        tariff_home: r.tariff_home ?? null,
        tariff_center: r.tariff_center ?? null,
      }),
    );
    await manager.save(rows);
  }

  async createCourier(
    createCourierDto: CreateCourierDto,
    actor?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const {
        password,
        phone_number,
        name,
        region_id,
        tariff_center,
        tariff_home,
        is_super_courier,
        serves_all_regions,
        regions,
      } = createCourierDto;

      const existUser = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number },
      });
      if (existUser) {
        throw new ConflictException(
          `User with ${phone_number} number already exists`,
        );
      }

      // Oddiy kuryer uchun region_id majburiy; super kuryer uchun ixtiyoriy
      // (u viloyatlarni `regions` yoki `serves_all_regions` orqali oladi).
      if (!is_super_courier && !region_id) {
        throw new BadRequestException('region_id majburiy (oddiy kuryer uchun)');
      }
      if (region_id) {
        const isExistRegion = await queryRunner.manager.findOne(RegionEntity, {
          where: { id: region_id },
        });
        if (!isExistRegion) {
          throw new NotFoundException('Region not found');
        }
      }

      const hashedPassword = await this.bcrypt.encrypt(password);
      const courier = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        password: hashedPassword,
        region_id: region_id ?? null,
        tariff_center,
        tariff_home,
        role: Roles.COURIER,
        is_super_courier: !!is_super_courier,
        serves_all_regions: !!serves_all_regions,
      } as DeepPartial<UserEntity>);
      await queryRunner.manager.save(courier);

      // Super kuryer bo'lsa, biriktirilgan viloyatlarni yozamiz
      if (is_super_courier && regions?.length) {
        await this.syncCourierRegions(queryRunner.manager, courier.id, regions);
      }

      const cashbox = queryRunner.manager.create(CashEntity, {
        cashbox_type: Cashbox_type.FOR_COURIER,
        user_id: courier.id,
      });
      await queryRunner.manager.save(cashbox);

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'user',
        entity_id: courier.id,
        action: 'created',
        new_value: { name: courier.name, role: Roles.COURIER },
        description: `Kuryer yaratildi: ${courier.name}`,
        user: actor,
      });
      return successRes(courier, 201, `New courier created`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createMarket(
    createMarketDto: CreateMarketDto,
    actor?: JwtPayload,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const {
        name,
        phone_number,
        tariff_center,
        tariff_home,
        default_tariff,
        password,
      } = createMarketDto;
      const existMarket = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number },
      });
      if (existMarket) {
        throw new ConflictException(
          'User with this phone number already exist',
        );
      }
      const telegram_token = 'group_token-' + generateCustomToken();

      const hashedPassword = await this.bcrypt.encrypt(password);
      const newMarket = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        role: Roles.MARKET,
        tariff_center,
        tariff_home,
        default_tariff,
        password: hashedPassword,
        market_tg_token: telegram_token,
      });
      await queryRunner.manager.save(newMarket);
      const cashbox = queryRunner.manager.create(CashEntity, {
        cashbox_type: Cashbox_type.FOR_MARKET,
        user_id: newMarket.id,
      });
      await queryRunner.manager.save(cashbox);

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'user',
        entity_id: newMarket.id,
        action: 'created',
        new_value: { name: newMarket.name, role: Roles.MARKET },
        description: `Market yaratildi: ${newMarket.name}`,
        user: actor,
      });
      return successRes(newMarket, 201, 'New market created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createCustomer(
    user: JwtPayload,
    createCustomerDto: CreateCustomerDto,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { name, phone_number, district_id, address, extra_number } =
        createCustomerDto;
      if (!createCustomerDto.market_id) {
        if (user.role === Roles.MARKET) {
          createCustomerDto.market_id = user.id;
        } else if (user.role === Roles.OPERATOR) {
          // Operator o'z marketining ID sini olish
          const operatorUser = await queryRunner.manager.findOne(UserEntity, {
            where: { id: user.id, role: Roles.OPERATOR },
            select: ['id', 'market_id'],
          });
          if (!operatorUser?.market_id) {
            throw new BadRequestException('Operator marketga biriktirilmagan');
          }
          createCustomerDto.market_id = operatorUser.market_id;
        } else {
          throw new BadRequestException('Market not choosen');
        }
      }
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: {
          id: createCustomerDto.market_id,
          role: Roles.MARKET,
          status: Status.ACTIVE,
        },
      });
      if (user.role === Roles.MARKET && !market?.add_order) {
        throw new BadRequestException(
          'You can not create order. Contact admins',
        );
      }
      if (!market) {
        throw new NotFoundException('Market not found');
      }

      // Telefon raqam bo'yicha mavjud mijozni qidirish (district_id siz!)
      const isExistClient = await queryRunner.manager.findOne(UserEntity, {
        where: {
          phone_number,
          role: Roles.CUSTOMER,
        },
        relations: ['customerLinks', 'customerLinks.market'],
      });

      let assignedToMarket: boolean = false;
      if (isExistClient) {
        // Agar mijoz mavjud bo'lsa, ma'lumotlarini yangilash
        if (name && name !== isExistClient.name) {
          isExistClient.name = name;
        }
        if (extra_number !== undefined) {
          isExistClient.extra_number = extra_number;
        }
        // district_id va address ni saqlash (keyingi buyurtmalar uchun default)
        if (district_id) {
          isExistClient.district_id = district_id;
        }
        if (address !== undefined) {
          isExistClient.address = address;
        }
        await queryRunner.manager.save(isExistClient);

        const isAssignedToMarket = await queryRunner.manager.findOne(
          CustomerMarketEntity,
          {
            where: {
              market_id: createCustomerDto.market_id,
              customer_id: isExistClient.id,
            },
          },
        );
        if (isAssignedToMarket) {
          assignedToMarket = true;
        }
      }

      if (assignedToMarket) {
        await queryRunner.commitTransaction();
        return successRes(
          isExistClient,
          200,
          'This is your client and you can assign him new order',
        );
      }
      if (isExistClient && !assignedToMarket) {
        const newClientForMarket = queryRunner.manager.create(
          CustomerMarketEntity,
          {
            customer_id: isExistClient.id,
            market_id: createCustomerDto.market_id,
          },
        );
        await queryRunner.manager.save(newClientForMarket);

        await queryRunner.commitTransaction();
        return successRes(isExistClient, 200, 'Client assigned to market');
      }

      // Yangi mijoz yaratish (faqat telefon raqam yangi bo'lganda)
      // District tekshirish
      if (district_id) {
        const district = await queryRunner.manager.findOne(DistrictEntity, {
          where: { id: district_id },
        });
        if (!district) {
          throw new NotFoundException('District not found');
        }
      }

      const customer = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        role: Roles.CUSTOMER,
        district_id,
        address,
        extra_number,
      });
      await queryRunner.manager.save(customer);

      const customerMarket = queryRunner.manager.create(CustomerMarketEntity, {
        market_id: createCustomerDto.market_id,
        customer_id: customer.id,
      });
      await queryRunner.manager.save(customerMarket);

      await queryRunner.commitTransaction();
      return successRes(customer, 201, 'New Customer created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async allUsers(filters: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
    fetchAll?: boolean;
  }): Promise<object> {
    try {
      const { search, status, role, page = 1, fetchAll = false } = filters;
      const limit = getSafeLimit(filters.limit, fetchAll);

      const qb = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.region', 'region')
        .where('user.role NOT IN (:...excludedRoles)', {
          excludedRoles: [Roles.CUSTOMER, Roles.SUPERADMIN],
        });

      // 🔎 Search filter
      if (search) {
        qb.andWhere(
          '(user.name ILIKE :search OR user.phone_number ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 🎯 Status filter
      if (status) {
        qb.andWhere('user.status = :status', { status });
      }

      // 🎭 Role filter
      if (role) {
        qb.andWhere('user.role = :role', { role });
      }

      // 🔢 Pagination
      qb.skip((page - 1) * limit).take(limit);

      const [users, total] = await qb
        .orderBy('user.created_at', 'DESC')
        .getManyAndCount();

      return successRes(
        {
          data: users,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
        200,
        'All users',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async allMarkets(
    search?: string,
    page: number = 1,
    limit?: number,
    fetchAll: boolean = false,
  ): Promise<object> {
    try {
      const safeLimit = getSafeLimit(limit, fetchAll);

      const query = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.cashbox', 'cashbox')
        .where('user.role = :role', { role: Roles.MARKET })
        .select([
          'user.id',
          'user.name',
          'user.phone_number',
          'user.status',
          'user.default_tariff',
          'user.created_at',
          'user.add_order',
          'user.require_operator_phone',
          'user.default_operator_phone',
          'user.secondary_operator_phone',
          'cashbox', // cashboxni to'liq olish uchun
        ]);

      // Bloklanganlar (status = inactive) hech kimga ko'rinmaydi —
      // superadmin ham bu ro'yxatdan ko'rmaydi (boshqarish uchun userlar
      // sahifasidan kirish kerak)
      query.andWhere('user.status = :activeStatus', {
        activeStatus: Status.ACTIVE,
      });

      if (search) {
        query.andWhere(
          '(user.name ILIKE :search OR user.phone_number ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 🟢 Pagination
      const skip = (page - 1) * safeLimit;
      query.skip(skip).take(safeLimit);

      const [data, total] = await query.getManyAndCount();

      return successRes(
        {
          data,
          total,
          page,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
        },
        200,
        'All markets',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async allUsersExceptMarket(filters: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
    fetchAll?: boolean;
  }): Promise<object> {
    try {
      const { search, status, role, page = 1, fetchAll = false } = filters;
      const limit = getSafeLimit(filters.limit, fetchAll);

      const allowedRoles = [Roles.SUPERADMIN, Roles.ADMIN, Roles.COURIER];

      const qb = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.region', 'region')
        .where('user.role IN (:...allowedRoles)', { allowedRoles });

      // 🔍 Search filter
      if (search) {
        qb.andWhere(
          '(user.name ILIKE :search OR user.phone_number ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 🎯 Status filter
      if (status) {
        qb.andWhere('user.status = :status', { status });
      }

      // 🎭 Role filter — allowedRoles ichida bo'lishi kerak
      if (role && allowedRoles.includes(role as Roles)) {
        qb.andWhere('user.role = :role', { role });
      }

      // 🔢 Pagination
      qb.skip((page - 1) * limit).take(limit);

      const [users, total] = await qb
        .orderBy('user.created_at', 'DESC')
        .getManyAndCount();

      return successRes(
        {
          data: users,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
        200,
        'All users with roles: SUPERADMIN, ADMIN, COURIER',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async allRegistratorAndAdminUsers(filters: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
    fetchAll?: boolean;
  }): Promise<object> {
    try {
      const { search, status, role, page = 1, fetchAll = false } = filters;
      const limit = getSafeLimit(filters.limit, fetchAll);

      const allowedRoles = [Roles.REGISTRATOR, Roles.ADMIN, Roles.LOGIST];

      const qb = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.region', 'region')
        .leftJoinAndSelect('user.salary', 'salary')
        .where('user.role IN (:...allowedRoles)', { allowedRoles });

      // 🔍 Search filter
      if (search) {
        qb.andWhere(
          '(user.name ILIKE :search OR user.phone_number ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 🎯 Status filter
      if (status) {
        qb.andWhere('user.status = :status', { status });
      }

      // 🎭 Role filter — allowedRoles ichida bo'lishi kerak
      if (role && allowedRoles.includes(role as Roles)) {
        qb.andWhere('user.role = :role', { role });
      }

      // 🔢 Pagination
      qb.skip((page - 1) * limit).take(limit);

      const [users, total] = await qb
        .orderBy('user.created_at', 'DESC')
        .getManyAndCount();

      return successRes(
        {
          data: users,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
        200,
        'All users with roles: REGISTRATOR, ADMIN',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async allCouriers(search: string | undefined): Promise<object> {
    try {
      // Bloklanganlar (status = inactive) hech kimga ko'rinmaydi —
      // superadmin ham bu ro'yxatdan ko'rmaydi
      const baseFilter = { role: Roles.COURIER, status: Status.ACTIVE };

      const allCouriers = await this.userRepo.find({
        where: search
          ? [
              { ...baseFilter, name: ILike(`%${search}%`) },
              { ...baseFilter, phone_number: ILike(`%${search}%`) },
            ]
          : baseFilter,
        select: [
          'id',
          'name',
          'phone_number',
          'status',
          'created_at',
          'is_super_courier',
          'serves_all_regions',
        ],
        relations: ['cashbox', 'region'],
        order: { created_at: 'DESC' },
      });

      return successRes(allCouriers, 200, 'All couriers');
    } catch (error) {
      return catchError(error);
    }
  }

  async allEmployees() {
    try {
      const allEmployees = await this.userRepo.find({
        where: { role: In([Roles.ADMIN, Roles.COURIER, Roles.REGISTRATOR]) },
      });
      return successRes(allEmployees, 200, 'Barcha xodimlar');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string): Promise<object> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: id, role: Not(Roles.SUPERADMIN) },
        relations: ['region', 'salary'],
      });
      if (!user) {
        throw new NotFoundException('User not fount');
      }
      return successRes(user, 200, 'User by id');
    } catch (error) {
      return catchError(error);
    }
  }

  async profile(user: JwtPayload): Promise<object> {
    try {
      const { id } = user;
      const myProfile = await this.userRepo.findOne({
        where: { id },
        relations: ['region', 'market', 'salary'],
      });
      return successRes(myProfile, 200, 'Profile info');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Maosh sozlamasi (oylik / qoldiq / to'lov kuni) o'zgarishini audit-logga yozadi.
   * Faqat haqiqatan o'zgargan maydonlar yoziladi. Hech narsa o'zgarmasa — log yozilmaydi.
   */
  private logSalaryChange(
    userId: string,
    userName: string,
    before: {
      salary_amount?: number;
      have_to_pay?: number;
      payment_day?: number;
    } | null,
    after: {
      salary_amount?: number;
      have_to_pay?: number;
      payment_day?: number;
    },
    actor?: JwtPayload,
  ): void {
    const labels: Record<string, string> = {
      salary_amount: 'Oylik maosh',
      have_to_pay: "To'lanmagan qoldiq",
      payment_day: "To'lov kuni",
    };
    const fmt = (field: string, val: any) =>
      field === 'payment_day'
        ? `${val ?? '—'}-kun`
        : `${Number(val ?? 0).toLocaleString()} so'm`;

    const oldValue: Record<string, any> = {};
    const newValue: Record<string, any> = {};
    const parts: string[] = [];

    for (const field of ['salary_amount', 'have_to_pay', 'payment_day']) {
      const newVal = (after as any)[field];
      if (newVal === undefined) continue;
      const oldVal = before ? (before as any)[field] ?? null : null;
      if (oldVal === newVal) continue;
      oldValue[field] = oldVal;
      newValue[field] = newVal;
      parts.push(`${labels[field]}: ${fmt(field, oldVal)} → ${fmt(field, newVal)}`);
    }

    if (parts.length === 0) return;

    this.activityLog.log({
      entity_type: 'user_salary',
      entity_id: userId,
      action: 'salary_updated',
      old_value: oldValue,
      new_value: newValue,
      description: `Maosh sozlamasi o'zgardi (${userName}): ${parts.join(', ')}`,
      user: actor,
    });
  }

  async updateAdmin(
    id: string,
    updateAdminDto: UpdateAdminDto,
    currentUser: JwtPayload,
  ) {
    try {
      const { password, ...otherFields } = updateAdminDto;
      // Find is user exist or not
      const user = await this.userRepo.findOne({
        where: { id, role: Roles.ADMIN },
      });
      if (!user) {
        throw new NotFoundException('Admin not found');
      }
      // If admins try to change their status they can not
      if (otherFields.status && currentUser.role !== Roles.SUPERADMIN) {
        throw new BadRequestException('Only SuperAdmin can change the status');
      }
      // Rolni faqat superadmin o'zgartira oladi
      if (otherFields.role) {
        if (currentUser.role !== Roles.SUPERADMIN) {
          throw new BadRequestException(
            "Faqat SuperAdmin foydalanuvchi rolini o'zgartira oladi",
          );
        }
        if (![Roles.ADMIN, Roles.REGISTRATOR].includes(otherFields.role)) {
          throw new BadRequestException(
            "Faqat admin yoki registrator roliga o'zgartirilishi mumkin",
          );
        }
      }
      // Phone number oldin ro'yxatdan o'tganmi yoki yo'qligini tekshirish
      if (otherFields.phone_number) {
        const existPhone = await this.userRepo.findOne({
          where: {
            phone_number: otherFields.phone_number,
            role: Not(Roles.CUSTOMER),
            id: Not(id),
          },
        });
        if (existPhone) {
          throw new ConflictException(
            `User with ${otherFields.phone_number} already exist`,
          );
        }
      }
      // If user want to edit password encript it first
      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }

      // Sezgir o'zgarishlarni aniqlash uchun eski holatni saqlaymiz.
      const beforeStatus = user.status;
      const beforeRole = user.role;

      // salary va payment_day ni alohida olamiz
      const {
        salary: newSalary,
        payment_day: newPaymentDay,
        have_to_pay: newHaveToPay,
        ...fieldsToUpdate
      } = otherFields;

      Object.assign(user, {
        ...fieldsToUpdate,
        ...(hashedPassword && { password: hashedPassword }),
      });
      await this.userRepo.save(user);

      // Salary yangilash (faqat superadmin)
      if (
        newSalary !== undefined ||
        newPaymentDay !== undefined ||
        newHaveToPay !== undefined
      ) {
        const salaryRepo = this.dataSource.getRepository(UserSalaryEntity);
        let salary = await salaryRepo.findOne({ where: { user_id: id } });
        const beforeSalary = salary
          ? {
              salary_amount: salary.salary_amount,
              have_to_pay: salary.have_to_pay,
              payment_day: salary.payment_day,
            }
          : null;
        if (salary) {
          if (newSalary !== undefined) salary.salary_amount = newSalary;
          if (newPaymentDay !== undefined) salary.payment_day = newPaymentDay;
          if (newHaveToPay !== undefined) salary.have_to_pay = newHaveToPay;
          await salaryRepo.save(salary);
        } else if (newSalary !== undefined) {
          // Salary yo'q bo'lsa yaratamiz
          salary = salaryRepo.create({
            user_id: id,
            salary_amount: newSalary,
            have_to_pay: newSalary,
            payment_day: newPaymentDay || new Date().getDate(),
          });
          await salaryRepo.save(salary);
        }
        if (salary) {
          this.logSalaryChange(
            id,
            user.name,
            beforeSalary,
            {
              salary_amount: salary.salary_amount,
              have_to_pay: salary.have_to_pay,
              payment_day: salary.payment_day,
            },
            currentUser,
          );
        }
      }

      const updatedUser = await this.userRepo.findOneOrFail({
        where: { id },
        relations: ['region', 'salary'],
      });

      const { password: _, ...safeUser } = updatedUser;
      this.logUserMutation({
        user: updatedUser,
        beforeStatus,
        beforeRole,
        passwordChanged: !!password,
        roleLabel: 'Admin',
        actor: currentUser,
      });
      return successRes(safeUser, 200, 'User updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateRegistrator(
    id: string,
    updateRegistratorDto: UpdateAdminDto,
    currentUser?: JwtPayload,
  ) {
    try {
      const { password, ...otherFields } = updateRegistratorDto;
      const registrator = await this.userRepo.findOne({
        where: { id, role: Roles.REGISTRATOR },
      });
      if (!registrator) {
        throw new NotFoundException('Registrator not found');
      }
      const beforeStatus = registrator.status;
      const beforeRole = registrator.role;
      // Rolni faqat superadmin o'zgartira oladi
      if (otherFields.role) {
        if (!currentUser || currentUser.role !== Roles.SUPERADMIN) {
          throw new BadRequestException(
            "Faqat SuperAdmin foydalanuvchi rolini o'zgartira oladi",
          );
        }
        if (![Roles.ADMIN, Roles.REGISTRATOR].includes(otherFields.role)) {
          throw new BadRequestException(
            "Faqat admin yoki registrator roliga o'zgartirilishi mumkin",
          );
        }
      }
      if (otherFields.phone_number) {
        const isExistPhone = await this.userRepo.findOne({
          where: {
            phone_number: otherFields.phone_number,
            role: Not(Roles.CUSTOMER),
            id: Not(id),
          },
        });
        if (isExistPhone) {
          throw new BadRequestException(
            `User with ${otherFields.phone_number} already exist`,
          );
        }
      }
      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }
      // salary va payment_day ni alohida olamiz
      const {
        salary: newSalary,
        payment_day: newPaymentDay,
        have_to_pay: newHaveToPay,
        ...fieldsToUpdate
      } = otherFields;

      Object.assign(registrator, {
        ...fieldsToUpdate,
        ...(hashedPassword && { password: hashedPassword }),
      });
      await this.userRepo.save(registrator);

      // Salary yangilash
      if (
        newSalary !== undefined ||
        newPaymentDay !== undefined ||
        newHaveToPay !== undefined
      ) {
        const salaryRepo = this.dataSource.getRepository(UserSalaryEntity);
        let salary = await salaryRepo.findOne({ where: { user_id: id } });
        const beforeSalary = salary
          ? {
              salary_amount: salary.salary_amount,
              have_to_pay: salary.have_to_pay,
              payment_day: salary.payment_day,
            }
          : null;
        if (salary) {
          if (newSalary !== undefined) salary.salary_amount = newSalary;
          if (newPaymentDay !== undefined) salary.payment_day = newPaymentDay;
          if (newHaveToPay !== undefined) salary.have_to_pay = newHaveToPay;
          await salaryRepo.save(salary);
        } else if (newSalary !== undefined) {
          salary = salaryRepo.create({
            user_id: id,
            salary_amount: newSalary,
            have_to_pay: newSalary,
            payment_day: newPaymentDay || new Date().getDate(),
          });
          await salaryRepo.save(salary);
        }
        if (salary) {
          this.logSalaryChange(
            id,
            registrator.name,
            beforeSalary,
            {
              salary_amount: salary.salary_amount,
              have_to_pay: salary.have_to_pay,
              payment_day: salary.payment_day,
            },
            currentUser,
          );
        }
      }

      this.logUserMutation({
        user: registrator,
        beforeStatus,
        beforeRole,
        passwordChanged: !!password,
        roleLabel: 'Registrator',
        actor: currentUser,
      });
      return successRes({}, 200, 'Registrator updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateCourier(
    id: string,
    updateCourierDto: UpdateCourierDto,
    actor?: JwtPayload,
  ): Promise<object> {
    try {
      const { password, regions, ...otherFields } = updateCourierDto;

      const courier = await this.userRepo.findOne({
        where: { id, role: Roles.COURIER },
      });
      if (!courier) {
        throw new NotFoundException('User not found');
      }
      const beforeStatus = courier.status;

      // Update qilganda telefon nomer databasada bor yoki yo'qligini tekshirish
      if (otherFields.phone_number) {
        const existUser = await this.userRepo.findOne({
          where: {
            phone_number: otherFields.phone_number,
            role: Not(Roles.CUSTOMER),
            id: Not(id),
          },
        });
        if (existUser) {
          throw new ConflictException(
            `User with ${otherFields.phone_number} number already exists`,
          );
        }
      }

      // Courierni update qilganda region_id kelsa courierRegion tableini update qilish
      if (otherFields.region_id) {
        const existingRegion = await this.regionRepo.findOne({
          where: { id: otherFields.region_id },
        });

        if (!existingRegion) {
          throw new NotFoundException('Region not found');
        }
      }

      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }

      Object.assign(courier, {
        ...otherFields,
        ...(hashedPassword && { password: hashedPassword }),
      });
      await this.userRepo.save(courier);

      // `regions` berilgan bo'lsa — super kuryer viloyatlarini to'liq almashtiramiz
      if (regions) {
        await this.syncCourierRegions(this.dataSource.manager, id, regions);
      }

      const updatedUser = await this.userRepo.findOne({ where: { id } });
      this.logUserMutation({
        user: updatedUser ?? courier,
        beforeStatus,
        passwordChanged: !!password,
        roleLabel: 'Kuryer',
        actor,
      });
      return successRes(updatedUser, 200, 'User updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateMarket(
    id: string,
    updateMarketDto: UpdateMarketDto,
    actor?: JwtPayload,
  ): Promise<object> {
    try {
      const { password, ...otherFields } = updateMarketDto;
      const market = await this.userRepo.findOne({
        where: { id, role: Roles.MARKET },
      });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      const beforeStatus = market.status;

      if (otherFields.phone_number) {
        const isExistPhoneNumber = await this.userRepo.findOne({
          where: {
            phone_number: otherFields.phone_number,
            role: Not(Roles.CUSTOMER),
            id: Not(id),
          },
        });
        if (isExistPhoneNumber) {
          throw new ConflictException(
            'User with this phone number already exist',
          );
        }
      }

      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }

      Object.assign(market, {
        ...otherFields,
        ...(hashedPassword && { password: hashedPassword }),
      });

      const updatedMarket = await this.userRepo.save(market);

      this.logUserMutation({
        user: updatedMarket,
        beforeStatus,
        passwordChanged: !!password,
        roleLabel: 'Market',
        actor,
      });
      return successRes(updatedMarket, 200, 'Market updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateCustomerNamePhone(
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id, role: Roles.CUSTOMER },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      if (dto.name) customer.name = dto.name;
      if (dto.phone_number) customer.phone_number = dto.phone_number;

      await queryRunner.manager.save(customer);

      await queryRunner.commitTransaction();
      return successRes(customer, 200, 'Customer updated (name/phone)');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async updateCustomerAddress(
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      /**
       * 1️⃣ Mijozni topish
       */
      const customer = await queryRunner.manager.findOne(UserEntity, {
        where: { id, role: Roles.CUSTOMER },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      /**
       * 2️⃣ Mijozning buyurtmasini topish
       */
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { customer_id: customer.id },
      });
      if (!order) throw new NotFoundException('User order not found');

      /**
       * 3️⃣ Faqat NEW yoki RECEIVED holatdagi buyurtmada manzilni o‘zgartirish mumkin
       */
      const editableStatuses = [Order_status.NEW, Order_status.RECEIVED];
      if (!editableStatuses.includes(order.status)) {
        throw new BadRequestException(
          'You can not change the address for this order',
        );
      }

      /**
       * 4️⃣ Tuman (district)ni tekshirish va yangilash
       */
      if (dto.district_id) {
        const district = await queryRunner.manager.findOne(DistrictEntity, {
          where: { id: dto.district_id },
        });
        if (!district) throw new NotFoundException('District not found');
        customer.district_id = dto.district_id;
      }

      /**
       * 5️⃣ Manzilni (address) yangilash
       */
      if (dto.address) {
        customer.address = dto.address;
      }

      await queryRunner.manager.save(customer);

      /**
       * 6️⃣ Yangilangan mijozni district bilan birga qayta olish
       */
      const updatedCustomer = await queryRunner.manager.findOne(UserEntity, {
        where: { id, role: Roles.CUSTOMER },
        relations: ['district'],
      });
      if (!updatedCustomer) throw new NotFoundException('Customer not found');

      /**
       * 7️⃣ Agar buyurtma RECEIVED bo‘lsa va post mavjud bo‘lsa — Postni yangilash
       */
      if (order.status === Order_status.RECEIVED && order.post_id) {
        const assignedRegion = updatedCustomer.district?.assigned_region;
        if (!assignedRegion)
          throw new BadRequestException('District has no assigned region');

        // 🔹 Shu region uchun yangi yoki mavjud NEW holatdagi postni topamiz
        let newPost = await queryRunner.manager.findOne(PostEntity, {
          where: { region_id: assignedRegion, status: Post_status.NEW },
        });

        // 🔹 Agar topilmasa, yangisini yaratamiz
        if (!newPost) {
          newPost = queryRunner.manager.create(PostEntity, {
            region_id: assignedRegion,
            qr_code_token: generateCustomToken(),
            post_total_price: 0,
            order_quantity: 0,
            status: Post_status.NEW,
          });
          newPost = await queryRunner.manager.save(newPost);
        }

        // 🔹 Eski postni topamiz
        const oldPost = await queryRunner.manager.findOne(PostEntity, {
          where: { id: order.post_id },
        });
        if (!oldPost) throw new NotFoundException('Old post not found');

        // 🔹 Buyurtmani yangi postga o‘tkazamiz
        order.post_id = newPost.id;
        await queryRunner.manager.save(order);

        // 🔹 Eski postni yangilaymiz yoki o‘chiramiz
        const remainingTotal =
          Number(oldPost.post_total_price) - Number(order.total_price);
        const remainingQuantity = oldPost.order_quantity - 1;

        if (remainingQuantity <= 0 || remainingTotal <= 0) {
          await queryRunner.manager.delete(PostEntity, { id: oldPost.id });
        } else {
          oldPost.post_total_price = remainingTotal;
          oldPost.order_quantity = remainingQuantity;
          await queryRunner.manager.save(oldPost);
        }

        // 🔹 Yangi postni yangilaymiz
        newPost.post_total_price =
          Number(newPost.post_total_price) + Number(order.total_price);
        newPost.order_quantity += 1;
        await queryRunner.manager.save(newPost);
      }

      /**
       * 8️⃣ Hammasi muvaffaqiyatli bo‘lsa — transaction commit qilinadi
       */
      await queryRunner.commitTransaction();

      return successRes(updatedCustomer, 200, 'Customer updated successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async selfUpdate(user: JwtPayload, selfUpdateDto: UpdateSelfDto) {
    try {
      const { password, ...otherFields } = selfUpdateDto;
      const myProfile = await this.userRepo.findOne({ where: { id: user.id } });
      if (!myProfile) throw new NotFoundException('Your infos not found');
      if (otherFields.phone_number) {
        const phoneNumber = await this.userRepo.findOne({
          where: {
            phone_number: otherFields.phone_number,
            id: Not(user.id),
          },
        });
        if (phoneNumber) {
          throw new ConflictException(
            `User with ${otherFields.phone_number} number already exist`,
          );
        }
      }
      if (user.role === Roles.MARKET && otherFields.name) {
        throw new BadRequestException(
          'Markets can not change their names by themselves',
        );
      }
      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }
      Object.assign(myProfile, {
        ...otherFields,
        ...(password && { password: hashedPassword }),
      });
      await this.userRepo.save(myProfile);

      const updatedUser = await this.userRepo.findOne({
        where: { id: user.id },
      });

      this.activityLog.log({
        entity_type: 'user',
        entity_id: user.id,
        action: 'updated',
        new_value: {
          name: updatedUser?.name,
          ...(otherFields.phone_number
            ? { phone_number: otherFields.phone_number }
            : {}),
          ...(password ? { password_changed: true } : {}),
        },
        description: `${updatedUser?.name || 'Foydalanuvchi'} o'z profilini yangiladi${
          password ? ' (parol o\'zgartirildi)' : ''
        }`,
        user,
      });
      return successRes(updatedUser, 200, 'User updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string, actor?: JwtPayload): Promise<object> {
    try {
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException('User not fount');
      }
      if (user.role === Roles.SUPERADMIN) {
        throw new BadRequestException('Super admin can not be deleted!');
      }
      await this.userRepo.delete({ id });
      this.activityLog.log({
        entity_type: 'user',
        entity_id: id,
        action: 'deleted',
        old_value: { name: user.name, role: user.role },
        description: `Foydalanuvchi o'chirildi: ${user.name} (${roleUz(user.role)})`,
        user: actor,
      });
      return successRes({}, 200, 'User deleted');
    } catch (error) {
      return catchError(error);
    }
  }

  private extractLoginMetadata(req?: Request): Record<string, any> {
    if (!req) return {};
    // Yagona yordamchi orqali — trust proxy 'loopback' bilan req.ip HAQIQIY
    // mijoz IP'sini beradi; eski "eng chapdagi X-Forwarded-For" (soxtalashtirsa
    // bo'ladigan) usul olib tashlandi. Mijoz yuborsa qurilma ID/nomi ham olinadi.
    const meta = extractRequestMeta(req);
    return {
      user_agent: meta.user_agent,
      ip: meta.ip,
      ...(meta.device_id ? { device_id: meta.device_id } : {}),
      ...(meta.device_name ? { device_name: meta.device_name } : {}),
    };
  }

  // Muvaffaqiyatsiz login urinishini loglaydi. Maxfiylik: telefon TO'LIQ
  // saqlanmaydi (faqat oxirgi 4 raqam), tavsif umumiy — telefon mavjudligi
  // oshkor qilinmaydi. Noma'lum telefon uchun entity_id = NIL sentinel.
  private logFailedLogin(
    reason: 'unknown_phone' | 'blocked' | 'wrong_password',
    phone: string,
    req?: Request,
    userId?: string,
  ): void {
    const last4 = (phone || '').slice(-4);
    this.activityLog.log({
      entity_type: 'user',
      entity_id: userId || '00000000-0000-0000-0000-000000000000',
      action: 'login_failed',
      description: 'Tizimga kirishda xatolik',
      metadata: {
        ...this.extractLoginMetadata(req),
        reason,
        phone_masked: last4 ? `***${last4}` : undefined,
        source: 'web',
      },
    });
  }

  // Foydalanuvchi yangilanishini loglaydi va sezgir o'zgarishlarni alohida
  // action sifatida ajratadi (bloklash, blokdan chiqarish, rol o'zgarishi,
  // parol o'zgarishi). Parol HECH QACHON saqlanmaydi — faqat flag.
  private logUserMutation(params: {
    user: { id: string; name: string; role: string; status: string };
    beforeStatus?: string;
    beforeRole?: string;
    passwordChanged?: boolean;
    roleLabel: string;
    actor?: JwtPayload;
  }): void {
    const { user, beforeStatus, beforeRole, passwordChanged, roleLabel, actor } =
      params;
    const statusChanged =
      beforeStatus !== undefined && beforeStatus !== user.status;
    const roleChanged = beforeRole !== undefined && beforeRole !== user.role;

    let action = 'updated';
    let description = `${roleLabel} yangilandi: ${user.name}`;
    if (statusChanged) {
      const blocked = user.status === Status.INACTIVE;
      action = blocked ? 'blocked' : 'unblocked';
      description = blocked
        ? `${roleLabel} bloklandi: ${user.name}`
        : `${roleLabel} blokdan chiqarildi: ${user.name}`;
    } else if (roleChanged) {
      action = 'role_changed';
      description = `${user.name} roli o'zgardi: ${roleUz(beforeRole)} → ${roleUz(
        user.role,
      )}`;
    } else if (passwordChanged) {
      description = `${roleLabel} yangilandi: ${user.name} (parol o'zgartirildi)`;
    }

    this.activityLog.log({
      entity_type: 'user',
      entity_id: user.id,
      action,
      old_value: {
        ...(statusChanged ? { status: beforeStatus } : {}),
        ...(roleChanged ? { role: beforeRole } : {}),
      },
      new_value: {
        name: user.name,
        role: user.role,
        ...(statusChanged ? { status: user.status } : {}),
        ...(passwordChanged ? { password_changed: true } : {}),
      },
      description,
      user: actor,
    });
  }

  async signInUser(
    signInDto: SignInUserDto,
    res: Response,
    req?: Request,
  ): Promise<object> {
    try {
      const { phone_number, password } = signInDto;

      const user = await this.userRepo.findOne({
        where: { phone_number, role: Not(Roles.CUSTOMER) },
      });
      if (!user) {
        this.logFailedLogin('unknown_phone', phone_number, req);
        throw new BadRequestException('Phone number or password incorrect');
      }
      if (user.status === Status.INACTIVE) {
        this.logFailedLogin('blocked', phone_number, req, user.id);
        throw new BadRequestException('You have been blocked by superadmin');
      }
      const IsMatchPassword = await this.bcrypt.compare(
        password,
        user?.password,
      );
      if (!IsMatchPassword) {
        this.logFailedLogin('wrong_password', phone_number, req, user.id);
        throw new BadRequestException('Phone number or password incorrect');
      }
      const { id, role, status } = user;
      const payload: JwtPayload = { id, role, status };
      const accessToken = await this.token.generateAccessToken(payload);
      const refreshToken = await this.token.generateRefreshToken(payload);
      writeToCookie(res, 'refreshToken', refreshToken);
      const refreshTokenExpiresAt =
        Date.now() + parseDurationToMs(config.REFRESH_TOKEN_TIME);

      this.activityLog.log({
        entity_type: 'user',
        entity_id: id,
        action: 'login',
        description: `${user.name} tizimga kirdi`,
        user: { id, name: user.name, role },
        metadata: { ...this.extractLoginMetadata(req), source: 'web' },
      });

      return successRes(
        {
          access_token: accessToken,
          refresh_token_expires_at: refreshTokenExpiresAt,
        },
        200,
        'Logged in successfully',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async linkTelegramAccount(
    initData: TelegramInitData,
    currentUser: JwtPayload,
  ) {
    try {
      const { data } = initData;
      const params = new URLSearchParams(data);
      const userStr = params.get('user');
      if (!userStr) {
        throw new BadRequestException('No initData found');
      }
      const tgUser = JSON.parse(userStr);
      const telegramId = Number(tgUser?.id);
      if (!telegramId) {
        throw new BadRequestException('Telegram user id missing');
      }

      const user = await this.userRepo.findOne({
        where: { id: currentUser.id, is_deleted: false },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== Roles.MARKET && user.role !== Roles.OPERATOR) {
        return successRes(
          { linked: false },
          200,
          'Skipped: only market/operator can be linked',
        );
      }

      if (user.telegram_id && Number(user.telegram_id) === telegramId) {
        return successRes({ linked: true }, 200, 'Already linked');
      }

      const conflict = await this.userRepo.findOne({
        where: { telegram_id: telegramId, is_deleted: false },
      });
      if (conflict && conflict.id !== user.id) {
        throw new ConflictException(
          "Bu Telegram hisobi boshqa foydalanuvchiga bog'langan",
        );
      }

      user.telegram_id = telegramId;
      await this.userRepo.save(user);

      return successRes({ linked: true }, 200, 'Telegram linked successfully');
    } catch (error) {
      return catchError(error);
    }
  }

  async loginTelegram(initData: TelegramInitData, req?: Request) {
    try {
      const { data } = initData;
      const params = new URLSearchParams(data);
      const userStr = params.get('user');
      if (!userStr) {
        throw new BadRequestException('No initData found');
      }
      const user = JSON.parse(userStr);

      const isRegisteredUser = await this.userRepo.findOne({
        where: { telegram_id: user.id },
      });

      if (!isRegisteredUser) {
        throw new UnauthorizedException(
          'You have not registred for this platform',
        );
      }
      const { id, role, status } = isRegisteredUser;
      const payload: JwtPayload = { id, role, status };
      const accessToken = await this.token.generateAccessToken(payload);

      this.activityLog.log({
        entity_type: 'user',
        entity_id: id,
        action: 'login',
        description: `${isRegisteredUser.name} Telegram orqali tizimga kirdi`,
        user: { id, name: isRegisteredUser.name, role },
        metadata: { ...this.extractLoginMetadata(req), source: 'telegram' },
      });

      return successRes(
        { access_token: accessToken },
        200,
        'Logged in successfully',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async refreshToken(req: Request, res: Response): Promise<object> {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        throw new UnauthorizedException('Refresh token not found');
      }

      let payload: JwtPayload;
      try {
        const decoded = this.jwtService.verify(token, {
          secret: config.REFRESH_TOKEN_KEY,
        });
        payload = {
          id: decoded.id,
          role: decoded.role,
          status: decoded.status,
        };
      } catch {
        res.clearCookie('refreshToken');
        throw new UnauthorizedException('Refresh token expired or invalid');
      }

      const user = await this.userRepo.findOne({ where: { id: payload.id } });
      if (!user || user.status === Status.INACTIVE) {
        res.clearCookie('refreshToken');
        throw new UnauthorizedException('User not found or inactive');
      }

      const newPayload: JwtPayload = {
        id: user.id,
        role: user.role,
        status: user.status,
      };
      const accessToken = await this.token.generateAccessToken(newPayload);

      return successRes(
        { access_token: accessToken },
        200,
        'Token refreshed successfully',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async signOut(res: Response): Promise<object> {
    try {
      res.clearCookie('refreshToken');
      return successRes({}, 200, 'Signed out!');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Search customers by phone number
   * For market role: only shows customers who have ordered from this market
   * For other roles: shows all matching customers
   */
  async suggestCustomerByPhone(
    user: JwtPayload,
    phone: string,
    market_id?: string,
  ): Promise<object> {
    try {
      if (!phone || phone.length < 3) {
        return successRes([], 200, 'Enter at least 3 digits to search');
      }

      // Clean phone number - remove spaces and special characters
      const cleanPhone = phone.replace(/\D/g, '');

      // Determine which market_id to use
      // For OPERATOR role, use their market_id from the user object
      let effectiveMarketId = market_id;
      if (user.role === Roles.MARKET) {
        effectiveMarketId = user.id;
      }

      if (user.role === Roles.MARKET || effectiveMarketId) {
        // For market role or when market_id is provided:
        // Only show customers who have been linked to this market
        const customers = await this.userRepo
          .createQueryBuilder('customer')
          .leftJoinAndSelect('customer.district', 'district')
          .leftJoinAndSelect('district.region', 'region')
          .innerJoin(
            'customer_market',
            'cm',
            'cm.customer_id = customer.id AND cm.market_id = :marketId',
            { marketId: effectiveMarketId },
          )
          .where('customer.role = :role', { role: Roles.CUSTOMER })
          .andWhere(
            '(customer.phone_number ILIKE :phone OR customer.extra_number ILIKE :phone)',
            { phone: `%${cleanPhone}%` },
          )
          .orderBy('customer.created_at', 'DESC')
          .take(10)
          .getMany();

        return successRes(customers, 200, 'Customer suggestions');
      } else {
        // For admin/superadmin/registrator without market_id:
        // Show all matching customers
        const customers = await this.userRepo
          .createQueryBuilder('customer')
          .leftJoinAndSelect('customer.district', 'district')
          .leftJoinAndSelect('district.region', 'region')
          .where('customer.role = :role', { role: Roles.CUSTOMER })
          .andWhere(
            '(customer.phone_number ILIKE :phone OR customer.extra_number ILIKE :phone)',
            { phone: `%${cleanPhone}%` },
          )
          .orderBy('customer.created_at', 'DESC')
          .take(10)
          .getMany();

        return successRes(customers, 200, 'Customer suggestions');
      }
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Get customer order history
   * For market role: only shows orders from this market
   * For other roles: shows all orders or filtered by market_id
   */
  async getCustomerOrderHistory(
    user: JwtPayload,
    customerId: string,
    market_id?: string,
  ): Promise<object> {
    try {
      // Verify customer exists
      const customer = await this.userRepo.findOne({
        where: { id: customerId, role: Roles.CUSTOMER },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Determine which market_id to use
      const effectiveMarketId =
        user.role === Roles.MARKET ? user.id : market_id;

      // Base query builder for orders
      const baseQb = this.dataSource
        .getRepository(OrderEntity)
        .createQueryBuilder('order')
        .where('order.customer_id = :customerId', { customerId })
        .andWhere('order.deleted_at IS NULL');

      // If market role or market_id provided, filter by market
      if (effectiveMarketId) {
        baseQb.andWhere('order.user_id = :marketId', {
          marketId: effectiveMarketId,
        });
      }

      // Get statistics for ALL orders (not limited)
      const statsQb = baseQb.clone();
      const allOrders = await statsQb
        .select(['order.status', 'order.total_price'])
        .getMany();

      const stats = {
        total: allOrders.length,
        delivered: 0,
        cancelled: 0,
        pending: 0,
        total_spent: 0,
      };

      for (const order of allOrders) {
        if (
          order.status === Order_status.SOLD ||
          order.status === Order_status.PAID
        ) {
          stats.delivered++;
          stats.total_spent += Number(order.total_price) || 0;
        } else if (
          order.status === Order_status.CANCELLED ||
          order.status === Order_status.CANCELLED_SENT
        ) {
          stats.cancelled++;
        } else {
          stats.pending++;
        }
      }

      // Get paginated orders with full details
      const orders = await this.dataSource
        .getRepository(OrderEntity)
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('order.market', 'market')
        .where('order.customer_id = :customerId', { customerId })
        .andWhere('order.deleted_at IS NULL')
        .andWhere(effectiveMarketId ? 'order.user_id = :marketId' : '1=1', {
          marketId: effectiveMarketId,
        })
        .orderBy('order.created_at', 'DESC')
        .getMany();

      // Format the response with order details
      const formattedOrders = orders.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_price: order.total_price,
        created_at: order.created_at,
        sold_at: order.sold_at,
        where_deliver: order.where_deliver,
        market_name: order.market?.name || 'Unknown',
        // Almashtirish pickeri uchun: bu buyurtma allaqachon almashtirishga
        // belgilangan bo'lsa (boshqa yangi buyurtma o'rniga olinmoqda), uni
        // qayta tanlash mumkin emas.
        is_replacement_return: order.is_replacement_return,
        items: order.items.map((item) => ({
          product_name: item.product?.name || 'Unknown product',
          quantity: item.quantity,
        })),
      }));

      return successRes(
        {
          customer: {
            id: customer.id,
            name: customer.name,
            phone_number: customer.phone_number,
            extra_number: customer.extra_number,
            address: customer.address,
            district_id: customer.district_id,
          },
          orders: formattedOrders,
          total_orders: stats.total,
          stats: {
            delivered: stats.delivered,
            cancelled: stats.cancelled,
            pending: stats.pending,
            total_spent: stats.total_spent,
          },
        },
        200,
        'Customer order history',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== LOGIST CRUD ====================

  async createLogist(dto: CreateLogistDto, actor?: JwtPayload): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { password, phone_number, name, salary } = dto;
      let { payment_day } = dto;

      const existUser = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number, role: Not(Roles.CUSTOMER) },
      });
      if (existUser) {
        throw new ConflictException(
          `${phone_number} raqamli foydalanuvchi allaqachon mavjud`,
        );
      }

      if (!payment_day) {
        const dayToPay = Number(
          new Date(Date.now()).toLocaleDateString('uz-UZ').split('.')[0],
        );
        payment_day = dayToPay;
      }

      const hashedPassword = await this.bcrypt.encrypt(password);
      const user = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        password: hashedPassword,
        role: Roles.LOGIST,
      });
      await queryRunner.manager.save(user);

      const userSalary = queryRunner.manager.create(UserSalaryEntity, {
        user_id: user.id,
        salary_amount: salary,
        have_to_pay: salary,
        payment_day,
      });
      await queryRunner.manager.save(userSalary);

      await queryRunner.commitTransaction();

      this.activityLog.log({
        entity_type: 'user',
        entity_id: user.id,
        action: 'created',
        new_value: { name: user.name, role: Roles.LOGIST, salary },
        description: `Logist yaratildi: ${user.name}`,
        user: actor,
      });
      return successRes(user, 201, 'Yangi logist yaratildi');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async allLogists(search?: string): Promise<object> {
    try {
      const where: any = {
        role: Roles.LOGIST,
        is_deleted: false,
      };
      if (search) {
        where.name = ILike(`%${search}%`);
      }

      const logists = await this.userRepo.find({
        where,
        relations: ['salary'],
        order: { created_at: 'DESC' },
      });

      // Har bir logist uchun biriktirilgan regionlarni olish
      const logistsWithRegions = await Promise.all(
        logists.map(async (logist) => {
          const regions = await this.dataSource
            .getRepository(RegionEntity)
            .find({
              where: { logist_id: logist.id },
              select: ['id', 'name', 'sato_code'],
            });
          return { ...logist, regions };
        }),
      );

      return successRes(logistsWithRegions, 200, 'All logists');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateLogist(
    id: string,
    dto: UpdateLogistDto,
    actor?: JwtPayload,
  ): Promise<object> {
    try {
      const { password, ...otherFields } = dto;
      const logist = await this.userRepo.findOne({
        where: { id, role: Roles.LOGIST },
      });
      if (!logist) {
        throw new NotFoundException('Logist topilmadi');
      }

      if (otherFields.phone_number) {
        const isExistPhone = await this.userRepo.findOne({
          where: {
            phone_number: otherFields.phone_number,
            role: Not(Roles.CUSTOMER),
            id: Not(id),
          },
        });
        if (isExistPhone) {
          throw new BadRequestException(
            `${otherFields.phone_number} raqamli foydalanuvchi allaqachon mavjud`,
          );
        }
      }

      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }

      Object.assign(logist, {
        ...otherFields,
        ...(hashedPassword && { password: hashedPassword }),
      });
      await this.userRepo.save(logist);

      this.activityLog.log({
        entity_type: 'user',
        entity_id: logist.id,
        action: 'updated',
        new_value: {
          name: logist.name,
          ...(otherFields.phone_number
            ? { phone_number: otherFields.phone_number }
            : {}),
          ...(password ? { password_changed: true } : {}),
        },
        description: `Logist yangilandi: ${logist.name}${
          password ? ' (parol o\'zgartirildi)' : ''
        }`,
        user: actor,
      });

      // Salary yangilash
      if (
        dto.salary !== undefined ||
        dto.payment_day !== undefined ||
        dto.have_to_pay !== undefined
      ) {
        const salary = await this.dataSource
          .getRepository(UserSalaryEntity)
          .findOne({ where: { user_id: id } });
        if (salary) {
          const beforeSalary = {
            salary_amount: salary.salary_amount,
            have_to_pay: salary.have_to_pay,
            payment_day: salary.payment_day,
          };
          if (dto.salary !== undefined) salary.salary_amount = dto.salary;
          if (dto.payment_day !== undefined)
            salary.payment_day = dto.payment_day;
          if (dto.have_to_pay !== undefined)
            salary.have_to_pay = dto.have_to_pay;
          await this.dataSource.getRepository(UserSalaryEntity).save(salary);
          this.logSalaryChange(id, logist.name, beforeSalary, {
            salary_amount: salary.salary_amount,
            have_to_pay: salary.have_to_pay,
            payment_day: salary.payment_day,
          });
        }
      }

      return successRes({}, 200, 'Logist yangilandi');
    } catch (error) {
      return catchError(error);
    }
  }

  async deleteLogist(id: string, actor?: JwtPayload): Promise<object> {
    try {
      const logist = await this.userRepo.findOne({
        where: { id, role: Roles.LOGIST },
      });
      if (!logist) {
        throw new NotFoundException('Logist topilmadi');
      }

      // Logistga biriktirilgan regionlardan logist_id ni olib tashlash
      await this.dataSource
        .getRepository(RegionEntity)
        .update({ logist_id: id }, { logist_id: null as any });

      logist.is_deleted = true;
      await this.userRepo.save(logist);

      this.activityLog.log({
        entity_type: 'user',
        entity_id: id,
        action: 'deleted',
        old_value: { name: logist.name, role: Roles.LOGIST },
        description: `Logist o'chirildi: ${logist.name}`,
        user: actor,
      });
      return successRes({}, 200, "Logist o'chirildi");
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== OPERATOR CRUD ====================

  async createOperator(
    dto: CreateOperatorDto,
    market: JwtPayload,
  ): Promise<object> {
    try {
      const { password, phone_number, name } = dto;

      const existUser = await this.userRepo.findOne({
        where: { phone_number, is_deleted: false },
      });
      if (existUser) {
        throw new ConflictException(
          `${phone_number} raqamli foydalanuvchi allaqachon mavjud`,
        );
      }

      const hashedPassword = await this.bcrypt.encrypt(password);
      const operator = this.userRepo.create({
        name,
        phone_number,
        password: hashedPassword,
        role: Roles.OPERATOR,
        market_id: market.id,
      });
      await this.userRepo.save(operator);

      this.activityLog.log({
        entity_type: 'user',
        entity_id: operator.id,
        action: 'created',
        new_value: { name: operator.name, role: Roles.OPERATOR },
        description: `Operator yaratildi: ${operator.name}`,
        user: market,
      });
      return successRes(operator, 201, 'Yangi operator yaratildi');
    } catch (error) {
      return catchError(error);
    }
  }

  async getMyOperators(market: JwtPayload): Promise<object> {
    try {
      const operators = await this.userRepo.find({
        where: {
          market_id: market.id,
          role: Roles.OPERATOR,
          is_deleted: false,
        },
        order: { created_at: 'DESC' },
        select: ['id', 'name', 'phone_number', 'status', 'created_at'],
      });
      return successRes(operators, 200, 'Market operatorlari');
    } catch (error) {
      return catchError(error);
    }
  }

  async deleteOperator(id: string, market: JwtPayload): Promise<object> {
    try {
      const operator = await this.userRepo.findOne({
        where: {
          id,
          role: Roles.OPERATOR,
          market_id: market.id,
          is_deleted: false,
        },
      });
      if (!operator) {
        throw new NotFoundException(
          'Operator topilmadi yoki sizga tegishli emas',
        );
      }
      operator.is_deleted = true;
      await this.userRepo.save(operator);
      this.activityLog.log({
        entity_type: 'user',
        entity_id: id,
        action: 'deleted',
        old_value: { name: operator.name, role: Roles.OPERATOR },
        description: `Operator o'chirildi: ${operator.name}`,
        user: market,
      });
      return successRes({}, 200, "Operator o'chirildi");
    } catch (error) {
      return catchError(error);
    }
  }

  async getOperatorStats(id: string, market: JwtPayload): Promise<object> {
    try {
      const operator = await this.userRepo.findOne({
        where: {
          id,
          role: Roles.OPERATOR,
          market_id: market.id,
          is_deleted: false,
        },
      });
      if (!operator) {
        throw new NotFoundException(
          'Operator topilmadi yoki sizga tegishli emas',
        );
      }

      const orderRepo = this.dataSource.getRepository(OrderEntity);

      const orders = await orderRepo.find({
        where: { operator_id: id },
        select: ['id', 'status', 'total_price', 'created_at', 'sold_at'],
        order: { created_at: 'DESC' },
      });

      const total = orders.length;
      const sold = orders.filter((o) =>
        ['sold', 'paid', 'partly_paid', 'closed'].includes(o.status),
      ).length;
      const cancelled = orders.filter((o) =>
        ['cancelled', 'cancelled (sent)'].includes(o.status),
      ).length;
      const pending = total - sold - cancelled;
      const success_rate = total > 0 ? Math.round((sold / total) * 100) : 0;

      const total_revenue = orders
        .filter((o) =>
          ['sold', 'paid', 'partly_paid', 'closed'].includes(o.status),
        )
        .reduce((sum, o) => sum + Number(o.total_price || 0), 0);

      return successRes(
        {
          operator: {
            id: operator.id,
            name: operator.name,
            phone_number: operator.phone_number,
            status: operator.status,
            created_at: operator.created_at,
          },
          stats: {
            total,
            sold,
            cancelled,
            pending,
            success_rate,
            total_revenue,
          },
          recent_orders: orders.slice(0, 20),
        },
        200,
        'Operator statistikasi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== OPERATOR COMMISSION ====================

  async updateOperatorCommission(
    id: string,
    dto: UpdateOperatorCommissionDto,
    market: JwtPayload,
  ): Promise<object> {
    try {
      const operator = await this.userRepo.findOne({
        where: {
          id,
          role: Roles.OPERATOR,
          market_id: market.id,
          is_deleted: false,
        },
      });
      if (!operator) {
        throw new NotFoundException(
          'Operator topilmadi yoki sizga tegishli emas',
        );
      }

      if (dto.commission_type !== undefined)
        operator.commission_type = dto.commission_type;
      if (dto.commission_value !== undefined)
        operator.commission_value = dto.commission_value;
      if (dto.show_earnings !== undefined)
        operator.show_earnings = dto.show_earnings;

      // Komissiya qiymatini turi bo'yicha tekshirish (har order'ga noto'g'ri hisob ketmasligi uchun).
      // PERCENT bo'lsa 0-100 oraliqda; FIXED bo'lsa keskin yuqori chegara qo'yamiz (1 mln so'm),
      // chunki real holatda fixed komissiya bunchalik katta bo'lmaydi.
      if (operator.commission_type && operator.commission_value != null) {
        if (operator.commission_type === Commission_type.PERCENT) {
          if (
            operator.commission_value < 0 ||
            operator.commission_value > 100
          ) {
            throw new BadRequestException(
              "Komissiya foizi 0 dan 100 gacha bo'lishi kerak",
            );
          }
        } else if (operator.commission_type === Commission_type.FIXED) {
          if (
            operator.commission_value < 0 ||
            operator.commission_value > 1_000_000
          ) {
            throw new BadRequestException(
              "Belgilangan komissiya 0 dan 1 000 000 so'mgacha bo'lishi kerak",
            );
          }
        }
      }

      await this.userRepo.save(operator);

      this.activityLog.log({
        entity_type: 'user',
        entity_id: operator.id,
        action: 'commission_changed',
        new_value: {
          name: operator.name,
          commission_type: operator.commission_type,
          commission_value: operator.commission_value,
          show_earnings: operator.show_earnings,
        },
        description: `Operator komissiyasi o'zgardi: ${operator.name}`,
        user: market,
      });

      return successRes(
        {
          id: operator.id,
          commission_type: operator.commission_type,
          commission_value: operator.commission_value,
          show_earnings: operator.show_earnings,
        },
        200,
        'Operator komissiyasi yangilandi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getOperatorBalance(id: string, market: JwtPayload): Promise<object> {
    try {
      const operator = await this.userRepo.findOne({
        where: {
          id,
          role: Roles.OPERATOR,
          market_id: market.id,
          is_deleted: false,
        },
        select: [
          'id',
          'name',
          'phone_number',
          'status',
          'commission_type',
          'commission_value',
          'show_earnings',
        ],
      });
      if (!operator) {
        throw new NotFoundException(
          'Operator topilmadi yoki sizga tegishli emas',
        );
      }

      const earningRepo = this.dataSource.getRepository(OperatorEarningEntity);
      const paymentRepo = this.dataSource.getRepository(OperatorPaymentEntity);

      const earnings = await earningRepo.find({
        where: { operator_id: id },
        order: { created_at: 'DESC' },
      });

      const payments = await paymentRepo.find({
        where: { operator_id: id },
        order: { created_at: 'DESC' },
      });

      const total_earned = earnings.reduce((s, e) => s + Number(e.amount), 0);
      const total_paid = payments.reduce((s, p) => s + Number(p.amount), 0);
      const balance = total_earned - total_paid;

      return successRes(
        {
          operator,
          total_earned,
          total_paid,
          balance,
          payments,
        },
        200,
        'Operator balansi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async payOperator(
    id: string,
    dto: PayOperatorDto,
    market: JwtPayload,
  ): Promise<object> {
    try {
      const operator = await this.userRepo.findOne({
        where: {
          id,
          role: Roles.OPERATOR,
          market_id: market.id,
          is_deleted: false,
        },
      });
      if (!operator) {
        throw new NotFoundException(
          'Operator topilmadi yoki sizga tegishli emas',
        );
      }

      const paymentRepo = this.dataSource.getRepository(OperatorPaymentEntity);
      const payment = paymentRepo.create({
        operator_id: id,
        market_id: market.id,
        paid_by_id: market.id,
        amount: dto.amount,
        note: dto.note ?? null,
      });
      await paymentRepo.save(payment);

      this.activityLog.log({
        entity_type: 'user',
        entity_id: id,
        action: 'salary_paid',
        new_value: {
          amount: dto.amount,
          staff_name: operator.name,
          comment: dto.note ?? undefined,
        },
        description: `Operatorga to'lov: ${operator.name} — ${dto.amount} so'm`,
        user: market,
      });

      return successRes(payment, 201, "To'lov amalga oshirildi");
    } catch (error) {
      return catchError(error);
    }
  }

  async getMyEarnings(
    operator: JwtPayload,
    fromDate?: string,
    toDate?: string,
  ): Promise<object> {
    try {
      const operatorUser = await this.userRepo.findOne({
        where: { id: operator.id, role: Roles.OPERATOR, is_deleted: false },
        select: [
          'id',
          'name',
          'commission_type',
          'commission_value',
          'show_earnings',
        ],
      });
      if (!operatorUser) {
        throw new NotFoundException('Operator topilmadi');
      }
      if (!operatorUser.show_earnings) {
        return successRes({ visible: false }, 200, "Daromad ko'rinmaydi");
      }

      const earningRepo = this.dataSource.getRepository(OperatorEarningEntity);
      const paymentRepo = this.dataSource.getRepository(OperatorPaymentEntity);

      // Sana filter uchun timestamp hisoblash
      let dateFromMs: number | null = null;
      let dateToMs: number | null = null;
      if (fromDate) {
        dateFromMs = new Date(fromDate + 'T00:00:00').getTime();
      }
      if (toDate) {
        dateToMs = new Date(toDate + 'T23:59:59.999').getTime();
      }

      // Earnings query builder
      const earningsQb = earningRepo
        .createQueryBuilder('e')
        .where('e.operator_id = :opId', { opId: operator.id })
        .orderBy('e.created_at', 'DESC');
      if (dateFromMs)
        earningsQb.andWhere('e.created_at >= :from', { from: dateFromMs });
      if (dateToMs)
        earningsQb.andWhere('e.created_at <= :to', { to: dateToMs });
      const earnings = await earningsQb.getMany();

      // Payments query builder
      const paymentsQb = paymentRepo
        .createQueryBuilder('p')
        .where('p.operator_id = :opId', { opId: operator.id })
        .orderBy('p.created_at', 'DESC');
      if (dateFromMs)
        paymentsQb.andWhere('p.created_at >= :from', { from: dateFromMs });
      if (dateToMs)
        paymentsQb.andWhere('p.created_at <= :to', { to: dateToMs });
      const payments = await paymentsQb.getMany();

      // Har bir earning uchun order ma'lumotlarini olish
      const orderRepo = this.dataSource.getRepository(OrderEntity);
      const earningsWithOrders = await Promise.all(
        earnings.map(async (earning) => {
          const order = await orderRepo.findOne({
            where: { id: earning.order_id },
            select: [
              'id',
              'total_price',
              'status',
              'created_at',
              'sold_at',
              'product_quantity',
              'comment',
            ],
            relations: ['customer', 'items', 'items.product'],
          });
          return {
            ...earning,
            order: order
              ? {
                  id: order.id,
                  total_price: order.total_price,
                  status: order.status,
                  created_at: order.created_at,
                  sold_at: order.sold_at,
                  product_quantity: order.product_quantity,
                  customer_name: order.customer?.name || '-',
                  items:
                    order.items?.map((item) => ({
                      name: item.product?.name || '-',
                      quantity: item.quantity,
                    })) || [],
                  is_cancelled: [
                    Order_status.CANCELLED,
                    Order_status.CANCELLED_SENT,
                  ].includes(order.status),
                }
              : null,
          };
        }),
      );

      const total_earned = earnings.reduce((s, e) => s + Number(e.amount), 0);
      const total_paid = payments.reduce((s, p) => s + Number(p.amount), 0);

      // Umumiy balans — barcha vaqt uchun (filter ta'sir qilmaydi)
      const allEarnings = await earningRepo.find({
        where: { operator_id: operator.id },
      });
      const allPayments = await paymentRepo.find({
        where: { operator_id: operator.id },
      });
      const allEarned = allEarnings.reduce((s, e) => s + Number(e.amount), 0);
      const allPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0);
      const balance = allEarned - allPaid;

      return successRes(
        {
          visible: true,
          operator: {
            name: operatorUser.name,
            commission_type: operatorUser.commission_type,
            commission_value: operatorUser.commission_value,
          },
          total_earned,
          total_paid,
          balance,
          earnings: earningsWithOrders,
          payments,
        },
        200,
        'Mening daromadlarim',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // Operator o'z buyurtmalarini ko'rish (pagination bilan)
  async getMyOrders(
    operator: JwtPayload,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<object> {
    try {
      const operatorUser = await this.userRepo.findOne({
        where: { id: operator.id, role: Roles.OPERATOR, is_deleted: false },
        select: [
          'id',
          'name',
          'show_earnings',
          'commission_type',
          'commission_value',
        ],
      });
      if (!operatorUser) {
        throw new NotFoundException('Operator topilmadi');
      }

      const safeLimit = getSafeLimit(limit);
      const skip = (page - 1) * safeLimit;

      const orderRepo = this.dataSource.getRepository(OrderEntity);
      const earningRepo = this.dataSource.getRepository(OperatorEarningEntity);

      // soft-deleted'lar TypeORM tomonidan avtomatik filter qilinadi
      const where: any = {
        operator_id: operator.id,
      };
      if (status) {
        where.status = status;
      }

      const [orders, total] = await orderRepo.findAndCount({
        where,
        relations: [
          'customer',
          'items',
          'items.product',
          'district',
          'district.region',
        ],
        order: { created_at: 'DESC' },
        skip,
        take: safeLimit,
      });

      // Har bir order uchun earning ma'lumotini olish
      const ordersWithEarnings = await Promise.all(
        orders.map(async (order) => {
          let earning: OperatorEarningEntity | null = null;
          if (operatorUser.show_earnings) {
            earning = await earningRepo.findOne({
              where: { order_id: order.id, operator_id: operator.id },
            });
          }

          const isCancelled = [
            Order_status.CANCELLED,
            Order_status.CANCELLED_SENT,
          ].includes(order.status);

          const isSold = [
            Order_status.SOLD,
            Order_status.PAID,
            Order_status.PARTLY_PAID,
            Order_status.CLOSED,
          ].includes(order.status);

          return {
            id: order.id,
            total_price: order.total_price,
            status: order.status,
            product_quantity: order.product_quantity,
            where_deliver: order.where_deliver,
            comment: order.comment,
            created_at: order.created_at,
            sold_at: order.sold_at,
            customer: order.customer
              ? {
                  id: order.customer.id,
                  name: order.customer.name,
                  phone_number: order.customer.phone_number,
                }
              : null,
            district: order.district
              ? {
                  name: order.district.name,
                  region: order.district.region?.name || null,
                }
              : null,
            items:
              order.items?.map((item) => ({
                name: item.product?.name || '-',
                quantity: item.quantity,
              })) || [],
            earning: earning
              ? {
                  amount: earning.amount,
                  is_deducted: isCancelled,
                }
              : null,
            is_sold: isSold,
            is_cancelled: isCancelled,
          };
        }),
      );

      // Statistika (soft-deleted'lar TypeORM tomonidan avtomatik filter qilinadi)
      const allOperatorOrders = await orderRepo.find({
        where: { operator_id: operator.id },
        select: ['id', 'status'],
      });

      const soldStatuses = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
        Order_status.CLOSED,
      ];
      const cancelStatuses = [
        Order_status.CANCELLED,
        Order_status.CANCELLED_SENT,
      ];

      const stats = {
        total: allOperatorOrders.length,
        sold: allOperatorOrders.filter((o) => soldStatuses.includes(o.status))
          .length,
        cancelled: allOperatorOrders.filter((o) =>
          cancelStatuses.includes(o.status),
        ).length,
        pending: 0,
      };
      stats.pending = stats.total - stats.sold - stats.cancelled;

      return successRes(
        {
          orders: ordersWithEarnings,
          stats,
          show_earnings: operatorUser.show_earnings,
          pagination: {
            page,
            limit: safeLimit,
            total,
            total_pages: Math.ceil(total / safeLimit),
          },
        },
        200,
        'Mening buyurtmalarim',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== SALARY CRON ====================

  /**
   * Sanani DOIM Asia/Tashkent bo'yicha hisoblaydi — server lokal TZ (ehtimol UTC)
   * ga tayanmaydi. Aks holda `@Cron` Toshkent 00:05 da otsa-da, ichidagi
   * `new Date().getDate()` server-UTC da bir kun orqada bo'lib, oy/kun chegarasida
   * noto'g'ri davr yoki kun beradi.
   *
   * `period` ('YYYY-MM') idempotentlik kaliti; `currentDay`/`lastDayOfMonth`
   * payment_day mosligi uchun; `oneMonthAgo` "kamida 1 oy ishlagan" filtri uchun.
   */
  private getTashkentSalaryContext() {
    // 'en-CA' locale ISO ko'rinish beradi: "YYYY-MM-DD"
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const [yStr, mStr, dStr] = ymd.split('-');

    const currentYear = Number(yStr);
    const currentMonth = Number(mStr) - 1; // 0-indeksli (Date arifmetikasi uchun)
    const currentDay = Number(dStr);
    const period = `${yStr}-${mStr}`; // 'YYYY-MM'
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // 1 oy oldingi sana (ms) — faqat 1 oydan ortiq ishlagan xodimlarga oylik
    const oneMonthAgo = new Date(
      currentYear,
      currentMonth - 1,
      currentDay,
    ).getTime();

    return { currentYear, currentDay, period, lastDayOfMonth, oneMonthAgo };
  }

  /**
   * Oylik hisoblashning YAGONA o'zagi — CRON ham, startup catch-up ham shuni
   * chaqiradi.
   *
   * Idempotentlik `last_accrued_period` ('YYYY-MM') ustuni orqali. Har qator
   * uchun ATOMIK UPDATE ishlatamiz:
   *   UPDATE ... SET have_to_pay = have_to_pay + salary_amount,
   *                  last_accrued_period = :period
   *   WHERE id = :id
   *     AND (last_accrued_period IS NULL OR last_accrued_period <> :period)
   * Bu bir vaqtda hal qiladi:
   *   - (A) updated_at idempotentlik bug'i — accrual endi `updated_at`ga tegmaydi,
   *         demak avans/tahrir hisoblashni buzmaydi;
   *   - lost-update — read-modify-write emas, DB darajasida atomik qo'shish;
   *   - ikki marta qo'shish — WHERE guard.
   *
   * `mode='cron'`: faqat AYNAN bugungi to'lov kuni (oy oxiri mantig'i bilan).
   * `mode='catchup'`: to'lov kuni shu oyda ALLAQACHON yetib kelgan, lekin hali
   *   bu davr uchun hisoblanmagan qatorlar (restart tufayli o'tkazib yuborilgan
   *   run'ni tiklaydi). Idempotent — qayta ishga tushsa ikki marta qo'shmaydi.
   */
  private async accrueSalaries(mode: 'cron' | 'catchup'): Promise<void> {
    const { currentDay, period, lastDayOfMonth, oneMonthAgo } =
      this.getTashkentSalaryContext();
    const tag = mode === 'cron' ? 'SALARY CRON' : 'SALARY CATCHUP';

    try {
      const salaryRepo = this.dataSource.getRepository(UserSalaryEntity);

      const qb = salaryRepo
        .createQueryBuilder('s')
        .innerJoin('s.user', 'u')
        .where('u.is_deleted = :del', { del: false })
        .andWhere('u.status = :status', { status: Status.ACTIVE })
        .andWhere('s.salary_amount > 0')
        .andWhere('u.role IN (:...allowedRoles)', {
          allowedRoles: [Roles.ADMIN, Roles.REGISTRATOR, Roles.LOGIST],
        })
        // Xodim ishga kirganidan kamida 1 oy o'tgan bo'lishi kerak
        .andWhere('u.created_at <= :oneMonthAgo', { oneMonthAgo })
        // Bu davr (oy) uchun allaqachon hisoblanganlarni oldindan chiqaramiz
        .andWhere(
          '(s.last_accrued_period IS NULL OR s.last_accrued_period <> :period)',
          { period },
        );

      if (mode === 'catchup') {
        // To'lov kuni shu oyda yetib kelganlar (oy oxiri mantig'i bilan):
        // effektiv kun = LEAST(payment_day, oyning oxirgi kuni) <= bugun
        qb.andWhere('LEAST(s.payment_day, :lastDay) <= :day', {
          lastDay: lastDayOfMonth,
          day: currentDay,
        });
      } else if (currentDay === lastDayOfMonth) {
        // Oyning oxirgi kunida: payment_day = bugun YOKI payment_day > oxirgi kun
        qb.andWhere('(s.payment_day = :day OR s.payment_day > :lastDay)', {
          day: currentDay,
          lastDay: lastDayOfMonth,
        });
      } else {
        qb.andWhere('s.payment_day = :day', { day: currentDay });
      }

      const salaries = await qb.getMany();

      if (salaries.length === 0) {
        if (mode === 'cron') {
          this.logger.log(
            `[${tag}] Bugun (${currentDay}-kun, ${period}) uchun oylik to'lanadigan ishchi yo'q`,
          );
        }
        return;
      }

      let updated = 0;
      let skipped = 0;
      let failed = 0;

      for (const salary of salaries) {
        try {
          // ATOMIK + idempotent: WHERE guard ikki marta qo'shishni to'sadi,
          // `have_to_pay + salary_amount` DB darajasida — lost-update yo'q.
          // DIQQAT: QueryBuilder update entity listener'larini (@BeforeUpdate)
          // ishlatmaydi — shu sabab `updated_at` ataylab O'ZGARMAYDI.
          const res = await salaryRepo
            .createQueryBuilder()
            .update(UserSalaryEntity)
            .set({
              have_to_pay: () => 'have_to_pay + salary_amount',
              last_accrued_period: period,
            })
            .where('id = :id', { id: salary.id })
            .andWhere(
              '(last_accrued_period IS NULL OR last_accrued_period <> :period)',
              { period },
            )
            .execute();

          if (res.affected && res.affected > 0) updated++;
          else skipped++;
        } catch (e) {
          // Bitta qator xatosi qolganlarini UZMASIN
          failed++;
          this.logger.error(
            `[${tag}] user_salary ${salary.id} xato: ${e.message}`,
          );
        }
      }

      this.logger.log(
        `[${tag}] ${updated} ta ishchiga oylik qo'shildi, ${skipped} ta o'tkazildi, ${failed} ta xato (${currentDay}-kun, ${period})`,
      );
    } catch (error) {
      this.logger.error(`[${tag}] Xatolik: ${error.message}`, error.stack);
    }
  }

  /**
   * Har kuni soat 00:05 da ishlaydi (Toshkent vaqti).
   * Bugun = payment_day bo'lgan barcha ACTIVE ishchilarning have_to_pay'iga
   * salary_amount qo'shadi.
   *
   * Qoidalar:
   * - Bloklangan (INACTIVE) / o'chirilgan xodimlar uchun oylik hisoblanmaydi
   * - Xodim ishga kirganidan keyin 1 oy to'lmaguncha oylik hisoblanmaydi
   * - Ikki marta qo'shilishdan himoya: `last_accrued_period` ('YYYY-MM') orqali
   */
  @Cron('0 5 0 * * *', { timeZone: 'Asia/Tashkent' })
  async handleMonthlySalary(): Promise<void> {
    await this.accrueSalaries('cron');
  }

  /**
   * Startup catch-up: in-process scheduler (@nestjs/schedule) o'tkazib yuborilgan
   * run'ni TIKLAMAYDI (deploy paytida 00:05'da `systemctl restart` bo'lsa run
   * abadiy yo'qoladi). Bu metod app ko'tarilganda — agar to'lov kuni shu oyda
   * allaqachon yetib kelgan, lekin hali hisoblanmagan ishchilar bo'lsa — ularni
   * tiklaydi. To'liq idempotent: `last_accrued_period` tufayli ikki marta
   * qo'shilmaydi, shuning uchun har restartda xavfsiz ishlaydi.
   */
  async catchUpMissedSalaries(): Promise<void> {
    await this.accrueSalaries('catchup');
  }
}
