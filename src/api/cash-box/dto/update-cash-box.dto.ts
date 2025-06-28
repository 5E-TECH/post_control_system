import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCashBoxDto } from './create-cash-box.dto';

export class UpdateCashBoxDto extends PartialType(CreateCashBoxDto) {
    @ApiProperty({
        type:Number,
        example:1_000_000
    })
    balance:number
}
