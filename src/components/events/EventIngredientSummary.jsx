import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, AlertTriangle, CheckCircle, Package, Tag } from "lucide-react";
import IngredientSummaryByCategory from "./IngredientSummaryByCategory";

const formatNumber = (num, maxDecimals = 3) => {
  if (num === 0) return '0';
  if (Number.isInteger(num)) return num.toString();
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(num * factor) / factor;
  return rounded.toFixed(maxDecimals).replace(/\.?0+$/, '');
};

export default function EventIngredientSummary({ eventDetails, eventDishes = [], dishes = [] }) {
  const [activeTab, setActiveTab] = useState("categories");
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: []
  });

  // Only show ingredients for currently selected dishes
  const selectedDishIds = eventDishes.map(ed => ed.dish_id);

  // Calculate total ingredients needed - only for selected dishes
  const ingredientSummary = {};

  eventDishes.forEach(eventDish => {
    // Only include dishes that are currently selected
    if (!selectedDishIds.includes(eventDish.dish_id)) return;
    
    const dish = dishes.find(d => d.id === eventDish.dish_id);
    if (!dish?.ingredients) return;

    dish.ingredients.forEach(dishIng => {
      const qty = typeof dishIng.qty === 'string' ? parseFloat(dishIng.qty) || 0 : (dishIng.qty || 0);
      const totalNeeded = qty * (eventDish.planned_qty || 0);

      if (!ingredientSummary[dishIng.ingredient_id]) {
        ingredientSummary[dishIng.ingredient_id] = {
          ingredient_id: dishIng.ingredient_id,
          ingredient_name: dishIng.ingredient_name,
          unit: dishIng.unit,
          totalNeeded: 0,
          dishes: []
        };
      }

      ingredientSummary[dishIng.ingredient_id].totalNeeded += totalNeeded;
      ingredientSummary[dishIng.ingredient_id].dishes.push({
        dishName: dish.name,
        qty: totalNeeded
      });
    });
  });

  const ingredientList = Object.values(ingredientSummary).map(item => {
    const ingredient = ingredients.find(ing => ing.id === item.ingredient_id);
    const onHand = ingredient?.on_hand_qty || 0;
    const needed = item.totalNeeded;
    const toPurchase = Math.max(0, needed - onHand);

    return {
      ...item,
      onHand,
      toPurchase,
      status: toPurchase > 0 ? 'need' : 'sufficient',
      supplier_name: ingredient?.current_supplier_name || 'No Supplier',
      supplier_id: ingredient?.current_supplier_id || null
    };
  });

  // Group by supplier
  const bySupplier = {};
  ingredientList.forEach(item => {
    const supplierId = item.supplier_id || 'no_supplier';
    if (!bySupplier[supplierId]) {
      bySupplier[supplierId] = {
        supplier_name: item.supplier_name,
        items: []
      };
    }
    bySupplier[supplierId].items.push(item);
  });

  // Sort items within each supplier
  Object.values(bySupplier).forEach(supplier => {
    supplier.items.sort((a, b) => {
      if (a.status === 'need' && b.status !== 'need') return -1;
      if (a.status !== 'need' && b.status === 'need') return 1;
      return a.ingredient_name.localeCompare(b.ingredient_name);
    });
  });

  const supplierList = Object.values(bySupplier).sort((a, b) => {
    const aNeedCount = a.items.filter(i => i.status === 'need').length;
    const bNeedCount = b.items.filter(i => i.status === 'need').length;
    if (aNeedCount > 0 && bNeedCount === 0) return -1;
    if (aNeedCount === 0 && bNeedCount > 0) return 1;
    return a.supplier_name.localeCompare(b.supplier_name);
  });

  const totalNeedToPurchase = ingredientList.filter(i => i.status === 'need').length;
  const totalSufficient = ingredientList.filter(i => i.status === 'sufficient').length;

  if (ingredientList.length === 0) {
    return null;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <Card className="border-stone-200">
        <CardHeader className="border-b border-stone-200 p-5 print:hidden">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              סיכום מצרכים
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-red-200 text-red-700">
                {totalNeedToPurchase} לרכישה
              </Badge>
              <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                {totalSufficient} במלאי
              </Badge>
            </div>
          </div>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              קטגוריות רכיבים
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              ספקים
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <TabsContent value="categories" className="mt-0">
          <IngredientSummaryByCategory 
            eventDetails={eventDetails}
            eventDishes={eventDishes}
            dishes={dishes}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-0">
          <CardContent className="p-5 space-y-6">
        {supplierList.map((supplier) => {
          const needItems = supplier.items.filter(i => i.status === 'need');
          const sufficientItems = supplier.items.filter(i => i.status === 'sufficient');

          return (
            <div key={supplier.supplier_name} className="border border-stone-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-stone-900">{supplier.supplier_name}</h3>
                  <p className="text-xs text-stone-500">
                    {needItems.length} להזמנה • {sufficientItems.length} במלאי
                  </p>
                </div>
                <Badge className="bg-red-600 hover:bg-red-700">
                  {needItems.length} להזמנה
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4 text-red-600" />
                    <h4 className="font-semibold text-red-900 text-sm">לרכישה</h4>
                  </div>
                  <div className="space-y-2">
                    {needItems.map((item) => (
                      <div key={item.ingredient_id} className="p-2 bg-red-50 border border-red-100 rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm text-stone-900">{item.ingredient_name}</span>
                          <Badge className="bg-red-600 hover:bg-red-700 text-xs">
                            {formatNumber(item.toPurchase)} {item.unit}
                          </Badge>
                        </div>
                        <div className="text-xs text-stone-600 flex justify-between">
                          <span>נדרש: {formatNumber(item.totalNeeded)}</span>
                          <span>במלאי: {formatNumber(item.onHand)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {sufficientItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-semibold text-emerald-900 text-sm">במלאי</h4>
                    </div>
                    <div className="space-y-2">
                      {sufficientItems.map((item) => (
                        <div key={item.ingredient_id} className="p-2 bg-emerald-50 border border-emerald-100 rounded">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm text-stone-900">{item.ingredient_name}</span>
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                              ✓ במלאי
                            </Badge>
                          </div>
                          <div className="text-xs text-stone-600 flex justify-between">
                            <span>נדרש: {formatNumber(item.totalNeeded)} {item.unit}</span>
                            <span>במלאי: {formatNumber(item.onHand)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
          </CardContent>
        </TabsContent>
      </Card>
    </Tabs>
  );
}