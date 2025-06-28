import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCasheBoxDto } from './create-cashe-box.dto';

export class UpdateCasheBoxDto extends PartialType(CreateCasheBoxDto) {
    @ApiProperty({
        type:Number,
        example:1_000_000
    })
    balance:number
}
