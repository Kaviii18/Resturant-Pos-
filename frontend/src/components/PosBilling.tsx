import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Pause, 
  CreditCard, 
  ChevronRight, 
  FileText, 
  Grid, 
  Clock, 
  DollarSign, 
  Coffee, 
  AlertCircle,
  ChefHat,
  Users,
} from 'lucide-react';
import { MenuItem, CartItem, Order, HoldOrder, RestaurantConfig, DiningTable, PrintSize } from '../types';
import { getDiningTables, fireKitchenTicket } from '../lib/api';
import SplitBillModal from './SplitBillModal';

interface PosBillingProps {
  menuItems: MenuItem[];
  restaurantInfo: RestaurantConfig;
  onAddOrder: (order: Order, options?: { printSize?: PrintSize; autoPrint?: boolean }) => void;
  onAddOrders?: (orders: Order[]) => void;
  heldOrders: HoldOrder[];
  onUpdateHeldOrders: (holds: HoldOrder[]) => void;
  cashier?: string;
  preselectedTableId?: string;
}

export default function PosBilling({
  menuItems,
  restaurantInfo,
  onAddOrder,
  onAddOrders,
  heldOrders,
  onUpdateHeldOrders,
  cashier,
  preselectedTableId,
}: PosBillingProps) {
  // POS States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mobileActiveView, setMobileActiveView] = useState<'menu' | 'cart'>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Custom Notes state for particular cart indices
  const [editingNotesIdx, setEditingNotesIdx] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');

  // Discount/Promotion state
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Hold Order Modal states
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdCustomerName, setHoldCustomerName] = useState('');
  const [holdNotes, setHoldNotes] = useState('');

  // Checkout overlay/drawer states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<Order['paymentMethod']>('Cash');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Dinning and Takeaway Service Mode state with local persistence
  const [serviceMode, setServiceMode] = useState<'Dine-In' | 'Takeaway'>(() => {
    return (localStorage.getItem('gusto_pos_service_mode') as 'Dine-In' | 'Takeaway') || 'Dine-In';
  });
  const [diningTables, setDiningTables] = useState<DiningTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>(
    () => preselectedTableId || localStorage.getItem('gusto_pos_table_id') || 'tbl_01'
  );
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [kotSending, setKotSending] = useState(false);
  const [printSize, setPrintSize] = useState<PrintSize>(
    () => (localStorage.getItem('gusto_pos_print_size') as PrintSize) || '80mm'
  );
  const [autoPrintBill, setAutoPrintBill] = useState(
    () => localStorage.getItem('gusto_pos_auto_print') !== 'false'
  );

  const selectedTable = diningTables.find((t) => t.id === selectedTableId);

  useEffect(() => {
    getDiningTables().then(setDiningTables).catch(() => setDiningTables([]));
  }, []);

  useEffect(() => {
    if (preselectedTableId) setSelectedTableId(preselectedTableId);
  }, [preselectedTableId]);

  // Available categories list computed from menu items
  const categories = useMemo(() => {
    const list = new Set(menuItems.map(item => item.category));
    return ['All', ...Array.from(list)];
  }, [menuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      if (!item.isAvailable) return false;
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart Adjustments
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.menuItem.id === item.id);
      if (existing) {
        return prev.map(cartItem => 
          cartItem.menuItem.id === item.id 
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { menuItem: item, quantity: 1, notes: "" }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(cartItem => cartItem.menuItem.id !== itemId));
  };

  const updateQuantity = (itemId: string, increment: number) => {
    setCart(prev => {
      return prev.map(cartItem => {
        if (cartItem.menuItem.id === itemId) {
          const nextQty = cartItem.quantity + increment;
          return nextQty > 0 ? { ...cartItem, quantity: nextQty } : cartItem;
        }
        return cartItem;
      }).filter(c => c.quantity > 0);
    });
  };

  const saveCartItemNotes = (idx: number) => {
    setCart(prev => {
      const copy = [...prev];
      copy[idx].notes = noteText;
      return copy;
    });
    setEditingNotesIdx(null);
    setNoteText('');
  };

  const triggerAddNotes = (idx: number, currentNote: string) => {
    setEditingNotesIdx(idx);
    setNoteText(currentNote || '');
  };

  // Pricing calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const taxAmount = useMemo(() => {
    return (subtotal - discountAmount) * restaurantInfo.taxRate;
  }, [subtotal, discountAmount, restaurantInfo.taxRate]);

  const grandTotal = useMemo(() => {
    const total = subtotal - discountAmount + taxAmount;
    return total > 0 ? total : 0;
  }, [subtotal, discountAmount, taxAmount]);

  // Live Change Calculation for Cash Drawer
  const changeDue = useMemo(() => {
    const cash = parseFloat(cashReceived);
    if (isNaN(cash) || cash < grandTotal) return 0;
    return cash - grandTotal;
  }, [cashReceived, grandTotal]);

  // Hold current order state
  const handleHoldOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !holdCustomerName.trim()) return;

    // Append table info to customer identifier if Dining
    const tableLabel = selectedTable?.name || selectedTableId;
    const fullCustomerName = holdCustomerName.trim() + 
      (serviceMode === 'Dine-In' ? ` (${tableLabel})` : ' (Takeaway)');

    const newHold: HoldOrder = {
      id: `HLD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customerName: fullCustomerName,
      items: [...cart],
      notes: holdNotes.trim(),
      serviceMode,
      tableId: serviceMode === 'Dine-In' ? selectedTableId : undefined,
    };

    onUpdateHeldOrders([newHold, ...heldOrders]);
    setCart([]);
    setHoldCustomerName('');
    setHoldNotes('');
    setIsHoldModalOpen(false);
  };

  // Resume hold order back into Cart
  const handleResumeHold = (hold: HoldOrder) => {
    // We add held items to active cart
    setCart(hold.items);
    if (hold.serviceMode) {
      setServiceMode(hold.serviceMode);
    }
    // Remove the hold card from the holds bin
    onUpdateHeldOrders(heldOrders.filter(h => h.id !== hold.id));
  };

  const handleCheckoutPaymentConfirm = () => {
    if (cart.length === 0) return;

    const cashVal = parseFloat(cashReceived);
    if (paymentMethod === 'Cash' && (isNaN(cashVal) || cashVal < grandTotal)) {
      alert("Amount received is less than total price!");
      return;
    }

    const orderId = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${new Date().toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '')}`;
    
    const finalizedOrder: Order = {
      id: orderId,
      timestamp: new Date().toISOString(),
      items: [...cart],
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: grandTotal,
      paymentMethod,
      amountReceived: paymentMethod === 'Cash' ? cashVal : grandTotal,
      changeGiven: paymentMethod === 'Cash' ? changeDue : 0,
      serviceMode,
      tableId: serviceMode === 'Dine-In' ? selectedTableId : undefined,
      cashier,
    };

    localStorage.setItem('gusto_pos_print_size', printSize);
    localStorage.setItem('gusto_pos_auto_print', String(autoPrintBill));
    onAddOrder(finalizedOrder, { printSize, autoPrint: autoPrintBill });

    // Reset workflow
    setCart([]);
    setIsCheckoutOpen(false);
    setCashReceived('');
    setDiscountPercent(0);
  };

  // Fast Cash hotkey presets
  const handleCashPreset = (amount: number) => {
    setCashReceived(amount.toString());
  };

  const handleFireToKitchen = async () => {
    if (cart.length === 0) return;
    setKotSending(true);
    try {
      await fireKitchenTicket({
        tableId: serviceMode === 'Dine-In' ? selectedTableId : undefined,
        tableName: selectedTable?.name,
        serviceMode,
        items: cart,
        cashier,
      });
      alert('Order sent to kitchen (KOT fired).');
    } catch (err: any) {
      alert(err.message || 'Failed to fire KOT');
    } finally {
      setKotSending(false);
    }
  };

  const handleSplitComplete = async (orderIds: string[]) => {
    setCart([]);
    setIsCheckoutOpen(false);
    setIsSplitModalOpen(false);
    setCashReceived('');
    setDiscountPercent(0);
    alert(`Split bill settled — ${orderIds.length} orders created.`);
    if (onAddOrders) {
      onAddOrders(
        orderIds.map((id) => ({
          id,
          timestamp: new Date().toISOString(),
          items: [],
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          paymentMethod: 'Cash',
          serviceMode,
          tableId: selectedTableId,
        }))
      );
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-6 h-full items-stretch relative">
      
      {/* Mobile View Toggle Segment */}
      <div className="lg:hidden flex bg-slate-200/60 border border-slate-300/40 p-1 rounded-2xl gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setMobileActiveView('menu')}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileActiveView === 'menu'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🍽️ Catalog Menu ({filteredItems.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveView('cart')}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all text-center flex items-center justify-center gap-1.5 relative cursor-pointer ${
            mobileActiveView === 'cart'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🛒 Active Basket ({cart.reduce((sum, i) => sum + i.quantity, 0)})
          {cart.length > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 absolute top-2 right-3 inline-block animate-ping" />
          )}
        </button>
      </div>

      {/* Mobile Floating Sticky Checkout Ribbon */}
      {cart.length > 0 && mobileActiveView === 'menu' && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 px-5 rounded-2xl shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200 w-[92%] max-w-sm justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-700/80 h-6 w-6 rounded-full flex items-center justify-center text-white font-extrabold text-[11px] font-mono shrink-0">
              {cart.reduce((sum, i) => sum + i.quantity, 0)}
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider leading-none">Unsettled Basket</p>
              <p className="text-xs font-black text-white mt-0.5 whitespace-nowrap">
                Total: {restaurantInfo.currencySymbol}{grandTotal.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileActiveView('cart')}
            className="bg-slate-950 hover:bg-slate-900 text-white font-bold py-1.5 px-3.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 shrink-0"
          >
            Checkout Now →
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 h-full items-stretch flex-1 min-h-0">
        
        {/* LEFT COMPONENT - Menus Display Grid */}
        <div className={`flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm ${
          mobileActiveView === 'menu' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Upper Search Bar & Metric Title strip */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">POS Billing Terminal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Quick selection & custom checkout counters</p>
            </div>
            
            <div className="relative w-full md:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search dishes, drinks, appetizers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Categories Tab Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 border-b border-slate-100 scrollbar-none">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === category
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto max-h-[58vh] lg:max-h-[64vh] pr-2 scrollbar-none">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertCircle className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">No matching menu item found.</p>
                <p className="text-xs text-slate-400 mt-1">Try another keyword query or switch filters!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="group relative flex flex-col bg-slate-50 hover:bg-white border hover:border-emerald-200 rounded-xl overflow-hidden cursor-pointer active:scale-[0.98] hover:shadow-md transition-all duration-200"
                  >
                    {/* Photo representation */}
                    <div className="h-32 w-full overflow-hidden bg-slate-100 relative">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                          <Coffee className="h-8 w-8" />
                        </div>
                      )}
                      <span className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-white/95 text-slate-800 shadow-sm">
                        {item.category}
                      </span>
                    </div>

                    {/* Information block */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-800 text-sm tracking-tight group-hover:text-emerald-700 transition-colors">
                          {item.name}
                        </h4>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100/60">
                        <span className="font-bold text-slate-900 text-sm">
                          {restaurantInfo.currencySymbol}
                          {item.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Add <Plus className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COMPONENT - Active Cart / Ordering Desk */}
        <div className={`w-full lg:w-[400px] flex flex-col bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden shrink-0 ${
          mobileActiveView === 'cart' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Subtle decorative glow accents to make UI feel very premium */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-emerald-400" />
            <h3 className="font-bold tracking-tight text-white text-md">Active Basket</h3>
          </div>
          <span className="bg-emerald-500/25 text-emerald-400 font-bold px-2.5 py-0.5 rounded-full text-xs">
            {cart.reduce((sum, i) => sum + i.quantity, 0)} Items
          </span>
        </div>

        {/* Held Orders quick retrieval widget */}
        {heldOrders.length > 0 && (
          <div className="mb-4 bg-slate-800 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-2">
              Paused Carts List ({heldOrders.length})
            </span>
            <div className="space-y-1.5 max-h-24 overflow-y-auto">
              {heldOrders.map((hold) => (
                <div key={hold.id} className="flex justify-between items-center bg-slate-900 p-2 rounded-lg text-xs">
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-200">{hold.customerName}</span>
                    <span className="text-[10px] text-slate-400 block">x{hold.items.length} items • {new Date(hold.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <button 
                    onClick={() => handleResumeHold(hold)}
                    className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 py-1 rounded-sm text-[10px] transition-all"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Option Buttons Group */}
        <div className="mb-4 space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Service Choice
          </span>
          <div className="bg-slate-800 rounded-xl p-1 flex gap-1 border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setServiceMode('Dine-In');
                localStorage.setItem('gusto_pos_service_mode', 'Dine-In');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                serviceMode === 'Dine-In'
                  ? 'bg-slate-900 text-white shadow-md border border-slate-700/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
              }`}
            >
              🍽️ Dine-In
            </button>
            <button
              type="button"
              onClick={() => {
                setServiceMode('Takeaway');
                localStorage.setItem('gusto_pos_service_mode', 'Takeaway');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                serviceMode === 'Takeaway'
                  ? 'bg-slate-900 text-white shadow-md border border-slate-700/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
              }`}
            >
              🛍️ Takeaway
            </button>
          </div>

          {/* Table Selector or Takeaway Tag */}
          {serviceMode === 'Dine-In' ? (
            <div className="bg-slate-850/80 p-2.5 rounded-xl border border-slate-800/60 flex justify-between items-center text-xs gap-2">
              <span className="text-slate-350 font-medium shrink-0">Dining Table:</span>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  setSelectedTableId(e.target.value);
                  localStorage.setItem('gusto_pos_table_id', e.target.value);
                }}
                className="bg-slate-900 text-white text-xs border border-slate-750 rounded-lg px-2 py-1 focus:outline-hidden font-semibold cursor-pointer flex-1"
              >
                {(diningTables.length > 0 ? diningTables : [{ id: 'tbl_01', name: 'Table 1', zone: '', capacity: 4, status: 'available' as const }]).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.status !== 'available' ? `(${t.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-emerald-950/20 text-emerald-450 p-2.5 rounded-xl border border-emerald-900/30 text-center text-xs font-semibold">
              🛍️ Dispatch Direct Takeaway Order
            </div>
          )}
        </div>

        {/* Cart Itemized List */}
        <div className="flex-1 overflow-y-auto max-h-[35vh] lg:max-h-[40vh] space-y-3 mb-4 pr-1 scrollbar-thin">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center py-12 text-slate-400">
              <Grid className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-xs">Your basket is currently empty.</p>
              <p className="text-[10px] text-slate-500 mt-1">Click dishes in the item menu grid to add</p>
            </div>
          ) : (
            cart.map((cartItem, idx) => (
              <div key={cartItem.menuItem.id} className="bg-slate-800/60 hover:bg-slate-800 rounded-xl p-3 border border-slate-800/80 transition-all">
                
                {/* Name, delete, and quantity row */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-sm text-slate-200 truncate">{cartItem.menuItem.name}</h5>
                    <p className="text-xs text-emerald-400 font-bold mt-0.5">
                      {restaurantInfo.currencySymbol}
                      {cartItem.menuItem.price.toFixed(2)} each
                    </p>
                  </div>
                  <button 
                    onClick={() => removeFromCart(cartItem.menuItem.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Notes Display */}
                {cartItem.notes ? (
                  <div className="mt-1.5 flex justify-between items-center text-[11px] bg-slate-900/40 p-1 rounded-md px-2 text-amber-400 italic">
                    <span className="truncate pr-1">* {cartItem.notes}</span>
                    <button 
                      onClick={() => triggerAddNotes(idx, cartItem.notes || '')}
                      className="text-[10px] underline hover:text-white shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => triggerAddNotes(idx, '')}
                    className="mt-1.5 text-[10px] text-slate-400 hover:text-amber-400 underline"
                  >
                    + Add notes/instructions
                  </button>
                )}

                {/* Inline Editing for notes */}
                {editingNotesIdx === idx && (
                  <div className="mt-2 flex gap-2">
                    <input 
                      type="text"
                      className="flex-1 bg-slate-900 text-xs px-2 py-1 rounded-md border border-slate-700 text-white focus:outline-hidden"
                      placeholder="e.g. no onion, extra sauce"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <button 
                      onClick={() => saveCartItemNotes(idx)}
                      className="bg-emerald-600 text-[11px] font-bold px-2 rounded-md hover:bg-emerald-500"
                    >
                      OK
                    </button>
                  </div>
                )}

                {/* Counter row */}
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/45 text-xs">
                  <span className="text-slate-400">Total: {restaurantInfo.currencySymbol}{(cartItem.menuItem.price * cartItem.quantity).toFixed(2)}</span>
                  <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-850">
                    <button 
                      onClick={() => updateQuantity(cartItem.menuItem.id, -1)}
                      className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-all"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2.5 font-bold text-white text-center min-w-[20px]">{cartItem.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(cartItem.menuItem.id, 1)}
                      className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-all"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

        {/* Promotion/Discount Selector row */}
        {cart.length > 0 && (
          <div className="mb-4 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Apply Promo Discount:
            </span>
            <select 
              value={discountPercent} 
              onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
              className="bg-slate-900 text-white text-xs border border-slate-700 rounded-lg px-2 py-1 focus:outline-hidden"
            >
              <option value="0">0% Discount</option>
              <option value="5">5% Off</option>
              <option value="10">10% Off</option>
              <option value="15">15% Off</option>
              <option value="20">20% Off</option>
            </select>
          </div>
        )}

        {/* Pricing Summary Blocks */}
        <div className="space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-200">
              {restaurantInfo.currencySymbol}
              {subtotal.toFixed(2)}
            </span>
          </div>

          {discountPercent > 0 && (
            <div className="flex justify-between text-emerald-400 font-medium">
              <span>Discount ({discountPercent}%):</span>
              <span>
                -{restaurantInfo.currencySymbol}
                {discountAmount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span>GST / Tax (10%):</span>
            <span className="font-semibold text-slate-200">
              {restaurantInfo.currencySymbol}
              {taxAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800/50">
            <span>GRAND TOTAL:</span>
            <span className="text-emerald-400 text-md">
              {restaurantInfo.currencySymbol}
              {grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Kitchen + Split actions */}
        {cart.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              disabled={kotSending}
              onClick={handleFireToKitchen}
              className="flex items-center justify-center gap-1 bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-xl font-bold text-[10px] disabled:opacity-50"
            >
              <ChefHat className="h-3.5 w-3.5" />
              {kotSending ? 'Sending...' : 'Send to Kitchen'}
            </button>
            <button
              type="button"
              onClick={() => setIsSplitModalOpen(true)}
              className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-bold text-[10px]"
            >
              <Users className="h-3.5 w-3.5" />
              Split Bill
            </button>
          </div>
        )}

        {/* Checkout Trigger Actions */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button
            disabled={cart.length === 0}
            onClick={() => setIsHoldModalOpen(true)}
            className="flex items-center justify-center gap-1 bg-slate-800 border border-slate-700 hover:bg-slate-755 text-white py-3 rounded-xl font-semibold text-xs active:scale-95 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Hold Current Order"
          >
            <Pause className="h-3.5 w-3.5" />
            Hold
          </button>
          
          <button
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
            className="col-span-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl text-xs shadow-lg shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer text-white disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <CreditCard className="h-4 w-4" />
            Checkout & Pay
          </button>
        </div>

      </div>

    </div>

      {/* PAUSE / HOLD BASKET MODAL */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHoldModalOpen(false)} />
          <form 
            onSubmit={handleHoldOrderSubmit} 
            className="bg-white rounded-2xl max-w-sm w-full relative z-10 overflow-hidden shadow-2xl animate-in font-sans"
          >
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">Hold Current Cart</h3>
              <p className="text-xs text-slate-500 mt-1">Saves order items in drafts list for quick query later.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Customer Identifier / Table#</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Table 4 / Sarah Conner"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-amber-500"
                  value={holdCustomerName}
                  onChange={(e) => setHoldCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Hold Notes (Optional)</label>
                <textarea 
                  placeholder="e.g. waiting for dessert ordering approval"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-amber-500 h-16 resize-none"
                  value={holdNotes}
                  onChange={(e) => setHoldNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button 
                type="button" 
                onClick={() => setIsHoldModalOpen(false)}
                className="flex-1 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 py-2.5 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl text-xs font-bold"
              >
                Confirm Hold
              </button>
            </div>
          </form>
        </div>
      )}

      <SplitBillModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        cart={cart}
        restaurantInfo={restaurantInfo}
        serviceMode={serviceMode}
        tableId={serviceMode === 'Dine-In' ? selectedTableId : undefined}
        discountPercent={discountPercent}
        cashier={cashier}
        onSplitComplete={handleSplitComplete}
      />

      {/* CHECKOUT PROCESS DRAWER/POPUP */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
          <div className="bg-white rounded-2xl max-w-md w-full relative z-10 overflow-hidden shadow-2xl animate-in fade-in-80 duration-200 font-sans text-slate-800">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Billing Payment Center</h3>
                <p className="text-xs text-slate-500 mt-0.5">Finalize transaction and compute balance cash due</p>
              </div>
              <span className="bg-emerald-50 text-emerald-700 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                Total: {restaurantInfo.currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>

            <div className="p-6 space-y-4">

              {/* Print size for silent backend print */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Print Bill Size (silent)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['58mm', '80mm', 'A4'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPrintSize(size)}
                      className={`py-2 rounded-xl text-[10px] font-bold border ${
                        printSize === size
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {size === 'A4' ? 'A4 Invoice' : `${size} Roll`}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrintBill}
                    onChange={(e) => setAutoPrintBill(e.target.checked)}
                    className="rounded"
                  />
                  Auto-print bill after payment (no browser dialog)
                </label>
              </div>
              
              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Select Settlement Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'Card', 'UPI', 'Mobile Wallet'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        if (method !== 'Cash') setCashReceived('');
                      }}
                      className={`px-4 py-3 border rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                        paymentMethod === method
                          ? "border-emerald-500 bg-emerald-55/10 text-emerald-800 font-bold"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span>
                        {method === 'Cash' && '💵 '}
                        {method === 'Card' && '💳 '}
                        {method === 'UPI' && '📱 '}
                        {method === 'Mobile Wallet' && '👜 '}
                        {method}
                      </span>
                      {paymentMethod === method && <ChevronRight className="h-3 w-3 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash counter controls */}
              {paymentMethod === 'Cash' && (
                <div className="space-y-3 bg-slate-55/10 p-4 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">Cash Deposited by Customer ({restaurantInfo.currencySymbol})</label>
                    <span className="text-[10px] text-slate-400">Exact is {restaurantInfo.currencySymbol}{grandTotal.toFixed(2)}</span>
                  </div>
                  
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-slate-900 text-sm font-semibold focus:outline-hidden focus:border-emerald-500 text-center"
                  />

                  {/* Cash Presets */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      Math.ceil(grandTotal),
                      Math.ceil(grandTotal / 5) * 5,
                      Math.ceil(grandTotal / 10) * 10,
                      Math.ceil(grandTotal / 10) * 10 + 10,
                      20, 50, 100
                    ]
                      .filter((val, i, arr) => val >= grandTotal && arr.indexOf(val) === i)
                      .slice(0, 4)
                      .map((amount) => (
                        <button
                          key={amount}
                          onClick={() => handleCashPreset(amount)}
                          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 text-center text-xs font-semibold active:scale-95 transition-all"
                        >
                          {restaurantInfo.currencySymbol}{amount}
                        </button>
                      ))}
                    <button
                      onClick={() => handleCashPreset(grandTotal)}
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-1 px-1.5 text-center text-xs font-bold active:scale-95 transition-all"
                    >
                      Exact
                    </button>
                  </div>

                  {/* Change output drawer */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-150 text-xs mt-1">
                    <span className="text-slate-500 font-semibold">Change Balance Due:</span>
                    <span className={`font-mono font-bold text-sm ${changeDue > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                      {restaurantInfo.currencySymbol}
                      {changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Order items overview minified */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Shopping Items Check ({cart.length})
                </span>
                <div className="space-y-1 text-xs">
                  {cart.map((cartItem) => (
                    <div key={cartItem.menuItem.id} className="flex justify-between text-slate-600">
                      <span className="truncate max-w-[70%]">{cartItem.menuItem.name} x{cartItem.quantity}</span>
                      <span>{restaurantInfo.currencySymbol}{(cartItem.menuItem.price * cartItem.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-105 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 min-w-[100px] bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 py-3 rounded-xl text-xs font-semibold transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setIsSplitModalOpen(true);
                }}
                className="flex-1 min-w-[100px] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-bold flex justify-center items-center gap-1"
              >
                <Users className="h-4 w-4" />
                Split Bill
              </button>
              <button
                type="button"
                onClick={handleCheckoutPaymentConfirm}
                className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-bold shadow-lg flex justify-center items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                Settle & Print
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
