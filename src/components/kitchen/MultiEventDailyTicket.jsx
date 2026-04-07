import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Edit2, Calendar, Users } from "lucide-react";
import { format, subDays } from "date-fns";
import { he } from 'date-fns/locale';
import { formatNumber, formatUnit } from "./purchaseUtils";

export default function MultiEventDailyTicket({ group }) {
  const { supplier, eventSections: initialSections } = group;
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState(
    initialSections.map(s => ({
      event: s.event,
      items: s.items.map(i => ({ ...i })),
      deliveryDate: s.deliveryDate || ''
    }))
  );

  const handleQtyChange = (sectionIdx, itemIdx, newQty) => {
    setSections(prev => {
      const updated = [...prev];
      const section = { ...updated[sectionIdx] };
      const items = [...section.items];
      items[itemIdx] = {
        ...items[itemIdx],
        purchase_qty: parseFloat(newQty) || 0,
        total_price: (parseFloat(newQty) || 0) * items[itemIdx].price_per_unit
      };
      section.items = items;
      updated[sectionIdx] = section;
      return updated;
    });
  };

  const handleDeliveryDateChange = (sectionIdx, newDate) => {
    setSections(prev => {
      const updated = [...prev];
      updated[sectionIdx] = { ...updated[sectionIdx], deliveryDate: newDate };
      return updated;
    });
  };

  const grandTotal = sections.reduce((sum, section) =>
    sum + section.items.reduce((s, i) => s + ((i.purchase_qty ?? i.qty) * i.price_per_unit), 0)
  , 0);

  const handlePrint = () => {
    const sectionsHtml = sections.map(section => {
      const rows = section.items.map(item => {
        const wasteLabel = item.waste_pct > 0 ? ` <span style="color:#d32f2f; font-size:10px; font-weight:bold;">(פחת ${item.waste_pct}%)</span>` : '';
        return `
          <tr>
            <td>${item.ingredient_name}${wasteLabel}</td>
            <td style="text-align:center;">${formatNumber(item.qty)} ${formatUnit(item.unit)}</td>
            <td style="text-align:center; font-weight:bold;">${formatNumber(item.purchase_qty ?? item.qty)} ${formatUnit(item.unit)}</td>
          </tr>
        `;
      }).join('');

      const sectionTotal = section.items.reduce((s, i) => s + ((i.purchase_qty ?? i.qty) * i.price_per_unit), 0);

      return `
        <div style="margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #fff8e1; padding: 10px 14px; border-bottom: 1px solid #ddd;">
            <div style="font-weight: bold; font-size: 14px;">${section.event.event_name}</div>
            <div style="font-size: 12px; color: #555;">
              ${section.event.guest_count || '-'} סועדים | 
              תאריך אירוע: ${section.event.event_date ? format(new Date(section.event.event_date), 'dd/MM/yyyy') : '-'}
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr>
              <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #ddd; background:#f5f5f5; font-size:11px;">רכיב</th>
              <th style="padding:6px 8px; text-align:center; border-bottom:1px solid #ddd; background:#f5f5f5; font-size:11px;">כמות נדרשת</th>
              <th style="padding:6px 8px; text-align:center; border-bottom:1px solid #ddd; background:#f5f5f5; font-size:11px;">כמות לקנייה</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="padding: 8px 14px; border-top: 1px solid #ddd; font-size: 12px; display: flex; justify-content: space-between;">
            <span><strong>תאריך אספקה:</strong> ${section.deliveryDate ? format(new Date(section.deliveryDate), 'dd/MM/yyyy') : '-'}</span>
            <span>${section.items.length} פריטים</span>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <html dir="rtl"><head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&display=swap');
          body { font-family: 'Heebo', sans-serif; direction: rtl; padding: 30px; color: #333; }
          h1 { font-size: 22px; margin-bottom: 5px; }
          .meta { font-size: 13px; color: #555; margin-bottom: 10px; }
          @media print { body { padding: 15px; } }
        </style>
      </head><body>
        <h1>הזמנה מ${supplier.name}</h1>
        <div class="meta"><strong>תאריך הפקה:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        ${sectionsHtml}
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
          <CardTitle className="text-base font-bold text-stone-900">
            {supplier.name}
          </CardTitle>
          <Badge className="bg-amber-100 text-amber-700">יומי</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sections.map((section, sectionIdx) => (
          <div key={section.event.id} className={sectionIdx > 0 ? 'border-t-2 border-amber-200' : ''}>
            {/* Event header */}
            <div className="bg-amber-50/60 px-4 py-3 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-900">{section.event.event_name}</span>
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 ml-1" />
                  {section.event.guest_count} סועדים
                </Badge>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                תאריך אירוע: {section.event.event_date ? format(new Date(section.event.event_date), 'EEEE, dd/MM/yyyy', { locale: he }) : '-'}
              </p>
            </div>

            {/* Items table */}
            <div className="px-4 py-2">
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
                  {section.items.map((item, itemIdx) => (
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
                            onChange={(e) => handleQtyChange(sectionIdx, itemIdx, e.target.value)}
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
            </div>

            {/* Section footer: delivery date + section total */}
            <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-stone-400" />
                <span className="text-stone-600">תאריך אספקה:</span>
                {editing ? (
                  <Input
                    type="date"
                    value={section.deliveryDate}
                    onChange={(e) => handleDeliveryDateChange(sectionIdx, e.target.value)}
                    className="w-36 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold">{section.deliveryDate ? format(new Date(section.deliveryDate), 'dd/MM/yyyy') : '-'}</span>
                )}
              </div>
              <div className="text-sm font-bold text-stone-800">
                סה״כ: ₪{formatNumber(section.items.reduce((s, i) => s + ((i.purchase_qty ?? i.qty) * i.price_per_unit), 0))}
              </div>
            </div>
          </div>
        ))}

        {/* Grand total + actions */}
        <div className="px-4 py-4 border-t-2 border-amber-200">
          {sections.length > 1 && (
            <div className="text-lg font-bold text-stone-900 mb-3">
              סה״כ כולל: ₪{formatNumber(grandTotal)}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              <Edit2 className="w-3.5 h-3.5 ml-1" />
              {editing ? 'סיום עריכה' : 'עריכה'}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5 ml-1" />
              הדפסה
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}