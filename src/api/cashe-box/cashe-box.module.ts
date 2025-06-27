import { Module } from '@nestjs/common';
import { CasheBoxService } from './cashe-box.service';
import { CasheBoxController } from './cashe-box.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasheEntity } from 'src/core/entity/cashe-box.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CasheEntity])],
  controllers: [CasheBoxController],
  providers: [CasheBoxService],
})
export class CasheBoxModule {}
