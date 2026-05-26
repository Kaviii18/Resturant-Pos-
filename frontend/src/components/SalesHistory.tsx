import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, 
  BadgeDollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Search, 
  FileText, 
  HelpCircle,
  Clock,
  ExternalLink,
  DollarSign,
  FileSpreadsheet,
  Download,
  Upload
} from 'lucide-react';
import { Order, MenuItem, RestaurantConfig } from '../types';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface SalesHistoryProps {
  orders: Order[];
  restaurantInfo: RestaurantConfig;
  onReceiptTrigger: (order: Order) => void;
  onClearOrderLogs: () => void;
  onImportOrders: (importedOrders: Order[]) => Promise<number>;
  menuItems: MenuItem[];
}

export default function SalesHistory({
  orders,
  restaurantInfo,
  onReceiptTrigger,
  onClearOrderLogs,
  onImportOrders,
  menuItems,
}: SalesHistoryProps) {
  const [searchLogId, setSearchLogId] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('All');

  // 1. Calculate main metric card figures
  const performanceStats = useMemo(() => {
    if (orders.length === 0) {
      return { totalRevenue: 0, orderCount: 0, averageTicketSize: 0 };
    }
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;
    const averageTicketSize = totalRevenue / orderCount;

    return { totalRevenue, orderCount, averageTicketSize };
  }, [orders]);

  // 2. Filter finished sales history logs
  const filteredLogs = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = o.id.toLowerCase().includes(searchLogId.toLowerCase()) ||
                            o.items.some(item => item.menuItem.name.toLowerCase().includes(searchLogId.toLowerCase()));
      const matchesMethod = paymentMethodFilter === 'All' || o.paymentMethod === paymentMethodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [orders, searchLogId, paymentMethodFilter]);

  // 3. Recharts Area Chart Data - Chronological Hourly Revenue Distribution (e.g. 08:00 to 22:00)
  const hourlyRevenueChartData = useMemo(() => {
    // Standard business operating hours
    const hoursMap: Record<string, number> = {
      '08:00': 0, '10:00': 0, '12:00': 0, '14:00': 0, '16:00': 0, '18:00': 0, '20:00': 0, '22:00': 0
    };

    orders.forEach(order => {
      const date = new Date(order.timestamp);
      const hour = date.getHours();
      
      // Bucket into neat bins
      if (hour < 10) hoursMap['08:00'] += order.total;
      else if (hour < 12) hoursMap['10:00'] += order.total;
      else if (hour < 14) hoursMap['12:00'] += order.total;
      else if (hour < 16) hoursMap['14:00'] += order.total;
      else if (hour < 18) hoursMap['16:00'] += order.total;
      else if (hour < 20) hoursMap['18:00'] += order.total;
      else if (hour < 22) hoursMap['20:00'] += order.total;
      else hoursMap['22:00'] += order.total;
    });

    return Object.entries(hoursMap).map(([hourString, value]) => ({
      hour: hourString,
      Revenue: parseFloat(value.toFixed(2))
    }));
  }, [orders]);

  // 4. Recharts Bar Chart Data - Sales distribution across categories
  const categorySalesChartData = useMemo(() => {
    const categoryMap: Record<string, number> = {};

    orders.forEach(order => {
      order.items.forEach(cartItem => {
        const cat = cartItem.menuItem.category;
        const totalCostOfLine = cartItem.menuItem.price * cartItem.quantity;
        categoryMap[cat] = (categoryMap[cat] || 0) + totalCostOfLine;
      });
    });

    return Object.entries(categoryMap).map(([categoryName, score]) => ({
      Category: categoryName,
      Sales: parseFloat(score.toFixed(2))
    }));
  }, [orders]);

  const handleExportCSV = () => {
    if (orders.length === 0) return;
    
    // Header Row with currency units
    const headers = [
      "Receipt ID",
      "Timestamp",
      "Service Mode",
      "Total Items Qty",
      "Items Breakdown",
      `Subtotal (${restaurantInfo.currency})`,
      `Tax (${restaurantInfo.currency})`,
      `Discount (${restaurantInfo.currency})`,
      `Grand Total (${restaurantInfo.currency})`,
      "Payment Method"
    ];

    const rows = orders.map(order => {
      const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const itemsBreakdown = order.items
        .map(item => `${item.menuItem.name} (x${item.quantity})` + (item.notes ? ` [Notes: ${item.notes}]` : ''))
        .join('; ');

      return [
        order.id,
        new Date(order.timestamp).toLocaleString(),
        order.serviceMode,
        itemsCount.toString(),
        itemsBreakdown,
        order.subtotal.toFixed(2),
        order.tax.toFixed(2),
        order.discount.toFixed(2),
        order.total.toFixed(2),
        order.paymentMethod
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          const cleanText = String(val).replace(/"/g, '""');
          return `"${cleanText}"`;
        }).join(',')
      )
    ].join('\n');

    // Add UTF-8 BOM so Excel opens with correct encoding automatically
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gusto_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [importReport, setImportReport] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  // Safe helper to tokenise CSV rows considering double quotes correctly conforme with RFC 4180
  const parseCSVRow = (rowText: string): string[] => {
    const result: string[] = [];
    let currentWord = '';
    let insideQuotes = false;
    for (let i = 0; i < rowText.length; i++) {
      const char = rowText[i];
      if (char === '"') {
        if (insideQuotes && rowText[i + 1] === '"') {
          currentWord += '"';
          i++; // skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(currentWord.trim());
        currentWord = '';
      } else {
        currentWord += char;
      }
    }
    result.push(currentWord.trim());
    return result;
  };

  const handleImportCSVSales = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const rawLines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (rawLines.length === 0) {
          setImportReport({
            isOpen: true,
            title: "Empty Spreadsheet",
            message: "The uploaded transaction CSV file does not contain any valid data rows."
          });
          return;
        }

        const parsedLines = rawLines.map(line => parseCSVRow(line));
        const firstRow = parsedLines[0];
        const normalizedHeaders = firstRow.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        // Normalised searches
        const idIndex = normalizedHeaders.findIndex(h => h.includes('id') || h.includes('receipt') || h.includes('ticket'));
        const timestampIndex = normalizedHeaders.findIndex(h => h.includes('time') || h.includes('date') || h.includes('stamp'));
        const serviceModeIndex = normalizedHeaders.findIndex(h => h.includes('service') || h.includes('mode') || h.includes('dine'));
        const itemsBreakdownIndex = normalizedHeaders.findIndex(h => h.includes('breakdown') || h.includes('item') || h.includes('content') || h.includes('food'));
        const subtotalIndex = normalizedHeaders.findIndex(h => h.includes('subtotal') || h.includes('net'));
        const taxIndex = normalizedHeaders.findIndex(h => h.includes('tax') || h.includes('vat') || h.includes('gst'));
        const discountIndex = normalizedHeaders.findIndex(h => h.includes('discount') || h.includes('promo'));
        const totalIndex = normalizedHeaders.findIndex(h => h.includes('total') || h.includes('grand') || h.includes('paid'));
        const paymentMethodIndex = normalizedHeaders.findIndex(h => h.includes('payment') || h.includes('method') || h.includes('pay'));

        if (totalIndex === -1) {
          setImportReport({
            isOpen: true,
            title: "Columns Not Resolved",
            message: "The uploaded spreadsheet must have at least a 'Grand Total' or 'Total' column header to map transactions."
          });
          return;
        }

        const parsedOrders: Order[] = [];

        for (let i = 1; i < parsedLines.length; i++) {
          const row = parsedLines[i];
          if (row.length < totalIndex + 1) continue;

          // 1. Order ID fallback
          const rawId = idIndex !== -1 ? row[idIndex] : `ORD-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${Math.floor(100 + Math.random() * 900)}`;
          
          // 2. Timestamp fallback
          let timestamp = new Date().toISOString();
          if (timestampIndex !== -1 && row[timestampIndex]) {
            const rawTime = row[timestampIndex];
            const testDate = new Date(rawTime);
            if (!isNaN(testDate.getTime())) {
              timestamp = testDate.toISOString();
            }
          }

          // 3. Service Mode
          let serviceMode: 'Dine-In' | 'Takeaway' = 'Dine-In';
          if (serviceModeIndex !== -1 && row[serviceModeIndex]) {
            const rawMode = row[serviceModeIndex].toLowerCase();
            if (rawMode.includes('take') || rawMode.includes('away') || rawMode.includes('out') || rawMode.includes('pack')) {
              serviceMode = 'Takeaway';
            }
          }

          // 4. Mathematical details
          const totalVal = parseFloat(row[totalIndex].replace(/[^0-9.]/g, '')) || 0;
          const subtotalVal = subtotalIndex !== -1 ? (parseFloat(row[subtotalIndex].replace(/[^0-9.]/g, '')) || totalVal) : totalVal;
          const taxVal = taxIndex !== -1 ? (parseFloat(row[taxIndex].replace(/[^0-9.]/g, '')) || 0) : 0;
          const discountVal = discountIndex !== -1 ? (parseFloat(row[discountIndex].replace(/[^0-9.]/g, '')) || 0) : 0;

          // 5. Payment settlement method
          let paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Mobile Wallet' = 'Cash';
          if (paymentMethodIndex !== -1 && row[paymentMethodIndex]) {
            const pmText = row[paymentMethodIndex].toLowerCase();
            if (pmText.includes('card') || pmText.includes('visa') || pmText.includes('master') || pmText.includes('amex') || pmText.includes('swipe')) {
              paymentMethod = 'Card';
            } else if (pmText.includes('upi') || pmText.includes('gpay') || pmText.includes('phonepe') || pmText.includes('qr')) {
              paymentMethod = 'UPI';
            } else if (pmText.includes('wallet') || pmText.includes('mob') || pmText.includes('paytm') || pmText.includes('cashless')) {
              paymentMethod = 'Mobile Wallet';
            }
          }

          // 6. Detailed item breakdown parsing
          const cartItems: any[] = [];
          if (itemsBreakdownIndex !== -1 && row[itemsBreakdownIndex]) {
            const rawItemsStr = row[itemsBreakdownIndex];
            const itemTokens = rawItemsStr.split(';');

            for (const token of itemTokens) {
              const cleanToken = token.trim();
              if (!cleanToken) continue;

              // Extract Quantity info
              let quantity = 1;
              const qtyMatch = cleanToken.match(/\(x\s*(\d+)\)/i) || cleanToken.match(/x\s*(\d+)/i) || cleanToken.match(/\*\s*(\d+)/i);
              if (qtyMatch) {
                quantity = parseInt(qtyMatch[1], 10) || 1;
              }

              // Extract optional notes
              let notes = '';
              const notesMatch = cleanToken.match(/\[Notes:\s*([^\]]+)\]/i) || cleanToken.match(/\[([^\]]+)\]/);
              if (notesMatch) {
                notes = notesMatch[1].trim();
              }

              // Strip out tags to isolate the raw dish name
              let rawDishName = cleanToken;
              if (qtyMatch) {
                rawDishName = rawDishName.replace(qtyMatch[0], '');
              }
              if (notesMatch) {
                rawDishName = rawDishName.replace(notesMatch[0], '');
              }
              rawDishName = rawDishName.trim().replace(/^-\s*/, '').replace(/\s*-\s*$/, '');

              // Try matching against current active menu
              let matchedDish = menuItems.find(mi => mi.name.toLowerCase() === rawDishName.toLowerCase());
              if (!matchedDish) {
                matchedDish = {
                  id: 'stub_' + rawDishName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                  name: rawDishName,
                  price: 0,
                  category: 'Imported Record',
                  isAvailable: true
                };
              }

              cartItems.push({
                menuItem: matchedDish,
                quantity,
                notes: notes || undefined
              });
            }
          }

          // Fallback if no breakdown present
          if (cartItems.length === 0) {
            cartItems.push({
              menuItem: menuItems[0] || {
                id: 'stub_unknown',
                name: 'Standard Ceylon Bistro Lunch',
                price: subtotalVal,
                category: 'Imported Record',
                isAvailable: true
              },
              quantity: 1
            });
          }

          parsedOrders.push({
            id: rawId,
            timestamp,
            items: cartItems,
            subtotal: subtotalVal,
            tax: taxVal,
            discount: discountVal,
            total: totalVal,
            paymentMethod,
            amountReceived: totalVal,
            changeGiven: 0,
            serviceMode,
            cashier: "Import Desk"
          });
        }

        if (parsedOrders.length === 0) {
          setImportReport({
            isOpen: true,
            title: "Empty Rows",
            message: "Parsed lines didn't match the rows of transactions."
          });
          return;
        }

        const registeredCount = await onImportOrders(parsedOrders);
        setImportReport({
          isOpen: true,
          title: "Import Complete ✔️",
          message: `Your transaction history file has been processed successfully! Loaded ${parsedOrders.length} records, registered/updated ${registeredCount} orders, and synchronized sales charts in real-time.`
        });

      } catch (err) {
        console.error("Sales import error:", err);
        setImportReport({
          isOpen: true,
          title: "Parsing Failed",
          message: "Could not parse transactions sheet. Validate CSV cells structure rules."
        });
      }

      e.target.value = '';
    };

    reader.readAsText(file);
  };

  // Real-time Excel/CSV auto-export when new sales are completed
  const [autoExportSales, setAutoExportSales] = useState<boolean>(() => {
    return localStorage.getItem('gusto_auto_export_sales') === 'true';
  });

  const isInitialMount = useRef(true);
  const prevOrdersLengthRef = useRef(orders.length);

  useEffect(() => {
    localStorage.setItem('gusto_auto_export_sales', autoExportSales ? 'true' : 'false');
  }, [autoExportSales]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevOrdersLengthRef.current = orders.length;
      return;
    }

    if (autoExportSales) {
      if (orders.length > prevOrdersLengthRef.current) {
        // Trigger auto export on new orders
        handleExportCSV();
      }
    }
    prevOrdersLengthRef.current = orders.length;
  }, [orders, autoExportSales]);

  return (
    <div className="flex flex-col gap-6 h-full font-sans text-slate-800">
      
      {/* Analytics Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total revenue metrics */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <BadgeDollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Gross Income</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {restaurantInfo.currencySymbol}
              {performanceStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <TrendingUp className="h-3 w-3" /> Live tax included
            </p>
          </div>
        </div>

        {/* Total orders counter */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tickets Processed</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {performanceStats.orderCount}
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">Total finished checkouts</p>
          </div>
        </div>

        {/* average value ticket size */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Average Ticket Size</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {restaurantInfo.currencySymbol}
              {performanceStats.averageTicketSize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">Average sale per bill</p>
          </div>
        </div>

      </div>

      {/* Visual Recharts section */}
      {orders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Business Hourly Revenue Trend */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-slate-800 text-sm">Hourly Sales Curve</h4>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-55/10 py-1 px-2.5 rounded-lg">Operational Hours</span>
            </div>
            
            <div className="h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyRevenueChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#94a3b8' }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', fontFamily: 'sans-serif', fontSize: '11px' }} 
                    formatter={(val) => [`${restaurantInfo.currencySymbol}${val}`, 'Sales']}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Category sales ranking */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-slate-800 text-sm">Category Revenue Distribution</h4>
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">Charted in {restaurantInfo.currency}</span>
            </div>
            
            <div className="h-56 mt-2">
              {categorySalesChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No categories recorded. Choose dishes on the billing page!
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorySalesChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="Category" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#94a3b8' }} />
                    <YAxis tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', fontFamily: 'sans-serif', fontSize: '11px' }} 
                      formatter={(val) => [`${restaurantInfo.currencySymbol}${val}`, 'Gross Revenue']}
                    />
                    <Bar dataKey="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Database Listing of past checkouts */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex-1 flex flex-col min-h-0">
        
        {/* Table Filters header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h4 className="font-bold text-slate-800 tracking-tight">Sales Registers Archive</h4>
            <p className="text-xs text-slate-500 mt-0.5">Click any order line to prompt detailed thermal billing representation</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            {/* Filter payment modes */}
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-xl focus:outline-hidden cursor-pointer"
            >
              <option value="All">All Payments</option>
              <option value="Cash">Cash Only</option>
              <option value="Card">Card Only</option>
              <option value="UPI">UPI Only</option>
              <option value="Mobile Wallet">Wallets Only</option>
            </select>

            {/* Logs search input */}
            <div className="relative flex-1 sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search Receipt ID or food item..."
                value={searchLogId}
                onChange={(e) => setSearchLogId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 text-xs rounded-xl focus:outline-hidden focus:border-slate-800 text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Real-time sync connection indicator & Auto-Export Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-emerald-800">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold mr-1">Cloud Sync Active</span>
              <label className="flex items-center gap-1.5 cursor-pointer border-l pl-2 border-emerald-200">
                <input
                  type="checkbox"
                  checked={autoExportSales}
                  onChange={(e) => setAutoExportSales(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                />
                <span className="text-emerald-700 font-medium">Auto-Export on New Sales</span>
              </label>
            </div>

            {/* Import Sales Spreadsheet button */}
            <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0">
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>Import Excel</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = '';
                }}
                onChange={handleImportCSVSales}
              />
            </label>

            {/* Export CSV/Excel backup option */}
            {orders.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-750 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Excel</span>
              </button>
            )}

            {/* Database wipe option */}
            {orders.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("CRITICAL WARNING: Are you sure you want to permanently clear all Sales History registers? This cannot be undone!")) {
                    onClearOrderLogs();
                  }
                }}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-3 py-2 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
              >
                Clear Sales
              </button>
            )}
          </div>
        </div>

        {/* Database logs table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[40vh] border border-slate-100 rounded-xl">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <HelpCircle className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-sm font-semibold text-slate-500">No checkout history logs found</p>
              <p className="text-xs text-slate-400 mt-1">Settle checkout bags in the POS view to write logs!</p>
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-bold text-[9px]">
                  <th className="px-6 py-4">Receipt ID</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Sells Quantity</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Paid Total</th>
                  <th className="px-6 py-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((log) => {
                  const itemsCount = log.items.reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <tr 
                      key={log.id}
                      onClick={() => onReceiptTrigger(log)}
                      className="hover:bg-slate-50/75 cursor-pointer transition-colors group"
                    >
                      {/* Order Receipt ID */}
                      <td className="px-6 py-4 font-bold text-slate-900 leading-none">
                        <span className="group-hover:text-emerald-700 transition-colors">{log.id}</span>
                        <span className="text-[9px] text-slate-400 block font-normal mt-1 truncate max-w-[150px]">
                          {log.items.map(i => i.menuItem.name).join(', ')}
                        </span>
                      </td>

                      {/* Timestamp formatted nicely */}
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-300" />
                          <span>{new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </td>

                      {/* Total items count */}
                      <td className="px-6 py-4 text-slate-600 font-semibold">{itemsCount} Food item{itemsCount > 1 ? 's' : ''}</td>

                      {/* Settlement Mode badge */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          log.paymentMethod === 'Cash' ? 'bg-amber-50 text-amber-800' :
                          log.paymentMethod === 'Card' ? 'bg-indigo-50 text-indigo-800' :
                          log.paymentMethod === 'UPI' ? 'bg-emerald-50 text-emerald-800 font-bold' :
                          'bg-purple-50 text-purple-800'
                        }`}>
                          {log.paymentMethod}
                        </span>
                      </td>

                      {/* Sells Total */}
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                        {restaurantInfo.currencySymbol}
                        {log.total.toFixed(2)}
                      </td>

                      {/* Click trigger action list */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReceiptTrigger(log);
                          }}
                          className="text-slate-400 hover:text-emerald-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-0.5 font-bold text-[10px]"
                        >
                          <FileText className="h-4 w-4" />
                          <span>View Rec</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Import Status Alert Dialog */}
      {importReport && importReport.isOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setImportReport(null)} />
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-xl z-55 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <span className="p-1 px-1.5 bg-emerald-50 text-emerald-600 rounded-md text-xs">✔️</span>
              {importReport.title}
            </h3>
            <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
              {importReport.message}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setImportReport(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
