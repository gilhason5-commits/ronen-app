import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Package } from "lucide-react";
import SpecialIngredientPrintButton from './SpecialIngredientPrintButton';

export default function SpecialIngredientsList({ ingredients, onEdit }) {
  if (ingredients.length === 0) {
    return (
      <Card className="border-stone-200">
        <CardContent className="p-12 text-center">
          <Package className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-700 mb-2">אין רכיבים מיוחדים</h3>
          <p className="text-stone-500">צור רכיב מיוחד ראשון כדי להתחיל</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {ingredients.map((ingredient) => (
        <Card key={ingredient.id} className="border-stone-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-stone-900">{ingredient.name}</h3>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {ingredient.components?.length || 0} רכיבים
                  </Badge>
                </div>
                
                {ingredient.description && (
                  <p className="text-sm text-stone-600 mb-3">{ingredient.description}</p>
                )}

                <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-stone-50 rounded-lg">
                  <div>
                    <span className="text-xs text-stone-500">עלות כוללת</span>
                    <p className="font-semibold text-stone-900">₪{(ingredient.total_cost || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500">כמות כוללת</span>
                    <p className="font-semibold text-stone-900">
                      {(ingredient.total_quantity || 0).toFixed(2)} {ingredient.system_unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500">מחיר ל{ingredient.system_unit}</span>
                    <p className="font-semibold text-emerald-600">
                      ₪{(ingredient.price_per_system_unit || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {ingredient.components && ingredient.components.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-stone-500 mb-2">מורכב מ:</p>
                    <div className="flex flex-wrap gap-2">
                      {ingredient.components.map((comp, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {comp.ingredient_name}: {comp.qty} {comp.unit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <SpecialIngredientPrintButton specialIngredient={ingredient} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(ingredient)}
                >
                  <Edit className="w-4 h-4 ml-2" />
                  ערוך
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}