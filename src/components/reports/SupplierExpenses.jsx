import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronLeft, Truck } from "lucide-react";
import { fmtCurrency } from "../utils/formatNumbers";
import { eventDishSummaryQuery } from "@/lib/eventDishQueries";
import { calcIngredientNeedsPerEvent, formatNumber, formatUnit } from "@/components/kitchen/purchaseUtils";
import LoadingState from "@/components/utils/LoadingState";
import ExVatTag from "./ExVatTag";

// Spend per supplier for the reports page's period. There are no supplier
// invoices in the system, so this is the purchasing engine's calculation
// (same as purchase planning): the period's event menus × recipes, sub-dishes
// expanded, ingredient waste included, at each ingredient's current price and
// supplier.
export default function SupplierExpenses({ events, periodLabel, isLoading: eventsLoading = false }) {
  const [open, setOpen] = useState(null);

  const { data: eventsDishes = [], isLoading: edLoading } = useQuery({ ...eventDishSummaryQuery });
  const { data: dishes = [] } = useQuery({ queryKey: ["dishes"], queryFn: () => base44.entities.Dish.list() });
  const { data: ingredients = [] } = useQuery({ queryKey: ["ingredients"], queryFn: () => base44.entities.Ingredient.list() });
  const { data: specialIngredients = [] } = useQuery({ queryKey: ["specialIngredients"], queryFn: () => base44.entities.SpecialIngredient.list() });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => base44.entities.Category.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list() });

  const rows = useMemo(() => {
    if (!events.length || !dishes.length || !ingredients.length) return [];
    const ids = new Set(events.map((e) => e.id));
    const byEvent = {};
    eventsDishes.forEach((ed) => { if (ids.has(ed.event_id)) (byEvent[ed.event_id] ||= []).push(ed); });
    const { needsPerEvent } = calcIngredientNeedsPerEvent(events, byEvent, dishes, ingredients, specialIngredients, categories, suppliers);

    const supplierName = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
    const groups = {};
    for (const needs of Object.values(needsPerEvent)) {
      for (const n of Object.values(needs)) {
        if (!(n.total_price > 0)) continue;
        const key = n.supplier_id || n.supplier_name || "none";
        const g = (groups[key] ||= {
          key,
          name: supplierName[n.supplier_id] || n.supplier_name || "ללא ספק",
          none: key === "none",
          total: 0,
          items: {},
        });
        g.total += n.total_price;
        const it = (g.items[n.ingredient_id] ||= { id: n.ingredient_id, name: n.ingredient_name, unit: n.unit, price: n.price_per_unit, qty: 0, total: 0 });
        it.qty += n.qty;
        it.total += n.total_price;
      }
    }
    return Object.values(groups)
      .map((g) => ({ ...g, items: Object.values(g.items).sort((a, b) => b.total - a.total) }))
      .sort((a, b) => (a.none - b.none) || (b.total - a.total));
  }, [events, eventsDishes, dishes, ingredients, specialIngredients, categories, suppliers]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const loading = eventsLoading || edLoading;

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Truck className="w-5 h-5 text-stone-500" />
          <CardTitle className="text-lg">הוצאות לפי ספק{periodLabel ? ` · ${periodLabel}` : ""}</CardTitle>
          <span className="text-xs text-stone-500">לפי תפריטי האירועים × מתכונים, כולל פחת רכיבים, במחירי הרכיבים הנוכחיים</span>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {rows.length === 0 ? (
          loading ? <LoadingState className="py-8" /> : <p className="text-sm text-stone-500 text-center py-8">אין אירועים מאושרים בתקופה זו</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const pct = total > 0 ? (r.total / total) * 100 : 0;
              const isOpen = open === r.key;
              return (
                <div key={r.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : r.key)}
                    className="w-full text-right"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className={`font-medium flex items-center gap-1 ${r.none ? "text-amber-700" : "text-stone-700"}`}>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-stone-400" /> : <ChevronLeft className="w-4 h-4 text-stone-400" />}
                        {r.name}
                        <span className="text-xs font-normal text-stone-400">· {r.items.length} רכיבים</span>
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="font-bold text-stone-900">{fmtCurrency(r.total, 0)}</span> <ExVatTag />
                        <span className="text-xs text-stone-500 mr-2">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2">
                      <div className={`${r.none ? "bg-amber-400" : "bg-sky-500"} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-3 mr-5 max-h-96 overflow-auto rounded-lg border border-stone-200">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-xs text-stone-500 sticky top-0">
                          <tr>
                            <th className="text-right font-medium px-3 py-2">רכיב</th>
                            <th className="text-right font-medium px-3 py-2">כמות</th>
                            <th className="text-right font-medium px-3 py-2">מחיר ליחידה</th>
                            <th className="text-right font-medium px-3 py-2">סה״כ <ExVatTag /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.items.map((it) => (
                            <tr key={it.id} className="border-t border-stone-100">
                              <td className="px-3 py-1.5 text-stone-700">{it.name}</td>
                              <td className="px-3 py-1.5 text-stone-600 whitespace-nowrap">{formatNumber(Math.round(it.qty * 10) / 10)} {formatUnit(it.unit)}</td>
                              <td className="px-3 py-1.5 text-stone-600 whitespace-nowrap">{fmtCurrency(it.price)}{it.unit ? ` / ${formatUnit(it.unit)}` : ""}</td>
                              <td className="px-3 py-1.5 font-medium text-stone-900 whitespace-nowrap">{fmtCurrency(it.total, 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="pt-4 border-t border-stone-200 flex justify-between items-center">
              <span className="font-semibold text-stone-900">סה"כ · {rows.filter((r) => !r.none).length} ספקים</span>
              <span className="font-bold text-lg text-stone-900">{fmtCurrency(total, 0)} <ExVatTag /></span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
