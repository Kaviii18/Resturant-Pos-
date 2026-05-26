import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Menu as MenuIcon,
  History,
  Clock,
  ChefHat,
  LayoutGrid,
  Package,
  TrendingUp as _TrendingUp,
  Settings,
  X,
  LogOut,
  Sparkles,
  Wifi,
  WifiOff,
  Download,
  Database,
  Upload,
} from 'lucide-react';

import { MenuItem, Order, HoldOrder, RestaurantConfig, ActiveTab, User, PrintSize } from './types';
import { DEFAULT_RESTAURANT_CONFIG, INITIAL_MENU_ITEMS } from './data';

import PosBilling from './components/PosBilling';
import MenuManagement from './components/MenuManagement';
import SalesHistory from './components/SalesHistory';
import ReceiptModal from './components/ReceiptModal';
import AuthScreen from './components/AuthScreen';
import TableFloor from './components/TableFloor';
import KitchenDisplay from './components/KitchenDisplay';
import InventoryManagement from './components/InventoryManagement';

import {
  validateConnection,
  getDbStatus,
  getMenuItemsFromDb,
  saveMenuItemToDb,
  deleteMenuItemFromDb,
  getRestaurantConfigFromDb,
  saveRestaurantConfigToDb,
  getOrdersFromDb,
  addOrderToDb,
  clearAllOrdersFromDb,
  getHeldOrdersFromDb,
  saveHeldOrderToDb,
  deleteHeldOrderFromDb,
  subscribeMenuItems,
  subscribeOrders,
  subscribeHeldOrders,
  syncAllToBackend,
  getToken,
  clearToken,
} from './lib/api';

