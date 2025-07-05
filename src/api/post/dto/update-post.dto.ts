import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @ApiProperty({
    type: [String],
    required: false,
    description: 'Agar kerak bolsa yangilanishi kerak bolgan order ID lar',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  orderIDs?: string[];
}
