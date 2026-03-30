const pool = require('../db/connection');

/**
 * Get all audit logs (Admin only)
 * GET /api/audit/logs?user_id=&action=&date_from=&date_to=&page=1&limit=50
 */
const getAuditLogs = async (req, res) => {
  try {
    const { user_id, action, date_from, date_to, page = 1, limit = 50 } = req.query;

    const connection = await pool.getConnection();

    // Build query
    let query = `
      SELECT al.log_id, al.user_id, u.email, u.name, al.action, al.description, al.affected_table, al.affected_id, al.timestamp
      FROM Audit_Log al
      LEFT JOIN User u ON al.user_id = u.user_id
      WHERE 1=1
    `;

    const params = [];

    if (user_id) {
      query += ` AND al.user_id = ?`;
      params.push(user_id);
    }

    if (action) {
      query += ` AND al.action LIKE ?`;
      params.push(`%${action}%`);
    }

    if (date_from) {
      query += ` AND al.timestamp >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND al.timestamp <= ?`;
      params.push(date_to);
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total FROM Audit_Log al
      ${user_id || action || date_from || date_to ? 'WHERE 1=1' : ''}
      ${user_id ? ` AND al.user_id = ?` : ''}
      ${action ? ` AND al.action LIKE ?` : ''}
      ${date_from ? ` AND al.timestamp >= ?` : ''}
      ${date_to ? ` AND al.timestamp <= ?` : ''}
    `;

    const [countResult] = await connection.query(countQuery, params);
    const total = countResult[0].total;

    // Add pagination and ordering
    query += ` ORDER BY al.timestamp DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const [logs] = await connection.query(query, params);

    connection.release();

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs', details: error.message });
  }
};

/**
 * Get audit logs for a specific user
 * GET /api/audit/user/:user_id?page=1&limit=50
 */
const getUserAuditLogs = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const requestingUser = req.user.user_id;

    // Authorization: user can only view their own logs, unless they're admin
    if (parseInt(user_id) !== requestingUser && req.user.role_id !== 2) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const connection = await pool.getConnection();

    // Count total
    const [countResult] = await connection.query(
      `SELECT COUNT(*) as total FROM Audit_Log WHERE user_id = ?`,
      [user_id]
    );
    const total = countResult[0].total;

    // Fetch with pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [logs] = await connection.query(
      `SELECT log_id, user_id, action, description, affected_table, affected_id, timestamp
       FROM Audit_Log
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [user_id, parseInt(limit), offset]
    );

    connection.release();

    res.json({
      user_id: parseInt(user_id),
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch user audit logs', details: error.message });
  }
};

/**
 * Get audit statistics
 * GET /api/audit/stats
 */
const getAuditStats = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Get actions by type
    const [actionStats] = await connection.query(`
      SELECT action, COUNT(*) as count
      FROM Audit_Log
      GROUP BY action
      ORDER BY count DESC
    `);

    // Get actions in last 24 hours
    const [lastDay] = await connection.query(`
      SELECT COUNT(*) as count
      FROM Audit_Log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);

    // Get most active users
    const [activeUsers] = await connection.query(`
      SELECT u.user_id, u.name, u.email, COUNT(al.log_id) as action_count
      FROM Audit_Log al
      INNER JOIN User u ON al.user_id = u.user_id
      GROUP BY u.user_id
      ORDER BY action_count DESC
      LIMIT 10
    `);

    connection.release();

    res.json({
      actions_by_type: actionStats,
      last_24_hours: lastDay[0].count,
      most_active_users: activeUsers,
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics', details: error.message });
  }
};

module.exports = {
  getAuditLogs,
  getUserAuditLogs,
  getAuditStats,
};
