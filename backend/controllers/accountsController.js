const pool = require('../db/connection');

/**
 * Get all accounts for the logged-in user
 * GET /api/accounts
 */
const getAllAccounts = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const connection = await pool.getConnection();
    const [accounts] = await connection.query(
      `SELECT account_id, user_id, account_type, balance, status, created_at, updated_at
       FROM Account
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    connection.release();

    res.json({
      count: accounts.length,
      accounts,
      total_balance: accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0),
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts', details: error.message });
  }
};

/**
 * Create a new account for the logged-in user
 * POST /api/accounts
 * Body: { account_type: 'Savings' | 'Checking' | 'Current' }
 */
const createAccount = async (req, res) => {
  try {
    const { account_type, initial_balance } = req.body;
    const userId = req.user.user_id;

    // Validation
    if (!account_type) {
      return res.status(400).json({ error: 'Account type is required' });
    }

    const validTypes = ['Savings', 'Checking', 'Current'];
    if (!validTypes.includes(account_type)) {
      return res.status(400).json({ error: `Account type must be one of: ${validTypes.join(', ')}` });
    }

    if (initial_balance && (isNaN(initial_balance) || initial_balance < 0)) {
      return res.status(400).json({ error: 'Initial balance must be a positive number' });
    }

    const connection = await pool.getConnection();
    const balance = parseFloat(initial_balance) || 0;

    const [result] = await connection.query(
      `INSERT INTO Account (user_id, account_type, balance, status)
       VALUES (?, ?, ?, 'Active')`,
      [userId, account_type, balance]
    );

    const accountId = result.insertId;

    // Fetch the newly created account
    const [newAccount] = await connection.query(
      `SELECT account_id, user_id, account_type, balance, status, created_at, updated_at
       FROM Account
       WHERE account_id = ?`,
      [accountId]
    );

    connection.release();

    res.status(201).json({
      message: 'Account created successfully',
      account: newAccount[0],
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account', details: error.message });
  }
};

/**
 * Get a specific account by ID
 * GET /api/accounts/:account_id
 */
const getAccountById = async (req, res) => {
  try {
    const { account_id } = req.params;
    const userId = req.user.user_id;

    const connection = await pool.getConnection();
    const [accounts] = await connection.query(
      `SELECT account_id, user_id, account_type, balance, status, created_at, updated_at
       FROM Account
       WHERE account_id = ? AND user_id = ?`,
      [account_id, userId]
    );

    connection.release();

    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Account not found or access denied' });
    }

    res.json(accounts[0]);
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to fetch account', details: error.message });
  }
};

/**
 * Get account balance
 * GET /api/accounts/:account_id/balance
 */
const getAccountBalance = async (req, res) => {
  try {
    const { account_id } = req.params;
    const userId = req.user.user_id;

    const connection = await pool.getConnection();
    const [accounts] = await connection.query(
      `SELECT account_id, balance, status
       FROM Account
       WHERE account_id = ? AND user_id = ?`,
      [account_id, userId]
    );

    connection.release();

    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accounts[0];
    res.json({
      account_id: account.account_id,
      balance: parseFloat(account.balance),
      status: account.status,
      currency: 'USD',
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to fetch balance', details: error.message });
  }
};

/**
 * Update account status (Admin or user's own account)
 * PATCH /api/accounts/:account_id/status
 * Body: { status: 'Active' | 'Inactive' | 'Frozen' }
 */
const updateAccountStatus = async (req, res) => {
  try {
    const { account_id } = req.params;
    const { status } = req.body;
    const userId = req.user.user_id;

    // Validation
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['Active', 'Inactive', 'Frozen'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const connection = await pool.getConnection();

    // Verify account ownership
    const [accounts] = await connection.query(
      `SELECT user_id FROM Account WHERE account_id = ?`,
      [account_id]
    );

    if (accounts.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Account not found' });
    }

    if (accounts[0].user_id !== userId && req.user.role_id !== 2) {
      connection.release();
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update status
    const [result] = await connection.query(
      `UPDATE Account
       SET status = ?
       WHERE account_id = ?`,
      [status, account_id]
    );

    connection.release();

    res.json({
      message: 'Account status updated successfully',
      account_id,
      new_status: status,
    });
  } catch (error) {
    console.error('Update account status error:', error);
    res.status(500).json({ error: 'Failed to update account status', details: error.message });
  }
};

module.exports = {
  getAllAccounts,
  createAccount,
  getAccountById,
  getAccountBalance,
  updateAccountStatus,
};
