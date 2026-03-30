# CashFlow API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Authentication

#### 1. Register
```
POST /auth/register
```
**Description:** Register a new user  
**Auth Required:** No  

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "message": "Registration successful",
  "user_id": 1,
  "email": "john@example.com",
  "name": "John Doe",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}
```

**Errors:**
- `400` - Missing fields or invalid input
- `409` - Email already registered

---

#### 2. Login
```
POST /auth/login
```
**Description:** Login and get JWT token  
**Auth Required:** No  

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role_id": 1,
  "role_name": "Customer",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}
```

**Errors:**
- `400` - Missing fields
- `401` - Invalid credentials

---

#### 3. Get Current User
```
GET /auth/me
```
**Description:** Get current authenticated user info  
**Auth Required:** Yes  

**Response (200):**
```json
{
  "user_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role_id": 1,
  "role_name": "Customer"
}
```

---

### Accounts

#### 1. Get All Accounts
```
GET /accounts
```
**Description:** Get all accounts for logged-in user  
**Auth Required:** Yes  

**Response (200):**
```json
{
  "count": 2,
  "total_balance": 5000.00,
  "accounts": [
    {
      "account_id": 1,
      "user_id": 1,
      "account_type": "Savings",
      "balance": 3000.00,
      "status": "Active",
      "created_at": "2026-03-30T10:00:00.000Z",
      "updated_at": "2026-03-30T10:00:00.000Z"
    }
  ]
}
```

---

#### 2. Create Account
```
POST /accounts
```
**Description:** Create a new account  
**Auth Required:** Yes  

**Request Body:**
```json
{
  "account_type": "Savings",
  "initial_balance": 1000.00
}
```

