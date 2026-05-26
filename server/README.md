# 🍽️ Restaurant POS — Backend API

Node.js + Express + MySQL backend for the Restaurant POS system.

---

## 📁 Project Structure

```
server/
├── config/
│   └── db.js                  # MySQL connection pool
├── controllers/
│   ├── authController.js       # Login, register, JWT
│   ├── userController.js       # User CRUD (Admin)
│   ├── menuController.js       # Menu item CRUD
│   ├── orderController.js      # Orders + held orders
│   ├── configController.js     # Restaurant config
│   ├── dashboardController.js  # Analytics & stats
│   └── syncController.js       # Bulk sync endpoint
├── middleware/
│   ├── authMiddleware.js       # JWT protect + role authorize
│   └── errorMiddleware.js      # Global error + 404 handlers
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── menuRoutes.js
│   ├── orderRoutes.js
│   └── miscRoutes.js           # config, dashboard, sync
├── utils/
│   └── setupDatabase.js        # DB initialization script
├── .env
├── package.json
└── server.js                   # Entry point
```

---

## ⚙️ Setup Instructions

### Step 1: Install dependencies
```bash
cd server
npm install
```

### Step 2: Configure environment
Edit `.env` with your MySQL credentials:
```env
PORT=5000
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=yourpassword
MYSQL_DATABASE=restaurant_pos
MYSQL_PORT=3306
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=8h
```

### Step 3: Create the database & tables
Make sure MySQL is running, then run:
```bash
npm run setup-db
```
This reads `schema.sql` from the project root and creates all tables + seed data.

### Step 4: Start the backend
```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

Server starts at: **http://localhost:5000**

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/login` | Public | Login with username + password |
| POST | `/api/auth/register` | Admin | Register new user |
| GET | `/api/auth/me` | Protected | Get current user info |

**Login Request:**
```json
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```
**Response:** Returns `token` + `user` object. Use the token as `Authorization: Bearer <token>` for all protected routes.

---

### Menu Items
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/menu` | Protected | Get all menu items |
| GET | `/api/menu/categories/list` | Protected | Get all categories |
| GET | `/api/menu/:id` | Protected | Get single item |
| POST | `/api/menu` | Admin | Create menu item |
| PUT | `/api/menu/:id` | Admin | Update menu item |
| DELETE | `/api/menu/:id` | Admin | Delete menu item |

Query params for GET: `?category=Burgers&available=true`

---

### Orders
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/orders` | Protected | Get all orders |
| GET | `/api/orders/:id` | Protected | Get single order |
| POST | `/api/orders` | Protected | Save/sync order |
| DELETE | `/api/orders/:id` | Admin | Delete order |
| GET | `/api/orders/held` | Protected | Get held orders |
| POST | `/api/orders/held` | Protected | Save held order |
| DELETE | `/api/orders/held/:id` | Protected | Delete held order |

---

### Users (Admin only)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/users` | Admin | Get all users |
| GET | `/api/users/:username` | Admin | Get single user |
| PUT | `/api/users/:username` | Admin | Update user |
| DELETE | `/api/users/:username` | Admin | Delete user |

---

### Config & Dashboard
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/config` | Protected | Get restaurant config |
| POST | `/api/config` | Admin | Save restaurant config |
| GET | `/api/dashboard/stats` | Protected | Get analytics |
| POST | `/api/sync` | Protected | Bulk sync all state |

Dashboard query params: `?period=today` / `week` / `month` / `all`

---

### System
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/health` | Public | Health check |
| GET | `/api/db/status` | Public | DB connection status |

---

## 🔐 Default Seed Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| cashier1 | 1234 | Cashier |
| cashier2 | 4321 | Cashier |

> ⚠️ Change all passwords in production!

---

## 🌐 Connecting Frontend

In your React frontend, point API calls to `http://localhost:5000`.

To update the Vite frontend's API base URL, set in `src/lib/api.ts` or wherever you configure axios/fetch:
```js
const API_BASE = 'http://localhost:5000';
```

---

## 🗃️ Database Tables

The schema is in `schema.sql` at the project root:
- `restaurant_config` — restaurant name, tax, currency
- `menu_items` — menu with category, price, availability
- `users` — staff accounts with roles
- `orders` — completed sales with totals
- `order_items` — line items per order
- `held_orders` — saved/draft orders
- `held_order_items` — line items for held orders
