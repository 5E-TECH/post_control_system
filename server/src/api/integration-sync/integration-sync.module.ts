import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { IntegrationSyncQueueEntity } from 'src/core/entity/integration-sync-queue.entity';
import { ExternalIntegrationEntity } from 'src/core/entity/external-integration.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { IntegrationSyncController } from './integration-sync.controller';
import { IntegrationSyncService } from './integration-sync.service';
import { ExternalIntegrationModule } from '../external-integration/external-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationSyncQueueEntity,
      ExternalIntegrationEntity,
      OrderEntity,
    ]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ExternalIntegrationModule,
  ],
  controllers: [IntegrationSyncController],
  providers: [IntegrationSyncService],
  exports: [IntegrationSyncService],
})
export class IntegrationSyncModule {}
