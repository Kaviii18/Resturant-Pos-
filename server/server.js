/**
 * Restaurant POS — Express Backend Server
 * Stack : Node.js + Express + MySQL + JWT + Helmet + CORS + Rate Limiting
 *
 * Rate-limit architecture (production best-practice):
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  /api/health      → NO limit  (monitoring / heartbeat)  │
 *  │  /api/db/status   → NO limit  (monitoring / heartbeat)  │
 *  │  /api/auth/*      → STRICT  (20 req / 15 min / IP)      │
 *  │  /api/orders/*    → MODERATE (100 req / 15 min / IP)    │
 *  │  /api/menu/*      → MODERATE (100 req / 15 min / IP)    │
 *  │  /api/*  (rest)   → STANDARD (300 req / 15 min / IP)    │
 *  └─────────────────────────────────────────────────────────┘
 *
 * WHY the original code caused "Too many requests":
 *  app.use('/api/', limiter)  applies to EVERY /api/* route including
 *  /api/health and /api/db/status.  The React frontend polls these
 *  endpoints every ~15–30 s in subscriptions + the Vite dev server
 *  itself makes preflight OPTIONS calls, burning through the shared
 *  200-request window almost immediately on localhost where all traffic
 *  comes from a single IP address (127.0.0.1).
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// 1. TRUST PROXY
//    Required when running behind Nginx / a load-balancer so that
//    express-rate-limit reads the real client IP from X-Forwarded-For
//    instead of always seeing the proxy's IP.
//    Set to 1 for a single reverse-proxy layer; 0 in bare-metal dev.
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SECURITY HEADERS — Helmet
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet());

// ─────────────────────────────────────────────────────────────────────────────
// 3. CORS
//    Allow the Vite dev server (5173) and any production origin defined
//    in the ALLOWED_ORIGINS env var (comma-separated).
// ─────────────────────────────────────────────────────────────────────────────
const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

const allowedOrigins = [...new Set([...devOrigins, ...envOrigins])];

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server calls (no origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin "${origin}" not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. BODY PARSING
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// 5. RATE LIMITERS
//
//    Key decisions:
//    a) /api/health & /api/db/status — registered BEFORE any limiter so they
//       are never rate-limited. These are heartbeat/monitoring endpoints that
//       the frontend polls continuously and must always be reachable.
//
//    b) Auth limiter (strictest) — brute-force protection on login/register.
//       20 attempts per 15 minutes per IP.  skipSuccessfulRequests: true means
//       a successful login doesn't eat into the quota.
//
//    c) Sensitive data limiter — orders & menu writes; moderate cap.
//       100 req / 15 min.
//
//    d) General API limiter — everything else under /api/.
//       300 req / 15 min.  Applied last so it only catches routes not already
//       covered by a stricter limiter.
//
//    All limiters use standardHeaders (RateLimit-*) and suppress the legacy
//    X-RateLimit-* headers to match RFC 6585 / IETF draft-ietf-httpapi-ratelimit.
// ─────────────────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== 'production';
const disableRateLimit = process.env.DISABLE_RATE_LIMIT === 'true';

/**
 * Dashboard GET polling (KOT, tables, inventory, menu, held orders) must not
 * share the strict mutation limiter — kitchen alone at 8s = ~112 req/15min.
 */
function shouldSkipDashboardPoll(req) {
  if (disableRateLimit) return true;
  if (process.env.RATE_LIMIT_DASHBOARD === 'false' && !isDev) return false;
  if (!isDev && process.env.RATE_LIMIT_RELAXED !== 'true') return false;
  if (req.method !== 'GET') return false;

  const url = req.originalUrl || req.url || '';
  return (
    url.startsWith('/api/kot') ||
    url.startsWith('/api/tables') ||
    url.startsWith('/api/inventory/ingredients') ||
    url.startsWith('/api/inventory/low-stock') ||
    url.startsWith('/api/menu') ||
    url.startsWith('/api/orders/held') ||
    url === '/api/orders' ||
    url.startsWith('/api/orders?')
  );
}

/** Helper — builds a limiter with sensible defaults */
function makeLimiter({ windowMinutes = 15, max, message, skipSuccessful = false, skip } = {}) {
  return rateLimit({
    windowMs          : windowMinutes * 60 * 1000,
    max,
    standardHeaders   : 'draft-7',
    legacyHeaders     : false,
    skipSuccessfulRequests: skipSuccessful,
    message           : { success: false, message },
    keyGenerator      : (req) => req.ip,
    skip              : (req) => {
      if (typeof skip === 'function' && skip(req)) return true;
      return shouldSkipDashboardPoll(req);
    },
  });
}

