<!-- Generated: 2026-08-04 · Detailed per-slice designs (data-model, backend, security, frontend, rollout) -->

# Investor Account — Detailed Slice Designs (Appendix)



---

# Data model & migrations for the Investor equity/ROI module (backend, NestJS + TypeORM + PostgreSQL)

## Decision 1 — Investor identity: REUSE `users` table with `role = INVESTOR` (no separate `investor_profile` table)

Justification (verified against `users.entity.ts`):
- Auth, JWT (`JwtPayload { id, role, status }`), `JwtAuthGuard`, `RolesGuard`, `status` (ACTIVE/INACTIVE) and admin-provisioning flows ALL key off the single `users` row. Adding a parallel identity table would fork login/session logic for zero benefit.
- `users` already carries everything an investor login needs: `name`, `phone_number`, `password`, `status`, `role`. Investors have NO cashbox, NO region/district, NO salary — those relations are nullable/optional and simply stay empty. This mirrors how existing roles (OPERATOR, LOGIST) reuse the same table.
- The equity data is inherently a LEDGER, not profile attributes, so it belongs in dedicated ledger tables FK'd to `users.id`, not in a profile table.

Enum change: add `INVESTOR = 'investor'` to `Roles` in `common/enums/index.ts`. The Postgres enum type is auto-named `users_role_enum` (no `enumName` override exists anywhere in the codebase), so the migration must run `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'investor'`.

No new columns are added to `users`. (Investor login = admin creates a `users` row with `role='investor'`, `status='active'`, `password` bcrypt-hashed, no cashbox/salary created for it.)

## Decision 2 — Compute net profit LIVE, do NOT snapshot (with an optional deferred snapshot table, NOT built in this slice)

Justification (verified in `cash-box.service.ts::financialBalanceAnalytics` and `financial-balance-history.entity.ts`):
- Net profit for any period = a single grouped `SUM(amount)` over `financial_balance_history` filtered by `created_at` range and `source_type IN (SELL_PROFIT, SALARY, BILLS, MANUAL_EXPENSE)`. That table already has `IDX_FBH_CREATED_AT` and `IDX_FBH_SOURCE_TYPE`. This is one indexed aggregate query — cheap, and it is the SAME source the existing analytics already uses, guaranteeing the investor number reconciles with the admin financial view.
- The locked standard mandates "near-real-time with short 5-min TTL cache" — a live query behind the existing cache pattern satisfies this. A materialized monthly snapshot would ADD a reconciliation/backfill liability (corrections via `CORRECTION` source_type would silently drift from a frozen snapshot) for no latency win.
- To make range grouping fast without changing the live-compute decision, this slice adds ONE composite index `IDX_FBH_SOURCE_CREATED (source_type, created_at)` to `financial_balance_history` (additive, safe). No new columns on that table.
- Snapshotting is explicitly OUT of scope for the data slice; if profitability queries ever prove heavy, a future `investor_period_profit` cache table can be added, but it is not designed here to avoid a dual source of truth.

Net-profit formula the ROI engine will use (documented here so the ledger schema aligns): `net_profit(period) = Σ SELL_PROFIT.amount + Σ SALARY.amount + Σ BILLS.amount + Σ MANUAL_EXPENSE.amount` — note SALARY/BILLS/MANUAL_EXPENSE `amount` are already stored as NEGATIVE in `financial_balance_history` (see `financialBalanceAnalytics` negative-impact handling), so a plain signed `SUM` over those four source types yields net profit directly.

## Decision 3 — Three new ledger tables (all money as `bigint` UZS, no floats; ownership in basis points)

### Entity A: `InvestorCapitalContributionEntity` — table `investor_capital_contribution`
Capital paid IN by an investor. Append-only ledger.
Fields (extends BaseEntity → `id uuid`, `created_at bigint`, `updated_at bigint`):
- `investor_id: string` — `@Column({ type: 'uuid' })`, FK → `users.id` ON DELETE CASCADE.
- `amount: number` — `@Column({ type: 'bigint', transformer: bigintTransformerNonNull })`. UZS, must be > 0 (validated in DTO, and a CHECK constraint `amount > 0`).
- `contributed_at: number` — `@Column({ type: 'bigint', transformer: bigintTransformerNonNull })`. Epoch-ms of the economic date of the contribution (separate from `created_at` which is the record-insertion time), matching the `sold_at`/`payment_date` pattern of separating economic vs system time.
- `note: string | null` — `@Column({ type: 'varchar', nullable: true })`.
- `created_by: string` — `@Column({ type: 'uuid' })`, FK → `users.id` ON DELETE SET NULL. Admin who recorded it (audit).
- Relations: `@ManyToOne(() => UserEntity)` on `investor_id` (`investor`) and on `created_by` (`createdByUser`).
- Indexes: `IDX_ICC_INVESTOR (investor_id)`, `IDX_ICC_CONTRIBUTED_AT (contributed_at)`, composite `IDX_ICC_INVESTOR_DATE (investor_id, contributed_at)`.

### Entity B: `InvestorOwnershipStakeEntity` — table `investor_ownership_stake`
Versioned ownership %, supporting stake changes over time. Ownership stored in BASIS POINTS (integer, 1% = 100 bp, 100% = 10000 bp) to avoid floats.
Fields (extends BaseEntity):
- `investor_id: string` — `@Column({ type: 'uuid' })`, FK → `users.id` ON DELETE CASCADE.
- `ownership_bps: number` — `@Column({ type: 'int' })`. Basis points 0..10000, CHECK `ownership_bps >= 0 AND ownership_bps <= 10000`.
- `effective_from: number` — `@Column({ type: 'bigint', transformer: bigintTransformerNonNull })`. Epoch-ms, inclusive.
- `effective_to: number | null` — `@Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })`. Epoch-ms exclusive; NULL = currently open/active version. Only ONE open row per investor (enforced by partial unique index).
- `note: string | null` — `@Column({ type: 'varchar', nullable: true })`.
- `created_by: string` — `@Column({ type: 'uuid' })`, FK → `users.id` ON DELETE SET NULL.
- Relations: `@ManyToOne(() => UserEntity)` on `investor_id` and `created_by`.
- Indexes: `IDX_IOS_INVESTOR (investor_id)`, composite `IDX_IOS_INVESTOR_FROM (investor_id, effective_from)`, partial unique `UQ_IOS_OPEN_STAKE ON investor_ownership_stake (investor_id) WHERE effective_to IS NULL` (guarantees exactly one open stake version per investor). When a stake changes, the service closes the current open row (sets `effective_to`) and inserts a new open row — never mutates history.
- ROI usage: for a profit period, ownership is the stake row whose `[effective_from, effective_to)` interval covers the period (or a time-weighted blend if the stake changed mid-period; the service handles blending, the schema stores the versions).

### Entity C: `InvestorDistributionEntity` — table `investor_distribution`
Actual payouts made TO an investor (dividends/distributions), tracked separately from accrued ROI. Append-only.
Fields (extends BaseEntity):
- `investor_id: string` — `@Column({ type: 'uuid' })`, FK → `users.id` ON DELETE CASCADE.
- `amount: number` — `@Column({ type: 'bigint', transformer: bigintTransformerNonNull })`. UZS paid out, CHECK `amount > 0`.
- `distributed_at: number` — `@Column({ type: 'bigint', transformer: bigintTransformerNonNull })`. Epoch-ms economic date of payout.
- `period_start: number | null` — `@Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })`. Optional epoch-ms; if the payout is against a specific accrual period.
- `period_end: number | null` — `@Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })`. Optional epoch-ms end of that period.
- `note: string | null` — `@Column({ type: 'varchar', nullable: true })`.
- `created_by: string` — `@Column({ type: 'uuid' })`, FK → `users.id` ON DELETE SET NULL.
- Relations: `@ManyToOne(() => UserEntity)` on `investor_id` and `created_by`.
- Indexes: `IDX_IDIST_INVESTOR (investor_id)`, `IDX_IDIST_DISTRIBUTED_AT (distributed_at)`, composite `IDX_IDIST_INVESTOR_DATE (investor_id, distributed_at)`.

## Derived (NOT stored) values the ROI engine computes from the above + `financial_balance_history`
- `total_capital_in(investor)` = `SUM(amount)` over `investor_capital_contribution`.
- `accrued_profit_share(investor, period)` = `(ownership_bps / 10000) * net_profit(period)` computed with integer math: `net_profit * ownership_bps / 10000` using bigint arithmetic (multiply first, divide last, floor) to stay float-free.
- `total_distributions(investor)` = `SUM(amount)` over `investor_distribution`.
- `outstanding_accrued` = accrued_profit_share − total_distributions.
- `roi(investor)` = (accrued_profit_share_to_date) / total_capital_in — computed in the DTO/service layer as a display ratio, never persisted.

## Naming / convention conformance (all verified)
- All tables use `snake_case`, uuid PK via `uuid_generate_v4()`, `created_at`/`updated_at bigint NOT NULL`, matching `cashbox_card`/`courier_regions` migrations.
- FK constraint names `FK_<table>_<ref>`, index names `IDX_*`, unique `UQ_*`.
- Money columns `bigint` with `bigintTransformerNonNull` (default) or nullable `bigintTransformer` — never `numeric`/`float`.
- Global business metrics (revenue, net cash, OpEx, order stats) remain UNSCOPED — none of these new tables touch business data; they ONLY hold per-investor personal ledger rows, satisfying the "global business view + per-investor ledger only" decision.

## File changes

| Action | Path | Description |
|---|---|---|
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/common/enums/index.ts` | Add INVESTOR = 'investor' to the Roles enum. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/core/entity/investor-capital-contribution.entity.ts` | New TypeORM entity for capital contributions (investor_id, amount bigint, contributed_at bigint, note, created_by; extends BaseEntity; indexes + ManyToOne to UserEntity). |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/core/entity/investor-ownership-stake.entity.ts` | New TypeORM entity for versioned ownership (investor_id, ownership_bps int, effective_from bigint, effective_to bigint nullable, note, created_by; partial-unique open-stake enforced in migration). |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/core/entity/investor-distribution.entity.ts` | New TypeORM entity for distributions/dividends (investor_id, amount bigint, distributed_at bigint, period_start/end nullable bigint, note, created_by). |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/migrations/1748500000000-InvestorModule.ts` | Migration: ALTER TYPE users_role_enum ADD VALUE 'investor'; CREATE the three investor ledger tables with FKs/indexes/CHECK constraints; add composite IDX_FBH_SOURCE_CREATED on financial_balance_history; partial unique index for one open stake per investor. Down: drop tables + composite index (enum value left in place — Postgres cannot drop enum values). |

**New artifacts:** Roles.INVESTOR enum value ('investor'); Table investor_capital_contribution + InvestorCapitalContributionEntity; Table investor_ownership_stake + InvestorOwnershipStakeEntity (versioned, basis points); Table investor_distribution + InvestorDistributionEntity; Index IDX_FBH_SOURCE_CREATED (source_type, created_at) on financial_balance_history; Partial unique index UQ_IOS_OPEN_STAKE (one open ownership stake per investor); Migration 1748500000000-InvestorModule

**Effort:** 1.5-2 person-days. Three small entities following an established template (~0.5 day), one additive migration with raw SQL matching existing style incl. enum-add and CHECK constraints (~0.5 day), plus reconciliation/testing of the enum ADD VALUE non-transactional caveat and index verification against prod-sized financial_balance_history (~0.5 day). Low complexity because it is purely additive and reuses BaseEntity/bigint transformer/migration conventions verbatim; no changes to existing tables' columns.

**Acceptance criteria:**
- Roles enum includes INVESTOR='investor' and `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'investor'` succeeds idempotently; an admin can create a users row with role='investor'.
- Three tables exist with uuid PK, created_at/updated_at bigint NOT NULL, all money columns bigint (no numeric/float), FKs to users(id) with correct ON DELETE (CASCADE for investor_id, SET NULL for created_by).
- ownership_bps enforced 0..10000 via CHECK; exactly one open stake per investor enforced by partial unique index UQ_IOS_OPEN_STAKE (inserting a second effective_to IS NULL row for the same investor fails).
- amount>0 CHECK enforced on capital contributions and distributions.
- Composite index IDX_FBH_SOURCE_CREATED created on financial_balance_history(source_type, created_at); net_profit range query uses it (EXPLAIN shows index usage).
- Migration up() and down() both run cleanly on a copy of prod schema; down() drops the three tables and the FBH composite index and leaves users_role_enum + existing data intact.
- No new columns added to users, financial_balance_history, cash_box, or any existing business table (fully additive).

**Risks:**
- Postgres `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in older PG and the new enum value is not usable in the same transaction; TypeORM wraps migrations in a transaction. Mitigation: run the ADD VALUE in its OWN migration/step or via queryRunner outside the wrapping tx (PG 12+ allows ADD VALUE in a tx but still not usable until commit) — do NOT insert an investor user in the same migration.
- Enum values cannot be dropped in Postgres, so down() cannot fully reverse the role addition — document this; leaving 'investor' in the enum is harmless.
- Adding IDX_FBH_SOURCE_CREATED on a large production financial_balance_history briefly locks writes; use CREATE INDEX CONCURRENTLY OUTSIDE the migration transaction, or accept a short maintenance window (this table is append-only, moderate size).
- Time-weighted ownership when a stake changes mid-period is a SERVICE concern; if the service naively picks one stake row, ROI could be slightly off across change boundaries — schema supports correct blending via effective_from/effective_to, but the ROI service must implement it.
- Net profit relies on financial_balance_history amount SIGN conventions (SALARY/BILLS/MANUAL_EXPENSE negative). If any writer stores those as positive, the signed SUM breaks — verify sign invariants before wiring the ROI engine.
- Integer-only ownership math (net_profit * bps / 10000) floors fractional UZS; acceptable for UZS but must be applied consistently (multiply before divide) to avoid rounding drift.

**Sequencing:** This is the FOUNDATIONAL slice — it must land BEFORE the ledger service/controller/DTO slice and the ROI-compute slice, since those depend on these tables and the INVESTOR enum value. It can proceed in PARALLEL with the RolesGuard fail-closed fix, but the guard fix (per the locked standards) MUST be merged and deployed BEFORE any INVESTOR JWT is ever issued in production. The composite FBH index and enum-add can ship in the same migration but sequence the enum ADD VALUE as the first statement (and outside any user-insert). No frontend or i18n dependency for this slice. Backfill: NONE required — all three tables start empty; investors and their capital/stake rows are entered by admins post-deploy through the (later) ledger admin UI/endpoints, so no data migration or seed is needed beyond optionally provisioning the first investor users manually.


