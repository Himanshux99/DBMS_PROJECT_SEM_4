const express = require('express');
const { getAuditLogs, getUserAuditLogs, getAuditStats } = require('../controllers/auditController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/audit/logs
 * Get all audit logs (Admin only)
 */
router.get('/logs', requireAdmin, getAuditLogs);

/**
 * GET /api/audit/stats
 * Get audit statistics (Admin only)
 */
router.get('/stats', requireAdmin, getAuditStats);

/**
 * GET /api/audit/user/:user_id
 * Get audit logs for a specific user (user can view own, admin can view any)
 */
router.get('/user/:user_id', getUserAuditLogs);

module.exports = router;
