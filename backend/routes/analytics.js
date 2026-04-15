const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  getActiveAccounts,
  getAboveAverageAccounts,
  getUnifiedFeed,
  getAccountSummaryView,
} = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(verifyToken);

// HAVING CLAUSE — accounts with >= N transactions
// GET /api/analytics/active-accounts?min_transactions=2
router.get('/active-accounts', getActiveAccounts);

// SUBQUERY — accounts with above-average balance
// GET /api/analytics/above-average-accounts
router.get('/above-average-accounts', getAboveAverageAccounts);

// SET OPERATION (UNION) — merged credit + debit feed
// GET /api/analytics/unified-feed?limit=20
router.get('/unified-feed', getUnifiedFeed);

// DATABASE VIEW — query the vw_account_summary view
// GET /api/analytics/account-summary-view
router.get('/account-summary-view', getAccountSummaryView);

module.exports = router;
