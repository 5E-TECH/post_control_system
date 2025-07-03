import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cashbox_type, Roles, Status } from 'src/common/enums';
import config from 'src/config';
import { UserEntity } from 'src/core/entity/users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { SignInUserDto } from './dto/signInUserDto';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { writeToCookie } from 'src/infrastructure/lib/write-to-cookie/writeToCookie';
import { Response } from 'express';
import { AdminRepository } from 'src/core/repository/user.repository';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { DataSource, Not } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) private userRepo: AdminRepository,
    @InjectRepository(CashEntity) private cashRepo: CashRepository,
    private readonly bcrypt: BcryptEncryption,
    private readonly token: Token,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      const isSuperAdmin = await this.userRepo.findOne({
        where: { role: Roles.SUPERADMIN },
      });

      if (!isSuperAdmin) {
        const hashedPassword = await this.bcrypt.encrypt(config.ADMIN_PASSWORD);
        const superAdminthis = this.userRepo.create({
          first_name: config.ADMIN_FIRSTNAME,
          last_name: config.ADMIN_LASTNAME,
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

  async createAdmin(createUserDto: CreateUserDto): Promise<object> {
    try {
      const { password, phone_number, first_name, last_name } = createUserDto;
      const existAdmin = await this.userRepo.findOne({
        where: { phone_number },
      });
      if (existAdmin) {
        throw new ConflictException(
          `Admin with ${phone_number} number already exists`,
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const admin = this.userRepo.create({
        first_name,
        last_name,
        phone_number,
        password: hashedPassword,
        role: Roles.ADMIN,
      });
      await this.userRepo.save(admin);
      return successRes(admin, 201, 'New Admin created');
    } catch (error) {
      return catchError(error);
    }
  }

  async createStaff(createUserDto: CreateUserDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { password, phone_number, first_name, last_name, role } =
        createUserDto;
      if (role === Roles.ADMIN) {
        throw new BadRequestException('Unacceptable role');
      }
      const existUser = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number },
      });
      if (existUser) {
        throw new ConflictException(
          `User with ${phone_number} number already exists`,
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const staff = queryRunner.manager.create(UserEntity, {
        first_name,
        last_name,
        phone_number,
        password: hashedPassword,
        role,
      });
      await queryRunner.manager.save(staff);

      if (role === Roles.COURIER) {
        const cashbox = queryRunner.manager.create(CashEntity, {
          cashbox_type: Cashbox_type.FOR_COURIER,
          user_id: staff.id,
        });
        await queryRunner.manager.save(cashbox);
      }
      await queryRunner.commitTransaction();
      return successRes(staff, 201, `New ${role} created`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async allUsers(): Promise<object> {
    try {
      const allUsers = await this.userRepo.find({
        where: { role: Not(Roles.SUPERADMIN) },
      });
      return successRes(allUsers, 200, 'All users');
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

  async profile(user: any): Promise<object> {
    try {
      const { id } = user;
      const myProfile = await this.userRepo.findOne({ where: { id } });
      return successRes(myProfile, 200, 'Profile info');
    } catch (error) {
      return catchError(error);
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<object> {
    try {
      const { password, ...otherFields } = updateUserDto;
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (otherFields.phone_number) {
        const existsPhoneNumber = await this.userRepo.findOne({
          where: { phone_number: otherFields.phone_number },
        });
        if (existsPhoneNumber) {
          throw new ConflictException(
            `User with ${otherFields.phone_number} number already exists`,
          );
        }
      }
      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }
      await this.userRepo.update(
        { id },
        { ...otherFields, ...(hashedPassword && { password: hashedPassword }) },
      );
      const updatedUser = await this.userRepo.findOne({ where: { id } });
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

      const user = await this.userRepo.findOne({ where: { phone_number } });
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
      const payload = { id, role, status };
      const accessToken = await this.token.generateAccessToken(payload);
      const refreshToken = await this.token.generateRefreshToken(payload);
      writeToCookie(res, 'refreshToken', refreshToken);
      return successRes(accessToken, 200, 'Logged in successfully');
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
