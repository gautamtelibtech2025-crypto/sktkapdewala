# 🛍️ Sktkapdewala – Multi-Store eCommerce Platform

A complete full-stack multi-store fashion eCommerce application built with Node.js, PostgreSQL, and vanilla HTML/CSS/JavaScript.

---

## 🗂️ Project Structure

```
sktkapdewala/
├── backend/
│   ├── config/
│   │   ├── db.js              # PostgreSQL connection pool
│   │   └── dbSetup.js         # Schema creation + seed data
│   ├── controllers/
│   │   ├── authController.js  # Login, register, OTP
│   │   ├── productController.js
│   │   ├── inventoryController.js
│   │   ├── cartController.js
│   │   ├── orderController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js            # JWT middleware
│   │   ├── errorHandler.js
│   │   └── upload.js          # Multer file uploads
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── inventory.js
│   │   ├── cart.js
│   │   ├── orders.js
│   │   └── admin.js
│   ├── uploads/               # Created automatically
│   ├── server.js              # Express entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── css/
    │   └── main.css
    ├── js/
    │   └── api.js             # API client + state management
    ├── assets/
    │   ├── logo.svg
    │   └── product-placeholder.svg
    ├── pages/
    │   ├── products.html      # Product listing with filters
    │   ├── product.html       # Product detail page
    │   ├── cart.html          # Shopping cart
    │   ├── checkout.html      # Checkout + payment
    │   ├── orders.html        # Order history
    │   └── admin.html         # Admin dashboard
    └── index.html             # Home page
```

---

## ⚡ Quick Setup

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 2. Database Setup
```sql
-- In psql or pgAdmin:
CREATE DATABASE sktkapdewala;
```

### 3. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Copy and configure env
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Start server (auto-creates tables + seeds data)
npm start
```

### 4. Frontend
The frontend is served automatically by Express at `http://localhost:3000`.

Or use Live Server (VS Code extension) pointing to the `frontend/` folder.

---

## 🔑 Default Admin Login
- **Email:** `admin@sktkapdewala.com`
- **Password:** `Admin@123`
- **Admin URL:** `http://localhost:3000/pages/admin.html`

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/otp/send` | Send OTP to phone |
| POST | `/api/auth/otp/verify` | Verify OTP & login |
| GET | `/api/auth/me` | Get current user |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (with filters) |
| GET | `/api/products/:id` | Product detail + inventory |
| POST | `/api/products` | Create product (admin) |
| PUT | `/api/products/:id` | Update product (admin) |
| DELETE | `/api/products/:id` | Delete product (admin) |
| GET | `/api/products/categories` | All categories |

**Query params for GET /api/products:**
- `store=sktudaipur` or `sktbinder`
- `category=shirts|jeans|pants|tshirts|lowers`
- `search=keyword`
- `minPrice=500&maxPrice=2000`
- `page=1&limit=20`
- `sortBy=base_price&order=ASC`

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory?store=sktudaipur` | Get inventory |
| POST | `/api/inventory` | Set stock (admin) |
| GET | `/api/inventory/stores` | All stores |

### Cart
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get cart |
| POST | `/api/cart/add` | Add item |
| DELETE | `/api/cart/remove` | Remove item |
| PUT | `/api/cart/update` | Update quantity |

> Cart works for both guests (via `x-session-id` header) and logged-in users.

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | Get my orders |
| PUT | `/api/orders/status` | Update status (admin) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Stats + recent orders |
| GET | `/api/admin/users` | All users |
| GET | `/api/admin/stores` | All stores |
| POST | `/api/admin/stores` | Create store |
| GET | `/api/admin/settings` | Site settings |
| POST | `/api/admin/settings` | Update setting |
| POST | `/api/admin/upload` | Upload file |

---

## 🏬 Multi-Store System

Three modes:
1. **SktUdaipur** – Filters products/inventory to Udaipur store
2. **SktBinder** – Filters products/inventory to Binder store
3. **SktCommerce** – Combined view across all stores

The store toggle in the navbar persists via `localStorage`.

---

## 💳 Razorpay Integration

1. Create account at [razorpay.com](https://razorpay.com)
2. Get your Key ID and Key Secret
3. Update `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxx
   RAZORPAY_KEY_SECRET=xxxxxx
   ```
4. Update `checkout.html` line with `rzp_test_your_key_here`

---

## 📱 OTP (SMS) Integration

In production, replace the console.log OTP with Twilio or MSG91:

```javascript
// In authController.js sendOTP function:
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
await client.messages.create({
  body: `Your Sktkapdewala OTP: ${otp}`,
  from: process.env.TWILIO_PHONE,
  to: phone
});
```

---

## 🔐 Security Features
- JWT authentication (7-day expiry)
- bcrypt password hashing (12 rounds)
- Input validation
- Admin-only route protection
- Guest cart via session ID
- Transaction-safe order creation with stock deduction

---

## 📊 Database Schema

9 tables with proper relations and indexes:
- `users` – Customer and admin accounts
- `otps` – OTP verification records
- `stores` – SktUdaipur + SktBinder
- `categories` – Shirts, Jeans, Pants, T-Shirts, Lowers
- `products` – Product catalog with images/video
- `inventory` – Store-specific stock levels
- `carts` – Guest and user carts
- `cart_items` – Items with store reference
- `orders` + `order_items` – Transaction-safe order records
- `site_settings` – Key-value store settings

---

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager: `pm2 start server.js`
3. Configure Nginx reverse proxy
4. Use PostgreSQL connection pooling (PgBouncer)
5. Store uploads on S3/Cloudinary (replace local file storage)
6. Enable HTTPS

---

## 📝 License
MIT – Built for Sktkapdewala, Rajasthan
