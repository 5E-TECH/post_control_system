import { ApiProperty } from "@nestjs/swagger";

export class SignInUserDto {
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
