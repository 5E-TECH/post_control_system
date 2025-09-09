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
  SetMetadata,
} from '@nestjs/common';
import { UserService } from './users.service';
import { CreateCourierDto } from './dto/create-courier.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import { SignInUserDto } from './dto/signInUserDto';
import { Response } from 'express';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { SelfGuard } from 'src/common/guards/self.guard';
import { UpdateSelfDto } from './dto/self-update.dto';
import { CreateMarketDto } from './dto/create-market.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateMarketDto } from './dto/update-market.dto';

@Controller('user')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Post('admin')
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.userService.createAdmin(createAdminDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('registrator')
  createRegistrator(@Body() createRegistratorDto: CreateAdminDto) {
    return this.userService.createRegistrator(createRegistratorDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('courier')
  createCourier(@Body() createCourierDto: CreateCourierDto) {
    return this.userService.createCourier(createCourierDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('market')
  createMarket(@Body() createMarketDto: CreateMarketDto) {
    return this.userService.createMarket(createMarketDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.MARKET)
  @Post('customer')
  createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return this.userService.createCustomer(createCustomerDto);
  }

  @Post('signin')
  async signIn(
    @Body() signInuser: SignInUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.signInUser(signInuser, res);
  }

  @UseGuards(JwtGuard)
  @Post('signout')
  async signOut(@Res({ passthrough: true }) res: Response) {
    return this.userService.signOut(res);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get()
  findAllUsers() {
    return this.userService.allUsers();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(
    Roles.SUPERADMIN,
    Roles.ADMIN,
    Roles.COURIER,
    Roles.REGISTRATOR,
    Roles.MARKET,
  )
  @Get('profile')
  profile(@CurrentUser() user: JwtPayload) {
    return this.userService.profile(user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Patch('admin/:id')
  updateAdmin(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.userService.updateAdmin(id, updateAdminDto, currentUser);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch('registrator/:id')
  updateRegistrator(
    @Param('id') id: string,
    @Body() updateRegisDto: UpdateAdminDto,
  ) {
    return this.userService.updateRegistrator(id, updateRegisDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('courier/:id')
  updateCourier(
    @Param('id') id: string,
    @Body() updateCourierDto: UpdateCourierDto,
  ) {
    return this.userService.updateCourier(id, updateCourierDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('market/:id')
  updateMarket(
    @Param('id') id: string,
    @Body() updateMarketDto: UpdateMarketDto,
  ) {
    return this.userService.updateMarket(id, updateMarketDto);
  }

  @UseGuards(JwtGuard, RolesGuard, SelfGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.COURIER, Roles.REGISTRATOR)
  @Patch('self/:id')
  selfUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updateSelfDto: UpdateSelfDto,
  ) {
    return this.userService.selfUpdate(user, id, updateSelfDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
