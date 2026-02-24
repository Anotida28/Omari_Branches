# Omari Branch System - Startup Guide

## Prerequisites

1. Node.js (v18 or higher)
2. MySQL server running locally or remotely
3. npm package manager

---

## Step 1: Create Database

```sql
CREATE DATABASE omari_branch_db;
```

---

## Step 2: Configure Environment

```bash
cd backend
copy .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/omari_branch_db"
AUTH_TOKEN_SECRET="change-this-in-production-12345"
AUTH_TOKEN_TTL_HOURS=24
PORT=4000
EMAIL_PROVIDER=gmail
EMAIL_FROM="helpdesk@yourdomain.com"
EMAIL_USER="helpdesk@yourdomain.com"
EMAIL_APP_PASSWORD="your-16-char-app-password"
```

Notes:
- Gmail/Google Workspace requires a Google App Password for SMTP auth.
- Enable 2-Step Verification for the mailbox before creating the app password.

---

## Step 3: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## Step 4: Setup Database

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed demo data + default users
npm run prisma:seed
```

---

## Step 5: Start the Application

### Terminal 1 - Backend API
```bash
cd backend
npm run dev
```
Backend runs at: http://localhost:4000

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```
Frontend runs at: http://localhost:5173

---

## Step 6: Login

1. Open http://localhost:5173
2. Use one of the seeded users:
   - `admin` / `admin123` (`FULL_ACCESS`)
   - `viewer` / `viewer123` (`VIEWER`, read-only)

---

## Quick Test - Verify Backend

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"ok":true,"service":"omari-branch-system-backend"}
```

---

## Seeded Demo Data

After running `npm run prisma:seed`:

- Branches: Harare HQ, Bulawayo Central, Mutare East
- Metrics: today entry for each branch
- Expenses: RENT expense for current month per branch
- Alert rules: due reminders (-7, -3, -1) and escalations (+1, +7, +14)
- Users: `admin` (full access), `viewer` (read-only)

---

## API Endpoints Reference

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/health` | GET | Health check |
| `/api/auth/login` | POST | Username/password login |
| `/api/auth/me` | GET | Current authenticated user |
| `/api/auth/logout` | POST | Logout (client token clear) |
| `/api/branches` | GET, POST | List/create branches |
| `/api/branches/:id` | GET, PATCH, DELETE | Branch CRUD |
| `/api/metrics` | GET | List metrics |
| `/api/metrics/upsert` | POST | Upsert metric |
| `/api/expenses` | GET, POST | List/create expenses |
| `/api/expenses/:id` | GET, PATCH, DELETE | Expense CRUD |
| `/api/expenses/:id/payments` | GET, POST | Payments for expense |
| `/api/documents` | POST | Upload document reference |
| `/api/admin/test-email` | POST | Send admin SMTP test email |

Auth rules:
- `POST /api/auth/login` is public.
- Other `/api/*` routes require `Authorization: Bearer <token>`.
- `VIEWER` users are read-only (GET/HEAD/OPTIONS).
- `FULL_ACCESS` users can create/update/delete.

---

## Troubleshooting

### MySQL access denied
- Check user/password in `DATABASE_URL`
- Ensure the MySQL user has permissions on `omari_branch_db`

### Connection refused
- Ensure MySQL is running
- Confirm MySQL port (default 3306)

### Prisma migration fails
- Ensure DB exists: `CREATE DATABASE omari_branch_db;`
- Check `DATABASE_URL`

### Frontend cannot connect to backend
- Ensure backend is running on port 4000
- Check `VITE_API_BASE_URL` if you changed backend host/port

---

## Project Structure

```text
omari-branch-system/
|-- backend/
|   |-- prisma/
|   |-- src/
|   |   |-- controllers/
|   |   |-- services/
|   |   |-- routes/
|   |   `-- middlewares/
|   `-- .env
`-- frontend/
    `-- src/
        |-- pages/
        |-- services/
        |-- components/
        `-- hooks/
```
