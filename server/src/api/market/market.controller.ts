import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  UseGuards,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { LoginMarketDto } from './dto/login-market.dto';
import { Response } from 'express';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SelfGuard } from 'src/common/guards/self.guard';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { UpdateOwnMarketDto } from './dto/update-own.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  // @UseGuards(JwtGuard, RolesGuard)
  // @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  // @Post()
  // create(@Body() createMarketDto: CreateMarketDto) {
  //   return this.marketService.createMarket(createMarketDto);
  // }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get()
  findAll() {
    return this.marketService.findAll();
  }

  @UseGuards(JwtGuard, RolesGuard, SelfGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.MARKET)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketService.findOne(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch('update/:id')
  update(@Param('id') id: string, @Body() updateMarketDto: UpdateMarketDto) {
    return this.marketService.update(id, updateMarketDto);
  }

  @UseGuards(JwtGuard, RolesGuard, SelfGuard)
  @AcceptRoles(Roles.MARKET)
  @Patch('update/me/:id')
  updateMe(
    @Param('id') id: string,
    @Body() updateOwnMarketDto: UpdateOwnMarketDto,
  ) {
    return this.marketService.updateMe(id, updateOwnMarketDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketService.remove(id);
  }

  @Post('signin')
  loginMarket(
    @Body() loginMarketDto: LoginMarketDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.marketService.marketLogin(loginMarketDto, res);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('profile')
  profile(@CurrentUser() user: JwtPayload) {
    return this.marketService.profile(user);
  }
  @UseGuards(JwtGuard)
  @Post('signout')
  async logoutMarket(@Res({ passthrough: true }) res: Response) {
    return this.marketService.signOut(res);
  }
}
