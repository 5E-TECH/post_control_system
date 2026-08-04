import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { InvestorCapitalContributionEntity } from 'src/core/entity/investor-capital-contribution.entity';
import { InvestorOwnershipStakeEntity } from 'src/core/entity/investor-ownership-stake.entity';
import { InvestorDistributionEntity } from 'src/core/entity/investor-distribution.entity';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { FinancialSource_type, Roles } from 'src/common/enums';
import { successRes } from 'src/infrastructure/lib/response';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';
import * as ExcelJS from 'exceljs';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload } from 'src/common/utils/types/user.type';
import {
  RecordCapitalDto,
  RecordDistributionDto,
  SetOwnershipDto,
} from './dto/ledger.dto';

/**
 * Investor equity ledger + ROI dvigatel.
 *
 * ROI (decision #7): accrued share = ulush% × sof foyda, DAVRLAR bo'yicha
 * vaqt-tortilgan (ulush o'zgargan har chegарada sub-davrga bo'linadi va har
 * sub-davr O'SHA PAYTDAGI ulush bilan hisoblanadi). Taqsimotlar alohida.
 *
 * Biznes sof foyda YAGONA manba — financial_balance_history:
 *   netProfit = SELL_PROFIT − (SALARY + BILLS + MANUAL_EXPENSE)
 */
