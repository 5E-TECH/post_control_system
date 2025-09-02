import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from 'src/core/entity/product.entity';
import { MarketEntity } from 'src/core/entity/market.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, MarketEntity])],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
