require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const setupDatabase = require('./config/dbSetup');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3001', '*'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const start = async () => {
  try {
    await setupDatabase();
    app.listen(PORT, () => {
      console.log(`\n🚀 Sktkapdewala server running at http://localhost:${PORT}`);
      console.log(`📦 API: http://localhost:${PORT}/api`);
      console.log(`🔑 Admin: admin@sktkapdewala.com / Admin@123\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    console.log('\n⚠️  If database connection fails, check your .env file.');
    console.log('   Copy .env.example to .env and update credentials.\n');
    // Start without DB for demo
    app.listen(PORT, () => {
      console.log(`🚀 Server running (no DB) at http://localhost:${PORT}`);
    });
  }
};

start();
