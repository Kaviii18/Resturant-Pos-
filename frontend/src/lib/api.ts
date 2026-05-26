/**
 * Restaurant POS — Backend API Client
 * Backend: Express/MySQL running on port 5000
 * In development: Vite proxies /api → http://localhost:5000/api
 * In production: set VITE_API_BASE env var or falls back to localhost:5000
 */

import {
  MenuItem, Order, HoldOrder, RestaurantConfig, User,
  DiningTable, KitchenTicket, Ingredient, RecipeLine, SplitCheckoutLine, PrintSize,
} from '../types';

// Use env variable if set, otherwise use relative path (works with Vite proxy in dev)
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '/api';

// ─── TOKEN MANAGEMENT ───────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('gusto_pos_token');
}

export function setToken(token: string): void {
  localStorage.setItem('gusto_pos_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('gusto_pos_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    const msg = err.message || `Request failed: ${res.status}`;
    if (res.status === 429) {
      throw new Error('Too many requests — please wait a moment and refresh.');
    }
    throw new Error(msg);
  }

  return res.json();
}

// ─── HEALTH / CONNECTION ──────────────────────────────────────────────────────

export async function validateConnection(): Promise<boolean> {
  try {
    const data = await apiRequest<{ success: boolean }>('/health');
    return data.success === true;
  } catch {
    return false;
  }
}

export async function getDbStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  message: string;
  details?: any;
}> {
  try {
    const data = await apiRequest<{ success: boolean; connected: boolean; database?: string; host?: string }>('/db/status');
    return {
      connected: data.connected,
      configured: true,
      message: data.connected ? 'Connected' : 'Disconnected',
      details: { dbName: data.database, host: data.host },
    };
  } catch (err: any) {
    return {
      connected: false,
      configured: false,
      message: err.message || 'Server unreachable',
    };
  }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function loginUser(
  username: string,
  password: string
): Promise<{ token: string; user: User }> {
  const data = await apiRequest<{ success: boolean; token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return {
    token: data.token,
    user: {
      username: data.user.username,
      fullName: data.user.fullName || data.user.full_name,
      role: data.user.role,
    },
  };
}

export async function registerUser(
  username: string,
  fullName: string,
  password: string,
  role: 'Admin' | 'Cashier' = 'Cashier'
): Promise<void> {
  await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, fullName, password, role }),
  });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const data = await apiRequest<{ success: boolean; user: any }>('/auth/me');
    return {
      username: data.user.username,
      fullName: data.user.fullName || data.user.full_name,
      role: data.user.role,
    };
  } catch {
    return null;
  }
}

// ─── MENU ────────────────────────────────────────────────────────────────────

export async function getMenuItemsFromDb(): Promise<MenuItem[]> {
  try {
    const data = await apiRequest<{ success: boolean; data: any[] }>('/menu');
    return (data.data || []).map(normalizeMenuItem);
  } catch {
    return [];
  }
}

