import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateCasheBoxDto } from './dto/create-cashe-box.dto';
import { UpdateCasheBoxDto } from './dto/update-cashe-box.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CasheEntity } from 'src/core/entity/cashe-box.entity';
import { CasheRepository } from 'src/core/repository/cashe.box.repository';
import { BADFLAGS } from 'dns';
import { catchError } from 'rxjs';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { DeepPartial } from 'typeorm';

@Injectable()
export class CasheBoxService
  extends BaseService<CreateCasheBoxDto, DeepPartial<CasheEntity>>
  implements OnModuleInit
{
  constructor(
    @InjectRepository(CasheEntity) private casheRepository: CasheRepository,
  ) {
    super(casheRepository);
  }

  async onModuleInit() {
    try {
      const existsCashe = await this.casheRepository.find();

      if (existsCashe.length == 0) {
        const cashe = this.casheRepository.create({
          balance: 0,
        });
        await this.casheRepository.save(cashe);
        console.log('Initial cashe created');
      }
    } catch (error) {
      return catchError(error);
    }
  }
}
