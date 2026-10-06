import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketReturnHandoverSessionEntity } from 'src/core/entity/market-return-handover-session.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { BotModule } from '../bots/notify-bot/bot.module';
import { MarketHandoverCron } from './market-handover.cron';
import { MarketHandoverController } from './market-handover.controller';
import { MarketHandoverService } from './market-handover.service';

/**
 * BEKOR QAYTARISHNI MARKETGA TOPSHIRISH moduli (2-bosqich).
 *
 * 1-bosqich (viloyatdan markazga qabul) ataylab `PostModule`/`OrderModule`
 * da qoladi — u mavjud pochta oqimining bir qismi va mexanikasi o'zgarmadi.
 * Bu modul faqat YOPISHNI (market ruxsati) boshqaradi, shuning uchun
 * `OrderService` ga bog'liq emas va sikl hosil qilmaydi.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketReturnHandoverSessionEntity,
      OrderEntity,
      // Ro'yxatlarda «qanday mahsulot bekor bo'lgan» ustuni uchun.
      OrderItemEntity,
      UserEntity,
    ]),
    ActivityLogModule,
    // Marketga «olib keting» eslatmasi uchun (`BotService`).
    BotModule,
  ],
  controllers: [MarketHandoverController],
  providers: [MarketHandoverService, MarketHandoverCron],
  exports: [MarketHandoverService],
})
export class MarketHandoverModule {}
