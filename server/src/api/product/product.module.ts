import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from 'src/core/entity/product.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [
    BotModule, // 👈 Bot bilan ishlash uchun faqat shu kerak
    TypeOrmModule.forFeature([ProductEntity, UserEntity, OrderEntity]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
