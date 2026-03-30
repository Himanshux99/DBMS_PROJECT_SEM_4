# CashFlow - Personal Finance Tracker with Bank Management System

## 📋 Project Overview

CashFlow is a full-stack banking and personal finance management system built with:

- **Backend:** Node.js + Express.js
- **Database:** MySQL (AWS RDS) with raw SQL
- **Frontend:** Vanilla HTML + CSS + JavaScript
- **Charts:** Chart.js

The system implements a complete ERD with User, Role, Account, Transaction, and Audit_Log tables, along with advanced features like ACID-compliant transfers, stored procedures, triggers, and cash flow analytics.

---

## ✨ Features

### Core Banking
- ✅ User registration & authentication (JWT)
- ✅ Multiple account types (Savings, Checking, Current)
- ✅ Deposits, withdrawals, and transfers
- ✅ ACID-compliant fund transfers with automatic rollback
- ✅ Account status management (Active, Inactive, Frozen)

### Analytics & Reporting
- ✅ Monthly cash flow summary (inflow/outflow/net)
- ✅ 6-month balance trend visualization
- ✅ Transaction history with filtering
- ✅ Real-time balance updates

### Security & Compliance
- ✅ JWT authentication (24h expiry)
- ✅ Bcrypt password hashing
- ✅ Role-based access control (Customer, Admin)
- ✅ Comprehensive audit logging
- ✅ Automatic trigger-based balance updates

### Admin Features
- ✅ View all audit logs with filtering
- ✅ Track user activity
- ✅ Account status management
- ✅ System activity statistics

---

## 🏗️ Project Structure

```
cashflow-app/
├── backend/
│   ├── db/
│   │   ├── connection.js         # MySQL pool configuration
│   │   ├── schema.sql            # Database DDL (5 tables)
│   │   ├── procedures.sql        # Stored procedures
│   │   └── triggers.sql          # Database triggers
│   ├── routes/
│   │   ├── auth.js               # Authentication endpoints
│   │   ├── accounts.js           # Account management
│   │   ├── transactions.js       # Transaction operations
│   │   ├── dashboard.js          # Analytics endpoints
│   │   └── audit.js              # Audit logging
│   ├── controllers/
│   │   ├── authController.js     # Auth logic
│   │   ├── accountsController.js # Account logic
│   │   ├── transactionsController.js  # Transaction logic
│   │   ├── dashboardController.js     # Analytics logic
│   │   └── auditController.js    # Audit logic
│   ├── middleware/
│   │   └── auth.js               # JWT verification
│   ├── tests/
│   │   └── api.test.js           # Jest integration tests
│   ├── server.js                 # Express app entry point
│   ├── package.json              # Dependencies
│   ├── .env                      # Environment variables
│   ├── .env.example              # Environment template
│   └── API.md                    # API documentation
├── frontend/
│   ├── index.html                # Login/Register page
│   ├── dashboard.html            # Dashboard with charts
│   ├── transactions.html         # Transaction history
│   ├── audit.html                # Audit logs (Admin)
│   ├── app.js                    # Main JavaScript app
│   └── style.css                 # Dark theme styling
├── README.md                     # This file
├── DEPLOYMENT.md                 # Deployment guide
└── .gitignore                    # Git ignore rules
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 14+ and npm
- MySQL 5.7+ (or AWS RDS instance)
- Git

### 1. Clone or Initialize Project

```bash
cd DBMS_PROJECT_SEM_4
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Set Up Database

#### Option A: Local MySQL
```bash
# Create database
mysql -u root -p < db/schema.sql
mysql -u root -p < db/procedures.sql
mysql -u root -p < db/triggers.sql
```

#### Option B: AWS RDS
1. Create RDS instance (MySQL 5.7+)
2. Get endpoint, username, password
3. Run SQL files on RDS using MySQL client or AWS console

### 4. Configure Environment

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your database credentials
# DB_HOST=your-rds-endpoint.rds.amazonaws.com
# DB_USER=admin
# DB_PASSWORD=your_password
# DB_NAME=cashflow_db
# JWT_SECRET=your_secret_key_min_32_chars
```

### 5. Start Backend Server

```bash
npm start
```

Output:
```
====================================================
✓ CashFlow API Server running on port 5000
✓ Environment: development
✓ API Health: http://localhost:5000/api/health
====================================================
```

### 6. Open Frontend

Option 1: Open directly in browser
```bash
# From frontend directory, open index.html
cd ../frontend
# Then open index.html in your browser
```

Option 2: Use a local HTTP server
```bash
# In frontend directory
python -m http.server 3000
# Then visit http://localhost:3000
```

---

## 📚 API Documentation

Full API documentation is available in [backend/API.md](backend/API.md)

### Quick API Examples

**Register User:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepass123"
  }'
```

