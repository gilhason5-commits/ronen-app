import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Package, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function IngredientsDataList({ ingredients, isLoading, onEdit, onDelete }) {
  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">לא נמצאו רכיבים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ingredients.map((ingredient) => {
        const systemUnit = ingredient.system_unit || ingredient.unit || '';
        const purchaseUnit = ingredient.purchase_unit || 1;
        const wastePct = ingredient.waste_pct || 0;
        const actualQtyAfterWaste = purchaseUnit * (1 - wastePct / 100);
        const pricePerSystem = ingredient.price_per_system ?? 
          ((ingredient.base_price ?? ingredient.price_per_unit ?? 0) / (actualQtyAfterWaste || 1));
        const basePrice = ingredient.base_price ?? ingredient.price_per_unit ?? 0;
        
        return (
          <Card 
            key={ingredient.id} 
            className="border-stone-200 hover:shadow-md transition-shadow"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-stone-900">{ingredient.name}</h3>
                  {ingredient.ingredient_category_name && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {ingredient.ingredient_category_name}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">יחידת מדידה:</span>
                  <span className="font-medium">{systemUnit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">יחידת רכישה:</span>
                  <span className="font-medium">{purchaseUnit} {systemUnit}</span>
                </div>
                {wastePct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">בזבוז:</span>
                    <span className="font-medium text-orange-600">{wastePct}%</span>
                  </div>
                )}
                {wastePct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">שמיש אחרי בזבוז:</span>
                    <span className="font-medium text-blue-600">{actualQtyAfterWaste.toFixed(2)} {systemUnit}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-stone-600">מחיר רכישה:</span>
                  <span className="font-semibold">₪{basePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                  <span className="text-stone-600">מחיר ל-{systemUnit}:</span>
                  <span className="font-semibold text-emerald-700">
                    ₪{pricePerSystem.toFixed(2)}
                  </span>
                </div>
                {ingredient.current_supplier_name && (
                  <div className="pt-2">
                    <span className="text-stone-600">ספק:</span> 
                    <span className="font-medium mr-1">{ingredient.current_supplier_name}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(ingredient)}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  עריכה
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(ingredient)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}