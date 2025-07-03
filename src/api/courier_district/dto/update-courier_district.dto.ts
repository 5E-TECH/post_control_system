import { PartialType } from '@nestjs/swagger';
import { CreateCourierDistrictDto } from './create-courier_district.dto';

export class UpdateCourierDistrictDto extends PartialType(CreateCourierDistrictDto) {}
