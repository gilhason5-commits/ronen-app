import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { applyWasteToValue } from "@/lib/foodWaste";
import { calculateAdultPortions } from "@/lib/dinerCount";

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

  const getEffectivePlannedCost = (eventDish, event, dishMap) => {
    const guestCount = event.guest_count || 0;
    // planned_cost is stored as the pre-reduction base — apply the פחת here too.
    // The waste bracket is driven by the full committed headcount, same as
    // revenue — a billing concept, unrelated to who eats what.
    if (eventDish.planned_cost && eventDish.planned_cost > 0) {
      return applyWasteToValue(eventDish.planned_cost, guestCount);
    }
    // Standard dish quantities are planned for guests eating the standard
    // menu — guest_count minus vegans/glatt, who get separate dishes not
    // counted in this tree (e.g. 300 committed, 20 vegan -> plan for 280).
    const dishGuestCount = calculateAdultPortions(event.guest_count, event.vegan_count, event.glatt_count);
    const dish = dishMap[eventDish.dish_id];
    if (!dish) return 0;
    const servingPercentage = dish.serving_percentage ?? 100;
    let plannedQty;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = dishGuestCount * (servingPercentage / 100);
      plannedQty = Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    } else {
      const isWedding = event?.event_type === 'wedding';
      const portionFactor = (isFirstCourseDish(dish) && !isWedding) ? 1 / 6 : (dish.portion_factor ?? 1);
      const rawQuantity = dishGuestCount * (servingPercentage / 100) * portionFactor;
      plannedQty = Math.ceil(rawQuantity);
    }
    return applyWasteToValue(plannedQty * (dish.unit_cost || 0), guestCount);
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
        try {
          const guestCount = event.guest_count || 0;
          const pricePerPlate = event.price_per_plate || 0;
          const foodRevenue = pricePerPlate * guestCount;
          const eventDishes = allEventDishes.filter(ed => ed.event_id === event.id);
          if (eventDishes.length === 0) continue;

          const totalCost = eventDishes.reduce((sum, ed) => sum + getEffectivePlannedCost(ed, event, dishMap), 0);
          const foodCostPct = foodRevenue > 0 ? (totalCost / foodRevenue) * 100 : 0;
          const oldCost = event.food_cost_sum || 0;
          const oldPct = event.food_cost_pct || 0;

          if (Math.abs(totalCost - oldCost) > 0.01 || Math.abs(foodCostPct - oldPct) > 0.01) {
            // Note: Event has no food_revenue column — don't try to write one
            // (doing so used to throw and abort the whole batch on the very
            // first event this ran against).
            await base44.entities.Event.update(event.id, {
              food_cost_sum: totalCost,
              food_cost_pct: foodCostPct,
            });
            updatedCount++;
          }
        } catch (err) {
          // One bad event shouldn't stop the rest of the batch from updating.
          console.error('Failed to recalculate event:', event.id, err);
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