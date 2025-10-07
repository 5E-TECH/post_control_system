import { PartialType } from '@nestjs/swagger';
import { CreatePrinterDto } from './create-printer.dto';

export class UpdatePrinterDto extends PartialType(CreatePrinterDto) {}
