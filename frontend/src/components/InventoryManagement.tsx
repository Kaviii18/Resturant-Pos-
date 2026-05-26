import React, { useEffect, useState } from 'react';
import { Package, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Ingredient, MenuItem } from '../types';
import {
  getIngredients,
  getLowStockIngredients,
  adjustIngredientStock,
  getRecipeForMenuItem,
  saveRecipeForMenuItem,
} from '../lib/api';

interface InventoryManagementProps {
  menuItems: MenuItem[];
}

export default function InventoryManagement({ menuItems }: InventoryManagementProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [lowStock, setLowStock] = useState<Ingredient[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');
  const [recipeLines, setRecipeLines] = useState<{ ingredientId: string; qtyPerServing: number }[]>([]);
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});

  const load = async () => {
    const [all, low] = await Promise.all([getIngredients(), getLowStockIngredients()]);
    setIngredients(all);
    setLowStock(low);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedMenuId) return;
    getRecipeForMenuItem(selectedMenuId).then((lines) =>
      setRecipeLines(
        lines.map((l) => ({ ingredientId: l.ingredientId, qtyPerServing: l.qtyPerServing }))
      )
    );
  }, [selectedMenuId]);

  const handleAdjust = async (ing: Ingredient, type: 'in' | 'out') => {
    const qty = parseFloat(adjustQty[ing.id] || '0');
    if (!qty || qty <= 0) return;
    await adjustIngredientStock(ing.id, qty, type, `Manual ${type} — ${ing.name}`);
    setAdjustQty((prev) => ({ ...prev, [ing.id]: '' }));
    await load();
  };

  const handleSaveRecipe = async () => {
    if (!selectedMenuId) return;
    await saveRecipeForMenuItem(selectedMenuId, recipeLines.filter((r) => r.ingredientId && r.qtyPerServing > 0));
    alert('Recipe saved. Stock will deduct automatically on order completion.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Package className="h-5 w-5 text-violet-600" />
          Ingredient Inventory
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Recipe-linked stock deducts when orders are completed
        </p>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-rose-800 flex items-center gap-1 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Low Stock Alerts ({lowStock.length})
          </h3>
          <ul className="text-xs text-rose-700 space-y-1">
            {lowStock.map((ing) => (
              <li key={ing.id}>
                {ing.name}: {ing.currentStock} {ing.unit} (reorder at {ing.reorderLevel})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="text-left p-3">Ingredient</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-right p-3">Reorder</th>
              <th className="text-right p-3">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => (
              <tr key={ing.id} className="border-t border-slate-50">
                <td className="p-3 font-semibold text-slate-800">
                  {ing.name}
                  {ing.isLowStock && (
                    <span className="ml-1 text-[9px] bg-rose-100 text-rose-700 px-1 rounded">LOW</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono">
                  {ing.currentStock} {ing.unit}
                </td>
                <td className="p-3 text-right text-slate-400">{ing.reorderLevel}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1 items-center">
                    <input
                      type="number"
                      className="w-16 border border-slate-200 rounded px-1 py-0.5 text-right"
                      placeholder="Qty"
                      value={adjustQty[ing.id] || ''}
                      onChange={(e) =>
                        setAdjustQty((prev) => ({ ...prev, [ing.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjust(ing, 'in')}
                      className="p-1 bg-emerald-100 text-emerald-700 rounded"
                      title="Stock in"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(ing, 'out')}
                      className="p-1 bg-rose-100 text-rose-700 rounded"
                      title="Stock out"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <h3 className="font-bold text-slate-800 text-sm">Menu Item Recipes</h3>
        <select
          value={selectedMenuId}
          onChange={(e) => setSelectedMenuId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
        >
          <option value="">Select menu item...</option>
          {menuItems.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {selectedMenuId && (
          <div className="space-y-2">
            {recipeLines.map((line, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={line.ingredientId}
                  onChange={(e) =>
                    setRecipeLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, ingredientId: e.target.value } : l))
                    )
                  }
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">Ingredient...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                  placeholder="Qty/serving"
                  value={line.qtyPerServing}
                  onChange={(e) =>
                    setRecipeLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, qtyPerServing: parseFloat(e.target.value) || 0 } : l
                      )
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setRecipeLines((prev) => [...prev, { ingredientId: '', qtyPerServing: 0 }])
              }
              className="text-xs text-violet-600 font-bold"
            >
              + Add ingredient line
            </button>
            <button
              type="button"
              onClick={handleSaveRecipe}
              className="block w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-bold"
            >
              Save Recipe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
