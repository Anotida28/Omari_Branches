# Query Performance Audit

This is a code-based audit of the likely slow read paths in the backend. It is based on query shape and data volume risk, not on a runtime benchmark yet.

## Highest-priority candidates

### 1) Wallet analytics endpoints
**Routes:** `/wallet/overview`, `/wallet/customer-activity`, `/wallet/retention-dormancy`, `/wallet/transaction-performance`, `/wallet/revenue-performance`, `/wallet/liquidity`

**Why likely slow:**
- These handlers route into the wallet service and rely on heavier aggregation logic.
- The service uses multiple data-heavy queries and raw SQL-style aggregation work in the same request path.
- The volume of wallet data is expected to grow quickly, so these endpoints are very likely to become the main bottlenecks.

**Relevant files:**
- [backend/src/controllers/wallet.controller.ts](backend/src/controllers/wallet.controller.ts)
- [backend/src/services/wallet.service.ts](backend/src/services/wallet.service.ts)

**Recommended next step:**
- Profile these endpoints first and capture actual query timings.
- If they are slow, focus on reducing the number of aggregate queries and using cached or precomputed summaries for common ranges.

### 2) Wallet customer 360 list endpoint
**Route:** `/wallet/customer-360`

**Why likely slow:**
- The endpoint runs a count query, then a paged `findMany`, then another `findFirst` for freshness metadata.
- The query is filtered by search fields and dormancy status, which can become expensive on larger snapshot tables.
- The snapshot table is likely to be large and will grow over time.

**Relevant files:**
- [backend/src/controllers/wallet.controller.ts](backend/src/controllers/wallet.controller.ts)
- [backend/src/services/wallet.service.ts](backend/src/services/wallet.service.ts)

**Recommended next step:**
- Ensure the filtering columns are indexed and confirm the query plan uses those indexes.
- Consider adding a lightweight summary table or cached snapshot for the list view if this endpoint is heavily used.

### 3) Alert log listing endpoint
**Route:** `/alert-logs/logs`

**Why likely slow:**
- The service performs `count` and `findMany` in parallel.
- The `findMany` query includes nested relations (`expense -> branch`) which expands the payload and can increase read cost.
- The query uses filters on `expenseId`, `branchId`, `ruleType`, `status`, and `sentAt`.

**Relevant files:**
- [backend/src/services/alert-logs.service.ts](backend/src/services/alert-logs.service.ts)

**Recommended next step:**
- Limit the included relation fields to only what the UI needs.
- Review whether the index on `(expenseId, ruleId, triggerLocalDate, status)` is being used effectively for the most common filter combinations.

### 4) Email log listing endpoint
**Route:** `/email-logs/logs`

**Why likely slow:**
- Similar pattern to alert logs: `count` + `findMany` + included branch relation.
- The query is likely to grow in cost as the email history table grows.

**Relevant files:**
- [backend/src/services/email-logs.service.ts](backend/src/services/email-logs.service.ts)

**Recommended next step:**
- Ensure the list only selects the fields the UI needs.
- Verify that `sentAt`, `status`, and `branchId` filters are using the expected indexes.

### 5) Metrics listing endpoint
**Route:** `/metrics`

**Why likely slow:**
- The service already batches source-line counts, which is a good improvement.
- However, it still depends on a list of branch metrics plus a second aggregation pass for source counts.
- This can still become heavier if the metric window is large or the page size is high.

**Relevant files:**
- [backend/src/services/metrics.service.ts](backend/src/services/metrics.service.ts)

**Recommended next step:**
- Keep the batching approach, but confirm whether the list view really needs the extra source-line count work on every page load.
- If the UI does not need it for every page, compute it only for the detail view or on demand.

### 6) Expense list endpoint
**Route:** `/expenses`

**Why likely slow:**
- The listing query is straightforward, but it can still become expensive if large date ranges are requested and the table grows.
- The filter set includes `branchId`, `expenseType`, `period`, and `dueDate` range.

**Relevant files:**
- [backend/src/services/expenses.service.ts](backend/src/services/expenses.service.ts)

**Recommended next step:**
- Confirm the `dueDate` and `branchId` filters use indexes in practice.
- Consider limiting the default date window for dashboard-style views.

## What to do first

1. Instrument the wallet endpoints and the alert/email log list endpoints.
2. Capture actual timings and query plans for the most-used filters.
3. Apply targeted changes to the top two or three offenders.

## Practical next steps

- Add request-level timing logs around the slowest handlers.
- Run `EXPLAIN ANALYZE` for the most expensive Prisma queries.
- Reduce the number of fields returned for list views.
- Avoid nested relation includes unless the UI truly needs them.
