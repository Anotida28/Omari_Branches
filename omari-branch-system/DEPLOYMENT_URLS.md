# Omari Branch System Deployment URLs

This sheet lists the URLs and connection targets used by the system.

## 1. Public App URLs

- Frontend app: `http://172.16.3.21:3500`
- Backend API: `http://172.16.3.21:5500`
- Backend health check: `http://172.16.3.21:5500/health`

## 2. Frontend Routes

- `/`
- `/login`
- `/branches`
- `/metrics`
- `/trends`
- `/reports`
- `/expenses`
- `/alerts`
- `/settings`
- `/wallet/overview`
- `/wallet/customer-activity`
- `/wallet/retention-dormancy`
- `/wallet/transaction-performance`
- `/wallet/revenue`
- `/wallet/liquidity`
- `/wallet/customer-360`
- `/wallet/insights-alerts`
- `/wallet/visa-analytics`

## 3. Backend API Endpoints

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Admin

- `POST /api/admin/test-email`

### Alerts

- `GET /api/alerts/stats`
- `GET /api/alerts/logs`
- `GET /api/alerts/logs/:id`
- `POST /api/alerts/trigger`
- `POST /api/alerts/trigger-daily-report`
- `POST /api/alerts/trigger-wallet-report`
- `GET /api/alerts/jobs`

### Branches

- `POST /api/branches`
- `GET /api/branches`
- `GET /api/branches/validate-agent-line`
- `GET /api/branches/:id`
- `PATCH /api/branches/:id`
- `DELETE /api/branches/:id`

### Email Logs

- `GET /api/emails/logs`

### Expenses

- `POST /api/expenses`
- `GET /api/expenses`
- `GET /api/expenses/:id`
- `PATCH /api/expenses/:id`
- `DELETE /api/expenses/:id`

### Metrics

- `GET /api/metrics/source-mapping`
- `POST /api/metrics/sync`
- `POST /api/metrics/upsert`
- `GET /api/metrics`
- `GET /api/metrics/by-branch-date`
- `GET /api/metrics/:id`
- `DELETE /api/metrics/:id`

### Recurring Reminders

- `POST /api/recurring-reminders`
- `GET /api/recurring-reminders`
- `GET /api/recurring-reminders/:id`
- `PATCH /api/recurring-reminders/:id`
- `DELETE /api/recurring-reminders/:id`

### Recipients

- `GET /api/recipients`
- `POST /api/recipients`
- `GET /api/recipients/:recipientId`
- `PATCH /api/recipients/:recipientId`
- `DELETE /api/recipients/:recipientId`

### Wallet

- `GET /api/wallet/overview`
- `GET /api/wallet/customer-activity`
- `GET /api/wallet/retention-dormancy`
- `GET /api/wallet/transaction-performance`
- `GET /api/wallet/revenue-performance`
- `GET /api/wallet/liquidity`
- `GET /api/wallet/customer-360`
- `GET /api/wallet/customer-360/:customerId`
- `GET /api/wallet/insights-alerts`
- `GET /api/wallet/visa-analytics`

## 4. External Services

- External auth login: `http://180.10.1.222:3002/authenticate/login`
- Access gateway base: `http://172.16.3.21:3003`
- Bulk mailer base: `https://bulkmailer-nlb-8d1146c95f851bda.elb.eu-west-1.amazonaws.com`
- Bulk mailer send path: `/mail/send-email-single`

## 5. Databases

### Main Omari Branches App Database

- Used by the backend through `DATABASE_URL`
- Production placeholder currently set in the repo as: `sqlserver://...`

### Omari Source Database

- Used for reporting and wallet/branch metrics extraction
- Configured with the `SOURCE_SQL_*` environment variables
- Key values currently in the repo:
  - `SOURCE_SQL_SERVER=172.16.7.216`
  - `SOURCE_SQL_PORT=1433`
  - `SOURCE_SQL_DATABASE=omari_dp`

## 6. Frontend API Base Setting

- `VITE_API_BASE_URL=http://172.16.3.21:5500`
- `VITE_API_URL=http://172.16.3.21:5500`

## 7. Deployment Notes

- The frontend must point at the backend API base URL.
- The backend uses the main app database plus the separate Omari source database.
- If the source database is unreachable, wallet and branch reporting will fail even if the main app DB is online.
