import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Printer, Receipt, CheckCircle, Loader2 } from 'lucide-react';
import { Order, RestaurantConfig, PrintSize } from '../types';
import { printReceiptSilent } from '../lib/api';

const ceylonBistroStamp = "/src/assets/images/ceylon_bistro_stamp_1779429111035.png";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  restaurantInfo: RestaurantConfig;
  isCompletedCheckout?: boolean;
  initialPrintSize?: PrintSize;
  autoPrintOnOpen?: boolean;
}

const PRINT_OPTIONS: { value: PrintSize; label: string }[] = [
  { value: '58mm', label: '58mm Roll' },
  { value: '80mm', label: '80mm Roll' },
  { value: 'A4', label: 'A4 Invoice' },
];

export default function ReceiptModal({
  isOpen,
  onClose,
  order,
  restaurantInfo,
  isCompletedCheckout = false,
  initialPrintSize = '80mm',
  autoPrintOnOpen = false,
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printSize, setPrintSize] = useState<PrintSize>(initialPrintSize);
  const [printing, setPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const autoPrintedRef = useRef(false);

  useEffect(() => {
    setPrintSize(initialPrintSize);
  }, [initialPrintSize, order?.id]);

  const handleSilentPrint = useCallback(async () => {
    if (!order) return;
    setPrinting(true);
    setPrintStatus(null);
    try {
      const result = await printReceiptSilent(order, restaurantInfo, printSize);
      setPrintStatus(result.message || `Sent to printer (${printSize})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      setPrintStatus(msg);
      alert(
        `Print error: ${msg}\n\nEnsure the backend is running on port 5000 and a default printer is set in Windows.`
      );
    } finally {
      setPrinting(false);
    }
  }, [order, restaurantInfo, printSize]);

  useEffect(() => {
    if (!isOpen || !order || !autoPrintOnOpen || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    handleSilentPrint();
  }, [isOpen, order?.id, autoPrintOnOpen, handleSilentPrint]);

  useEffect(() => {
    if (!isOpen) {
      autoPrintedRef.current = false;
      setPrintStatus(null);
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const getPaymentIconStr = (method: string) => {
    switch (method) {
      case 'Cash': return '💵 CASH';
      case 'Card': return '💳 CARD';
      case 'UPI': return '📱 UPI';
      case 'Mobile Wallet': return '👜 WALLET';
      default: return method;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Embedded Dynamic Style Tag for Perfect 80mm Thermal Receipt Printing */}
      <style>{`
        @media print {
          /* Hide everything in the page body */
          body * {
            visibility: hidden;
            background: none !important;
            color: #000 !important;
          }
          /* Show only the print area component and its children */
          .print-area, .print-area * {
            visibility: visible;
          }
          /* Absolute position print container on the print page canvas */
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm !important;
            padding: 4mm 6mm !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11pt !important;
            color: black !important;
            border: none !important;
          }
          /* Special print details */
          .no-print {
            display: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="relative z-10 flex flex-col max-h-[90vh] w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Interactive Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-800">
              {isCompletedCheckout ? "Order Success & Receipt" : "Customer Receipt"}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50 p-6 flex flex-col items-center">
          
          {isCompletedCheckout && (
            <div className="mb-4 flex flex-col items-center text-center animate-bounce-short">
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-slate-800">Order Finalized Successfully!</p>
              <p className="text-xs text-slate-500">Receipt generated & persistent logs saved</p>
            </div>
          )}

          {/* Receipt Preview Structure */}
          <div 
            ref={receiptRef}
            id="printable-receipt"
            className="print-area w-[80mm] max-w-full bg-orange-50/20 border border-amber-100/60 shadow-lg px-6 py-8 rounded-lg font-mono text-sm text-slate-800 bg-white relative"
            style={{ backgroundImage: "linear-gradient(#fcfbfa 1px, transparent 1px)", backgroundSize: "100% 2rem" }}
          >
            {/* Soft serrated top edge design */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[radial-gradient(circle,transparent_4px,#e2e8f0_4px)] bg-[length:12px_12px] bg-repeat-x -translate-y-[1px]" />

            {/* Receipt Header */}
            <div className="text-center mb-5">
              <img 
                src={ceylonBistroStamp}
                alt="Bistro Ink Stamp"
                className="bill-logo w-20 h-20 object-contain mx-auto mb-2 opacity-85"
              />
              <h2 className="text-lg font-bold tracking-tight uppercase text-slate-900">{restaurantInfo.name}</h2>
              <p className="text-xs text-slate-500 mt-1">{restaurantInfo.address}</p>
              <p className="text-xs text-slate-500">Phone: {restaurantInfo.phone}</p>
              <div className="my-3 border-b border-dashed border-slate-300" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 py-0.5 rounded-sm">
                SALES RECEIPT
              </p>
            </div>

            {/* Meta Stats Row */}
            <div className="text-xs space-y-1 text-slate-600 mb-4">
              <div className="flex justify-between">
                <span>Receipt ID:</span>
                <span className="font-semibold text-slate-900">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{new Date(order.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Type:</span>
                <span className="font-bold text-slate-900 uppercase service-tag px-1 bg-slate-900 text-white rounded-xs">
                  {order.serviceMode || 'Dine-In'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cashier Mode:</span>
                <span>Admin POS Desk</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-semibold text-slate-900 shrink-0 select-none">
                  {getPaymentIconStr(order.paymentMethod)}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300 my-3" />

            {/* Itemized Table */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 font-bold uppercase tracking-wider pb-1">
                <span className="w-1/2">Item Description</span>
                <span className="w-1/6 text-center">Qty</span>
                <span className="w-1/3 text-right">Amt</span>
              </div>
              
              <div className="border-b border-slate-200 mb-2" />

              {order.items.map((cartItem, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between text-slate-800">
                    <span className="w-1/2 font-semibold truncate">{cartItem.menuItem.name}</span>
                    <span className="w-1/6 text-center text-slate-500">x{cartItem.quantity}</span>
                    <span className="w-1/3 text-right font-semibold">
                      {restaurantInfo.currencySymbol}
                      {(cartItem.menuItem.price * cartItem.quantity).toFixed(2)}
                    </span>
                  </div>
                  {cartItem.notes && (
                    <div className="text-[10px] text-amber-600 italic pl-2">
                      * {cartItem.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-slate-300 my-4" />

            {/* Calculations Blocks */}
            <div className="text-xs space-y-1.5 pl-12 text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>
                  {restaurantInfo.currencySymbol}
                  {order.subtotal.toFixed(2)}
                </span>
              </div>
              
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Promo Discount:</span>
                  <span>
                    -{restaurantInfo.currencySymbol}
                    {order.discount.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Tax/VAT (10%):</span>
                <span>
                  {restaurantInfo.currencySymbol}
                  {order.tax.toFixed(2)}
                </span>
              </div>

              <div className="border-b border-slate-200 my-1" />

              <div className="flex justify-between text-sm font-bold text-slate-900">
                <span>GRAND TOTAL:</span>
                <span>
                  {restaurantInfo.currencySymbol}
                  {order.total.toFixed(2)}
                </span>
              </div>

              {order.amountReceived !== undefined && (
                <div className="pt-2 text-[11px] space-y-0.5 text-slate-500">
                  <div className="flex justify-between">
                    <span>Cash Deposited:</span>
                    <span>
                      {restaurantInfo.currencySymbol}
                      {order.amountReceived.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Change Drawer:</span>
                    <span>
                      {restaurantInfo.currencySymbol}
                      {(order.changeGiven ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-300 my-5" />

            {/* Footer thank note */}
            <div className="text-center text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">THANK YOU FOR YOUR DINING!</p>
              <p>Wi-Fi Code: GustoGuest2026</p>
              <p className="text-[10px]">System: GustoPOS V1.2 • AI Desk Powered</p>
            </div>
          </div>

        </div>

        {/* Print size + silent print */}
        <div className="no-print bg-slate-50 border-t border-slate-100 p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Receipt / Invoice Size
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRINT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPrintSize(opt.value)}
                  className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                    printSize === opt.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {printStatus && (
            <p className="text-[10px] text-center text-emerald-700 font-semibold">{printStatus}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Dismiss
            </button>
            <button
              type="button"
              disabled={printing}
              onClick={handleSilentPrint}
              className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {printing ? 'Printing…' : 'Print Bill'}
            </button>
          </div>
          <p className="text-[9px] text-center text-slate-400">
            Silent print — no browser dialog. Sends to your Windows default printer via the POS server.
          </p>
        </div>

      </div>
    </div>
  );
}
