import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ARAPStatus({ overdueAR, dueAP, customerInvoices, supplierInvoices }) {
  const totalAR = customerInvoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.balance || inv.total || 0), 0);

  const totalAP = supplierInvoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.balance || inv.total || 0), 0);

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <CardTitle className="text-lg">סטטוס פיננסי</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <Link to={createPageUrl("CustomerInvoices")}>
          <div className="p-4 rounded-xl border border-stone-200 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-sm text-stone-700">חשבונות לגבייה</span>
              </div>
              {overdueAR.length > 0 && (
                <Badge className="bg-red-100 text-red-700 text-xs">
                  {overdueAR.length} באיחור
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-stone-900">
              ₪{totalAR.toFixed(2)}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              תשלומי לקוחות שטרם נתקבלו
            </p>
          </div>
        </Link>

        <Link to={createPageUrl("SupplierInvoices")}>
          <div className="p-4 rounded-xl border border-stone-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm text-stone-700">חשבונות לתשלום</span>
              </div>
              {dueAP.length > 0 && (
                <Badge className="bg-orange-100 text-orange-700 text-xs">
                  {dueAP.length} ממתינים
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-stone-900">
              ₪{totalAP.toFixed(2)}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              חשבונות ספקים שטרם שולמו
            </p>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}