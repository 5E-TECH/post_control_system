import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDistrictDto {
  @IsOptional()
  @IsUUID()
  assigned_region: string;
}
