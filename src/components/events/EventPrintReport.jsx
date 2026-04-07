import React from 'react';
import { format } from 'date-fns';

const formatNumber = (num, maxDecimals = 2) => {
  if (num === 0) return '0';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(num * factor) / factor;
  return rounded.toString();
};

export default function EventPrintReport({ event, eventDishes, dishes, categories, ingredients, ingredientCategories }) {
  
  const getSelectedDishesGroupedByCategory = () => {
    const grouped = {};
    categories.forEach(cat => {
      const categoryDishes = eventDishes
        .filter(ed => ed.category_id === cat.id)
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

  const isFirstCourseDish = (dish) => {
    const dishCategories = categories.filter(cat => dish.categories?.includes(cat.id));
    return dishCategories.some(cat => {
      const name = cat.name.toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
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
            category_name: ingredient?.ingredient_category_name
          };
        }

        const qtyNeeded = (ing.qty || 0) * plannedQty;
        ingredientMap[key].total_qty += qtyNeeded;

        if (ingredient) {
          ingredientMap[key].cost += qtyNeeded * (ingredient.price_per_system || 0);
        }
      });
    });

    return Object.values(ingredientMap);
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

  const dishesByCategory = getSelectedDishesGroupedByCategory();
  const ingredientsByCategory = getIngredientsByCategory();
  const ingredientsSummary = getIngredientsSummary();
  const totalIngredientsCost = ingredientsSummary.reduce((sum, ing) => sum + ing.cost, 0);

  return (
    <div className="hidden print:block">
      {/* עמוד 1: פרטי האירוע */}
      <div className="page-break-after">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">דוח אירוע</h1>
          <h2 className="text-2xl font-semibold text-stone-700">{event.event_name}</h2>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-4 border-b-2 border-stone-300 pb-2">פרטים כלליים</h3>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold w-1/3">שם האירוע:</td>
                  <td className="py-3">{event.event_name}</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">תאריך:</td>
                  <td className="py-3">{event.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy') : '-'}</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">שעה:</td>
                  <td className="py-3">{event.event_time || '-'}</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">סוג אירוע:</td>
                  <td className="py-3">{event.event_type === 'serving' ? 'אירוע הגשה' : 'אירוע הפוכה'}</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">סטטוס:</td>
                  <td className="py-3">{event.status === 'in_progress' ? 'בתהליך' : 'הושלם'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 border-b-2 border-stone-300 pb-2">נתוני סועדים</h3>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold w-1/3">מספר סועדים:</td>
                  <td className="py-3">{event.guest_count || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 border-b-2 border-stone-300 pb-2">נתונים כספיים</h3>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold w-1/3">מחיר למנה כולל מע״מ:</td>
                  <td className="py-3">₪{(event.price_per_plate || 0).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">הכנסה מאוכל:</td>
                  <td className="py-3">₪{(event.food_revenue || 0).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">עלות אוכל כוללת:</td>
                  <td className="py-3">₪{(event.food_cost_sum || 0).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">אחוז עלות אוכל:</td>
                  <td className="py-3">{(event.food_cost_pct || 0).toFixed(2)}%</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="py-3 font-semibold">רווח גולמי:</td>
                  <td className="py-3">₪{((event.food_revenue || 0) - (event.food_cost_sum || 0)).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {event.notes && (
            <div>
              <h3 className="text-xl font-bold mb-4 border-b-2 border-stone-300 pb-2">הערות</h3>
              <p className="whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* עמוד 2: רשימת מנות לפי קטגוריות */}
      <div className="page-break-after">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">רשימת מנות</h1>
          <h2 className="text-xl text-stone-700">{event.event_name}</h2>
        </div>

        <div className="space-y-8">
          {Object.entries(dishesByCategory).map(([categoryName, categoryDishes]) => (
            <div key={categoryName}>
              <h3 className="text-xl font-bold mb-4 bg-stone-100 p-3 rounded">{categoryName}</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-stone-400">
                    <th className="text-right py-3 font-bold">שם המנה</th>
                    <th className="text-center py-3 font-bold w-24">כמות</th>
                    <th className="text-center py-3 font-bold w-32">אחוז הגשה</th>
                    <th className="text-center py-3 font-bold w-32">עלות ליחידה</th>
                    <th className="text-left py-3 font-bold w-32">עלות כוללת</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryDishes.map(dish => {
                    const isFirstCourse = isFirstCourseDish(dish);
                    return (
                      <tr key={dish.id} className="border-b border-stone-200">
                        <td className="py-3">
                          <div className="font-semibold">{dish.name}</div>
                          {dish.description && (
                            <div className="text-xs text-stone-600 mt-1">{dish.description}</div>
                          )}
                        </td>
                        <td className="text-center py-3">{formatNumber(dish.planned_qty || 0)}</td>
                        <td className="text-center py-3">{dish.serving_percentage || 100}%</td>
                        <td className="text-center py-3">₪{formatNumber(dish.unit_cost || 0)}</td>
                        <td className="text-left py-3 font-bold text-emerald-600">
                          ₪{formatNumber(dish.planned_cost || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      {/* עמוד 3: סיכום מצרכים לפי קטגוריות */}
      <div className="page-break-after">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">סיכום מצרכים</h1>
          <h2 className="text-xl text-stone-700">{event.event_name}</h2>
        </div>

        <div className="space-y-6">
          {Object.entries(ingredientsByCategory).map(([categoryName, ingredients]) => {
            const categoryTotal = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
            return (
              <div key={categoryName}>
                <div className="bg-stone-100 p-3 rounded mb-3 flex justify-between items-center">
                  <h3 className="text-lg font-bold">{categoryName}</h3>
                  <span className="font-bold text-emerald-700">₪{formatNumber(categoryTotal)}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-300">
                      <th className="text-right py-2 font-semibold">שם המצרך</th>
                      <th className="text-center py-2 font-semibold w-32">כמות</th>
                      <th className="text-left py-2 font-semibold w-32">עלות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map(ing => (
                      <tr key={ing.ingredient_id} className="border-b border-stone-200">
                        <td className="py-2">{ing.ingredient_name}</td>
                        <td className="text-center py-2">{formatNumber(ing.total_qty, 3)} {ing.unit}</td>
                        <td className="text-left py-2 font-semibold">₪{formatNumber(ing.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="border-t-2 border-stone-400 pt-4 mt-6">
            <div className="flex justify-between text-xl font-bold">
              <span>סה״כ מצרכים:</span>
              <span className="text-emerald-700">₪{formatNumber(totalIngredientsCost)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* עמודים נפרדים לכל קטגוריית מצרכים */}
      {Object.entries(ingredientsByCategory).map(([categoryName, ingredients], index) => {
        const categoryTotal = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
        const isLastCategory = index === Object.keys(ingredientsByCategory).length - 1;
        
        return (
          <div key={categoryName} className={!isLastCategory ? 'page-break-after' : ''}>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">{categoryName}</h1>
              <h2 className="text-xl text-stone-700">{event.event_name}</h2>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-stone-400">
                  <th className="text-right py-3 font-bold">שם המצרך</th>
                  <th className="text-center py-3 font-bold w-40">כמות</th>
                  <th className="text-center py-3 font-bold w-32">מחיר ליחידה</th>
                  <th className="text-left py-3 font-bold w-32">עלות כוללת</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map(ing => (
                  <tr key={ing.ingredient_id} className="border-b border-stone-200">
                    <td className="py-3 font-semibold">{ing.ingredient_name}</td>
                    <td className="text-center py-3">{formatNumber(ing.total_qty, 3)} {ing.unit}</td>
                    <td className="text-center py-3">₪{formatNumber(ing.total_qty > 0 ? ing.cost / ing.total_qty : 0)}</td>
                    <td className="text-left py-3 font-bold text-emerald-600">₪{formatNumber(ing.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-400">
                  <td colSpan="3" className="py-4 text-xl font-bold">סה״כ {categoryName}:</td>
                  <td className="text-left py-4 text-xl font-bold text-emerald-700">₪{formatNumber(categoryTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}