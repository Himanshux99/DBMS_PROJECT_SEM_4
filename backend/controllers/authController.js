const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

/**
 * Register a new user
 * POST /api/auth/register
 * Body: { name, email, password }
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const connection = await pool.getConnection();
    const [existing] = await connection.query('SELECT user_id FROM User WHERE email = ?', [email.toLowerCase()]);

    if (existing.length > 0) {
      connection.release();
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [userResult] = await connection.query(
      'INSERT INTO User (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email.toLowerCase(), hashedPassword]
    );

    const userId = userResult.insertId;

    // Assign 'Customer' role (role_id = 1)
    await connection.query(
      'INSERT INTO User_Role (user_id, role_id) VALUES (?, ?)',
      [userId, 1]  // 1 = Customer role
    );

    connection.release();

    // Generate JWT
    const token = jwt.sign(
      { user_id: userId, email: email.toLowerCase(), role_id: 1, role_name: 'Customer' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      user_id: userId,
      email: email.toLowerCase(),
      name,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
};

/**
 * Login a user
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const connection = await pool.getConnection();

    // Find user by email
    const [users] = await connection.query(
      `SELECT u.user_id, u.name, u.email, u.password_hash, ur.role_id, r.role_name
       FROM User u
       LEFT JOIN User_Role ur ON u.user_id = ur.user_id
       LEFT JOIN Role r ON ur.role_id = r.role_id
       WHERE u.email = ?`,
      [email.toLowerCase()]
    );

    connection.release();

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role_id: user.role_id || 1,
        role_name: user.role_name || 'Customer',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({
      message: 'Login successful',
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role_id: user.role_id || 1,
      role_name: user.role_name || 'Customer',
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
};

/**
 * Get current user info (requires token)
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      `SELECT u.user_id, u.name, u.email, ur.role_id, r.role_name
       FROM User u
       LEFT JOIN User_Role ur ON u.user_id = ur.user_id
       LEFT JOIN Role r ON ur.role_id = r.role_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );

    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    res.json({
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role_id: user.role_id || 1,
      role_name: user.role_name || 'Customer',
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user', details: error.message });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
};
