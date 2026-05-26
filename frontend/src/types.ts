export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
  isAvailable: boolean;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string; // Formatting: ORD-YYYYMMDD-HHMMSS
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  tax: number; // 10% VAT/Tax
  discount: number; // optional discount
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Mobile Wallet';
  amountReceived?: number;
  changeGiven?: number;
  serviceMode: 'Dine-In' | 'Takeaway';
  cashier?: string;
  tableId?: string;
  splitGroupId?: string;
  splitLabel?: string;
}

export interface User {
  username: string;
  fullName: string;
  password?: string; // used for simple localStorage matching
  role: 'Admin' | 'Cashier';
}

export interface HoldOrder {
  id: string;
  timestamp: string;
  customerName: string;
  items: CartItem[];
  notes?: string;
  serviceMode: 'Dine-In' | 'Takeaway';
  tableId?: string;
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'billing';

export interface DiningTable {
  id: string;
  name: string;
  zone: string;
  capacity: number;
  status: TableStatus;
  activeSessionId?: string | null;
  activeKotId?: string | null;
  activeKotStatus?: string | null;
  hasActiveOrders?: boolean;
  kitchenLabel?: string;
  updatedAt?: string;
}

export type KotTicketStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type KotItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface KitchenTicketItem {
  id: number;
  ticketId: string;
  itemId: string;
  itemName: string;
  itemCategory?: string;
  quantity: number;
  notes?: string;
  status: KotItemStatus;
}

export interface KitchenTicket {
  id: string;
  tableId?: string | null;
  tableName?: string | null;
  serviceMode: string;
  status: KotTicketStatus;
  notes?: string;
  cashier?: string;
  firedAt: string;
  preparedAt?: string | null;
  items: KitchenTicketItem[];
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  isLowStock?: boolean;
}

export interface RecipeLine {
  id?: number;
  menuItemId: string;
  ingredientId: string;
  ingredientName?: string;
  unit?: string;
  qtyPerServing: number;
}

export interface SplitCheckoutLine {
  label: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: Order['paymentMethod'];
  amountReceived: number;
  changeGiven: number;
}

export type PrintSize = '58mm' | '80mm' | 'A4';

export type ActiveTab = 'pos' | 'menu' | 'history' | 'tables' | 'kitchen' | 'inventory';

export interface RestaurantConfig {
  name: string;
  address: string;
  phone: string;
  taxRate: number; // e.g. 0.10 for 10%
  currency: string; // e.g. "$"
  currencySymbol: string;
}
