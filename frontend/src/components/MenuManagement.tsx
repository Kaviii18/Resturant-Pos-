import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Image as ImageIcon, 
  Check, 
  X, 
  RotateCcw, 
  Coffee, 
  BadgeDollarSign, 
  Tag, 
  HelpCircle,
  Eye,
  EyeOff,
  Upload,
  Link,
  FileImage,
  FileSpreadsheet
} from 'lucide-react';
import { MenuItem, RestaurantConfig } from '../types';
import { AVAILABLE_CATEGORIES } from '../data';

interface MenuManagementProps {
  menuItems: MenuItem[];
  restaurantInfo: RestaurantConfig;
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onResetDefaultMenu: () => void;
  onImportMenuItems: (items: MenuItem[]) => Promise<{ addedCount: number; updatedCount: number }>;
}

export default function MenuManagement({
  menuItems,
  restaurantInfo,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onResetDefaultMenu,
  onImportMenuItems,
}: MenuManagementProps) {
  // Inventory table Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'Add' | 'Edit'>('Add');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Custom visual Alert/Confirmation states
  const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; title?: string }>({
    isOpen: false,
    message: '',
    title: 'Input Validation Failed'
  });
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'delete' | 'reset' | null;
    targetId?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionType: null
  });

  // Form Field Inputs State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(AVAILABLE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // New Image Selection option states & Drag & Drop
  const [imageSourceType, setImageSourceType] = useState<'url' | 'upload'>('url');
  const [localFileName, setLocalFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAlertState({
        isOpen: true,
        title: 'Only Images Allowed',
        message: 'Please drag and drop a valid image file (PNG, JPG, WEBP, GIF, SVG).'
      });
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setAlertState({
        isOpen: true,
        title: 'File Too Large',
        message: 'Please choose an image file smaller than 1.5MB to preserve local database memory.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setLocalFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setAlertState({
        isOpen: true,
        title: 'File Too Large',
        message: 'Please choose an image file smaller than 1.5MB to preserve local database memory.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setLocalFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Computed aggregate metrics for inventory representation
  const metrics = useMemo(() => {
    const total = menuItems.length;
    const available = menuItems.filter(i => i.isAvailable).length;
    const unavailable = total - available;
    const uniqueCats = new Set(menuItems.map(i => i.category)).size;
    return { total, available, unavailable, uniqueCats };
  }, [menuItems]);

  // Combined filters
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchQuery, categoryFilter]);

  const categoriesList = useMemo(() => {
    const list = new Set(menuItems.map(item => item.category));
    return ['All', ...Array.from(list)];
  }, [menuItems]);

  const handleExportCSV = () => {
    if (menuItems.length === 0) return;

    const headers = [
      "Dish ID",
      "Name",
      "Category",
      `Price (${restaurantInfo.currencySymbol})`,
      "Availability Status",
      "Description",
      "Graphic Image URL"
    ];

    const rows = menuItems.map(item => [
      item.id,
      item.name,
      item.category,
      item.price.toFixed(2),
      item.isAvailable ? "Available" : "Suspended",
      item.description || "",
      item.imageUrl || ""
    ]);

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
    link.setAttribute("download", `gusto_menu_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const rawLines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (rawLines.length === 0) {
          setAlertState({
            isOpen: true,
            title: "Empty Spreadsheet",
            message: "The uploaded Excel CSV file does not contain any valid rows."
          });
          return;
        }

        const parsedLines = rawLines.map(line => parseCSVRow(line));
        const firstRow = parsedLines[0];
        const normalizedHeaders = firstRow.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        const idIndex = normalizedHeaders.findIndex(h => h.includes('id') || h.includes('key'));
        const nameIndex = normalizedHeaders.findIndex(h => h.includes('name') || h.includes('title') || h === 'dish');
        const categoryIndex = normalizedHeaders.findIndex(h => h.includes('cat') || h.includes('type'));
        const priceIndex = normalizedHeaders.findIndex(h => h.includes('price') || h.includes('cost') || h.includes('rate'));
        const availableIndex = normalizedHeaders.findIndex(h => h.includes('avail') || h.includes('status') || h.includes('state'));
        const descIndex = normalizedHeaders.findIndex(h => h.includes('desc') || h.includes('detail') || h.includes('info'));
        const imgIndex = normalizedHeaders.findIndex(h => h.includes('img') || h.includes('image') || h.includes('url') || h.includes('graphic'));

        if (nameIndex === -1 || priceIndex === -1) {
          setAlertState({
            isOpen: true,
            title: "Columns Not Matched",
            message: "Your spreadsheet must contain at least 'Name' and 'Price' column headers to register or synchronize elements."
          });
          return;
        }

        const importedItemsList: MenuItem[] = [];

        for (let i = 1; i < parsedLines.length; i++) {
          const row = parsedLines[i];
          if (row.length < Math.max(nameIndex, priceIndex) + 1) continue;

          const rawId = idIndex !== -1 ? row[idIndex] : '';
          const name = row[nameIndex] || '';
          if (!name) continue;

          const priceVal = parseFloat(row[priceIndex].replace(/[^0-9.]/g, '')) || 0;
          const category = categoryIndex !== -1 ? (row[categoryIndex] || 'General') : 'General';
          
          let isAvailable = true;
          if (availableIndex !== -1) {
            const availText = row[availableIndex].toLowerCase();
            if (availText === 'suspended' || availText === 'false' || availText === 'no' || availText === 'unavailable' || availText === 'disabled') {
              isAvailable = false;
            }
          }

          const description = descIndex !== -1 ? row[descIndex] : '';
          const imageUrl = imgIndex !== -1 ? row[imgIndex] : '';

          importedItemsList.push({
            id: rawId,
            name,
            category,
            price: priceVal,
            isAvailable,
            description,
            imageUrl
          });
        }

        const { addedCount, updatedCount } = await onImportMenuItems(importedItemsList);

        setAlertState({
          isOpen: true,
          title: "Import Success ✔️",
          message: `Your Excel spreadsheet has been loaded successfully! Added ${addedCount} new food items and updated ${updatedCount} existing catalog items and prices in real-time.`
        });

      } catch (err) {
        console.error("CSV Import Error:", err);
        setAlertState({
          isOpen: true,
          title: "Parsing Failed",
          message: "Could not parse files. Ensure the spreadsheet contains standard comma-separated details."
        });
      }

      e.target.value = '';
    };

    reader.readAsText(file);
  };

  // Real-time Excel/CSV auto-export when menu items or prices change
  const [autoExport, setAutoExport] = useState<boolean>(() => {
    return localStorage.getItem('gusto_auto_export_menu') === 'true';
  });

  const isInitialMount = useRef(true);
  const prevMenuLengthRef = useRef(menuItems.length);
  const prevMenuPriceSumRef = useRef(menuItems.reduce((sum, item) => sum + item.price, 0));

  useEffect(() => {
    localStorage.setItem('gusto_auto_export_menu', autoExport ? 'true' : 'false');
  }, [autoExport]);

  useEffect(() => {
    const currentPriceSum = menuItems.reduce((sum, item) => sum + item.price, 0);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevMenuLengthRef.current = menuItems.length;
      prevMenuPriceSumRef.current = currentPriceSum;
      return;
    }

    if (autoExport) {
      if (menuItems.length !== prevMenuLengthRef.current || currentPriceSum !== prevMenuPriceSumRef.current) {
        // Trigger auto export when there is a change
        handleExportCSV();
      }
    }
    prevMenuLengthRef.current = menuItems.length;
    prevMenuPriceSumRef.current = currentPriceSum;
  }, [menuItems, autoExport]);

  // Handle open modal for new Add
  const handleOpenAdd = () => {
    setFormMode('Add');
    setEditingItemId(null);
    setName('');
    setPrice('');
    setCategory(AVAILABLE_CATEGORIES[0]);
    setCustomCategory('');
    setIsCustomCategoryMode(false);
    setImageUrl('');
    setDescription('');
    setIsAvailable(true);
    setImageSourceType('url');
    setLocalFileName('');
    setIsFormOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEdit = (item: MenuItem) => {
    setFormMode('Edit');
    setEditingItemId(item.id);
    setName(item.name);
    setPrice(item.price.toString());
    
    // Check if category is standard
    if (AVAILABLE_CATEGORIES.includes(item.category)) {
      setCategory(item.category);
      setIsCustomCategoryMode(false);
    } else {
      setCategory('Custom');
      setCustomCategory(item.category);
      setIsCustomCategoryMode(true);
    }
    
    const url = item.imageUrl || '';
    setImageUrl(url);
    setDescription(item.description || '');
    setIsAvailable(item.isAvailable);
    
    if (url.startsWith('data:')) {
      setImageSourceType('upload');
      setLocalFileName('Uploaded_Local_Image.png');
    } else {
      setImageSourceType('url');
      setLocalFileName('');
    }
    
    setIsFormOpen(true);
  };

  // Submit modal form
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setAlertState({
        isOpen: true,
        title: 'Invalid Price Value',
        message: 'Please provide a valid numeric positive price for this catalog product!'
      });
      return;
    }

    const finalCategory = isCustomCategoryMode ? customCategory.trim() : category;
    if (!finalCategory) {
      setAlertState({
        isOpen: true,
        title: 'Empty Category',
        message: 'Please specify a food category name, or select an existing one!'
      });
      return;
    }

    if (formMode === 'Add') {
      const newItem: MenuItem = {
        id: `menu-item-${Date.now()}`,
        name: name.trim(),
        price: parsedPrice,
        category: finalCategory,
        imageUrl: imageUrl.trim() || undefined,
        description: description.trim() || undefined,
        isAvailable
      };
      onAddMenuItem(newItem);
    } else if (formMode === 'Edit' && editingItemId) {
      const updatedItem: MenuItem = {
        id: editingItemId,
        name: name.trim(),
        price: parsedPrice,
        category: finalCategory,
        imageUrl: imageUrl.trim() || undefined,
        description: description.trim() || undefined,
        isAvailable
      };
      onUpdateMenuItem(updatedItem);
    }

    setIsFormOpen(false);
  };

  // Quick Toggle Availability straight on the table row
  const toggleRowAvailability = (item: MenuItem) => {
    onUpdateMenuItem({
      ...item,
      isAvailable: !item.isAvailable
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full font-sans">
      
      {/* Upper Metrics Grid Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Dishes</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-800">{metrics.total}</span>
            <span className="text-xs text-slate-500">items</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Active Inventory</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-700">{metrics.available}</span>
            <span className="text-[10px] text-emerald-600 px-2 py-0.5 rounded-full bg-emerald-50">Available</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-rose-600 font-semibold uppercase tracking-wider">Sold Out / Paused</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-rose-700">{metrics.unavailable}</span>
            <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">OOS Mode</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-indigo-650 font-semibold uppercase tracking-wider">Distinct Categories</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-indigo-800">{metrics.uniqueCats}</span>
            <span className="text-xs text-slate-500">collections</span>
          </div>
        </div>
      </div>

      {/* Main Table Interface Area */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex-1 flex flex-col min-h-0">
        
        {/* Table Search / Header actions bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Main Catalog Registry</h2>
            <p className="text-xs text-slate-500 mt-0.5">Edit prices, availability switches, catalog graphics, or names</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Table category selector */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-xl focus:outline-hidden cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categoriesList.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Keyword Search field */}
            <div className="relative flex-1 sm:w-60">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search catalog registry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                  checked={autoExport}
                  onChange={(e) => setAutoExport(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                />
                <span className="text-emerald-700 font-medium">Auto-Export on Price/Menu Changes</span>
              </label>
            </div>

            {/* Import Menu Spreadsheet button */}
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
                onChange={handleImportCSV}
              />
            </label>

            {/* Export Menu Catalog as Excel CSV */}
            <button
              onClick={handleExportCSV}
              title="Download Menu as Excel CSV"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-emerald-750 cursor-pointer active:scale-95 transition-all shadow-sm"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </button>

            {/* Reset Defaults button */}
            <button
              onClick={() => {
                setConfirmState({
                  isOpen: true,
                  title: 'Reset Catalog to Defaults?',
                  message: 'Are you sure you want to restore default initial Gusto Ceylon Bistro dishes? Any additions, custom pricing, or edits will be reset.',
                  actionType: 'reset'
                });
              }}
              title="Reset Catalog to Defaults"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Set Defaults</span>
            </button>

            {/* Launch Form trigger */}
            <button
              onClick={handleOpenAdd}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add New Dish
            </button>
          </div>
        </div>

        {/* Catalog Table Container */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[50vh] border border-slate-100 rounded-xl">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <HelpCircle className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-sm font-semibold text-slate-500">No registry matches found</p>
              <p className="text-xs text-slate-400 mt-1">Try another keyword query filter!</p>
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="px-6 py-4">Dish Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Unit Price</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredItems.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Item details */}
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex items-center gap-3">
                        {/* Little graphic thumbnail */}
                        <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-slate-50">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover" 
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                              <Coffee className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                          {item.description && (
                            <p className="text-[10px] text-slate-400 line-clamp-1 italic font-light mt-0.5 max-w-[200px]">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category Label */}
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-600 bg-slate-100 text-[10px] py-1 px-2.5 rounded-lg select-none">
                        {item.category}
                      </span>
                    </td>

                    {/* Price with local currency */}
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {restaurantInfo.currencySymbol}
                      {item.price.toFixed(2)}
                    </td>

                    {/* Availability interactive row with sliding switch toggle */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleRowAvailability(item)}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            item.isAvailable ? 'bg-emerald-600' : 'bg-slate-350'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                              item.isAvailable ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className={`text-[9px] font-extrabold tracking-tight ${item.isAvailable ? 'text-emerald-700' : 'text-slate-400 font-medium'}`}>
                          {item.isAvailable ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    </td>

                    {/* Row operations */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="text-slate-500 hover:text-indigo-650 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Registry details"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmState({
                              isOpen: true,
                              title: `Delete "${item.name}"?`,
                              message: `Are you sure you want to remove "${item.name}" from the active menu? This action will prevent future checkouts.`,
                              actionType: 'delete',
                              targetId: item.id
                            });
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Purge item from menu"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DETAILED FORM MODAL FOR ADD/EDIT DISH */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          
          <form 
            onSubmit={handleFormSubmit}
            className="bg-white rounded-2xl max-w-md w-full relative z-10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Form Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {formMode === 'Add' ? 'Add New Menu Item' : 'Modify Menu Product'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configure item pricing and registry details</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form Fields Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Product Name */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Dish/Drink Title</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Coffee className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Garlic Baked Chicken Wings"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-slate-800"
                  />
                </div>
              </div>

              {/* Price and Category grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Price */}
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Unit Price ({restaurantInfo.currencySymbol})</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <BadgeDollarSign className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 10.99"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-slate-800"
                    />
                  </div>
                </div>

                {/* Category Selection block */}
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Main Category</label>
                  <select
                    value={isCustomCategoryMode ? 'Custom' : category}
                    onChange={(e) => {
                      if (e.target.value === 'Custom') {
                        setIsCustomCategoryMode(true);
                      } else {
                        setIsCustomCategoryMode(false);
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                  >
                    {AVAILABLE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Custom">+ Create custom...</option>
                  </select>
                </div>
              </div>

              {/* Conditionally rendering custom category input */}
              {isCustomCategoryMode && (
                <div className="animate-in fade-in-50 slide-in-from-top-2 duration-155">
                  <label className="text-xs font-bold text-slate-600 block mb-1">Specify Custom Category</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Tag className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="text"
                      required={isCustomCategoryMode}
                      placeholder="e.g. Starters / Pastas"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Image Selection Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">Dish Graphic Image</label>
                
                {/* Mode Selector Tabs */}
                <div className="bg-slate-100 rounded-xl p-1 flex gap-1 border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setImageSourceType('url');
                    }}
                    className={`flex-1 py-1 px-2 rounded-lg text-[11.5px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                      imageSourceType === 'url'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Link className="h-3 w-3" /> Web URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageSourceType('upload');
                    }}
                    className={`flex-1 py-1 px-2 rounded-lg text-[11.5px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                      imageSourceType === 'upload'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Upload className="h-3 w-3" /> Local Upload
                  </button>
                </div>

                {/* Switchable source fields */}
                {imageSourceType === 'url' ? (
                  <div className="space-y-1.5 duration-150 transition-all">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Link className="h-3.5 w-3.5" />
                      </span>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/photo-..."
                        value={imageUrl.startsWith('data:') ? '' : imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-slate-800"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block leading-relaxed">
                      Provide a web-hosted catalog link, or leave empty for default cup placeholder.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5 duration-150 transition-all">
                    {/* Drag and drop panel wrapper */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center relative ${
                        isDragging 
                          ? 'border-indigo-500 bg-indigo-50/20' 
                          : imageUrl?.startsWith('data:') 
                            ? 'border-slate-300 bg-slate-50/50' 
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                      }`}
                      onClick={() => document.getElementById('local-file-input')?.click()}
                    >
                      <input
                        type="file"
                        id="local-file-input"
                        accept="image/*"
                        onChange={handleLocalImageUpload}
                        className="hidden"
                      />
                      
                      <Upload className={`h-6 w-6 mb-1.5 ${isDragging ? 'text-indigo-650 animate-bounce' : 'text-slate-400'}`} />
                      
                      {localFileName ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800 max-w-[250px] truncate mx-auto">
                            {localFileName}
                          </p>
                          <p className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                            SUCCESSFULLY LOADED
                          </p>
                        </div>
                      ) : imageUrl?.startsWith('data:') ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800 max-w-[250px] truncate mx-auto">
                            Custom_Local_Image.png
                          </p>
                          <p className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                            EXISTS IN PRODUCT
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-extrabold text-slate-700">Drag & drop item image here</p>
                          <p className="text-[9px] text-slate-400 font-medium font-sans">Or <span className="text-indigo-600 underline">browse your files</span> (Max 1.5MB)</p>
                        </div>
                      )}
                    </div>

                    {/* Small action to clear uploaded file if exists */}
                    {imageUrl && (
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                        <span className="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">
                          {localFileName || (imageUrl.startsWith('data:') ? 'Saved Local Base64 String' : 'Active Web Reference')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrl('');
                            setLocalFileName('');
                          }}
                          className="text-[10px] font-black text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-md cursor-pointer"
                        >
                          Reset Image
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ALWAYS RENDER A SMALL GORGEOUS PREVIEW BOX IF IMAGE EXISTS */}
                {imageUrl && (
                  <div className="flex items-center gap-3 bg-indigo-50/30 border border-indigo-100/50 p-2.5 rounded-xl animate-in fade-in-50 slide-in-from-top-1 duration-120">
                    <div className="h-11 w-11 rounded-lg overflow-hidden shrink-0 border border-slate-200 shadow-sm bg-white">
                      <img 
                        src={imageUrl} 
                        alt="Dish Thumbnail Preview" 
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover" 
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-800 leading-tight">Live Asset Preview</p>
                      <p className="text-[9px] text-slate-405 mt-0.5 font-mono truncate max-w-[180px]">
                        {imageUrl.startsWith('data:') ? 'Local Base64 Binary Stream Data' : imageUrl}
                      </p>
                    </div>
                    {imageSourceType === 'upload' && (
                      <span className="ml-auto text-[8px] font-black tracking-widest uppercase bg-indigo-600/10 text-indigo-700 px-2 py-0.5 rounded-full font-mono shrink-0">
                        OFFLINE
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="e.g. Infused with organic lemon grass, slow-roasted, served alongside sweet-spicy garlic dip."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-slate-800 h-16 resize-none"
                />
              </div>

              {/* Available Checkbox changed to sliding switch */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Available for Ordering</span>
                  <span className="text-[10px] text-slate-450 block mt-0.5 leading-tight">Activate or temporarily pause this item</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAvailable(!isAvailable)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isAvailable ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isAvailable ? 'translate-x-5' : 'translate-x-0'
                        }`}
                  />
                </button>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="flex-1 bg-white border border-slate-200.text-slate-600 hover:bg-slate-100 py-3 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-xs font-bold shadow-sm active:scale-98 transition-all"
              >
                {formMode === 'Add' ? 'Add Dish To List' : 'Save Changes'}
              </button>
            </div>
          </form> 
        </div>
      )}

      {/* CUSTOM REACT ALERT DIALOG POPUP */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setAlertState(prev => ({ ...prev, isOpen: false }))} />
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative z-10 shadow-2xl border border-slate-100 text-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-amber-650">
              <div className="p-2 bg-amber-50 rounded-full">
                <HelpCircle className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">{alertState.title || 'Notification alert'}</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">{alertState.message}</p>
            <button
              onClick={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM REACT CONFIRMATION DIALOG POPUP */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative z-10 shadow-2xl border border-slate-100 text-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-full ${confirmState.actionType === 'delete' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`}>
                <Trash2 className="h-5 w-5" />
              </div>
              <h4 className="font-black text-sm text-slate-900">{confirmState.title}</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">{confirmState.message}</p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                No, Keep
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmState.actionType === 'delete' && confirmState.targetId) {
                    onDeleteMenuItem(confirmState.targetId);
                  } else if (confirmState.actionType === 'reset') {
                    onResetDefaultMenu();
                  }
                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 text-white py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-95 transition-all ${
                  confirmState.actionType === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
