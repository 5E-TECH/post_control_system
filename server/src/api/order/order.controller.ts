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

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get()
  findAll() {
    return this.orderService.findAllWithPagination();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('market/:id')
  newOrdersByMarketId(@Param('id') id: string) {
    return this.orderService.newOrdersByMarketId(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOneById(id);
  }

  // Get my orders Market yoki Kurier uchun

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch(':id')
  editOrder(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.editOrder(id, updateOrderDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('receive')
  receiveNewOrders(@Body() ordersArray: OrdersArrayDto) {
    return this.orderService.receiveNewOrders(ordersArray);
  }

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
