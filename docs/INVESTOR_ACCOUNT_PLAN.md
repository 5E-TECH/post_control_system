<!-- Generated: 2026-08-04 · Post Control System · Investor Account design (audit + owner decisions + master plan) -->

# Investor Account — Master Implementation Plan

*Post Control System · Equity Investor role · Web (React + NestJS/TypeORM/PostgreSQL) · UI ships in uz (primary) / ru / en*

---

## 0. Overview & Goals

We are adding a **maximum-quality, read-only EQUITY INVESTOR account** to the Post Control System. Every investor sees the **same whole-business aggregate metrics** (revenue, profit, net cash, OpEx, operations) plus a **personal, per-investor equity ledger** (capital in, ownership %, distributions, ROI). Investors are **admin-provisioned** (no self-signup), log in through the **existing phone_number + password + JWT** flow, and can reach **only** the new `/investor/*` surface. All business data is **aggregate-only** — no customer PII, no raw order rows, no per-person figures.

### Locked product decisions

| # | Decision | Implication in this plan |
|---|----------|--------------------------|
| 1 | **Purpose** = equity investor tracking ROI (capital in, ownership %, distributions, return) | New equity ledger module + ROI engine |
| 2 | **Scope** = GLOBAL business view; identical for every investor | No per-investor scoping of business data; only the ledger is scoped to `user.id` |
| 3 | **Depth** = AGGREGATE-ONLY | No customer PII, no raw order rows, no per-person data anywhere |
| 4 | **Financial transparency** = revenue + profit + net cash + **total OpEx as ONE number** | `/investor/opex` returns a single summed figure (payroll+bills+manual), never itemized per person |
| 5 | **Access** = one account per investor, admin-provisioned, username/password + JWT web login | `createInvestor` mirrors `createAdmin`; "username" = `phone_number` |
| 6 | **Ledger** = FULL in-app ledger (capital, ownership %, distributions, computed ROI) — NEW module | 3 new ledger tables + read endpoints + admin-write screens |
| 7 | **ROI model** = ownership % × net profit for a period (accrued); distributions tracked separately as actual payouts | `accruedProfitShare` computed; `distributionsPaid` stored; both exposed distinctly |
| 8 | **Platform** = Web, i18n uz/ru/en, dedicated Investor sidebar in existing React app | New FSD vertical `src/pages/investor/*` + `InvestorSidebar` |

### Non-negotiable engineering standards

- **FIX the fail-open `RolesGuard` → fail-closed BEFORE any INVESTOR token is ever issued** (blocking prerequisite).
- Every investor-reachable endpoint returns a **DTO, never a raw entity**.
- **All** investor reads are logged via `ActivityLogService`.
- **Aggregated Excel export only**, with mandatory date-range + row-size limits.
- Near-real-time data with **short 5-min TTL caching** (reuse existing pattern).

### Verified codebase facts (drive the whole plan)