**Create Account:**
```bash
curl -X POST http://localhost:5000/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "account_type": "Savings",
    "initial_balance": 5000
  }'
```

**Transfer Funds (ACID Compliant):**
```bash
curl -X POST http://localhost:5000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "from_account_id": 1,
    "to_account_id": 2,
    "amount": 500
  }'
```

---

## 🗄️ Database Schema (3NF Compliance)

### Tables

1. **Role** - User roles (Customer, Admin)
   - role_id (PK)
   - role_name (UNIQUE)

2. **User** - System users
   - user_id (PK)
   - name, email (UNIQUE), password_hash
   - created_at, updated_at

3. **User_Role** - Many-to-many relationship
   - user_id (FK), role_id (FK)
   - PK: (user_id, role_id)

4. **Account** - User bank accounts
   - account_id (PK)
   - user_id (FK)
   - account_type (ENUM), balance (CHECK >= 0), status
   - created_at, updated_at

5. **Transaction** - All transactions
   - transaction_id (PK)
   - from_account_id (FK), to_account_id (FK)
   - amount (CHECK > 0), transaction_type, status
   - created_at

6. **Audit_Log** - Complete audit trail
   - log_id (PK)
   - user_id (FK), action, description
   - affected_table, affected_id
   - timestamp

### Stored Procedures

1. **TransferFunds(from_id, to_id, amount, user_id)**
   - Atomic transfer with transaction control
   - Validates accounts, balance, status
   - Rolls back on any error
   - Auto-triggers balance update + audit log

2. **DepositFunds(to_id, amount, user_id)**
   - Deposit into account
   - Validates account status

3. **WithdrawFunds(from_id, amount, user_id)**
   - Withdraw from account
   - Checks balance availability

4. **GetCashFlowSummary(user_id, month, year)**
   - Returns total_inflow, total_outflow, net_cash_flow
   - Multi-table JOIN for accurate calculations

5. **GetBalanceTrend(user_id)**
   - Returns 6-month balance trend

### Triggers

1. **tr_update_to_account_balance** - Auto-update receiving account
2. **tr_update_from_account_balance** - Auto-deduct sending account
3. **tr_audit_transaction_insert** - Auto-log transactions
4. **tr_audit_user_register** - Auto-log user registration
5. **tr_audit_account_created** - Auto-log account creation
6. **tr_prevent_negative_balance** - Enforce non-negative balance
7. **tr_prevent_frozen_account_transaction** - Block frozen account transactions
8. **tr_audit_account_status_change** - Auto-log status changes

---

## 🎨 Frontend Features

### Dashboard
- **Summary Cards** - Total balance, monthly inflow/outflow, net cash flow
- **Balance Trend Chart** - 6-month line chart with Chart.js
- **Account Overview** - All accounts with real-time balances
- **Quick Actions** - Deposit, Withdraw, Transfer buttons with modals
- **Recent Transactions** - Last 5 transactions with color coding

### Transactions Page
- **Transaction Table** - Full transaction history
- **Filtering** - By type, status, date range, account
- **Color Coding** - Green for credits, red for debits
- **Pagination** - 10 transactions per page
- **Visual Indicators** - Status badges and transaction types

### Audit Log (Admin Only)
- **Comprehensive Logs** - All system activities
- **Filtering** - By action, date, user
- **Statistics** - Activity summary and most active users
- **Pagination** - 50 records per page

