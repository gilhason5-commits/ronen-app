import React, { useRef } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

const formatNum = (num) => {
  if (num === 0) return '0';
  if (Number.isInteger(num)) return num.toString();
  const fixed = Math.round(num * 1000) / 1000;
  return fixed.toFixed(3).replace(/\.?0+$/, '');
};

export default function EventPrintDialog({ 
  open, 
  onOpenChange, 
  event, 
  eventDishes, 
  dishes, 
  categories, 
  ingredients, 
  ingredientCategories 
}) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '_blank');
    
    const eventDate = event.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy') : '-';
    const now = new Date();
    const printTimestamp = `${now.toLocaleDateString('he-IL')} ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    const headerText = `דוח אירוע | ${event.event_name} | ${eventDate} | ${event.guest_count || 0} סועדים`;
    const docTitle = `דוח אירוע - ${event.event_name}`;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>${docTitle}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              padding-top: 70px;
              direction: rtl;
            }
            h1 { font-size: 24px; margin-bottom: 10px; text-align: center; }
            h2 { font-size: 20px; margin-bottom: 15px; text-align: center; color: #555; }
            h1, h2, h3, .category-header { page-break-after: avoid; }
            h3 { font-size: 18px; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #333; }
            table.content-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            table.content-table th, table.content-table td { padding: 8px; text-align: right; border-bottom: 1px solid #ddd; }
            table.content-table th { font-weight: bold; background-color: #f5f5f5; }
            .section { margin-bottom: 30px; }
            .category-header { background-color: #e5e5e5; padding: 14px; margin: 20px 0 10px; font-weight: 900; font-size: 22px; text-decoration: underline; text-underline-offset: 6px; }
            .total-row { font-weight: bold; background-color: #f0f0f0; }
            .cost { color: #059669; font-weight: bold; }
            .page-break { page-break-after: always; }
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
            @page { 
              margin: 1.5cm 1cm 1.5cm 1cm;
              @bottom-center {
                content: "עמוד " counter(page) " מתוך " counter(pages);
                font-size: 9px;
                color: #999;
                font-family: Arial, sans-serif;
              }
            }
            @media print {
              body { padding: 0; padding-top: 50px; }
              .page-break { page-break-after: always; }
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
          ${printContent.innerHTML}
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

  const getSelectedDishesGroupedByCategory = () => {
    const grouped = {};
    categories.forEach(cat => {
      const categoryDishes = eventDishes
        .filter(ed => ed.category_id === cat.id && ed.planned_qty > 0)
        .map(ed => ({
          ...dishes.find(d => d.id === ed.dish_id),
          planned_qty: ed.planned_qty,
          planned_cost: ed.planned_cost
        }))
        .filter(Boolean);
      
      if (categoryDishes.length > 0) {
        grouped[cat.name] = categoryDishes;
      }
    });
    return grouped;
  };

  const getIngredientsSummary = () => {
    const ingredientMap = {};

    eventDishes.forEach(eventDish => {
      const dish = dishes.find(d => d.id === eventDish.dish_id);
      if (!dish || !dish.ingredients) return;

      const plannedQty = eventDish.planned_qty || 0;

      dish.ingredients.forEach(ing => {
        const key = ing.ingredient_id;
        const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
        
        if (!ingredientMap[key]) {
          ingredientMap[key] = {
            ingredient_id: ing.ingredient_id,
            ingredient_name: ingredient?.name || ing.ingredient_name,
            unit: ingredient?.system_unit || ing.unit,
            total_qty: 0,
            cost: 0,
            category_id: ingredient?.ingredient_category_id,
            category_name: ingredient?.ingredient_category_name || ingredient?.category
          };
        }

        const qtyNeeded = (ing.qty || 0) * plannedQty;
        ingredientMap[key].total_qty += qtyNeeded;

        if (ingredient) {
          ingredientMap[key].cost += qtyNeeded * (ingredient.price_per_system || 0);
        }
      });
    });

    return Object.values(ingredientMap).filter(ing => ing.total_qty > 0);
  };

  const getIngredientsByCategory = () => {
    const summary = getIngredientsSummary();
    const grouped = {};

    summary.forEach(ing => {
      const catName = ing.category_name || 'ללא קטגוריה';
      if (!grouped[catName]) {
        grouped[catName] = [];
      }
      grouped[catName].push(ing);
    });

    return grouped;
  };

  if (!event) return null;

  const dishesByCategory = getSelectedDishesGroupedByCategory();
  const ingredientsByCategory = getIngredientsByCategory();
  const ingredientsSummary = getIngredientsSummary();
  const totalIngredientsCost = ingredientsSummary.reduce((sum, ing) => sum + ing.cost, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl">דוח אירוע - {event.event_name}</DialogTitle>
          <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700">
            <Printer className="w-4 h-4 ml-2" />
            הדפס
          </Button>
        </DialogHeader>

        <div ref={printRef} className="text-sm">
          <div className="space-y-8">
          {/* חלק 1: פרטי האירוע */}
          <div className="section">
            <h1>דוח אירוע</h1>
            <h2>{event.event_name}</h2>
            
            <h3>פרטים כלליים</h3>
            <table>
              <tbody>
                <tr>
                  <td className="font-semibold w-1/3">שם האירוע:</td>
                  <td>{event.event_name}</td>
                </tr>
                <tr>
                  <td className="font-semibold">תאריך:</td>
                  <td>{event.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy') : '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">שעה:</td>
                  <td>{event.event_time || '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">סוג אירוע:</td>
                  <td>{event.event_type === 'serving' ? 'אירוע הגשה' : 'אירוע הפוכה'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">מספר סועדים:</td>
                  <td>{event.guest_count || 0}</td>
                </tr>
              </tbody>
            </table>

            <h3>נתונים כספיים</h3>
            <table>
              <tbody>
                <tr>
                  <td className="font-semibold w-1/3">מחיר למנה כולל מע״מ:</td>
                  <td>₪{formatNum(event.price_per_plate || 0)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">הכנסה מאוכל:</td>
                  <td>₪{formatNum(event.food_revenue || 0)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">עלות אוכל כוללת:</td>
                  <td>₪{formatNum(event.food_cost_sum || 0)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">אחוז עלות אוכל:</td>
                  <td>{formatNum(event.food_cost_pct || 0)}%</td>
                </tr>
              </tbody>
            </table>

            {event.notes && (
              <>
                <h3>הערות</h3>
                <p className="whitespace-pre-wrap p-2 bg-stone-50 rounded">{event.notes}</p>
              </>
            )}
          </div>

          <div className="page-break" />

          {/* חלק 2: רשימת מנות */}
          <div className="section">
            <h1>רשימת מנות</h1>
            <h2>{event.event_name}</h2>

            {Object.entries(dishesByCategory).map(([categoryName, categoryDishes]) => (
              <div key={categoryName} className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                <div className="category-header">{categoryName}</div>
                <table>
                  <thead>
                    <tr>
                      <th className="text-right">שם המנה</th>
                      <th className="text-center w-20">כמות</th>
                      <th className="text-center w-28">עלות ליחידה</th>
                      <th className="text-left w-28">עלות כוללת</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryDishes.map(dish => (
                      <tr key={dish.id}>
                        <td>{dish.name}</td>
                        <td className="text-center">{dish.planned_qty || 0}</td>
                        <td className="text-center">₪{formatNum(dish.unit_cost || 0)}</td>
                        <td className="text-left cost">₪{formatNum(dish.planned_cost || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* חלק 3: עמוד נפרד לכל קטגוריית מצרכים - עם פירוט לפי מנות */}
          {Object.entries(ingredientsByCategory).map(([categoryName, ings], index) => {
            const categoryTotal = ings.reduce((sum, ing) => sum + ing.cost, 0);
            
            // Get dishes that use ingredients from this category
            const dishesWithCategoryIngredients = [];
            eventDishes.forEach(eventDish => {
              if (!eventDish.planned_qty || eventDish.planned_qty <= 0) return;
              
              const dish = dishes.find(d => d.id === eventDish.dish_id);
              if (!dish || !dish.ingredients) return;
              
              const dishIngredientsInCategory = dish.ingredients
                .map(ing => {
                  const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
                  if (!ingredient) return null;
                  
                  const ingCatName = ingredient.ingredient_category_name || ingredient.category || 'ללא קטגוריה';
                  
                  const qtyNeeded = (ing.qty || 0) * (eventDish.planned_qty || 0);
                  return {
                    ingredient_name: ingredient?.name || ing.ingredient_name,
                    unit: ingredient?.system_unit || ing.unit,
                    qty_per_unit: ing.qty || 0,
                    planned_qty: eventDish.planned_qty || 0,
                    total_qty: qtyNeeded,
                    category_name: ingCatName
                  };
                })
                .filter(Boolean)
                .filter(ing => ing.category_name === categoryName && ing.total_qty > 0);
              
              const filteredIngredients = dishIngredientsInCategory;
              if (filteredIngredients.length > 0) {
                dishesWithCategoryIngredients.push({
                  dish_name: dish.name,
                  planned_qty: eventDish.planned_qty,
                  ingredients: filteredIngredients
                });
              }
            });

            return (
              <React.Fragment key={categoryName}>
                <div className="page-break" />
                <div className="section">
                  <h1 style={{ fontSize: '30px', fontWeight: '900', backgroundColor: '#e0e0e0', padding: '14px', marginBottom: '15px', pageBreakAfter: 'avoid', textDecoration: 'underline', textUnderlineOffset: '6px' }}>{categoryName}</h1>
                  <h2>{event.event_name}</h2>

                  {/* פירוט לפי מנות */}
                  {dishesWithCategoryIngredients.map((dishData, dishIndex) => (
                    <div key={dishIndex} className="mb-4" style={{ pageBreakInside: 'avoid' }}>
                      <div style={{ backgroundColor: '#f0f0f0', padding: '8px', marginBottom: '5px', fontWeight: 'bold', pageBreakAfter: 'avoid' }}>
                        {dishData.dish_name} ({dishData.planned_qty} מנות)
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th className="text-right">מצרך</th>
                            <th className="text-center w-24">למנה</th>
                            <th className="text-center w-24">כמות</th>
                            <th className="text-left w-28">סה״כ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dishData.ingredients.map((ing, ingIndex) => (
                            <tr key={ingIndex}>
                              <td>{ing.ingredient_name}</td>
                              <td className="text-center">{formatNum(ing.qty_per_unit)} {ing.unit}</td>
                              <td className="text-center">{ing.planned_qty}</td>
                              <td className="text-left">{formatNum(ing.total_qty)} {ing.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {/* סיכום קטגוריה */}
                  <div style={{ borderTop: '3px solid #333', marginTop: '20px', paddingTop: '15px', backgroundColor: '#f5f5f5', padding: '15px', pageBreakInside: 'avoid' }}>
                    <h3 style={{ marginBottom: '15px', fontSize: '20px', fontWeight: 'bold', pageBreakAfter: 'avoid' }}>סה״כ {categoryName}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th className="text-right" style={{ fontSize: '16px' }}>מצרך</th>
                          <th className="text-left w-32" style={{ fontSize: '16px' }}>כמות כוללת</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ings.map(ing => (
                          <tr key={ing.ingredient_id}>
                            <td style={{ fontSize: '15px', fontWeight: '600' }}>{ing.ingredient_name}</td>
                            <td className="text-left" style={{ fontSize: '15px', fontWeight: 'bold' }}>{formatNum(ing.total_qty)} {ing.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* עמוד סיכום כולל */}
          <div className="page-break" />
          <div className="section">
            <h1>סיכום כולל מצרכים</h1>
            <h2>{event.event_name}</h2>
            <table>
              <thead>
                <tr>
                  <th className="text-right">קטגוריה</th>
                  <th className="text-left w-32">עלות</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ingredientsByCategory).map(([categoryName, ings]) => {
                  const categoryTotal = ings.reduce((sum, ing) => sum + ing.cost, 0);
                  return (
                    <tr key={categoryName}>
                      <td>{categoryName}</td>
                      <td className="text-left cost">₪{formatNum(categoryTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td className="py-3 text-lg">סה״כ מצרכים:</td>
                  <td className="text-left py-3 text-lg cost">₪{formatNum(totalIngredientsCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}