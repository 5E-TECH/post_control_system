import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExternalIntegrationService } from './external-integration.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

@ApiTags('External Integration')
@ApiBearerAuth()
@Controller('external-integration')
@UseGuards(JwtGuard, RolesGuard)
export class ExternalIntegrationController {
  constructor(private readonly service: ExternalIntegrationService) {}

  @Get()
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Barcha integratsiyalarni olish' })
  findAll() {
    return this.service.findAll();
  }

  @Get('active')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({ summary: 'Faqat faol integratsiyalarni olish' })
  findActive() {
    return this.service.findActive();
  }

  @Get(':id')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'ID bo\'yicha integratsiyani olish' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('slug/:slug')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Slug bo\'yicha integratsiyani olish' })
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Post()
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Yangi integratsiya yaratish' })
  create(@Body() dto: CreateIntegrationDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Integratsiyani yangilash' })
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Integratsiyani o\'chirish' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/test')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({ summary: 'Integratsiya ulanishini tekshirish' })
  testConnection(@Param('id') id: string) {
    return this.service.testConnection(id);
  }
}
