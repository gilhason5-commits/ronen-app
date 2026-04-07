import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DishNoteEditor from "@/components/events/DishNoteEditor";

export default function ProducerDishSelector({
  categories = [],
  dishes = [],
  eventDishes = [],
  onDishToggle,
  onDishNoteChange
}) {
  const [searchTerms, setSearchTerms] = useState({});
  const [focusedCategory, setFocusedCategory] = useState(null);

  const { data: subCategoriesData = [] } = useQuery({
    queryKey: ["subCategories"],
    queryFn: () => base44.entities.SubCategory.list("display_order"),
    initialData: []
  });

  const getSelectedDishes = (categoryId) => {
    return eventDishes
      .filter(ed => ed.category_id === categoryId)
      .map(ed => dishes.find(d => d.id === ed.dish_id))
      .filter(Boolean);
  };

  const getSearchResults = (categoryId) => {
    const term = searchTerms[categoryId] || "";
    const isFocused = focusedCategory === categoryId;
    if (!isFocused && !term) return [];

    const selectedIds = eventDishes.map(ed => ed.dish_id);
    const results = dishes.filter(d => {
      return d.categories?.includes(categoryId) &&
        d.active !== false &&
        !selectedIds.includes(d.id) &&
        (term ? d.name.toLowerCase().includes(term.toLowerCase()) : true);
    });

    results.sort((a, b) => {
      const sa = subCategoriesData.find(sc => sc.id === a.sub_category_id);
      const sb = subCategoriesData.find(sc => sc.id === b.sub_category_id);
      return (sa?.display_order ?? 999) - (sb?.display_order ?? 999);
    });
    return results;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-stone-900">בחירת מנות לפי קטגוריה</h3>

      {[...categories]
        .filter(cat => cat.name !== "תת מנה")
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(category => {
          const selected = getSelectedDishes(category.id);
          const results = getSearchResults(category.id);

          return (
            <Card key={category.id} className="border-stone-200">
              <CardHeader className="bg-stone-50 border-b border-stone-200 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{category.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">{selected.length} נבחרו</Badge>
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    placeholder={`חיפוש מנות ב${category.name}...`}
                    value={searchTerms[category.id] || ""}
                    onChange={(e) => setSearchTerms(prev => ({ ...prev, [category.id]: e.target.value }))}
                    onFocus={() => setFocusedCategory(category.id)}
                    onBlur={() => setTimeout(() => setFocusedCategory(null), 200)}
                    className="pl-10"
                  />
                  {results.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {(() => {
                        let lastSub = null;
                        return results.map(dish => {
                          const sub = subCategoriesData.find(sc => sc.id === dish.sub_category_id);
                          const subName = sub?.name || "";
                          const showHeader = subName && subName !== lastSub;
                          lastSub = subName || lastSub;
                          return (
                            <React.Fragment key={dish.id}>
                              {showHeader && (
                                <div className="px-3 py-1.5 bg-stone-100 text-xs font-semibold text-stone-600 sticky top-0">
                                  {subName}
                                </div>
                              )}
                              <div
                                className="flex items-center justify-between p-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-b-0"
                                onClick={() => {
                                  onDishToggle(dish, category.id, true);
                                  setSearchTerms(prev => ({ ...prev, [category.id]: "" }));
                                  setFocusedCategory(null);
                                }}
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm text-stone-900">{dish.name}</p>
                                  {dish.description && (
                                    <p className="text-xs text-stone-500 mt-0.5">{dish.description}</p>
                                  )}
                                </div>
                                <Button type="button" variant="ghost" size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDishToggle(dish, category.id, true);
                                    setSearchTerms(prev => ({ ...prev, [category.id]: "" }));
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
                {selected.length === 0 ? (
                  <p className="text-sm text-stone-500 text-center py-4">לא נבחרו מנות בקטגוריה זו</p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const sorted = [...selected].sort((a, b) => {
                        const sa = subCategoriesData.find(sc => sc.id === a.sub_category_id);
                        const sb = subCategoriesData.find(sc => sc.id === b.sub_category_id);
                        return (sa?.display_order ?? 999) - (sb?.display_order ?? 999);
                      });
                      let lastSub = null;
                      return sorted.map(dish => {
                        const sub = subCategoriesData.find(sc => sc.id === dish.sub_category_id);
                        const subName = sub?.name || "";
                        const showHeader = subName && subName !== lastSub;
                        lastSub = subName || lastSub;
                        return (
                          <React.Fragment key={dish.id}>
                            {showHeader && (
                              <div className="px-2 py-1 text-xs font-semibold text-stone-500 mt-2">{subName}</div>
                            )}
                            <div className="p-3 rounded-lg border bg-emerald-50 border-emerald-200 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-stone-900">{dish.name}</p>
                                  {dish.description && (
                                    <p className="text-xs text-stone-500 mt-0.5">{dish.description}</p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-stone-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => onDishToggle(dish, category.id, false)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              <DishNoteEditor 
                                eventDish={eventDishes.find(e => e.dish_id === dish.id)}
                                onNoteSaved={(edId, noteVal) => {
                                  if (onDishNoteChange) onDishNoteChange(edId, noteVal);
                                }}
                              />
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
    </div>
  );
}