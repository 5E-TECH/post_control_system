import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Roles } from 'src/common/enums';
import config from 'src/config';
import { UserEntity } from 'src/core/entity/users.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { catchError, successRes } from 'src/infrastructure/lib/response';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) private adminRepo: Repository<UserEntity>,
    private readonly bcrypt: BcryptEncryption
  ) {}

  async onModuleInit() {
    try {
      const isSuperAdmin = await this.adminRepo.findOne({
        where: { role: Roles.SUPERADMIN },
      });

      if (!isSuperAdmin) {
        const hashedPassword = await this.bcrypt.encrypt(config.ADMIN_PASSWORD);
        const superAdminthis = this.adminRepo.create({
          first_name: config.ADMIN_FIRSTNAME,
          last_name: config.ADMIN_LASTRNAME,
          phone_number: config.ADMIN_PHONE_NUMBER,
          password: hashedPassword,
          role: Roles.SUPERADMIN,
        });
        await this.adminRepo.save(superAdminthis);
      }
    } catch (error) {
      throw new InternalServerErrorException(error, error?.message)
    }
  }

  async create(createUserDto: CreateUserDto) {
    try {      
      const {password, phone_number, first_name, last_name } = createUserDto;
      const exists_Phone_number = await this.adminRepo.findOne({
        where: { phone_number},
      });
      if (exists_Phone_number) {
        throw new ConflictException(`username already exists: ${phone_number}`);
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const admin = this.adminRepo.create({
        first_name, 
        last_name,
        phone_number,
        password: hashedPassword,
      });
      await this.adminRepo.save(admin);
      return successRes(admin, 201);
    } catch (error) {
      return catchError(error);
    }
  }

  async findAll() {
    try {
      const admin = await this.adminRepo.find();
      return successRes(admin);
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string) {
    try {
      const admin = await this.adminRepo.findOne({ where: { id } });
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
      const admin = await this.adminRepo.findOne({ where: { id } });
      if (!admin) {
        throw new NotFoundException(`admin not fount by id: ${id}}`);
      }
      if (updateUserDto.phone_number) {
        const exists_Phone_number = await this.adminRepo.findOne({
          where: { phone_number: updateUserDto.phone_number },
        });
        if (exists_Phone_number) {
          throw new ConflictException(
            `username already exists: ${updateUserDto.phone_number}`,
          );
        }
      } else if (updateUserDto.phone_number) {
        const exists_Phone_number = await this.adminRepo.findOne({
          where: { phone_number: updateUserDto.phone_number },
        });
        if (exists_Phone_number) {
          throw new ConflictException(
            `email already exists: ${updateUserDto.phone_number}`,
          );
        }
      }
      await this.adminRepo.update({ id }, updateUserDto);
      const updatedAdmin = await this.adminRepo.findOne({ where: { id } });
      return successRes(updatedAdmin);
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string) {
    try {
      const admin = await this.adminRepo.findOne({ where: { id } });
      if (!admin) {
        throw new NotFoundException(`admin not fount by id: ${id}}`);
      } else if (admin.role == Roles.SUPERADMIN) {
        throw new ConflictException(
          "You're stupid, you can't delete super admin",
        );
      }

      await this.adminRepo.delete({ id });
      return successRes({});
    } catch (error) {
      return catchError(error);
    }
  }
}