export default function App() {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('gusto_pos_current_user');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });

  // ── UI state ─────────────────────────────────────────────────────────────
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [posTableId, setPosTableId] = useState<string | undefined>();
  const [systemTime, setSystemTime] = useState<string>(new Date().toLocaleTimeString());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // ── Data state ───────────────────────────────────────────────────────────
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantConfig>(DEFAULT_RESTAURANT_CONFIG);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [heldOrders, setHeldOrders] = useState<HoldOrder[]>([]);

  // ── Receipt modal ────────────────────────────────────────────────────────
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isNewCheckoutReceipt, setIsNewCheckoutReceipt] = useState(false);
  const [receiptPrintSize, setReceiptPrintSize] = useState<PrintSize>('80mm');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);

  // ── DB Status modal ──────────────────────────────────────────────────────
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    configured: boolean;
    connected: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Config modal ─────────────────────────────────────────────────────────
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editedRestName, setEditedRestName] = useState(restaurantInfo.name);
  const [editedRestAddress, setEditedRestAddress] = useState(restaurantInfo.address);
  const [editedRestPhone, setEditedRestPhone] = useState(restaurantInfo.phone);

  // ── Server health check ──────────────────────────────────────────────────
  const fetchDbStatus = async () => {
    const status = await getDbStatus();
    setDbStatus(status);
  };

  // ── Sync all data to backend ─────────────────────────────────────────────
  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const result = await syncAllToBackend({
        config: restaurantInfo,
        menuItems,
        orders,
        heldOrders,
      });
      if (result.success) {
        setSuccessToast('⚡ Data successfully synchronized to MySQL backend!');
        await fetchDbStatus();
      } else {
        alert('Sync failed: ' + result.message);
      }
    } catch (err: any) {
      alert('Sync error: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Backup / Restore ─────────────────────────────────────────────────────
  const handleExportFullOfflineBackup = () => {
    try {
      const dbBackup = {
        meta: {
          exportedAt: new Date().toISOString(),
          version: 'gusto-pos-offline-v1',
          terminalId: 'C03-COLOMBO-P1',
        },
        restaurantInfo,
        menuItems,
        orders,
        heldOrders,
      };
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dbBackup, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `gusto_pos_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSuccessToast('📦 Full offline backup downloaded!');
    } catch (err) {
      setSuccessToast('⚠️ Backup export failed.');
    }
  };

  const handleRestoreFullOfflineBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const raw = event.target?.result as string;
        const imported = JSON.parse(raw);
        if (!imported?.meta || imported.meta.version !== 'gusto-pos-offline-v1') {
          alert('Invalid backup file.');
          return;
        }
        if (!window.confirm('Restore from this backup? Current data will be overwritten.')) return;

        if (imported.restaurantInfo) {
          setRestaurantInfo(imported.restaurantInfo);
          localStorage.setItem('gusto_pos_config', JSON.stringify(imported.restaurantInfo));
          await saveRestaurantConfigToDb(imported.restaurantInfo);
        }
        if (Array.isArray(imported.menuItems)) {
          saveMenuState(imported.menuItems);
          for (const item of imported.menuItems) await saveMenuItemToDb(item);
        }
        if (Array.isArray(imported.orders)) {
          saveOrdersState(imported.orders);
          for (const order of imported.orders) await addOrderToDb(order);
        }
        if (Array.isArray(imported.heldOrders)) {
          await saveHeldState(imported.heldOrders);
        }
        setSuccessToast('🎉 Backup restored successfully!');
      } catch {
        alert('Failed to parse backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Clock tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Toast auto-dismiss ───────────────────────────────────────────────────
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // ── Online/offline listeners ─────────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setSuccessToast('⚡ Back online — backend sync resuming.');
    };
    const goOffline = () => {
      setIsOnline(false);
      setSuccessToast('🚫 Offline — operating from local cache.');
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Initial data load + real-time subscriptions ──────────────────────────
  useEffect(() => {
    // Ping server health
    fetchDbStatus();

    async function loadInitialData() {
      await validateConnection();

      // Config
      try {
        const cloudConfig = await getRestaurantConfigFromDb();
        if (cloudConfig) {
          setRestaurantInfo(cloudConfig);
          localStorage.setItem('gusto_pos_config', JSON.stringify(cloudConfig));
        } else {
          const cached = localStorage.getItem('gusto_pos_config');
          const finalConfig = cached ? JSON.parse(cached) : DEFAULT_RESTAURANT_CONFIG;
          setRestaurantInfo(finalConfig);
          await saveRestaurantConfigToDb(finalConfig);
        }
      } catch (e) {
        const cached = localStorage.getItem('gusto_pos_config');
        if (cached) {
          try { setRestaurantInfo(JSON.parse(cached)); } catch {}
        }
      }
    }

    loadInitialData();

    // Subscribe menu
    const unsubMenu = subscribeMenuItems(async (items) => {
      if (items.length === 0) {
        setMenuItems(INITIAL_MENU_ITEMS);
        localStorage.setItem('gusto_pos_menu', JSON.stringify(INITIAL_MENU_ITEMS));
        for (const item of INITIAL_MENU_ITEMS) await saveMenuItemToDb(item);
      } else {
        setMenuItems(items);
        localStorage.setItem('gusto_pos_menu', JSON.stringify(items));
      }
    });

    // Subscribe orders
    const unsubOrders = subscribeOrders(async (ordersList) => {
      if (ordersList.length === 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(12, 30, 0);
        const todayLunc = new Date();
        todayLunc.setHours(13, 15, 0);
        const todayEven = new Date();
        todayEven.setHours(19, 45, 0);

        const sampleOrders: Order[] = [
          {
            id: 'ORD-20260521-123011',
            timestamp: yesterday.toISOString(),
            items: [
              { menuItem: INITIAL_MENU_ITEMS[0], quantity: 1, notes: 'No raw onions' },
              { menuItem: INITIAL_MENU_ITEMS[9], quantity: 1, notes: 'Low sweetness' },
            ],
            subtotal: 2400.0,
            discount: 0,
            tax: 240.0,
            total: 2640.0,
            paymentMethod: 'Cash',
            amountReceived: 3000.0,
            changeGiven: 360.0,
            serviceMode: 'Dine-In',
          },
          {
            id: 'ORD-20260522-131544',
            timestamp: todayLunc.toISOString(),
            items: [
              { menuItem: INITIAL_MENU_ITEMS[5], quantity: 1 },
              { menuItem: INITIAL_MENU_ITEMS[7], quantity: 1 },
              { menuItem: INITIAL_MENU_ITEMS[8], quantity: 1, notes: 'Takeaway packing' },
            ],
            subtotal: 2050.0,
            discount: 205.0,
            tax: 184.5,
            total: 2029.5,
            paymentMethod: 'Card',
            amountReceived: 2029.5,
            changeGiven: 0,
            serviceMode: 'Takeaway',
          },
          {
            id: 'ORD-20260522-194503',
            timestamp: todayEven.toISOString(),
            items: [
              { menuItem: INITIAL_MENU_ITEMS[4], quantity: 1 },
              { menuItem: INITIAL_MENU_ITEMS[2], quantity: 1 },
              { menuItem: INITIAL_MENU_ITEMS[7], quantity: 2, notes: 'Less ice' },
            ],
            subtotal: 5700.0,
            discount: 0,
            tax: 570.0,
            total: 6270.0,
            paymentMethod: 'UPI',
            amountReceived: 6270.0,
            changeGiven: 0,
            serviceMode: 'Dine-In',
          },
        ];

        setOrders(sampleOrders);
        localStorage.setItem('gusto_pos_orders', JSON.stringify(sampleOrders));
        for (const order of sampleOrders) await addOrderToDb(order);
      } else {
        setOrders(ordersList);
        localStorage.setItem('gusto_pos_orders', JSON.stringify(ordersList));
      }
    });

    // Subscribe held orders
    const unsubHolds = subscribeHeldOrders((holdsSnap) => {
      setHeldOrders(holdsSnap);
      localStorage.setItem('gusto_pos_held_orders', JSON.stringify(holdsSnap));
    });

    return () => {
      unsubMenu();
      unsubOrders();
      unsubHolds();
    };
  }, []);

  // ── State helpers ────────────────────────────────────────────────────────
  const saveMenuState = (newMenu: MenuItem[]) => {
    setMenuItems(newMenu);
    localStorage.setItem('gusto_pos_menu', JSON.stringify(newMenu));
  };

  const saveOrdersState = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem('gusto_pos_orders', JSON.stringify(newOrders));
  };

  const saveHeldState = async (newHolds: HoldOrder[]) => {
    setHeldOrders(newHolds);
    localStorage.setItem('gusto_pos_held_orders', JSON.stringify(newHolds));
    try {
      const dbHolds = await getHeldOrdersFromDb();
      for (const h of dbHolds) {
        if (!newHolds.some((nh) => nh.id === h.id)) await deleteHeldOrderFromDb(h.id);
      }
      for (const h of newHolds) await saveHeldOrderToDb(h);
    } catch (e) {
      console.error('Held orders sync error:', e);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddNewOrder = async (
    completedOrder: Order,
    options?: { printSize?: PrintSize; autoPrint?: boolean }
  ) => {
    const updated = [completedOrder, ...orders];
    saveOrdersState(updated);
    await addOrderToDb(completedOrder);
    if (options?.printSize) setReceiptPrintSize(options.printSize);
    setAutoPrintReceipt(options?.autoPrint !== false);
    setSelectedReceiptOrder(completedOrder);
    setIsNewCheckoutReceipt(true);
    setIsReceiptOpen(true);
  };

  const handleResetCatalogToDefault = async () => {
    saveMenuState(INITIAL_MENU_ITEMS);
    for (const item of menuItems) await deleteMenuItemFromDb(item.id);
    for (const item of INITIAL_MENU_ITEMS) await saveMenuItemToDb(item);
  };

  const handleAddItemToMenu = async (item: MenuItem) => {
    const updated = [...menuItems, item];
    saveMenuState(updated);
    await saveMenuItemToDb(item);
  };

  const handleUpdateItemInMenu = async (updatedItem: MenuItem) => {
    const updated = menuItems.map((item) => (item.id === updatedItem.id ? updatedItem : item));
    saveMenuState(updated);
    await saveMenuItemToDb(updatedItem);
  };

  const handleImportMenuItems = async (
    importedItems: MenuItem[]
  ): Promise<{ addedCount: number; updatedCount: number }> => {
    if (importedItems.length === 0) return { addedCount: 0, updatedCount: 0 };
    let addedCount = 0;
    let updatedCount = 0;
    const currentList = [...menuItems];

    for (const item of importedItems) {
      const idx = currentList.findIndex(
        (mi) =>
          (item.id && mi.id.toLowerCase() === item.id.toLowerCase()) ||
          mi.name.toLowerCase() === item.name.toLowerCase()
      );
      if (idx !== -1) {
        const existing = currentList[idx];
        const updatedItem: MenuItem = {
          ...existing,
          name: item.name,
          category: item.category || 'General',
          price: item.price,
          isAvailable: item.isAvailable,
          description: item.description || existing.description,
          imageUrl: item.imageUrl || existing.imageUrl,
        };
        currentList[idx] = updatedItem;
        updatedCount++;
        await saveMenuItemToDb(updatedItem);
      } else {
        const newId = item.id || `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const newItem: MenuItem = {
          id: newId,
          name: item.name,
          category: item.category || 'General',
          price: item.price,
          isAvailable: item.isAvailable,
          description: item.description || '',
          imageUrl: item.imageUrl || '',
        };
        currentList.push(newItem);
        addedCount++;
        await saveMenuItemToDb(newItem);
      }
    }

    saveMenuState(currentList);
    return { addedCount, updatedCount };
  };

  const handleDeleteItemInMenu = async (id: string) => {
    const updated = menuItems.filter((item) => item.id !== id);
    saveMenuState(updated);
    await deleteMenuItemFromDb(id);
  };

  const handleClearSalesLogArchive = async () => {
    const toDelete = [...orders];
    saveOrdersState([]);
    localStorage.removeItem('gusto_pos_orders');
    setSuccessToast('All sales history cleared.');
    await clearAllOrdersFromDb(toDelete);
  };

  const handleImportOrders = async (importedOrders: Order[]) => {
    if (importedOrders.length === 0) return 0;
    const currentList = [...orders];
    for (const order of importedOrders) {
      const idx = currentList.findIndex((o) => o.id === order.id);
      if (idx !== -1) {
        currentList[idx] = order;
      } else {
        currentList.unshift(order);
      }
      await addOrderToDb(order);
    }
    saveOrdersState(currentList);
    return importedOrders.length;
  };

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedConfig: RestaurantConfig = {
      ...restaurantInfo,
      name: editedRestName.trim(),
      address: editedRestAddress.trim(),
      phone: editedRestPhone.trim(),
    };
    setRestaurantInfo(updatedConfig);
    localStorage.setItem('gusto_pos_config', JSON.stringify(updatedConfig));
    setIsConfigOpen(false);
    saveRestaurantConfigToDb(updatedConfig).catch(() => {});
  };

  const handleOpenConfigModal = () => {
    setEditedRestName(restaurantInfo.name);
    setEditedRestAddress(restaurantInfo.address);
    setEditedRestPhone(restaurantInfo.phone);
    setIsConfigOpen(true);
  };

  const triggerReviewReceipt = (pastOrder: Order) => {
    setSelectedReceiptOrder(pastOrder);
    setIsNewCheckoutReceipt(false);
    setIsReceiptOpen(true);
  };

  const handleSignOutUser = () => {
    setCurrentUser(null);
    clearToken();
    localStorage.removeItem('gusto_pos_current_user');
  };

  // ── Auth gate ────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('gusto_pos_current_user', JSON.stringify(user));
          setSuccessToast(`Welcome back, ${user.fullName}! Login successful.`);
        }}
      />
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl">
            <ChefHat className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-slate-900 tracking-tight text-md">
                {restaurantInfo.name}
              </h1>
              <span className="bg-emerald-50 text-emerald-700 font-bold text-[9px] px-2 py-0.5 rounded-sm uppercase">
                {currentUser?.role} Desk
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-light">
              Terminal ID: C03-COLOMBO-P1 • Active Cashier Desk
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap justify-center sm:justify-end gap-3">
          {/* User badge */}
          <div className="flex items-center gap-2 bg-slate-100/40 border border-slate-100 p-1.5 pr-3.5 rounded-xl text-slate-800 text-xs">
            <div
              className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold font-mono text-xs ${
                currentUser.role === 'Admin' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
              }`}
            >
              {currentUser.role === 'Admin' ? '👑' : '🛎️'}
            </div>
            <div className="text-left">
              <div className="font-extrabold max-w-[120px] truncate text-slate-800 leading-3">
                {currentUser.fullName}
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                {currentUser.role} Account
              </span>
            </div>
          </div>

          {/* Clock */}
          <div className="hidden md:flex items-center gap-2 bg-slate-50/70 border border-slate-100 rounded-xl px-3.5 py-1.5 font-mono text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5 text-emerald-500" />
            <span>{systemTime}</span>
          </div>

          {/* Settings */}
          <button
            onClick={() => {
              if (currentUser.role !== 'Admin') {
                setSuccessToast('⚠️ Settings is restricted to Admin managers!');
                return;
              }
              handleOpenConfigModal();
            }}
            className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all cursor-pointer ${
              currentUser.role === 'Admin'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOutUser}
            className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black px-3.5 py-2 rounded-xl active:scale-95 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row relative">

        {/* Sidebar */}
        <aside className="no-print bg-white border-b lg:border-b-0 lg:border-r border-slate-100 lg:w-64 p-2.5 sm:p-4 lg:p-6 flex flex-row lg:flex-col justify-between z-10 gap-3 shrink-0 overflow-x-auto lg:overflow-x-visible scrollbar-none">
          <div className="flex lg:flex-col gap-2 w-full min-w-[480px] sm:min-w-0">
            <span className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
              Operations Desk
            </span>

            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex-1 lg:flex-none justify-center lg:justify-start ${
                activeTab === 'pos'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Calculator className="h-4 w-4 shrink-0" />
              <span>POS Billing Desk</span>
            </button>

            <button
              onClick={() => {
                if (currentUser.role !== 'Admin') {
                  setSuccessToast('⚠️ Menu Management requires Admin privileges!');
                  return;
                }
                setActiveTab('menu');
              }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex-1 lg:flex-none justify-center lg:justify-start ${
                activeTab === 'menu'
                  ? 'bg-slate-900 text-white shadow-md'
                  : currentUser.role === 'Admin'
                  ? 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  : 'bg-transparent text-slate-300 hover:bg-slate-50'
              }`}
            >
              <MenuIcon
                className={`h-4 w-4 shrink-0 ${currentUser.role !== 'Admin' ? 'text-amber-500' : ''}`}
              />
              <span className="flex items-center justify-between gap-1.5 flex-1 text-left">
                <span>Menu Manager</span>
                {currentUser.role !== 'Admin' && (
                  <span className="text-[8px] px-1 bg-amber-500/20 text-amber-500 rounded-sm font-black font-mono shrink-0">
                    LOCK
                  </span>
                )}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tables')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex-1 lg:flex-none justify-center lg:justify-start ${
                activeTab === 'tables'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              <span>Table Floor</span>
            </button>

            <button
              onClick={() => setActiveTab('kitchen')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex-1 lg:flex-none justify-center lg:justify-start ${
                activeTab === 'kitchen'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <ChefHat className="h-4 w-4 shrink-0 text-orange-500" />
              <span>Kitchen (KOT)</span>
            </button>

            {currentUser.role === 'Admin' && (
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex-1 lg:flex-none justify-center lg:justify-start ${
                  activeTab === 'inventory'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Package className="h-4 w-4 shrink-0 text-violet-500" />
                <span>Inventory</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex-1 lg:flex-none justify-center lg:justify-start ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <History className="h-4 w-4 shrink-0" />
              <span>Sales Registers & Charts</span>
            </button>
          </div>

          {/* Sidebar DB panel */}
          <div className="hidden lg:flex flex-col gap-3 bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs text-slate-600 font-normal mt-auto">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Database className="h-3.5 w-3.5 text-emerald-600" />
                <span>Backend Status</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-light leading-relaxed">
              MySQL backend on port 5000. Data syncs on every operation. LocalStorage used as offline fallback.
            </p>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleExportFullOfflineBackup}
                className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 py-2.5 px-1.5 rounded-lg font-bold text-[9px] flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
              >
                <Download className="h-2.5 w-2.5 text-slate-500" />
                <span>Save Backup</span>
              </button>

              <label className="bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-1.5 rounded-lg font-bold text-[9px] flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0">
                <Upload className="h-2.5 w-2.5 text-emerald-400" />
                <span>Restore File</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestoreFullOfflineBackup}
                />
              </label>
            </div>

            <div className="border-t border-slate-200/60 pt-2.5 mt-2 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  fetchDbStatus();
                  setIsDbModalOpen(true);
                }}
                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 py-2 px-1.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-emerald-200"
              >
                <Database className="h-3 w-3 text-emerald-700" />
                <span>MySQL DB & Sync</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-140px)] lg:max-h-[calc(100vh-80px)]">
          {activeTab === 'pos' && (
            <PosBilling
              menuItems={menuItems}
              restaurantInfo={restaurantInfo}
              onAddOrder={handleAddNewOrder}
              onAddOrders={async () => {
                const fresh = await getOrdersFromDb();
                if (fresh.length) saveOrdersState(fresh);
              }}
              heldOrders={heldOrders}
              onUpdateHeldOrders={saveHeldState}
              cashier={currentUser.username}
              preselectedTableId={posTableId}
            />
          )}
          {activeTab === 'tables' && (
            <TableFloor
              selectedTableId={posTableId}
              onSelectTable={(table) => {
                setPosTableId(table.id);
                setActiveTab('pos');
                setSuccessToast(`Table ${table.name} selected for billing.`);
              }}
            />
          )}
          {activeTab === 'kitchen' && <KitchenDisplay />}
          {activeTab === 'inventory' && currentUser.role === 'Admin' && (
            <InventoryManagement menuItems={menuItems} />
          )}
          {activeTab === 'menu' && (
            <MenuManagement
              menuItems={menuItems}
              restaurantInfo={restaurantInfo}
              onAddMenuItem={handleAddItemToMenu}
              onUpdateMenuItem={handleUpdateItemInMenu}
              onDeleteMenuItem={handleDeleteItemInMenu}
              onResetDefaultMenu={handleResetCatalogToDefault}
              onImportMenuItems={handleImportMenuItems}
            />
          )}
          {activeTab === 'history' && (
            <SalesHistory
              orders={orders}
              restaurantInfo={restaurantInfo}
              onReceiptTrigger={triggerReviewReceipt}
              onClearOrderLogs={handleClearSalesLogArchive}
              onImportOrders={handleImportOrders}
              menuItems={menuItems}
            />
          )}
        </main>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setSelectedReceiptOrder(null);
          setIsNewCheckoutReceipt(false);
          setAutoPrintReceipt(false);
        }}
        order={selectedReceiptOrder}
        restaurantInfo={restaurantInfo}
        isCompletedCheckout={isNewCheckoutReceipt}
        initialPrintSize={receiptPrintSize}
        autoPrintOnOpen={isNewCheckoutReceipt && autoPrintReceipt}
      />

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsConfigOpen(false)}
          />
          <form
            onSubmit={handleConfigSubmit}
            className="bg-white rounded-2xl max-w-sm w-full relative z-10 overflow-hidden shadow-2xl animate-in text-slate-800"
          >
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Configure Bistro Header</h3>
                <p className="text-xs text-slate-500 mt-1">Updates header titles & printed invoices</p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:bg-slate-200 hover:text-slate-600 p-1 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Establishment Name</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 px-3 py-2 rounded-xl text-slate-800"
                  value={editedRestName}
                  onChange={(e) => setEditedRestName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Corporate Address</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 px-3 py-2 rounded-xl text-slate-800"
                  value={editedRestAddress}
                  onChange={(e) => setEditedRestAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Contact Hotline</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 px-3 py-2 rounded-xl text-slate-800"
                  value={editedRestPhone}
                  onChange={(e) => setEditedRestPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 py-2.5 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                Apply Parameters
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DB Status / Sync Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsDbModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-lg w-full relative z-10 overflow-hidden shadow-2xl text-slate-800 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-600" />
                  <span>MySQL Backend Integration</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Backend: http://localhost:5000 — Health &amp; Sync Portal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDbModalOpen(false)}
                className="text-slate-400 hover:bg-slate-200 p-1 rounded-full cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Connection status */}
              <div className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border-slate-200/80">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Backend Connection
                  </span>
                  {dbStatus?.connected ? (
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>CONNECTED — MySQL '{dbStatus?.details?.dbName || 'restaurant_pos'}'</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-600 font-extrabold">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      <span>NOT CONNECTED — {dbStatus?.message || 'Server offline'}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Health:{' '}
                    <code className="font-mono bg-slate-200/60 px-1 py-0.5 rounded text-[9px]">
                      http://localhost:5000/api/health
                    </code>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    DB Status:{' '}
                    <code className="font-mono bg-slate-200/60 px-1 py-0.5 rounded text-[9px]">
                      http://localhost:5000/api/db/status
                    </code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchDbStatus}
                  className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 py-1.5 px-3 rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Check Status
                </button>
              </div>

              {/* API Endpoints reference */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-700">API Endpoints</h4>
                <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-[9px] space-y-1">
                  <div><span className="text-emerald-400">GET</span>  /api/health</div>
                  <div><span className="text-emerald-400">GET</span>  /api/db/status</div>
                  <div><span className="text-sky-400">POST</span> /api/auth/login</div>
                  <div><span className="text-sky-400">POST</span> /api/auth/register <span className="text-amber-400">[Admin]</span></div>
                  <div><span className="text-emerald-400">GET</span>  /api/auth/me</div>
                  <div><span className="text-emerald-400">GET</span>  /api/menu</div>
                  <div><span className="text-sky-400">POST</span> /api/menu <span className="text-amber-400">[Admin]</span></div>
                  <div><span className="text-yellow-400">PUT</span>  /api/menu/:id <span className="text-amber-400">[Admin]</span></div>
                  <div><span className="text-rose-400">DEL</span>  /api/menu/:id <span className="text-amber-400">[Admin]</span></div>
                  <div><span className="text-emerald-400">GET</span>  /api/orders</div>
                  <div><span className="text-sky-400">POST</span> /api/orders</div>
                  <div><span className="text-emerald-400">GET</span>  /api/orders/held</div>
                  <div><span className="text-sky-400">POST</span> /api/orders/held</div>
                  <div><span className="text-emerald-400">GET</span>  /api/config</div>
                  <div><span className="text-sky-400">POST</span> /api/config <span className="text-amber-400">[Admin]</span></div>
                  <div><span className="text-sky-400">POST</span> /api/sync</div>
                  <div><span className="text-emerald-400">GET</span>  /api/dashboard/stats</div>
                </div>
              </div>

              {/* Sync */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-700">Sync All Data to MySQL</h4>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3">
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Pushes all current menu items, orders, held orders, and restaurant config to the MySQL backend via <code className="font-mono">/api/sync</code>.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold">
                      Ready: {menuItems.length} items, {orders.length} orders
                    </span>
                    <button
                      type="button"
                      disabled={isSyncing || !dbStatus?.connected}
                      onClick={handleSyncAll}
                      className={`py-2 px-4 rounded-xl font-bold text-[11px] cursor-pointer transition-all flex items-center gap-1.5 text-white ${
                        isSyncing
                          ? 'bg-slate-600 cursor-not-allowed'
                          : dbStatus?.connected
                          ? 'bg-slate-900 hover:bg-slate-800 active:scale-95'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isSyncing ? (
                        <>
                          <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <span>⚡ Sync All POS Data</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsDbModalOpen(false)}
                className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[120] max-w-sm bg-slate-900 text-white py-3 px-4 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-800">
          <div className="p-1.5 bg-emerald-500 rounded-lg text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-xs font-extrabold leading-tight">{successToast}</p>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-slate-400 hover:text-white font-bold ml-auto text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
