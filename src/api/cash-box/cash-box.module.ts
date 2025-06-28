import { Module } from '@nestjs/common';
import { CasheBoxService } from './cash-box.service';
import { CasheBoxController } from './cash-box.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashEntity])],
  controllers: [CasheBoxController],
  providers: [CasheBoxService],
})
export class CashBoxModule {}
