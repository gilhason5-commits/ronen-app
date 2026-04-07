import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Package, CookingPot } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const formatNumber = (num, maxDecimals = 3) => {
  if (num === 0) return '0';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(num * factor) / factor;
  return rounded.toString();
};

export default function IngredientSummaryByCategory({ eventDetails, eventDishes = [], dishes = [] }) {
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: []
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: () => base44.entities.Ingredient_Category.list(),
    initialData: []
  });

  if (!eventDetails || eventDishes.length === 0) {
    return null;
  }

  const { event_name, event_date, guest_count } = eventDetails;

  // Group ingredients by category and then by dish
  const summaryByCategory = {};

  eventDishes.forEach(eventDish => {
    const dish = dishes.find(d => d.id === eventDish.dish_id);
    if (!dish || !dish.ingredients) return;

    const plannedQty = eventDish.planned_qty || 0;
    if (plannedQty <= 0) return;

    dish.ingredients.forEach(dishIng => {
      const ingredient = ingredients.find(ing => ing.id === dishIng.ingredient_id);
      if (!ingredient) return;

      const categoryId = ingredient.ingredient_category_id || 'uncategorized';
      const categoryName = ingredient.ingredient_category_name || 'ללא קטגוריה';

      const qtyPerServing = typeof dishIng.qty === 'string' ? parseFloat(dishIng.qty) || 0 : (dishIng.qty || 0);
      const totalNeeded = qtyPerServing * plannedQty;

      // Skip ingredients with 0 quantity
      if (totalNeeded === 0) return;

      if (!summaryByCategory[categoryId]) {
        summaryByCategory[categoryId] = {
          name: categoryName,
          dishes: {},
          totalCategoryIngredients: {}
        };
      }

      if (!summaryByCategory[categoryId].dishes[dish.id]) {
        summaryByCategory[categoryId].dishes[dish.id] = {
          name: dish.name,
          ingredients: []
        };
      }

      summaryByCategory[categoryId].dishes[dish.id].ingredients.push({
        ingredient_name: ingredient.name,
        unit: ingredient.system_unit,
        qtyPerServing: qtyPerServing,
        plannedQty: plannedQty,
        totalNeeded: totalNeeded
      });

      // Calculate total for the category
      if (!summaryByCategory[categoryId].totalCategoryIngredients[dishIng.ingredient_id]) {
        summaryByCategory[categoryId].totalCategoryIngredients[dishIng.ingredient_id] = {
          name: ingredient.name,
          unit: ingredient.system_unit,
          total: 0
        };
      }
      summaryByCategory[categoryId].totalCategoryIngredients[dishIng.ingredient_id].total += totalNeeded;
    });
  });

  const sortedCategories = Object.values(summaryByCategory).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8 print:space-y-0">
      {sortedCategories.map((category, categoryIndex) => (
        <div key={category.name} className={categoryIndex > 0 ? "print:break-before-page" : ""}>
          <Card className="mb-6 print:border-none print:shadow-none">
            <CardHeader className="border-b border-stone-200 p-5 print:border-b print:pb-3">
              <CardTitle className="text-2xl font-bold mb-2 print:text-xl">{event_name}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-stone-600 print:text-xs mb-3">
                <span><strong>תאריך:</strong> {event_date}</span>
                <span><strong>כמות אנשים:</strong> {guest_count} סועדים</span>
              </div>
              <h2 className="text-xl font-semibold mt-2 flex items-center gap-2 print:text-lg print:mt-1 text-emerald-700">
                <Package className="w-6 h-6" />
                קטגוריה: {category.name}
              </h2>
            </CardHeader>
            <CardContent className="p-5 space-y-6 print:p-4 print:pt-4">
              {Object.values(category.dishes).map((dish, dishIndex) => (
                <div key={dish.name} className="space-y-2">
                  {dishIndex > 0 && <Separator className="my-4 print:my-3" />}
                  <h3 className="font-bold text-lg flex items-center gap-2 print:text-base print:font-bold text-stone-800">
                    <CookingPot className="w-5 h-5 text-emerald-600" />
                    {dish.name}
                  </h3>
                  <div className="space-y-3 pr-4 print:pr-3">
                    {dish.ingredients.map((ing, ingIndex) => (
                      <div key={ingIndex} className="text-sm border-r-2 border-stone-200 pr-3 print:text-xs">
                        <p className="font-semibold text-stone-900 mb-1">{ing.ingredient_name}</p>
                        <p className="text-stone-600">
                          <span className="font-medium">כמות למנה:</span> {formatNumber(ing.qtyPerServing)} {ing.unit}
                        </p>
                        <p className="text-stone-600">
                          <span className="font-medium">חישוב:</span> {ing.plannedQty} מנות × {formatNumber(ing.qtyPerServing)} {ing.unit} = <span className="font-bold text-emerald-700">{formatNumber(ing.totalNeeded)} {ing.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <Separator className="my-6 print:my-4" />
              
              <div className="mt-6 bg-emerald-50 p-4 rounded-lg print:bg-white print:border-2 print:border-emerald-600">
                <h3 className="font-bold text-xl mb-4 print:text-lg text-emerald-900 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  סה"כ רכיבים לקטגוריה - {category.name}
                </h3>
                <div className="space-y-2">
                  {Object.values(category.totalCategoryIngredients).map((totalIng, totalIngIndex) => (
                    <div key={totalIngIndex} className="flex justify-between items-center text-base py-2 border-b border-emerald-200 last:border-b-0 print:text-sm">
                      <span className="font-semibold text-stone-900">{totalIng.name}</span>
                      <span className="font-bold text-emerald-700 text-lg print:text-base">{formatNumber(totalIng.total)} {totalIng.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}