const pool = require('../db/connection');

/**
 * HAVING CLAUSE — Accounts with significant transaction activity
 * Groups transactions by account, then filters using HAVING COUNT(*) >= threshold
 * GET /api/analytics/active-accounts
 */
const getActiveAccounts = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const minTransactions = parseInt(req.query.min_transactions) || 1;

    const connection = await pool.getConnection();

    // HAVING filters groups where transaction count meets the threshold
    const [rows] = await connection.query(
      `SELECT
         a.account_id,
         a.account_type,
         a.balance,
         a.status,
         COUNT(t.transaction_id) AS transaction_count,
         SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
         MAX(t.created_at) AS last_transaction_date
       FROM Account a
       LEFT JOIN Transaction t
         ON (t.from_account_id = a.account_id OR t.to_account_id = a.account_id)
       WHERE a.user_id = ?
       GROUP BY a.account_id, a.account_type, a.balance, a.status
       HAVING COUNT(t.transaction_id) >= ?
       ORDER BY transaction_count DESC`,
      [userId, minTransactions]
    );

    connection.release();

    res.json({
      accounts: rows,
      query_info: {
        type: 'HAVING Clause',
        description: `Accounts with at least ${minTransactions} transaction(s), filtered using HAVING COUNT(*)`,
        min_transactions: minTransactions,
      },
    });
  } catch (error) {
    console.error('Get active accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch active accounts', details: error.message });
  }
};

/**
 * SUBQUERY — Accounts with above-average balance
 * Uses a correlated subquery to compare each account balance against the average
 * GET /api/analytics/above-average-accounts
 */
const getAboveAverageAccounts = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const connection = await pool.getConnection();

    // Subquery: (SELECT AVG(balance) FROM Account WHERE status = 'Active')
    const [rows] = await connection.query(
      `SELECT
         a.account_id,
         a.account_type,
         a.balance,
         a.status,
         (SELECT AVG(balance) FROM Account WHERE user_id = ? AND status = 'Active') AS avg_balance,
         ROUND(a.balance - (SELECT AVG(balance) FROM Account WHERE user_id = ? AND status = 'Active'), 2) AS above_avg_by
       FROM Account a
       WHERE a.user_id = ?
         AND a.status = 'Active'
         AND a.balance > (SELECT AVG(balance) FROM Account WHERE user_id = ? AND status = 'Active')
       ORDER BY a.balance DESC`,
      [userId, userId, userId, userId]
    );

    // Also get the average for context
    const [avgResult] = await connection.query(
      `SELECT ROUND(AVG(balance), 2) AS average_balance FROM Account WHERE user_id = ? AND status = 'Active'`,
      [userId]
    );

    connection.release();

    res.json({
      accounts: rows,
      average_balance: parseFloat(avgResult[0]?.average_balance || 0),
      query_info: {
        type: 'Subquery (Scalar Subquery in WHERE)',
        description: 'Accounts whose balance > (SELECT AVG(balance) FROM Account WHERE user_id = ? AND status = "Active")',
      },
    });
  } catch (error) {
    console.error('Get above-average accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch above-average accounts', details: error.message });
  }
};

/**
 * SET OPERATION (UNION) — Unified transaction feed (credits + debits combined)
 * Merges two separate SELECT queries using UNION to get a single ordered list
 * GET /api/analytics/unified-feed
 */
const getUnifiedFeed = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const limit = parseInt(req.query.limit) || 20;
    const connection = await pool.getConnection();

    // Get user's accounts first
    const [accounts] = await connection.query(
      `SELECT account_id FROM Account WHERE user_id = ?`,
      [userId]
    );

    if (accounts.length === 0) {
      connection.release();
      return res.json({ feed: [], query_info: { type: 'SET OPERATION (UNION)' } });
    }

    const accountIds = accounts.map(a => a.account_id);
    const placeholders = accountIds.map(() => '?').join(',');

    // UNION: Credits (money coming IN) UNION debits (money going OUT)
    const [feed] = await connection.query(
      `-- Credits: transactions where money came INTO user's accounts
       SELECT
         t.transaction_id,
         t.amount,
         t.transaction_type,
         t.status,
         t.created_at,
         'CREDIT' AS direction,
         t.to_account_id AS user_account_id,
         COALESCE(fa.account_type, 'External') AS counterpart_account_type,
         COALESCE(fu.name, 'External') AS counterpart_name
       FROM Transaction t
       LEFT JOIN Account fa ON t.from_account_id = fa.account_id
       LEFT JOIN User fu ON fa.user_id = fu.user_id
       WHERE t.to_account_id IN (${placeholders})
         AND t.status = 'Completed'

       UNION

       -- Debits: transactions where money went OUT of user's accounts
       SELECT
         t.transaction_id,
         t.amount,
         t.transaction_type,
         t.status,
         t.created_at,
         'DEBIT' AS direction,
         t.from_account_id AS user_account_id,
         COALESCE(ta.account_type, 'External') AS counterpart_account_type,
         COALESCE(tu.name, 'External') AS counterpart_name
       FROM Transaction t
       LEFT JOIN Account ta ON t.to_account_id = ta.account_id
       LEFT JOIN User tu ON ta.user_id = tu.user_id
       WHERE t.from_account_id IN (${placeholders})
         AND t.status = 'Completed'

       ORDER BY created_at DESC
       LIMIT ?`,
      [...accountIds, ...accountIds, limit]
    );

    connection.release();

    res.json({
      feed,
      query_info: {
        type: 'SET OPERATION (UNION)',
        description: 'Credits (IN) UNION Debits (OUT) — merged into a single chronological feed',
        total_entries: feed.length,
      },
    });
  } catch (error) {
    console.error('Get unified feed error:', error);
    res.status(500).json({ error: 'Failed to fetch unified feed', details: error.message });
  }
};

/**
 * VIEW — Query the vw_account_summary database view
 * Reads from a pre-built VIEW that joins User + Account tables
 * GET /api/analytics/account-summary-view
 */
const getAccountSummaryView = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const connection = await pool.getConnection();

    // Query the database VIEW directly
    const [rows] = await connection.query(
      `SELECT * FROM vw_account_summary WHERE user_id = ? ORDER BY balance DESC`,
      [userId]
    );

    // Also get user financial overview from the second view
    const [overview] = await connection.query(
      `SELECT * FROM vw_user_financial_overview WHERE user_id = ?`,
      [userId]
    );

    connection.release();

    res.json({
      accounts: rows,
      overview: overview[0] || null,
      query_info: {
        type: 'Database View',
        description: 'Querying vw_account_summary and vw_user_financial_overview — pre-built JOIN views',
        views_used: ['vw_account_summary', 'vw_user_financial_overview'],
      },
    });
  } catch (error) {
    console.error('Get account summary view error:', error);
    res.status(500).json({
      error: 'Failed to fetch account summary from view. Make sure you have run views.sql in your database.',
      details: error.message,
    });
  }
};

module.exports = {
  getActiveAccounts,
  getAboveAverageAccounts,
  getUnifiedFeed,
  getAccountSummaryView,
};
