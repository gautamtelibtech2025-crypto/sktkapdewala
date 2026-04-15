const pool = require('../config/db');
const path = require('path');

// GET /products
const getProducts = async (req, res, next) => {
  try {
    const {
      store,
      category,
      search,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      order = 'DESC'
    } = req.query;

    let query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        COALESCE(
          json_agg(
            json_build_object(
              'store_id', s.id,
              'store_name', s.name,
              'store_slug', s.slug,
              'stock', inv.stock
            )
          ) FILTER (WHERE inv.id IS NOT NULL),
          '[]'
        ) as inventory
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory inv ON p.id = inv.product_id
      LEFT JOIN stores s ON inv.store_id = s.id
      WHERE p.is_active = true
    `;

    const params = [];
    let paramIdx = 1;

    if (store) {
      query += ` AND s.slug = $${paramIdx++}`;
      params.push(store);
    }

    if (category) {
      query += ` AND c.slug = $${paramIdx++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND (p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (minPrice) {
      query += ` AND COALESCE(p.sale_price, p.base_price) >= $${paramIdx++}`;
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      query += ` AND COALESCE(p.sale_price, p.base_price) <= $${paramIdx++}`;
      params.push(parseFloat(maxPrice));
    }

    query += ` GROUP BY p.id, c.name, c.slug`;

    const allowedSorts = ['created_at', 'base_price', 'name'];
    const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY p.${safeSort} ${safeOrder}`;

    // Count query
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT p.id) FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN inventory inv ON p.id = inv.product_id
       LEFT JOIN stores s ON inv.store_id = s.id
       WHERE p.is_active = true
       ${store ? `AND s.slug = '${store}'` : ''}
       ${category ? `AND c.slug = '${category}'` : ''}
       ${search ? `AND (p.name ILIKE '%${search}%')` : ''}
      `
    );

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        products: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /products/:id
const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        COALESCE(
          json_agg(
            json_build_object(
              'store_id', s.id,
              'store_name', s.name,
              'store_slug', s.slug,
              'stock', inv.stock,
              'city', s.city
            )
          ) FILTER (WHERE inv.id IS NOT NULL),
          '[]'
        ) as inventory
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory inv ON p.id = inv.product_id
      LEFT JOIN stores s ON inv.store_id = s.id
      WHERE p.id = $1 AND p.is_active = true
      GROUP BY p.id, c.name, c.slug
    `, [id]);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: { product: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// POST /products (admin)
const createProduct = async (req, res, next) => {
  try {
    const {
      name, description, category_id, base_price, sale_price,
      tags, sizes, colors, brand, sku, inventory: inventoryData
    } = req.body;

    if (!name || !base_price) {
      return res.status(400).json({ success: false, message: 'Name and price required' });
    }

    // Handle uploaded files
    const images = [];
    const videoUrl = null;

    if (req.files) {
      if (req.files.images) {
        req.files.images.forEach(f => {
          images.push(`/uploads/images/${f.filename}`);
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO products (name, description, category_id, base_price, sale_price, images, video_url, tags, sizes, colors, brand, sku)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        name, description || null, category_id || null,
        parseFloat(base_price), sale_price ? parseFloat(sale_price) : null,
        images, videoUrl,
        tags ? JSON.parse(tags) : [],
        sizes ? JSON.parse(sizes) : [],
        colors ? JSON.parse(colors) : [],
        brand || null, sku || null
      ]);

      const product = result.rows[0];

      // Set inventory if provided
      if (inventoryData) {
        const inv = typeof inventoryData === 'string' ? JSON.parse(inventoryData) : inventoryData;
        for (const item of inv) {
          await client.query(`
            INSERT INTO inventory (product_id, store_id, stock)
            VALUES ($1, $2, $3)
            ON CONFLICT (product_id, store_id) DO UPDATE SET stock = $3
          `, [product.id, item.store_id, item.stock || 0]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ success: true, message: 'Product created', data: { product } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// PUT /products/:id (admin)
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = ['name', 'description', 'category_id', 'base_price', 'sale_price', 'tags', 'sizes', 'colors', 'brand', 'is_active'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(updates[key]);
      }
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: { product: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// DELETE /products/:id (admin)
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE products SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

// GET /categories
const getCategories = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json({ success: true, data: { categories: result.rows } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getCategories };
