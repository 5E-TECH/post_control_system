import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketEntity } from 'src/core/entity/market.entity';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { CashEntity } from 'src/core/entity/cash-box.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketEntity, CashEntity])],
  controllers: [MarketController],
  providers: [MarketService, BcryptEncryption, Token],
})
export class MarketModule {}
