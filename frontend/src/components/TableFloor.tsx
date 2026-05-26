import React, { useEffect, useState } from 'react';
import { LayoutGrid, RefreshCw, Users } from 'lucide-react';
import { DiningTable } from '../types';
import { getDiningTables, updateTableStatus } from '../lib/api';

const STATUS_STYLES: Record<DiningTable['status'], string> = {
  available: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  occupied: 'bg-amber-50 border-amber-300 text-amber-900',
  reserved: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  billing: 'bg-rose-50 border-rose-200 text-rose-800',
};

interface TableFloorProps {
  onSelectTable?: (table: DiningTable) => void;
  selectedTableId?: string;
}

export default function TableFloor({ onSelectTable, selectedTableId }: TableFloorProps) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTables = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDiningTables();
      setTables(data);
    } catch (err: unknown) {
      setTables([]);
      const msg = err instanceof Error ? err.message : 'Could not load tables';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setLoadError('Backend unreachable. Start the API server: cd server && npm run dev (port 5000).');
      } else if (msg.includes('Access denied') || msg.includes('token')) {
        setLoadError('Session expired. Please sign out and log in again.');
      } else {
        setLoadError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
    const interval = setInterval(loadTables, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (table: DiningTable, status: DiningTable['status']) => {
    await updateTableStatus(table.id, status, status === 'available' ? null : table.activeSessionId);
    await loadTables();
  };

  const zones = [...new Set(tables.map((t) => t.zone))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-emerald-600" />
            Table Floor Plan
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Live table status — tap a table to select it for POS billing
          </p>
        </div>
        <button
          type="button"
          onClick={loadTables}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
        {(['available', 'occupied', 'reserved', 'billing'] as const).map((s) => (
          <span key={s} className={`px-2 py-1 rounded-lg border ${STATUS_STYLES[s]}`}>
            {s}
          </span>
        ))}
      </div>

      {zones.map((zone) => (
        <div key={zone}>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{zone}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {tables
              .filter((t) => t.zone === zone)
              .map((table) => (
                <div
                  key={table.id}
                  onClick={() => onSelectTable?.(table)}
                  className={`rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                    STATUS_STYLES[table.status]
                  } ${selectedTableId === table.id ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-sm">{table.name}</span>
                    <Users className="h-3.5 w-3.5 opacity-60" />
                  </div>
                  <p className="text-[10px] mt-1 opacity-70">Seats {table.capacity}</p>
                  <p className="text-[10px] font-bold uppercase mt-2 tracking-wide">{table.status}</p>
                  <div className="mt-3 flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {table.status !== 'available' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(table, 'available')}
                        className="text-[9px] bg-white/80 px-2 py-0.5 rounded font-bold"
                      >
                        Clear
                      </button>
                    )}
                    {table.status === 'available' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(table, 'reserved')}
                        className="text-[9px] bg-white/80 px-2 py-0.5 rounded font-bold"
                      >
                        Reserve
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl p-4 text-center">
          {loadError}
        </div>
      )}

      {tables.length === 0 && !loading && !loadError && (
        <p className="text-sm text-slate-500 text-center py-12">
          No dining tables in database yet. Click <strong>Refresh</strong> — the backend auto-seeds defaults on first load.
        </p>
      )}
    </div>
  );
}
