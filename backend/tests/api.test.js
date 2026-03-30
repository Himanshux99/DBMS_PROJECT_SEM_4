/**
 * CashFlow API Integration Tests
 * Uses Jest + Supertest
 * 
 * Test Coverage:
 * - Authentication (register, login)
 * - Account management (CRUD)
 * - Transactions (transfer, deposit, withdraw)
 * - Dashboard analytics
 * - Audit logging
 * - Error handling
 */

const request = require('supertest');
const app = require('../server');

// Test user data
const testUser = {
  name: 'Test User',
  email: `test${Date.now()}@example.com`,
  password: 'testpass123',
};

const testUser2 = {
  name: 'Test User 2',
  email: `test2${Date.now()}@example.com`,
  password: 'testpass123',
};

let authToken;
let authToken2;
let accountId1;
let accountId2;
let userId;

// ======================================
// Authentication Tests
// ======================================

describe('Authentication', () => {
  test('POST /api/auth/register - Create new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user_id');
    expect(response.body.email).toBe(testUser.email.toLowerCase());
    authToken = response.body.token;
    userId = response.body.user_id;
  });

  test('POST /api/auth/register - Reject duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(409)
      .expect(res => {
        expect(res.body.error).toContain('already registered');
      });
  });

  test('POST /api/auth/register - Reject short password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        email: 'test@example.com',
        password: '12345',
      })
      .expect(400)
      .expect(res => {
        expect(res.body.error).toContain('at least 6');
      });
  });

  test('POST /api/auth/login - Valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body.user_id).toBeDefined();
  });

  test('POST /api/auth/login - Invalid password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      })
      .expect(401);
  });

  test('POST /api/auth/login - Non-existent email', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'anypass',
      })
      .expect(401);
  });

  test('GET /api/auth/me - Get current user info', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.user_id).toBe(userId);
    expect(response.body.email).toBe(testUser.email.toLowerCase());
  });

  test('GET /api/auth/me - Reject missing token', async () => {
    await request(app)
      .get('/api/auth/me')
      .expect(401);
  });

  test('GET /api/auth/me - Reject invalid token', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123')
      .expect(401);
  });
});

// ======================================
// Account Tests
// ======================================

