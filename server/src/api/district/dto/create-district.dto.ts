import { ApiProperty } from "@nestjs/swagger";

export class CreateDistrictDto {
    @ApiProperty({type:String, example:"Yangi Namangan"})
    name:string;

    region_id:string
}
