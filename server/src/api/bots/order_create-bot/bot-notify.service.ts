import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { Roles } from 'src/common/enums';
import { MyLogger } from 'src/logger/logger.service';
import config from 'src/config';

/**
 * Bot orqali marketning foydalanuvchilariga tizim xabarnomalarini yuboradi
 * (masalan, AI balans to'ldirilganда). Order bot (@InjectBot ORDER_BOT_NAME)
 * ishlatiladi — chunki operatorlar aynan shu bot orqali ro'yxatdan o'tган
 * (telegram_id shu bot bilan chatga mos keladi).
 */
@Injectable()
export class BotNotifyService {
  constructor(
    @InjectBot(config.ORDER_BOT_NAME) private readonly bot: Telegraf,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly logger: MyLogger,
  ) {}

  private formatSom(n: number): string {
    return (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /**
   * AI balans to'ldirilganда marketning bot orqali ro'yxatdan o'tган
   * foydalanuvchilariga (market EGASI + OPERATORlar, telegram_id bor) xabar
   * yuboradi. Best-effort: bir foydalanuvchiga yuborishда xato (botni
   * bloklagan) qolganlarni to'xtatmaydi va topup oqimini BUZMAYDI.
   */
  async notifyBalanceTopup(
    marketId: string,
    amount: number,
    newBalance: number,
  ): Promise<void> {
    let recipients: UserEntity[];
    try {
      // (market egasi) YOKI (shu market operatorlari) — ro'yxatdan o'tganlar.
      recipients = await this.userRepo.find({
        where: [
          { id: marketId, role: Roles.MARKET, is_deleted: false },
          { market_id: marketId, role: Roles.OPERATOR, is_deleted: false },
        ],
      });
    } catch (err) {
      this.logger.log(
        `notifyBalanceTopup: foydalanuvchilarni olishда xato: ${(err as Error).message}`,
        'BotNotify',
      );
      return;
    }

    const targets = recipients.filter((u) => u.telegram_id);
    if (!targets.length) return;

    const text =
      `💳 AI balansingiz to'ldirildi!\n\n` +
      `➕ Qo'shildi: ${this.formatSom(amount)} so'm\n` +
      `💰 Hozirgi balans: ${this.formatSom(newBalance)} so'm`;

    await Promise.all(
      targets.map(async (u) => {
        try {
          await this.bot.telegram.sendMessage(u.telegram_id, text);
        } catch (err) {
          // Botni bloklagan / chat topilmadi — jimgina o'tamiz (loglaymiz).
          this.logger.log(
            `notifyBalanceTopup: ${u.telegram_id} ga yuborilmadi: ${(err as Error).message}`,
            'BotNotify',
          );
        }
      }),
    );
  }

  /**
   * ADMIN e'loni: BARCHA ro'yxatdan o'tган bot foydalanuvchilariga (market
   * egalari + operatorlar, telegram_id bor) ixtiyoriy matnni yuboradi. Bir
   * martalik yangilik e'loni yoki boshqa xabarnomalar uchun. Best-effort;
   * Telegram rate-limitiga (~30/s) rioya qilib ketma-ket kichik kechikish bilan.
   */
  async broadcast(
    message: string,
  ): Promise<{ total: number; sent: number; failed: number }> {
    const text = (message || '').trim();
    if (!text) return { total: 0, sent: 0, failed: 0 };

    let recipients: UserEntity[];
    try {
      recipients = await this.userRepo.find({
        where: [
          { role: Roles.MARKET, is_deleted: false },
          { role: Roles.OPERATOR, is_deleted: false },
        ],
      });
    } catch (err) {
      this.logger.log(
        `broadcast: foydalanuvchilarni olishда xato: ${(err as Error).message}`,
        'BotNotify',
      );
      return { total: 0, sent: 0, failed: 0 };
    }

    // Bir telegram_id (masalan bir odam ham market, ham...) takror bo'lmasin.
    const seen = new Set<number>();
    const targets = recipients.filter((u) => {
      if (!u.telegram_id || seen.has(u.telegram_id)) return false;
      seen.add(u.telegram_id);
      return true;
    });

    let sent = 0;
    let failed = 0;
    for (const u of targets) {
      try {
        await this.bot.telegram.sendMessage(u.telegram_id, text);
        sent++;
      } catch {
        failed++; // botni bloklagan / chat yo'q — e'lon to'xtamaydi
      }
      // Telegram rate-limit (~30/s) — kichik kechikish (~25/s).
      await new Promise((r) => setTimeout(r, 40));
    }

    this.logger.log(
      `broadcast: ${sent} yuborildi, ${failed} xato (jami ${targets.length})`,
      'BotNotify',
    );
    return { total: targets.length, sent, failed };
  }
}
