import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PaymentsFromCourierService } from './payments-from-courier.service';
import { CreatePaymentsFromCourierDto } from './dto/create-payments-from-courier.dto';
import { UpdatePaymentsFromCourierDto } from './dto/update-payments-from-courier.dto';

@Controller('payments-from-courier')
export class PaymentsFromCourierController {
  constructor(private readonly paymentsFromCourierService: PaymentsFromCourierService) {}

  @Post()
  create(@Body() createPaymentsFromCourierDto: CreatePaymentsFromCourierDto) {
    return this.paymentsFromCourierService.create(createPaymentsFromCourierDto);
  }

  @Get()
  findAll() {
    return this.paymentsFromCourierService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsFromCourierService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentsFromCourierDto: UpdatePaymentsFromCourierDto) {
    return this.paymentsFromCourierService.update(+id, updatePaymentsFromCourierDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentsFromCourierService.remove(+id);
  }
}
