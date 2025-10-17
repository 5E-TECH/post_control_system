import { Status } from 'src/common/enums';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'Akmal Abdullaev' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ example: 'newSecret123' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ enum: Status, example: 'ACTIVE' })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