describe('Accounts', () => {
  // Register second user for testing
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send(testUser2);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser2.email,
        password: testUser2.password,
      });

    authToken2 = response.body.token;
  });

  test('POST /api/accounts - Create Savings account', async () => {
    const response = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        account_type: 'Savings',
        initial_balance: 5000,
      })
      .expect(201);

    expect(response.body.account).toHaveProperty('account_id');
    expect(response.body.account.account_type).toBe('Savings');
    expect(response.body.account.balance).toBe(5000);
    accountId1 = response.body.account.account_id;
  });

  test('POST /api/accounts - Create Checking account', async () => {
    const response = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        account_type: 'Checking',
        initial_balance: 2000,
      })
      .expect(201);

    expect(response.body.account.account_type).toBe('Checking');
    accountId2 = response.body.account.account_id;
  });

  test('POST /api/accounts - Reject invalid account type', async () => {
    await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        account_type: 'InvalidType',
        initial_balance: 1000,
      })
      .expect(400);
  });

  test('GET /api/accounts - Get all user accounts', async () => {
    const response = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.accounts).toBeInstanceOf(Array);
    expect(response.body.accounts.length).toBeGreaterThanOrEqual(2);
    expect(response.body.total_balance).toBeGreaterThan(0);
  });

  test('GET /api/accounts/:account_id - Get specific account', async () => {
    const response = await request(app)
      .get(`/api/accounts/${accountId1}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.account_id).toBe(accountId1);
    expect(response.body.account_type).toBe('Savings');
  });

  test('GET /api/accounts/:account_id - Reject access to other user account', async () => {
    await request(app)
      .get(`/api/accounts/${accountId1}`)
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(404);
  });

  test('GET /api/accounts/:account_id/balance - Get account balance', async () => {
    const response = await request(app)
      .get(`/api/accounts/${accountId1}/balance`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('balance');
    expect(response.body.balance).toBe(5000);
  });
});

// ======================================
// Transaction Tests
// ======================================

describe('Transactions', () => {
  test('POST /api/transactions/deposit - Deposit into account', async () => {
    const response = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        to_account_id: accountId1,
        amount: 1000,
      })
      .expect(200);

    expect(response.body.transaction).toHaveProperty('transaction_id');
    expect(response.body.transaction.transaction_type).toBe('Deposit');
    expect(response.body.transaction.amount).toBe(1000);
    expect(response.body.transaction.status).toBe('Completed');
  });

  test('POST /api/transactions/withdraw - Withdraw from account', async () => {
    const response = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        from_account_id: accountId1,
        amount: 500,
      })
      .expect(200);

    expect(response.body.transaction.transaction_type).toBe('Withdrawal');
    expect(response.body.transaction.amount).toBe(500);
  });

  test('POST /api/transactions/withdraw - Reject insufficient balance', async () => {
    await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        from_account_id: accountId1,
        amount: 999999,
      })
      .expect(400)
      .expect(res => {
        expect(res.body.error).toContain('Insufficient');
      });
  });

  test('POST /api/transactions/transfer - Transfer between accounts', async () => {
    const response = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        from_account_id: accountId1,
        to_account_id: accountId2,
        amount: 100,
      })
      .expect(200);

    expect(response.body.transaction.transaction_type).toBe('Transfer');
    expect(response.body.transaction.from_account_id).toBe(accountId1);
    expect(response.body.transaction.to_account_id).toBe(accountId2);
    expect(response.body.transaction.status).toBe('Completed');
  });

  test('POST /api/transactions/transfer - Reject same account transfer', async () => {
    await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        from_account_id: accountId1,
        to_account_id: accountId1,
        amount: 100,
      })
      .expect(400)
      .expect(res => {
        expect(res.body.error).toContain('same account');
      });
  });

  test('POST /api/transactions/transfer - Reject insufficient balance', async () => {
    await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        from_account_id: accountId1,
        to_account_id: accountId2,
        amount: 999999,
      })
      .expect(400)
      .expect(res => {
        expect(res.body.error).toContain('Insufficient');
      });
  });

  test('GET /api/transactions/:account_id - Get transaction history', async () => {
    const response = await request(app)
      .get(`/api/transactions/${accountId1}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.transactions).toBeInstanceOf(Array);
    expect(response.body.transactions.length).toBeGreaterThan(0);
    expect(response.body.pagination).toHaveProperty('page');
    expect(response.body.pagination).toHaveProperty('total');
  });

  test('GET /api/transactions/:account_id - Filter by type', async () => {
    const response = await request(app)
      .get(`/api/transactions/${accountId1}?type=Deposit`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.transactions).toBeInstanceOf(Array);
    response.body.transactions.forEach(txn => {
      expect(txn.transaction_type).toBe('Deposit');
    });
  });

  test('GET /api/transactions/:account_id - Reject access to other user account', async () => {
    await request(app)
      .get(`/api/transactions/${accountId1}`)
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(403);
  });
});

// ======================================
// Dashboard Tests
// ======================================

describe('Dashboard', () => {
  test('GET /api/dashboard/summary - Get dashboard summary', async () => {
    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.summary).toHaveProperty('total_balance');
    expect(response.body.summary).toHaveProperty('account_count');
    expect(response.body.cashflow).toHaveProperty('total_inflow');
    expect(response.body.cashflow).toHaveProperty('total_outflow');
    expect(response.body.cashflow).toHaveProperty('net_cash_flow');
  });

  test('GET /api/dashboard/cashflow - Get cash flow for month', async () => {
    const now = new Date();
    const response = await request(app)
      .get(`/api/dashboard/cashflow?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('total_inflow');
    expect(response.body).toHaveProperty('total_outflow');
    expect(response.body).toHaveProperty('net_cash_flow');
  });

  test('GET /api/dashboard/balance-trend - Get 6-month balance trend', async () => {
    const response = await request(app)
      .get('/api/dashboard/balance-trend')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.trend).toBeInstanceOf(Array);
    expect(response.body).toHaveProperty('current_total_balance');
  });
});

// ======================================
// Audit Tests
// ======================================

describe('Audit Logs', () => {
  test('GET /api/audit/logs - Admin can view all logs', async () => {
    // Note: This would require an admin token
    // For now, we'll expect 403 for regular user
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(403);
  });

  test('GET /api/audit/user/:user_id - Get own audit logs', async () => {
    const response = await request(app)
      .get(`/api/audit/user/${userId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('logs');
    expect(response.body.logs).toBeInstanceOf(Array);
  });

  test('GET /api/audit/user/:user_id - Reject access to other user logs', async () => {
    await request(app)
      .get('/api/audit/user/9999')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(403);
  });
});

// ======================================
// Error Handling Tests
// ======================================

describe('Error Handling', () => {
  test('GET /api/health - Health check endpoint', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('OK');
  });

  test('GET /api/nonexistent - 404 for non-existent route', async () => {
    await request(app)
      .get('/api/nonexistent')
      .expect(404);
  });

  test('POST /api/auth/login - 400 for missing fields', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        // missing password
      })
      .expect(400);
  });
});
