import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { UserService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CourierRegionEntity } from 'src/core/entity/courier-region.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, CashEntity, CourierRegionEntity]),
  ],
  controllers: [UsersController],
  providers: [UserService, BcryptEncryption, Token],
})
export class UsersModule {}
