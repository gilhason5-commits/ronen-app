import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Edit2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { formatNumber, formatUnit } from "./purchaseUtils";

export default function DailyOrderTicket({ ticket, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(ticket.items.map(i => ({ ...i })));
  const [deliveryDate, setDeliveryDate] = useState(ticket.deliveryDate || '');

  const handleQtyChange = (idx, newQty) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      purchase_qty: parseFloat(newQty) || 0,
      total_price: (parseFloat(newQty) || 0) * updated[idx].price_per_unit
    };
    setItems(updated);
  };

  const totalPrice = items.reduce((sum, i) => sum + ((i.purchase_qty ?? i.qty) * i.price_per_unit), 0);

  const handlePrint = () => {
    const rows = items.map(item => {
      const wasteLabel = item.waste_pct > 0 ? ` <span style="color:#d32f2f; font-size:10px; font-weight:bold;">(פחת ${item.waste_pct}%)</span>` : '';
      return `
      <tr>
        <td>${item.ingredient_name}${wasteLabel}</td>
        <td style="text-align:center;">${formatNumber(item.qty)} ${formatUnit(item.unit)}</td>
        <td style="text-align:center; font-weight:bold;">${formatNumber(item.purchase_qty ?? item.qty)} ${formatUnit(item.unit)}</td>
      </tr>
    `;
    }).join('');

    const html = `
      <html dir="rtl"><head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&display=swap');
          body { font-family: 'Heebo', sans-serif; direction: rtl; padding: 30px; color: #333; }
          h1 { font-size: 22px; margin-bottom: 5px; }
          .meta { font-size: 13px; color: #555; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { padding: 8px; text-align: right; border-bottom: 2px solid #333; background: #f5f5f5; font-size: 12px; }
          td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
          .total { text-align: left; font-size: 18px; font-weight: bold; margin-top: 15px; padding-top: 10px; border-top: 2px solid #333; }
          @media print { body { padding: 15px; } }
        </style>
      </head><body>
        <h1>הזמנה מ${ticket.supplier.name}</h1>
        <div class="meta"><strong>עבור:</strong> ${ticket.event.event_name}</div>
        <div class="meta"><strong>תאריך אירוע:</strong> ${ticket.event.event_date ? format(new Date(ticket.event.event_date), 'dd/MM/yyyy') : '-'}</div>
        <div class="meta"><strong>סועדים:</strong> ${ticket.event.guest_count || '-'}</div>
        <div class="meta"><strong>תאריך אספקה:</strong> ${deliveryDate ? format(new Date(deliveryDate), 'dd/MM/yyyy') : '-'}</div>
        <div class="meta"><strong>תאריך הפקה:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        <table>
          <thead><tr>
            <th>רכיב</th><th style="text-align:center;">כמות נדרשת</th><th style="text-align:center;">כמות לקנייה</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total">${items.length} פריטים</div>
      </body></html>
    `;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Card className="border-amber-200 bg-white">
      <CardHeader className="pb-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-stone-900">
              {ticket.supplier.name}
            </CardTitle>
            <p className="text-sm text-stone-600 mt-1">
              עבור: <span className="font-semibold">{ticket.event.event_name}</span>
              {' | '}
              {ticket.event.event_date ? format(new Date(ticket.event.event_date), 'dd/MM/yyyy') : '-'}
              {' | '}
              {ticket.event.guest_count} סועדים
            </p>
          </div>
          <Badge className="bg-amber-100 text-amber-700">יומי</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="text-right py-2 font-medium">רכיב</th>
              <th className="text-center py-2 font-medium w-24">כמות נדרשת</th>
              <th className="text-center py-2 font-medium w-24">כמות לקנייה</th>
              <th className="text-center py-2 font-medium w-20">מחיר/יח׳</th>
              <th className="text-center py-2 font-medium w-20">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.ingredient_id} className="border-b border-stone-100">
                <td className="py-2 text-stone-900">
                  {item.ingredient_name}
                  {item.waste_pct > 0 && <span className="text-red-600 text-xs font-bold mr-1">(פחת {item.waste_pct}%)</span>}
                </td>
                <td className="py-2 text-center text-stone-500">
                  {formatNumber(item.qty)} {formatUnit(item.unit)}
                </td>
                <td className="py-2 text-center">
                  {editing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={item.purchase_qty ?? item.qty}
                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                      className="w-24 h-7 text-center text-sm mx-auto"
                    />
                  ) : (
                    <span className="font-semibold">{formatNumber(item.purchase_qty ?? item.qty)} {formatUnit(item.unit)}</span>
                  )}
                </td>
                <td className="py-2 text-center text-stone-600">₪{formatNumber(item.price_per_unit)}</td>
                <td className="py-2 text-center font-semibold">₪{formatNumber((item.purchase_qty ?? item.qty) * item.price_per_unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-200">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <span className="text-stone-600">תאריך אספקה:</span>
            {editing ? (
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-36 h-7 text-sm"
              />
            ) : (
              <span className="font-semibold">{deliveryDate ? format(new Date(deliveryDate), 'dd/MM/yyyy') : '-'}</span>
            )}
          </div>
          <div className="text-lg font-bold text-stone-900">
            סה״כ: ₪{formatNumber(totalPrice)}
          </div>
        </div>

        <div className="flex gap-2 mt-4 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            <Edit2 className="w-3.5 h-3.5 ml-1" />
            {editing ? 'סיום עריכה' : 'עריכה'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
          >
            <Printer className="w-3.5 h-3.5 ml-1" />
            הדפסה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}