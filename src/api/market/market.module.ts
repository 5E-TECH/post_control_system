import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketEntity } from 'src/core/entity/market.entity';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';

@Module({
  imports: [TypeOrmModule.forFeature([MarketEntity])],
  controllers: [MarketController],
  providers: [MarketService, BcryptEncryption],
})
export class MarketModule {}
