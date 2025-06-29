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

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) private userRepo: AdminRepository,
    @InjectRepository(CashEntity) private cashRepo: CashRepository,
    private readonly bcrypt: BcryptEncryption,
    private readonly token: Token,
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
          last_name: config.ADMIN_LASTRNAME,
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

  async createAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, phone_number, first_name, last_name } = createUserDto;
      const exists_Phone_number = await this.userRepo.findOne({
        where: { phone_number },
      });
      if (exists_Phone_number) {
        throw new ConflictException(
          `phone number already exists: ${phone_number}`,
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
      return successRes(admin, 201);
    } catch (error) {
      return catchError(error);
    }
  }

  async createCourier(createUserDto: CreateUserDto) {
    try {
      const { password, phone_number, first_name, last_name } = createUserDto;
      const exists_Phone_number = await this.userRepo.findOne({
        where: { phone_number },
      });
      if (exists_Phone_number) {
        throw new ConflictException(
          `phone number already exists: ${phone_number}`,
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const courier = this.userRepo.create({
        first_name,
        last_name,
        phone_number,
        password: hashedPassword,
        role: Roles.COURIER,
      });
      const cashbox = this.cashRepo.create({
        cashbox_type: Cashbox_type.FOR_COURIER,
        user_id: courier.id,
      });
      await this.userRepo.save(courier);
      await this.cashRepo.save(cashbox);
      return successRes(courier, 201, 'New courier created');
    } catch (error) {
      return catchError(error);
    }
  }

  async createRegistrator(createUserDto: CreateUserDto) {
    try {
      const { password, phone_number, first_name, last_name } = createUserDto;
      const exists_Phone_number = await this.userRepo.findOne({
        where: { phone_number },
      });
      if (exists_Phone_number) {
        throw new ConflictException(
          `phone number already exists: ${phone_number}`,
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const admin = this.userRepo.create({
        first_name,
        last_name,
        phone_number,
        password: hashedPassword,
        role: Roles.REGISTRATOR,
      });
      await this.userRepo.save(admin);
      return successRes(admin, 201);
    } catch (error) {
      return catchError(error);
    }
  }

  async findAllAdmin() {
    try {
      const admin = await this.userRepo.find({
        where: { role: Roles.ADMIN && Roles.SUPERADMIN },
      });
      return successRes(admin);
    } catch (error) {
      return catchError(error);
    }
  }

  async findAllCourier() {
    try {
      const admin = await this.userRepo.find({
        where: { role: Roles.COURIER },
      });
      return successRes(admin);
    } catch (error) {
      return catchError(error);
    }
  }

  async findAllRegistrator() {
    try {
      const admin = await this.userRepo.find({
        where: { role: Roles.REGISTRATOR },
      });
      return successRes(admin);
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string) {
    try {
      const admin = await this.userRepo.findOne({ where: { id } });
      if (!admin) {
        throw new NotFoundException(`admin not fount by id: ${id}}`);
      }
      return successRes(admin);
    } catch (error) {
      return catchError(error);
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const admin = await this.userRepo.findOne({ where: { id } });
      if (!admin) {
        throw new NotFoundException(`admin not fount by id: ${id}}`);
      }
      if (updateUserDto.phone_number) {
        const exists_Phone_number = await this.userRepo.findOne({
          where: { phone_number: updateUserDto.phone_number },
        });
        if (exists_Phone_number) {
          throw new ConflictException(
            `phone_number already exists: ${updateUserDto.phone_number}`,
          );
        }
      }
      await this.userRepo.update({ id }, updateUserDto);
      const updatedAdmin = await this.userRepo.findOne({ where: { id } });
      return successRes(updatedAdmin);
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string) {
    try {
      const admin = await this.userRepo.findOne({ where: { id } });
      if (!admin) {
        throw new NotFoundException(`admin not fount by id: ${id}}`);
      } else if (admin.role == Roles.SUPERADMIN) {
        throw new ConflictException(
          "You're stupid, you can't delete super admin",
        );
      }

      await this.userRepo.delete({ id });
      return successRes({});
    } catch (error) {
      return catchError(error);
    }
  }

  async signInUser(
    signInAdminDto: SignInUserDto,
    res: Response,
  ): Promise<object> {
    try {
      console.log('salom');

      const { phone_number, password } = signInAdminDto;

      const user = await this.userRepo.findOne({ where: { phone_number } });
      if (!user) {
        throw new BadRequestException('emial or password incorrect');
      } else if (user.status == Status.INACTIVE) {
        throw new BadRequestException('user not found');
      }
      const ISMatchPassword = await this.bcrypt.compare(
        password,
        user?.password,
      );
      if (!ISMatchPassword) {
        throw new BadRequestException('emial or password incorrect');
      }
      const { id, role } = user;
      const payload = { id, role };
      const accessToken = await this.token.generateAccessToken(payload);
      const refreshToken = await this.token.generateRefreshToken(payload);
      writeToCookie(res, 'refreshToken', refreshToken);
      return successRes(accessToken);
    } catch (error) {
      return catchError(error);
    }
  }

  async signOut(res: Response): Promise<object> {
    try {
      res.clearCookie('refreshToken');

      return {
        statusCode: 200,
        message: 'Successfully signed out',
      };
    } catch (error) {
      return catchError(error);
    }
  }
}