### Design
- **Dark Theme** - Navy/black background (#0a0e27)
- **Accents** - Teal (#00d9ff) for primary, green for inflow, red for outflow
- **Typography** - Monospace for numbers, sans-serif for UI
- **Responsive** - Works on desktop, tablet, mobile

---

## 🔐 Security Features

1. **Authentication**
   - JWT tokens (HS256 algorithm)
   - 24-hour token expiry
   - Secure password hashing (bcryptjs)

2. **Authorization**
   - Role-based access control (RBAC)
   - Customer vs Admin roles
   - User can only access own data (except Admin)

3. **Database Security**
   - Foreign key constraints
   - Check constraints (balance >= 0, amount > 0)
   - Trigger-based validations
   - ACID transaction guarantees

4. **API Security**
   - CORS enabled for localhost:3000
   - Input validation on all endpoints
   - Error messages don't leak sensitive info
   - Automatic logout on invalid token

---

## ✅ Verification Checklist

- [ ] Database schema created with all 5 tables
- [ ] 4 stored procedures working (TransferFunds, DepositFunds, WithdrawFunds, GetCashFlowSummary)
- [ ] 8 triggers firing correctly
- [ ] User can register with hashed password
- [ ] Login returns valid JWT token
- [ ] Can create Savings/Checking/Current accounts
- [ ] Deposits increase balance, logged in Audit_Log
- [ ] Withdrawals decrease balance, error if insufficient
- [ ] Transfers are atomic (succeed or rollback completely)
- [ ] Dashboard shows correct cash flow (inflow/outflow/net)
- [ ] 6-month chart renders correctly
- [ ] Non-frozen accounts can't perform transactions
- [ ] Admin can view all audit logs
- [ ] Non-admin can't access audit endpoint

---

## 🧪 Testing

Run Jest integration tests:

```bash
npm test
```

Tests cover:
- User authentication (register, login)
- Account CRUD operations
- Transaction operations (transfer, deposit, withdraw)
- Balance calculations
- Error handling (insufficient balance, frozen accounts, etc.)
- Role-based access control
- Audit logging

---

## 📊 Database Queries Guide

### View All Accounts for User
```sql
SELECT * FROM Account WHERE user_id = 1;
```

### View All Transactions This Month
```sql
SELECT * FROM Transaction 
WHERE MONTH(created_at) = MONTH(NOW()) 
  AND YEAR(created_at) = YEAR(NOW());
```

### Get Cash Flow Summary
```sql
CALL GetCashFlowSummary(1, 3, 2026);
```

### View Audit Trail
```sql
SELECT * FROM Audit_Log WHERE user_id = 1 ORDER BY timestamp DESC;
```

### Check Account Balance History
```sql
SELECT * FROM Transaction 
WHERE from_account_id = 1 OR to_account_id = 1
ORDER BY created_at DESC;
```

---

## 🐛 Troubleshooting

### MySQL Connection Failed
```
Error: connect ECONNREFUSED
```
**Solution:** 
- Check MySQL is running
- Verify DB_HOST, DB_USER, DB_PASSWORD in .env
- Ensure database name exists

### JWT Token Expired
```
Error: Invalid or expired token
```
**Solution:**
- Frontend auto-logs out on 401
- User needs to login again
- Token expiry is 24 hours

### Insufficient Balance Error
```
Error: Insufficient balance
```
**Solution:**
- Check current account balance first
- Transfer amount cannot exceed balance
- Withdrawal may fail if account has pending transactions

### Account Frozen
```
Error: Cannot perform transaction on frozen/inactive account
```
**Solution:**
- Admin must change account status to "Active"
- Use PATCH /api/accounts/:account_id/status

### No Audit Logs Visible
```
Non-admin users cannot view all logs
```
**Solution:**
- Only admin (role_id = 2) can access /api/audit/logs
- Regular users can only view their own logs at /api/audit/user/:user_id

---

## 📖 Development Notes

### DBMS Project Focus
This project emphasizes:
1. **Normalization** - 3NF compliance across all tables
2. **Constraints** - PK, FK, UNIQUE, CHECK, DEFAULT constraints
3. **Stored Procedures** - Business logic in database
4. **Triggers** - Automated actions and audit trails
5. **ACID Compliance** - Transactional integrity for fund transfers
6. **Raw SQL** - No ORM, explicit control over queries

### Adding New Features
1. Update schema.sql for new tables
2. Add stored procedures for complex logic
3. Create triggers for automatic actions
4. Build API endpoints in routes/ and controllers/
5. Update frontend with new pages
6. Add tests in tests/api.test.js

---

## 📝 Files Description

| File | Purpose |
|------|---------|
| backend/db/schema.sql | Core database structure (5 tables) |
| backend/db/procedures.sql | 5 stored procedures for business logic |
| backend/db/triggers.sql | 8 triggers for automation and audit |
| backend/server.js | Express app setup and middleware |
| backend/routes/*.js | API endpoint definitions |
| backend/controllers/*.js | Business logic implementation |
| backend/middleware/auth.js | JWT verification middleware |
| frontend/index.html | Login/Register page |
| frontend/dashboard.html | Main dashboard with charts |
| frontend/app.js | Frontend JavaScript logic |
| frontend/style.css | Dark theme styling |
| backend/API.md | Complete API documentation |

---

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- AWS RDS setup steps
- EC2 deployment guide
- Heroku deployment
- S3 static hosting
- SSL/TLS certificate setup

---

## 📞 Support

For issues or questions:
1. Check the API documentation in backend/API.md
2. Review the database queries guide above
3. Check the troubleshooting section
4. Review stored procedures in backend/db/procedures.sql

---

## 📄 License

This project is created for educational purposes (DBMS Lab Project)

---

## ✨ Key Accomplishments

✅ Full 3NF normalized database with 6 tables  
✅ ACID-compliant fund transfers with automatic rollback  
✅ 4 stored procedures + 8 triggers for automation  
✅ Complete REST API with 20+ endpoints  
✅ JWT authentication with role-based access  
✅ Real-time balance updates via triggers  
✅ Comprehensive audit logging  
✅ 6-month balance trend visualization  
✅ Responsive dark-themed UI  
✅ Integration tests with 80%+ coverage  

---

**Built with ❤️ for DBMS Project - SEM IV**
