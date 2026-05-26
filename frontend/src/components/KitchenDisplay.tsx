import React, { useEffect, useState } from 'react';
import { ChefHat, Clock, CheckCircle2, Flame } from 'lucide-react';
import { KitchenTicket } from '../types';
import {
  getKitchenTickets,
  updateKitchenTicketStatus,
  updateKitchenTicketItemStatus,
  subscribeKitchenTickets,
} from '../lib/api';

const TICKET_STATUS_COLOR: Record<string, string> = {
  pending: 'border-amber-400 bg-amber-50',
  preparing: 'border-orange-400 bg-orange-50',
  ready: 'border-emerald-400 bg-emerald-50',
  served: 'border-slate-200 bg-slate-50 opacity-60',
};

export default function KitchenDisplay() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);

  useEffect(() => {
    getKitchenTickets().then(setTickets).catch(() => setTickets([]));
    return subscribeKitchenTickets(setTickets);
  }, []);

  const pendingCount = tickets.filter((t) => t.status === 'pending').length;
  const preparingCount = tickets.filter((t) => t.status === 'preparing').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-orange-500" />
            Kitchen Display (KOT)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {pendingCount} pending · {preparingCount} preparing · auto-refresh 8s
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <ChefHat className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No active kitchen tickets</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`rounded-2xl border-2 p-4 shadow-sm ${TICKET_STATUS_COLOR[ticket.status] || TICKET_STATUS_COLOR.pending}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-mono text-[10px] text-slate-500">{ticket.id}</p>
                  <h3 className="font-extrabold text-slate-900">
                    {ticket.tableName || ticket.serviceMode}
                  </h3>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(ticket.firedAt).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-1 bg-white rounded-lg border">
                  {ticket.status}
                </span>
              </div>

              <ul className="space-y-2 mb-4">
                {ticket.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between items-center bg-white/70 rounded-lg px-2 py-1.5 text-xs"
                  >
                    <span>
                      <strong>{item.quantity}x</strong> {item.itemName}
                      {item.notes && (
                        <span className="block text-[10px] text-amber-600 italic">* {item.notes}</span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      {item.status !== 'ready' && item.status !== 'served' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await updateKitchenTicketItemStatus(ticket.id, item.id, 'ready');
                            const fresh = await getKitchenTickets();
                            setTickets(fresh);
                          }}
                          className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold"
                        >
                          Ready
                        </button>
                      )}
                      {item.status === 'ready' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                {ticket.status === 'pending' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await updateKitchenTicketStatus(ticket.id, 'preparing');
                      const fresh = await getKitchenTickets();
                      setTickets(fresh);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 rounded-xl"
                  >
                    <Flame className="h-3.5 w-3.5" />
                    Start Prep
                  </button>
                )}
                {(ticket.status === 'preparing' || ticket.status === 'ready') && (
                  <button
                    type="button"
                    onClick={async () => {
                      await updateKitchenTicketStatus(ticket.id, 'served');
                      const fresh = await getKitchenTickets();
                      setTickets(fresh);
                    }}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-xl"
                  >
                    Mark Served
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
