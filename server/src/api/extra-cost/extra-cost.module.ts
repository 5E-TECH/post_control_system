import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { ExtraCostApplierService } from './extra-cost-applier.service';
import { ExtraCostProofService } from './extra-cost-proof.service';
import { ProofTranscodeService } from './proof-transcode.service';
import { ExtraCostRequestService } from './extra-cost-request.service';
import { ExtraCostDecisionService } from './extra-cost-decision.service';
import { ExtraCostTelegramService } from './extra-cost-telegram.service';
import { ExtraCostController } from './extra-cost.controller';
import { ExtraCostCron } from './extra-cost.cron';
import { ProofPayloadSizeGuard } from './proof-payload-size.guard';
import { OrderBotModule } from '../bots/order_create-bot/order-bot.module';

/**
 * QO'SHIMCHA XARAJAT moduli.
 *
 * Beradi:
 *   `ExtraCostApplierService` — xarajatni kassaga yozuvchi YAGONA joy
 *                               (`OrderModule` sotuv/bekor/qisman sotuvda ishlatadi)
 *   `ExtraCostProofService`   — foto isbotni saqlash, tekshirish, berish, tozalash
 *   `ExtraCostController`     — yuklash + himoyalangan ko'rish endpointlari
 *   `ExtraCostCron`           — orfan isbotlarni tozalash
 *
 * Keyingi bosqichlarda bu yerga tasdiqlash/rad etish oqimi qo'shiladi.
 *
 * ⚠️ Applier `OrderService` ning MAVJUD tranzaksiyasi ichida ishlaydi —
 * unga `QueryRunner` parametr sifatida beriladi va u o'z tranzaksiyasini
 * ochmaydi. Aks holda sotuv rollback bo'lganda xarajat yozuvi qolib ketardi.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExtraCostRequestEntity,
      ExtraCostProofEntity,
      CashEntity,
      CashboxHistoryEntity,
      OrderEntity,
      UserEntity,
    ]),
    // Marketga Telegram xabari uchun (`BotNotifyService`). `forwardRef` —
    // `OrderBotModule` ham `OrderModule` ga bog'langan, sikl shu bilan yopiladi.
    forwardRef(() => OrderBotModule),
  ],
  controllers: [ExtraCostController],
  providers: [
    ExtraCostApplierService,
    ExtraCostProofService,
    ProofTranscodeService,
    ExtraCostRequestService,
    ExtraCostDecisionService,
    ExtraCostTelegramService,
    ExtraCostCron,
    ProofPayloadSizeGuard,
  ],
  // `ExtraCostProofService` ni `OrderModule` ham oladi — sotuv/bekor qilish
  // `proof_ids` ni tekshirishi kerak (Bosqich 4).
  exports: [
    ExtraCostApplierService,
    ExtraCostProofService,
    ExtraCostRequestService,
    // Telegram tugmalari `OrderBotUpdate` da ulanadi — qaror servisi va
    // xabar servisi o'sha yerda kerak.
    ExtraCostDecisionService,
    ExtraCostTelegramService,
  ],
})
export class ExtraCostModule {}
