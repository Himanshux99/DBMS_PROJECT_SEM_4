const express = require('express');
const {
  getAllAccounts,
  createAccount,
  getAccountById,
  getAccountBalance,
  updateAccountStatus,
  getDestinationAccounts,
} = require('../controllers/accountsController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/accounts
 * Get all accounts for the logged-in user
 */
router.get('/', getAllAccounts);

/**
 * POST /api/accounts
 * Create a new account
 */
router.post('/', createAccount);

/**
 * GET /api/accounts/destinations
 * Get all destination accounts for transfers
 */
router.get('/destinations', getDestinationAccounts);

/**
 * GET /api/accounts/:account_id
 * Get specific account details
 */
router.get('/:account_id', getAccountById);

/**
 * GET /api/accounts/:account_id/balance
 * Get account balance
 */
router.get('/:account_id/balance', getAccountBalance);

/**
 * PATCH /api/accounts/:account_id/status
 * Update account status
 */
router.patch('/:account_id/status', updateAccountStatus);

module.exports = router;
