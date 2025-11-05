import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
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
import { PostDto } from './dto/postId.dto';

@ApiTags('Posts')
@ApiBearerAuth()
@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @ApiOperation({ summary: 'List all posts (with pagination)' })
  @ApiResponse({ status: 200, description: 'Paginated posts list' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get()
  findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 8) {
    return this.postService.findAll(Number(page), Number(limit));
  }

  @ApiOperation({ summary: 'List new posts' })
  @ApiResponse({ status: 200, description: 'New posts list' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('new')
  newPosts() {
    return this.postService.newPosts();
  }

  @ApiOperation({ summary: 'List rejected posts' })
  @ApiResponse({ status: 200, description: 'Rejected posts list' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('rejected')
  rejectedPosts() {
    return this.postService.rejectedPosts();
  }

  @ApiOperation({ summary: 'Courier on-the-road posts' })
  @ApiResponse({ status: 200, description: 'On-the-road posts for courier' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('on-the-road')
  onTheRoadPosts(@CurrentUser() user: JwtPayload) {
    return this.postService.onTheRoadPosts(user);
  }

  @ApiOperation({ summary: 'Courier old posts' })
  @ApiResponse({ status: 200, description: 'Old posts for courier' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('courier/old-posts')
  courierOldPosts(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 8,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.postService.oldPostsForCourier(
      Number(page),
      Number(limit),
      user,
    );
  }

  @ApiOperation({ summary: 'Courier rejected posts' })
  @ApiResponse({ status: 200, description: 'Rejected posts for courier' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('courier/rejected')
  couriersRejectedPosts(@CurrentUser() user: JwtPayload) {
    return this.postService.rejectedPostsForCourier(user);
  }

  @ApiOperation({ summary: 'Get post by id' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post data' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @ApiOperation({ summary: 'Get couriers by post id' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Couriers for post' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('courier/:id')
  getCouriersByPostId(@Param('id') id: string) {
    return this.postService.findAllCouriers(id);
  }

  @ApiOperation({ summary: 'Get all orders by post id' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Orders for post' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get('orders/:id')
  getAllOrdersByPostId(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.postService.getPostsOrders(id, user);
  }

  @ApiOperation({ summary: 'Get rejected orders by post id' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Rejected orders for post' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get('orders/rejected/:id')
  getAllRejectedOrdersByPostId(@Param('id') id: string) {
    return this.postService.getRejectedPostsOrders(id);
  }

  @ApiOperation({ summary: 'Send post (assign orders to post)' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post sent' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Patch(':id')
  sendPost(@Param('id') id: string, @Body() orderIdsDto: SendPostDto) {
    return this.postService.sendPost(id, orderIdsDto);
  }

  @ApiOperation({
    summary: 'Check post (check the order that is exist or not in the post)',
  })
  @ApiParam({ name: 'id', description: 'Order QR token' })
  @ApiResponse({ status: 200, description: 'Order checked' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('check/:id')
  checkPost(@Param('id') id: string, @Body() postIdDto: PostDto) {
    return this.postService.checkPost(id, postIdDto);
  }

  @ApiOperation({ summary: 'Receive post (courier)' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post received' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Patch('receive/:id')
  receivePost(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() receivePostDto: ReceivePostDto,
  ) {
    return this.postService.receivePost(user, id, receivePostDto);
  }

  @ApiOperation({ summary: 'Receive post with scaner (courier)' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post received' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Patch('receive/scan/:id')
  receivePostWithScan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.postService.receivePostWithScanner(user, id);
  }

  @ApiOperation({ summary: 'Receive order (courier)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order received' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Patch('receive/order/:id')
  receive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.postService.receiveOrderWithScanerCourier(user, id);
  }

  @ApiOperation({ summary: 'Create canceled post (courier)' })
  @ApiResponse({ status: 201, description: 'Canceled post created' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Post('cancel')
  canceledPost(
    @CurrentUser() user: JwtPayload,
    @Body() ordersArrayDto: OrdersArrayDto,
  ) {
    return this.postService.createCanceledPost(user, ordersArrayDto);
  }

  @ApiOperation({ summary: 'Receive canceled post (admin)' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Canceled post received' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Post('cancel/receive/:id')
  receiveCanceledPost(
    @Param('id') id: string,
    @Body() ordersArrayDto: OrdersArrayDto,
  ) {
    return this.postService.receiveCanceledPost(id, ordersArrayDto);
  }
}
