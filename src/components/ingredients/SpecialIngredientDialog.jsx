import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import IngredientDialog from "@/components/inventory/IngredientDialog";

export default function SpecialIngredientDialog({ open, onClose, ingredient }) {
  const queryClient = useQueryClient();
  const [searchTerms, setSearchTerms] = useState({});
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_unit: "קילוגרם",
    components: []
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => {
      const data = await base44.entities.Ingredient.list();
      return data.sort((a, b) => a.name?.localeCompare(b.name, 'he'));
    },
    initialData: [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: () => base44.entities.Ingredient_Category.list(),
    initialData: [],
  });

  const { data: allSpecialIngredients = [] } = useQuery({
    queryKey: ['specialIngredients'],
    queryFn: async () => {
      const data = await base44.entities.SpecialIngredient.list();
      return data.sort((a, b) => a.name?.localeCompare(b.name, 'he'));
    },
    initialData: [],
  });

  // Filter out current ingredient to prevent circular reference
  const otherSpecialIngredients = allSpecialIngredients.filter(si => si.id !== ingredient?.id);

  useEffect(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.name || "",
        description: ingredient.description || "",
        system_unit: ingredient.system_unit || "קילוגרם",
        components: ingredient.components || []
      });
    } else {
      setFormData({
        name: "",
        description: "",
        system_unit: "ק״ג",
        components: []
      });
    }
  }, [ingredient, open]);

  const calculateTotals = (components) => {
    let totalCost = 0;
    let totalQuantity = 0;

    components.forEach(comp => {
      const ing = ingredients.find(i => i.id === comp.ingredient_id);
      if (ing) {
        const qty = parseFloat(comp.qty) || 0;
        const pricePerUnit = ing.price_per_system || 0;
        const cost = qty * pricePerUnit;
        totalCost += cost;
        totalQuantity += qty;
      }
    });

    const pricePerSystemUnit = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    return { totalCost, totalQuantity, pricePerSystemUnit };
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const { totalCost, totalQuantity, pricePerSystemUnit } = calculateTotals(data.components);
      
      const saveData = {
        ...data,
        total_cost: totalCost,
        price_per_system_unit: pricePerSystemUnit
      };

      if (ingredient?.id) {
        return base44.entities.SpecialIngredient.update(ingredient.id, saveData);
      } else {
        return base44.entities.SpecialIngredient.create(saveData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialIngredients'] });
      toast.success(ingredient ? 'רכיב מיוחד עודכן בהצלחה' : 'רכיב מיוחד נוצר בהצלחה');
      onClose();
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת רכיב מיוחד: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SpecialIngredient.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialIngredients'] });
      toast.success('רכיב מיוחד נמחק בהצלחה');
      onClose();
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת רכיב מיוחד: ' + error.message);
    }
  });

  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    const errors = [];
    if (!formData.name?.trim()) errors.push('שם הרכיב המיוחד');
    if (formData.components.length === 0) errors.push('יש להוסיף לפחות רכיב אחד');
    if (errors.length > 0) {
      setValidationError(errors.join(' | '));
      return;
    }
    setValidationError('');
    saveMutation.mutate(formData);
  };

  const addComponent = () => {
    setFormData({
      ...formData,
      components: [{ ingredient_id: "", ingredient_name: "", qty: 0, unit: "", cost: 0 }, ...formData.components]
    });
  };

  const removeComponent = (index) => {
    const newComponents = formData.components.filter((_, i) => i !== index);
    setFormData({ ...formData, components: newComponents });
  };

  const updateComponent = (index, field, value) => {
    const newComponents = [...formData.components];
    newComponents[index][field] = value;

    if (field === 'ingredient_id') {
      // Check if it's a special ingredient
      const specialIng = otherSpecialIngredients.find(si => si.id === value);
      if (specialIng) {
        newComponents[index].ingredient_name = specialIng.name;
        newComponents[index].unit = specialIng.system_unit;
        newComponents[index].is_special = true;
        const qty = parseFloat(newComponents[index].qty) || 0;
        newComponents[index].cost = qty * (specialIng.price_per_system_unit || 0);
      } else {
        // Regular ingredient
        const ing = ingredients.find(i => i.id === value);
        if (ing) {
          newComponents[index].ingredient_name = ing.name;
          newComponents[index].unit = ing.system_unit;
          newComponents[index].is_special = false;
          const qty = parseFloat(newComponents[index].qty) || 0;
          newComponents[index].cost = qty * (ing.price_per_system || 0);
        }
      }
    }

    if (field === 'qty') {
      const specialIng = otherSpecialIngredients.find(si => si.id === newComponents[index].ingredient_id);
      if (specialIng) {
        const qty = parseFloat(value) || 0;
        newComponents[index].cost = qty * (specialIng.price_per_system_unit || 0);
      } else {
        const ing = ingredients.find(i => i.id === newComponents[index].ingredient_id);
        if (ing) {
          const qty = parseFloat(value) || 0;
          newComponents[index].cost = qty * (ing.price_per_system || 0);
        }
      }
    }

    setFormData({ ...formData, components: newComponents });
  };

  const { totalCost, totalQuantity, pricePerSystemUnit } = calculateTotals(formData.components);

  return (<>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ingredient ? 'עריכת רכיב מיוחד' : 'רכיב מיוחד חדש'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>שם הרכיב המיוחד *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמא: רוטב אסייתי"
                required
              />
            </div>

            <div>
              <Label>תיאור</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור הרכיב"
                rows={2}
              />
            </div>

            <div>
              <Label>יחידת מדידה</Label>
              <Select
                value={formData.system_unit}
                onValueChange={(value) => setFormData({ ...formData, system_unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ק״ג">ק״ג</SelectItem>
                  <SelectItem value="ליטר">ליטר</SelectItem>
                  <SelectItem value="יחידה">יחידה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base">רכיבים *</Label>
              <Button type="button" onClick={addComponent} size="sm" variant="outline">
                <Plus className="w-4 h-4 ml-2" />
                הוסף רכיב
              </Button>
            </div>

            <div className="space-y-3">
              {formData.components.map((comp, index) => {
                // Combine regular and special ingredients for search
                const allIngredients = [
                  ...otherSpecialIngredients.map(si => ({ ...si, isSpecial: true })),
                  ...ingredients.map(i => ({ ...i, isSpecial: false }))
                ];

                const currentSearch = (searchTerms[index] || '').toLowerCase();
                const filteredIngredients = currentSearch 
                  ? allIngredients.filter(ing => ing.name.toLowerCase().includes(currentSearch))
                  : allIngredients;

                const selectedIngredient = allIngredients.find(ing => ing.id === comp.ingredient_id);

                return (
                  <div key={index} className={`p-4 border rounded-lg ${
                    comp.is_special ? 'border-emerald-300 bg-emerald-50/30' : 'border-stone-200 bg-stone-50'
                  }`}>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Label className="text-xs">רכיב</Label>
                        <div className="space-y-1">
                          <Input
                            placeholder="חפש רכיב..."
                            value={searchTerms[index] || ''}
                            onChange={(e) => {
                              setSearchTerms(prev => ({ ...prev, [index]: e.target.value }));
                            }}
                            className="h-9"
                          />
                          {(searchTerms[index] || !comp.ingredient_id) && (
                            <div className="max-h-40 overflow-y-auto border rounded-md bg-white">
                              {filteredIngredients.length > 0 ? (
                                filteredIngredients.map(ing => {
                                  const pricePerSystem = ing.isSpecial 
                                    ? (ing.price_per_system_unit || 0)
                                    : (ing.price_per_system || 0);
                                  
                                  return (
                                    <button
                                      key={ing.id}
                                      type="button"
                                      className="w-full text-right px-3 py-2 hover:bg-stone-100 text-sm border-b last:border-b-0"
                                      onClick={() => {
                                        updateComponent(index, 'ingredient_id', ing.id);
                                        setSearchTerms(prev => ({ ...prev, [index]: '' }));
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium">{ing.name}</div>
                                        {ing.isSpecial && (
                                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">תת מנה</span>
                                        )}
                                      </div>
                                      <div className="text-xs text-stone-500">
                                        ₪{pricePerSystem.toFixed(2)}/{ing.system_unit}
                                      </div>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-3 py-2 text-sm text-stone-500">לא נמצאו רכיבים</div>
                              )}
                            </div>
                          )}
                          {comp.ingredient_id && !searchTerms[index] && selectedIngredient && (
                            <div className="px-3 py-2 bg-white border rounded-md text-sm">
                              <div className="flex items-center gap-2">
                                <div className="font-medium">{selectedIngredient.name}</div>
                                {selectedIngredient.isSpecial && (
                                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">תת מנה</span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500">
                                ₪{(selectedIngredient.isSpecial ? selectedIngredient.price_per_system_unit || 0 : selectedIngredient.price_per_system || 0).toFixed(2)}/{selectedIngredient.system_unit}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-span-2">
                      <Label className="text-xs">כמות</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={comp.qty}
                        onChange={(e) => updateComponent(index, 'qty', e.target.value)}
                        placeholder="0"
                      />
                    </div>

                      <div className="col-span-2">
                        <Label className="text-xs">יחידה</Label>
                        <Input
                          value={comp.unit}
                          disabled
                          className="bg-stone-100"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">עלות</Label>
                        <Input
                          value={`₪${(comp.cost || 0).toFixed(2)}`}
                          disabled
                          className="bg-stone-100"
                        />
                      </div>

                      <div className="col-span-1 flex gap-1">
                        {comp.ingredient_id && !comp.is_special && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const ing = ingredients.find(i => i.id === comp.ingredient_id);
                              if (ing) setEditingIngredient(ing);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs px-2"
                          >
                            עריכת רכיב
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeComponent(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {formData.components.length === 0 && (
                <div className="text-center py-8 text-stone-500">
                  לחץ על "הוסף רכיב" כדי להתחיל לבנות את הרכיב המיוחד
                </div>
              )}
            </div>

            {formData.components.length > 0 && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-stone-600">סה"כ עלות:</span>
                    <p className="font-bold text-lg text-stone-900">₪{totalCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-stone-600">כמות כוללת:</span>
                    <p className="font-bold text-lg text-stone-900">
                      {totalQuantity.toFixed(2)} {formData.system_unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-600">מחיר ל{formData.system_unit}:</span>
                    <p className="font-bold text-lg text-emerald-600">₪{pricePerSystemUnit.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t">
            <div>
              {ingredient && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('האם אתה בטוח שברצונך למחוק רכיב מיוחד זה?')) {
                      deleteMutation.mutate(ingredient.id);
                    }
                  }}
                >
                  מחק רכיב מיוחד
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              {validationError && (
                <p className="text-sm text-red-600">{validationError}</p>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  ביטול
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={saveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saveMutation.isPending ? 'שומר...' : (ingredient ? 'עדכן' : 'צור') + ' רכיב מיוחד'}
                </Button>
              </div>
            </div>
          </div>
        </form>

      </DialogContent>
    </Dialog>

    <IngredientDialog
      open={!!editingIngredient}
      onClose={() => setEditingIngredient(null)}
      ingredient={editingIngredient}
      suppliers={suppliers}
      ingredientCategories={ingredientCategories}
    />
  </>);
}