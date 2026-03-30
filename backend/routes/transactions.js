const express = require('express');
const {
  transferFunds,
  depositFunds,
  withdrawFunds,
  getTransactionHistory,
  getAllTransactions,
} = require('../controllers/transactionsController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/transactions/transfer
 * Transfer funds between accounts (ACID compliant)
 */
router.post('/transfer', transferFunds);

/**
 * POST /api/transactions/deposit
 * Deposit funds into an account
 */
router.post('/deposit', depositFunds);

/**
 * POST /api/transactions/withdraw
 * Withdraw funds from an account
 */
router.post('/withdraw', withdrawFunds);

/**
 * GET /api/transactions/:account_id
 * Get transaction history for a specific account
 */
router.get('/:account_id', getTransactionHistory);

/**
 * GET /api/transactions/all
 * Get all transactions (Admin only) - must be before :account_id route
 */
router.get('/admin/all', requireAdmin, getAllTransactions);

module.exports = router;
