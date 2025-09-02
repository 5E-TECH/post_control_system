import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class ReceivePostDto {
  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true })
  order_ids: string[];
}
