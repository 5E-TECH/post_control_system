import { PartialType } from '@nestjs/swagger';
import { CreatePaymentsFromCourierDto } from './create-payments-from-courier.dto';

export class UpdatePaymentsFromCourierDto extends PartialType(CreatePaymentsFromCourierDto) {}
