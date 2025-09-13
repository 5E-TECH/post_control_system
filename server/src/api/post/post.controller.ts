import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PostService } from './post.service';
import { SendPostDto } from './dto/send-post.dto';
import { ReceivePostDto } from './dto/receive-post.dto';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { OrdersArrayDto } from '../order/dto/orders-array.dto';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get()
  findAll() {
    return this.postService.findAll();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('new')
  newPosts() {
    return this.postService.newPosts();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('rejected')
  rejectedPosts() {
    return this.postService.newPosts();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('on-the-road')
  onTheRoadPosts(@CurrentUser() user: JwtPayload) {
    return this.postService.onTheRoadPosts(user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('courier/:id')
  getCouriersByPostId(@Param('id') id: string) {
    return this.postService.findAllCouriers(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('orders/:id')
  getAllOrdersByPostId(@Param('id') id: string) {
    return this.postService.getPostsOrders(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Patch(':id')
  sendPost(@Param('id') id: string, @Body() orderIdsDto: SendPostDto) {
    return this.postService.sendPost(id, orderIdsDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Patch(':id')
  receivePost(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() receivePostDto: ReceivePostDto,
  ) {
    return this.postService.receivePost(user, id, receivePostDto);
  }

  @Post()
  canceledPost(
    @CurrentUser() user: JwtPayload,
    @Body() ordersArrayDto: OrdersArrayDto,
  ) {
    return this.postService.createCanceledPost(user, ordersArrayDto);
  }

  @Post()
  receiveCanceledPost(
    @Param('id') id: string,
    @Body() ordersArrayDto: OrdersArrayDto,
  ) {
    return this.postService.receiveCanceledPost(id, ordersArrayDto);
  }
}
