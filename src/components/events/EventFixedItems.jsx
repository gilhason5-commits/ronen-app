import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { fmtCurrency } from "../utils/formatNumbers";
import { useAuth } from "@/lib/AuthContext";
import { getFixedEventQty } from "@/lib/fixedEventItems";

// Fixed per-event items (dishes under a fixed_per_event category). Read-only:
// every event of this type gets each item once at the dish's fixed quantity,
// outside the guest-count driven dish tree. Edit them in "מנות ותפריטים".
export default function EventFixedItems({ dishes = [], hidePrices = false }) {
  const { user } = useAuth();
  if (dishes.length === 0) return null;
  const showPrices = !hidePrices && !user?.hide_financials;

  const rows = dishes.map((d) => {
    const qty = getFixedEventQty(d);
    return { id: d.id, name: d.name, qty, total: qty * (d.unit_cost || 0) };
  });
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <CardTitle className="text-lg">פריטים קבועים (לא בעץ מוצר)</CardTitle>
        <p className="text-sm text-stone-500">נכנסים לכל אירוע פעם אחת, בכמות שמוגדרת במנה</p>
      </CardHeader>
      <CardContent className="p-5 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2">
            <p className="font-medium text-stone-900 truncate">{r.name}</p>
            <div className="flex items-center gap-4 shrink-0 text-sm">
              <span className="text-stone-500">כמות: {r.qty}</span>
              {showPrices && <span className="font-semibold text-stone-900">{fmtCurrency(r.total)}</span>}
            </div>
          </div>
        ))}
        {showPrices && (
          <div className="flex items-center justify-between pt-2 border-t border-stone-200 font-bold text-stone-900">
            <span>סה״כ פריטים קבועים</span>
            <span>{fmtCurrency(total)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
