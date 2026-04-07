import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function IngredientDetailsDialog({ ingredient, specialIngredient, open, onClose }) {
  const displayIngredient = specialIngredient || ingredient;
  
  if (!displayIngredient) return null;

  const isSpecial = !!specialIngredient;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {displayIngredient.name}
            {isSpecial && (
              <Badge className="bg-emerald-100 text-emerald-700">תת מנה</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isSpecial ? (
            // Special ingredient details
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-stone-500">יחידת מערכת</Label>
                  <p className="font-medium">{specialIngredient.system_unit}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">מחיר ליחידת מערכת</Label>
                  <p className="font-medium">₪{(specialIngredient.price_per_system_unit || 0).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">כמות כוללת</Label>
                  <p className="font-medium">{specialIngredient.total_quantity || 0} {specialIngredient.system_unit}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">עלות כוללת</Label>
                  <p className="font-medium">₪{(specialIngredient.total_cost || 0).toFixed(2)}</p>
                </div>
              </div>

              {specialIngredient.description && (
                <div>
                  <Label className="text-xs text-stone-500">תיאור</Label>
                  <p className="text-sm">{specialIngredient.description}</p>
                </div>
              )}

              {specialIngredient.components && specialIngredient.components.length > 0 && (
                <div>
                  <Label className="text-xs text-stone-500 mb-2 block">רכיבים</Label>
                  <div className="space-y-2">
                    {specialIngredient.components.map((comp, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-stone-50 rounded">
                        <span className="text-sm font-medium">{comp.ingredient_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-stone-600">{comp.qty} {comp.unit}</span>
                          <span className="text-sm font-semibold">₪{(comp.cost || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // Regular ingredient details
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-stone-500">יחידת מערכת</Label>
                  <p className="font-medium">{ingredient.system_unit}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">יחידת רכישה</Label>
                  <p className="font-medium">{ingredient.purchase_unit} {ingredient.system_unit}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">מחיר בסיס</Label>
                  <p className="font-medium">₪{(ingredient.base_price || 0).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">מחיר ליחידת מערכת</Label>
                  <p className="font-medium">₪{(ingredient.price_per_system || 0).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">אחוז בזבוז</Label>
                  <p className="font-medium">{ingredient.waste_pct || 0}%</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">כמות במלאי</Label>
                  <p className="font-medium">{ingredient.on_hand_qty || 0} {ingredient.system_unit}</p>
                </div>
              </div>

              {ingredient.current_supplier_name && (
                <div>
                  <Label className="text-xs text-stone-500">ספק נוכחי</Label>
                  <p className="font-medium">{ingredient.current_supplier_name}</p>
                </div>
              )}

              {ingredient.ingredient_category_name && (
                <div>
                  <Label className="text-xs text-stone-500">קטגוריית מצרך</Label>
                  <p className="font-medium">{ingredient.ingredient_category_name}</p>
                </div>
              )}

              {ingredient.last_price_update && (
                <div>
                  <Label className="text-xs text-stone-500">עדכון מחיר אחרון</Label>
                  <p className="font-medium">{ingredient.last_price_update}</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}