import { IsEnum, IsNumber, IsOptional, IsPhoneNumber, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from 'src/common/enums';

export class UpdateInvestorDto {
  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsPhoneNumber('UZ')
  phone_number?: string;

  @ApiPropertyOptional({ example: 'newPassword' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 200000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  committed_amount?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  share_percent?: number;

  @ApiPropertyOptional({ enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
