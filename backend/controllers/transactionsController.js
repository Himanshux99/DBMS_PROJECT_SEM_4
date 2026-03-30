const pool = require('../db/connection');

/**
 * Transfer funds between two accounts (ACID compliant)
 * POST /api/transactions/transfer
 * Body: { from_account_id, to_account_id, amount }
 */
const transferFunds = async (req, res) => {
  try {
    const { from_account_id, to_account_id, amount } = req.body;
    const userId = req.user.user_id;

    // Validation
    if (!from_account_id || !to_account_id || !amount) {
      return res.status(400).json({ error: 'from_account_id, to_account_id, and amount are required' });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'Cannot transfer to the same account' });
    }

    const connection = await pool.getConnection();

    // Verify both accounts exist and belong to user (or user is admin)
    const [fromAccounts] = await connection.query(
      `SELECT account_id, user_id, balance, status FROM Account WHERE account_id = ?`,
      [from_account_id]
    );

    const [toAccounts] = await connection.query(
      `SELECT account_id, user_id, balance, status FROM Account WHERE account_id = ?`,
      [to_account_id]
    );

    if (fromAccounts.length === 0 || toAccounts.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'One or both accounts not found' });
    }

    // Authorization check
    if (fromAccounts[0].user_id !== userId && req.user.role_id !== 2) {
      connection.release();
      return res.status(403).json({ error: 'Access denied to source account' });
    }

    // Call stored procedure with error handling
    try {
      const [result] = await connection.query(
        `CALL TransferFunds(?, ?, ?, ?, @status)`,
        [from_account_id, to_account_id, amount, userId]
      );

      const [statusResult] = await connection.query('SELECT @status AS status');
      const procedureStatus = statusResult[0].status;

      if (procedureStatus === 1) {
        connection.release();
        return res.status(400).json({ error: 'Transfer failed - check account balance and status' });
      }

      // Fetch the transaction that was just created
      const [transactions] = await connection.query(
        `SELECT transaction_id, from_account_id, to_account_id, amount, transaction_type, status, created_at
         FROM Transaction
         ORDER BY transaction_id DESC
         LIMIT 1`
      );

      connection.release();

      res.json({
        message: 'Transfer successful',
        transaction: transactions[0],
      });
    } catch (spError) {
      connection.release();
      console.error('Stored procedure error:', spError.message);
      return res.status(400).json({ error: spError.message || 'Transfer failed' });
    }
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Transfer failed', details: error.message });
  }
};

/**
 * Deposit funds into an account
 * POST /api/transactions/deposit
 * Body: { to_account_id, amount }
 */
