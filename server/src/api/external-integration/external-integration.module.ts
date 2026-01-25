import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ExternalIntegrationEntity } from 'src/core/entity/external-integration.entity';
import { IntegrationSyncHistoryEntity } from 'src/core/entity/integration-sync-history.entity';
import { ExternalIntegrationController } from './external-integration.controller';
import { ExternalIntegrationService } from './external-integration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExternalIntegrationEntity,
      IntegrationSyncHistoryEntity,
    ]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [ExternalIntegrationController],
  providers: [ExternalIntegrationService],
  exports: [ExternalIntegrationService],
})
export class ExternalIntegrationModule {}
