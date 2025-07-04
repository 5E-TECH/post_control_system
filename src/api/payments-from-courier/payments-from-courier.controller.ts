import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PaymentsFromCourierService } from './payments-from-courier.service';
import { CreatePaymentsFromCourierDto } from './dto/create-payments-from-courier.dto';
import { UpdatePaymentsFromCourierDto } from './dto/update-payments-from-courier.dto';
import { UserDecorator } from 'src/common/decorator/user.decorator';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('payments-from-courier')
export class PaymentsFromCourierController {
  constructor(private readonly paymentsFromCourierService: PaymentsFromCourierService) {}

  @UseGuards(JwtGuard)
  @Post()
  create(
    @UserDecorator() user: any,
    @Body() createPaymentsFromCourierDto: CreatePaymentsFromCourierDto) {
    return this.paymentsFromCourierService.create(user, createPaymentsFromCourierDto);
  }

  @Get()
  findAll() {
    return this.paymentsFromCourierService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsFromCourierService.findOne(id);
  }
}
