import { IsNotEmpty, IsUUID } from 'class-validator';

export class OrderDto {
  @IsNotEmpty()
  @IsUUID()
  marketId: string;
}
