const pool = require('./db');

const setupDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255),
        role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'store_manager')),
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    `);

    // OTP table
    await client.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);
    `);

    // Stores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        address TEXT,
        city VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(255),
        logo_url VARCHAR(500),
        banner_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
    `);

    // Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        image_url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(500) NOT NULL,
        description TEXT,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        base_price DECIMAL(10,2) NOT NULL,
        sale_price DECIMAL(10,2),
        images TEXT[] DEFAULT '{}',
        video_url VARCHAR(500),
        tags TEXT[] DEFAULT '{}',
        sizes TEXT[] DEFAULT '{}',
        colors TEXT[] DEFAULT '{}',
        brand VARCHAR(255),
        sku VARCHAR(100) UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
    `);

    // Inventory table (store-specific stock)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
        reorder_level INTEGER DEFAULT 5,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(product_id, store_id)
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory(store_id);
    `);

    // Cart table
    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255),
        mode VARCHAR(20) DEFAULT 'combined' CHECK (mode IN ('SktUdaipur', 'SktBinder', 'SktCommerce')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
      CREATE INDEX IF NOT EXISTS idx_carts_session ON carts(session_id);
    `);

    // Cart items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        size VARCHAR(20),
        color VARCHAR(50),
        price_at_add DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
    `);

    // Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
        payment_method VARCHAR(30) DEFAULT 'online' CHECK (payment_method IN ('online','pay_at_store')),
        payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        subtotal DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0,
        shipping_charge DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        shipping_address JSONB,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);

    // Order items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
        product_name VARCHAR(500) NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        size VARCHAR(20),
        color VARCHAR(50),
        price DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    `);

    // Site settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Seed default stores
    await client.query(`
      INSERT INTO stores (name, slug, description, city) VALUES
        ('SKT Udaipur', 'sktudaipur', 'Premium clothing store in Udaipur', 'Udaipur'),
        ('SKT Binder', 'sktbinder', 'Fashion clothing store - Binder', 'Binder')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Seed categories
    await client.query(`
      INSERT INTO categories (name, slug) VALUES
        ('Shirts', 'shirts'),
        ('Jeans', 'jeans'),
        ('Pants', 'pants'),
        ('T-Shirts', 'tshirts'),
        ('Lowers', 'lowers')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Seed admin user (password: Admin@123)
    await client.query(`
      INSERT INTO users (name, email, password_hash, role, is_verified)
      VALUES ('Admin', 'admin@sktkapdewala.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj9o4lWZM0yK', 'admin', true)
      ON CONFLICT (email) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ Database schema created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database setup error:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = setupDatabase;

if (require.main === module) {
  setupDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
