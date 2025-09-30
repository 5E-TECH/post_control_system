import { successRes } from './../../infrastructure/lib/response/index';
import { CashboxHistoryEntity } from './../../core/entity/cashbox-history.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCashboxHistoryDto } from './dto/create-cashbox-history.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { catchError } from 'src/infrastructure/lib/response';

@Injectable()
export class CashboxHistoryService {
  constructor(
    @InjectRepository(CashboxHistoryEntity)
    private readonly cashboxRepo: Repository<CashboxHistoryEntity>,
  ) {}

  async create(createCashboxHistoryDto: CreateCashboxHistoryDto) {
    try {
      const cashboxHistory = this.cashboxRepo.create({
        ...createCashboxHistoryDto,
      });
      const savedCashboxHistory = await this.cashboxRepo.save(cashboxHistory);
      return successRes(savedCashboxHistory);
    } catch (error) {
      return catchError(error.message);
    }
  }

  async findAll() {
    try {
      const cashboxHistories = await this.cashboxRepo.find();
      return successRes(cashboxHistories);
    } catch (error) {
      return catchError(error.message);
    }
  }

  async findOne(id: string) {
    try {
      const cashboxHistory = await this.cashboxRepo.findOne({
        where: { id },
        relations: ['cashbox', 'createdByUser', 'order'],
      });
      if (!cashboxHistory) {
        throw new NotFoundException('CashboxHistory not found by id: ', id);
      }
      return successRes(cashboxHistory, 200, 'Cashbox by id');
    } catch (error) {
      return catchError(error.message);
    }
  }
}
