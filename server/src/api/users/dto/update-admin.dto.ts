import { Roles, Status } from 'src/common/enums';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
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
}
