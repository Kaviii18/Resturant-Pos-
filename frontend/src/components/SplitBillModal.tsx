import React, { useMemo, useState } from 'react';
import { X, Users, Plus, Trash2 } from 'lucide-react';
import { CartItem, Order, RestaurantConfig, SplitCheckoutLine } from '../types';
import { settleSplitBill } from '../lib/api';

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  restaurantInfo: RestaurantConfig;
  serviceMode: Order['serviceMode'];
  tableId?: string;
  discountPercent: number;
  cashier?: string;
  onSplitComplete: (orderIds: string[]) => void;
}

interface GuestSplit {
  label: string;
  itemIndexes: number[];
  paymentMethod: Order['paymentMethod'];
  cashReceived: string;
}

export default function SplitBillModal({
  isOpen,
  onClose,
  cart,
  restaurantInfo,
  serviceMode,
  tableId,
  discountPercent,
  cashier,
  onSplitComplete,
}: SplitBillModalProps) {
  const [guests, setGuests] = useState<GuestSplit[]>([
    { label: 'Guest 1', itemIndexes: cart.map((_, i) => i), paymentMethod: 'Cash', cashReceived: '' },
    { label: 'Guest 2', itemIndexes: [], paymentMethod: 'Card', cashReceived: '' },
  ]);
  const [settling, setSettling] = useState(false);

  const computeSplitTotals = (indexes: number[]) => {
    const items = indexes.map((i) => cart[i]).filter(Boolean);
    const subtotal = items.reduce((s, l) => s + l.menuItem.price * l.quantity, 0);
    const discount = (subtotal * discountPercent) / 100;
    const tax = (subtotal - discount) * restaurantInfo.taxRate;
    const total = Math.max(0, subtotal - discount + tax);
    return { items, subtotal, discount, tax, total };
  };

  const unassignedIndexes = useMemo(() => {
    const assigned = new Set(guests.flatMap((g) => g.itemIndexes));
    return cart.map((_, i) => i).filter((i) => !assigned.has(i));
  }, [guests, cart]);

  const addGuest = () => {
    setGuests((g) => [
      ...g,
      { label: `Guest ${g.length + 1}`, itemIndexes: [], paymentMethod: 'Cash', cashReceived: '' },
    ]);
  };

  const toggleItemForGuest = (guestIdx: number, itemIdx: number) => {
    setGuests((prev) =>
      prev.map((g, gi) => {
        if (gi === guestIdx) {
          const has = g.itemIndexes.includes(itemIdx);
          return {
            ...g,
            itemIndexes: has
              ? g.itemIndexes.filter((x) => x !== itemIdx)
              : [...g.itemIndexes, itemIdx],
          };
        }
        return { ...g, itemIndexes: g.itemIndexes.filter((x) => x !== itemIdx) };
      })
    );
  };

  const handleSettleAll = async () => {
    const splits: SplitCheckoutLine[] = [];
    for (const guest of guests) {
      if (guest.itemIndexes.length === 0) continue;
      const { items, subtotal, discount, tax, total } = computeSplitTotals(guest.itemIndexes);
      const cashVal = parseFloat(guest.cashReceived);
      if (guest.paymentMethod === 'Cash' && (isNaN(cashVal) || cashVal < total)) {
        alert(`${guest.label}: cash received is less than total ${total.toFixed(2)}`);
        return;
      }
      splits.push({
        label: guest.label,
        items,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod: guest.paymentMethod,
        amountReceived: guest.paymentMethod === 'Cash' ? cashVal : total,
        changeGiven: guest.paymentMethod === 'Cash' ? Math.max(0, cashVal - total) : 0,
      });
    }

    if (splits.length === 0) {
      alert('Assign at least one item to a guest.');
      return;
    }

    if (unassignedIndexes.length > 0) {
      if (!window.confirm(`${unassignedIndexes.length} item(s) unassigned. Continue anyway?`)) return;
    }

    setSettling(true);
    try {
      const result = await settleSplitBill({
        tableId,
        serviceMode,
        cashier,
        splits,
      });
      onSplitComplete(result.orderIds);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Split settlement failed');
    } finally {
      setSettling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl max-w-2xl w-full relative z-10 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              Split Bill
            </h3>
            <p className="text-xs text-slate-500">Assign items to each guest, then settle separately</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-1 rounded-full">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="font-bold text-slate-600 mb-2">Cart items — click guest tabs to assign</p>
            <div className="space-y-1">
              {cart.map((line, idx) => (
                <div key={idx} className="flex justify-between text-slate-700">
                  <span>
                    {line.menuItem.name} x{line.quantity}
                  </span>
                  <span>
                    {restaurantInfo.currencySymbol}
                    {(line.menuItem.price * line.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {unassignedIndexes.length > 0 && (
              <p className="text-amber-600 font-bold mt-2">{unassignedIndexes.length} unassigned</p>
            )}
          </div>

          {guests.map((guest, gIdx) => {
            const totals = computeSplitTotals(guest.itemIndexes);
            return (
              <div key={gIdx} className="border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <input
                    className="font-bold text-sm border-b border-slate-200 focus:outline-none"
                    value={guest.label}
                    onChange={(e) =>
                      setGuests((prev) =>
                        prev.map((g, i) => (i === gIdx ? { ...g, label: e.target.value } : g))
                      )
                    }
                  />
                  {guests.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setGuests((g) => g.filter((_, i) => i !== gIdx))}
                      className="text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {cart.map((line, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleItemForGuest(gIdx, idx)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        guest.itemIndexes.includes(idx)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {line.menuItem.name}
                    </button>
                  ))}
                </div>
                <p className="text-emerald-700 font-bold">
                  Total: {restaurantInfo.currencySymbol}
                  {totals.total.toFixed(2)}
                </p>
                <select
                  value={guest.paymentMethod}
                  onChange={(e) =>
                    setGuests((prev) =>
                      prev.map((g, i) =>
                        i === gIdx ? { ...g, paymentMethod: e.target.value as Order['paymentMethod'] } : g
                      )
                    )
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  {(['Cash', 'Card', 'UPI', 'Mobile Wallet'] as const).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {guest.paymentMethod === 'Cash' && (
                  <input
                    type="number"
                    placeholder="Cash received"
                    value={guest.cashReceived}
                    onChange={(e) =>
                      setGuests((prev) =>
                        prev.map((g, i) => (i === gIdx ? { ...g, cashReceived: e.target.value } : g))
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                  />
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addGuest}
            className="flex items-center gap-1 text-indigo-600 font-bold text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add guest
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-slate-200 py-2.5 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={settling}
            onClick={handleSettleAll}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
          >
            {settling ? 'Settling...' : 'Settle All Splits'}
          </button>
        </div>
      </div>
    </div>
  );
}
