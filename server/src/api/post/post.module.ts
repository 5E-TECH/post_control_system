import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CourierRegionEntity } from 'src/core/entity/courier-region.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { LdgCargoModule } from '../ldg-cargo/ldg-cargo.module';
import { BotModule } from '../bots/notify-bot/bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PostEntity,
      OrderEntity,
      UserEntity,
      CourierRegionEntity,
      RegionEntity,
    ]),
    LdgCargoModule,
    BotModule,
  ],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
