import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function DishPreviewDialog({ dish, open, onClose }) {
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

  if (!dish) return null;

  const getIngredientDetails = (item) => {
    const specialIngredient = specialIngredients.find(ing => ing.id === item.ingredient_id);
    if (specialIngredient) {
      return {
        name: specialIngredient.name,
        unit: specialIngredient.system_unit,
        pricePerSystem: specialIngredient.price_per_system_unit || 0,
        isSpecial: true
      };
    }

    const ingredient = ingredients.find(ing => ing.id === item.ingredient_id);
    if (ingredient) {
      const purchaseUnit = ingredient.purchase_unit || 1;
      const wastePct = ingredient.waste_pct || 0;
      const actualQtyAfterWaste = purchaseUnit * (1 - wastePct / 100);
      const pricePerSystem = ingredient.price_per_system ?? 
        ((ingredient.base_price ?? 0) / (actualQtyAfterWaste || 1));
      
      return {
        name: ingredient.name,
        unit: ingredient.system_unit,
        pricePerSystem,
        isSpecial: false
      };
    }

    return {
      name: item.ingredient_name,
      unit: item.unit,
      pricePerSystem: 0,
      isSpecial: false
    };
  };

  const dishIngredients = (dish.ingredients || []).map(item => {
    const details = getIngredientDetails(item);
    const qty = typeof item.qty === 'string' ? parseFloat(item.qty) || 0 : (item.qty || 0);
    const cost = qty * details.pricePerSystem;
    
    return {
      ...details,
      qty,
      cost
    };
  });

  const totalCost = dishIngredients.reduce((sum, ing) => sum + ing.cost, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{dish.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {dish.description && (
            <p className="text-sm text-stone-600">{dish.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-stone-50 p-3 rounded-lg">
              <p className="text-stone-500">אחוז הגשה</p>
              <p className="font-semibold">{dish.serving_percentage || 100}%</p>
            </div>
            <div className="bg-stone-50 p-3 rounded-lg">
              <p className="text-stone-500">עלות ליחידה</p>
              <p className="font-semibold text-emerald-600">₪{(dish.unit_cost || 0).toFixed(2)}</p>
            </div>
            {dish.preparation_mass_grams && (
              <div className="bg-stone-50 p-3 rounded-lg">
                <p className="text-stone-500">מסת הכנה</p>
                <p className="font-semibold">{dish.preparation_mass_grams}g</p>
              </div>
            )}
            {dish.portion_size_grams && (
              <div className="bg-stone-50 p-3 rounded-lg">
                <p className="text-stone-500">גודל מנה</p>
                <p className="font-semibold">{dish.portion_size_grams}g</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">רכיבים</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="text-right p-2">מצרך</th>
                    <th className="text-center p-2">כמות</th>
                    <th className="text-left p-2">עלות</th>
                  </tr>
                </thead>
                <tbody>
                  {dishIngredients.map((ing, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        <span>{ing.name}</span>
                        {ing.isSpecial && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded mr-1">תת מנה</span>
                        )}
                      </td>
                      <td className="text-center p-2">{ing.qty.toFixed(2)} {ing.unit}</td>
                      <td className="text-left p-2 font-medium">₪{ing.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50">
                  <tr>
                    <td colSpan="2" className="p-2 font-bold">סה״כ עלות</td>
                    <td className="text-left p-2 font-bold text-emerald-600">₪{totalCost.toFixed(2)}</td>
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