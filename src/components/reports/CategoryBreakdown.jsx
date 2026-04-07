import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { UtensilsCrossed } from "lucide-react";
import { fmtCurrency } from "../utils/formatNumbers";

export default function CategoryBreakdown({ events, eventDishes: propEventDishes, getEffectivePlannedCost }) {
  // If eventDishes are passed directly, use them. Otherwise fetch from API
  const { data: fetchedEventsDishes = [] } = useQuery({
    queryKey: ['eventsDishes'],
    queryFn: () => base44.entities.Events_Dish.list(),
    initialData: [],
    enabled: !propEventDishes, // Only fetch if not provided via props
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
    initialData: [],
  });

  // Use prop eventDishes if provided, otherwise filter from fetched data
  let relevantDishes;
  if (propEventDishes) {
    relevantDishes = propEventDishes;
  } else {
    const eventIds = events.map(e => e.id);
    relevantDishes = fetchedEventsDishes.filter(ed => eventIds.includes(ed.event_id));
  }

  // Calculate cost by category
  const categoryTotals = {};
  relevantDishes.forEach(ed => {
    const categoryId = ed.category_id;
    const cost = getEffectivePlannedCost ? getEffectivePlannedCost(ed) : (ed.planned_cost || 0);
    
    if (!categoryTotals[categoryId]) {
      categoryTotals[categoryId] = 0;
    }
    categoryTotals[categoryId] += cost;
  });

  // Create category data with names
  const categoryData = Object.entries(categoryTotals).map(([categoryId, total]) => {
    const category = categories.find(c => c.id === categoryId);
    return {
      id: categoryId,
      name: category?.name || 'לא מוגדר',
      total: total,
      displayOrder: category?.display_order || 999
    };
  });

  // Sort by display order
  categoryData.sort((a, b) => a.displayOrder - b.displayOrder);

  const totalCost = categoryData.reduce((sum, cat) => sum + cat.total, 0);

  if (categoryData.length === 0) {
    return (
      <Card className="border-stone-200">
        <CardHeader className="border-b border-stone-200 p-5">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-stone-500" />
            <CardTitle className="text-lg">עלות לפי קטגוריה</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="text-center py-8">
            <UtensilsCrossed className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm text-stone-500">אין נתונים להצגה</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-stone-500" />
          <CardTitle className="text-lg">עלות לפי קטגוריה</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-4">
          {categoryData.map((cat) => {
            const percentage = totalCost > 0 ? (cat.total / totalCost) * 100 : 0;
            
            return (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-stone-700">{cat.name}</span>
                  <div className="text-right">
                    <span className="font-bold text-stone-900">{fmtCurrency(cat.total)}</span>
                    <span className="text-xs text-stone-500 mr-2">({percentage.toFixed(1)}%)</span>
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
          
          <div className="pt-4 border-t border-stone-200 flex justify-between items-center">
            <span className="font-semibold text-stone-900">סה"כ</span>
            <span className="font-bold text-lg text-stone-900">{fmtCurrency(totalCost)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}