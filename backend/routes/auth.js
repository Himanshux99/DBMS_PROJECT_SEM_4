const express = require('express');
const { register, login, getCurrentUser } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * Login user and return JWT
 */
router.post('/login', login);

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', verifyToken, getCurrentUser);

module.exports = router;
