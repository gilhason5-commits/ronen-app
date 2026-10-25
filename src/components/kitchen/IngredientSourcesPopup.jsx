import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNumber, formatUnit } from "./purchaseUtils";

// Which dishes an ordered ingredient's quantity comes from, and how much each.
export default function IngredientSourcesPopup({ item, onOpenChange }) {
  const sources = [...(item?.sources || [])].sort((a, b) => b.net_qty - a.net_qty);
  const multiEvent = new Set(sources.map(s => s.event_id)).size > 1;
  const total = sources.reduce((sum, s) => sum + s.net_qty, 0);

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">מאיפה מגיע: {item?.ingredient_name}</DialogTitle>
        </DialogHeader>
        {sources.length === 0 ? (
          <p className="text-center text-stone-500 py-6">אין נתונים להצגה</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="text-right py-2 font-medium">מנה</th>
                {multiEvent && <th className="text-right py-2 font-medium">אירוע</th>}
                <th className="text-center py-2 font-medium w-28">כמות נדרשת</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.key} className="border-b border-stone-100">
                  <td className="py-2 text-stone-900">
                    {s.dish_name}
                    {s.via && <div className="text-xs text-stone-500">דרך תת מנה: {s.via}</div>}
                  </td>
                  {multiEvent && <td className="py-2 text-stone-600">{s.event_name}</td>}
                  <td className="py-2 text-center font-semibold">{formatNumber(s.net_qty)} {formatUnit(item.unit)}</td>
                </tr>
              ))}
              <tr className="font-bold text-emerald-700">
                <td className="py-2" colSpan={multiEvent ? 2 : 1}>סה״כ</td>
                <td className="py-2 text-center">{formatNumber(total)} {formatUnit(item.unit)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {item?.waste_pct > 0 && (
          <p className="text-xs text-stone-500">לפני פחת רכיב {item.waste_pct}%</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
