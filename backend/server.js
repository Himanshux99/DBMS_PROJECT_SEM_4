require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// Middleware
// =====================================================
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// Route Handlers
// =====================================================
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const dashboardRoutes = require('./routes/dashboard');
const auditRoutes = require('./routes/audit');

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);

// =====================================================
// Health Check Endpoint
// =====================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), message: 'CashFlow API is running' });
});

// =====================================================
// Error Handling Middleware
// =====================================================
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'SyntaxError' && err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// =====================================================
// 404 Handler
// =====================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// =====================================================
// Server Startup
// =====================================================
const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ CashFlow API Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ API Health: http://localhost:${PORT}/api/health`);
  console.log(`${'='.repeat(60)}\n`);
});

// =====================================================
// Graceful Shutdown
// =====================================================
process.on('SIGTERM', () => {
  console.log('\n[SIGTERM] Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n[SIGINT] Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

module.exports = app;
