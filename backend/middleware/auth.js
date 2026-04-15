const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    const result = await pool.query('SELECT id, name, email, phone, role FROM users WHERE id = $1', [decoded.userId]);
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const result = await pool.query('SELECT id, name, email, phone, role FROM users WHERE id = $1', [decoded.userId]);
      if (result.rows.length) req.user = result.rows[0];
    }
  } catch {}
  next();
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

module.exports = { authMiddleware, optionalAuth, adminOnly };