// Strict: login / register brute-force guard
const authLimiter = makeLimiter({
  windowMinutes  : 15,
  max            : 20,
  message        : 'Too many login attempts. Please wait 15 minutes and try again.',
  skipSuccessful : true,   // successful logins don't count against the quota
});

// Moderate: mutations on orders/menu/kot/tables/inventory
const dataLimiterMax = isDev
  ? parseInt(process.env.RATE_LIMIT_DATA_MAX, 10) || 5000
  : parseInt(process.env.RATE_LIMIT_DATA_MAX, 10) || 500;

const dataLimiter = makeLimiter({
  windowMinutes : isDev ? 1 : 15,
  max           : dataLimiterMax,
  message       : 'Too many requests to this resource. Please slow down.',
});

// General fallback for everything else under /api/
const generalMax = parseInt(process.env.RATE_LIMIT_MAX, 10);
const generalLimiter = makeLimiter({
  windowMinutes : isDev ? 1 : 15,
  max           : isDev ? (generalMax > 0 ? Math.max(generalMax, 3000) : 3000) : (generalMax || 300),
  message       : 'Too many requests. Please try again shortly.',
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUBLIC HEALTH ENDPOINTS  ← registered BEFORE any rate limiter
//    These must never be blocked — the frontend status panel and monitoring
//    tools depend on them being always reachable.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success     : true,
    status      : 'OK',
    timestamp   : new Date().toISOString(),
    environment : process.env.NODE_ENV || 'development',
  });
});

const pool = require('./config/db');

app.get('/api/db/status', async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();

    const { getSchemaStatus, ensureDbReady } = require('./utils/dbBootstrap');
    let schema = { ok: false, missingTables: [] };
    try {
      await ensureDbReady();
      schema = await getSchemaStatus();
    } catch (schemaErr) {
      schema = { ok: false, error: schemaErr.message };
    }

    res.json({
      success   : true,
      connected : true,
      database  : process.env.MYSQL_DATABASE || 'restaurant_pos',
      host      : process.env.MYSQL_HOST     || 'localhost',
      schema,
    });
  } catch (err) {
    res.status(503).json({
      success   : false,
      connected : false,
      message   : err.message,
    });
  }
});

/** Public schema check — lists tables & missing required tables */
app.get('/api/db/schema', async (_req, res) => {
  try {
    const { ensureDbReady, getSchemaStatus } = require('./utils/dbBootstrap');
    const bootstrap = await ensureDbReady();
    const status = await getSchemaStatus();
    res.json({ success: true, ...status, seeded: bootstrap.seeded });
  } catch (err) {
    res.status(503).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. RATE-LIMITED API ROUTES
//    Order matters: more-specific limiters are applied first.
//    Express matches routes in registration order so /api/auth must come
//    before the general /api/ catch-all.
// ─────────────────────────────────────────────────────────────────────────────

// Auth — strictest limiter
app.use('/api/auth',   authLimiter,  require('./routes/authRoutes'));

// Orders + Menu + KOT + Tables + Inventory + Splits — moderate limiter
app.use('/api/orders',    dataLimiter, require('./routes/orderRoutes'));
app.use('/api/menu',      dataLimiter, require('./routes/menuRoutes'));
app.use('/api/kot',       dataLimiter, require('./routes/kotRoutes'));
app.use('/api/tables',    dataLimiter, require('./routes/tableRoutes'));
app.use('/api/inventory', dataLimiter, require('./routes/inventoryRoutes'));
app.use('/api/splits',    dataLimiter, require('./routes/splitRoutes'));
app.use('/api/print',     dataLimiter, require('./routes/printRoutes'));

// Everything else — general limiter
app.use('/api/users',  generalLimiter, require('./routes/userRoutes'));
app.use('/api',        generalLimiter, require('./routes/miscRoutes')); // config, dashboard, sync

// ─────────────────────────────────────────────────────────────────────────────
// 8. ERROR HANDLING  (must be registered after all routes)
// ─────────────────────────────────────────────────────────────────────────────
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// 9. START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  Restaurant POS Backend running on port ${PORT}`);
  console.log(`    Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`    Health check: http://localhost:${PORT}/api/health`);
  console.log(`    DB status   : http://localhost:${PORT}/api/db/status\n`);
});

module.exports = app;
