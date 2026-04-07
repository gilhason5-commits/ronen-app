import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function RecalculateAllButton({ events, allDishes, allCategories }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  const isFirstCourseDish = (dish) => {
    const dishCats = (allCategories || []).filter(cat => dish.categories?.includes(cat.id));
    return dishCats.some(cat => {
      const name = (cat.name || '').toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
  };

  const getEffectivePlannedCost = (eventDish, guestCount, dishMap) => {
    if (eventDish.planned_cost && eventDish.planned_cost > 0) return eventDish.planned_cost;
    const dish = dishMap[eventDish.dish_id];
    if (!dish) return 0;
    const servingPercentage = dish.serving_percentage ?? 100;
    let plannedQty;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = guestCount * (servingPercentage / 100);
      plannedQty = Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    } else {
      const portionFactor = isFirstCourseDish(dish) ? 1 / 6 : (dish.portion_factor ?? 1);
      const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
      plannedQty = Math.ceil(rawQuantity);
    }
    return plannedQty * (dish.unit_cost || 0);
  };

  const handleRecalculate = async () => {
    setIsRunning(true);
    try {
      const allEventDishes = await base44.entities.Events_Dish.list();
      const dishMap = {};
      for (const d of allDishes) {
        dishMap[d.id] = d;
      }

      let updatedCount = 0;
      for (const event of events) {
        const guestCount = event.guest_count || 0;
        const pricePerPlate = event.price_per_plate || 0;
        const foodRevenue = pricePerPlate * guestCount;
        const eventDishes = allEventDishes.filter(ed => ed.event_id === event.id);
        if (eventDishes.length === 0) continue;

        const totalCost = eventDishes.reduce((sum, ed) => sum + getEffectivePlannedCost(ed, guestCount, dishMap), 0);
        const foodCostPct = foodRevenue > 0 ? (totalCost / foodRevenue) * 100 : 0;
        const oldCost = event.food_cost_sum || 0;
        const oldPct = event.food_cost_pct || 0;

        if (Math.abs(totalCost - oldCost) > 0.01 || Math.abs(foodCostPct - oldPct) > 0.01) {
          await base44.entities.Event.update(event.id, {
            food_cost_sum: totalCost,
            food_cost_pct: foodCostPct,
            food_revenue: foodRevenue
          });
          updatedCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(`עודכנו ${updatedCount} אירועים`);
    } catch (error) {
      console.error('Error recalculating:', error);
      toast.error('שגיאה בחישוב מחדש');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleRecalculate}
      disabled={isRunning}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
      {isRunning ? 'מחשב...' : 'חשב עלויות מחדש'}
    </Button>
  );
}