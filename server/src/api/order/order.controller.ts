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
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
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
import { OrderDto } from './dto/orderId.dto';
import { CreateOrderByBotDto } from './dto/create-order-bot.dto';
import { UpdateOrderAddressDto } from './dto/update-order-address.dto';
import { ReceiveExternalOrdersDto } from './dto/receive-external-orders.dto';

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
  createOrder(
    @Body() creteOrderDto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orderService.createOrder(creteOrderDto, user);
  }

  @ApiOperation({ summary: 'List orders with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'marketId', required: false })
  @ApiQuery({ name: 'regionId', required: false })
  @ApiQuery({ name: 'courierId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    example: '2025-09-01 yoki 2025-09-01T00:00:00',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    example: '2025-09-01 yoki 2025-09-01T00:00:00',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Orders list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get()
  findAll(
    @Query('status') status?: string | string[],
    @Query('marketId') marketId?: string,
    @Query('regionId') regionId?: string,
    @Query('courierId') courierId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('fetchAll') fetchAll?: string,
  ) {
    return this.orderService.allOrders({
      status,
      marketId,
      regionId,
      courierId,
      search,
      startDate,
      endDate,
      page,
      limit,
      fetchAll,
    });
  }

  @ApiOperation({ summary: 'Markets with new orders' })
  @ApiResponse({ status: 200, description: 'List of markets with new orders' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('markets/new-orders')
  haveNewOrdersMarket(@Query('search') search?: string) {
    return this.orderService.haveNewOrderMarkets(search);
  }

  @ApiOperation({ summary: 'My new orders (market)' })
  @ApiResponse({
    status: 200,
    description: 'List of new orders for current market',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('market/my-new-orders')
  myNewOrders(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.orderService.myNewOrders(user, search, page, limit);
  }

  @ApiOperation({ summary: 'New orders by market id' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'New orders for the market' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('market/:id')
  newOrdersByMarketId(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.orderService.newOrdersByMarketId(id, search, page, limit);
  }

  @ApiOperation({ summary: 'Get order by id' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order data' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(
    Roles.ADMIN,
    Roles.SUPERADMIN,
    Roles.COURIER,
    Roles.MARKET,
    Roles.REGISTRATOR,
  )
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @ApiOperation({ summary: 'Get order by QR code' })
  @ApiParam({ name: 'id', description: 'Order TOKEN' })
  @ApiResponse({ status: 200, description: 'Order data' })
  // @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(
    Roles.ADMIN,
    Roles.SUPERADMIN,
    Roles.COURIER,
    Roles.MARKET,
    Roles.REGISTRATOR,
  )
  @Get('qr-code/:token')
  findByQR(@Param('token') token: string) {
    return this.orderService.findByQrCode(token);
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
    return this.orderService.updateOrder(id, updateOrderDto);
  }

  @ApiOperation({ summary: 'Update order delivery address' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: UpdateOrderAddressDto })
  @ApiResponse({ status: 200, description: 'Order address updated' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @Patch(':id/address')
  updateOrderAddress(
    @Param('id') id: string,
    @Body() updateOrderAddressDto: UpdateOrderAddressDto,
  ) {
    return this.orderService.updateOrderAddress(id, updateOrderAddressDto);
  }

  @ApiOperation({ summary: 'Receive new orders' })
  @ApiBody({ type: OrdersArrayDto })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Orders received' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('receive')
  receiveNewOrders(
    @Body() ordersArray: OrdersArrayDto,
    @Query('search') search?: string,
  ) {
    return this.orderService.receiveNewOrders(ordersArray, search);
  }

  @ApiOperation({ summary: 'Receive external orders (from Adosh, etc.)' })
  @ApiBody({ type: ReceiveExternalOrdersDto })
  @ApiResponse({ status: 201, description: 'External orders received and created' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('receive/external')
  receiveExternalOrders(
    @Body() dto: ReceiveExternalOrdersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orderService.receiveExternalOrders(dto, user);
  }

  @ApiOperation({ summary: 'Receive new order by scaner' })
  @ApiResponse({ status: 200, description: 'Orders received' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('receive/:id')
  receiveOrderWithScaner(@Param('id') id: string, @Body() orderDto: OrderDto) {
    return this.orderService.receiveWithScaner(id, orderDto);
  }

  @ApiOperation({
    summary: 'All orders for market with search/filter/pagination',
  })
  @ApiResponse({ status: 200, description: 'All orders for current market' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('market/all/my-orders')
  allMarketsOrders(
    @CurrentUser() user: JwtPayload,
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      regionId?: string;
      status?: string | string[];
      startDate?: string;
      endDate?: string;
      fetchAll?: string | boolean;
    },
  ) {
    return this.orderService.allMarketsOrders(user, query);
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
    @Query('status') status: string | string[],
    @Query('search') search: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('fetchAll') fetchAll: string,
  ) {
    return this.orderService.allCouriersOrders(user, {
      status,
      search,
      page,
      limit,
      startDate,
      endDate,
      fetchAll,
    });
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
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER, Roles.SUPERADMIN)
  @Post('rollback/:id')
  rollbackOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
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

  @ApiOperation({ summary: 'Delete order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order partly sold' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.orderService.remove(id);
  }

  @ApiOperation({ summary: 'Create order by telegram bot' })
  @ApiBody({ type: CreateOrderByBotDto })
  @ApiResponse({ status: 201, description: 'Order created by bot' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.OPERATOR)
  @Post('telegram/bot/create')
  botOrderCreate(
    @Body() body: CreateOrderByBotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orderService.createOrderByBot(body, user);
  }

  @ApiOperation({ summary: 'Export orders to Excel (streaming)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'marketId', required: false })
  @ApiQuery({ name: 'regionId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Excel file stream' })
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @Get('export/excel')
  async exportOrdersToExcel(
    @Res() res: Response,
    @Query('status') status?: string | string[],
    @Query('marketId') marketId?: string,
    @Query('regionId') regionId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.orderService.exportOrdersToExcel(res, {
      status,
      marketId,
      regionId,
      search,
      startDate,
      endDate,
    });
  }
}
