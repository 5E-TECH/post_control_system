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
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateOrderDto } from '../order/dto/create-order.dto';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET, Roles.REGISTRATOR)
  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.createCustomer(createCustomerDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET, Roles.REGISTRATOR)
  @Post(':id/order')
  createOrder(@Param('id') id: string, @Body() createOrderDto: CreateOrderDto) {
    return this.customerService.createOrder(id, createOrderDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.REGISTRATOR, Roles.ADMIN, Roles.SUPERADMIN)
  @Get()
  findAll() {
    return this.customerService.findAll();
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('my-customers')
  allMyCustomers(@CurrentUser() user: JwtPayload) {
    return this.customerService.findByMarketId(user);
  }

  // @Patch(':id')
  // update(
  //   @CurrentUser() user: JwtPayload,
  //   @Param('id') id: string,
  //   @Body() updateCustomerDto: UpdateCustomerDto,
  // ) {
  //   return this.customerService.update(user, id, updateCustomerDto);
  // }
}