---

# Backend — new NestJS `InvestorModule` (`/api/investor/*`): read-only, DTO-only, INVESTOR-gated API for the equity investor account, plus a new per-investor capital/ROI ledger. Consumes existing DashboardService / OrderService / CashBoxService / RegionService outputs and maps them into investor-safe DTOs. Also includes the fail-closed RolesGuard fix and INVESTOR role wiring.

# InvestorModule — Backend Design

Base path: `@Controller('investor')`. Every endpoint: `@UseGuards(JwtGuard, RolesGuard)` + `@AcceptRoles(Roles.INVESTOR)` and (per owner standard) additionally allows `Roles.SUPERADMIN, Roles.ADMIN` for provisioning/QA. All handlers are GET (read-only). Every handler returns the existing `successRes(dto, 200, msg)` envelope `{ statusCode, message, data }` where `data` is ALWAYS a DTO instance/array (never a raw entity, never a raw existing-service payload).

Providers: `InvestorController`, `InvestorService` (aggregation/mapper), `InvestorLedgerService` (ledger CRUD-read), `InvestorExportService` (Excel). Injects existing `DashboardService`, `OrderService`, `CashBoxService`, `RegionService`, `ActivityLogService`, plus TypeORM repos for 3 NEW ledger entities. Reuses `toUzbekistanTimestamp`, `getUzbekistanDayRange`, `getSafeLimit`.

---
## 0. PREREQUISITE — fail-closed guard + INVESTOR role (do FIRST)
`roles.guard.ts` line 22 currently `if (!requiredRoles) return true;` (fail-OPEN). Change to fail-CLOSED: if no `@AcceptRoles` present AND the route is under an authenticated controller, `throw new ForbiddenException('No role policy on protected route')`. Because a blanket change could break existing public routes (region GETs have no guard at all — they simply omit `@UseGuards`, so RolesGuard never runs for them; it only runs where `@UseGuards(JwtGuard, RolesGuard)` is applied). Safe minimal fix: when RolesGuard IS on the pipeline but `requiredRoles` is undefined, deny. This is safe because every controller that mounts RolesGuard today ALSO sets `@AcceptRoles`. Add `INVESTOR = 'investor'` to `Roles` enum. No token.ts change needed — payload `{id, role, status}` already carries role; `signInUser` already issues tokens for any non-CUSTOMER role, so an admin-provisioned INVESTOR user logs in through the existing `/users/signin` unchanged.

---
## 1. RESOLVE-RANGE helper (shared, timezone)
`InvestorService.resolveRange(startDate?, endDate?)` — COPY the exact logic from `DashboardService.resolveRange` (Asia/Tashkent, epoch-ms strings): both empty → today; start-only → start→now; end-only → 0→end; both → full range. Returns `{ start: string, end: string }` (epoch-ms). For the revenue endpoint, existing `OrderService.getRevenueStats` takes `YYYY-MM-DD` strings and does its own UZB conversion — pass those through verbatim.

---
## 2. ENDPOINTS + reuse-vs-new mapping

### A. GET `/investor/overview`  (business snapshot)
Reuse `DashboardService.getOverview({startDate,endDate})` → but its payload leaks `topMarkets/topCouriers` names and full `market`/`courier` entities via `getMarketStats/getCourierStats`. So DO NOT return it. Instead call `OrderService.getStats(start,end)` directly. Map → `BusinessOverviewDto`.

### B. GET `/investor/revenue`  (time-series + growth — growth is NEW)
Reuse `OrderService.getRevenueStats(period, startDate, endDate)` (returns `{data:[{period,label,ordersCount,revenue}], summary:{totalRevenue,totalOrders,avgRevenue}}`; `revenue` here = profit = market_tariff−courier_tariff). NEW computation: MoM/YoY growth %. Compute in service: `growthPct[i] = round(((series[i].revenue - series[i-1].revenue) / abs(series[i-1].revenue)) * 100, 2)` (null when prior is 0/absent). YoY: for `monthly` period match same-month-prior-year label; for `yearly` compare adjacent years. Map → `RevenueTimeSeriesDto`.

### C. GET `/investor/net-profit`  (roll-up — NEW)
Reuse `CashBoxService.financialBalanceAnalytics({fromDate,toDate})` which returns `positiveImpact[]` and `negativeImpact[]` grouped by `source_type` with `{source_type,total_amount,transaction_count,percentage}`. NEW roll-up: `sellProfit = positiveImpact.find(SELL_PROFIT).total_amount`; `salary = negativeImpact.find(SALARY).total_amount`; `bills = negativeImpact.find(BILLS).total_amount`; `manualExpense = negativeImpact.find(MANUAL_EXPENSE).total_amount`; `netProfit = sellProfit - (salary + bills + manualExpense)`. Map → `NetProfitRollupDto` (per-source amounts allowed because they are already aggregate category totals — NOT per person). Drop `topTransactions`, `positiveImpact/negativeImpact` raw arrays, `currentBalance` object.