- `RolesGuard` (`server/src/common/guards/roles.guard.ts:22`) is **fail-open**: `if (!requiredRoles) return true;`. Confirmed present verbatim.
- `Roles` enum (`server/src/common/enums/index.ts`) has 8 values; **no INVESTOR yet**. Frontend `UserRole` union (`client/src/shared/enums/Roles.tsx`) has 7; **no `investor` yet**.
- **Net profit source of truth** = `financial_balance_history` with the dedicated `FinancialSource_type` enum: `SELL_PROFIT='sell_profit'`, `SALARY='salary'`, `BILLS='bills'`, `MANUAL_EXPENSE='manual_income'/'manual_expense'`, `CORRECTION`. (Note: this is **`FinancialSource_type`**, distinct from the older `Source_type` enum used by `cashbox_history`.)
- `financialBalanceAnalytics` (`cash-box.service.ts` ~line 1698) computes `negativeImpact` as `SUM(CASE WHEN h.amount < 0 THEN (-1*h.amount) ELSE 0 END)` → **returns positive magnitudes**. Therefore **net profit = `sellProfit − (salary + bills + manualExpense)`** with all four as positive magnitudes. (This corrects Slice 1's "plain signed SUM" note.)
- `BaseEntity` provides `id uuid`, `created_at bigint`, `updated_at bigint` (auto-set), using `bigintTransformerNonNull`. All money is `bigint` UZS — **never `numeric`/`float`**.
- `financialBalance()` returns `currentSituation` = **current cash position**, point-in-time (not range-bounded, not profit). Must be labeled "Net Cash Position (current)".
- Login (`signInUser`) is **phone_number-based**: `{ phone_number, role: Not(CUSTOMER) }`, rejects `status === INACTIVE`, issues JWT `{ id, role, status }`. INVESTOR flows through unchanged; blocking = set `status = INACTIVE`.
- CI (`.github/workflows/deploy.yml`) **runs no tests**; push-to-`main` = deploy-to-prod over SSH, with `db:backup` + `check-cashbox-invariant`/`check-card-invariant` snapshot/compare gates.
- `RequireRole` fallback currently sends non-admins to `/`, which renders `<Dashboards/>` (no investor branch) — must be fixed to avoid a broken landing/redirect loop.

---

## 1. Architecture at a Glance

```
┌─────────────────────────────────────── FRONTEND (React FSD) ───────────────────────────────────────┐
│  Login (phone+password) ──▶ GET user/profile → role:'investor' → setRole()                          │
│         │                                                                                            │
│         ▼                                                                                            │
│  RequireRole(['investor'])  ──┐   DashboardLayout switch → case 'investor' → <InvestorSidebar/>      │
│                               │                                                                      │
│  /investor/overview  ─────────┤   Pages (src/pages/investor/*):                                      │
│  /investor/financials ────────┤     Overview · Financials · Operations · My Investment · Profile     │
│  /investor/operations ────────┤   Hooks: useInvestor() (React Query, staleTime 5min)                 │
│  /investor/my-investment ─────┘   i18n: 'investor' namespace uz/ru/en                                │
└──────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                │ Bearer JWT {id, role:'investor', status}
                                                ▼
┌─────────────────────────────────── SECURITY LAYER (server, GLOBAL) ─────────────────────────────────┐
│  JwtAuthGuard → RolesGuard [FAIL-CLOSED] → @AcceptRoles(INVESTOR[, ADMIN, SUPERADMIN])               │
│  + ClassSerializerInterceptor({strategy:'excludeAll'})  + LogInvestorAccessInterceptor              │
│  + ThrottlerGuard (signin lockout) + helmet + pinned CORS                                            │
└──────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                ▼
┌────────────────────────────────── BACKEND: InvestorModule (/api/investor) ──────────────────────────┐
│  InvestorController (13 GET routes, DTO-only, access-logged, 5-min cache)                            │
│    InvestorService ──── reuses ──▶ DashboardService / OrderService / CashBoxService / RegionService  │
│      (maps aggregate outputs → safe DTOs; computes growth%, net-profit rollup, OpEx, unit-econ,      │
│       anonymized leaderboards, adoption)                                                             │
│    InvestorLedgerService ─ reads ─▶ investor ledger tables (SCOPED to user.id — the ONLY scoping)    │
│    InvestorExportService ─ ExcelJS aggregated export (date-range + row caps)                         │
│    InvestorRoiService ─── computes ─▶ accrued share (ownership_bps × net_profit, time-weighted)      │
└──────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                ▼
┌───────────────────────────── DATA MODEL (PostgreSQL, all money bigint UZS) ─────────────────────────┐
│  REUSED: users (role='investor') · financial_balance_history (net-profit source; + new composite idx)│
│  NEW:                                                                                                │
│    investor_capital_contribution   (capital IN, append-only)                                         │
│    investor_ownership_stake        (versioned ownership in BASIS POINTS; one open row/investor)      │
│    investor_distribution           (actual payouts, append-only)                                     │
│  Admin-write screens (SUPERADMIN/ADMIN) create these rows; investor only READS.                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Identity decision (canonical):** REUSE the `users` table with `role='investor'`. No separate identity/profile table — auth, JWT, `status`, and provisioning all key off `users`. Ownership % lives in the versioned `investor_ownership_stake` ledger table, **not** a profile column.

> **Schema reconciliation (lead-architect ruling):** Two slices proposed different ledger schemas. We adopt **Slice 1's canonical three-table model** (versioned stakes in basis points, append-only contributions/distributions) because it correctly supports mid-period stake changes without float error. The `investor_profile` + single `investor_ledger_entry` model (Slices 2/4/5) is **superseded** — its `ownership_pct` becomes the current open `investor_ownership_stake` row; its `capital_contribution`/`distribution` types become the two dedicated append-only tables. All references below use the canonical model.

---

## 2. Data Model & Migrations

All entities extend `BaseEntity` (→ `id uuid`, `created_at bigint`, `updated_at bigint`). All money is `bigint` UZS via `bigintTransformerNonNull` (non-null) or `bigintTransformer` (nullable). Ownership is stored in **basis points** (integer; 1% = 100 bp, 100% = 10000 bp) to stay float-free. Table/column names are `snake_case`; FKs `FK_<table>_<ref>`, indexes `IDX_*`, unique `UQ_*`.

### 2.1 Enum change

`server/src/common/enums/index.ts` — add `INVESTOR = 'investor'` to `Roles`. The Postgres enum type is auto-named `users_role_enum`; migration runs `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'investor'` **as the first statement**, outside any user-insert (Postgres cannot use a new enum value in the same transaction that adds it).

### 2.2 New entities

**A. `investor_capital_contribution`** → `InvestorCapitalContributionEntity`
`server/src/core/entity/investor-capital-contribution.entity.ts`

| Column | Type | Notes |
|--------|------|-------|
| `investor_id` | `uuid` | FK → `users.id` **ON DELETE CASCADE**; `@ManyToOne` `investor` |
| `amount` | `bigint` (nonNull) | UZS; `CHECK amount > 0` |
| `contributed_at` | `bigint` (nonNull) | epoch-ms economic date (separate from `created_at`) |
| `note` | `varchar` null | |
| `created_by` | `uuid` | FK → `users.id` **ON DELETE SET NULL** (admin who recorded) |

Indexes: `IDX_ICC_INVESTOR (investor_id)`, `IDX_ICC_CONTRIBUTED_AT (contributed_at)`, `IDX_ICC_INVESTOR_DATE (investor_id, contributed_at)`.

**B. `investor_ownership_stake`** → `InvestorOwnershipStakeEntity`
`server/src/core/entity/investor-ownership-stake.entity.ts` — versioned ownership.

| Column | Type | Notes |
|--------|------|-------|
| `investor_id` | `uuid` | FK → `users.id` **CASCADE** |
| `ownership_bps` | `int` | `CHECK ownership_bps >= 0 AND ownership_bps <= 10000` |
| `effective_from` | `bigint` (nonNull) | epoch-ms, inclusive |
| `effective_to` | `bigint` null | epoch-ms, exclusive; **NULL = currently open** |
| `note` | `varchar` null | |
| `created_by` | `uuid` | FK → `users.id` **SET NULL** |

Indexes: `IDX_IOS_INVESTOR`, `IDX_IOS_INVESTOR_FROM (investor_id, effective_from)`, **partial unique** `UQ_IOS_OPEN_STAKE ON investor_ownership_stake (investor_id) WHERE effective_to IS NULL` (exactly one open stake per investor). Stake change = close current open row (set `effective_to`) + insert new open row; **history never mutated**.

**C. `investor_distribution`** → `InvestorDistributionEntity`
`server/src/core/entity/investor-distribution.entity.ts` — actual payouts.

| Column | Type | Notes |
|--------|------|-------|
| `investor_id` | `uuid` | FK → `users.id` **CASCADE** |
| `amount` | `bigint` (nonNull) | UZS paid out; `CHECK amount > 0` |
| `distributed_at` | `bigint` (nonNull) | epoch-ms economic payout date |
| `period_start` / `period_end` | `bigint` null | optional accrual window the payout is against |
| `note` | `varchar` null | |
| `created_by` | `uuid` | FK → `users.id` **SET NULL** |

Indexes: `IDX_IDIST_INVESTOR`, `IDX_IDIST_DISTRIBUTED_AT (distributed_at)`, `IDX_IDIST_INVESTOR_DATE (investor_id, distributed_at)`.

### 2.3 Additive index on `financial_balance_history`

Add composite `IDX_FBH_SOURCE_CREATED (source_type, created_at)` to speed range-grouped net-profit queries. **No new columns** on that table.

### 2.4 Migration

`server/src/migrations/1748500000000-InvestorModule.ts`
**up()** order: (1) `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'investor'`; (2) create the 3 ledger tables with FKs/indexes/CHECK constraints; (3) `UQ_IOS_OPEN_STAKE` partial unique index; (4) `IDX_FBH_SOURCE_CREATED`.
**down()**: drop the 3 tables + `IDX_FBH_SOURCE_CREATED`; leave the enum value (Postgres cannot drop enum values — documented, harmless).

> **Migration cautions:** Run `ADD VALUE` first and never insert an investor user in the same migration. For a large prod `financial_balance_history`, create `IDX_FBH_SOURCE_CREATED` with `CREATE INDEX CONCURRENTLY` outside the wrapping transaction, or accept a short maintenance window.

**Backfill:** none required — all three tables start empty; investors + capital/stake rows are entered by admins post-deploy via the admin equity screens.

### 2.5 Migration order

1. `RolesGuard` fail-closed fix + `Roles.INVESTOR` enum (Phase 0, ships alone).
2. `1748500000000-InvestorModule` (this migration) — foundational; must land before ledger service/ROI/read endpoints.
3. No further migrations for the investor surface.

---

## 3. Backend: `/investor` Module

**Base:** `@Controller('investor')`. Every route: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@AcceptRoles(Roles.INVESTOR, Roles.ADMIN, Roles.SUPERADMIN)` (admins allowed for QA/provisioning), `@UseInterceptors(ClassSerializerInterceptor)` with `@SerializeOptions({ strategy: 'excludeAll' })`, and `@LogInvestorAccess('<action>')`. All handlers are **GET** (read-only) and return `successRes(dto, 200, msg)` where `data` is **always a DTO** (instance/array), never a raw entity or raw reused-service payload.

**Providers:** `InvestorController`, `InvestorService` (aggregation/mapper + 5-min cache + `logInvestorRead` helper), `InvestorLedgerService`, `InvestorRoiService`, `InvestorExportService`. Injects `DashboardService`, `OrderService`, `CashBoxService`, `RegionService`, `ActivityLogService`, plus repos for the 3 ledger entities.

**Range helper:** `InvestorService.resolveRange(startDate?, endDate?)` copies `DashboardService.resolveRange` (Asia/Tashkent, epoch-ms): both empty → today; start-only → start→now; end-only → 0→end; both → full range.

### Endpoints

| Route | Metric | Reuse or New | DTO (key fields) | Cache | Logged |
|-------|--------|--------------|------------------|-------|--------|
| `GET /investor/overview` | Business snapshot (order counts by status, profit) | Reuse `OrderService.getStats(start,end)` (NOT `getOverview`, which leaks market/courier names) | `BusinessOverviewDto { acceptedCount, soldAndPaid, cancelled, profit, from, to }` | 5-min | ✅ |
| `GET /investor/revenue` | Time-series + MoM/YoY growth% | Reuse `OrderService.getRevenueStats(period,start,end)`; **NEW** growth% compute | `RevenueTimeSeriesDto { period, data:RevenuePointDto[], summary{totalRevenue,totalOrders,avgRevenue} }` | 5-min | ✅ |
| `GET /investor/net-profit` | Category-level profit rollup | Reuse `CashBoxService.financialBalanceAnalytics`; **NEW** rollup | `NetProfitRollupDto { sellProfit, salary, bills, manualExpense, totalOpEx, netProfit, from, to }` | 5-min | ✅ |
| `GET /investor/opex` | **Single** aggregate OpEx | Same source; **NEW** single number | `OpExAggregateDto { totalOpEx, from, to }` (no split) | 5-min | ✅ |
| `GET /investor/cash-position` | Net cash + card split (current) | Reuse `CashBoxService.financialBalance()`; **map hard** | `CashPositionDto { netCashPosition, cash, card, couriersReceivable, marketsPayable }` (no per-user arrays, no card_id) | 5-min | ✅ |
| `GET /investor/order-flow` | Volume by status + success/return rate | Reuse `getStats`; **NEW** derived rates | `OrderFlowDto { acceptedCount, soldAndPaid, cancelled, successRate, returnRate, from, to }` | 5-min | ✅ |
| `GET /investor/regions` | Regional map data | Reuse `RegionService.getAllRegionsStats` (already clean) | `RegionStatDto[]` + `RegionSummaryDto` | 5-min | ✅ |
| `GET /investor/unit-economics` | Revenue/order, take rate | Reuse `getStats` + `getRevenueStats`; **NEW** `OrderService.getGrossSold(start,end)` | `UnitEconomicsDto { revenuePerOrder, grossSold, totalProfit, soldOrders, takeRatePct, from, to }` | 5-min | ✅ |
| `GET /investor/leaderboards` | Anonymized top markets/couriers | Reuse `getTopMarkets`/`getTopCouriers` (already 5-min cached); **ANONYMIZE** | `LeaderboardsDto { markets:LeaderboardEntryDto[], couriers:[] }` — `{ rank, label, totalOrders, successfulOrders, successRate }` (no ids/names) | internal | ✅ |
| `GET /investor/adoption` | AI + integration adoption | **NEW** thin aggregate queries (never select secrets) | `AdoptionDto { ai{marketsUsing,totalUsage,txCount}, integrations{activeIntegrations,totalIntegrations,syncedOrders,marketsIntegrated} }` | 5-min | ✅ |
| `GET /investor/my-investment` | Personal equity summary | **NEW** `InvestorLedgerService.getSummary(user.id, range)` | `MyInvestmentDto { capitalInvested, ownershipPct, accruedProfitShare, distributionsPaid, accruedRoiPct, realizedRoiPct, netProfitForRange, from, to }` | **no cache** | ✅ |
| `GET /investor/my-investment/ledger` | Paginated ledger entries | **NEW** `listEntries(user.id, filters)` w/ `getSafeLimit` | `LedgerEntryDto { id, type, amount, note, occurred_at, created_at }` (no `created_by` user) | **no cache** | ✅ |
| `GET /investor/export` | Aggregated Excel | **NEW** `InvestorExportService` (ExcelJS) | `Buffer` (xlsx) — sheets Overview/Revenue/Financials/Regions/MyInvestment | n/a | ✅ (`export`) |

**Route/DTO alignment note:** the frontend slice references `investor/financials`, `investor/operations`, `investor/region-stats`, and `investor/{scope}/export`. Align both teams on the backend's canonical routes above **before FE build**: FE `financials` page composes `net-profit` + `opex` + `cash-position` + `revenue`; FE `operations` page composes `order-flow` + `regions` + `leaderboards`. Export is a **single** `GET /investor/export?scope=&fromDate=&toDate=` (scope-parameterized), not per-page routes. Freeze this contract in Phase 1.

**Caching:** copy `order.service` pattern — `private cache = new Map<string,{data,expireAt}>()`, `CACHE_TTL = 5*60*1000`, key = `endpoint:start:end:period`. Business aggregates cached; **`my-investment`/`ledger` NOT stale-cached** (mutation-sensitive). `getTopMarkets/getTopCouriers` already cache internally — do not double-cache.

**Access logging:** every handler fires `logInvestorRead(user, endpoint, filters, scope, rowCount?)` → `ActivityLogService.log({ entity_type:'investor_view', action:'read:<endpoint>', entity_id:user.id, user, metadata:{endpoint, filters, scope} })`. IP/device auto-captured via request-context ALS. **Never** call `enrichLogs()`/`getAllLogs` (they leak customer PII). Exports log `action:'export'` with row/byte size.

**Module wiring:** `InvestorModule` imports `TypeOrmModule.forFeature([...3 entities])` + `DashboardModule, OrderModule, CashBoxModule, RegionModule, ActivityLogModule`. **Verify each reused module has its service in `exports[]`** — add `exports:[CashBoxService]` / `[RegionService]` / confirm `OrderService`, `DashboardService` exported. Register `InvestorModule` in `api/app.module.ts`.

---

## 4. Security & RBAC Hardening

### 4.1 🚨 BLOCKING PREREQUISITE — Fail-closed RolesGuard

**No INVESTOR token may be issued in production until this is merged and deployed.**

`server/src/common/guards/roles.guard.ts` — replace line 22 (`if (!requiredRoles) return true;`):

```ts
canActivate(context: ExecutionContext): boolean {
  const requiredRoles = this.reflector.getAllAndOverride<string[]>(
    ROLES_KEY, [context.getHandler(), context.getClass()]);
  // FAIL-CLOSED: a handler guarded by RolesGuard MUST declare @AcceptRoles.
  if (!requiredRoles || requiredRoles.length === 0) {
    throw new ForbiddenException('Endpoint has no role policy (fail-closed)');
  }
  const { user } = context.switchToHttp().getRequest();
  if (!user?.role || !requiredRoles.includes(user.role)) {
    throw new ForbiddenException('Forbidden user');
  }
  return true;
}
```

**Blast-radius audit result (verified across all controllers referencing `RolesGuard`): ZERO handlers mount `RolesGuard` without `@AcceptRoles`.** Public routes (`POST users/signin`, `users/telegram/signin`, `users/refresh`) mount **no** guards, so `RolesGuard` never runs for them. `users/telegram/link`, `users/signout` use `JwtGuard` only. **Therefore the flip is safe** — nothing depends on the fail-open branch.

**Verification procedure (run before & after the flip, then wire into CI as `audit:roles`):** walk each handler's full decorator block (decorators interleave `@ApiQuery`/`@ApiOperation`/`@UseGuards` between `@Get()` and `@AcceptRoles`, so naive greps false-positive) and honor class-level decorators. Empty output = safe.

```bash
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

**Guard unit tests** (`roles.guard.spec.ts`): (a) no metadata → Forbidden; (b) empty array → Forbidden; (c) role not in list → Forbidden; (d) role in list → true; (e) undefined user → Forbidden. **CI gate:** `audit:roles` fails the build on any output — this makes the flip permanently safe.

### 4.2 INVESTOR role + JWT (no scopes)

Add `INVESTOR='investor'` to `Roles`. Global business view ⇒ **no scopes**; existing `{id, role, status}` payload suffices. No `token.ts` change. `signInUser` already allows any non-CUSTOMER role. `createInvestor` (Phase 1/3) sets `role=INVESTOR, status=ACTIVE`, bcrypt password, `ActivityLog` write — clones `createAdmin`.

### 4.3 DTO / serialization boundary (three defense layers)

The codebase has **no existing `ClassSerializerInterceptor`/`@Expose` usage** and returns raw entities in places. We make the investor boundary structural:

1. **Structural isolation** — investor endpoints live only in `InvestorModule` and call **only aggregate service methods**; they never touch order/user/salary/card/log repositories directly. Do **not** add `Roles.INVESTOR` to any existing admin controller.
2. **Fail-closed serializer** — `ClassSerializerInterceptor` + `@SerializeOptions({ strategy: 'excludeAll' })` on investor controllers; every DTO field is `@Expose()`d. Any accidentally-leaked field is dropped.
3. **Mapper-time roll-up** — OpEx summation and profit rollup happen in the service so no itemized array crosses the boundary. Reuse the `INTEGRATION_SECRET_FIELDS`/`splitSecrets` masking precedent as the pattern for a shared `INVESTOR_DENY_FIELDS` constant used in leak tests.

**CI gate `audit:investor-dto`:** no file under `api/investor/**/*.controller.ts` imports any `*.entity`; every handler returns a `*Dto` type.

### 4.4 Allow / Deny field matrix

| ALLOWED (aggregate, whole-business) | DENIED (never reachable, never in a DTO) |
|-------------------------------------|------------------------------------------|
| Revenue totals + averages | `customer_name/customer_phone/address/customer_id/operator_phone` |
| Net profit rollup = `SELL_PROFIT − (SALARY+BILLS+MANUAL_EXPENSE)` | Any raw order/order-item rows |
| Net cash position (`financialBalance()`, labeled "current") | `user-salary.salary_amount/have_to_pay`; per-operator earnings/payments |
| **Total OpEx as ONE summed number** | `cashbox-card.card_id` + card balances |
| Order counts by status | `users.password`; `market_tg_token` |
| Region aggregate stats (map) | integration secrets `api_key/api_secret/username/password/auth_url` |
| Anonymized top markets/couriers (≥30 orders) | **raw activity-log rows** — `enrichLogs()` leaks PII; investor never reaches log-read endpoints |
| Per-investor own ledger (capital, ownership %, distributions, accrued ROI) | OpEx broken down per person |

### 4.5 Access logging

`@LogInvestorAccess(action)` decorator + `LogInvestorAccessInterceptor` on investor controllers. On successful response → `ActivityLogService.log({ entity_type:'investor_view', action, entity_id:user.id, user, metadata:{startDate,endDate,period,path} })`. Write-only; **never** `enrichLogs()`. Best-effort (never blocks response). Files: `common/decorator/log-investor-access.decorator.ts`, `common/interceptors/log-investor-access.interceptor.ts`.

### 4.6 Threat mitigations (external-facing account)

| Threat | Mitigation |
|--------|------------|
| Brute force / credential stuffing (no lockout/limiter today; `@nestjs/throttler` not installed) | Install `@nestjs/throttler`; global `ThrottlerGuard` (~10/10s) + stricter named throttle on `POST users/signin` (~5/min/IP) + progressive per-account lockout via `logFailedLogin` counts (reset-on-success). **Top gap.** |
| Token theft / replay | Recommend shorter access-token TTL for investor tokens (if `token.ts`/config supports per-role `expiresIn`; else accepted risk); verify refresh cookie `httpOnly/secure/sameSite` in `writeToCookie`. |
| CORS over-permissive (`origin:true, credentials:true`) | Pin `origin` to known web app origin(s) — **confirm all prod/staging origins before flip.** |
| Export exfiltration | Aggregated-only export; date-range required + max span (366 days) + hard row cap (5000/sheet) + timeout + per-account throttle + `@LogInvestorAccess('export')`. |
| Enumeration / IDOR | Global scope ⇒ no per-investor business IDs. Ledger scoped to `req.user.id` server-side — never trust client-supplied investor id (test asserts). |
| Missing headers | Add `helmet()` in bootstrap. |
| Swagger | Already gated to non-prod — keep. |

Change locations: `roles.guard.ts`, `enums/index.ts`, `api/investor/*`, `common/decorator/log-investor-access.decorator.ts`, `common/interceptors/log-investor-access.interceptor.ts`, `api/app.service.ts` (throttler + helmet + CORS), `package.json` (`@nestjs/throttler`, `helmet`, CI scripts `audit:roles`/`audit:investor-dto`).

---

## 5. Financial & KPI Computations

All money is `bigint` UZS; convert to `Number` **only after aggregation**, round to 2 dp for display ratios, and **guard zero denominators** (return `null`, never `NaN`).

### Net profit (period)

```
netProfit(period) = sellProfit − (salary + bills + manualExpense)
```
where each term is a **positive magnitude** from `financialBalanceAnalytics`:
`sellProfit = positiveImpact.find(SELL_PROFIT).total_amount`; `salary/bills/manualExpense = negativeImpact.find(<TYPE>).total_amount`. *(negativeImpact is already `SUM(-1 × amount WHERE amount<0)` → positive.)* Must reconcile exactly (0 UZS drift) with `getStats.profit` for the same range.

### Total OpEx (single aggregate — decision #4)

```
totalOpEx(period) = salary + bills + manualExpense    // ONE number; never itemized per person
```

### Growth % (period-over-period)

```
growthPct[i] = round(((series[i].revenue − series[i-1].revenue) / abs(series[i-1].revenue)) × 100, 2)
               // null when prior is 0 or absent
```
YoY: for `monthly` match same-month-prior-year; for `yearly` compare adjacent years. Computed **server-side** so the client never derives profit from raw rows.

### Unit economics

```
revenuePerOrder = round(totalProfit / soldAndPaid)              // guard soldAndPaid > 0
grossSold       = OrderService.getGrossSold(start,end)          // SUM(total_price) WHERE status IN (sold,paid,partly_paid) AND sold_at BETWEEN
takeRatePct     = round(totalProfit / grossSold × 100, 2)       // guard grossSold > 0
```

### Net cash position (current, not range-bounded)

```
netCashPosition = financialBalance().currentSituation           // point-in-time; label "current", keep distinct from netProfit
cash = main.balance_cash;  card = main.balance_card
couriersReceivable = couriers.couriersTotalBalanse;  marketsPayable = -markets.marketsTotalBalans
```

### ROI (decision #7) — integer-only, time-weighted

```
total_capital_in(investor)     = Σ investor_capital_contribution.amount
accrued_profit_share(inv, P)   = Σ over sub-periods s of P:  net_profit(s) × ownership_bps(s) / 10000
                                 (bigint: multiply BEFORE divide, floor; sub-periods bounded by stake effective_from/effective_to)
total_distributions(investor)  = Σ investor_distribution.amount
outstanding_accrued            = accrued_profit_share − total_distributions
accruedRoiPct(inv, P)          = round(accrued_profit_share(inv,P) / total_capital_in × 100, 2)   // guard capital > 0
realizedRoiPct(investor)       = round(total_distributions / total_capital_in × 100, 2)
```

**Mid-period stake changes:** never recompute historical accrual with the current stake. Split the period at each `ownership_stake.effective_from/effective_to` boundary; each sub-period uses the stake active *then* × the net profit of *that* sub-period. This is the core ROI unit test.

**Reuse vs new:** revenue series, order stats, region stats, top markets/couriers, financial analytics, cash balance — **all reused**. NEW: growth% compute, net-profit rollup, single-OpEx, take-rate + `getGrossSold`, anonymized leaderboards, adoption queries, and the entire ROI engine.

---

## 6. Frontend Investor Section

*Ships in uz (primary) / ru / en. Money formatted `Intl.NumberFormat('uz-UZ')` + " so'm"; dates `Asia/Tashkent`. Bigint arrives as string → `Number()` (safe < 2^53; use BigInt-aware formatting only if a total can exceed ~9e15).*

### 6.1 Sidebar & Information Architecture

`src/layout/components/InvestorSidebar.tsx` (copy `OperatorSidebar` structure). Links (business-narrative order):

1. Overview → `/investor/overview` (`LayoutDashboard`)
2. Financials → `/investor/financials` (`DollarSign`)
3. Operations → `/investor/operations` (`Package`)
4. My Investment → `/investor/my-investment` (`PieChart`)
5. Profile → `/profile` (reuse; `UserRound`)

No Settings/Users/Orders/config pages.

### 6.2 Pages / wireframes

- **Overview** (`/investor/overview`): DateRangeFilter; 4 KPI hero StatCards (Net Profit, Revenue, Net Cash Position, Total OpEx) with growth badges; full-width `RevenueChart` trend; two mini panels ("My return snapshot" → ownership %, accrued share, ROI %; "Order flow" → counts + success-rate badge). No export here.
- **Financials** (`/investor/financials`): 4 KPI StatCards w/ growth %; `RevenueChart`; **new** `ProfitVsOpExChart` (recharts ComposedChart: Revenue vs OpEx bars + Net Profit line); single Total-OpEx figure (no itemization — decision #4); net-cash-position history area chart; ExportButton.
- **Operations** (`/investor/operations`): order-flow StatCards (Total, Sold, Delivered %, Return/Cancel %); `StatisticsMap` (UZ Highcharts map, `onRegionClick=undefined`, no per-person drilldown); two `Leaderboard` panels (Top Markets/Couriers, `currentUserId={undefined}`, name+aggregate only; **operators leaderboard excluded**); `SalesChart` distribution; ExportButton.
- **My Investment** (`/investor/my-investment`) — the **only** per-investor page: hero card (ownership % large, capital contributed, ROI % with `RoiGauge`); sub-cards (Total Capital In, Total Distributions, Accrued Profit Share, Undistributed); tabs — Ledger (`InvestorLedgerTable`, server-paginated) and Distributions timeline (`CapitalVsDistributionsChart` + AntD `Timeline`); ExportButton (own ledger, scope=`ledger`).

### 6.3 Routes, role wiring, landing

- `src/shared/enums/Roles.tsx`: add `| "investor"` to `UserRole`.
- `src/layout/DashboardLayout.tsx`: `case "investor": sidebar = <InvestorSidebar/>; break;`.
- `src/app/routes.tsx`: nested group `{ path:"investor", children:[ {index:true, element:<Navigate to="overview" replace/>}, {path:"overview", element:<RequireRole roles={["investor"]}><InvestorOverview/></RequireRole>}, … financials/operations/my-investment ] }`.
- `src/shared/components/require-role/index.tsx`: fix fallback — `const target = role==='investor' ? '/investor/overview' : (role==='admin'||role==='superadmin') ? '/settings/integrations' : '/'`.
- `src/pages/dashboards/index.tsx`: add investor branch `return <Navigate to="/investor/overview" replace/>` so any arrival at `/` redirects investors (avoids the empty admin dashboard / redirect loop). Also extract inline `StatCard` → `src/shared/components/StatCard`.

### 6.4 Hooks — `src/shared/api/hooks/useInvestor/index.ts`

React Query factory (pattern of `useCashBox`/`useChart`), `staleTime: 5*60*1000` per read, exporting `investorKey`. Hooks: `useInvestorOverview`, `useInvestorFinancials`, `useInvestorRevenueSeries`, `useInvestorOperations`, `useInvestorRegionStats`, `useInvestorLeaderboards`, `useMyInvestment`, `useMyLedger`, and `exportInvestor(scope, {fromDate,toDate})` → `api.get('investor/export',{params:{scope,...},responseType:'blob'})` + `saveAs` (file-saver). **Do not** reuse the client `exportToExcel` helper (PII/row-oriented).

### 6.5 Reused vs new components

- **Reuse (add a data/hook prop):** `RevenueChart` (add optional `useSeries` prop, default `useRevenue`, so investor feeds `useInvestorRevenueSeries` without hitting the admin route); `StatisticsMap` (add `regionStats` prop); `SalesChart`; `Leaderboard` (`currentUserId={undefined}`); AntD `RangePicker`/`CustomCalendar`.
- **Extract to shared:** `StatCard`, `DateRangeFilter` (RangePicker desktop / CustomCalendar mobile / clear button) — swap into dashboards carefully to avoid regression.
- **New (`src/pages/investor/components/`):** `ProfitVsOpExChart`, `RoiGauge` (recharts RadialBar semicircle), `CapitalVsDistributionsChart`, `InvestorLedgerTable`, `InvestorKpiCards`, `ExportButton` (disabled without date range; AntD `message.error` on 4xx).

### 6.6 i18n

Create `public/locales/{uz,ru,en}/investor.json` (uz primary; keys for overview/kpi/financials/operations/myInvestment/common) and add `investor_overview/financials/operations/my_investment` to each `sidebar.json`. Loaded on demand via `useTranslation(['investor'])`. **All three locale files must be complete before release** (missing keys fall back silently).

---

## 7. Equity Ledger & ROI

### 7.1 Admin provisioning flow (SUPERADMIN / ADMIN only — no self-signup)

1. **Create investor account** — `POST /users/investor` (`@AcceptRoles(SUPERADMIN, ADMIN)`), `createInvestor` mirrors `createAdmin`: DTO `{name, phone_number, password, ownership_bps?, initial_capital?}` → bcrypt hash → `role=INVESTOR, status=ACTIVE` → save → `ActivityLog`. Admin UI: an "Investor" tab in user management. Block = set `status=INACTIVE`. Reset password = existing user-update path.
2. **Record capital contribution** — admin screen → `POST` writing `investor_capital_contribution` (amount, `contributed_at`, note, `created_by`) + `ActivityLog`.
3. **Set / change ownership %** — admin ownership editor → close current open `investor_ownership_stake` (set `effective_to`) + insert new open row (`ownership_bps`, `effective_from`); **history never mutated** (partial-unique `UQ_IOS_OPEN_STAKE` enforces one open row).
4. **Record distribution** — admin screen → `POST` writing `investor_distribution` (amount, `distributed_at`, optional `period_start/end`, note) + `ActivityLog`.

All writes are admin-only, ActivityLog-audited, money as bigint UZS. **The investor only READS the resulting ledger.**

> Admin-write endpoints/screens are a downstream slice; the 3 entities (Section 2) are their prerequisite. The read-only investor module never exposes any write.

### 7.2 How ROI is computed & displayed

Computed by `InvestorRoiService` using the Section 5 formulas: accrued profit share = time-weighted Σ of `net_profit(sub-period) × ownership_bps/10000`; distributions summed separately; `accruedRoiPct` and `realizedRoiPct` exposed as **distinct** fields (decision #7). Displayed on **My Investment**: hero ROI gauge (`accruedRoiPct`), sub-cards for Total Capital In / Total Distributions / Accrued Share / Undistributed (`accrued − distributed`), and `CapitalVsDistributionsChart` (accrued-share bars vs actual-distribution line/dots) + payout `Timeline`.

### 7.3 Stake-change handling & correctness

- Accrual is split at every stake boundary; each sub-period uses the *then-active* stake. Never recompute with the current stake.
- **NEW invariant script** `server/scripts/check-investor-ledger-invariant.ts` (snapshot/compare like `check-cashbox-invariant.ts`): asserts Σ contributions / Σ distributions internally consistent, `accrued_share ≤ netProfit × stake` bound for any period, no orphan rows referencing deleted users. **Wire into `deploy.yml`** alongside cashbox/card gates.
- **Backfill:** seed from first `contributed_at` / initial `effective_from`; if backdating accrual, run an idempotent, re-runnable one-off script AFTER `db:backup`, verified by the ledger invariant, guarded against double-counting.

---

## 8. Phased Delivery Plan

Strictly linear on the security/data axis; FE and BE within a phase parallelize. Every phase ships behind a **feature flag OFF** (kill-switch mirrors the ldg killswitch) and has hard exit criteria.

| Phase | Ships | Exit criteria | Effort | Depends on |
|-------|-------|---------------|--------|------------|
| **0 — Security hardening (BLOCKING)** | Fail-closed `RolesGuard` + `@Public()`/allowlist for public routes; guard unit spec; `audit:roles` + `audit:investor-dto` CI gates; add `INVESTOR` enum (server) + `investor` UserRole (client); endpoint deny-matrix reviewed by owner. **No endpoint accepts INVESTOR yet.** Add CI **test job** (`npm test` + `test:e2e`) to `deploy.yml`. | Guard merged & in prod; "no `@AcceptRoles` ⇒ 403" test green; audit script empty across all controllers; all-roles smoke regression passes. **No INVESTOR JWT issued until this is in prod.** | 2–3 pd (+1 pd CI job) | — |
| **1 — Role + read-only dashboards** | `InvestorModule`; `createInvestor` + `POST /users/investor`; wrap-and-map read endpoints (overview, revenue, order-flow, regions, leaderboards) → DTOs; `LogInvestorAccess` interceptor; 5-min cache; verify reused-module `exports[]`. FE: `InvestorSidebar`, routes, `RequireRole` fix, `useInvestor` hooks, i18n scaffolding, reused charts. | INVESTOR logs in, sees aggregate dashboards; DTO-leak suite green; RBAC negative suite green (403 on writes + admin reads); access-log rows on every GET; flag OFF at merge. | 5–7 pd | 0 |
| **2 — New aggregate computations** | Net-profit rollup, single Total-OpEx, net-cash-position (labeled current), growth %, unit economics + `getGrossSold`, adoption — pure functions + DTOs. | Unit tests vs fixtures (incl. empty/single-row); net profit reconciles to `financial_balance_history` within **0 UZS**; response has no per-person OpEx array. | 3–4 pd | 1 |
| **3 — Equity ledger + ROI + My Investment** | 3 ledger entities + `1748500000000` migration + `IDX_FBH_SOURCE_CREATED`; `InvestorLedgerService` + `InvestorRoiService`; `my-investment` + `ledger` endpoints (scoped to `user.id`); `check-investor-ledger-invariant.ts` wired into deploy; admin equity screens. FE: My Investment page. | ROI math tests incl. mid-period stake change + multiple contributions; ledger invariant passes & gates deploy; one investor cannot read another's ledger; migration reversible, no cashbox drift. | 7–10 pd | 2 |
| **4 — Export, i18n, polish** | Aggregated ExcelJS export (date-range required, span ≤366d, ≤5000 rows/sheet, timeout, throttled, logged); complete uz/ru/en `investor` namespace; empty/skeleton states; admin access-log filter for investor activity; throttler + helmet + pinned CORS + login lockout in prod before external exposure. | Export rejects unbounded/over-cap ranges; opened buffer has no PII columns; all 3 locales complete (missing-key lint clean); export access-logged. | 3–4 pd | 3 |

**Total ≈ 21–29 person-days.** Add the CI test gate during Phase 0/1 so it protects Phases 2–4.

---

## 9. Testing & QA

CI currently runs **no tests** and push-to-main deploys to prod — **adding a CI test gate (Phase 0) is the highest-priority ops action.** Reuse the `post.service.spec.ts` chainable-QB + QueryRunner mock factory.

**A. Unit — aggregations & ROI:** net profit = `SELL_PROFIT − (SALARY+BILLS+MANUAL_EXPENSE)` over range (empty → 0; single source); OpEx sum; growth % with divide-by-zero prior → `null` not `NaN`; ROI single/multiple contributions; **mid-period stake change** (weighted sub-period accrual); distributions don't change accrued but appear realized; assert **no float drift** (bigint).

**B. RBAC negative (Nest TestingModule + minted INVESTOR JWT):** INVESTOR → 403 on **every** write route (drive from the audit handler-list so new writes auto-covered) and on all admin reads (dashboard/overview, activity-log, cash-box detail, order, users, external-integration, integration-sync). Fail-closed proof: `RolesGuard` + no `@AcceptRoles` ⇒ 403. Another investor's `/investor/my-investment` ⇒ scoped to caller. Token-tamper (wrong secret) ⇒ 401.

**C. DTO-leak (recursive key-scan on every investor GET):** response contains **none** of `customer_name, customer_phone, address, customer_id, operator_phone, salary_amount, have_to_pay, card_id, password, api_key, api_secret, market_tg_token`, no raw order/order-item arrays, no TypeORM metadata keys. A deliberately-leaked mapper field is dropped by `excludeAll` (snapshot test per DTO).

**D. e2e smoke (`test:e2e`):** provision investor → login (phone+password) → each investor route 200 → a denied route 403 → export within limits 200 / over-limit 4xx → blocked investor (`status=INACTIVE`) login rejected.

**E. Invariant scripts:** extend deploy to run `check-investor-ledger-invariant.ts` in snapshot/compare alongside cashbox+card. Net profit / OpEx reconcile to `financial_balance_history` exactly (bigint).

**F. CI gap:** add `test` job to `deploy.yml` running `npm test` + `test:e2e` before SSH deploy; keep `audit:roles` + `audit:investor-dto` as build-failing gates.

---

## 10. Risks & Open Items

| Risk / Open item | Mitigation / Owner action |
|------------------|---------------------------|
| **CI runs no tests; push-to-main = prod, no staging** | Add CI test gate in Phase 0 (blocks nothing, protects everything after). Highest priority. |
| Postgres `ALTER TYPE ADD VALUE` non-transactional & unusable same-tx | Run enum-add first, never insert an investor user in the same migration. |
| `IDX_FBH_SOURCE_CREATED` briefly locks a large FBH table | `CREATE INDEX CONCURRENTLY` outside the migration tx, or a short maintenance window. |
| `financialBalance()` is **current cash**, not range-bounded profit; `getRevenueStats` "revenue" is actually **profit** | Precise DTO field names (`netCashPosition` vs `netProfit` vs `revenue`); i18n labels match owner definitions. **Confirm labels with owner.** |
| Reused `CashBoxService`/`RegionService` may not be in module `exports[]` | Add/verify exports before wiring `InvestorModule` (bootstrap fails otherwise). |
| `enrichLogs()` PII leak is convention-enforced, not structural | Investor never reaches any log-read endpoint; leak tests + code review. |
| `route/DTO naming mismatch` between BE canonical routes and FE `financials`/`operations`/`region-stats` | **Freeze the endpoint contract in Phase 1** (Section 3 note); FE composes pages from canonical routes; single `GET /investor/export?scope=`. |
| CORS `origin:true` → pinned could break the web app | Confirm all prod/staging origins before flip. |
| Global `ThrottlerGuard` may throttle staff bursts (bulk orders, printer, LDG sync) | Tune limits; `@SkipThrottle` on internal/webhook routes. |
| `ClassSerializerInterceptor`/`excludeAll` is new here; mis-annotation drops legit fields | Snapshot test per DTO. |
| Bigint → `Number()` precision on very large UZS totals | Confirm max magnitudes; use BigInt-aware formatting if any total > ~9e15. |
| Anonymized leaderboards need ≥30 orders (may be empty on small data) | FE handles empty state gracefully. |
| Per-role shorter token TTL depends on `token.ts`/config support | If unsupported, investor keeps staff TTL (accepted risk, noted). |
| Refresh-cookie flags (`httpOnly/secure/sameSite`) | Verify `writeToCookie`; fix if missing. |
| Backfill double-counting if re-run | Idempotent, invariant-guarded, after `db:backup`. |

---

## 11. Definition of Done

- [ ] Fail-closed `RolesGuard` merged and **in production before any INVESTOR token is issued**; `RolesGuard`-guarded handler without `@AcceptRoles` returns 403 (unit test locks it); `audit:roles` empty across all controllers and wired as a CI gate.
- [ ] `Roles.INVESTOR` (server) + `investor` UserRole (client) added; admin-provisioned investor logs in via existing signin and receives a JWT with `role='investor'`; no scopes.
- [ ] Migration `1748500000000-InvestorModule` runs up/down cleanly on a prod-schema copy; 3 ledger tables exist (uuid PK, `created_at/updated_at bigint`, money `bigint`, correct FK ON DELETE), `ownership_bps` 0..10000 CHECK, `amount>0` CHECK, `UQ_IOS_OPEN_STAKE` enforced, `IDX_FBH_SOURCE_CREATED` created; no new columns on any existing table.
- [ ] Every `/investor/*` response `data` is a DTO (or DTO array) under `excludeAll`; recursive scan finds **none** of the deny-list keys and no raw order/order-item arrays; `audit:investor-dto` passes.
- [ ] Business aggregate numbers are **identical for every investor** (no per-investor scoping of business data); the ledger is the **only** thing scoped to `user.id`, and one investor cannot read another's.
- [ ] `net-profit` = `sellProfit − (salary+bills+manualExpense)`, reconciles to `financial_balance_history`/`getStats.profit` within **0 UZS**; `/investor/opex` returns a **single** `totalOpEx`; `revenue` includes correct MoM/YoY growth % (`null` when no prior).
- [ ] `my-investment` `accruedProfitShare` = time-weighted `ownership_bps × net_profit`, correct across mid-period stake changes and multiple contributions; `accruedRoiPct` and `realizedRoiPct` exposed distinctly.
- [ ] Every investor read **and** export writes an `activity_log` row (`entity_type='investor_view'`) with actor id, endpoint, filters, and IP/device; no investor path calls `enrichLogs()`.
- [ ] `/investor/export` requires a date range, rejects spans >366 days, caps rows/sheet, is throttled, is access-logged, and produces a valid aggregate-only `.xlsx`.
- [ ] Business aggregate endpoints honor 5-min TTL cache; `my-investment`/`ledger` are not stale-cached.
- [ ] `check-investor-ledger-invariant.ts` passes and gates deploy alongside cashbox/card invariants; migrations reversible with no cashbox drift.
- [ ] Throttler + login lockout + helmet + pinned CORS live in prod before external exposure.
- [ ] Logging in as investor lands on `/investor/overview` (never the empty `/`); `InvestorSidebar` shows exactly Overview / Financials / Operations / My Investment / Profile; non-investor roles blocked from `/investor/*`; investor blocked from admin URLs (redirected to `/investor/overview`).
- [ ] All investor UI strings resolve via the `investor` namespace in **uz/ru/en** (uz primary, missing-key lint clean); money `uz-UZ` + " so'm"; dates `Asia/Tashkent`; dark mode + mobile (<640px) match existing pages; no console errors.
- [ ] Entire investor surface behind a feature flag, **OFF by default**; flag OFF fully hides it (kill-switch); rollback = flag OFF (no investor writes occurred) then `migration:revert`/restore from `server/backups/`.

---

**Note:** the investor UI ships trilingual (uz primary / ru / en); all backend messages, labels, and DTO field semantics must line up with the owner's uz-language definitions of *revenue vs profit vs net cash position vs OpEx* to avoid misstating ROI.