import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cashbox_type, Roles, Status } from 'src/common/enums';
import config from 'src/config';
import { UserEntity } from 'src/core/entity/users.entity';
import { CreateCourierDto } from './dto/create-courier.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { SignInUserDto } from './dto/signInUserDto';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { writeToCookie } from 'src/infrastructure/lib/write-to-cookie/writeToCookie';
import { Response } from 'express';
import { UserRepository } from 'src/core/repository/user.repository';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { DataSource, DeepPartial, In, Not } from 'typeorm';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
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

@Injectable()
export class UserService {
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
    private readonly dataSource: DataSource,
  ) {}

  // Test for CI/CD

  async onModuleInit() {
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
      return catchError(error);
    }
  }

  async createAdmin(createAdminDto: CreateAdminDto): Promise<object> {
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
      console.log('payment date: ', payment_day);
      await queryRunner.manager.save(admin);
      const adminSalary = queryRunner.manager.create(UserSalaryEntity, {
        user_id: admin.id,
        salary_amount: salary,
        have_to_pay: salary,
        payment_day,
      });

      await queryRunner.manager.save(adminSalary);
      await queryRunner.commitTransaction();
      return successRes(admin, 201, 'New Admin created');
    } catch (error) {
      console.log(error);

      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createRegistrator(createAdminDto: CreateAdminDto): Promise<object> {
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
      return successRes(user, 201, 'New Admin created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createCourier(createCourierDto: CreateCourierDto): Promise<object> {
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
      } = createCourierDto;

      const existUser = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number },
      });
      if (existUser) {
        throw new ConflictException(
          `User with ${phone_number} number already exists`,
        );
      }
      const isExistRegion = await queryRunner.manager.findOne(RegionEntity, {
        where: { id: region_id },
      });
      if (!isExistRegion) {
        throw new NotFoundException('Region not found');
      }

      const hashedPassword = await this.bcrypt.encrypt(password);
      const courier = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        password: hashedPassword,
        region_id,
        tariff_center,
        tariff_home,
        role: Roles.COURIER,
      } as DeepPartial<UserEntity>);
      await queryRunner.manager.save(courier);

      const cashbox = queryRunner.manager.create(CashEntity, {
        cashbox_type: Cashbox_type.FOR_COURIER,
        user_id: courier.id,
      });
      await queryRunner.manager.save(cashbox);

      await queryRunner.commitTransaction();
      return successRes(courier, 201, `New courier created`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createMarket(createMarketDto: CreateMarketDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { name, phone_number, tariff_center, tariff_home, password } =
        createMarketDto;
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
        password: hashedPassword,
        telegram_token,
      });
      await queryRunner.manager.save(newMarket);
      const cashbox = queryRunner.manager.create(CashEntity, {
        cashbox_type: Cashbox_type.FOR_MARKET,
        user_id: newMarket.id,
      });
      await queryRunner.manager.save(cashbox);

      await queryRunner.commitTransaction();
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
  ): Promise<Object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { name, phone_number, district_id, address } = createCustomerDto;
      if (!createCustomerDto.market_id) {
        if (user.role !== Roles.MARKET) {
          throw new BadRequestException('Market not choosen');
        } else {
          createCustomerDto.market_id = user.id;
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

      const district = await queryRunner.manager.findOne(DistrictEntity, {
        where: { id: district_id },
      });
      if (!district) {
        throw new NotFoundException('District not found');
      }

      const isExistClient = await queryRunner.manager.findOne(UserEntity, {
        where: {
          phone_number,
          role: Roles.CUSTOMER,
          district_id: createCustomerDto.district_id,
        },
        relations: ['customerLinks', 'customerLinks.market'],
      });

      let assignedToMarket: boolean = false;
      if (isExistClient) {
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
        // await queryRunner.commitTransaction();
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

      const customer = queryRunner.manager.create(UserEntity, {
        name,
        phone_number,
        role: Roles.CUSTOMER,
        district_id,
        address,
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
  }): Promise<object> {
    try {
      const { search, status, role, page = 1, limit = 10 } = filters;

      const qb = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.region', 'region')
        .where('user.role NOT IN (:...excludedRoles)', {
          excludedRoles: [Roles.CUSTOMER],
        });

      // 🔎 Search: name yoki phone_number bo‘yicha qisman qidirish
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

      // 🎯 Role filter
      if (role) {
        qb.andWhere('user.role = :role', { role });
      }

      const [users, total] = await qb
        .orderBy('user.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
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
    limit: number = 10,
  ): Promise<object> {
    try {
      const query = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.cashbox', 'cashbox')
        .where('user.role = :role', { role: Roles.MARKET })
        .select([
          'user.id',
          'user.name',
          'user.phone_number',
          'user.status',
          'user.created_at',
          'user.add_order',
          'cashbox', // cashboxni to‘liq olish uchun
        ]);

      if (search) {
        query.andWhere(
          '(user.name ILIKE :search OR user.phone_number ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 🟢 Pagination
      const skip = (page - 1) * limit;
      query.skip(skip).take(limit);

      const [data, total] = await query.getManyAndCount();

      return successRes(
        {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        200,
        'All markets',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async allCouriers(): Promise<object> {
    try {
      const allCouriers = await this.userRepo.find({
        where: { role: Roles.COURIER },
        select: ['id', 'name', 'phone_number', 'status', 'created_at'],
        relations: ['cashbox', 'region'],
      });
      return successRes(allCouriers, 200, 'All markets');
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
      const myProfile = await this.userRepo.findOne({ where: { id } });
      return successRes(myProfile, 200, 'Profile info');
    } catch (error) {
      return catchError(error);
    }
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
      // Phone number oldin ro'yxatdan o'tganmi yoki yo'qligini tekshirish
      if (otherFields.phone_number) {
        const existPhone = await this.userRepo.findOne({
          where: { phone_number: otherFields.phone_number },
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

      Object.assign(user, {
        ...otherFields,
        ...(hashedPassword && { password: hashedPassword }),
      });
      await this.userRepo.save(user);

      const updatedUser = await this.userRepo.findOne({ where: { id } });
      return successRes(updatedUser, 200, 'User updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateRegistrator(id: string, updateRegistratorDto: UpdateAdminDto) {
    try {
      const { password, ...otherFields } = updateRegistratorDto;
      const registrator = await this.userRepo.findOne({
        where: { id, role: Roles.REGISTRATOR },
      });
      if (!registrator) {
        throw new NotFoundException('Registrator not found');
      }
      if (otherFields.phone_number) {
        const isExistPhone = await this.userRepo.findOne({
          where: { phone_number: otherFields.phone_number },
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
      Object.assign(registrator, {
        ...otherFields,
        ...(hashedPassword && { password: hashedPassword }),
      });
      await this.userRepo.save(registrator);

      return successRes({}, 200, 'Registrator updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateCourier(
    id: string,
    updateCourierDto: UpdateCourierDto,
  ): Promise<object> {
    try {
      const { password, ...otherFields } = updateCourierDto;

      const courier = await this.userRepo.findOne({
        where: { id, role: Roles.COURIER },
      });
      if (!courier) {
        throw new NotFoundException('User not found');
      }

      // Update qilganda telefon nomer databasada bor yoki yo'qligini tekshirish
      if (otherFields.phone_number) {
        const existUser = await this.userRepo.findOne({
          where: { phone_number: otherFields.phone_number },
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

      const updatedUser = await this.userRepo.findOne({ where: { id } });
      return successRes(updatedUser, 200, 'User updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateMarket(
    id: string,
    updateMarketDto: UpdateMarketDto,
  ): Promise<object> {
    try {
      const { password, ...otherFields } = updateMarketDto;
      const market = await this.userRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market nottt found');
      }

      if (otherFields.phone_number) {
        const isExistPhoneNumber = await this.userRepo.findOne({
          where: { phone_number: otherFields.phone_number },
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

      return successRes(updatedMarket, 200, 'Market updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateCustomerNamePhone(
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<Object> {
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
  ): Promise<Object> {
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

      if (dto.district_id) {
        const district = await queryRunner.manager.findOne(DistrictEntity, {
          where: { id: dto.district_id },
        });
        if (!district) throw new NotFoundException('District not found');
        customer.district_id = dto.district_id;
      }

      if (dto.address) customer.address = dto.address;

      await queryRunner.manager.save(customer);

      await queryRunner.commitTransaction();
      return successRes(customer, 200, 'Customer updated (district/address)');
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
          where: { phone_number: otherFields.phone_number },
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
      return successRes(updatedUser, 200, 'User updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string): Promise<object> {
    try {
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException('User not fount');
      }
      if (user.role === Roles.SUPERADMIN) {
        throw new BadRequestException('Super admin can not be deleted!');
      }
      await this.userRepo.delete({ id });
      return successRes({}, 200, 'User deleted');
    } catch (error) {
      return catchError(error);
    }
  }

  async signInUser(signInDto: SignInUserDto, res: Response): Promise<object> {
    try {
      const { phone_number, password } = signInDto;

      const user = await this.userRepo.findOne({
        where: { phone_number, role: Not(Roles.CUSTOMER) },
      });
      if (!user) {
        throw new BadRequestException('Phone number or password incorrect');
      }
      if (user.status === Status.INACTIVE) {
        throw new BadRequestException('You have been blocked by superadmin');
      }
      const IsMatchPassword = await this.bcrypt.compare(
        password,
        user?.password,
      );
      if (!IsMatchPassword) {
        throw new BadRequestException('Phone number or password incorrect');
      }
      const { id, role, status } = user;
      const payload: JwtPayload = { id, role, status };
      const accessToken = await this.token.generateAccessToken(payload);
      const refreshToken = await this.token.generateRefreshToken(payload);
      writeToCookie(res, 'refreshToken', refreshToken);
      return successRes(
        { access_token: accessToken, refresh_token: refreshToken },
        200,
        'Logged in successfully',
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
}
