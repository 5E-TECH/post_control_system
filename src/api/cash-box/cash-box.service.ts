import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateCashBoxDto } from './dto/create-cash-box.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { catchError } from 'rxjs';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { DeepPartial } from 'typeorm';

@Injectable()
export class CashBoxService
  extends BaseService<CreateCashBoxDto, DeepPartial<CashEntity>>
  implements OnModuleInit
{
  constructor(
    @InjectRepository(CashEntity) private cashRepository: CashRepository,
  ) {
    super(cashRepository);
  }

  async onModuleInit() {
    try {
      const existsCashe = await this.cashRepository.find();

      if (existsCashe.length == 0) {
        const cashe = this.cashRepository.create({
          balance: 0,
        });
        await this.cashRepository.save(cashe);
        console.log('Initial cashe created');
      }
    } catch (error) {
      return catchError(error);
    }
  }
}
