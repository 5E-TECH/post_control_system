import { Injectable } from '@nestjs/common';
import { CreateCashboxHistoryDto } from './dto/create-cashbox-history.dto';
import { UpdateCashboxHistoryDto } from './dto/update-cashbox-history.dto';

@Injectable()
export class CashboxHistoryService {
  create(createCashboxHistoryDto: CreateCashboxHistoryDto) {
    try {
      
    } catch (error) {
      
    }
  }

  findAll() {
    return `This action returns all cashboxHistory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cashboxHistory`;
  }

  update(id: number, updateCashboxHistoryDto: UpdateCashboxHistoryDto) {
    return `This action updates a #${id} cashboxHistory`;
  }

  remove(id: number) {
    return `This action removes a #${id} cashboxHistory`;
  }
}
