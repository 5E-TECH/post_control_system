import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateOrderAddressDto {
  @ApiPropertyOptional({
    description: 'District ID for delivery address',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID(4, { message: "Tuman ID noto'g'ri formatda" })
  district_id?: string;

  @ApiPropertyOptional({
    description: 'Delivery address',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Client name',
    example: 'Ali Valiyev',
  })
  @IsOptional()
  @IsString()
  client_name?: string;

  @ApiPropertyOptional({
    description: 'Client phone number',
    example: '+998901234567',
  })
  @IsOptional()
  @IsString()
  client_phone_number?: string;
}
