import React from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

const formatNumber = (num) => {
  if (num === 0) return '0';
  if (Number.isInteger(num)) return num.toString();
  const fixed = Math.round(num * 1000) / 1000;
  return fixed.toFixed(3).replace(/\.?0+$/, '');
};

const formatUnit = (unit) => {
  if (!unit) return '';
  const unitLower = unit.toLowerCase();
  if (unitLower === 'kg' || unitLower === 'kilo') return 'ק״ג';
  if (unitLower === 'g' || unitLower === 'gr' || unitLower === 'gram') return 'גרם';
  if (unitLower === 'l' || unitLower === 'liter' || unitLower === 'litre') return 'ליטר';
  if (unitLower === 'ml') return 'מ״ל';
  if (unitLower === 'unit' || unitLower === 'units' || unitLower === 'pcs') return 'יחידות';
  return unit;
};

export default function SpecialIngredientPrintButton({ specialIngredient }) {
  const handlePrint = () => {
    const si = specialIngredient;
    if (!si?.components?.length) return;

    const comps = si.components || [];
    const compRows = [];
    for (let i = 0; i < comps.length; i += 2) {
      const c1 = comps[i];
      const c2 = comps[i + 1];

      const renderCell = (comp) => {
        if (!comp) return '<td colspan="3"></td>';
        const costText = comp.cost ? `₪${formatNumber(comp.cost)}` : '';
        return `
          <td style="padding: 6px 10px; border-bottom: 1px solid #ddd;">${comp.ingredient_name || 'רכיב'}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; text-align: center;">${formatNumber(comp.qty || 0)} ${formatUnit(comp.unit)}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; text-align: center; color: #555;">${costText}</td>
        `;
      };

      compRows.push(`
        <tr>
          ${renderCell(c1)}
          <td style="border-bottom: 1px solid #ddd; border-right: 3px solid #333; width: 2px;"></td>
          ${renderCell(c2)}
        </tr>
      `);
    }

    const now = new Date();
    const printTimestamp = `${now.toLocaleDateString('he-IL')} ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>${si.name} - תת מנה</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              direction: rtl;
              font-size: 12px;
            }
            @page { margin: 1.5cm 1cm 1cm 1cm; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px solid #2e7d32; padding-bottom: 15px;">
            <h1 style="margin: 0 0 8px 0; font-size: 26px; color: #2e7d32;">${si.name}</h1>
            <div style="font-size: 14px; color: #555;">
              <span style="margin-left: 20px;">כמות למסה: ${formatNumber(si.total_quantity || 0)} ${formatUnit(si.system_unit)}</span>
              <span style="margin-left: 20px;">עלות כוללת: ₪${formatNumber(si.total_cost || 0)}</span>
              <span>מחיר ל${formatUnit(si.system_unit)}: ₪${formatNumber(si.price_per_system_unit || 0)}</span>
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 8px;">${printTimestamp}</div>
          </div>

          ${si.description ? `<div style="margin-bottom: 15px; padding: 8px 12px; background-color: #f5f5f5; border-radius: 4px; font-size: 13px; color: #555;">${si.description}</div>` : ''}

          <div style="margin-bottom: 20px;">
            <div style="background-color: #2e7d32; color: white; padding: 8px 12px; font-weight: bold; font-size: 14px; border-radius: 4px;">
              רכיבים - ${comps.length} פריטים
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 8px 10px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 8px 10px; text-align: center; border-bottom: 2px solid #333; width: 100px;">כמות</th>
                  <th style="padding: 8px 10px; text-align: center; border-bottom: 2px solid #333; width: 80px;">עלות</th>
                  <th style="border-bottom: 2px solid #333; border-right: 3px solid #333; width: 2px;"></th>
                  <th style="padding: 8px 10px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 8px 10px; text-align: center; border-bottom: 2px solid #333; width: 100px;">כמות</th>
                  <th style="padding: 8px 10px; text-align: center; border-bottom: 2px solid #333; width: 80px;">עלות</th>
                </tr>
              </thead>
              <tbody>
                ${compRows.join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 20px; padding: 12px; background-color: #f1f8e9; border: 2px solid #2e7d32; border-radius: 6px;">
            <div style="display: flex; justify-content: space-around; font-size: 14px;">
              <div style="text-align: center;">
                <div style="color: #555; font-size: 11px;">סה״כ עלות</div>
                <div style="font-weight: bold; font-size: 18px;">₪${formatNumber(si.total_cost || 0)}</div>
              </div>
              <div style="text-align: center;">
                <div style="color: #555; font-size: 11px;">כמות כוללת</div>
                <div style="font-weight: bold; font-size: 18px;">${formatNumber(si.total_quantity || 0)} ${formatUnit(si.system_unit)}</div>
              </div>
              <div style="text-align: center;">
                <div style="color: #555; font-size: 11px;">מחיר ל${formatUnit(si.system_unit)}</div>
                <div style="font-weight: bold; font-size: 18px; color: #2e7d32;">₪${formatNumber(si.price_per_system_unit || 0)}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        handlePrint();
      }}
      disabled={!specialIngredient?.components?.length}
      title="הדפסת תת מנה"
    >
      <Printer className="w-3 h-3 ml-2" />
      הדפסה
    </Button>
  );
}