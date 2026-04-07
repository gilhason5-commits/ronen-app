import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import DishDialog from "@/components/dishes/DishDialog";

export default function StageDishes({ eventId, stageId, guestCount, onUpdate }) {
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedDishIds, setSelectedDishIds] = useState([]);
  const [editingDish, setEditingDish] = useState(null);
  const [dishDialogOpen, setDishDialogOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('display_order'),
    initialData: []
  });

  const { data: allDishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: []
  });

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

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: []
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: () => base44.entities.Ingredient_Category.list(),
    initialData: []
  });

  const { data: eventDishes = [] } = useQuery({
    queryKey: ['eventDishes', eventId, stageId],
    queryFn: () => base44.entities.Events_Dish.filter({ 
      event_id: eventId, 
      stage_id: stageId 
    }),
    initialData: [],
    enabled: !!eventId && !!stageId
  });

  useEffect(() => {
    setSelectedDishIds(eventDishes.map(ed => ed.dish_id));
  }, [eventDishes]);

  const filteredDishes = allDishes.filter(dish => 
    dish.active && 
    dish.categories?.includes(selectedCategoryId)
  );

  const addDishMutation = useMutation({
    mutationFn: async (dishId) => {
      const dish = allDishes.find(d => d.id === dishId);
      if (!dish) return;

      const portionPerGuest = dish.avg_portion_per_guest || 0;
      const wastePct = dish.waste_pct || 0;
      const unitCost = dish.unit_cost || 0;
      
      const plannedQty = wastePct < 1 
        ? (guestCount * portionPerGuest) / (1 - wastePct)
        : guestCount * portionPerGuest;
      
      const plannedCost = plannedQty * unitCost;

      return await base44.entities.Events_Dish.create({
        event_id: eventId,
        stage_id: stageId,
        category_id: selectedCategoryId,
        dish_id: dishId,
        dish_name: dish.name,
        planned_qty: plannedQty,
        planned_cost: plannedCost,
        unit: dish.base_unit || 'g'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventDishes', eventId, stageId] });
      toast.success('Dish added');
      onUpdate();
    }
  });

  const removeDishMutation = useMutation({
    mutationFn: async (dishId) => {
      const eventDish = eventDishes.find(ed => ed.dish_id === dishId);
      if (eventDish) {
        await base44.entities.Events_Dish.delete(eventDish.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventDishes', eventId, stageId] });
      toast.success('Dish removed');
      onUpdate();
    }
  });

  const handleDishToggle = (dishId) => {
    const isSelected = selectedDishIds.includes(dishId);
    if (isSelected) {
      removeDishMutation.mutate(dishId);
    } else {
      addDishMutation.mutate(dishId);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Select Category</Label>
        <Select 
          value={selectedCategoryId} 
          onValueChange={setSelectedCategoryId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a category..." />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCategoryId && (
        <div>
          <Label className="mb-3 block">Select Dishes from {categories.find(c => c.id === selectedCategoryId)?.name}</Label>
          <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
            {filteredDishes.length === 0 ? (
              <p className="text-center text-stone-500 py-8 text-sm">
                No dishes in this category
              </p>
            ) : (
              filteredDishes.map(dish => {
              const isSelected = selectedDishIds.includes(dish.id);
              const eventDish = eventDishes.find(ed => ed.dish_id === dish.id);

              return (
              <div 
              key={dish.id} 
              className="flex items-start gap-3 p-3 hover:bg-stone-50"
              >
              <Checkbox
              checked={isSelected}
              onCheckedChange={() => handleDishToggle(dish.id)}
              />
              <div className="flex-1">
              <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{dish.name}</p>
              <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
              setEditingDish(dish);
              setDishDialogOpen(true);
              }}
              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
              <Pencil className="w-3 h-3 mr-1" />
              עריכה
              </Button>
              </div>
              {isSelected && eventDish && (
              <div className="mt-2 p-2 bg-emerald-50 rounded text-xs space-y-0.5">
              <p className="font-semibold text-emerald-900">
              כמות מתוכננת: {eventDish.planned_qty?.toFixed(2)} {eventDish.unit}
              </p>
              <p className="font-semibold text-emerald-900">
              עלות מתוכננת: ₪{eventDish.planned_cost?.toFixed(2)}
              </p>
              </div>
              )}
              </div>
              </div>
              );
              })
            )}
          </div>
        </div>
      )}

      {eventDishes.length > 0 && (
        <div className="pt-4 border-t">
          <p className="text-sm font-medium text-stone-700 mb-2">מנות נבחרות ({eventDishes.length})</p>
          <div className="space-y-2">
            {eventDishes.map(ed => (
              <div key={ed.id} className="flex items-center justify-between p-2 bg-stone-50 rounded text-sm">
                <span className="font-medium">{ed.dish_name}</span>
                <span className="text-emerald-600 font-semibold">
                  ₪{ed.planned_cost?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DishDialog
        dish={editingDish}
        eventType={editingDish?.event_type || 'serving'}
        ingredients={ingredients}
        specialIngredients={specialIngredients}
        categories={categories}
        suppliers={suppliers}
        ingredientCategories={ingredientCategories}
        open={dishDialogOpen}
        onClose={() => {
          setDishDialogOpen(false);
          setEditingDish(null);
          onUpdate();
        }}
      />
    </div>
  );
}