const depositFunds = async (req, res) => {
  try {
    const { to_account_id, amount } = req.body;
    const userId = req.user.user_id;

    // Validation
    if (!to_account_id || !amount) {
      return res.status(400).json({ error: 'to_account_id and amount are required' });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const connection = await pool.getConnection();

    // Verify account exists
    const [accounts] = await connection.query(
      `SELECT account_id, user_id, status FROM Account WHERE account_id = ?`,
      [to_account_id]
    );

    if (accounts.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Account not found' });
    }

    // Authorization check
    if (accounts[0].user_id !== userId && req.user.role_id !== 2) {
      connection.release();
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      const [result] = await connection.query(
        `CALL DepositFunds(?, ?, ?, @status)`,
        [to_account_id, amount, userId]
      );

      const [statusResult] = await connection.query('SELECT @status AS status');
      const procedureStatus = statusResult[0].status;

      if (procedureStatus === 1) {
        connection.release();
        return res.status(400).json({ error: 'Deposit failed - check account status' });
      }

      // Fetch the transaction that was just created
      const [transactions] = await connection.query(
        `SELECT transaction_id, to_account_id, amount, transaction_type, status, created_at
         FROM Transaction
         ORDER BY transaction_id DESC
         LIMIT 1`
      );

      connection.release();

      res.json({
        message: 'Deposit successful',
        transaction: transactions[0],
      });
    } catch (spError) {
      connection.release();
      return res.status(400).json({ error: spError.message || 'Deposit failed' });
    }
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Deposit failed', details: error.message });
  }
};

/**
 * Withdraw funds from an account
 * POST /api/transactions/withdraw
 * Body: { from_account_id, amount }
 */
const withdrawFunds = async (req, res) => {
  try {
    const { from_account_id, amount } = req.body;
    const userId = req.user.user_id;

    // Validation
    if (!from_account_id || !amount) {
      return res.status(400).json({ error: 'from_account_id and amount are required' });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const connection = await pool.getConnection();

    // Verify account exists
    const [accounts] = await connection.query(
      `SELECT account_id, user_id, status FROM Account WHERE account_id = ?`,
      [from_account_id]
    );

    if (accounts.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Account not found' });
    }

    // Authorization check
    if (accounts[0].user_id !== userId && req.user.role_id !== 2) {
      connection.release();
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      const [result] = await connection.query(
        `CALL WithdrawFunds(?, ?, ?, @status)`,
        [from_account_id, amount, userId]
      );

      const [statusResult] = await connection.query('SELECT @status AS status');
      const procedureStatus = statusResult[0].status;

      if (procedureStatus === 1) {
        connection.release();
        return res.status(400).json({ error: 'Withdrawal failed - check account balance and status' });
      }

      // Fetch the transaction that was just created
      const [transactions] = await connection.query(
        `SELECT transaction_id, from_account_id, amount, transaction_type, status, created_at
         FROM Transaction
         ORDER BY transaction_id DESC
         LIMIT 1`
      );

      connection.release();

      res.json({
        message: 'Withdrawal successful',
        transaction: transactions[0],
      });
    } catch (spError) {
      connection.release();
      return res.status(400).json({ error: spError.message || 'Withdrawal failed' });
    }
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Withdrawal failed', details: error.message });
  }
};

/**
 * Get transaction history for an account
 * GET /api/transactions/:account_id?type=&status=&date_from=&date_to=&page=1&limit=10
 */
const getTransactionHistory = async (req, res) => {
  try {
    const { account_id } = req.params;
    const { type, status, date_from, date_to, page = 1, limit = 10 } = req.query;
    const userId = req.user.user_id;

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

    // Build query
    let query = `
      SELECT transaction_id, from_account_id, to_account_id, amount, transaction_type, status, description, created_at
      FROM Transaction
      WHERE (from_account_id = ? OR to_account_id = ?)
    `;

    const params = [account_id, account_id];

    // Add filters
    if (type) {
      query += ` AND transaction_type = ?`;
      params.push(type);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (date_from) {
      query += ` AND created_at >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND created_at <= ?`;
      params.push(date_to);
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) count_table`;
    const [countResult] = await connection.query(countQuery, params);
    const total = countResult[0].total;

    // Add pagination and ordering
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const [transactions] = await connection.query(query, params);

    connection.release();

    res.json({
      account_id,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
};

/**
 * Get all transactions (Admin only)
 * GET /api/transactions/all
 */
const getAllTransactions = async (req, res) => {
  try {
    const { type, status, date_from, date_to, page = 1, limit = 20 } = req.query;

    const connection = await pool.getConnection();

    // Build query
    let query = `SELECT transaction_id, from_account_id, to_account_id, amount, transaction_type, status, created_at FROM Transaction WHERE 1=1`;
    const params = [];

    if (type) {
      query += ` AND transaction_type = ?`;
      params.push(type);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (date_from) {
      query += ` AND created_at >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND created_at <= ?`;
      params.push(date_to);
    }

    // Count total
    const [countResult] = await connection.query(`SELECT COUNT(*) as total FROM Transaction WHERE 1=1${params.length ? ' AND ' + params.map(() => '?').join(' AND ') : ''}`, params);
    const total = countResult[0].total;

    // Add pagination
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const [transactions] = await connection.query(query, params);

    connection.release();

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
};

module.exports = {
  transferFunds,
  depositFunds,
  withdrawFunds,
  getTransactionHistory,
  getAllTransactions,
};
