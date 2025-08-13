import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PostService } from './post.service';
import { SendPostDto } from './dto/send-post.dto';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  findAll() {
    return this.postService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @Get('courier/:id')
  getCouriersByPostId(@Param('id') id: string) {
    return this.postService.findAllCouriers(id);
  }

  @Patch(':id')
  sendPost(@Param('id') id: string, @Body() orderIdsDto: SendPostDto) {
    return this.postService.sendPost(id, orderIdsDto);
  }
}
