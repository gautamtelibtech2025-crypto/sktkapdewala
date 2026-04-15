const pool = require('../config/db');

// GET /inventory
const getInventory = async (req, res, next) => {
  try {
    const { store, product } = req.query;

    let query = `
      SELECT 
        inv.*,
        p.name as product_name,
        p.base_price,
        p.sale_price,
        p.images,
        s.name as store_name,
        s.slug as store_slug
      FROM inventory inv
      JOIN products p ON inv.product_id = p.id
      JOIN stores s ON inv.store_id = s.id
      WHERE p.is_active = true
    `;
    const params = [];
    let idx = 1;

    if (store) {
      query += ` AND s.slug = $${idx++}`;
      params.push(store);
    }
    if (product) {
      query += ` AND inv.product_id = $${idx++}`;
      params.push(product);
    }

    query += ' ORDER BY p.name';
    const result = await pool.query(query, params);
    res.json({ success: true, data: { inventory: result.rows } });
  } catch (err) {
    next(err);
  }
};

// POST /inventory (admin)
const setInventory = async (req, res, next) => {
  try {
    const { product_id, store_id, stock } = req.body;

    if (!product_id || !store_id || stock === undefined) {
      return res.status(400).json({ success: false, message: 'product_id, store_id, stock required' });
    }

    const result = await pool.query(`
      INSERT INTO inventory (product_id, store_id, stock)
      VALUES ($1, $2, $3)
      ON CONFLICT (product_id, store_id) DO UPDATE SET stock = $3, updated_at = NOW()
      RETURNING *
    `, [product_id, store_id, parseInt(stock)]);

    res.json({ success: true, data: { inventory: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// GET /stores
const getStores = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM stores WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: { stores: result.rows } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getInventory, setInventory, getStores };
