# Omari Branch System - Startup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **MySQL** server running locally or remotely
3. **npm** package manager

---

## Step 1: Create Database

Open MySQL and create a new database:

```sql
CREATE DATABASE omari_branch_db;
```

---

## Step 2: Configure Environment

Copy the example environment file and update with your credentials:

```bash
cd backend
copy .env.example .env
```

Edit `backend/.env` with your MySQL credentials:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/omari_branch_db"
API_KEY="omari-secure-api-key-2026"
PORT=4000
```

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

# Run migrations (creates tables)
npm run prisma:migrate

# Seed demo data (optional but recommended)
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
Frontend runs at: http://localhost:5173 (Vite default)

---

## Step 6: Access the Application

1. Open http://localhost:5173 in your browser
2. Enter the API key: `omari-secure-api-key-2026` (or whatever you set in .env)
3. You're in!

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

After running `npm run prisma:seed`, you'll have:

| Data | Details |
|------|---------|
| Branches | Harare HQ, Bulawayo Central, Mutare East |
| Metrics | Today's metrics for each branch |
| Expenses | RENT expense for current month per branch |
| Alert Rules | Due reminders (-7, -3, -1 days) and escalations (+1, +7, +14 days) |

---

## Troubleshooting

### "Access denied" MySQL error
- Check your username/password in DATABASE_URL
- Ensure MySQL user has permissions on the database

### "ECONNREFUSED" error
- Make sure MySQL is running
- Check the port (default 3306)

### Prisma migration fails
- Ensure database exists: `CREATE DATABASE omari_branch_db;`
- Check DATABASE_URL format

### Frontend can't connect to backend
- Ensure backend is running on port 4000
- Check for CORS errors in browser console

---

## API Endpoints Reference

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/health` | GET | Health check |
| `/api/branches` | GET, POST | List/create branches |
| `/api/branches/:id` | GET, PATCH, DELETE | Branch CRUD |
| `/api/metrics` | GET, POST | List/upsert metrics |
| `/api/expenses` | GET, POST | List/create expenses |
| `/api/expenses/:id` | GET, PATCH, DELETE | Expense CRUD |
| `/api/expenses/:id/payments` | GET, POST | Payments for expense |
| `/api/documents` | POST | Upload document reference |

All `/api/*` routes require header: `x-api-key: YOUR_API_KEY`

---

## Project Structure

```
omari-branch-system/
├── backend/
│   ├── prisma/           # Database schema & migrations
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── services/     # Business logic
│   │   ├── routes/       # API routes
│   │   └── middlewares/  # Auth, validation, errors
│   └── .env              # Environment config (create this!)
│
└── frontend/
    └── src/
        ├── pages/        # Dashboard, Branches, Metrics, Expenses
        ├── services/     # API client functions
        ├── components/   # Reusable UI components
        └── hooks/        # React hooks (useApiKey, etc.)
```

---

## Next Steps

After successful startup:
1. Create branches for your locations
2. Add daily metrics for cash tracking
3. Create expenses and track payments
4. Set up email recipients for alerts (future feature)

Happy tracking! 🚀