@Injectable()
export class InvestorLedgerService {
  constructor(
    @InjectRepository(InvestorCapitalContributionEntity)
    private readonly capitalRepo: Repository<InvestorCapitalContributionEntity>,
    @InjectRepository(InvestorOwnershipStakeEntity)
    private readonly stakeRepo: Repository<InvestorOwnershipStakeEntity>,
    @InjectRepository(InvestorDistributionEntity)
    private readonly distRepo: Repository<InvestorDistributionEntity>,
    @InjectRepository(FinancialBalanceHistoryEntity)
    private readonly fbhRepo: Repository<FinancialBalanceHistoryEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  private num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // Berilgan epoch-ms oralig'i [from, to) uchun biznes sof foydasi.
  async netProfitBetween(fromTs: number, toTs: number): Promise<number> {
    if (toTs <= fromTs) return 0;
    const rows = await this.fbhRepo
      .createQueryBuilder('h')
      .select('h.source_type', 'source_type')
      .addSelect(
        'SUM(CASE WHEN h.amount > 0 THEN h.amount ELSE 0 END)',
        'pos',
      )
      .addSelect(
        'SUM(CASE WHEN h.amount < 0 THEN (-1 * h.amount) ELSE 0 END)',
        'neg',
      )
      .where('h.created_at >= :from AND h.created_at < :to', {
        from: fromTs,
        to: toTs,
      })
      .groupBy('h.source_type')
      .getRawMany();

    let sellProfit = 0;
    let opex = 0;
    for (const r of rows) {
      const st = r.source_type;
      if (st === FinancialSource_type.SELL_PROFIT) {
        sellProfit += this.num(r.pos);
      } else if (
        st === FinancialSource_type.SALARY ||
        st === FinancialSource_type.BILLS ||
        st === FinancialSource_type.MANUAL_EXPENSE
      ) {
        opex += this.num(r.neg);
      }
    }
    return sellProfit - opex;
  }

  // Vaqt-tortilgan accrued profit share. Har ulush versiyasi o'z sub-davri
  // uchun O'SHA paytdagi ulush bilan hisoblanadi (integer: avval ko'paytir, keyin bo'l).
  private async accruedProfitShare(
    investorId: string,
    rangeStart: number,
    rangeEnd: number,
  ): Promise<number> {
    if (rangeEnd <= rangeStart) return 0;
    const stakes = await this.stakeRepo.find({
      where: { investor_id: investorId },
      order: { effective_from: 'ASC' },
    });
    let total = 0;
    for (const s of stakes) {
      const sFrom = this.num(s.effective_from);
      const sTo = s.effective_to == null ? rangeEnd : this.num(s.effective_to);
      const ovStart = Math.max(sFrom, rangeStart);
      const ovEnd = Math.min(sTo, rangeEnd);
      if (ovEnd <= ovStart) continue;
      const np = await this.netProfitBetween(ovStart, ovEnd);
      total += Math.floor((np * s.ownership_bps) / 10000);
    }
    return total;
  }

  // Investorning shaxsiy xulosasi (o'ziga scoped).
  async getSummary(investorId: string, startDate?: string, endDate?: string) {
    const [contributions, distributions, openStake] = await Promise.all([
      this.capitalRepo.find({ where: { investor_id: investorId } }),
      this.distRepo.find({ where: { investor_id: investorId } }),
      this.stakeRepo.findOne({
        where: { investor_id: investorId, effective_to: IsNull() },
      }),
    ]);

    const capitalInvested = contributions.reduce(
      (a, c) => a + this.num(c.amount),
      0,
    );
    const distributionsPaid = distributions.reduce(
      (a, d) => a + this.num(d.amount),
      0,
    );
    const ownershipBps = openStake ? openStake.ownership_bps : 0;

    const rangeStart = startDate ? toUzbekistanTimestamp(startDate, false) : 0;
    const rangeEnd = endDate ? toUzbekistanTimestamp(endDate, true) : Date.now();

    const accruedProfitShare = await this.accruedProfitShare(
      investorId,
      rangeStart,
      rangeEnd,
    );
    const netProfitForRange = await this.netProfitBetween(rangeStart, rangeEnd);
    const undistributed = accruedProfitShare - distributionsPaid;
    const accruedRoiPct =
      capitalInvested > 0
        ? Math.round((accruedProfitShare / capitalInvested) * 10000) / 100
        : null;
    const realizedRoiPct =
      capitalInvested > 0
        ? Math.round((distributionsPaid / capitalInvested) * 10000) / 100
        : null;

    return successRes(
      {
        capitalInvested,
        ownershipBps,
        ownershipPct: ownershipBps / 100,
        accruedProfitShare,
        distributionsPaid,
        undistributed,
        accruedRoiPct,
        realizedRoiPct,
        netProfitForRange,
        from: rangeStart,
        to: rangeEnd,
      },
      200,
      'My investment summary',
    );
  }

  // Birlashtirilgan ledger tarixi (kapital + taqsimot + ulush o'zgarishlari).
  async listEntries(investorId: string, page = 1, limit = 20) {
    const [caps, dists, stakes] = await Promise.all([
      this.capitalRepo.find({ where: { investor_id: investorId } }),
      this.distRepo.find({ where: { investor_id: investorId } }),
      this.stakeRepo.find({ where: { investor_id: investorId } }),
    ]);
    const entries = [
      ...caps.map((c) => ({
        type: 'capital',
        amount: this.num(c.amount),
        ownershipBps: null as number | null,
        note: c.note,
        occurred_at: this.num(c.contributed_at),
        created_at: this.num(c.created_at),
      })),
      ...dists.map((d) => ({
        type: 'distribution',
        amount: this.num(d.amount),
        ownershipBps: null as number | null,
        note: d.note,
        occurred_at: this.num(d.distributed_at),
        created_at: this.num(d.created_at),
      })),
      ...stakes.map((s) => ({
        type: 'stake',
        amount: null as number | null,
        ownershipBps: s.ownership_bps,
        note: s.note,
        occurred_at: this.num(s.effective_from),
        created_at: this.num(s.created_at),
      })),
    ].sort((a, b) => b.occurred_at - a.occurred_at);

    const total = entries.length;
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const items = entries.slice((safePage - 1) * safeLimit, safePage * safeLimit);
    return successRes(
      { items, total, page: safePage, limit: safeLimit },
      200,
      'My ledger',
    );
  }

  // Shaxsiy equity Excel eksport (o'ziga scoped).
  async exportMyWorkbook(
    investorId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Buffer> {
    const sum: any = await this.getSummary(investorId, startDate, endDate);
    const led: any = await this.listEntries(investorId, 1, 1000);
    const d = sum.data ?? {};
    const wb = new ExcelJS.Workbook();

    const s1 = wb.addWorksheet('Summary');
    s1.addRow(['Korsatkich', 'Qiymat']);
    s1.addRow(['Kiritilgan kapital', d.capitalInvested]);
    s1.addRow(['Egalik ulushi %', d.ownershipPct]);
    s1.addRow(['Hisoblangan ulush (foyda)', d.accruedProfitShare]);
    s1.addRow(['Tolangan taqsimotlar', d.distributionsPaid]);
    s1.addRow(['Taqsimlanmagan', d.undistributed]);
    s1.addRow(['Accrued ROI %', d.accruedRoiPct]);
    s1.addRow(['Realized ROI %', d.realizedRoiPct]);

    const s2 = wb.addWorksheet('Ledger');
    s2.addRow(['Sana(ms)', 'Tur', 'Miqdor', 'Ulush(bps)', 'Izoh']);
    for (const e of led.data?.items ?? []) {
      s2.addRow([e.occurred_at, e.type, e.amount, e.ownershipBps, e.note]);
    }

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // ===================== ADMIN YOZUVLARI =====================

  private async assertInvestor(investorId: string): Promise<UserEntity> {
    const u = await this.userRepo.findOne({ where: { id: investorId } });
    if (!u) throw new NotFoundException('Investor topilmadi');
    if (u.role !== Roles.INVESTOR) {
      throw new BadRequestException('Bu foydalanuvchi investor emas');
    }
    return u;
  }

  async recordCapital(
    investorId: string,
    dto: RecordCapitalDto,
    actor?: JwtPayload,
  ) {
    await this.assertInvestor(investorId);
    const row = this.capitalRepo.create({
      investor_id: investorId,
      amount: dto.amount,
      contributed_at: dto.contributed_at ?? Date.now(),
      note: dto.note ?? null,
      created_by: actor?.id ?? null,
    });
    await this.capitalRepo.save(row);
    this.activityLog.log({
      entity_type: 'investor_capital',
      entity_id: investorId,
      action: 'created',
      new_value: { amount: dto.amount },
      description: `Investor kapital hissasi: ${dto.amount}`,
      user: actor,
    });
    return successRes(row, 201, 'Capital contribution recorded');
  }

  async setOwnership(
    investorId: string,
    dto: SetOwnershipDto,
    actor?: JwtPayload,
  ) {
    await this.assertInvestor(investorId);
    if (dto.ownership_bps < 0 || dto.ownership_bps > 10000) {
      throw new BadRequestException('ownership_bps 0..10000 oralig\'ida bo\'lishi kerak');
    }
    const effectiveFrom = dto.effective_from ?? Date.now();
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(InvestorOwnershipStakeEntity);
      // Joriy ochiq qatorni yopamiz (tarix o'zgartirilmaydi).
      await repo.update(
        { investor_id: investorId, effective_to: IsNull() },
        { effective_to: effectiveFrom },
      );
      const row = repo.create({
        investor_id: investorId,
        ownership_bps: dto.ownership_bps,
        effective_from: effectiveFrom,
        effective_to: null,
        note: dto.note ?? null,
        created_by: actor?.id ?? null,
      });
      await repo.save(row);
    });
    this.activityLog.log({
      entity_type: 'investor_ownership',
      entity_id: investorId,
      action: 'updated',
      new_value: { ownership_bps: dto.ownership_bps },
      description: `Investor ulushi: ${dto.ownership_bps} bp`,
      user: actor,
    });
    return successRes(
      { ownership_bps: dto.ownership_bps, effective_from: effectiveFrom },
      200,
      'Ownership stake set',
    );
  }

  async recordDistribution(
    investorId: string,
    dto: RecordDistributionDto,
    actor?: JwtPayload,
  ) {
    await this.assertInvestor(investorId);
    const row = this.distRepo.create({
      investor_id: investorId,
      amount: dto.amount,
      distributed_at: dto.distributed_at ?? Date.now(),
      period_start: dto.period_start ?? null,
      period_end: dto.period_end ?? null,
      note: dto.note ?? null,
      created_by: actor?.id ?? null,
    });
    await this.distRepo.save(row);
    this.activityLog.log({
      entity_type: 'investor_distribution',
      entity_id: investorId,
      action: 'created',
      new_value: { amount: dto.amount },
      description: `Investor taqsimoti: ${dto.amount}`,
      user: actor,
    });
    return successRes(row, 201, 'Distribution recorded');
  }

  // Admin: barcha investorlar ro'yxati (equity boshqaruvi uchun).
  async listInvestors() {
    const investors = await this.userRepo.find({
      where: { role: Roles.INVESTOR },
      select: ['id', 'name', 'phone_number', 'status', 'created_at'],
      order: { created_at: 'DESC' },
    });
    return successRes(investors, 200, 'Investors');
  }
}
