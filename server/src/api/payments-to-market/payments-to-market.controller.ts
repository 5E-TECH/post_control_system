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
import { PaymentsToMarketService } from './payments-to-market.service';
import { CreatePaymentsToMarketDto } from './dto/create-payments-to-market.dto';
import { UpdatePaymentsToMarketDto } from './dto/update-payments-to-market.dto';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorator/user.decorator';

@Controller('payments-to-market')
export class PaymentsToMarketController {
  constructor(
    private readonly paymentsToMarketService: PaymentsToMarketService,
  ) {}

  @UseGuards(JwtGuard)
  @Post()
  create(
    @CurrentUser() user: any,
    @Body() createPaymentsToMarketDto: CreatePaymentsToMarketDto,
  ) {
    return this.paymentsToMarketService.create(user, createPaymentsToMarketDto);
  }

  @Get()
  findAll() {
    return this.paymentsToMarketService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsToMarketService.findOne(id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updatePaymentsToMarketDto: UpdatePaymentsToMarketDto) {
  //   return this.paymentsToMarketService.update(+id, updatePaymentsToMarketDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.paymentsToMarketService.remove(+id);
  // }
}
