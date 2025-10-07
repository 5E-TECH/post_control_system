import { IsArray, IsNotEmpty } from 'class-validator';

export class CreatePrinterDto {
  @IsArray()
  @IsNotEmpty()
  orderIds: string[];
}
