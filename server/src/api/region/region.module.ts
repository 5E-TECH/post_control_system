import { Module } from '@nestjs/common';
import { RegionService } from './region.service';
import { RegionController } from './region.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegionEntity } from 'src/core/entity/region.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegionEntity,
      PostEntity,
      OrderEntity,
      UserEntity,
      DistrictEntity,
    ]),
  ],
  controllers: [RegionController],
  providers: [RegionService],
})
export class RegionModule {}