export async function saveMenuItemToDb(item: MenuItem): Promise<void> {
  try {
    // Try update first, then create
    try {
      await apiRequest(`/menu/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      });
    } catch {
      await apiRequest('/menu', {
        method: 'POST',
        body: JSON.stringify(item),
      });
    }
  } catch (err) {
    console.warn('saveMenuItemToDb failed:', err);
  }
}

export async function deleteMenuItemFromDb(itemId: string): Promise<void> {
  try {
    await apiRequest(`/menu/${itemId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('deleteMenuItemFromDb failed:', err);
  }
}

function normalizeMenuItem(raw: any): MenuItem {
  return {
    id: raw.id,
    name: raw.name,
    price: Number(raw.price),
    category: raw.category || 'General',
    description: raw.description || '',
    imageUrl: raw.imageUrl || raw.image_url || '',
    isAvailable: raw.isAvailable ?? raw.is_available ?? true,
  };
}

// ─── RESTAURANT CONFIG ───────────────────────────────────────────────────────

export async function getRestaurantConfigFromDb(): Promise<RestaurantConfig | null> {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>('/config');
    if (!data.data) return null;
    const c = data.data;
    return {
      name: c.name,
      address: c.address,
      phone: c.phone,
      taxRate: Number(c.taxRate ?? c.tax_rate ?? 0.1),
      currency: c.currency || 'LKR',
      currencySymbol: c.currencySymbol || c.currency_symbol || 'Rs.',
    };
  } catch {
    return null;
  }
}

export async function saveRestaurantConfigToDb(config: RestaurantConfig): Promise<void> {
  try {
    await apiRequest('/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  } catch (err) {
    console.warn('saveRestaurantConfigToDb failed:', err);
  }
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

export async function getOrdersFromDb(): Promise<Order[]> {
  try {
    const data = await apiRequest<{ success: boolean; orders?: any[]; data?: any[] }>('/orders');
    const list = data.orders || data.data || [];
    return list.map(normalizeOrderFromApi);
  } catch {
    return [];
  }
}

export async function addOrderToDb(order: Order): Promise<void> {
  try {
    await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  } catch (err) {
    console.warn('addOrderToDb failed:', err);
  }
}

export async function clearAllOrdersFromDb(ordersToDelete: Order[]): Promise<void> {
  // Delete one by one (admin only)
  for (const order of ordersToDelete) {
    try {
      await apiRequest(`/orders/${order.id}`, { method: 'DELETE' });
    } catch {
      // skip
    }
  }
}

function mapOrderItems(rawItems: any[]): Order['items'] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((line) => ({
    menuItem: {
      id: line.item_id || line.menuItem?.id,
      name: line.item_name || line.menuItem?.name,
      price: Number(line.item_price ?? line.menuItem?.price ?? 0),
      category: line.item_category || line.menuItem?.category || 'General',
      isAvailable: true,
    },
    quantity: line.quantity,
    notes: line.notes || '',
  }));
}

function normalizeOrderFromApi(raw: any): Order {
  const items = raw.items?.[0]?.menuItem
    ? raw.items
    : mapOrderItems(raw.items || []);
  return {
    id: raw.id,
    timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
    items,
    subtotal: Number(raw.subtotal || 0),
    tax: Number(raw.tax || 0),
    discount: Number(raw.discount || 0),
    total: Number(raw.total || 0),
    paymentMethod: raw.paymentMethod || raw.payment_method || 'Cash',
    amountReceived: Number(raw.amountReceived ?? raw.amount_received ?? 0),
    changeGiven: Number(raw.changeGiven ?? raw.change_given ?? 0),
    serviceMode: raw.serviceMode || raw.service_mode || 'Dine-In',
    cashier: raw.cashier || '',
    tableId: raw.tableId || raw.table_id,
    splitGroupId: raw.splitGroupId || raw.split_group_id,
    splitLabel: raw.splitLabel || raw.split_label,
  };
}

/** @deprecated use normalizeOrderFromApi */
function normalizeOrder(raw: any): Order {
  return normalizeOrderFromApi(raw);
}

// ─── HELD ORDERS ─────────────────────────────────────────────────────────────

export async function getHeldOrdersFromDb(): Promise<HoldOrder[]> {
  try {
    const data = await apiRequest<{ success: boolean; heldOrders?: any[]; data?: any[] }>('/orders/held');
    const list = data.heldOrders || data.data || [];
    return list.map(normalizeHeldOrder);
  } catch {
    return [];
  }
}

export async function saveHeldOrderToDb(heldOrder: HoldOrder): Promise<void> {
  try {
    await apiRequest('/orders/held', {
      method: 'POST',
      body: JSON.stringify(heldOrder),
    });
  } catch (err) {
    console.warn('saveHeldOrderToDb failed:', err);
  }
}

export async function deleteHeldOrderFromDb(heldOrderId: string): Promise<void> {
  try {
    await apiRequest(`/orders/held/${heldOrderId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('deleteHeldOrderFromDb failed:', err);
  }
}

function normalizeHeldOrder(raw: any): HoldOrder {
  return {
    id: raw.id,
    timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
    customerName: raw.customerName || raw.customer_name || '',
    items: typeof raw.items === 'string' ? JSON.parse(raw.items) : (raw.items || []),
    notes: raw.notes || '',
    serviceMode: raw.serviceMode || raw.service_mode || 'Dine-In',
  };
}

// ─── SYNC ALL ────────────────────────────────────────────────────────────────

export async function syncAllToBackend(payload: {
  config: RestaurantConfig;
  menuItems: MenuItem[];
  orders: Order[];
  heldOrders: HoldOrder[];
}): Promise<{ success: boolean; message?: string }> {
  try {
    const data = await apiRequest<{ success: boolean; message?: string }>('/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data;
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<any> {
  try {
    return await apiRequest('/dashboard/stats');
  } catch {
    return null;
  }
}

// ─── POLLING SUBSCRIPTIONS (replaces Firestore real-time) ───────────────────

export function subscribeMenuItems(callback: (items: MenuItem[]) => void): () => void {
  return pollWhenVisible(POLL.menu, async () => {
    const items = await getMenuItemsFromDb();
    callback(items);
  });
}

export function subscribeOrders(callback: (orders: Order[]) => void): () => void {
  return pollWhenVisible(POLL.orders, async () => {
    const orders = await getOrdersFromDb();
    callback(orders);
  });
}

// ─── DINING TABLES ───────────────────────────────────────────────────────────

export async function getDiningTables(): Promise<DiningTable[]> {
  const data = await apiRequest<{ success: boolean; data: DiningTable[]; message?: string }>('/tables');
  if (data.success === false) {
    throw new Error(data.message || 'Failed to load dining tables');
  }
  return data.data || [];
}

export async function updateTableStatus(
  tableId: string,
  status: DiningTable['status'],
  activeSessionId?: string | null
): Promise<void> {
  await apiRequest(`/tables/${tableId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, activeSessionId }),
  });
}

// ─── KITCHEN ORDER TICKETS ───────────────────────────────────────────────────

export async function getKitchenTickets(status?: string): Promise<KitchenTicket[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await apiRequest<{ success: boolean; data: KitchenTicket[] }>(`/kot${qs}`);
  return data.data || [];
}

export async function fireKitchenTicket(payload: {
  tableId?: string;
  tableName?: string;
  serviceMode: string;
  notes?: string;
  items: Order['items'];
  cashier?: string;
}): Promise<{ id: string }> {
  const data = await apiRequest<{ success: boolean; data: { id: string } }>('/kot/fire', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function updateKitchenTicketStatus(
  ticketId: string,
  status: KitchenTicket['status']
): Promise<void> {
  await apiRequest(`/kot/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function updateKitchenTicketItemStatus(
  ticketId: string,
  itemId: number,
  status: KitchenTicket['items'][0]['status']
): Promise<void> {
  await apiRequest(`/kot/${ticketId}/items/${itemId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

const POLL = {
  kitchen: 20000,
  tables: 30000,
  held: 20000,
  menu: 45000,
  orders: 45000,
};

function pollWhenVisible(intervalMs: number, fn: () => void | Promise<void>) {
  let active = true;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (!active || document.hidden) return;
    fn();
  };

  tick();
  timer = setInterval(tick, intervalMs);

  const onVis = () => {
    if (!document.hidden) tick();
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    active = false;
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
  };
}

export function subscribeKitchenTickets(callback: (tickets: KitchenTicket[]) => void): () => void {
  return pollWhenVisible(POLL.kitchen, async () => {
    try {
      callback(await getKitchenTickets());
    } catch {
      callback([]);
    }
  });
}

// ─── SPLIT BILLING ───────────────────────────────────────────────────────────

export async function settleSplitBill(payload: {
  splitGroupId?: string;
  tableId?: string;
  serviceMode: string;
  cashier?: string;
  splits: SplitCheckoutLine[];
}): Promise<{ splitGroupId: string; orderIds: string[] }> {
  const data = await apiRequest<{
    success: boolean;
    data: { splitGroupId: string; orderIds: string[] };
  }>('/splits/settle', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.data;
}

// ─── INVENTORY ───────────────────────────────────────────────────────────────

export async function getIngredients(): Promise<Ingredient[]> {
  try {
    const data = await apiRequest<{ success: boolean; data?: Ingredient[] }>('/inventory/ingredients');
    return Array.isArray(data.data) ? data.data : [];
  } catch {
    return [];
  }
}

export async function getLowStockIngredients(): Promise<Ingredient[]> {
  const data = await apiRequest<{ success: boolean; data: Ingredient[] }>('/inventory/low-stock');
  return data.data || [];
}

export async function adjustIngredientStock(
  ingredientId: string,
  quantity: number,
  movementType: 'in' | 'out' | 'adjust',
  reason?: string
): Promise<void> {
  await apiRequest('/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify({ ingredientId, quantity, movementType, reason }),
  });
}

export async function getRecipeForMenuItem(menuItemId: string): Promise<RecipeLine[]> {
  const data = await apiRequest<{ success: boolean; data: RecipeLine[] }>(
    `/inventory/recipes/${menuItemId}`
  );
  return data.data || [];
}

export async function saveRecipeForMenuItem(
  menuItemId: string,
  recipes: { ingredientId: string; qtyPerServing: number }[]
): Promise<void> {
  await apiRequest(`/inventory/recipes/${menuItemId}`, {
    method: 'PUT',
    body: JSON.stringify({ recipes }),
  });
}

// ─── SILENT PRINTING (backend → system printer, no browser dialog) ───────────

export async function printReceiptSilent(
  order: Order,
  restaurant: RestaurantConfig,
  printSize: PrintSize,
  copies = 1
): Promise<{ success: boolean; message?: string }> {
  const data = await apiRequest<{ success: boolean; message?: string }>('/print/receipt', {
    method: 'POST',
    body: JSON.stringify({ order, restaurant, printSize, copies }),
  });
  return { success: data.success, message: data.message };
}

export async function getAvailablePrinters(): Promise<string[]> {
  try {
    const data = await apiRequest<{ success: boolean; data: string[] }>('/print/printers');
    return data.data || [];
  } catch {
    return [];
  }
}

export function subscribeHeldOrders(callback: (holds: HoldOrder[]) => void): () => void {
  return pollWhenVisible(POLL.held, async () => {
    const holds = await getHeldOrdersFromDb();
    callback(holds);
  });
}
