const pool = require('../config/db');

// GET /admin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const [users, orders, revenue, storeRevenue, recentOrders, lowStock] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users WHERE role = $1', ['customer']),
      pool.query('SELECT COUNT(*) as total, status FROM orders GROUP BY status'),
      pool.query('SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = $1', ['paid']),
      pool.query(`
        SELECT s.name as store_name, s.slug,
          COALESCE(SUM(oi.total), 0) as revenue,
          COUNT(DISTINCT o.id) as orders
        FROM stores s
        LEFT JOIN order_items oi ON oi.store_id = s.id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'paid'
        GROUP BY s.id, s.name, s.slug
        ORDER BY revenue DESC
      `),
      pool.query(`
        SELECT o.*, u.name as user_name, u.email as user_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT p.name, s.name as store_name, inv.stock
        FROM inventory inv
        JOIN products p ON inv.product_id = p.id
        JOIN stores s ON inv.store_id = s.id
        WHERE inv.stock <= inv.reorder_level AND p.is_active = true
        ORDER BY inv.stock ASC
      `)
    ]);

    const orderStats = {};
    orders.rows.forEach(r => { orderStats[r.status] = parseInt(r.total); });

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(users.rows[0].total),
        totalRevenue: parseFloat(revenue.rows[0].total),
        orderStats,
        storeRevenue: storeRevenue.rows,
        recentOrders: recentOrders.rows,
        lowStock: lowStock.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/users
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `SELECT id, name, email, phone, role, is_verified, created_at FROM users WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const result = await pool.query(query, params);

    const total = await pool.query('SELECT COUNT(*) FROM users');
    res.json({
      success: true,
      data: {
        users: result.rows,
        total: parseInt(total.rows[0].count)
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/stores
const getStores = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM stores ORDER BY name');
    res.json({ success: true, data: { stores: result.rows } });
  } catch (err) {
    next(err);
  }
};

// POST /admin/stores
const createStore = async (req, res, next) => {
  try {
    const { name, slug, description, address, city, phone, email } = req.body;
    const result = await pool.query(
      'INSERT INTO stores (name, slug, description, address, city, phone, email) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, slug, description, address, city, phone, email]
    );
    res.status(201).json({ success: true, data: { store: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// GET /admin/settings
const getSettings = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: { settings } });
  } catch (err) {
    next(err);
  }
};

// POST /admin/settings
const updateSettings = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    await pool.query(
      'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      [key, value]
    );
    res.json({ success: true, message: 'Setting updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard, getUsers, getStores, createStore, getSettings, updateSettings };
