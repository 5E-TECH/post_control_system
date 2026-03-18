import { Injectable } from '@nestjs/common';
import { CashBoxService } from '../cash-box/cash-box.service';
import { CashboxHistoryService } from '../cashbox-history/cashbox-history.service';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { CreatePaymentsFromCourierDto } from '../cash-box/dto/payments-from-courier.dto';
import { PaymentsToMarketDto } from '../cash-box/dto/payment-to-market.dto';
import { UpdateCashBoxDto } from '../cash-box/dto/update-cash-box.dto';
import { CreateCashboxHistoryDto } from '../cashbox-history/dto/create-cashbox-history.dto';
import { Cashbox_type, Operation_type, Source_type } from 'src/common/enums';

@Injectable()
export class FinanceService {
  constructor(
    private readonly cashBoxService: CashBoxService,
    private readonly cashboxHistoryService: CashboxHistoryService,
  ) {}

  getMainCashbox(fromDate?: string, toDate?: string) {
    return this.cashBoxService.getMainCashbox({ fromDate, toDate });
  }

  getCashboxByUserId(id: string, fromDate?: string, toDate?: string) {
    return this.cashBoxService.getCashboxByUserId(id, { fromDate, toDate });
  }

  myCashbox(user: JwtPayload, fromDate?: string, toDate?: string) {
    return this.cashBoxService.myCashbox(user, { fromDate, toDate });
  }

  paymentsFromCourier(
    user: JwtPayload,
    paymentFromCourierDto: CreatePaymentsFromCourierDto,
  ) {
    return this.cashBoxService.paymentsFromCourier(user, paymentFromCourierDto);
  }

  paymentsToMarket(user: JwtPayload, paymentToMarketDto: PaymentsToMarketDto) {
    return this.cashBoxService.paymentsToMarket(user, paymentToMarketDto);
  }

  allCashboxesInfo(filters?: {
    operationType?: Operation_type;
    sourceType?: Source_type;
    createdBy?: string;
    cashboxType?: Cashbox_type;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    return this.cashBoxService.allCashboxesTotal(filters);
  }

  financialBalance() {
    return this.cashBoxService.financialBalance();
  }

  spendMoney(user: JwtPayload, updateCashboxDto: UpdateCashBoxDto) {
    return this.cashBoxService.spendMoney(user, updateCashboxDto);
  }

  fillCashbox(user: JwtPayload, updateCashboxDto: UpdateCashBoxDto) {
    return this.cashBoxService.fillTheCashbox(user, updateCashboxDto);
  }

  createHistory(createCashboxHistoryDto: CreateCashboxHistoryDto) {
    return this.cashboxHistoryService.create(createCashboxHistoryDto);
  }

  getAllHistory() {
    return this.cashboxHistoryService.findAll();
  }

  getHistoryById(id: string) {
    return this.cashboxHistoryService.findOne(id);
  }
}
