import { Roles, Status } from 'src/common/enums';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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

  @ApiPropertyOptional({
    enum: [Roles.ADMIN, Roles.REGISTRATOR],
    description: 'Faqat superadmin admin<->registrator o\'zgartira oladi',
  })
  @IsOptional()
  @IsIn([Roles.ADMIN, Roles.REGISTRATOR])
  role?: Roles.ADMIN | Roles.REGISTRATOR;

  @ApiPropertyOptional({ example: 3000000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  payment_day?: number;

  @ApiPropertyOptional({ example: -2000000, description: 'Boshlang\'ich oylik qoldiq (manfiy = qarz)' })
  @IsOptional()
  @IsNumber()
  have_to_pay?: number;
}
