const pool = require('../config/db');

const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SKT-${date}-${rand}`;
};

// POST /orders
const createOrder = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    const { payment_method = 'online', shipping_address, notes } = req.body;

    // Get cart
    let cartResult;
    if (userId) {
      cartResult = await client.query('SELECT * FROM carts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    } else {
      cartResult = await client.query('SELECT * FROM carts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1', [sessionId]);
    }

    if (!cartResult.rows.length) {
      return res.status(400).json({ success: false, message: 'Cart not found' });
    }

    const cart = cartResult.rows[0];

    const itemsResult = await client.query(`
      SELECT ci.*, p.name as product_name, s.name as store_name, inv.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN stores s ON ci.store_id = s.id
      JOIN inventory inv ON ci.product_id = inv.product_id AND ci.store_id = inv.store_id
      WHERE ci.cart_id = $1
    `, [cart.id]);

    if (!itemsResult.rows.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Validate stock
    for (const item of itemsResult.rows) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product_name}`
        });
      }
    }

    await client.query('BEGIN');

    const subtotal = itemsResult.rows.reduce((sum, item) => sum + (item.price_at_add * item.quantity), 0);
    const total = subtotal; // Add shipping logic as needed

    const orderResult = await client.query(`
      INSERT INTO orders (user_id, order_number, status, payment_method, subtotal, total, shipping_address, notes)
      VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)
      RETURNING *
    `, [userId || null, generateOrderNumber(), payment_method, subtotal, total, shipping_address ? JSON.stringify(shipping_address) : null, notes || null]);

    const order = orderResult.rows[0];

    // Create order items and deduct stock
    for (const item of itemsResult.rows) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, store_id, product_name, store_name, quantity, size, color, price, total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [order.id, item.product_id, item.store_id, item.product_name, item.store_name,
          item.quantity, item.size, item.color, item.price_at_add, item.price_at_add * item.quantity]);

      // Deduct stock
      await client.query(`
        UPDATE inventory SET stock = stock - $1, updated_at = NOW()
        WHERE product_id = $2 AND store_id = $3
      `, [item.quantity, item.product_id, item.store_id]);
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order: { ...order, items: itemsResult.rows } }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// GET /orders
const getOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `
      SELECT o.*, 
        json_agg(json_build_object(
          'id', oi.id, 'product_name', oi.product_name, 'store_name', oi.store_name,
          'quantity', oi.quantity, 'price', oi.price, 'total', oi.total, 'size', oi.size
        )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `;

    if (!isAdmin) {
      query += ` WHERE o.user_id = $1`;
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await pool.query(query, isAdmin ? [] : [userId]);
    res.json({ success: true, data: { orders: result.rows } });
  } catch (err) {
    next(err);
  }
};

// PUT /orders/status (admin)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { order_id, status, payment_status } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (status) { updates.push(`status = $${idx++}`); values.push(status); }
    if (payment_status) { updates.push(`payment_status = $${idx++}`); values.push(payment_status); }
    updates.push(`updated_at = NOW()`);
    values.push(order_id);

    const result = await pool.query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ success: true, data: { order: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getOrders, updateOrderStatus };
