const express = require('express');
const {
  getCashFlowSummary,
  getBalanceTrend,
  getDashboardSummary,
} = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/dashboard/summary
 * Get complete dashboard summary with all key metrics
 */
router.get('/summary', getDashboardSummary);

/**
 * GET /api/dashboard/cashflow?month=MM&year=YYYY
 * Get cashflow summary for a specific month (inflow, outflow, net)
 */
router.get('/cashflow', getCashFlowSummary);

/**
 * GET /api/dashboard/balance-trend
 * Get balance trend for last 6 months
 */
router.get('/balance-trend', getBalanceTrend);

module.exports = router;
