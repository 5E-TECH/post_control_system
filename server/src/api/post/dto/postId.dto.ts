import { IsNotEmpty, IsUUID } from 'class-validator';

export class PostDto {
  @IsNotEmpty()
  @IsUUID()
  postId: string;
}
