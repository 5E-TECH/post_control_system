import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Roles, Status } from 'src/common/enums';
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

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) private userRepo: AdminRepository,
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
      throw new InternalServerErrorException(error, error?.message);
    }
  }

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, phone_number, first_name, last_name } = createUserDto;
      const exists_Phone_number = await this.userRepo.findOne({
        where: { phone_number },
      });
      if (exists_Phone_number) {
        throw new ConflictException(`username already exists: ${phone_number}`);
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const admin = this.userRepo.create({
        first_name,
        last_name,
        phone_number,
        password: hashedPassword,
      });
      await this.userRepo.save(admin);
      return successRes(admin, 201);
    } catch (error) {
      throw new InternalServerErrorException(error, error?.message);
    }
  }

  async findAll() {
    try {
      const admin = await this.userRepo.find();
      return successRes(admin);
    } catch (error) {
      throw new InternalServerErrorException(error, error?.message);
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
      throw new InternalServerErrorException(error, error?.message);
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
            `username already exists: ${updateUserDto.phone_number}`,
          );
        }
      } else if (updateUserDto.phone_number) {
        const exists_Phone_number = await this.userRepo.findOne({
          where: { phone_number: updateUserDto.phone_number },
        });
        if (exists_Phone_number) {
          throw new ConflictException(
            `email already exists: ${updateUserDto.phone_number}`,
          );
        }
      }
      await this.userRepo.update({ id }, updateUserDto);
      const updatedAdmin = await this.userRepo.findOne({ where: { id } });
      return successRes(updatedAdmin);
    } catch (error) {
      throw new InternalServerErrorException(error, error?.message);
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
      throw new InternalServerErrorException(error, error?.message);
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
      return {
        StatusCode: 200,
        message: 'success',
        token: accessToken,
      };
    } catch (error) {
      throw new InternalServerErrorException(error, error?.message);
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
