import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle, X, Pencil, Printer } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import DishDialog from "@/components/dishes/DishDialog";
import { fmtCurrency } from "@/components/utils/formatNumbers";
import DishNoteEditor from "@/components/events/DishNoteEditor";

export default function EventStages({ 
  event, 
  categories = [], 
  dishes = [],
  eventDishes = [],
  onDishToggle,
  onEventDishUpdate
}) {
  const { data: dishNotes = [] } = useQuery({
    queryKey: ["all_dish_notes", event?.id],
    queryFn: () => base44.entities.EventDishNote.filter({ event_id: event.id }),
    enabled: !!event?.id,
  });
  const [searchTerms, setSearchTerms] = useState({});
  const [showDishDialog, setShowDishDialog] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [focusedCategory, setFocusedCategory] = useState(null);

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: []
  });

  const { data: specialIngredients = [] } = useQuery({
    queryKey: ['specialIngredients'],
    queryFn: () => base44.entities.SpecialIngredient.list(),
    initialData: []
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: []
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: () => base44.entities.Ingredient_Category.list(),
    initialData: []
  });

  const { data: subCategoriesData = [] } = useQuery({
    queryKey: ['subCategories'],
    queryFn: () => base44.entities.SubCategory.list('display_order'),
    initialData: []
  });

  const handleSearchChange = (categoryId, value) => {
    setSearchTerms(prev => ({ ...prev, [categoryId]: value }));
  };

  const getSelectedDishesForCategory = (categoryId) => {
    return eventDishes
      .filter(ed => ed.category_id === categoryId)
      .map(ed => dishes.find(d => d.id === ed.dish_id))
      .filter(Boolean);
  };

  const getSearchResultsForCategory = (categoryId) => {
    const searchTerm = searchTerms[categoryId] || '';
    const isFocused = focusedCategory === categoryId;
    
    if (!isFocused && !searchTerm) return [];
    
    const selectedDishIds = eventDishes.map(ed => ed.dish_id);
    
    const results = dishes.filter(dish => {
      const hasCategory = dish.categories?.includes(categoryId);
      const isActive = dish.active !== false;
      const notSelected = !selectedDishIds.includes(dish.id);
      const matchesSearch = searchTerm ? dish.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      return hasCategory && isActive && notSelected && matchesSearch;
    });
    
    // Sort by sub-category order
    results.sort((a, b) => {
      const subCatA = subCategoriesData.find(sc => sc.id === a.sub_category_id);
      const subCatB = subCategoriesData.find(sc => sc.id === b.sub_category_id);
      return (subCatA?.display_order ?? 999) - (subCatB?.display_order ?? 999);
    });
    
    return results;
  };

  const isDishSelected = (dishId) => {
    return eventDishes.some(ed => ed.dish_id === dishId);
  };

  const getEventDish = (dishId) => {
    return eventDishes.find(ed => ed.dish_id === dishId);
  };

  const isFirstCourseDish = (dish) => {
    const dishCategories = categories.filter(cat => dish.categories?.includes(cat.id));
    return dishCategories.some(cat => {
      const name = cat.name.toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
  };

  const calculateSuggestedQuantity = (dish) => {
    const guestCount = event?.guest_count || 0;
    const servingPercentage = dish.serving_percentage ?? 100;
    
    // Check if dish has new preparation_mass_grams and portion_size_grams fields
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      // New calculation: portions per preparation
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      // Total portions needed (considering serving percentage)
      const totalPortionsNeeded = guestCount * (servingPercentage / 100);
      // Number of preparations needed
      return Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    }
    
    // Old calculation (for backward compatibility)
    // For wedding events, skip the 1/6 first course division
    const isWedding = event?.event_type === 'wedding';
    const portionFactor = (!isWedding && isFirstCourseDish(dish)) ? 1/6 : (dish.portion_factor ?? 1);
    // Formula: planned_qty = (guest_count × serving_percentage/100 × portion_factor)
    const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
    
    return Math.ceil(rawQuantity);
  };

  const handleEditDish = (e, dish) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingDish(dish);
    setShowDishDialog(true);
  };

  const handlePrintStages = () => {
    const eventDate = event?.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy') : '-';
    const now = new Date();
    const printTimestamp = `${now.toLocaleDateString('he-IL')} ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;

    let html = '';
    categories.filter(cat => cat.name !== 'תת מנה').sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).forEach(category => {
      const selectedDishesRaw = eventDishes
        .filter(ed => ed.category_id === category.id)
        .map(ed => {
          const dish = dishes.find(d => d.id === ed.dish_id);
          if (!dish) return null;
          const qty = calculateSuggestedQuantity(dish);
          const cost = qty * (dish.unit_cost || 0);
          const subCat = subCategoriesData.find(sc => sc.id === dish.sub_category_id);
          return { ...dish, planned_qty: qty, cost, subCatOrder: subCat?.display_order ?? 999, subCatName: subCat?.name || '' };
        })
        .filter(Boolean)
        .sort((a, b) => a.subCatOrder - b.subCatOrder || b.cost - a.cost);

      if (selectedDishesRaw.length === 0) return;

      // Group by sub-category
      let rows = '';
      let lastSubCat = null;
      selectedDishesRaw.forEach(d => {
        if (d.subCatName && d.subCatName !== lastSubCat) {
          rows += `<tr><td colspan="3" style="background:#f0f0f0; font-weight:bold; padding:6px 10px; font-size:13px; border-bottom:2px solid #ccc;">${d.subCatName}</td></tr>`;
          lastSubCat = d.subCatName;
        }
        rows += `
          <tr>
            <td>${d.name}${d.description ? `<br><span class="desc">${d.description}</span>` : ''}</td>
            <td class="text-center">${d.planned_qty}</td>
            <td class="text-center">${d.serving_percentage || 100}%</td>
          </tr>
        `;
      });

      html += `
        <div class="category-section">
          <div class="category-header">${category.name} (${selectedDishesRaw.length} מנות)</div>
          <table>
            <thead>
              <tr>
                <th class="text-right">שם המנה</th>
                <th class="text-center" style="width:60px">כמות</th>
                <th class="text-center" style="width:80px">אחוז הגשה</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>מנות אירוע - ${event?.event_name || ''}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; padding-top: 60px; direction: rtl; font-size: 13px; }
            .fixed-header { position: fixed; top: 0; right: 0; left: 0; background: white; z-index: 1000; border-bottom: 2px solid #333; padding: 8px 12px; }
            .fixed-header-inner { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: bold; }
            .fixed-header-right { display: flex; align-items: center; gap: 6px; }
            .fixed-header-time { color: #777; font-size: 10px; font-weight: normal; }
            .category-section { margin-bottom: 20px; page-break-inside: avoid; }
            .category-header { background: #e5e5e5; padding: 10px 14px; font-weight: 900; font-size: 18px; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 7px 10px; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; font-weight: bold; font-size: 12px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            
            .desc { font-size: 11px; color: #888; }
            
            @page { 
              margin: 1.5cm 1cm 1.5cm 1cm;
              @bottom-center {
                content: "עמוד " counter(page) " מתוך " counter(pages);
                font-size: 9px;
                color: #999;
                font-family: Arial, sans-serif;
              }
            }
            @media print { body { padding: 0; padding-top: 50px; } .fixed-header { padding: 6px 0; } }
          </style>
        </head>
        <body>
          <div class="fixed-header">
            <div class="fixed-header-inner">
              <div class="fixed-header-right">
                <span>${event?.event_name || ''}</span> | <span>${eventDate}</span> | <span>${event?.event_time || '-'}</span> | <span>${event?.guest_count || 0} סועדים</span>
              </div>
              <span class="fixed-header-time">${printTimestamp}</span>
            </div>
          </div>
          ${html}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 mb-2">בחירת מנות לפי קטגוריה</h3>
          <p className="text-sm text-stone-500">
            בחר מנות לאירוע זה. הכמויות מחושבות אוטומטית על בסיס מספר הסועדים וגודל המנות.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrintStages} className="shrink-0">
          <Printer className="w-4 h-4 ml-1" />
          הדפס מנות
        </Button>
      </div>

      {[...categories].filter(cat => cat.name !== 'תת מנה').sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(category => {
        const selectedDishes = getSelectedDishesForCategory(category.id);
        const searchResults = getSearchResultsForCategory(category.id);

        return (
          <Card key={category.id} className="border-stone-200">
            <CardHeader className="bg-stone-50 border-b border-stone-200 p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-stone-900">
                  {category.name}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {selectedDishes.length} נבחרו
                </Badge>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  placeholder={`חיפוש והוספת מנות ב${category.name}...`}
                  value={searchTerms[category.id] || ''}
                  onChange={(e) => handleSearchChange(category.id, e.target.value)}
                  onFocus={() => setFocusedCategory(category.id)}
                  onBlur={() => setTimeout(() => setFocusedCategory(null), 200)}
                  className="pl-10"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {(() => {
                      let lastDropdownSubCat = null;
                      return searchResults.map(dish => {
                        const subCat = subCategoriesData.find(sc => sc.id === dish.sub_category_id);
                        const subCatName = subCat?.name || '';
                        const showHeader = subCatName && subCatName !== lastDropdownSubCat;
                        lastDropdownSubCat = subCatName || lastDropdownSubCat;
                        return (
                          <React.Fragment key={dish.id}>
                            {showHeader && (
                              <div className="px-3 py-1.5 bg-stone-100 text-xs font-semibold text-stone-600 sticky top-0">
                                {subCatName}
                              </div>
                            )}
                            <div
                              className="flex items-center justify-between p-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-b-0"
                              onClick={() => {
                                onDishToggle(dish, category.id, true);
                                setSearchTerms(prev => ({ ...prev, [category.id]: '' }));
                                setFocusedCategory(null);
                              }}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm text-stone-900">{dish.name}</p>
                                {dish.description && (
                                  <p className="text-xs text-stone-500 mt-0.5">{dish.description}</p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDishToggle(dish, category.id, true);
                                  setSearchTerms(prev => ({ ...prev, [category.id]: '' }));
                                  setFocusedCategory(null);
                                }}
                              >
                                <PlusCircle className="w-4 h-4 ml-1" />
                                הוסף
                              </Button>
                            </div>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {selectedDishes.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-4">לא נבחרו מנות בקטגוריה זו</p>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const enriched = [...selectedDishes].map(dish => {
                      const suggestedQty = calculateSuggestedQuantity(dish);
                      const cost = suggestedQty * (dish.unit_cost || 0);
                      const subCat = subCategoriesData.find(sc => sc.id === dish.sub_category_id);
                      return { dish, suggestedQty, cost, subCatOrder: subCat?.display_order ?? 999, subCatName: subCat?.name || '' };
                    });
                    enriched.sort((a, b) => a.subCatOrder - b.subCatOrder || b.cost - a.cost);
                    
                    let lastSubCat = null;
                    return enriched.map(({ dish, suggestedQty, cost, subCatName }) => {
                      const showSubCatHeader = subCatName && subCatName !== lastSubCat;
                      lastSubCat = subCatName || lastSubCat;
                      return (
                        <React.Fragment key={dish.id}>
                          {showSubCatHeader && (
                            <div className="text-sm font-semibold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-md -mx-1">
                              {subCatName}
                            </div>
                          )}
                          <div className="p-3 rounded-lg border bg-emerald-50 border-emerald-200">
                            <div className="flex items-start gap-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-stone-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => onDishToggle(dish, category.id, false)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-stone-900">{dish.name}</p>
                                    {dish.description && (
                                      <p className="text-xs text-stone-500 mt-0.5">{dish.description}</p>
                                    )}
                                    {(() => {
                                      const ed = eventDishes.find(e => e.dish_id === dish.id);
                                      const noteRec = ed ? dishNotes.find(n => n.event_dish_id === ed.id) : null;
                                      return noteRec?.note ? (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                                          💬 הערת מפיק: {noteRec.note}
                                        </p>
                                      ) : null;
                                    })()}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-emerald-600">
                                      {fmtCurrency(cost)}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs text-stone-600">כמות</Label>
                                    <p className="text-sm font-semibold text-stone-900 mt-1">
                                      {suggestedQty}
                                    </p>
                                  </div>
                                  <div className="flex flex-col justify-between">
                                    <div className="text-xs text-stone-600 space-y-0.5">
                                      {isFirstCourseDish(dish) ? (
                                        <>
                                          <p>מחיר למנה: {fmtCurrency(dish.price_per_guest || 0)}</p>
                                          <p>אחוז הגשה: {dish.serving_percentage || 100}%</p>
                                          <p>עלות ליחידה: {fmtCurrency(dish.unit_cost || 0)}</p>
                                        </>
                                      ) : (
                                        <>
                                          <p>אחוז הגשה: {dish.serving_percentage || 100}%</p>
                                          <p>עלות ליחידה: {fmtCurrency(dish.unit_cost || 0)}</p>
                                        </>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="mt-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      onClick={(e) => handleEditDish(e, dish)}
                                    >
                                      <Pencil className="w-3 h-3 ml-1" />
                                      עריכת מנה
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {showDishDialog && editingDish && (
        <DishDialog
          dish={editingDish}
          eventType={editingDish?.event_type || 'serving'}
          ingredients={ingredients}
          specialIngredients={specialIngredients}
          categories={categories}
          subCategories={subCategoriesData}
          suppliers={suppliers}
          ingredientCategories={ingredientCategories}
          open={showDishDialog}
          onClose={() => {
            setShowDishDialog(false);
            setEditingDish(null);
          }}
        />
      )}
    </div>
  );
}