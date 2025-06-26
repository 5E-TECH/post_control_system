import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
} from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SignInUserDto } from './dto/signInUserDto';
import { Response } from 'express';

@Controller('admin')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createAdmin(createUserDto);
  }

  @Post('courier')
  createCourier(@Body() createUserDto: CreateUserDto) {
    return this.userService.createCourier(createUserDto);
  }

  @Post('registrator')
  createRegistrator(@Body() createUserDto: CreateUserDto) {
    return this.userService.createRegistrator(createUserDto);
  }

  @Post('confirmsignin')
  async confirmSign(
    @Body() signInuser: SignInUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.signInUser(signInuser, res);
  }

  @Post('signout')
  async signOut(@Res({ passthrough: true }) res: Response) {
    return this.userService.signOut(res);
  }

  @Get()
  findAllAdmin() {
    return this.userService.findAllAdmin();
  }

  @Get('courier')
  findAllCourier() {
    return this.userService.findAllCourier();
  }

  @Get('registrator')
  findAllRegistrator() {
    return this.userService.findAllRegistrator();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
