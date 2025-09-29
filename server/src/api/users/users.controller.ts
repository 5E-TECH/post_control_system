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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
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
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('user')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({
    summary: 'Create admin user',
    description: 'Create a new admin user (SuperAdmin only)',
  })
  @ApiResponse({ status: 201, description: 'Admin user created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SuperAdmin role required',
  })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({
    status: 201,
    description: 'Created admin',
    schema: {
      example: {
        id: '5f9c2b7e-3a41-4d5c-92f8-0f1a2b3c4d5e',
        name: 'Admin User',
        phone_number: '+998901234567',
        role: 'ADMIN',
        salary: 3000000,
        payment_day: 10,
        status: 'ACTIVE',
        created_at: '2025-01-01T12:00:00.000Z',
        updated_at: '2025-01-01T12:00:00.000Z',
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Post('admin')
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.userService.createAdmin(createAdminDto);
  }

  @ApiOperation({
    summary: 'Create registrator user',
    description: 'Create a new registrator user (SuperAdmin/Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Registrator user created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('registrator')
  createRegistrator(@Body() createRegistratorDto: CreateAdminDto) {
    return this.userService.createRegistrator(createRegistratorDto);
  }

  @ApiOperation({
    summary: 'Create courier user',
    description: 'Create a new courier user (SuperAdmin/Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Courier user created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiBody({ type: CreateCourierDto })
  @ApiResponse({
    status: 201,
    description: 'Created courier',
    schema: {
      example: {
        id: '8a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
        name: 'Akmal Abdullaev',
        phone_number: '+998901234567',
        region_id: 'f3b2c1d4-5678-90ab-cdef-1234567890ab',
        tariff_home: 10000,
        tariff_center: 8000,
        role: 'COURIER',
        status: 'ACTIVE',
        created_at: '2025-01-01T12:00:00.000Z',
        updated_at: '2025-01-01T12:00:00.000Z',
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('courier')
  createCourier(@Body() createCourierDto: CreateCourierDto) {
    return this.userService.createCourier(createCourierDto);
  }

  @ApiOperation({ summary: 'Create market user' })
  @ApiResponse({ status: 201, description: 'Market user created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiBody({ type: CreateMarketDto })
  @ApiResponse({
    status: 201,
    description: 'Created market',
    schema: {
      example: {
        id: 'b6a5c4d3-2e1f-0a9b-8c7d-6e5f4a3b2c1d',
        name: 'Market 1',
        phone_number: '+998901234567',
        tariff_home: 10000,
        tariff_center: 8000,
        role: 'MARKET',
        status: 'ACTIVE',
        created_at: '2025-01-01T12:00:00.000Z',
        updated_at: '2025-01-01T12:00:00.000Z',
      },
    },
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('market')
  createMarket(@Body() createMarketDto: CreateMarketDto) {
    return this.userService.createMarket(createMarketDto);
  }

  @ApiOperation({ summary: 'Create customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({
    status: 201,
    description: 'Created customer',
    schema: {
      example: {
        id: 'c7d8e9f0-a1b2-c3d4-e5f6-1234567890ab',
        name: 'John Doe',
        phone_number: '+998901112233',
        district_id: '2c3f5b7a-1d9e-44f7-8a1b-0a1d2b3c4d5e',
        market_id: '8b2c1a8e-3b6f-4a6e-9a2f-71d8a5c9d123',
        status: 'ACTIVE',
        created_at: '2025-01-01T12:00:00.000Z',
        updated_at: '2025-01-01T12:00:00.000Z',
      },
    },
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.MARKET)
  @Post('customer')
  createCustomer(
    @CurrentUser() user: JwtPayload,
    @Body() createCustomerDto: CreateCustomerDto,
  ) {
    return this.userService.createCustomer(user, createCustomerDto);
  }

  @ApiOperation({
    summary: 'User sign in',
    description: 'Authenticate user and return JWT token',
  })
  @ApiResponse({ status: 200, description: 'User signed in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiBody({ type: SignInUserDto })
  @ApiResponse({
    status: 200,
    description: 'Signed in response example',
    schema: {
      example: {
        user: {
          id: '728e1a8b-8b4c-4b0a-9d2f-1234567890ab',
          name: 'Admin User',
          role: 'ADMIN',
          phone_number: '+998901234567',
        },
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @Post('signin')
  async signIn(
    @Body() signInuser: SignInUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.signInUser(signInuser, res);
  }

  @ApiOperation({
    summary: 'User sign out',
    description: 'Sign out user and clear JWT token',
  })
  @ApiResponse({ status: 200, description: 'User signed out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Post('signout')
  async signOut(@Res({ passthrough: true }) res: Response) {
    return this.userService.signOut(res);
  }

  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieve all users with optional filtering and pagination',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search users by name or phone',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by user status',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filter by user role',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get()
  findAllUsers(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.userService.allUsers({ search, status, role, page, limit });
  }

  @ApiOperation({ summary: 'List all markets' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Markets retrieved successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.COURIER)
  @Get('markets')
  findAllMarkets(
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.userService.allMarkets(search, page, limit);
  }

  @ApiOperation({ summary: 'List all users except MARKET role' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or phone number',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'User status (e.g., ACTIVE, INACTIVE)',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: [Roles.SUPERADMIN, Roles.ADMIN, Roles.COURIER],
    description: 'Filter by role (only SUPERADMIN, ADMIN, COURIER)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Users (excluding MARKET) retrieved successfully',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('except-market')
  findAllUsersExceptMarket(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: Roles,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.userService.allUsersExceptMarket({
      search,
      status,
      role,
      page,
      limit,
    });
  }

  @ApiOperation({ summary: 'List all couriers' })
  @ApiResponse({ status: 200, description: 'Couriers retrieved successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Get('couriers')
  findAllCouriers() {
    return this.userService.allCouriers();
  }

  @ApiOperation({
    summary: 'Get user profile',
    description: 'Get current user profile information',
  })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Get user by id' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @ApiOperation({ summary: 'Update admin user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateAdminDto })
  @ApiResponse({ status: 200, description: 'Admin updated successfully' })
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

  @ApiOperation({ summary: 'Update registrator user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateAdminDto })
  @ApiResponse({ status: 200, description: 'Registrator updated successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch('registrator/:id')
  updateRegistrator(
    @Param('id') id: string,
    @Body() updateRegisDto: UpdateAdminDto,
  ) {
    return this.userService.updateRegistrator(id, updateRegisDto);
  }

  @ApiOperation({ summary: 'Update courier user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateCourierDto })
  @ApiResponse({ status: 200, description: 'Courier updated successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('courier/:id')
  updateCourier(
    @Param('id') id: string,
    @Body() updateCourierDto: UpdateCourierDto,
  ) {
    return this.userService.updateCourier(id, updateCourierDto);
  }

  @ApiOperation({ summary: 'Update market user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateMarketDto })
  @ApiResponse({ status: 200, description: 'Market updated successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('market/:id')
  updateMarket(
    @Param('id') id: string,
    @Body() updateMarketDto: UpdateMarketDto,
  ) {
    return this.userService.updateMarket(id, updateMarketDto);
  }

  @ApiOperation({ summary: 'Self update user profile' })
  @ApiParam({ name: 'id', description: 'User ID (must match current user)' })
  @ApiBody({ type: UpdateSelfDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.COURIER, Roles.REGISTRATOR)
  @Patch('self')
  selfUpdate(
    @CurrentUser() user: JwtPayload,
    @Body() updateSelfDto: UpdateSelfDto,
  ) {
    return this.userService.selfUpdate(user, updateSelfDto);
  }

  @ApiOperation({ summary: 'Customer address update' })
  @ApiParam({ name: 'id', description: 'Customer id should send here' })
  @ApiBody({ type: UpdateSelfDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @UseGuards(JwtGuard, RolesGuard, SelfGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Patch('customer/address/:id')
  updateCustomerAddress(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.userService.updateCustomerAddress(id, dto);
  }

  @ApiOperation({ summary: 'Customer name phone update' })
  @ApiParam({ name: 'id', description: 'Customer id should send here' })
  @ApiBody({ type: UpdateSelfDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @UseGuards(JwtGuard, RolesGuard, SelfGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Patch('customer/name-phone/:id')
  updateCustomerNamePhone(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.userService.updateCustomerNamePhone(id, dto);
  }

  @ApiOperation({ summary: 'Delete user by id' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
