import { Status } from 'src/common/enums';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCourierDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  region_id?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
