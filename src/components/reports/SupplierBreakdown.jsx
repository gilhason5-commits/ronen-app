import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { fmtCurrency } from "../utils/formatNumbers";

export default function SupplierBreakdown({ purchaseOrders }) {
  const supplierTotals = {};
  
  (purchaseOrders || []).forEach(po => {
    if (po.status !== 'cancelled' && po.status !== 'draft') {
      const supplier = po.supplier_name || 'Unknown';
      supplierTotals[supplier] = (supplierTotals[supplier] || 0) + (po.subtotal || 0);
    }
  });

  const sortedSuppliers = Object.entries(supplierTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const total = sortedSuppliers.reduce((sum, [, amount]) => sum + amount, 0);

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <CardTitle className="text-lg">הוצאות לפי ספק</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-3">
          {sortedSuppliers.map(([supplier, amount]) => {
            const percentage = total > 0 ? (amount / total) * 100 : 0;

            return (
              <div key={supplier} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-900">{supplier}</span>
                  <div className="text-right">
                    <p className="font-semibold text-stone-900">{fmtCurrency(amount)}</p>
                    <p className="text-xs text-stone-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
          {sortedSuppliers.length === 0 && (
            <p className="text-center text-stone-500 py-8">אין נתוני ספקים זמינים</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}