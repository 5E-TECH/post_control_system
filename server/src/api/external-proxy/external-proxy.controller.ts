import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ExternalProxyService } from './external-proxy.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

// DTO for QR search
class QrSearchDto {
  @ApiProperty({ description: 'QR kod', example: '1737123456789123' })
  @IsNotEmpty()
  @IsString()
  qr_code: string;
}

@ApiTags('External Proxy')
@ApiBearerAuth()
@Controller('external-proxy')
@UseGuards(JwtGuard, RolesGuard)
export class ExternalProxyController {
  constructor(private readonly externalProxyService: ExternalProxyService) {}

  // Dinamik route - har qanday integratsiya uchun login
  @Post(':slug/login')
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @ApiOperation({ summary: 'Dinamik integratsiya orqali login qilish' })
  async login(@Param('slug') slug: string) {
    return this.externalProxyService.login(slug);
  }

  // Dinamik route - har qanday integratsiya uchun QR qidirish
  @Post(':slug/qrorder/find')
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @ApiOperation({ summary: 'Dinamik integratsiya orqali QR kod bilan buyurtma qidirish' })
  async findByQr(@Param('slug') slug: string, @Body() dto: QrSearchDto) {
    return this.externalProxyService.findByQr(slug, dto.qr_code);
  }
}
