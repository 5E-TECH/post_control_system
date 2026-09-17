import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CourierRegionEntity } from 'src/core/entity/courier-region.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { ElchiCargoModule } from '../elchi-cargo/elchi-cargo.module';
import { LdgCargoModule } from '../ldg-cargo/ldg-cargo.module';
import { BotModule } from '../bots/notify-bot/bot.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

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
    ElchiCargoModule,
    BotModule,
    // ⚠️ Oraliq statuslarni (yo'lda / kuryerda) marketplace'ga yetkazish
    // uchun. `PostModule` `OrderService` ni provider QILMAYDI, shuning
    // uchun B10 dublikat-provider tuzog'i bu yerda yuzaga kelmaydi.
    MarketplaceModule,
  ],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
