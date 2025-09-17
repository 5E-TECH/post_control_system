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
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/enums';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { OrdersArrayDto } from './dto/orders-array.dto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { SellCancelOrderDto } from './dto/sellCancel-order.dto';
import { PartlySoldDto } from './dto/partly-sold.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Create order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiBody({ type: CreateOrderDto })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR, Roles.MARKET)
  @Post()
  createOrder(@Body() creteOrderDto: CreateOrderDto) {
    return this.orderService.createOrder(creteOrderDto);
  }

  @ApiOperation({ summary: 'List orders with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'marketId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Orders list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('marketId') marketId?: string,
    @Query('search') search?: string,
  ) {
    return this.orderService.allOrders({ status, marketId, search });
  }

  @ApiOperation({ summary: 'Markets with new orders' })
  @ApiResponse({ status: 200, description: 'List of markets with new orders' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('markets/new-orders')
  haveNewOrdersMarket() {
    return this.orderService.haveNewOrderMarkets();
  }

  @ApiOperation({ summary: 'My new orders (market)' })
  @ApiResponse({ status: 200, description: 'List of new orders for current market' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('market/my-new-orders')
  myNewOrders(@CurrentUser() user: JwtPayload) {
    return this.orderService.myNewOrders(user);
  }

  @ApiOperation({ summary: 'New orders by market id' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'New orders for the market' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('market/:id')
  newOrdersByMarketId(@Param('id') id: string) {
    return this.orderService.newOrdersByMarketId(id);
  }

  @ApiOperation({ summary: 'Get order by id' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order data' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOneById(id);
  }

  // Get my orders Market yoki Kurier uchun

  @ApiOperation({ summary: 'Edit order by id' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: UpdateOrderDto })
  @ApiResponse({ status: 200, description: 'Order updated' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch(':id')
  editOrder(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.editOrder(id, updateOrderDto);
  }

  @ApiOperation({ summary: 'Receive new orders' })
  @ApiBody({ type: OrdersArrayDto })
  @ApiResponse({ status: 200, description: 'Orders received' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('receive')
  receiveNewOrders(@Body() ordersArray: OrdersArrayDto) {
    return this.orderService.receiveNewOrders(ordersArray);
  }

  @ApiOperation({ summary: 'All orders for market' })
  @ApiResponse({ status: 200, description: 'All orders for current market' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('market/all-orders')
  allMarketsOrders(@CurrentUser() user: JwtPayload) {
    return this.orderService.allMarketsOrders(user);
  }

  @ApiOperation({ summary: "Courier's orders" })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: "Courier's orders list" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('courier/orders')
  getCouriersOrders(
    @CurrentUser() user: JwtPayload,
    @Query('status') status: string,
    @Query('search') search: string,
  ) {
    return this.orderService.allCouriersOrders(user, { status, search });
  }

  @ApiOperation({ summary: 'Sell order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: SellCancelOrderDto })
  @ApiResponse({ status: 200, description: 'Order sold' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Post('sell/:id')
  sellOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() sellDto: SellCancelOrderDto,
  ) {
    return this.orderService.sellOrder(user, id, sellDto);
  }

  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: SellCancelOrderDto })
  @ApiResponse({ status: 200, description: 'Order canceled' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Post('cancel/:id')
  cancelOrder(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
    @Body() cancelDto: SellCancelOrderDto,
  ) {
    return this.orderService.cancelOrder(currentUser, id, cancelDto);
  }

  @ApiOperation({ summary: 'Rollback order to waiting' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order rolled back' })
  @UseGuards()
  @AcceptRoles(Roles.COURIER)
  @Post('rollback/:id')
  rollbackOrder(@CurrentUser() user: JwtPayload, @Param() id: string) {
    return this.orderService.rollbackOrderToWaiting(user, id);
  }

  @ApiOperation({ summary: 'Partly sell order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: PartlySoldDto })
  @ApiResponse({ status: 200, description: 'Order partly sold' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Post('partly-sell/:id')
  partlySell(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
    @Body() partlySellDto: PartlySoldDto,
  ) {
    return this.orderService.partlySold(currentUser, id, partlySellDto);
  }
}
