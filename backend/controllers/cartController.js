const pool = require('../config/db');

const getOrCreateCart = async (userId, sessionId) => {
  let result;
  if (userId) {
    result = await pool.query(
      'SELECT * FROM carts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
  } else {
    result = await pool.query(
      'SELECT * FROM carts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    );
  }

  if (result.rows.length) return result.rows[0];

  const newCart = await pool.query(
    'INSERT INTO carts (user_id, session_id) VALUES ($1, $2) RETURNING *',
    [userId || null, sessionId || null]
  );
  return newCart.rows[0];
};

// GET /cart
const getCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];

    const cart = await getOrCreateCart(userId, sessionId);

    const items = await pool.query(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.images,
        p.base_price,
        p.sale_price,
        s.name as store_name,
        s.slug as store_slug,
        inv.stock as available_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN stores s ON ci.store_id = s.id
      LEFT JOIN inventory inv ON ci.product_id = inv.product_id AND ci.store_id = inv.store_id
      WHERE ci.cart_id = $1
    `, [cart.id]);

    const subtotal = items.rows.reduce((sum, item) => sum + (item.price_at_add * item.quantity), 0);

    res.json({
      success: true,
      data: {
        cart: { ...cart, items: items.rows, subtotal: subtotal.toFixed(2) }
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST /cart/add
const addToCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    const { product_id, store_id, quantity = 1, size, color } = req.body;

    if (!product_id || !store_id) {
      return res.status(400).json({ success: false, message: 'product_id and store_id required' });
    }

    // Check stock
    const stockResult = await pool.query(
      'SELECT stock FROM inventory WHERE product_id = $1 AND store_id = $2',
      [product_id, store_id]
    );

    if (!stockResult.rows.length || stockResult.rows[0].stock < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    // Get product price
    const productResult = await pool.query(
      'SELECT base_price, sale_price FROM products WHERE id = $1 AND is_active = true',
      [product_id]
    );

    if (!productResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const product = productResult.rows[0];
    const price = product.sale_price || product.base_price;

    const cart = await getOrCreateCart(userId, sessionId);

    // Check if item already in cart
    const existing = await pool.query(
      'SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2 AND store_id = $3 AND COALESCE(size,$4) = $4',
      [cart.id, product_id, store_id, size || '']
    );

    if (existing.rows.length) {
      const newQty = existing.rows[0].quantity + parseInt(quantity);
      await pool.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2',
        [newQty, existing.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (cart_id, product_id, store_id, quantity, size, color, price_at_add) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [cart.id, product_id, store_id, parseInt(quantity), size || null, color || null, price]
      );
    }

    res.json({ success: true, message: 'Added to cart' });
  } catch (err) {
    next(err);
  }
};

// DELETE /cart/remove
const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    const { item_id } = req.body;

    const cart = await getOrCreateCart(userId, sessionId);

    await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
      [item_id, cart.id]
    );

    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    next(err);
  }
};

// PUT /cart/update
const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    const { item_id, quantity } = req.body;

    const cart = await getOrCreateCart(userId, sessionId);

    if (quantity <= 0) {
      await pool.query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [item_id, cart.id]);
    } else {
      await pool.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id = $3',
        [parseInt(quantity), item_id, cart.id]
      );
    }

    res.json({ success: true, message: 'Cart updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCart, addToCart, removeFromCart, updateCartItem };
