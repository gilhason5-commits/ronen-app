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

export default function DishPrintButton({ dish, ingredients = [], specialIngredients = [] }) {
  const handlePrint = () => {
    if (!dish?.ingredients?.length) return;

    const allItems = (dish.ingredients || []).map(ing => {
      const si = specialIngredients.find(s => s.id === ing.ingredient_id);
      if (si) {
        return {
          ingredient_name: si.name,
          unit: si.system_unit,
          qty: ing.qty || 0,
          is_special: true,
          specialIngredient: si
        };
      }
      const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
      return {
        ingredient_name: ingredient?.name || ing.ingredient_name || 'רכיב',
        unit: ingredient?.system_unit || ing.unit || '',
        qty: ing.qty || 0,
        is_special: false
      };
    });

    // Build two-column ingredient rows (same style as department report)
    const ingredientRows = [];
    for (let i = 0; i < allItems.length; i += 2) {
      const ing1 = allItems[i];
      const ing2 = allItems[i + 1];

      const renderCell = (ing) => {
        if (!ing) return '<td colspan="2"></td>';
        const bgStyle = ing.is_special ? 'background-color: #f1f8e9;' : '';
        const nameExtra = ing.is_special
          ? '<span style="color: #2e7d32; font-size: 9px; font-weight: bold;"> (תת מנה)</span>'
          : '';
        return `
          <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; ${bgStyle}">
            ${ing.ingredient_name}${nameExtra}
          </td>
          <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center; ${bgStyle}">${formatNumber(ing.qty)} ${formatUnit(ing.unit)}</td>
        `;
      };

      ingredientRows.push(`
        <tr>
          ${renderCell(ing1)}
          <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; border-right: 3px solid #333; width: 2px;"></td>
          ${renderCell(ing2)}
        </tr>
      `);
    }

    // Build special ingredient breakdown sections
    let specialSectionsHtml = '';
    const specialItems = allItems.filter(item => item.is_special && item.specialIngredient);
    if (specialItems.length > 0) {
      const siHtml = specialItems.map(item => {
        const si = item.specialIngredient;
        const comps = si.components || [];
        const compRows = [];
        for (let i = 0; i < comps.length; i += 2) {
          const c1 = comps[i];
          const c2 = comps[i + 1];
          let rightCells = '<td colspan="2"></td>';
          if (c2) {
            rightCells = `
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd;">${c2.ingredient_name || 'רכיב'}</td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center;">${formatNumber(c2.qty || 0)} ${formatUnit(c2.unit)}</td>
            `;
          }
          compRows.push(`
            <tr>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd;">${c1.ingredient_name || 'רכיב'}</td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center;">${formatNumber(c1.qty || 0)} ${formatUnit(c1.unit)}</td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; border-right: 3px solid #333; width: 2px;"></td>
              ${rightCells}
            </tr>
          `);
        }

        return `
          <div style="margin-bottom: 15px; page-break-inside: avoid;">
            <div style="background-color: #2e7d32; color: white; padding: 8px 12px; font-weight: bold; font-size: 14px; border-radius: 4px;">
              ${si.name} - מסה אחת (${formatNumber(si.total_quantity || 0)} ${formatUnit(si.system_unit)})
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 0;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">כמות למסה</th>
                  <th style="border-bottom: 2px solid #333; border-right: 3px solid #333; width: 2px;"></th>
                  <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">כמות למסה</th>
                </tr>
              </thead>
              <tbody>
                ${compRows.join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

      specialSectionsHtml = `
        <div style="margin-top: 20px; border-top: 3px solid #2e7d32; padding-top: 10px;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; background-color: #2e7d32; color: white; padding: 8px; text-align: center;">תת מנות</h3>
          ${siHtml}
        </div>
      `;
    }

    // Additional info
    const deptLabel = dish.operations_department === 'hot_kitchen' ? 'מטבח חם' :
      dish.operations_department === 'cold_kitchen' ? 'מטבח קר' :
      dish.operations_department === 'pastry' ? 'קונדיטוריה' : '';

    const massInfo = dish.preparation_mass_grams && dish.portion_size_grams
      ? `<span style="margin-right: 20px;">משקל הכנה: ${formatNumber(dish.preparation_mass_grams)} גרם | מנה: ${formatNumber(dish.portion_size_grams)} גרם</span>`
      : '';

    const now = new Date();
    const printTimestamp = `${now.toLocaleDateString('he-IL')} ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    const headerText = `${dish.name} | ${deptLabel ? deptLabel + ' | ' : ''}עלות: ₪${formatNumber(dish.unit_cost || 0)}`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>${dish.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              padding-top: 70px;
              direction: rtl;
              font-size: 12px;
            }
            .fixed-header {
              position: fixed;
              top: 0;
              right: 0;
              left: 0;
              background: white;
              z-index: 1000;
              padding: 8px 1cm;
              border-bottom: 2px solid #333;
            }
            .fixed-header-inner {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 11px;
            }
            .fixed-header-title {
              font-weight: bold;
              font-size: 13px;
            }
            .fixed-header-meta {
              color: #555;
              font-size: 10px;
            }
            @page { margin: 1.5cm 1cm 1cm 1cm; }
            @media print {
              body { padding: 0; padding-top: 50px; }
              .fixed-header {
                padding: 6px 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="fixed-header">
            <div class="fixed-header-inner">
              <span class="fixed-header-title">${headerText}</span>
              <span class="fixed-header-meta">${printTimestamp}</span>
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px solid #333; padding-bottom: 15px;">
            <h1 style="margin: 0 0 5px 0; font-size: 24px;">${dish.name}</h1>
            <div style="font-size: 14px; color: #555;">
              ${deptLabel ? `<span style="margin-left: 20px;">מחלקה: ${deptLabel}</span>` : ''}
              <span style="margin-left: 20px;">עלות: ₪${formatNumber(dish.unit_cost || 0)}</span>
              ${massInfo}
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <div style="background-color: #e0e0e0; padding: 8px 12px; font-weight: bold; font-size: 14px; border-radius: 4px;">
              רכיבים - ${dish.ingredients?.length || 0} פריטים
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">כמות למנה</th>
                  <th style="border-bottom: 2px solid #333; border-right: 3px solid #333; width: 2px;"></th>
                  <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">כמות למנה</th>
                </tr>
              </thead>
              <tbody>
                ${ingredientRows.join('')}
              </tbody>
            </table>
          </div>

          ${specialSectionsHtml}

          ${dish.recipe ? `
            <div style="margin-top: 20px; border-top: 3px solid #333; padding-top: 15px;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; background-color: #333; color: white; padding: 8px; text-align: center;">הוראות הכנה</h3>
              <div style="padding: 10px; font-size: 13px; line-height: 1.8; white-space: pre-wrap;">${dish.recipe}</div>
            </div>
          ` : ''}
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
      disabled={!dish?.ingredients?.length}
      title="הדפסת מנה"
    >
      <Printer className="w-3 h-3 mr-2" />
      הדפסה
    </Button>
  );
}