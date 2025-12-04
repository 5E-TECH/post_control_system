import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from 'src/core/entity/product.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { BotModule } from '../bots/notify-bot/bot.module';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';

@Module({
  imports: [
    BotModule, // 👈 Bot bilan ishlash uchun faqat shu kerak
    TypeOrmModule.forFeature([
      ProductEntity,
      UserEntity,
      OrderEntity,
      TelegramEntity,
    ]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
