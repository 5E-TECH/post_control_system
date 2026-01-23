import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExternalProxyController } from './external-proxy.controller';
import { ExternalProxyService } from './external-proxy.service';
import { ExternalIntegrationModule } from '../external-integration/external-integration.module';

@Module({
  imports: [HttpModule, ExternalIntegrationModule],
  controllers: [ExternalProxyController],
  providers: [ExternalProxyService],
  exports: [ExternalProxyService],
})
export class ExternalProxyModule {}
