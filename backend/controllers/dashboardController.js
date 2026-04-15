const pool = require('../db/connection');

/**
 * Get cash flow summary for a specific month
 * GET /api/dashboard/cashflow?month=MM&year=YYYY
 */
const getCashFlowSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = req.user.user_id;

    // Validation
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }

    const connection = await pool.getConnection();

    // Call stored procedure
    const [summary] = await connection.query(
      `CALL GetCashFlowSummary(?, ?, ?)`,
      [userId, parseInt(month), parseInt(year)]
    );

    connection.release();

    if (summary[0] && summary[0].length > 0) {
      res.json(summary[0][0]);
    } else {
      res.json({
        month: parseInt(month),
        year: parseInt(year),
        total_inflow: 0,
        total_outflow: 0,
        net_cash_flow: 0,
        total_transactions: 0,
      });
    }
  } catch (error) {
    console.error('Get cashflow error:', error);
    res.status(500).json({ error: 'Failed to fetch cashflow summary', details: error.message });
  }
};

/**
 * Get balance trend for last 6 months
 * GET /api/dashboard/balance-trend
 */
const getBalanceTrend = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const months = parseInt(req.query.months) || 6;

    const connection = await pool.getConnection();

    // Get all accounts for user
    const [accounts] = await connection.query(
      `SELECT account_id FROM Account WHERE user_id = ?`,
      [userId]
    );

    if (accounts.length === 0) {
      connection.release();
      return res.json({
        trend: [],
        message: 'No accounts found',
      });
    }

    const accountIds = accounts.map(a => a.account_id);

    // Query last 6 months of transactions
    const query = `
      SELECT
        YEAR(created_at) as year,
        MONTH(created_at) as month,
        DATE_FORMAT(created_at, '%Y-%m') as month_year,
        SUM(CASE WHEN to_account_id IN (${accountIds.join(',')}) THEN amount ELSE 0 END) -
        SUM(CASE WHEN from_account_id IN (${accountIds.join(',')}) THEN amount ELSE 0 END) as monthly_net
      FROM Transaction
      WHERE (from_account_id IN (${accountIds.join(',')}) OR to_account_id IN (${accountIds.join(',')}))
        AND status = 'Completed'
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)
      GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY year ASC, month ASC
    `;

    const [trend] = await connection.query(query);

    // Calculate running balance
    const [currentBalance] = await connection.query(
      `SELECT SUM(balance) as total FROM Account WHERE user_id = ?`,
      [userId]
    );

    // Generate empty array for all requested months
    const allMonths = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const my = `${y}-${m.toString().padStart(2, '0')}`;
      allMonths.push({ year: y, month: m, month_year: my, monthly_net: 0 });
    }

    // Merge actual transactions into the empty array
    trend.forEach(t => {
      const match = allMonths.find(m => m.month_year === t.month_year);
      if (match) {
        match.monthly_net = parseFloat(t.monthly_net || 0);
      }
    });

    let currentTotal = parseFloat(currentBalance[0]?.total || 0);
    let totalNet = allMonths.reduce((sum, t) => sum + t.monthly_net, 0);
    let runningBalance = currentTotal - totalNet;

    const balanceTrend = allMonths.map(t => {
      runningBalance = runningBalance + t.monthly_net;
      return {
        month: t.month,
        year: t.year,
        month_year: t.month_year,
        balance: Math.round(runningBalance * 100) / 100,
        monthly_net: t.monthly_net,
      };
    });

    connection.release();

    res.json({
      trend: balanceTrend,
      current_total_balance: parseFloat(currentBalance[0]?.total || 0),
    });
  } catch (error) {
    console.error('Get balance trend error:', error);
    res.status(500).json({ error: 'Failed to fetch balance trend', details: error.message });
  }
};

/**
 * Get dashboard summary (all key metrics)
 * GET /api/dashboard/summary
 */
const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;

    const connection = await pool.getConnection();

    // Get total balance
    const [totalBalance] = await connection.query(
      `SELECT SUM(balance) as total FROM Account WHERE user_id = ? AND status = 'Active'`,
      [userId]
    );

    // Get account count
    const [accountCount] = await connection.query(
      `SELECT COUNT(*) as count FROM Account WHERE user_id = ?`,
      [userId]
    );

    // Get transaction count (this month)
    const [txnCount] = await connection.query(
      `SELECT COUNT(*) as count FROM Transaction t
       INNER JOIN Account a ON (t.from_account_id = a.account_id OR t.to_account_id = a.account_id)
       WHERE a.user_id = ? AND t.status = 'Completed'
         AND MONTH(t.created_at) = ? AND YEAR(t.created_at) = ?`,
      [userId, parseInt(month), parseInt(year)]
    );

    // Get cash flow
    const [cashflow] = await connection.query(
      `CALL GetCashFlowSummary(?, ?, ?)`,
      [userId, parseInt(month), parseInt(year)]
    );

    connection.release();

    res.json({
      summary: {
        total_balance: parseFloat(totalBalance[0]?.total || 0),
        account_count: accountCount[0].count,
        transaction_count_month: txnCount[0].count,
        month: parseInt(month),
        year: parseInt(year),
      },
      cashflow: (cashflow[0] && cashflow[0][0]) ? cashflow[0][0] : {
        total_inflow: 0,
        total_outflow: 0,
        net_cash_flow: 0,
        total_transactions: 0,
      },
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary', details: error.message });
  }
};

module.exports = {
  getCashFlowSummary,
  getBalanceTrend,
  getDashboardSummary,
};
