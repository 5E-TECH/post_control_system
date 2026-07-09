import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import {
  AiTransactionEntity,
  AiTxType,
} from 'src/core/entity/ai-transaction.entity';
import { Roles } from 'src/common/enums';
import config from 'src/config';
import { MyLogger } from 'src/logger/logger.service';

export type ChargeReason = 'ok' | 'disabled' | 'insufficient';

export interface MarketAiState {
  enabled: boolean;
  balance: number;
  price: number;
}

// Bot AI'sidan ozod rollar — market balansidan yechilmaydi (ichki xodimlar)
const EXEMPT_ROLES: Roles[] = [
  Roles.SUPERADMIN,
  Roles.ADMIN,
  Roles.REGISTRATOR,
];

@Injectable()
export class AiBalanceService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AiTransactionEntity)
    private readonly txRepo: Repository<AiTransactionEntity>,
    private readonly dataSource: DataSource,
    private readonly logger: MyLogger,
  ) {}

  isExemptRole(role: Roles): boolean {
    return EXEMPT_ROLES.includes(role);
  }

  private defaultPrice(): number {
    return Number(config.AI_PRICE_PER_ORDER) || 300;
  }

  // TypeORM query() UPDATE...RETURNING'ni ba'zan [rows, affected] shaklida
  // qaytaradi — haqiqiy qatorlar massivini normallashtiramiz.
  private returningRows(result: unknown): Record<string, unknown>[] {
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0] as Record<string, unknown>[];
    }
    return Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  }

  async getState(marketId: string): Promise<MarketAiState | null> {
    const m = await this.userRepo.findOne({
      where: { id: marketId },
      select: ['id', 'ai_enabled', 'ai_balance', 'ai_price_per_order'],
    });
    if (!m) return null;
    return {
      enabled: !!m.ai_enabled,
      balance: Number(m.ai_balance) || 0,
      price: m.ai_price_per_order ?? this.defaultPrice(),
    };
  }

  // Market/operatorning O'Z marketini JWT'dan aniqlaydi (self-service uchun).
  async resolveOwnMarket(user: {
    id: string;
    role: string;
  }): Promise<string | undefined> {
    if (user.role === Roles.MARKET) return user.id;
    if (user.role === Roles.OPERATOR) {
      const op = await this.userRepo.findOne({
        where: { id: user.id },
        select: ['id', 'market_id'],
      });
      return op?.market_id || undefined;
    }
    return undefined;
  }

  /**
   * Bir buyurtma uchun ATOMIK yechish: faqat ai_enabled=true VA balans>=narx
   * bo'lsagina yechadi va "usage" yozadi. Yechilmasa sababini qaytaradi.
   */
  async chargeForOrder(
    marketId: string,
    opts?: { actor?: string; orderId?: string },
  ): Promise<{ reason: ChargeReason; balance: number; price: number }> {
    const def = this.defaultPrice();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const rows = this.returningRows(
        await queryRunner.manager.query(
          `UPDATE "users"
             SET "ai_balance" = "ai_balance" - COALESCE("ai_price_per_order", $2)
           WHERE "id" = $1
             AND "ai_enabled" = true
             AND "ai_balance" >= COALESCE("ai_price_per_order", $2)
           RETURNING "ai_balance", COALESCE("ai_price_per_order", $2) AS charged`,
          [marketId, def],
        ),
      );

      if (!rows.length) {
        await queryRunner.commitTransaction();
        const state = await this.getState(marketId);
        return {
          reason: state?.enabled ? 'insufficient' : 'disabled',
          balance: state?.balance ?? 0,
          price: state?.price ?? def,
        };
      }

      const balance = Number(rows[0].ai_balance) || 0;
      const price = Number(rows[0].charged) || def;

      await this.writeTx(queryRunner.manager, {
        marketId,
        type: 'usage',
        amount: price,
        balanceAfter: balance,
        note: 'AI buyurtma',
        actor: opts?.actor ?? null,
        orderId: opts?.orderId ?? null,
      });

      await queryRunner.commitTransaction();
      return { reason: 'ok', balance, price };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.log(
        `chargeForOrder error: ${(err as Error).message}`,
        'AiBalance',
      );
      return { reason: 'disabled', balance: 0, price: def };
    } finally {
      await queryRunner.release();
    }
  }

  /** AI xato bersa (Claude tushib qolsa) yechilgan summani qaytaradi. */
  async refund(
    marketId: string,
    amount: number,
    opts?: { actor?: string; orderId?: string },
  ): Promise<void> {
    if (!(amount > 0)) return;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const rows = this.returningRows(
        await queryRunner.manager.query(
          `UPDATE "users" SET "ai_balance" = "ai_balance" + $2 WHERE "id" = $1 RETURNING "ai_balance"`,
          [marketId, amount],
        ),
      );
      const balance = rows.length ? Number(rows[0].ai_balance) || 0 : 0;
      await this.writeTx(queryRunner.manager, {
        marketId,
        type: 'refund',
        amount,
        balanceAfter: balance,
        note: 'AI xato — qaytarildi',
        actor: opts?.actor ?? null,
        orderId: opts?.orderId ?? null,
      });
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.log(`refund error: ${(err as Error).message}`, 'AiBalance');
    } finally {
      await queryRunner.release();
    }
  }

  /** Admin: to'lov kelganda balansni to'ldirish. */
  async topup(
    marketId: string,
    amount: number,
    actor?: string,
    note?: string,
  ): Promise<{ balance: number }> {
    if (!(amount > 0)) {
      throw new BadRequestException("Summa musbat bo'lishi kerak");
    }
    await this.assertMarket(marketId);
    const rows = this.returningRows(
      await this.dataSource.query(
        `UPDATE "users" SET "ai_balance" = "ai_balance" + $2 WHERE "id" = $1 RETURNING "ai_balance"`,
        [marketId, amount],
      ),
    );
    const balance = rows.length ? Number(rows[0].ai_balance) || 0 : 0;
    await this.writeTx(this.dataSource.manager, {
      marketId,
      type: 'topup',
      amount,
      balanceAfter: balance,
      note: note ?? "To'lov",
      actor: actor ?? null,
      orderId: null,
    });
    return { balance };
  }

  async setEnabled(marketId: string, enabled: boolean): Promise<void> {
    await this.assertMarket(marketId);
    await this.userRepo.update({ id: marketId }, { ai_enabled: enabled });
  }

  async setPrice(marketId: string, price: number | null): Promise<void> {
    if (price != null && price < 0) {
      throw new BadRequestException('Narx manfiy bo‘la olmaydi');
    }
    await this.assertMarket(marketId);
    await this.userRepo.update({ id: marketId }, { ai_price_per_order: price });
  }

  async getHistory(
    marketId: string,
    limit = 50,
  ): Promise<AiTransactionEntity[]> {
    return this.txRepo.find({
      where: { market_id: marketId },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });
  }

  private async assertMarket(marketId: string): Promise<void> {
    const m = await this.userRepo.findOne({
      where: { id: marketId },
      select: ['id', 'role'],
    });
    if (!m || m.role !== Roles.MARKET) {
      throw new NotFoundException('Market topilmadi');
    }
  }

  private async writeTx(
    manager: EntityManager,
    p: {
      marketId: string;
      type: AiTxType;
      amount: number;
      balanceAfter: number;
      note: string | null;
      actor: string | null;
      orderId: string | null;
    },
  ): Promise<void> {
    const tx = manager.create(AiTransactionEntity, {
      market_id: p.marketId,
      type: p.type,
      amount: p.amount,
      balance_after: p.balanceAfter,
      note: p.note,
      actor: p.actor,
      order_id: p.orderId,
    });
    await manager.save(tx);
  }
}
