import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
    @ApiProperty({
        type: String,
        example:"Dilshod"
    })
    first_name:string;

    @ApiProperty({
        type:String,
        example:"Urozov"
    })
    last_name:string;

    @ApiProperty({
        type:String,
        example:"+998905234382"
    })
    phone_number:string;

    @ApiProperty({
        type:String,
        example:"0990"
    })
    password:string;
}
