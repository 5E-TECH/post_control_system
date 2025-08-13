import { PartialType } from '@nestjs/swagger';
import { CreatePaymentsToMarketDto } from './create-payments-to-market.dto';

export class UpdatePaymentsToMarketDto extends PartialType(CreatePaymentsToMarketDto) {}
