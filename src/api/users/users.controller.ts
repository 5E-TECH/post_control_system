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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
  @Post('staff')
  createCourier(@Body() createUserDto: CreateUserDto) {
    return this.userService.createStaff(createUserDto);
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
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.COURIER, Roles.REGISTRATOR)
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

  @UseGuards(JwtGuard, RolesGuard, SelfGuard)
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
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('staff/:id')
  updateStaff(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateStaff(id, updateUserDto);
  }

  @UseGuards(JwtGuard, RolesGuard, SelfGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.COURIER, Roles.REGISTRATOR)
  @Patch('self/:id')
  selfUpdate(@Param('id') id: string, @Body() updateSelfDto: UpdateSelfDto) {
    return this.userService.selfUpdate(id, updateSelfDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
