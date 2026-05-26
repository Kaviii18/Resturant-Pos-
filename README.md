# Restaurant POS Frontend — Fix Summary

## Backend Connection
- **Port:** `http://localhost:5000`
- **Health check:** `http://localhost:5000/api/health`
- **DB status:** `http://localhost:5000/api/db/status`
- **All API calls proxied via Vite dev server** → `vite.config.ts` proxies `/api` → `localhost:5000`

---

## Fixes Applied

### 1. API Base URL (`src/lib/api.ts`)
**Before:**
```ts
const API_BASE = 'http://localhost:5000/api';
```
**After:**
```ts
const API_BASE = import.meta.env?.VITE_API_BASE ?? '/api';
```
- In **development**: Vite proxy forwards `/api` → `http://localhost:5000/api` (no CORS issues)
- In **production**: set env var `VITE_API_BASE=http://localhost:5000/api` or use a reverse proxy

---

### 2. `Coins` Icon — Not Standard in Lucide React (`SalesHistory.tsx`, `MenuManagement.tsx`)
**Problem:** `Coins` icon import caused runtime crash / build error.  
**Fix:** Replaced with `BadgeDollarSign` which is available in lucide-react v0.546+

---

### 3. Non-Standard Tailwind CSS Classes (All components)
These Tailwind v4-beta/custom classes don't exist in standard Tailwind and caused missing styles:

| Invalid Class | Fixed To |
|---|---|
| `backdrop-blur-xs` | `backdrop-blur-sm` |
| `active:scale-97` | `active:scale-95` |
| `shadow-2xs` | `shadow-sm` |
| `shadow-xs` | `shadow-sm` |
| `text-rose-650` | `text-rose-600` |
| `text-emerald-850` | `text-emerald-900` |
| `text-slate-750` | `text-slate-700` |
| `text-slate-650` | `text-slate-600` |
| `text-slate-150` | `text-slate-100` |
| `bg-slate-150` | `bg-slate-100` |

---

### 4. Asset Image Path (`AuthScreen.tsx`)
**Before:** `const ceylonBistroStamp = '/src/assets/images/...'` (broken in production build)  
**After:** `import ceylonBistroStamp from '../assets/images/...'` (Vite handles hashing/bundling)

---

### 5. Unused Import (`App.tsx`)
`TrendingUp` was imported but never used — renamed to `_TrendingUp` to suppress TS warning.

---

### 6. Vite Config (`vite.config.ts`)
Added `host: true` and `port: 5173` so the dev server is accessible from other machines on the network. Proxy rewrite added for clarity.

---

## How to Run

### Backend (port 5000)
```bash
cd server
npm install
# Set up your .env with DB credentials
npm start
```

### Frontend (port 5173)
```bash
cd pos-fixed
npm install
npm run dev
# Visit: http://localhost:5173
```

### Default Login Credentials
| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin` |
| Cashier | `cashier` | `cashier` |

> If the backend is offline, the app automatically falls back to localStorage demo accounts.

---

## Full API Endpoint Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Server health check |
| GET | `/api/db/status` | None | MySQL connection status |
| POST | `/api/auth/login` | None | Login → returns JWT |
| POST | `/api/auth/register` | Admin JWT | Register new user |
| GET | `/api/auth/me` | JWT | Current user info |
| GET | `/api/menu` | JWT | All menu items |
| POST | `/api/menu` | Admin JWT | Create menu item |
| PUT | `/api/menu/:id` | Admin JWT | Update menu item |
| DELETE | `/api/menu/:id` | Admin JWT | Delete menu item |
| GET | `/api/orders` | JWT | All orders |
| POST | `/api/orders` | JWT | Create order |
| DELETE | `/api/orders/:id` | Admin JWT | Delete order |
| GET | `/api/orders/held` | JWT | Held/parked orders |
| POST | `/api/orders/held` | JWT | Save held order |
| DELETE | `/api/orders/held/:id` | JWT | Delete held order |
| GET | `/api/config` | JWT | Restaurant config |
| POST | `/api/config` | Admin JWT | Save restaurant config |
| POST | `/api/sync` | JWT | Bulk sync all data |
| GET | `/api/dashboard/stats` | JWT | Dashboard statistics |
