import { PartialType } from '@nestjs/swagger';
import { CreateCashboxHistoryDto } from './create-cashbox-history.dto';

export class UpdateCashboxHistoryDto extends PartialType(CreateCashboxHistoryDto) {}