### D. GET `/investor/opex`  (single aggregate — NEW)
Same `financialBalanceAnalytics` source. `totalOpEx = salary + bills + manualExpense` returned as ONE number plus the date range. Map → `OpExAggregateDto` — deliberately NO itemization, NO per-source split (owner decision #4: single aggregate). (The per-category split lives only in net-profit endpoint C which is still category-level, never per-person.)

### E. GET `/investor/cash-position`  (cash + card split)
Reuse `CashBoxService.financialBalance()` → returns `{currentSituation, main(FULL entity incl balance_card/balance_cash), markets:{allMarketCashboxes(per-market names)}, couriers:{allCourierCashboxes(per-courier names+regions)}, difference}`. HEAVY leak. Map to `CashPositionDto` taking ONLY: `netCashPosition = currentSituation`; `cash = main.balance_cash`; `card = main.balance_card`; `couriersReceivable = couriers.couriersTotalBalanse`; `marketsPayable = -markets.marketsTotalBalans`. DROP every per-user array, every card_id, the whole `main` entity. (Owner sensitive list: cashbox-card.card_id/balances denied.)

### F. GET `/investor/order-flow`  (volume by status, success/return rates)
Reuse `OrderService.getStats(start,end)` → `{acceptedCount, cancelled, soldAndPaid, profit}`. NEW derived: `successRate = round(soldAndPaid/acceptedCount*100,2)`; `returnRate = round(cancelled/acceptedCount*100,2)`. Map → `OrderFlowDto`.

### G. GET `/investor/regions`  (map data)
Reuse `RegionService.getAllRegionsStats({startDate,endDate})` → already CLEAN: `{regions:[{id,name,satoCode,districtsCount,couriersCount,totalOrders,deliveredOrders,cancelledOrders,pendingOrders,totalRevenue,successRate}], summary}`. Still wrap in DTO (owner standard: never return the raw service payload). Map 1:1 → `RegionStatDto[] + RegionSummaryDto`. No PII present. Feeds the existing Highcharts Uzbekistan map by satoCode.

### H. GET `/investor/unit-economics`  (NEW)
Reuse `getStats` (soldAndPaid, profit) + `getRevenueStats` summary (totalRevenue=profit-sum, totalOrders). NEW: `revenuePerOrder = round(totalProfit / soldAndPaid)`; `takeRate` = business take = profit / gross. Gross order value (total_price) is NOT in getStats; add a NEW light query `OrderService.getGrossSold(start,end)` = `SUM(total_price) WHERE status IN (sold,paid,partly_paid) AND sold_at BETWEEN`. `takeRatePct = round(totalProfit/gross*100,2)`. Map → `UnitEconomicsDto`.

### I. GET `/investor/leaderboards`  (anonymized/ranked)
Reuse `OrderService.getTopMarkets()`, `getTopCouriers()` (both 5-min cached, `≥30` orders, return `{market_id/courier_id, market_name/courier_name, total_orders, successful_orders, success_rate}`). ANONYMIZE: strip `*_id` and `*_name`; return rank + metrics only. Map → `LeaderboardEntryDto[]` with `rank, label:'Market #'+rank, totalOrders, successfulOrders, successRate`. (Owner: aggregate-only, no per-person identity.) Do NOT call `getTopOperatorsByMarket` (needs a market user context).

### J. GET `/investor/adoption`  (AI + integration adoption — NEW)
NEW aggregate queries (add thin methods, NOT exposing rows):
- AI: `SELECT COUNT(DISTINCT market_id) markets_using, SUM(CASE WHEN type='usage' THEN amount END) total_usage, COUNT(*) tx_count FROM "ai-transaction" WHERE created_at BETWEEN`.
- Integrations: `SELECT COUNT(*) FILTER (WHERE is_active) active_integrations, COUNT(*) total_integrations, SUM(total_synced_orders) synced_orders, COUNT(DISTINCT market_id) markets_integrated FROM external_integration`. NEVER select api_key/api_secret/username/password/auth_url. Map → `AdoptionDto`.

### K. GET `/investor/my-investment`  (personal ledger summary — NEW module)
`InvestorLedgerService.getSummary(user.id, range)`. Reads NEW `investor_profile` (ownership %) + NEW `investor_ledger_entry` (capital contributions, distributions). Computes: `capitalInvested = Σ CAPITAL_CONTRIBUTION`; `ownershipPct` from profile; `accruedProfitShare = ownershipPct/100 × netProfit(range)` (netProfit reused from endpoint C computation); `distributionsPaid = Σ DISTRIBUTION`; `roiPct = round((accruedProfitShare + distributionsPaid - ? ) ...)` → ROI = `(accruedProfitShare / capitalInvested) × 100` for the range (accrued), plus lifetime `realizedRoiPct = distributionsPaid / capitalInvested × 100`. Map → `MyInvestmentDto`.

### L. GET `/investor/my-investment/ledger`  (paginated entries — NEW)
`InvestorLedgerService.listEntries(user.id, {fromDate,toDate,type,page,limit})` with `getSafeLimit`. Map each → `LedgerEntryDto`. Scoped to `investor_id = user.id` ONLY (the sole per-investor scoping in the whole module).

### M. GET `/investor/export`  (aggregated Excel — NEW)
`InvestorExportService.exportOverview({fromDate,toDate})` returns `Buffer` via ExcelJS (same pattern as `exportMainCashboxToExcel`). Sheets: `Overview` (order flow + unit econ), `Revenue` (time-series rows, capped), `Financials` (net-profit rollup, OpEx, cash position), `Regions`, `MyInvestment`. Enforce: date-range REQUIRED (reject if span > 366 days → `BadRequestException`), and row cap via `getSafeLimit` semantics (MAX 5000 rows/sheet). Only AGGREGATE cells — no per-order/per-person rows. Controller sets `Content-Type: application/vnd.openxmlformats-...sheet` + `Content-Disposition` (copy cash-box controller export handler).

---
## 3. DTOs (exact fields — all money `number` bigint-safe, all `@ApiProperty`)

- `BusinessOverviewDto { acceptedCount:number; soldAndPaid:number; cancelled:number; profit:number; from:number; to:number }`
- `RevenuePointDto { period:string; label:string; ordersCount:number; revenue:number; growthPct:number|null; yoyGrowthPct:number|null }`
- `RevenueTimeSeriesDto { period:'daily'|'weekly'|'monthly'|'yearly'; data:RevenuePointDto[]; summary:{ totalRevenue:number; totalOrders:number; avgRevenue:number } }`
- `NetProfitRollupDto { sellProfit:number; salary:number; bills:number; manualExpense:number; totalOpEx:number; netProfit:number; from:number; to:number }`
- `OpExAggregateDto { totalOpEx:number; from:number; to:number }` (single number only)
- `CashPositionDto { netCashPosition:number; cash:number; card:number; couriersReceivable:number; marketsPayable:number }` (NO per-user arrays, NO card_id)
- `OrderFlowDto { acceptedCount:number; soldAndPaid:number; cancelled:number; successRate:number; returnRate:number; from:number; to:number }`
- `RegionStatDto { id:string; name:string; satoCode:string|null; districtsCount:number; couriersCount:number; totalOrders:number; deliveredOrders:number; cancelledOrders:number; pendingOrders:number; totalRevenue:number; successRate:number }`
- `RegionSummaryDto { totalRegions:number; totalOrders:number; totalDelivered:number; totalCancelled:number; totalRevenue:number; avgSuccessRate:number }`
- `UnitEconomicsDto { revenuePerOrder:number; grossSold:number; totalProfit:number; soldOrders:number; takeRatePct:number; from:number; to:number }`
- `LeaderboardEntryDto { rank:number; label:string; totalOrders:number; successfulOrders:number; successRate:number }` → `LeaderboardsDto { markets:LeaderboardEntryDto[]; couriers:LeaderboardEntryDto[] }` (NO ids/names)
- `AdoptionDto { ai:{ marketsUsing:number; totalUsage:number; txCount:number }; integrations:{ activeIntegrations:number; totalIntegrations:number; syncedOrders:number; marketsIntegrated:number } }` (NO secrets/tokens)
- `MyInvestmentDto { capitalInvested:number; ownershipPct:number; accruedProfitShare:number; distributionsPaid:number; accruedRoiPct:number; realizedRoiPct:number; netProfitForRange:number; from:number; to:number }`
- `LedgerEntryDto { id:string; type:'capital_contribution'|'distribution'|'adjustment'; amount:number; note:string|null; occurred_at:number; created_at:number }` (NO created_by user object)
- Query DTOs: `DateRangeQueryDto { startDate?:string; endDate?:string }`, `RevenueQueryDto extends DateRangeQueryDto { period?:'daily'|'weekly'|'monthly'|'yearly' }`, `LedgerQueryDto { fromDate?; toDate?; type?; page?; limit? }`, `ExportQueryDto { fromDate:string; toDate:string }` (required).

---
## 4. NEW ledger entities (own migration)
- `investor_profile` (extends BaseEntity): `user_id uuid (FK users, unique)`, `ownership_pct numeric(7,4)`, `is_active boolean`, `joined_at bigint`.
- `investor_ledger_entry` (extends BaseEntity): `investor_id uuid (FK users)`, `type varchar` (`capital_contribution|distribution|adjustment`), `amount bigint (bigintTransformerNonNull)`, `note varchar null`, `occurred_at bigint`, `created_by uuid null`. Index `(investor_id, occurred_at)`.
- (Optional) `investor_distribution` folded into ledger via `type='distribution'` — keep single table for simplicity (owner #7: distributions tracked separately as a TYPE, accrued share is computed, never stored).
Admin-write endpoints for these are OUT OF SCOPE for this read-only investor module (owner: admin-provisioned) but the entities/migration are prerequisites.

---
## 5. Caching (reuse 5-min TTL pattern)
Copy the `order.service` pattern: `private cache = new Map<string, {data:any; expireAt:number}>()` and `CACHE_TTL = 5*60*1000`. Cache key = `endpoint + ':' + start + ':' + end + ':' + period`. `getTopMarkets/getTopCouriers` are ALREADY cached internally — do not double-cache. Ledger/`my-investment` endpoints are per-investor & mutation-sensitive → NO cache (or 30s). Business aggregate endpoints (overview/revenue/net-profit/opex/cash/regions/unit-econ/adoption) → 5-min TTL.

---
## 6. Access logging (ActivityLogService on EVERY read)
Wrap each handler: after computing DTO, fire-and-forget `activityLog.log({ entity_type:'investor_view', entity_id: user.id, action:'read:<endpoint>', user, metadata:{ endpoint, filters:{startDate,endDate,period,type,page,limit}, scope:'aggregate'|'personal', rowCount } })`. `log()` auto-captures IP/device from request-context (AsyncLocalStorage) — no call-site change needed. For exports also log `action:'export'` with byte/row size. Implemented via a small `logInvestorRead(user, endpoint, filters, scope, rowCount?)` private helper on `InvestorService` to avoid repetition. Do NOT reuse `enrichLogs()` (it LEAKS customer_name/phone) — only `log()`.

---
## 7. Module registration
`InvestorModule` imports `TypeOrmModule.forFeature([InvestorProfileEntity, InvestorLedgerEntryEntity])` and imports `DashboardModule, OrderModule, CashBoxModule, RegionModule, ActivityLogModule` (must export their services). Register `InvestorModule` in `api/app.module.ts` imports array. Verify each reused module `exports:` its service (DashboardModule/OrderModule likely already export; CashBoxModule/RegionModule need an `exports:[CashBoxService]` / `[RegionService]` check — flagged as risk).

## File changes

| Action | Path | Description |
|---|---|---|
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/common/guards/roles.guard.ts` | Fix fail-open → fail-closed: when RolesGuard is on the pipeline but no @AcceptRoles metadata is found, throw ForbiddenException instead of returning true (line 22). Must land before any INVESTOR token is issued. |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/common/enums/index.ts` | Add INVESTOR = 'investor' to Roles enum. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/investor.controller.ts` | New controller @Controller('investor'); GET endpoints overview, revenue, net-profit, opex, cash-position, order-flow, regions, unit-economics, leaderboards, adoption, my-investment, my-investment/ledger, export. All @UseGuards(JwtGuard,RolesGuard) @AcceptRoles(Roles.INVESTOR,...admins). Export handler streams Buffer with xlsx headers (copy cash-box export handler). |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/investor.service.ts` | Aggregation/mapper. resolveRange (copied from DashboardService). Calls existing DashboardService/OrderService/CashBoxService/RegionService, maps outputs → safe DTOs, computes growth %, net-profit roll-up, total OpEx, unit economics, anonymized leaderboards, adoption. 5-min TTL cache map. logInvestorRead() helper. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/investor-ledger.service.ts` | Per-investor ledger reads: getSummary(userId,range) computing capitalInvested, ownershipPct, accruedProfitShare = ownershipPct × netProfit(range), distributionsPaid, ROI %; listEntries(userId,filters) paginated with getSafeLimit. Scoped strictly to investor_id=user.id. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/investor-export.service.ts` | ExcelJS aggregated export (copy exportMainCashboxToExcel pattern). Requires date range, rejects span>366d, caps rows at 5000/sheet, aggregate cells only. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/investor.module.ts` | Module: TypeOrmModule.forFeature([InvestorProfileEntity, InvestorLedgerEntryEntity]); imports DashboardModule, OrderModule, CashBoxModule, RegionModule, ActivityLogModule; declares controller + 3 services. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/dto/investor.dto.ts` | All response DTO classes (BusinessOverviewDto, RevenueTimeSeriesDto/RevenuePointDto, NetProfitRollupDto, OpExAggregateDto, CashPositionDto, OrderFlowDto, RegionStatDto/RegionSummaryDto, UnitEconomicsDto, LeaderboardsDto/LeaderboardEntryDto, AdoptionDto, MyInvestmentDto, LedgerEntryDto) with @ApiProperty. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/dto/investor-query.dto.ts` | Query DTOs: DateRangeQueryDto, RevenueQueryDto, LedgerQueryDto, ExportQueryDto (fromDate/toDate required). |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/core/entity/investor-profile.entity.ts` | investor_profile entity: user_id, ownership_pct numeric(7,4), is_active, joined_at. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/core/entity/investor-ledger-entry.entity.ts` | investor_ledger_entry entity: investor_id, type, amount bigint, note, occurred_at, created_by; index (investor_id, occurred_at). |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/api/app.module.ts` | Import and register InvestorModule in the imports array. |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/api/order/order.service.ts` | Add getGrossSold(start,end) = SUM(total_price) for sold/paid/partly_paid in range (for take-rate); add getAdoptionAiStats / or expose repos. Ensure OrderService is exported by OrderModule. |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/api/cash-box/cash-box.module.ts` | Ensure CashBoxService is in exports[] so InvestorModule can inject it. |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/api/region/region.module.ts` | Ensure RegionService is in exports[] so InvestorModule can inject it. |

**New artifacts:** Roles.INVESTOR enum value; InvestorModule; InvestorController (13 GET routes under /investor); InvestorService (aggregation + growth%/net-profit/opex/unit-econ/anonymized leaderboards/adoption + 5-min cache + logInvestorRead); InvestorLedgerService (my-investment summary + paginated ledger); InvestorExportService (aggregated Excel); GET /investor/overview; GET /investor/revenue; GET /investor/net-profit; GET /investor/opex; GET /investor/cash-position; GET /investor/order-flow; GET /investor/regions; GET /investor/unit-economics; GET /investor/leaderboards; GET /investor/adoption; GET /investor/my-investment; GET /investor/my-investment/ledger; GET /investor/export; BusinessOverviewDto, RevenueTimeSeriesDto, RevenuePointDto, NetProfitRollupDto, OpExAggregateDto, CashPositionDto, OrderFlowDto, RegionStatDto, RegionSummaryDto, UnitEconomicsDto, LeaderboardsDto, LeaderboardEntryDto, AdoptionDto, MyInvestmentDto, LedgerEntryDto; DateRangeQueryDto, RevenueQueryDto, LedgerQueryDto, ExportQueryDto; InvestorProfileEntity (investor_profile); InvestorLedgerEntryEntity (investor_ledger_entry); OrderService.getGrossSold(start,end); DB migration for investor_profile + investor_ledger_entry

**Effort:** 6-8 person-days. Guard fix + role wiring 0.5d. Ledger entities + migration + ledger service 1.5d. Aggregation service (mapping 8 reused services into safe DTOs + growth/net-profit/opex/unit-econ/anonymized leaderboards/adoption) 2.5d. DTOs + controller + access logging + caching 1.5d. Excel export with caps 1d. Verifying/adding module exports and integration testing 0.5-1d. Bulk of effort is the safe-DTO mapping and the NEW computations (growth %, net-profit roll-up, ROI), not new data access — most reads reuse existing methods.

**Acceptance criteria:**
- RolesGuard denies (403) any route that mounts it without @AcceptRoles; existing guarded routes still work for their roles; no public route regresses.
- An admin-provisioned INVESTOR user logs in via existing /users/signin and receives a token with role 'investor'; no other role can reach /investor/* and INVESTOR cannot reach admin routes.
- Every /investor/* response body's data is a DTO (or DTO array) — no raw TypeORM entity, no raw reused-service payload; grep confirms no customer_name/customer_phone/address/salary_amount/card_id/api_key/password/market_tg_token field ever serialized.
- /investor/cash-position returns only netCashPosition/cash/card/couriersReceivable/marketsPayable — no per-courier or per-market names/regions, no card ids.
- /investor/net-profit netProfit == sellProfit − (salary+bills+manualExpense) and matches financialBalanceAnalytics category totals for the same range; /investor/opex returns a single totalOpEx number.
- /investor/revenue includes growthPct (MoM) and yoyGrowthPct computed correctly (null when no prior period).
- /investor/leaderboards entries carry rank + metrics only (no ids, no names).
- /investor/my-investment accruedProfitShare == ownershipPct/100 × netProfit(range); ledger endpoint is scoped to the caller's investor_id and paginates via getSafeLimit.
- Every investor read writes an ActivityLog entry (entity_type='investor_view') with endpoint, filters, scope, and IP/device auto-captured; exports also logged.
- Aggregate business numbers are identical for every investor account (no per-investor scoping of business data).
- /investor/export requires a date range, rejects spans >366 days and caps rows per sheet; produces a valid .xlsx with aggregate-only cells.
- Business aggregate endpoints honor a 5-min TTL cache; my-investment/ledger are not stale-cached.

**Risks:**
- financialBalance() and financialBalanceAnalytics() compute over ALL-TIME balance state; the date-range filters only bound the history query, while currentSituation/currentBalance are point-in-time totals. Cash-position 'net' is inherently current, not range-bounded — must document this to avoid investor confusion (label 'current' vs range metrics).
- 'Revenue' in getRevenueStats is actually PROFIT (market_tariff − courier_tariff), and cash-box financialBalance()'s 'profit' label is really CASH POSITION. Mislabeling risk — DTO field names must be precise (revenue vs profit vs netCashPosition) and i18n labels must match owner's definitions.
- Reused CashBoxService / RegionService may not be in their module's exports[]; injecting them into InvestorModule will fail at bootstrap until exports are added (flagged as file changes).
- Net-profit roll-up depends on financial-balance-history being the single source of truth; if SELL_PROFIT/SALARY/BILLS/MANUAL_EXPENSE are not consistently written there, netProfit will diverge from reality. Needs reconciliation check against getStats.profit.
- Anonymized leaderboards use getTopMarkets/getTopCouriers which cache globally and require ≥30 orders — small/new datasets may return empty; frontend must handle empty gracefully.
- ROI semantics: accrued (ownership×netProfit) vs realized (distributions/capital) can mislead if presented as one number; must expose both fields distinctly per owner decision #7.
- Fail-closed guard change is global; a hidden route that mounts RolesGuard without @AcceptRoles would start 403-ing. Must grep all @UseGuards(...,RolesGuard) sites and confirm each pairs with @AcceptRoles before shipping.
- bigint money: growth %/ROI/take-rate divisions must guard zero denominators and avoid float precision loss on large UZS sums (use Number only after aggregation, round to 2 dp).

**Sequencing:** MUST come first (blocking, owner non-negotiable): (1) fail-closed RolesGuard fix + audit of all RolesGuard+@AcceptRoles pairings, (2) add Roles.INVESTOR — both before any INVESTOR token can be issued. THEN: create the two ledger entities + migration (my-investment endpoints depend on them). THEN: verify/add CashBoxService & RegionService & OrderService exports. THEN: build DTOs → InvestorService/aggregation → controller → access logging → caching. Export service last (depends on all aggregation methods). This slice depends on: the parallel frontend slice (routes/sidebar/RequireRole 'investor', i18n 'investor' namespace uz/ru/en) which consumes these endpoints — backend must land first so frontend has real DTOs to bind. Admin provisioning of investor users + ledger-write endpoints are a SEPARATE downstream slice (out of scope here) but the entities created here are its prerequisite. Do NOT expose any admin-write in this read-only module.


---

# Security Hardening & RBAC Integration for INVESTOR account (server-side auth/guard/serialization/audit layer)

## Audit result (drives everything below)

I ran a definitive per-handler decorator-block scan across all 18 controllers that reference `RolesGuard`. **Result: ZERO handlers have `RolesGuard` in their chain but lack `@AcceptRoles`.** Every RolesGuard-protected handler already declares roles (method-level, or class-level on `printer`, `ai-balance`, `bot-broadcast`, `ldg-config`, `ldg-admin`). The public auth endpoints (`POST users/signin`, `users/telegram/signin`, `users/refresh`) have NO guards at all, and `users/telegram/link`, `users/signout` use `@UseGuards(JwtGuard)` only (no RolesGuard). **Therefore flipping RolesGuard to fail-closed is SAFE — nothing in the codebase depends on the fail-open branch.** This is the single most important finding: the flip is low-risk, but it MUST be gated by an automated verification so future controllers can't silently regress.

Naive scans give false positives because this codebase interleaves `@ApiQuery`/`@ApiOperation`/`@UseGuards` between `@Get()` and `@AcceptRoles` (e.g. `dashboard.controller.ts` `getOverview` has `@AcceptRoles` at line 29, 12 lines below `@Get('overview')`). The reliable audit walks the full decorator block from each HTTP-method decorator down to the method signature and also honors class-level decorators.

---

## 1. Fail-closed RolesGuard fix + safe rollout

**File:** `server/src/common/guards/roles.guard.ts`

Change line 22 from fail-open to fail-closed. Because `RolesGuard` is applied per-handler/per-class (NOT globally), a handler reaching this guard has explicitly opted into role-checking, so absence of `@AcceptRoles` is a developer bug and must deny:

```
canActivate(context): boolean {
  const requiredRoles = this.reflector.getAllAndOverride<string[]>(
    ROLES_KEY, [context.getHandler(), context.getClass()]);
  // FAIL-CLOSED: a handler guarded by RolesGuard MUST declare @AcceptRoles.
  if (!requiredRoles || requiredRoles.length === 0) {
    // log the misconfiguration for observability, then deny
    throw new ForbiddenException('Endpoint has no role policy (fail-closed)');
  }
  const { user } = context.switchToHttp().getRequest();
  if (!user?.role || !requiredRoles.includes(user.role)) {
    throw new ForbiddenException('Forbidden user');
  }
  return true;
}
```
Also harden the existing `!requiredRoles.includes(user?.role)` line: when `user` is undefined (JwtGuard somehow bypassed) it currently still throws Forbidden, which is fine, but make `user?.role` explicit as above.

**Verification procedure (must pass BEFORE and AFTER the flip, and in CI):** the awk block below prints any RolesGuard-guarded handler lacking `@AcceptRoles`. It walks each handler's decorator block to the method signature and honors class-level guard/roles. Empty output = safe to flip. Run per controller:
```
for f in $(grep -rln "RolesGuard" server/src/api --include=*.controller.ts); do
  awk '/export class/{c=1}
    !c && /@UseGuards\(/ && /RolesGuard/ {cg=1}
    !c && /@AcceptRoles/ {cr=1}
    c && /@(Get|Post|Patch|Put|Delete)\(/ {
      s=NR; br=0; bg=0;
      while((getline n)>0){ if(n~/@AcceptRoles/)br=1; if(n~/RolesGuard/)bg=1;
        if(n!~/^[ \t]*@/ && n~/[A-Za-z0-9_]+[ \t]*\(/){break} }
      if((cg||bg) && !(cr||br)) printf "%s:%d UNPROTECTED\n", FILENAME, s
    }' "$f"
done
```

**Rollout / testing plan:**
1. Run the verification script; confirm empty (it is today).
2. Add it as a CI gate (npm script `audit:roles`) that fails the build on any output — this is what makes the fail-closed flip permanently safe.
3. Add unit tests for `RolesGuard`: (a) no metadata → throws Forbidden; (b) empty array → throws; (c) role not in list → throws; (d) role in list → true; (e) undefined user → throws.
4. Deploy behind a smoke test hitting one endpoint per role (admin/courier/market/registrator/logist/operator) to prove no regression.
5. Rollback plan: single-line revert of the guard; no data/migration coupling.

---

## 2. INVESTOR role + JWT payload flow (no scopes)

- **`server/src/common/enums/index.ts`** — add `INVESTOR = 'investor'` to the `Roles` enum. Global business view means NO scopes are needed; the existing `{ id, role, status }` payload is sufficient.
- **`server/src/common/utils/types/user.type.ts`** — no shape change required (role is `string`). Optionally tighten `role: Roles` for type-safety, but keep `string` to avoid churn.
- **`server/src/infrastructure/lib/token-generator/token.ts`** — no change; it signs whatever payload it is given.
- **`server/src/api/users/users.service.ts` (signin, ~line 1690)** — no change to payload construction; `{ id, role, status }` already carries `role: 'investor'`. Because signin filters `role: Not(Roles.CUSTOMER)`, INVESTOR is already allowed to authenticate through the same path. Admin-provisioned creation (a new `createInvestor` service method, out of scope for this slice but sequenced by the ledger team) must set `role = Roles.INVESTOR`, `status = ACTIVE`, and store a bcrypt password — reuse existing user-creation pattern.
- INVESTOR tokens use the SAME access/refresh TTLs. Recommend a SHORTER access TTL for investor tokens is out of scope unless the config supports per-role TTL; note as a risk.

---

## 3. DTO / serialization boundary as a hard control

Today there is **no `ClassSerializerInterceptor` and no `@Exclude/@Expose` anywhere**; controllers return plain objects wrapped by `successRes()`. Raw TypeORM entities ARE returned in places (e.g. `external-integration.findAll` returns entities with relations). Relying on a global serializer retrofit is risky. Adopt an **explicit DTO-only pattern for the Investor module** plus a defense-in-depth interceptor scoped to investor controllers:

- Create a dedicated `InvestorModule` whose controllers are the ONLY endpoints an INVESTOR token can reach (do NOT add `Roles.INVESTOR` to any existing admin controller's `@AcceptRoles`). This makes the boundary structural: investor data flows through hand-written mapper functions that build DTOs from aggregate query results, never from entities.
- Add `@UseInterceptors(ClassSerializerInterceptor)` + `@SerializeOptions({ strategy: 'excludeAll' })` on the investor controller base, and define every investor response class with `@Expose()` on each allowed field. `excludeAll` means any field not explicitly `@Expose()`d is dropped even if a mapper accidentally leaks it — a fail-closed serializer.
- Convention/lint: an ESLint rule (or the CI `audit:roles` companion `audit:investor-dto`) asserting that no file under `api/investor/**/*.controller.ts` imports any `*.entity` and that every handler's return type is an `*ResponseDto`. Enforce that investor service methods return DTO types, not entity types, via TypeScript return-type annotations.
- The existing `successRes(dto)` wrapper is fine — it wraps the DTO, it doesn't reintroduce entity fields.

---

## 4. ALLOW/DENY field matrix + structural enforcement

**ALLOWED (aggregate-only, whole-business):** revenue totals + averages (from `getRevenueStats`), profit = `SELL_PROFIT − (SALARY + BILLS + MANUAL_EXPENSE)` roll-up, net cash position (`financialBalance()`), total OpEx as ONE summed number, order counts by status (from `getStats`, excluding CREATED drafts + synthetic partly-sold children), region aggregate stats for the Highcharts map, top-markets/top-couriers leaderboards that are already aggregate (≥30 orders), and the per-investor ledger (own capital contributions, ownership %, distributions, accrued ROI = ownership% × net profit).

**DENIED (never reachable by INVESTOR token, never in a DTO):** `order.customer_name/customer_phone/address/customer_id/operator_phone`; any raw order/order-item rows; `user-salary.salary_amount/have_to_pay`; per-operator `operator-earning`/`operator-payment` rows; `cashbox-card.card_id` and card balances; `users.password`; `market_tg_token`; external-integration secrets (`api_key/api_secret/username/password/auth_url`); raw activity-log rows (the `enrichLogs()` path LEAKS `customer_name/phone` — investor endpoints MUST NOT call `getAllLogs`/`getLogsByEntity`/`enrichLogs`); OpEx broken down per person (only the single summed figure is allowed).

**Structural enforcement (three layers):**
1. Investor endpoints live in `InvestorModule` and reuse ONLY aggregate service methods (`getRevenueStats`, `getStats`, `financialBalance`, region stats). They never touch order/user/salary/card/log repositories directly.
2. DTOs are `excludeAll` + `@Expose()` allow-list (item 3) — any leak is dropped by the serializer.
3. The OpEx summation and profit roll-up happen in the investor service so no itemized array ever crosses the boundary. Reuse the `INTEGRATION_SECRET_FIELDS`/`splitSecrets` masking precedent from `external-integration.service.ts` as the pattern for a shared `INVESTOR_DENY_FIELDS` set used by a mapper-time assertion in tests.

---

## 5. Access logging design

Add a `@LogInvestorAccess(action: string)` decorator + a `LogInvestorAccessInterceptor` applied to the investor controllers. On each successful response it calls the existing `ActivityLogService.log()` (which already auto-captures IP/device via `getRequestAuditMeta()` from `request-context.ts`) with:
- `entity_type: 'investor_access'`, `action` (e.g. `view_dashboard`, `view_revenue`, `export_excel`), `entity_id` = investor user id, `user` = `req.user` (`{ id, role }`), and `metadata` = the request filters (`{ startDate, endDate, period, path }`) captured from `req.query`/`req.params`.
- It uses `ActivityLogService.log()` for WRITE only — it must NEVER read back via `enrichLogs()` (which leaks PII). Investors get no access to the activity-log read endpoints at all.
- Logging is best-effort (the service already swallows write errors) so it never blocks the response, but a failure is `console.error`-visible.

Files: new `server/src/common/decorator/log-investor-access.decorator.ts` and `server/src/common/interceptors/log-investor-access.interceptor.ts`; interceptor injects `ActivityLogService` (export it from a shared module already imported by InvestorModule).

---

## 6. Negative-test plan (proves INVESTOR cannot write or read denied fields)

Integration/e2e tests using a minted INVESTOR JWT:
- **Write-deny matrix:** for EVERY controller, assert INVESTOR token → 403 on every `@Post/@Patch/@Put/@Delete` (order create/update/delete, cashbox mutations, integration create/update/delete, ai-balance topup, ldg redispatch, user create). Drive this from the audit script's handler list so new write endpoints are auto-covered.
- **Read-deny:** INVESTOR token → 403 on `dashboard/overview` (admin-only), `activity-log`, `cash-box` detail endpoints, `order` list/detail, `users`, `external-integration`, `integration-sync`. Assert only the investor endpoints return 200.
- **Field-leak assertions:** snapshot each investor endpoint response and assert the JSON contains NONE of the deny-list keys (`customer_name`, `customer_phone`, `address`, `salary_amount`, `have_to_pay`, `card_id`, `password`, `api_key`, `api_secret`, `market_tg_token`, `operator_phone`, raw `order` arrays). Implement as a recursive key-scan over the response body.
- **Guard unit tests** from item 1.
- **Token-tamper test:** a JWT with `role` mutated to `admin` but signed with wrong secret → 401 (JwtGuard verify fails); a valid INVESTOR token on an admin route → 403.

---

## 7. Threat model for an external-facing read account + mitigations

- **Brute force / credential stuffing:** today `logFailedLogin` only LOGS; there is NO lockout and NO rate limiter (`@nestjs/throttler` not installed). Mitigation: install `@nestjs/throttler`, add a global `ThrottlerGuard` (e.g. 10 req/10s default) and a stricter named throttle on `POST users/signin` (e.g. 5/min per IP), plus progressive lockout after N failures per account (reuse `logFailedLogin` counts). This is the top gap.
- **Token theft / replay:** access tokens are Bearer JWTs with the same TTL as staff. Mitigation: recommend shorter access-token TTL for investor tokens (per-role TTL in `token.ts`/config) and rely on refresh-cookie rotation; ensure refresh cookie is `httpOnly`, `secure`, `sameSite` (verify `writeToCookie`). JwtGuard already rejects tampered/expired tokens.
- **CORS over-permissiveness:** `enableCors({ origin: true, credentials: true })` reflects ANY origin with credentials — risky for an external account. Mitigation: pin `origin` to the known web app origin(s) for credentialed requests.
- **Data exfiltration via export:** aggregated Excel only, enforced by (a) date-range required + max span, (b) hard row-size cap, (c) `@LogInvestorAccess('export_excel')` on the export endpoint capturing range/row-count, and (d) a per-account export rate limit via throttler. Export must go through the same aggregate service methods (no raw rows).
- **Enumeration / IDOR:** global scope means there are no per-investor object IDs to enumerate for business data; the only per-investor resource is the ledger, which must be scoped to `req.user.id` server-side (never trust a client-supplied investor id). Assert this in tests.
- **Missing security headers:** `helmet` not installed. Mitigation: add `helmet()` in `app.service.ts` bootstrap.
- **Swagger exposure:** already correctly gated to non-production — keep it.

**Exact change locations summary:** `roles.guard.ts` (line 22 flip), `enums/index.ts` (add INVESTOR), new `api/investor/*` module/controllers/DTOs, new `common/decorator/log-investor-access.decorator.ts` + `common/interceptors/log-investor-access.interceptor.ts`, `api/app.service.ts` (throttler guard + helmet + pin CORS), `package.json` (`@nestjs/throttler`, `helmet`), CI scripts `audit:roles` + `audit:investor-dto`.

## File changes

| Action | Path | Description |
|---|---|---|
| modify | `server/src/common/guards/roles.guard.ts` | Flip fail-open to fail-closed at line 22: throw ForbiddenException when requiredRoles is undefined/empty; harden the user?.role check to deny when user or role is missing. |
| modify | `server/src/common/enums/index.ts` | Add INVESTOR = 'investor' to the Roles enum. No scope enum needed (global business view). |
| create | `server/src/common/decorator/log-investor-access.decorator.ts` | New @LogInvestorAccess(action) metadata decorator consumed by the interceptor. |
| create | `server/src/common/interceptors/log-investor-access.interceptor.ts` | New interceptor that on successful response calls ActivityLogService.log with entity_type 'investor_access', the action, investor id, and request filters as metadata. Write-only; never calls enrichLogs. |
| modify | `server/src/api/app.service.ts` | Register global ThrottlerGuard (@nestjs/throttler), add helmet() middleware, and pin CORS origin to known web app origin(s) instead of origin:true when credentials are used. |
| modify | `server/src/api/users/users.service.ts` | Add per-account failed-login lockout using existing logFailedLogin counts, and add a stricter named throttle on the signin path. Payload build (~line 1690) unchanged; investor role flows through {id,role,status} as-is. |
| modify | `server/package.json` | Add @nestjs/throttler and helmet dependencies; add CI scripts audit:roles (guarded-handler-without-AcceptRoles scan) and audit:investor-dto (no entity imports in investor controllers). |
| create | `server/src/common/guards/roles.guard.spec.ts` | Unit tests: no metadata denies, empty array denies, role-not-in-list denies, role-in-list allows, undefined user denies. |
| create | `server/test/investor-negative.e2e-spec.ts` | e2e negative tests: INVESTOR token gets 403 on all write endpoints and all admin read endpoints; investor endpoint responses contain none of the deny-list keys (recursive scan); token-tamper -> 401. |

**New artifacts:** Roles.INVESTOR enum value ('investor'); @LogInvestorAccess(action) decorator; LogInvestorAccessInterceptor; ThrottlerGuard (global) + named signin throttle; helmet security-headers middleware; INVESTOR_DENY_FIELDS shared deny-list constant (mirrors INTEGRATION_SECRET_FIELDS precedent) used in field-leak tests/assertions; ClassSerializerInterceptor + @SerializeOptions({strategy:'excludeAll'}) applied to investor controllers; CI scripts: audit:roles and audit:investor-dto; roles.guard.spec.ts unit tests; investor-negative.e2e-spec.ts negative-test suite

**Effort:** 3-4 person-days. Guard flip + unit tests + audit script: 0.5d (verified zero blast radius, so low). INVESTOR enum + provisioning wiring: 0.25d. Access-logging decorator/interceptor: 0.5d. Serializer/DTO-only convention + lint/CI: 0.5d. Throttler + helmet + CORS pinning + login lockout: 1d. Negative-test + field-leak e2e suite: 1d. Estimate excludes the ledger module and dashboard DTO endpoints themselves (other slices); this is purely the security/RBAC hardening layer.

**Acceptance criteria:**
- RolesGuard denies (403) when @AcceptRoles is absent/empty; verified by unit tests and the audit script returning empty across all controllers.
- CI fails if any RolesGuard-guarded handler lacks @AcceptRoles (audit:roles gate) or any investor controller imports an *.entity (audit:investor-dto gate).
- Roles.INVESTOR exists; an admin-provisioned investor can log in via existing signin and receives a JWT with role='investor'; no scopes added.
- INVESTOR token receives 403 on every write endpoint (Post/Patch/Put/Delete) and on all admin read endpoints (dashboard/overview, activity-log, cash-box detail, order, users, external-integration, integration-sync).
- Every investor endpoint response, recursively scanned, contains none of: customer_name, customer_phone, address, customer_id, operator_phone, salary_amount, have_to_pay, card_id, password, api_key, api_secret, market_tg_token, and no raw order/order-item arrays.
- Investor responses are DTOs produced under excludeAll serialization; a deliberately-leaked field in a mapper is dropped by the serializer (test).
- Every successful investor request writes an activity-log row (entity_type 'investor_access') with actor id, action, IP/device, and filters; no investor path calls enrichLogs.
- signin is rate-limited and accounts lock after repeated failures; excessive requests get 429.
- helmet security headers present on responses; CORS no longer reflects arbitrary origins for credentialed requests.
- Aggregated Excel export enforces required date-range, max span, and row-cap, is rate-limited, and is access-logged.

**Risks:**
- CORS change (origin:true -> pinned) could break the existing web app if the deployed origin list is incomplete; requires confirming all production/staging origins before the flip.
- Adding a global ThrottlerGuard affects ALL endpoints, not just investor; limits must be set high enough not to throttle legitimate staff bursts (e.g. bulk order operations, printer, LDG sync callbacks). Consider @SkipThrottle on internal/webhook routes.
- The activity-log enrichLogs() PII leak is a latent hazard: if any future investor endpoint reuses log-read services it re-exposes customer PII. Enforced only by convention + tests, not structurally.
- ClassSerializerInterceptor with excludeAll is new to this codebase (no existing @Expose usage); mis-annotation drops legitimate fields — needs snapshot tests per DTO.
- Per-role shorter token TTL depends on config/token.ts supporting per-call expiresIn; if not, investor tokens keep staff TTL (accepted risk, noted).
- logFailedLogin currently only logs; adding lockout introduces stateful failure counting that must not lock out legitimate users (needs per-IP+account window and reset-on-success).
- Refresh cookie flags (httpOnly/secure/sameSite) in writeToCookie must be verified; if missing, token theft risk remains despite short access TTL.

**Sequencing:** MUST come first (blocks issuing any INVESTOR token, per owner standard): (1) fail-closed RolesGuard flip + audit:roles CI gate + guard unit tests, verified empty across all controllers. Then (2) add Roles.INVESTOR. These two are prerequisites for the ledger/dashboard slices. The LogInvestorAccess decorator/interceptor, ClassSerializerInterceptor convention, and INVESTOR_DENY_FIELDS constant must exist BEFORE the investor dashboard/ledger endpoints are built, because those endpoints are required to use them. Throttler/helmet/CORS/login-lockout hardening can land in parallel but should be in production BEFORE the investor account is externally exposed. The negative-test e2e suite must be wired to run in CI and should be extended by each subsequent slice that adds investor endpoints. This slice depends on nothing from the ledger module; the ledger/dashboard slices depend on this slice's guard flip, INVESTOR role, serializer convention, and access-logging interceptor.


---

# Frontend / UX — Investor account (React Feature-Sliced Design)

## Overview

The investor role gets a self-contained FSD "vertical": a dedicated sidebar, 4 pages under `src/pages/investor/*`, one React Query hooks module `useInvestor`, one `investor` i18n namespace in uz/ru/en, and small reuse of existing chart/card components. All data comes from investor-only backend DTO endpoints (built by the backend-architect) under an `investor/*` route prefix. Money is UZS bigint returned as string; the frontend formats with `Intl.NumberFormat('uz-UZ')` and Asia/Tashkent dates via a shared formatter.

Key integration facts already verified in the codebase:
- Role is resolved in `src/pages/auth/index.tsx` from `GET user/profile` -> `dispatch(setRole(res.data.data.role))`. When backend returns `role: "investor"`, the store + `RequireRole` (which reads `s.roleSlice.role`) work automatically. No change to auth flow needed beyond the role string being accepted.
- `DashboardLayout.tsx` switches sidebar by `role as UserRole`. Add a `case "investor"`.
- The index route `{ index: true, element: <Dashboards /> }` renders the per-role `src/pages/dashboards/index.tsx`, which branches on role and has NO investor branch. Investor must NOT land on `/` (it would render an empty admin-style dashboard). Instead investor lands on `/investor/overview`.
- `RequireRole` fallback currently sends non-admin roles to `/` (the index Dashboards). For investor that is wrong. Fix the fallback so investor is redirected to `/investor/overview`.
- Hook pattern: a `useX()` factory returning `getX` closures that call `useQuery({ queryKey:[key, params], queryFn: () => api.get(url,{params}).then(r=>r.data) })`. Cache keys are string constants exported from the hook module. React Query default staleTime is short; to honor the 5-min TTL, set `staleTime: 5*60*1000` on read hooks.
- Export helper `src/shared/helpers/export-download-excel.ts` exists but is CLIENT-side and PII-oriented (looks for `telefon`/`narxi` columns). For the investor AGGREGATED export we must instead download a server-generated blob (server enforces date-range + row-size limits). Add a small `getInvestorExport` that requests `responseType:'blob'` and saves via `file-saver` (already a dependency).

---

## 1. Information Architecture — sidebar + pages

### InvestorSidebar links (order = business narrative)
1. Overview  -> `/investor/overview`  (icon `LayoutDashboard`)
2. Financials -> `/investor/financials` (icon `DollarSign`)
3. Operations -> `/investor/operations` (icon `Package`)
4. My Investment -> `/investor/my-investment` (icon `PieChart`)
5. Profile -> `/profile` (reuse existing profile page; icon `UserRound`)

No Settings, Users, Payments, Orders, Regions config, or any per-person page.

### Page A — Overview (`/investor/overview`)
Purpose: 30-second health snapshot, all aggregate.
Wireframe (top to bottom):
- Header row: title `t('overview.title')`, subtitle, and a shared `<DateRangeFilter>` (RangePicker desktop / CustomCalendar mobile) + Export button (aggregated, disabled on Overview or exports the KPI summary — recommend enabling only on Financials/Operations; on Overview omit export).
- KPI hero cards grid `grid-cols-2 sm:grid-cols-4` reusing the `StatCard` visual (extract from dashboards page into shared) with growth badges:
  - Net Profit (period) — green gradient, growth % vs previous period.
  - Revenue (period) — blue gradient, growth %.
  - Net Cash Position — indigo gradient (label makes clear this is cash on hand, not profit).
  - Total OpEx (period) — amber gradient (single aggregate: payroll+bills+manual).
- Full-width trend: reuse `<RevenueChart>` (area chart, daily/weekly/monthly/yearly toggle) but pointed at investor revenue endpoint (see hooks). Add a second series or a separate small profit sparkline card.
- Two mini panels row (`grid-cols-1 lg:grid-cols-2`):
  - "My return snapshot" card: ownership %, accrued profit share this period, ROI % (links to My Investment).
  - "Order flow" mini card: total / sold / cancelled counts with success rate badge (aggregate only).

### Page B — Financials (`/investor/financials`)
Purpose: revenue, profit, cash, OpEx with growth %.
Wireframe:
- Header + `<DateRangeFilter>` + Export button (aggregated Excel).
- 4 KPI StatCards with previous-period growth %: Revenue, Net Profit, Net Cash Position, Total OpEx. Each card shows a small delta arrow (reuse the trend markup already in `RevenueChart`'s `SummaryCard`).
- `<RevenueChart>` full width (revenue trend, period toggle).
- New `<ProfitVsOpExChart>` (recharts stacked/grouped bars or composed): per bucket shows Revenue (or SELL_PROFIT) vs OpEx, with Net Profit as an overlaid line. Data from investor financials series.
- OpEx composition: a single aggregate number is the product rule, so do NOT itemize by category. Show one "Total OpEx" figure with period growth. (If the owner ever relaxes this, a donut could be added; for now keep it a single figure to honor decision #4.)
- Net cash position history: small area chart (reuse RevenueChart-style area) fed by investor cash-history series.

### Page C — Operations (`/investor/operations`)
Purpose: order flow, delivery/return rates, regional map, leaderboards (all aggregate, no PII).
Wireframe:
- Header + `<DateRangeFilter>` + Export button.
- KPI StatCards: Total Orders, Sold, Delivered rate %, Return/Cancel rate % (badges).
- Regional map: reuse `<StatisticsMap>` (Highcharts UZ map) fed by investor region-stats endpoint (aggregate counts + success rate per region; NO courier/operator names). Pass `onRegionClick` = undefined (read-only, no drilldown to per-person).
- Two `<Leaderboard>` panels (`grid-cols-1 lg:grid-cols-2`): Top Markets and Top Couriers by success rate / volume. Reuse existing `<Leaderboard type="markets|couriers">`. IMPORTANT: pass `currentUserId={undefined}` and ensure backend DTO returns only display name + aggregate stats (no phone/id-linked PII). Do NOT render operators leaderboard (per-market operator data is closer to per-person; safest to exclude, or include only if backend confirms name-only).
- `<SalesChart>` reuse for market/courier order distribution bars.

### Page D — My Investment (`/investor/my-investment`)
Purpose: the ONLY per-investor scoped page. Capital, ownership %, accrued profit share, distributions timeline, ROI.
Wireframe (two-column on lg, single column mobile — mirrors operator-earnings layout):
- Left column — hero balance card (styled like operator-earnings balance card): 
  - Ownership % (large), capital contributed to date, current computed ROI % with a small `<RoiGauge>` (recharts RadialBar or a simple semicircle gauge).
  - Sub-cards: Total Capital In, Total Distributions Received, Accrued Profit Share (period), Undistributed (accrued − distributed).
- Right column — tabs (reuse operator-earnings tab pattern `activeTab`):
  - Tab 1 "Ledger": table of capital contributions + distributions (date, type CAPITAL_IN / DISTRIBUTION, amount, note). Server-paginated. Uses `<InvestorLedgerTable>` (AntD Table) — investor-scoped, but still a DTO (no other investors' rows).
  - Tab 2 "Distributions timeline": vertical timeline (AntD `Timeline`) of payouts vs the accrued share line — a `<CapitalVsDistributionsChart>` (recharts composed: bars = accrued profit share per period, line/dots = actual distributions), so the investor visually sees accrued vs paid.
- Export button on this page exports ONLY this investor's own ledger (still date-range + row limited).

---

## 2. Exact FSD recipe (files to create/modify)

### Create page folders (each `index.tsx` default-exports a memo component)
- `src/pages/investor/overview/index.tsx`
- `src/pages/investor/financials/index.tsx`
- `src/pages/investor/operations/index.tsx`
- `src/pages/investor/my-investment/index.tsx`
- (optional shared page-local pieces) `src/pages/investor/components/ProfitVsOpExChart.tsx`, `RoiGauge.tsx`, `CapitalVsDistributionsChart.tsx`, `InvestorLedgerTable.tsx`, `InvestorKpiCards.tsx`.

### Sidebar
- Create `src/layout/components/InvestorSidebar.tsx` (copy `OperatorSidebar.tsx` structure: same wrapper div classes, `SidebarLink`, `useTranslation(['sidebar'])`, `sidebarRedux` width logic). Links list as in IA section, using lucide icons already imported elsewhere (`LayoutDashboard`/`House`, `DollarSign`, `Package`, `PieChart`, `UserRound`).

### DashboardLayout switch
- Modify `src/layout/DashboardLayout.tsx`: import `InvestorSidebar`; add `case "investor": sidebar = <InvestorSidebar />; break;`. The `LdgBulkProgress` block already gates on superadmin/admin so investor is excluded automatically.

### Role union
- Modify `src/shared/enums/Roles.tsx`: add `| "investor"` to `UserRole`.

### Routes (`src/app/routes.tsx`)
- Add lazy imports for the 4 investor pages.
- Inside the `DashboardLayout` children array, add a grouped route:
  `{ path: "investor", children: [ { index: true, element: <Navigate to="overview" replace /> }, { path: "overview", element: <RequireRole roles={["investor"]}><InvestorOverview/></RequireRole> }, { path: "financials", element: <RequireRole roles={["investor"]}><InvestorFinancials/></RequireRole> }, { path: "operations", element: <RequireRole roles={["investor"]}><InvestorOperations/></RequireRole> }, { path: "my-investment", element: <RequireRole roles={["investor"]}><InvestorMyInvestment/></RequireRole> } ] }`.
- The existing index `{ index:true, element:<Dashboards/> }` stays; investor never lands there because RequireRole fallback (below) and the sidebar point to `/investor/overview`.

### RequireRole fallback fix (`src/shared/components/require-role/index.tsx`)
- Current: `Navigate to={settingsAllowed ? "/settings/integrations" : "/"}`. Change so investor lands on a valid investor page:
  `const target = role === 'investor' ? '/investor/overview' : (role === 'admin' || role === 'superadmin') ? '/settings/integrations' : '/'; return <Navigate to={target} replace/>;`
- This prevents an investor who hits an unauthorized admin URL from being bounced to the empty `/` dashboard.

### First-landing after login
- Login (`src/pages/login/index.tsx`) navigates to `buildAdminPath()` (root). For investor, root renders `<Dashboards/>` which has no investor branch. Two options — recommend the minimal, robust one:
  - Option A (preferred, no login change): add an investor branch inside `src/pages/dashboards/index.tsx` that returns `<Navigate to="/investor/overview" replace/>` when `role === 'investor'`. This guarantees any arrival at `/` redirects investors correctly regardless of entry point.
  - Option B: in login `onSuccess`, if decoded role is investor, `navigate('/investor/overview')`. Login currently does not decode role, so Option A is cleaner.

---

## 3. React Query hooks — `src/shared/api/hooks/useInvestor/index.ts`

Follow the `useCashBox`/`useChart` factory pattern. Export cache-key constants and a `useInvestor()` returning read closures. Set `staleTime: 5*60*1000` on each to reuse the 5-min TTL policy; investor reads are logged server-side via ActivityLogService, so the client just calls the endpoint.

```
export const investorKey = 'investor';
export const useInvestor = () => {
  const useInvestorOverview = (p:{startDate?:string;endDate?:string}) =>
    useQuery({ queryKey:[investorKey,'overview',p], staleTime:300000,
      queryFn:()=>api.get('investor/overview',{params:p}).then(r=>r.data) });

  const useInvestorFinancials = (p:{startDate?:string;endDate?:string}) =>
    useQuery({ queryKey:[investorKey,'financials',p], staleTime:300000,
      queryFn:()=>api.get('investor/financials',{params:p}).then(r=>r.data) });

  const useInvestorRevenueSeries = (p:{period?:'daily'|'weekly'|'monthly'|'yearly';startDate?:string;endDate?:string}) =>
    useQuery({ queryKey:[investorKey,'revenue',p], staleTime:300000,
      queryFn:()=>api.get('investor/revenue',{params:p}).then(r=>r.data) });

  const useInvestorOperations = (p:{startDate?:string;endDate?:string}) =>
    useQuery({ queryKey:[investorKey,'operations',p], staleTime:300000,
      queryFn:()=>api.get('investor/operations',{params:p}).then(r=>r.data) });

  const useInvestorRegionStats = (p:{startDate?:string;endDate?:string}) =>
    useQuery({ queryKey:[investorKey,'regions',p], staleTime:300000,
      queryFn:()=>api.get('investor/region-stats',{params:p}).then(r=>r.data) });

  const useInvestorLeaderboards = (p:{startDate?:string;endDate?:string}) =>
    useQuery({ queryKey:[investorKey,'leaderboards',p], staleTime:300000,
      queryFn:()=>api.get('investor/leaderboards',{params:p}).then(r=>r.data) });

  const useMyInvestment = (p:{startDate?:string;endDate?:string}={}) =>
    useQuery({ queryKey:[investorKey,'my-investment',p], staleTime:300000,
      queryFn:()=>api.get('investor/my-investment',{params:p}).then(r=>r.data) });

  const useMyLedger = (p:{fromDate?:string;toDate?:string;page?:number;limit?:number}) =>
    useQuery({ queryKey:[investorKey,'ledger',p], staleTime:300000,
      queryFn:()=>api.get('investor/my-investment/ledger',{params:p}).then(r=>r.data) });

  // Aggregated server-side export (blob). Not a hook — a mutation/callback.
  const exportInvestor = async (scope:'financials'|'operations'|'ledger', p:{fromDate?:string;toDate?:string}) => {
    const res = await api.get(`investor/${scope}/export`,{ params:p, responseType:'blob' });
    saveAs(res.data, `investor-${scope}-${p.fromDate||''}_${p.toDate||''}.xlsx`);
  };

  return { useInvestorOverview, useInvestorFinancials, useInvestorRevenueSeries,
           useInvestorOperations, useInvestorRegionStats, useInvestorLeaderboards,
           useMyInvestment, useMyLedger, exportInvestor };
};
```

Note on `RevenueChart` reuse: it internally calls `useRevenue().getRevenue` (hits `dashboard/revenue`). To point it at the investor endpoint without leaking the admin route, either (a) add a `source`/`fetcher` prop to `RevenueChart` so investor passes `useInvestorRevenueSeries`, or (b) create a thin `InvestorRevenueChart` wrapper that duplicates the presentational body but uses the investor hook. Recommend (a): make `RevenueChart` accept an optional `useSeries` prop defaulting to the existing `useRevenue` to keep back-compat.

---

## 4. Reuse vs new components

REUSE (as-is or with a data prop):
- `StatCard` (currently defined inline in `src/pages/dashboards/index.tsx`) — extract to `src/shared/components/StatCard/index.tsx` and import in both dashboards and investor pages. Supports `badge` for growth %.
- `RevenueChart` (`src/shared/components/RevenueChart`) — add optional `useSeries` prop for the investor endpoint.
- `SalesChart` — market/courier order-distribution bars.
- `Leaderboard` — top markets/couriers (pass `currentUserId={undefined}`; ensure DTO is name+aggregate only).
- `StatisticsMap` (`src/pages/regions/components/statistics-map.tsx`) — UZ regional map; feed investor region-stats. Consider parameterizing its data hook similarly (it currently uses `useRegion`); add an optional data prop or a `regionStats` prop so it can render investor aggregate data without the admin region hook.
- `customDate` / AntD `RangePicker` — date filtering (same desktop/mobile pattern as dashboards).
- `AdvancedStatsChart` — optional on Financials if its data can be sourced from investor endpoint; otherwise skip.

NEW components (in `src/pages/investor/components/`):
- `DateRangeFilter` — extract the RangePicker+CustomCalendar+clear-button block from dashboards into a small reusable presentational component `src/shared/components/DateRangeFilter/index.tsx` (props: `fromDate,toDate,setFromDate,setToDate`). Used by all 4 investor pages and can later replace duplicated code in dashboards.
- `InvestorKpiCards` — wraps StatCards with growth % from overview/financials DTO.
- `ProfitVsOpExChart` — recharts ComposedChart (bars Revenue vs OpEx, line Net Profit).
- `RoiGauge` — recharts RadialBarChart semicircle showing ROI %.
- `CapitalVsDistributionsChart` — recharts ComposedChart: bars = accrued profit share per period, line/scatter = actual distributions; plus AntD `Timeline` for the payout events.
- `InvestorLedgerTable` — AntD Table, server-paginated, columns: Date (Asia/Tashkent), Type (CAPITAL_IN / DISTRIBUTION / ACCRUED), Amount (UZS formatted), Note.
- `ExportButton` — small button calling `exportInvestor(scope, {fromDate,toDate})`; disabled when no date range or while downloading; shows AntD `message` on error.

My Investment visualizations concretely:
- Capital vs Distributions vs Accrued: `CapitalVsDistributionsChart` (grouped bars accrued vs distributed per period) + running totals in hero sub-cards.
- ROI gauge: `RoiGauge` semicircle (0% at left, target/max at right), center label = ROI %.

---

## 5. i18n — `investor` namespace (uz primary, plus ru/en)

Create `public/locales/uz/investor.json`, `public/locales/ru/investor.json`, `public/locales/en/investor.json`. Also add sidebar labels to each `sidebar.json`. Register `investor` is automatic via http-backend (loaded on demand by `useTranslation(['investor'])`); optionally add `investor` to `fallbackNS` in `src/app/i18n.ts` if you want it globally fallback-available (not required).

Sidebar keys to add to `public/locales/{uz,ru,en}/sidebar.json`:
- uz: `"investor_overview":"Umumiy ko'rinish","investor_financials":"Moliyaviy ko'rsatkichlar","investor_operations":"Operatsiyalar","investor_my_investment":"Mening investitsiyam"`
- ru: `"Обзор","Финансы","Операции","Моя инвестиция"`
- en: `"Overview","Financials","Operations","My Investment"`

`investor.json` key set (uz shown; mirror in ru/en):
```
{
  "overview": { "title":"Investor paneli", "subtitle":"Butun biznes ko'rsatkichlari", "myReturn":"Mening daromadim", "orderFlow":"Buyurtmalar oqimi" },
  "kpi": { "netProfit":"Sof foyda", "revenue":"Tushum", "cashPosition":"Naqd holati", "opex":"Umumiy xarajatlar", "growth":"o'sish", "vsPrev":"oldingi davrga nisbatan" },
  "financials": { "title":"Moliyaviy ko'rsatkichlar", "revenueTrend":"Tushum dinamikasi", "profitVsOpex":"Foyda va xarajatlar", "cashHistory":"Naqd holati tarixi" },
  "operations": { "title":"Operatsiyalar", "totalOrders":"Jami buyurtmalar", "sold":"Sotilgan", "delivered":"Yetkazildi", "returnRate":"Qaytish darajasi", "regionMap":"Hududlar bo'yicha", "topMarkets":"Top marketlar", "topCouriers":"Top kuryerlar" },
  "myInvestment": { "title":"Mening investitsiyam", "ownership":"Ulush foizi", "capitalIn":"Kiritilgan kapital", "distributions":"To'langan dividendlar", "accrued":"Hisoblangan foyda ulushi", "undistributed":"Taqsimlanmagan", "roi":"ROI", "ledger":"Hisob varaqi", "timeline":"To'lovlar tarixi", "type":"Turi", "amount":"Summa", "date":"Sana", "note":"Izoh", "capital_in":"Kapital kiritish", "distribution":"Dividend" },
  "common": { "export":"Excel yuklab olish", "dateRange":"Sana oralig'i", "clear":"Tozalash", "noData":"Ma'lumot yo'q", "loading":"Yuklanmoqda", "currency":"so'm" }
}
```

Formatting helpers (add to `src/shared/helpers/format.ts` or reuse inline like operator-earnings `fmt`):
- Money: `new Intl.NumberFormat('uz-UZ').format(Number(v))` + ` so'm`. Values arrive as bigint strings; wrap in `Number()` (safe up to ~9e15; if any value can exceed 2^53 use BigInt display formatting, but UZS totals here are within range).
- Dates: `new Intl.DateTimeFormat('uz-UZ',{ timeZone:'Asia/Tashkent', dateStyle:'medium' })`. Follow the existing `toLocaleDateString('uz-UZ', ...)` pattern used in operator-earnings.

---

## 6. UX — date-range filtering + aggregated export

- Each investor page owns `fromDate`/`toDate` state (`YYYY-MM-DD`), identical to `Dashboards`. Render the shared `<DateRangeFilter>` (RangePicker on desktop via `window.innerWidth<640` check, `CustomCalendar` on mobile) with a red clear button when a range is set. Changing dates re-runs the React Query hooks (params in queryKey), respecting the 5-min `staleTime` for cache hits.
- Growth % is computed server-side (previous-period comparison) and returned in the DTO so the client just renders the badge — avoids the client re-deriving profit from raw rows (which it must never see).
- Export button: placed top-right beside the date filter on Financials, Operations, My Investment. Calls `exportInvestor(scope,{fromDate,toDate})` which requests `responseType:'blob'` and `saveAs` downloads. The SERVER enforces aggregation, date-range requirement, and row-size limit; the client disables the button when no date range is chosen and shows AntD `message.error` if the server returns 4xx (e.g., range too large / limit exceeded). Never use the existing client `exportToExcel` for investor data (it is PII/row oriented and would require raw rows on the client).
- Loading/empty states: reuse the `SkeletonBox`/`Loader2` and empty-state patterns already present in dashboards and RevenueChart.

---

## Notes for other architects (contract the frontend depends on)
- Backend must expose `investor/*` DTO endpoints returning ONLY aggregates + growth %, no PII, gated behind fixed fail-closed RolesGuard + `@AcceptRoles(INVESTOR)` (plus admin for provisioning). Region/leaderboard DTOs must be name+aggregate only.
- `GET user/profile` must return `role:"investor"` for the Auth flow to wire the sidebar/route guards with zero extra frontend auth code.

## File changes

| Action | Path | Description |
|---|---|---|
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/overview/index.tsx` | Investor Overview page: DateRangeFilter, 4 KPI hero StatCards (Net Profit, Revenue, Net Cash Position, Total OpEx) with growth badges, full-width RevenueChart trend, My-return snapshot + order-flow mini panels. Uses useInvestor().useInvestorOverview. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/financials/index.tsx` | Financials page: KPI StatCards with previous-period growth %, RevenueChart, ProfitVsOpExChart, cash-position history area. Uses useInvestorFinancials + useInvestorRevenueSeries + ExportButton (financials scope). |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/operations/index.tsx` | Operations page: order-flow StatCards, StatisticsMap (UZ regional aggregate), Top Markets/Couriers Leaderboards, SalesChart distribution. Uses useInvestorOperations + useInvestorRegionStats + useInvestorLeaderboards + ExportButton (operations). |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/my-investment/index.tsx` | My Investment page (per-investor): hero card with ownership %, capital, ROI gauge; sub-cards capital-in/distributions/accrued/undistributed; tabs Ledger table + Distributions timeline/CapitalVsDistributionsChart. Uses useMyInvestment + useMyLedger + ExportButton (ledger). |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/components/RoiGauge.tsx` | Recharts RadialBar semicircle gauge showing ROI %. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/components/ProfitVsOpExChart.tsx` | Recharts ComposedChart: Revenue vs OpEx bars + Net Profit line, fed by financials series DTO. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/components/CapitalVsDistributionsChart.tsx` | Recharts ComposedChart (accrued profit share bars vs actual distributions) + AntD Timeline of payout events. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/components/InvestorLedgerTable.tsx` | AntD Table, server-paginated ledger: Date (Asia/Tashkent), Type, Amount (UZS), Note. Investor-scoped DTO rows only. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/pages/investor/components/ExportButton.tsx` | Aggregated export button calling useInvestor().exportInvestor(scope,{fromDate,toDate}); disabled without date range; error toast on 4xx. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/layout/components/InvestorSidebar.tsx` | Investor sidebar (copy of OperatorSidebar structure): Overview, Financials, Operations, My Investment, Profile links via SidebarLink + useTranslation(['sidebar']). |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/shared/api/hooks/useInvestor/index.ts` | React Query hooks factory: useInvestorOverview/Financials/RevenueSeries/Operations/RegionStats/Leaderboards/MyInvestment/MyLedger with staleTime 5min + exportInvestor blob download. Exports investorKey cache constant. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/shared/components/StatCard/index.tsx` | Extracted reusable StatCard (icon, label, value, gradient, suffix, badge) currently inline in dashboards; shared by dashboards + investor KPI cards. |
| create | `/home/shodiyor/Desktop/post_control_system/client/src/shared/components/DateRangeFilter/index.tsx` | Extracted reusable date filter (RangePicker desktop / CustomCalendar mobile / clear button) from dashboards; props fromDate,toDate,setFromDate,setToDate. |
| create | `/home/shodiyor/Desktop/post_control_system/client/public/locales/uz/investor.json` | Uzbek investor namespace keys (primary). |
| create | `/home/shodiyor/Desktop/post_control_system/client/public/locales/ru/investor.json` | Russian investor namespace keys. |
| create | `/home/shodiyor/Desktop/post_control_system/client/public/locales/en/investor.json` | English investor namespace keys. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/app/routes.tsx` | Add lazy imports for 4 investor pages; add nested `investor` route group with index Navigate to overview and each child wrapped in <RequireRole roles={['investor']}>. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/layout/DashboardLayout.tsx` | Import InvestorSidebar; add `case 'investor'` to the role sidebar switch. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/shared/enums/Roles.tsx` | Add 'investor' to the UserRole union. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/shared/components/require-role/index.tsx` | Fix fallback redirect: investor -> /investor/overview, admin/superadmin -> /settings/integrations, else -> /. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/pages/dashboards/index.tsx` | Add investor branch that returns <Navigate to='/investor/overview' replace/> so any arrival at '/' redirects investors; extract inline StatCard to shared/components/StatCard and import it. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/public/locales/uz/sidebar.json` | Add investor_overview/financials/operations/my_investment sidebar labels (uz). |
| modify | `/home/shodiyor/Desktop/post_control_system/client/public/locales/ru/sidebar.json` | Add investor sidebar labels (ru). |
| modify | `/home/shodiyor/Desktop/post_control_system/client/public/locales/en/sidebar.json` | Add investor sidebar labels (en). |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/shared/components/RevenueChart/index.tsx` | Add optional `useSeries` prop (defaults to existing useRevenue) so investor pages can feed the investor revenue endpoint without leaking the admin dashboard route. |

**New artifacts:** Pages: InvestorOverview, InvestorFinancials, InvestorOperations, InvestorMyInvestment (src/pages/investor/*); Sidebar: InvestorSidebar (src/layout/components/InvestorSidebar.tsx) + DashboardLayout 'investor' case; Hooks module useInvestor with: useInvestorOverview, useInvestorFinancials, useInvestorRevenueSeries, useInvestorOperations, useInvestorRegionStats, useInvestorLeaderboards, useMyInvestment, useMyLedger, exportInvestor; cache key constant investorKey; New components: RoiGauge, ProfitVsOpExChart, CapitalVsDistributionsChart, InvestorLedgerTable, ExportButton (page-local); StatCard + DateRangeFilter (extracted to shared/components); i18n: 'investor' namespace files in uz/ru/en + investor_* keys in sidebar.json (uz/ru/en); UserRole union extended with 'investor'; RequireRole fallback updated; RevenueChart gains optional useSeries prop; Route group /investor with children overview/financials/operations/my-investment guarded by RequireRole roles={['investor']}

**Effort:** 4-6 person-days. Sidebar + routes + role union + RequireRole fix + i18n scaffolding: ~1 day. Overview + Financials + Operations pages reusing StatCard/RevenueChart/SalesChart/Leaderboard/StatisticsMap + new ProfitVsOpExChart: ~2 days. My Investment page with RoiGauge, CapitalVsDistributionsChart, ledger table, timeline, export: ~1.5 days. Extraction/refactor of StatCard + DateRangeFilter, RevenueChart useSeries prop, and cross-browser/dark-mode/i18n polish: ~1 day. Assumes backend investor/* DTO endpoints exist per contract; add buffer if endpoint shapes shift.

**Acceptance criteria:**
- Logging in as an investor lands on /investor/overview (never the empty '/' admin dashboard) and shows the InvestorSidebar with exactly Overview, Financials, Operations, My Investment, Profile.
- Directly navigating an investor to any admin/superadmin URL redirects to /investor/overview (RequireRole fallback), and non-investor roles are still blocked from /investor/* (redirect to their own valid page).
- All four investor pages render aggregate-only data (no customer name/phone, no per-operator earnings, no card ids/balances, no salaries) — verified against DTO responses.
- KPI cards on Overview/Financials show Net Profit, Revenue, Net Cash Position, Total OpEx (single aggregate) with previous-period growth % badges.
- My Investment shows ownership %, capital in, total distributions, accrued profit share, undistributed, ROI gauge, a paginated ledger table, and an accrued-vs-distributed visualization/timeline — scoped to the logged-in investor only.
- Date-range filter (RangePicker desktop / CustomCalendar mobile) drives all page queries; React Query caches with 5-min staleTime; clear button resets.
- Export button downloads a server-generated aggregated .xlsx (blob), is disabled without a date range, and surfaces an error toast when the server rejects an over-limit range; the client never assembles raw rows.
- All visible strings resolve via the 'investor' namespace in uz/ru/en (uz primary); money formatted with uz-UZ + 'so'm', dates in Asia/Tashkent.
- Dark mode and mobile (<640px) layouts match existing pages; no console errors; lazy-loaded routes code-split correctly.

**Risks:**
- RevenueChart and StatisticsMap currently fetch from admin endpoints (dashboard/revenue, useRegion). If not parameterized (useSeries / data prop), an investor build could call admin routes -> 403 or, worse, data exposure. Must add the optional data/hook prop before reuse.
- Leaderboard/StatisticsMap DTOs could accidentally include courier/operator identifiers or phone; frontend must render name+aggregate only and backend DTO must strip PII (cross-team dependency).
- The index route renders <Dashboards/> with no investor branch; if the dashboards redirect (Option A) is omitted, an investor hitting '/' sees a broken/empty page. Must implement the redirect.
- Money as bigint strings: Number() is safe under 2^53 but very large aggregate OpEx/revenue could lose precision — confirm max magnitudes or use BigInt-aware formatting.
- Client-side export helper (exportToExcel) is PII/row-oriented; a developer might reuse it by habit and pull raw rows client-side. Enforce server-blob export only for investor.
- i18n namespace loaded lazily via http-backend; a missing key falls back silently — need all three locale files complete before release to avoid uz strings leaking into ru/en.
- Extracting StatCard/DateRangeFilter from dashboards is a shared-code refactor that could regress the existing dashboards page if not carefully swapped.

**Sequencing:** Must come AFTER: (1) backend fail-closed RolesGuard fix + INVESTOR role + investor/* DTO endpoints (this frontend consumes them and relies on GET user/profile returning role 'investor'); (2) agreement on DTO response shapes (overview/financials/operations/region-stats/leaderboards/my-investment/ledger + export contract). Within this slice, do in order: Roles union + RequireRole fix + DashboardLayout case + InvestorSidebar + routes (makes the shell reachable), then useInvestor hooks + i18n files, then extract shared StatCard/DateRangeFilter and add RevenueChart useSeries prop, then build the 4 pages (Overview -> Financials -> Operations -> My Investment), then ExportButton wiring last. Can proceed in parallel with backend using mocked DTO fixtures if endpoint shapes are frozen first.


---

# Rollout & QA

## Investor Account — Rollout, Testing & Ops Plan (Delivery Lead)

This is the delivery plan for the whole feature (RBAC hardening, backend `/investor` module, frontend investor section, equity ledger). It sequences a SAFETY-FIRST rollout: the fail-open guard is fixed and the endpoint surface audited BEFORE any INVESTOR token can exist. Every phase ships behind a feature flag and has hard exit criteria.

### Environment facts that shape the plan (verified in audit)
- **CI does NOT run tests.** `.github/workflows/deploy.yml` only: selective build → `db:backup` → `db:check-cashbox --snapshot` (baseline, non-halting) → `migration:run` → `db:check-cashbox --compare` (halts on NEW/GROWN drift) → systemd restart + health check. There is no `npm test` step and no staging job. Deploy is push-to-`main` = deploy-to-prod over SSH. **This is the single biggest ops risk** and dictates the testing strategy below (tests must be added to CI, or every phase merges directly to prod untested).
- **Test harness exists but is thin.** `package.json` has `test` (jest, `.spec.ts`), `test:e2e` (`test/jest-e2e.json`), `test:cov`. Only ~12 `.spec.ts` files exist, all unit-level with mocked repos/QueryRunner (see `post.service.spec.ts` chainable-QB + QueryRunner mock pattern — reuse it verbatim). `test/app.e2e-spec.ts` is the default Nest smoke stub.
- **Invariant scripts:** `scripts/check-cashbox-invariant.ts` (balance = signed sum of `cashbox_history`) and `check-card-invariant.ts`. Both support `--snapshot=` / `--compare=` and are already wired into deploy. The ledger adds money rows, so a NEW invariant script is required (see Data Correctness).
- **Login is phone_number-based, not username.** `signInUser` looks up by `{ phone_number, role: Not(CUSTOMER) }`, gates on `status === INACTIVE`, then issues access+refresh JWT `{ id, role, status }`. "Username/password" for investors = reuse phone_number as the credential; no new auth path needed. Blocking an investor = set `status = INACTIVE` (already enforced at login).
- **Provisioning pattern is fixed:** `users.service.createAdmin/createCourier/...` → validate DTO, `bcrypt.encrypt(password)`, `create({...role})`, save, `ActivityLogService.log({entity_type:'user', new_value:{name, role}})`. `createInvestor` clones this exactly.
- **Frontend role→sidebar switch** is a literal `switch (role as UserRole)` in `client/src/layout/DashboardLayout.tsx` (line 30). Adding INVESTOR = one `case "investor": sidebar = <InvestorSidebar />`. `RequireRole` fallback (`require-role/index.tsx`) redirects non-admin to `/` — investor landing route MUST exist at a path the investor role is allowed on, or they hit a redirect loop.

---

## 1. PHASED DELIVERY PLAN

### PHASE 0 — Security hardening (BLOCKING; ships alone, no investor surface yet)
**Ships:** (a) `RolesGuard` fail-open → fail-closed at `roles.guard.ts:22`: when no `@AcceptRoles` present, DENY unless the handler is explicitly public (introduce a `@Public()` decorator or an allowlist), because today unguarded+RolesGuard-attached handlers pass. Audit: grep every controller for `@UseGuards` without `@AcceptRoles` and every route with NO guards; classify each as intentionally-public (login, webhooks) vs must-protect. (b) Full endpoint inventory: produce the deny-list matrix (customer PII, salary, card, tokens, per-operator earnings, integration secrets) mapped to the routes that expose them. (c) Add `INVESTOR = 'investor'` to `Roles` enum and `'investor'` to frontend `UserRole` — enum only, no endpoints accept it yet.
**Exit criteria:** fail-closed guard merged; a passing RBAC unit test proving "no `@AcceptRoles` ⇒ Forbidden for a non-privileged role"; regression sweep confirms no existing role lost access (run the app, smoke every existing role's dashboard); endpoint matrix reviewed by owner. **No INVESTOR token is ever issued until Phase 0 is in prod.**
**Why first:** issuing an INVESTOR JWT against a fail-open guard = investor silently reaches every unguarded route. Non-negotiable per standards.

### PHASE 1 — INVESTOR role + read-only dashboards (reuse existing metrics)
**Ships:** New `/investor` NestJS module. `createInvestor` in users.service (admin/superadmin only). Read-only endpoints that WRAP existing dashboard/cashbox services and return DTOs (never raw): business overview (order counts by status via `getStats`), revenue (`getRevenueStats`), top markets/couriers/operators, region map stats. A `@UseGuards(JwtGuard, RolesGuard) @AcceptRoles(Roles.INVESTOR)` on every route. `InvestorAccessLogInterceptor` (or explicit `ActivityLogService.log({entity_type:'investor_view', action:'read', metadata:{endpoint}})`) on every read. Reuse the existing 5-min cache TTL. Frontend: `InvestorSidebar`, investor landing route, `RequireRole(['investor'])`, react-query hooks off the existing axios instance, reuse `SalesChart`/`RevenueChart`/`Leaderboard`/`statistics-map`.
**Exit criteria:** INVESTOR can log in and see aggregate dashboards; DTO-leakage test suite green (no customer_name/phone/address, no salary, no card_id/balance, no tokens in ANY investor response); RBAC negative tests green (INVESTOR → 403 on every write and every admin-only read); access-log rows appear for every investor GET; feature flag OFF in prod at merge.

### PHASE 2 — New aggregate computations
**Ships:** Net profit roll-up = `SELL_PROFIT − (SALARY + BILLS + MANUAL_EXPENSE)` aggregated from `financial_balance_history` by date range; total OpEx as the SINGLE summed number (payroll+bills+manual expense, never itemized per person); net cash position (reuse `financialBalance()` = main + Σcourier − Σmarket, correctly LABELED as cash position not profit); growth % (period-over-period) and unit economics (profit/order, avg order value) derived from existing revenue stats. All as pure functions with their own DTOs.
**Exit criteria:** unit tests for each aggregation against fixed fixtures (including empty-range and single-row edge cases); numbers reconcile to `financial_balance_history` totals within 0 UZS (bigint, no float); OpEx never exposes a per-person breakdown (test asserts response has no per-user array).

### PHASE 3 — Equity ledger + ROI + "My Investment" (NEW module, per-investor)
**Ships:** New entities/migrations: `investor_profile` (user_id, active ownership %, joined_at), `capital_contribution` (investor_id, amount bigint, date, comment, created_by), `ownership_stake` (investor_id, percent, effective_from, effective_to — history of stake changes), `distribution` (investor_id, amount bigint, date, type=dividend/return_of_capital, created_by). ROI service: accrued profit share = Σ over sub-periods of (stake% active in that sub-period × net profit of that sub-period); distributions tracked separately; computed ROI = (accrued share + realized gains) / capital in. "My Investment" endpoint returns ONLY the caller's ledger (scoped by `user.id`); business metrics stay global. All money bigint; all reads DTO + access-logged.
**Exit criteria:** ROI math unit tests incl. mid-period stake change and multiple contributions; NEW `check-investor-ledger-invariant.ts` passes (Σ contributions, Σ distributions reconcile; accrued share ≤ profit×stake bound); one investor cannot read another's ledger (RBAC test); migration is reversible and adds no cashbox drift (compare step green).

### PHASE 4 — Export, i18n, polish
**Ships:** Aggregated Excel export (exceljs, reuse `cash-box.service` export pattern) with mandatory date-range + row-size cap and request timeout; final `investor` i18n namespace in uz/ru/en (uz primary); empty states, skeletons, chart polish; access-log dashboard filter so admin can monitor investor activity.
**Exit criteria:** export rejects unbounded ranges and over-cap row counts with a clear error; export contains ONLY aggregates (test opens the buffer, asserts no PII columns); all three locales complete (missing-key lint clean); export event is access-logged.

---

## 2. TESTING STRATEGY (test matrix)

**A. Unit — aggregations & ROI (jest, mocked DataSource/repos, reuse `post.service.spec.ts` mock factory):**
- net profit = SELL_PROFIT − (SALARY+BILLS+MANUAL_EXPENSE) over range; empty range → 0; single source only.
- OpEx sum correctness; growth % incl. divide-by-zero prior period → null not NaN.
- ROI: single contribution single period; multiple contributions; **mid-period stake change** (weighted sub-period accrual); distributions reduce nothing in accrued but appear as realized; all bigint (assert no float drift).

**B. RBAC negative (integration, Nest TestingModule + guards):**
- INVESTOR → 403 on every write route (cashbox spend/fill/salary/payment, order mutations, user create).
- INVESTOR → 403 on admin-only reads (cashbox `user/:id`, cards, salary history, activity-log raw, integration secrets).
- Fail-closed proof: handler with `@UseGuards(RolesGuard)` and NO `@AcceptRoles` ⇒ Forbidden (Phase 0 regression lock).
- Another investor's `/investor/my-investment` ⇒ scoped to caller only.

**C. DTO leakage (assert response shape, run against every investor GET):**
- No `customer_name/customer_phone/address/customer_id/operator_phone`.
- No `salary_amount/have_to_pay`, no per-operator earnings rows.
- No `card_id`/card balances, no `password`, no `market_tg_token`, no integration `api_key/api_secret/username/password/auth_url`.
- Response is a DTO instance, not a TypeORM entity (no lazy relations / no `__` metadata keys).

**D. e2e smoke (`test:e2e`):** provision investor → login (phone+password) → GET each investor route 200 → GET a denied route 403 → export within limits 200, over-limit 4xx → blocked investor (status INACTIVE) login 4xx.

**E. Invariant scripts:** extend deploy to also run the NEW `check-investor-ledger-invariant.ts` in snapshot/compare mode alongside cashbox+card checks. Ledger touches money, so it MUST gate the deploy the same way.

**F. CI GAP (must-do):** add a `test` job to `deploy.yml` (or a separate PR check on non-main branches) running `npm test` + `test:e2e` BEFORE the SSH deploy. Today nothing runs tests in CI — without this, the whole matrix above only protects local dev.

---

## 3. ADMIN OPERATIONS

**Provision investor account** — extend `users.controller` + `users.service` with `createInvestor` (superadmin/admin only, `@AcceptRoles(SUPERADMIN, ADMIN)`), mirroring `createAdmin`: DTO {name, phone_number, password, ownership_percent?, initial_capital?}, bcrypt hash, `role: INVESTOR`, `status: ACTIVE`, ActivityLog write. No self-signup. Admin UI: add an "Investor" tab to the existing user-management screen (same form component family as admin/courier creation). Block = set `status = INACTIVE` (login already rejects it). Reset password reuses the existing user update path.

**Record capital contributions / set ownership % / record distributions** — NEW admin screens under settings (there is no existing UI for equity, so extending user-management is not enough). Provide: (1) Contributions table + "Add contribution" (amount, date, comment) → writes `capital_contribution` + ActivityLog. (2) Ownership editor → writes a new `ownership_stake` row with `effective_from` (closing the prior stake's `effective_to`), never mutating history. (3) Distributions table + "Record distribution" (amount, date, dividend/return-of-capital). All three are admin-only, all ActivityLog-audited, all money entered as bigint UZS. These are backend POSTs guarded to SUPERADMIN/ADMIN — the INVESTOR only READS the resulting ledger.

---

## 4. DATA CORRECTNESS

- **Reconcile against cashbox invariants:** net profit and OpEx are derived SOLELY from `financial_balance_history` (SELL_PROFIT/SALARY/BILLS/MANUAL_EXPENSE) — the same source of truth the cashbox invariant guards. Net cash position reuses `financialBalance()`. The NEW `check-investor-ledger-invariant.ts` asserts: Σ investor contributions and distributions are internally consistent; accrued share for any investor never exceeds netProfit×stake for the period; no orphan ledger rows referencing deleted users/orders. Wire it into deploy's snapshot/compare gate.
- **Stake changes mid-period:** never recompute historical accrual with the current stake. Accrual is computed per sub-period bounded by `ownership_stake.effective_from/effective_to`; each sub-period uses the stake active THEN × net profit of that sub-period. This is the core ROI unit test.
- **Historical backfill:** initial `ownership_stake.effective_from` and first `capital_contribution.date` seed the ledger. If backdating accrual, do it via a one-off idempotent migration/script reading `financial_balance_history` from `effective_from`; run it AFTER `db:backup`, verify with the ledger invariant, and make it re-runnable without double-counting.

---

## 5. OPS

- **Caching/load:** investor dashboards reuse the existing 5-min TTL cache — no new heavy queries. ROI/net-profit aggregations are cache-keyed by date-range. Cap concurrent expensive queries; investor traffic is low-volume (one account per investor).
- **Export limits:** hard date-range max + row-size cap + request timeout on the exceljs endpoint; reject over-limit with a clear message (tested in Phase 4). Aggregated rows only.
- **Monitoring:** every investor read/export is an `activity_log` row (`entity_type:'investor_view'`); add an admin filter to review it. IP/device auto-captured by the existing request-context middleware. Alert on unusual investor read volume.
- **Feature flag:** gate the entire investor surface (backend module registration guard + frontend sidebar/route) behind a flag (env or config). Ships OFF; owner flips ON per-environment after smoke. Kill-switch = flag OFF (mirrors the ldg killswitch pattern already in the codebase).
- **Rollback plan:** deploy already does mandatory pre-migration `db:backup` and halts on cashbox drift. For the ledger: migrations are reversible (`migration:revert`); on bad data, flip feature flag OFF (investor sees nothing, no writes occurred since investor is read-only), then revert migration or restore from `server/backups/`. Because INVESTOR is read-only for business data and the ledger is admin-written, rollback never risks cashbox invariants.

---

## 6. EFFORT & BUILD ORDER

Sequence (each depends on the prior): **P0 → P1 → P2 → P3 → P4**, with the CI-test job added during P0/P1 (blocks nothing but protects everything after).
- **P0 Security hardening:** ~2–3 person-days (guard fix is tiny; the endpoint audit + regression sweep across all existing roles is the real cost).
- **P1 Role + read-only dashboards + DTOs + access log + FE shell:** ~5–7 pd (mostly DTO wrapping + FE FSD wiring + full leakage/RBAC test suite).
- **P2 New aggregations:** ~3–4 pd (pure functions + fixtures + reconciliation tests).
- **P3 Equity ledger + ROI + My Investment + admin screens:** ~7–10 pd (new entities, migrations, ROI math with mid-period stakes, invariant script, admin UI).
- **P4 Export + i18n + polish:** ~3–4 pd.
- **CI test job addition:** ~1 pd, do it early.
Total ~21–29 pd. Dependencies are strictly linear on the security/data axis (P0 gates all token issuance; P2 feeds P3's ROI); FE and BE within a phase can parallelize.

## File changes

| Action | Path | Description |
|---|---|---|
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/common/guards/roles.guard.ts` | Phase 0: change fail-open (line 22 return true when no @AcceptRoles) to fail-closed; introduce @Public() allowlist for intentionally-public routes (login, webhooks). Add RBAC unit spec proving no-decorator ⇒ Forbidden. |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/common/enums/index.ts` | Phase 0: add INVESTOR = 'investor' to Roles enum. |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/api/users/users.service.ts` | Phase 1/3: add createInvestor (bcrypt + role INVESTOR + status ACTIVE + ActivityLog), mirroring createAdmin/createCourier. signInUser already gates status INACTIVE and issues JWT — no change needed. |
| modify | `/home/shodiyor/Desktop/post_control_system/server/src/api/users/users.controller.ts` | Phase 1: add POST /users/investor guarded @AcceptRoles(SUPERADMIN, ADMIN). |
| modify | `/home/shodiyor/Desktop/post_control_system/.github/workflows/deploy.yml` | Add a test gate (npm test + test:e2e) before SSH deploy, and add check-investor-ledger-invariant to the snapshot/compare steps alongside cashbox+card checks. CI currently runs NO tests. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/layout/DashboardLayout.tsx` | Phase 1: add case 'investor' to the role switch (line 30) rendering <InvestorSidebar />. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/shared/enums/Roles.tsx` | Phase 0: add 'investor' to UserRole union. |
| modify | `/home/shodiyor/Desktop/post_control_system/client/src/shared/components/require-role/index.tsx` | Phase 1: ensure investor landing route is valid so RequireRole fallback (non-admin → '/') does not loop; confirm investor path is allowlisted. |
| create | `/home/shodiyor/Desktop/post_control_system/server/scripts/check-investor-ledger-invariant.ts` | Phase 3: NEW invariant script (snapshot/compare like check-cashbox-invariant.ts) reconciling contributions/distributions/accrued share; wired into deploy gate. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/api/investor/investor.controller.ts` | Phase 1-4: read-only investor endpoints (overview, revenue, net-profit, OpEx, ledger, my-investment, export), all @AcceptRoles(INVESTOR), all DTO + access-logged. |
| create | `/home/shodiyor/Desktop/post_control_system/server/src/core/entity/investor-profile.entity.ts` | Phase 3: investor_profile + capital_contribution + ownership_stake + distribution entities (money bigint) with migrations. |

**New artifacts:** Roles.INVESTOR enum value (server) + 'investor' UserRole (client); @Public() decorator + fail-closed RolesGuard; POST /users/investor (createInvestor) — admin-provisioned, bcrypt, ActivityLog; InvestorModule with read-only DTO endpoints (overview, revenue, net-profit, total-opex, cash-position, growth, unit-economics, ledger, my-investment, export); InvestorAccessLog interceptor/logging via ActivityLogService (entity_type 'investor_view'); Entities+migrations: investor_profile, capital_contribution, ownership_stake (effective_from/to), distribution; ROI service (weighted mid-period accrual) + reconciliation DTOs; scripts/check-investor-ledger-invariant.ts (snapshot/compare, deploy-gating); CI test job in deploy.yml (npm test + test:e2e); Frontend: InvestorSidebar, investor routes, react-query hooks, 'investor' i18n namespace (uz/ru/en); Admin equity screens: contributions / ownership editor / distributions (SUPERADMIN,ADMIN)

**Effort:** Total ~21–29 person-days. P0 security hardening 2–3 pd (guard trivial; endpoint audit + all-roles regression sweep is the cost). P1 role+read-only dashboards+DTOs+access-log+FE shell 5–7 pd. P2 aggregations 3–4 pd. P3 equity ledger+ROI+admin screens+invariant script 7–10 pd. P4 export+i18n+polish 3–4 pd. CI test job ~1 pd (do early). Linear dependency on security/data axis; FE/BE parallelizable within a phase.

**Acceptance criteria:**
- Fail-closed RolesGuard is in prod BEFORE any INVESTOR token is issued; a handler with RolesGuard and no @AcceptRoles returns 403 for non-privileged roles (unit test locks it).
- Every investor-reachable endpoint returns a DTO, never a raw entity, and leakage tests confirm zero customer PII / salary / card / password / tg_token / integration secrets in any investor response.
- INVESTOR receives 403 on all write routes and all admin-only reads (RBAC negative suite green).
- Every investor read and export produces an activity_log row (entity_type investor_view) with IP/device.
- Net profit reconciles to financial_balance_history (SELL_PROFIT − SALARY − BILLS − MANUAL_EXPENSE) exactly (bigint, no float); total OpEx exposes only a single summed number, no per-person breakdown.
- ROI accrual is correct across mid-period stake changes and multiple contributions; one investor cannot read another investor's ledger.
- New investor-ledger invariant script passes and gates deploy alongside cashbox/card invariants; migrations are reversible with no new cashbox drift.
- Excel export is aggregated-only, enforces date-range + row-size + timeout limits, and is access-logged.
- 'investor' i18n namespace complete in uz/ru/en (uz primary); no missing keys.
- Entire feature ships behind a feature flag OFF by default; flag OFF fully hides the surface (kill-switch).

**Risks:**
- CI runs NO tests today and push-to-main = deploy-to-prod over SSH with no staging. Every merge lands untested in production unless a CI test gate is added — highest-priority ops risk.
- Fail-open guard fix could revoke access from an existing unguarded route currently relied upon; a full all-roles regression sweep is mandatory before merge.
- Login is phone_number-based (not username); 'username/password' for investors must map to phone_number or the sign-in lookup {phone_number, role} silently fails.
- enrichLogs() leaks customer_name/phone — the investor MUST NOT reach any raw activity-log endpoint; only aggregate/investor_view access is permitted.
- 'financialBalance' is CASH POSITION mislabeled as profit; presenting it as profit to an investor would misstate ROI. Must be labeled correctly and kept distinct from net-profit roll-up.
- Ledger touches money (bigint UZS); float arithmetic or double-counted backfill would corrupt ROI. Enforce bigint end-to-end and an idempotent, re-runnable backfill guarded by the new invariant.
- RequireRole fallback redirects non-admins to '/'; a missing/invalid investor landing route causes a redirect loop.
- Mid-period stake recomputation using the current stake instead of period-active stake silently mis-accrues historical ROI.

**Sequencing:** Strictly linear on the security/data axis: Phase 0 (fail-closed guard + endpoint audit + enum) MUST be in production before ANY INVESTOR token is ever issued — this gates Phase 1 entirely. Phase 1 (role, read-only DTO dashboards, access logging) must precede Phase 2/3 because it establishes the guarded module and DTO/leakage test baseline. Phase 2 (net-profit/OpEx aggregations) must precede Phase 3 because ROI accrual consumes net-profit-per-period. Phase 3 (ledger + ROI) must land its migrations and the new investor-ledger invariant script, and wire that script into deploy, before any backfill runs. Phase 4 (export/i18n) is last. Add the CI test gate during Phase 0/1 so it protects Phases 2–4. Feature flag stays OFF in prod until each phase's smoke passes; FE and BE work within a single phase can proceed in parallel.
