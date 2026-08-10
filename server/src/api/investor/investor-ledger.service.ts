import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { InvestorCapitalContributionEntity } from 'src/core/entity/investor-capital-contribution.entity';
import { InvestorCapitalWithdrawalEntity } from 'src/core/entity/investor-capital-withdrawal.entity';
import { InvestorOwnershipStakeEntity } from 'src/core/entity/investor-ownership-stake.entity';
import { InvestorDistributionEntity } from 'src/core/entity/investor-distribution.entity';
import { InvestorBasisRequestEntity } from 'src/core/entity/investor-basis-request.entity';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { Roles } from 'src/common/enums';
import { OrderService } from '../order/order.service';
import { successRes } from 'src/infrastructure/lib/response';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';
import * as ExcelJS from 'exceljs';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload } from 'src/common/utils/types/user.type';
import {
  RecordCapitalDto,
  RecordDistributionDto,
  RecordWithdrawalDto,
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
    @InjectRepository(InvestorCapitalWithdrawalEntity)
    private readonly withdrawalRepo: Repository<InvestorCapitalWithdrawalEntity>,
    @InjectRepository(InvestorOwnershipStakeEntity)
    private readonly stakeRepo: Repository<InvestorOwnershipStakeEntity>,
    @InjectRepository(InvestorDistributionEntity)
    private readonly distRepo: Repository<InvestorDistributionEntity>,
    @InjectRepository(InvestorBasisRequestEntity)
    private readonly basisReqRepo: Repository<InvestorBasisRequestEntity>,
    @InjectRepository(FinancialBalanceHistoryEntity)
    private readonly fbhRepo: Repository<FinancialBalanceHistoryEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly orderService: OrderService,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  private num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ---- KANONIK KUNLIK EQUITY DVIGATELI (yagona haqiqat manbai) ----
  // Investor ko'radigan HAR BIR pul raqami shu yerdan kelib chiqadi:
  //   kunlik YALPI marja (getRevenueStats — to'liq raw LEFT JOIN)
  //   − o'sha kungi OpEx (FBH: salary + bills + manual_expense)
  //   = kunlik SOF foyda; har kun O'ZINING aktiv ulush versiyasi bilan
  //   → investor kunlik ulushi.
  // Hero xulosa (getSummary) ham, kunlik jadval (getDailyBreakdown) ham AYNAN
  // shu natijadan o'qiydi — shuning uchun ular hech qachon farq qilmaydi.

  // So'ralgan oraliqni 'YYYY-MM-DD' ga keltiradi. Berilmasa: eng erta ulush
  // boshidan → bugungacha (butun egalik davri).
  private resolveRange(
    stakes: InvestorOwnershipStakeEntity[],
    startDate?: string,
    endDate?: string,
  ): { sd: string; ed: string } {
    let sd = startDate;
    let ed = endDate;
    if (!sd || !ed) {
      const earliest =
        stakes.length > 0
          ? Math.min(...stakes.map((s) => this.num(s.effective_from)))
          : Date.now();
      sd = sd || this.toYmd(earliest);
      ed = ed || this.toYmd(Date.now());
    }
    return { sd, ed };
  }

  // Kunlik equity qatorlari + jami. BIR joyda hisoblanadi; hamma iste'molchi
  // (hero xulosa + kunlik jadval) shu YAGONA natijadan foydalanadi.
  private async computeDaily(
    investorId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const stakes = await this.stakeRepo.find({
      where: { investor_id: investorId },
      order: { effective_from: 'ASC' },
    });
    const { sd, ed } = this.resolveRange(stakes, startDate, endDate);
    const openStake = stakes.find((s) => s.effective_to == null) ?? null;

    // 1) Kunlik YALPI marja — TO'LIQ manba (raw LEFT JOIN, getStats EMAS).
    const revRes: any = await this.orderService.getRevenueStats('daily', sd, ed);
    const series: any[] = revRes?.data?.data ?? [];
    const seriesByDay: Record<string, any> = {};
    for (const d of series) seriesByDay[d.period] = d;

    // 2) Kunlik OpEx — BUTUN oraliq bo'yicha (faqat buyurtma bo'lgan kunlar EMAS).
    const needNet = stakes.some((s) => (s.profit_basis || 'net') === 'net');
    const opexByDay: Record<string, number> = needNet
      ? await this.dailyOpexMap(
          toUzbekistanTimestamp(sd, false),
          toUzbekistanTimestamp(ed, true),
        )
      : {};

    // 3) Kunlik taqsimotlar (investor o'sha kuni yechib olgan pul).
    const dists = await this.distRepo.find({
      where: { investor_id: investorId },
    });
    const distByDay: Record<string, number> = {};
    for (const dst of dists) {
      const ymd = this.toYmd(this.num(dst.distributed_at));
      if (ymd < sd || ymd > ed) continue;
      distByDay[ymd] = (distByDay[ymd] ?? 0) + this.num(dst.amount);
    }

    // Kunlar to'plami: tushum ∪ OpEx ∪ taqsimot kunlari (har uch manba ham
    // ko'rinsin — tushumsiz kunda ham OpEx yoki pul yechish bo'lishi mumkin).
    const allDates = Array.from(
      new Set([
        ...series.map((d) => d.period),
        ...Object.keys(opexByDay),
        ...Object.keys(distByDay),
      ]),
    ).sort();

    const rows = allDates.map((period) => {
      const d = seriesByDay[period];
      const dayMs = toUzbekistanTimestamp(period, false);
      const stake = this.stakeForDay(stakes, dayMs);
      const bps = stake?.ownership_bps ?? 0;
      const basis = stake?.profit_basis ?? 'net';
      const revenue = d ? this.num(d.revenue) : 0;
      const opex = basis === 'net' ? this.num(opexByDay[period]) : 0;
      const postProfit = revenue - opex;
      const investorShare = Math.floor((postProfit * bps) / 10000);
      const distributed = this.num(distByDay[period]);
      return {
        date: period,
        label: d?.label ?? period,
        ordersCount: d ? this.num(d.ordersCount) : 0,
        revenue, // o'sha kungi tushum (yalpi marja)
        opex, // o'sha kungi xarajat (OpEx)
        postProfit, // o'sha kungi (pochta) sof foydasi
        ownershipPct: bps / 100,
        investorShare, // shundan sizning ulushingiz
        distributed, // o'sha kuni yechib olganingiz
        bps,
      };
    });

    // Faqat investorga taalluqli kunlar: egalik ulushi bo'lgan (foyda/zarar)
    // yoki pul yechib olgan kunlar. Egalik qilmagan davr hisobga olinmaydi.
    const days = rows
      .filter((x) => x.bps > 0 || x.distributed > 0)
      .map((x) => ({
        date: x.date,
        label: x.label,
        ordersCount: x.ordersCount,
        revenue: x.revenue,
        opex: x.opex,
        postProfit: x.postProfit,
        ownershipPct: x.ownershipPct,
        investorShare: x.investorShare,
        distributed: x.distributed,
      }));

    const totals = days.reduce(
      (a, x) => ({
        revenue: a.revenue + x.revenue,
        postProfit: a.postProfit + x.postProfit,
        investorShare: a.investorShare + x.investorShare,
        distributed: a.distributed + x.distributed,
      }),
      { revenue: 0, postProfit: 0, investorShare: 0, distributed: 0 },
    );

    return { stakes, openStake, days, totals, sd, ed };
  }

  // Investorning shaxsiy xulosasi (o'ziga scoped). Hero pul raqamlari (ishlab
  // topilgan foyda, taqsimlanmagan) AYNAN kunlik dvigateldan — kunlik jadval
  // jamisi bilan HAR DOIM bir xil.
  async getSummary(investorId: string, startDate?: string, endDate?: string) {
    const [contributions, withdrawals, distributions] = await Promise.all([
      this.capitalRepo.find({ where: { investor_id: investorId } }),
      this.withdrawalRepo.find({ where: { investor_id: investorId } }),
      this.distRepo.find({ where: { investor_id: investorId } }),
    ]);

    const { openStake, totals, sd, ed } = await this.computeDaily(
      investorId,
      startDate,
      endDate,
    );

    const capitalContributed = contributions.reduce(
      (a, c) => a + this.num(c.amount),
      0,
    );
    const capitalWithdrawn = withdrawals.reduce(
      (a, w) => a + this.num(w.amount),
      0,
    );
    // Sof (joriy) kapital = kiritilgan − qaytarilgan.
    const capitalInvested = capitalContributed - capitalWithdrawn;
    const distributionsPaid = distributions.reduce(
      (a, d) => a + this.num(d.amount),
      0,
    );
    const ownershipBps = openStake ? openStake.ownership_bps : 0;

    // Hero raqamlar AYNAN kunlik jadval jamisidan (bir xil dvigatel — farq yo'q).
    const accruedProfitShare = totals.investorShare;
    const netProfitForRange = totals.postProfit;
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
        capitalContributed, // jami kiritilgan (gross)
        capitalWithdrawn, // jami qaytarilgan
        capitalInvested, // sof joriy kapital (contributed − withdrawn)
        ownershipBps,
        ownershipPct: ownershipBps / 100,
        profitBasis: openStake?.profit_basis ?? 'net',
        accruedProfitShare,
        distributionsPaid,
        undistributed,
        accruedRoiPct,
        realizedRoiPct,
        netProfitForRange,
        from: sd,
        to: ed,
      },
      200,
      'My investment summary',
    );
  }

  // Birlashtirilgan ledger tarixi (kapital + taqsimot + ulush o'zgarishlari).
  async listEntries(investorId: string, page = 1, limit = 20) {
    const [caps, withs, dists, stakes] = await Promise.all([
      this.capitalRepo.find({ where: { investor_id: investorId } }),
      this.withdrawalRepo.find({ where: { investor_id: investorId } }),
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
      ...withs.map((w) => ({
        type: 'capital_withdrawal',
        amount: this.num(w.amount),
        ownershipBps: null as number | null,
        note: w.note,
        occurred_at: this.num(w.withdrawn_at),
        created_at: this.num(w.created_at),
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
    s1.addRow(['Jami kiritilgan kapital', d.capitalContributed]);
    s1.addRow(['Jami qaytarilgan kapital', d.capitalWithdrawn]);
    s1.addRow(['Sof (joriy) kapital', d.capitalInvested]);
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

  // Kunlik OpEx (FBH negativlari, Toshkent kuni bo'yicha) → {'YYYY-MM-DD': opex}.
  private async dailyOpexMap(
    fromTs: number,
    toTs: number,
  ): Promise<Record<string, number>> {
    const rows: any[] = await this.fbhRepo.query(
      `SELECT TO_CHAR(TO_TIMESTAMP(h.created_at/1000) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
              SUM(CASE WHEN h.amount < 0 THEN (-1*h.amount) ELSE 0 END) AS opex
       FROM financial_balance_history h
       WHERE h.source_type IN ('salary','bills','manual_expense')
         AND h.created_at >= $1 AND h.created_at <= $2
       GROUP BY day`,
      [fromTs, toTs],
    );
    const map: Record<string, number> = {};
    for (const r of rows) map[r.day] = this.num(r.opex);
    return map;
  }

  private stakeForDay(
    stakes: InvestorOwnershipStakeEntity[],
    dayMs: number,
  ): InvestorOwnershipStakeEntity | null {
    for (const s of stakes) {
      const from = this.num(s.effective_from);
      const to = s.effective_to == null ? Infinity : this.num(s.effective_to);
      if (from <= dayMs && dayMs < to) return s;
    }
    return null;
  }

  // epoch-ms → 'YYYY-MM-DD' (Toshkent, UTC+5).
  private toYmd(ms: number): string {
    const uz = new Date(ms + 5 * 60 * 60 * 1000);
    return `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, '0')}-${String(uz.getUTCDate()).padStart(2, '0')}`;
  }

  // KUNLIK breakdown: har kun tushum + o'sha kungi ulush + yechib olgan pul.
  // Barcha hisob computeDaily'da (hero xulosa bilan AYNAN bir xil manba).
  async getDailyBreakdown(
    investorId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { openStake, days, totals } = await this.computeDaily(
      investorId,
      startDate,
      endDate,
    );
    return successRes(
      {
        basis: openStake?.profit_basis ?? 'net',
        ownershipPct: (openStake?.ownership_bps ?? 0) / 100,
        days,
        totals,
      },
      200,
      'Daily breakdown',
    );
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

  async recordWithdrawal(
    investorId: string,
    dto: RecordWithdrawalDto,
    actor?: JwtPayload,
  ) {
    await this.assertInvestor(investorId);
    // Qaytarish joriy sof kapitaldan oshib ketmasligi kerak.
    const [contribs, withs] = await Promise.all([
      this.capitalRepo.find({ where: { investor_id: investorId } }),
      this.withdrawalRepo.find({ where: { investor_id: investorId } }),
    ]);
    const net =
      contribs.reduce((a, c) => a + this.num(c.amount), 0) -
      withs.reduce((a, w) => a + this.num(w.amount), 0);
    if (dto.amount > net) {
      throw new BadRequestException(
        `Qaytarish (${dto.amount}) joriy kapitaldan (${net}) oshib ketmasligi kerak`,
      );
    }
    const row = this.withdrawalRepo.create({
      investor_id: investorId,
      amount: dto.amount,
      withdrawn_at: dto.withdrawn_at ?? Date.now(),
      note: dto.note ?? null,
      created_by: actor?.id ?? null,
    });
    await this.withdrawalRepo.save(row);
    this.activityLog.log({
      entity_type: 'investor_capital_withdrawal',
      entity_id: investorId,
      action: 'created',
      new_value: { amount: dto.amount },
      description: `Investor kapital qaytarish: ${dto.amount}`,
      user: actor,
    });
    return successRes(row, 201, 'Capital withdrawal recorded');
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
    // Basis berilsa — o'sha; aks holda joriy ochiq versiyanikini saqlaymiz.
    const currentOpen = await this.stakeRepo.findOne({
      where: { investor_id: investorId, effective_to: IsNull() },
    });
    const profitBasis = dto.profit_basis ?? currentOpen?.profit_basis ?? 'net';
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
        profit_basis: profitBasis,
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
      new_value: { ownership_bps: dto.ownership_bps, profit_basis: profitBasis },
      description: `Investor ulushi: ${dto.ownership_bps} bp (${profitBasis})`,
      user: actor,
    });
    return successRes(
      {
        ownership_bps: dto.ownership_bps,
        profit_basis: profitBasis,
        effective_from: effectiveFrom,
      },
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

  // ---- Foyda-asosi o'zgarishi: TASDIQLASH oqimi ----
  // Admin faqat TAKLIF qiladi — o'zi bevosita o'zgartira olmaydi. Investor
  // tasdiqlagandagina basis o'zgaradi (joriy ulush% saqlanadi, o'sha kundan).
  async proposeBasisChange(
    investorId: string,
    basis: string,
    actor?: JwtPayload,
  ) {
    await this.assertInvestor(investorId);
    if (basis !== 'net' && basis !== 'gross') {
      throw new BadRequestException("basis 'net' yoki 'gross' bo'lishi kerak");
    }
    await this.basisReqRepo.delete({ investor_id: investorId });
    const row = this.basisReqRepo.create({
      investor_id: investorId,
      requested_basis: basis,
      requested_by: actor?.id ?? null,
    });
    await this.basisReqRepo.save(row);
    this.activityLog.log({
      entity_type: 'investor_basis_request',
      entity_id: investorId,
      action: 'proposed',
      new_value: { requested_basis: basis },
      description: `Foyda asosi taklifi: ${basis}`,
      user: actor,
    });
    return successRes({ requested_basis: basis }, 201, 'Basis change proposed');
  }

  async getPendingBasisRequest(investorId: string) {
    const row = await this.basisReqRepo.findOne({
      where: { investor_id: investorId },
    });
    return successRes(
      row
        ? { requested_basis: row.requested_basis, created_at: row.created_at }
        : null,
      200,
      'Pending basis request',
    );
  }

  async approveBasisRequest(investorId: string, actor?: JwtPayload) {
    const row = await this.basisReqRepo.findOne({
      where: { investor_id: investorId },
    });
    if (!row) throw new NotFoundException("Kutayotgan so'rov yo'q");
    const openStake = await this.stakeRepo.findOne({
      where: { investor_id: investorId, effective_to: IsNull() },
    });
    const bps = openStake?.ownership_bps ?? 0;
    await this.setOwnership(
      investorId,
      { ownership_bps: bps, profit_basis: row.requested_basis as 'net' | 'gross' },
      actor,
    );
    await this.basisReqRepo.delete({ investor_id: investorId });
    this.activityLog.log({
      entity_type: 'investor_basis_request',
      entity_id: investorId,
      action: 'approved',
      new_value: { profit_basis: row.requested_basis },
      description: `Foyda asosi tasdiqlandi: ${row.requested_basis}`,
      user: actor,
    });
    return successRes(
      { profit_basis: row.requested_basis },
      200,
      'Basis change approved',
    );
  }

  async rejectBasisRequest(investorId: string, actor?: JwtPayload) {
    await this.basisReqRepo.delete({ investor_id: investorId });
    this.activityLog.log({
      entity_type: 'investor_basis_request',
      entity_id: investorId,
      action: 'rejected',
      description: 'Foyda asosi taklifi rad etildi',
      user: actor,
    });
    return successRes(null, 200, 'Basis change rejected');
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