**Response (201):**
```json
{
  "message": "Account created successfully",
  "account": {
    "account_id": 2,
    "user_id": 1,
    "account_type": "Savings",
    "balance": 1000.00,
    "status": "Active",
    "created_at": "2026-03-30T11:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Invalid account_type or balance

---

#### 3. Get Account Details
```
GET /accounts/:account_id
```
**Description:** Get specific account details  
**Auth Required:** Yes  

**Response (200):**
```json
{
  "account_id": 1,
  "user_id": 1,
  "account_type": "Savings",
  "balance": 3000.00,
  "status": "Active",
  "created_at": "2026-03-30T10:00:00.000Z"
}
```

---

#### 4. Get Account Balance
```
GET /accounts/:account_id/balance
```
**Description:** Get current account balance  
**Auth Required:** Yes  

**Response (200):**
```json
{
  "account_id": 1,
  "balance": 3000.00,
  "status": "Active",
  "currency": "USD"
}
```

---

#### 5. Update Account Status
```
PATCH /accounts/:account_id/status
```
**Description:** Update account status (Admin or owner)  
**Auth Required:** Yes  

**Request Body:**
```json
{
  "status": "Frozen"
}
```

**Response (200):**
```json
{
  "message": "Account status updated successfully",
  "account_id": 1,
  "new_status": "Frozen"
}
```

**Status Options:** `Active`, `Inactive`, `Frozen`

---

### Transactions

#### 1. Transfer Funds (ACID Compliant)
```
POST /transactions/transfer
```
**Description:** Transfer funds between accounts (atomic operation)  
**Auth Required:** Yes  

**Request Body:**
```json
{
  "from_account_id": 1,
  "to_account_id": 2,
  "amount": 500.00
}
```

**Response (200):**
```json
{
  "message": "Transfer successful",
  "transaction": {
    "transaction_id": 1,
    "from_account_id": 1,
    "to_account_id": 2,
    "amount": 500.00,
    "transaction_type": "Transfer",
    "status": "Completed",
    "created_at": "2026-03-30T12:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Insufficient balance or invalid accounts
- `403` - Access denied

---

#### 2. Deposit
```
POST /transactions/deposit
```
**Description:** Deposit funds into account  
**Auth Required:** Yes  

**Request Body:**
```json
{
  "to_account_id": 1,
  "amount": 1000.00
}
```

**Response (200):**
```json
{
  "message": "Deposit successful",
  "transaction": {
    "transaction_id": 2,
    "to_account_id": 1,
    "amount": 1000.00,
    "transaction_type": "Deposit",
    "status": "Completed",
    "created_at": "2026-03-30T12:05:00.000Z"
  }
}
```

---

#### 3. Withdraw
```
POST /transactions/withdraw
```
**Description:** Withdraw funds from account  
**Auth Required:** Yes  

**Request Body:**
```json
{
  "from_account_id": 1,
  "amount": 500.00
}
```

**Response (200):**
```json
{
  "message": "Withdrawal successful",
  "transaction": {
    "transaction_id": 3,
    "from_account_id": 1,
    "amount": 500.00,
    "transaction_type": "Withdrawal",
    "status": "Completed",
    "created_at": "2026-03-30T12:10:00.000Z"
  }
}
```

---

#### 4. Get Transaction History
```
GET /transactions/:account_id?type=&status=&date_from=&date_to=&page=1&limit=10
```
**Description:** Get transactions for an account  
**Auth Required:** Yes  

**Query Parameters:**
- `type` - Filter by type (Transfer, Deposit, Withdrawal)
- `status` - Filter by status (Completed, Pending, Failed)
- `date_from` - Filter from date (YYYY-MM-DD)
- `date_to` - Filter to date (YYYY-MM-DD)
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 10)

**Response (200):**
```json
{
  "account_id": 1,
  "transactions": [
    {
      "transaction_id": 1,
      "from_account_id": 1,
      "to_account_id": 2,
      "amount": 500.00,
      "transaction_type": "Transfer",
      "status": "Completed",
      "created_at": "2026-03-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

---

### Dashboard

#### 1. Get Dashboard Summary
```
GET /dashboard/summary?month=3&year=2026
```
**Description:** Get complete dashboard summary with all metrics  
**Auth Required:** Yes  

**Response (200):**
```json
{
  "summary": {
    "total_balance": 5000.00,
    "account_count": 2,
    "transaction_count_month": 10,
    "month": 3,
    "year": 2026
  },
  "cashflow": {
    "total_inflow": 1500.00,
    "total_outflow": 800.00,
    "net_cash_flow": 700.00,
    "total_transactions": 5
  }
}
```

---

#### 2. Get Cash Flow Summary
```
GET /dashboard/cashflow?month=3&year=2026
```
**Description:** Get monthly inflow, outflow, and net cash flow  
**Auth Required:** Yes  

**Response (200):**
```json
{
  "total_inflow": 1500.00,
  "total_outflow": 800.00,
  "net_cash_flow": 700.00,
  "month": 3,
  "year": 2026,
  "total_transactions": 5
}
```

---

#### 3. Get Balance Trend
```
GET /dashboard/balance-trend
```
**Description:** Get balance trend for last 6 months  
**Auth Required:** Yes  

**Response (200):**
```json
{
  "trend": [
    {
      "month": 10,
      "year": 2025,
      "month_year": "2025-10",
      "balance": 3000.00,
      "monthly_net": 0
    },
    {
      "month": 3,
      "year": 2026,
      "month_year": "2026-03",
      "balance": 5000.00,
      "monthly_net": 700.00
    }
  ],
  "current_total_balance": 5000.00
}
```

---

### Audit Logs (Admin Only)

#### 1. Get All Audit Logs
```
GET /audit/logs?user_id=&action=&date_from=&date_to=&page=1&limit=50
```
**Description:** Get all audit logs (Admin only)  
**Auth Required:** Yes (Admin role required)  

**Query Parameters:**
- `user_id` - Filter by user ID
- `action` - Filter by action (substring search)
- `date_from` - Filter from date
- `date_to` - Filter to date
- `page` - Page number
- `limit` - Records per page

**Response (200):**
```json
{
  "logs": [
    {
      "log_id": 1,
      "user_id": 1,
      "email": "john@example.com",
      "name": "John Doe",
      "action": "TRANSFER_FUNDS",
      "description": "Transfer of 500 from Account 1 to Account 2",
      "affected_table": "Transaction",
      "affected_id": 1,
      "timestamp": "2026-03-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

---

#### 2. Get User Audit Logs
```
GET /audit/user/:user_id?page=1&limit=50
```
**Description:** Get audit logs for a specific user  
**Auth Required:** Yes (User can view own, Admin can view any)  

**Response (200):**
```json
{
  "user_id": 1,
  "logs": [
    {
      "log_id": 1,
      "user_id": 1,
      "action": "USER_REGISTERED",
      "description": "User registered: john@example.com",
      "affected_table": "User",
      "affected_id": 1,
      "timestamp": "2026-03-30T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "pages": 1
  }
}
```

---

#### 3. Get Audit Statistics
```
GET /audit/stats
```
**Description:** Get audit statistics (Admin only)  
**Auth Required:** Yes (Admin role required)  

**Response (200):**
```json
{
  "actions_by_type": [
    {
      "action": "TRANSFER_FUNDS",
      "count": 50
    },
    {
      "action": "DEPOSIT_FUNDS",
      "count": 30
    }
  ],
  "last_24_hours": 15,
  "most_active_users": [
    {
      "user_id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "action_count": 45
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

---

## Example cURL Requests

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"pass123"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}'
```

### Create Account
```bash
curl -X POST http://localhost:5000/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"account_type":"Savings","initial_balance":1000}'
```

### Transfer
```bash
curl -X POST http://localhost:5000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"from_account_id":1,"to_account_id":2,"amount":500}'
```

### Get Transactions
```bash
curl -X GET "http://localhost:5000/api/transactions/1?status=Completed&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Notes

- All amounts are in USD (2-decimal precision)
- Timestamps are in ISO 8601 format (UTC)
- Transfers are ACID compliant with automatic rollback on failure
- All transactions trigger automatic audit logging
- Account balances are protected from going negative
- Frozen/Inactive accounts cannot perform transactions
