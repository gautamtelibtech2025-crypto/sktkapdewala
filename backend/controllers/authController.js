const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email or phone required' });
    }

    if (email && !password) {
      return res.status(400).json({ success: false, message: 'Password required for email registration' });
    }

    // Check existing user
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email || null, phone || null]
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_verified)
       VALUES ($1, $2, $3, $4, 'customer', $5)
       RETURNING id, name, email, phone, role`,
      [name || 'Customer', email || null, phone || null, passwordHash, !phone]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      data: { user, token }
    });
  } catch (err) {
    next(err);
  }
};

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    const { password_hash, ...userSafe } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: userSafe, token }
    });
  } catch (err) {
    next(err);
  }
};

// POST /auth/otp/send
const sendOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP
    await pool.query(
      `INSERT INTO otps (phone, otp, expires_at) VALUES ($1, $2, $3)`,
      [phone, otp, expiresAt]
    );

    // In production: send via Twilio/MSG91
    console.log(`📱 OTP for ${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { otp }) // Only in dev
    });
  } catch (err) {
    next(err);
  }
};

// POST /auth/otp/verify
const verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp, name } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    }

    const result = await pool.query(
      `SELECT * FROM otps 
       WHERE phone = $1 AND otp = $2 AND is_used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, otp]
    );

    if (!result.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [result.rows[0].id]);

    // Find or create user
    let userResult = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let user;

    if (!userResult.rows.length) {
      const inserted = await pool.query(
        `INSERT INTO users (name, phone, is_verified, role)
         VALUES ($1, $2, true, 'customer') RETURNING *`,
        [name || 'Customer', phone]
      );
      user = inserted.rows[0];
    } else {
      await pool.query('UPDATE users SET is_verified = true WHERE phone = $1', [phone]);
      user = userResult.rows[0];
    }

    const token = generateToken(user.id);
    const { password_hash, ...userSafe } = user;

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: { user: userSafe, token }
    });
  } catch (err) {
    next(err);
  }
};

// GET /auth/me
const getMe = async (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json({ success: true, data: { user: req.user } });
};

module.exports = { register, login, sendOTP, verifyOTP, getMe };
