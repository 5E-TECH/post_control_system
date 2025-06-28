import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class SignInUserDto {
    @ApiProperty({
        type:String,
        example:"+998905234382"
    })
    @IsString()
    @IsNotEmpty()
    phone_number:string;

    @ApiProperty({
        type:String,
        example:"0990"
    })
    @IsString()
    @IsNotEmpty()
    password:string;
}
