const jwt = require('jsonwebtoken');

/**
 * Verify JWT token from Authorization header
 * Attaches decoded token to req.user
 */
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

/**
 * Check if user has Admin role (requires verifyToken to be called first)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user has Admin role (role_id = 2, or can be checked against role_name)
  if (req.user.role_id !== 2 && req.user.role_name !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
};
