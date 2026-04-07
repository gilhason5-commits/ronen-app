import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DishPrintButton from "./DishPrintButton";

export default function DishesList({ dishes, isLoading, onEdit, categories = [], ingredients = [], specialIngredients = [] }) {
  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (dishes.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">לא נמצאו מנות</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {dishes.map((dish) => {
        const dishCategories = categories.filter(cat => 
          dish.categories?.includes(cat.id)
        );
        
        const isFirstCourse = dishCategories.some(cat => {
          const name = cat.name.toLowerCase();
          return name.includes('first course') || name.includes('מנה ראשונה');
        });
        
        const pricePerGuest = dish.price_per_guest ?? (dish.unit_cost || 0) / 6;

        return (
          <Card key={dish.id} className="border-stone-200 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-stone-900">{dish.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dishCategories.map(cat => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                    {!dish.active && (
                      <Badge variant="outline" className="text-xs bg-stone-100">
                        לא פעיל
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {dish.description && (
                <p className="text-sm text-stone-600 mb-3 line-clamp-2">{dish.description}</p>
              )}

              <div className="space-y-2 mb-4">
                {isFirstCourse ? (
                  <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                    <span className="text-sm text-stone-600">מחיר לסועד:</span>
                    <span className="font-semibold text-emerald-700">₪{pricePerGuest.toFixed(2)}</span>
                  </div>
                ) : (
                  dish.avg_portion_per_guest > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">מנה לסועד:</span>
                      <span className="font-medium">{dish.avg_portion_per_guest}</span>
                    </div>
                  )
                )}

                <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                  <span className="text-sm text-stone-600">עלות כוללת למנה:</span>
                  <span className="font-semibold text-emerald-700">₪{dish.unit_cost?.toFixed(2) || '0.00'}</span>
                </div>

                {dish.ingredients?.length > 0 && (
                  <p className="text-xs text-stone-500">
                    {dish.ingredients.length} מצרכים
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(dish)}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  עריכת מנה
                </Button>
                <DishPrintButton 
                  dish={dish} 
                  ingredients={ingredients} 
                  specialIngredients={specialIngredients} 
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}