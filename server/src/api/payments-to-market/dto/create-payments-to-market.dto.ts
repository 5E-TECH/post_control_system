import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class CreatePaymentsToMarketDto {

    @ApiProperty({
        type: String
    })
    @IsNotEmpty()
    @IsUUID()
    market_id: string;

    @ApiProperty({
        type: Number
    })
    @IsNotEmpty()
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({
        type: String
    })
    @IsOptional()
    @IsString()
    payment_date?: string;

    @ApiPropertyOptional({
        type: String
    })
    @IsOptional()
    @IsString()
    comment?: string;
}
