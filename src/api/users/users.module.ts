import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { UserService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';

@Module({
  imports:[TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UserService, BcryptEncryption],
})
export class UsersModule {}
