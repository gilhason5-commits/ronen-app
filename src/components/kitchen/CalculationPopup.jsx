import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNumber, formatUnit } from "./purchaseUtils";

export default function CalculationPopup({ open, onOpenChange, supplierName, items, perEvent }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">פירוט חישוב - {supplierName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {items.map(item => {
            const breakdown = perEvent?.[item.ingredient_id] || [];
            if (breakdown.length === 0) return null;

            const totalQty = breakdown.reduce((sum, b) => sum + b.qty, 0);

            return (
              <div key={item.ingredient_id} className="bg-stone-50 rounded-lg p-4 border">
                <h4 className="font-bold text-stone-900 mb-2">{item.ingredient_name}</h4>
                <div className="space-y-1">
                  {breakdown.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-sm text-stone-700">
                      {idx > 0 && <span className="text-stone-400 font-bold">+</span>}
                      <span className="font-semibold">{formatNumber(b.qty)} {formatUnit(item.unit)}</span>
                      <span className="text-stone-500">({b.event_name})</span>
                    </div>
                  ))}
                  <div className="border-t border-stone-300 mt-2 pt-2 flex items-center gap-1 text-sm font-bold text-emerald-700">
                    <span>=</span>
                    <span>{formatNumber(totalQty)} {formatUnit(item.unit)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <p className="text-center text-stone-500 py-6">אין נתונים להצגה</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}