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

  const calculatePlannedQty = (dish, guestCount, eventType) => {
    const servingPercentage = dish.serving_percentage ?? 100;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = guestCount * (servingPercentage / 100);
      return Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    }
    // אירוע הפוכה (wedding): skip the first-course 1/6 division.
    const isWedding = eventType === 'wedding';
    const portionFactor = (!isWedding && isFirstCourseDish(dish)) ? 1 / 6 : (dish.portion_factor ?? 1);
    const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
    return Math.ceil(rawQuantity);
  };

  const handleRecalculate = async () => {
    setIsRunning(true);
    try {
      const allEventDishes = await base44.entities.Events_Dish.list();
      const dishMap = {};
      for (const d of allDishes) dishMap[d.id] = d;

      // Pass 1: for every event-level first-course dish, recompute planned_qty
      // and planned_cost. Wedding events drop the /6 factor; other events keep
      // it. Stage-scoped dishes (stage_id != null) use a different formula and
      // are intentionally skipped.
      let dishesUpdated = 0;
      for (const ed of allEventDishes) {
        if (ed.stage_id) continue;
        const dish = dishMap[ed.dish_id];
        if (!dish) continue;
        if (!isFirstCourseDish(dish)) continue;

        const event = events.find(e => e.id === ed.event_id);
        if (!event) continue;

        const newQty = calculatePlannedQty(dish, event.guest_count || 0, event.event_type);
        const newCost = newQty * (dish.unit_cost || 0);
        const oldQty = ed.planned_qty || 0;
        const oldCost = ed.planned_cost || 0;

        if (Math.abs(oldQty - newQty) > 0.001 || Math.abs(oldCost - newCost) > 0.01) {
          await base44.entities.Events_Dish.update(ed.id, {
            planned_qty: newQty,
            planned_cost: newCost,
          });
          dishesUpdated++;
        }
      }

      // Pass 2: refresh totals on every event based on the (now-updated)
      // per-dish planned_cost values.
      const refreshedDishes = dishesUpdated > 0
        ? await base44.entities.Events_Dish.list()
        : allEventDishes;

      let eventsUpdated = 0;
      for (const event of events) {
        const guestCount = event.guest_count || 0;
        const pricePerPlate = event.price_per_plate || 0;
        const foodRevenue = pricePerPlate * guestCount;
        const eds = refreshedDishes.filter(ed => ed.event_id === event.id);
        if (eds.length === 0) continue;

        const totalCost = eds.reduce((sum, ed) => sum + (ed.planned_cost || 0), 0);
        const foodCostPct = foodRevenue > 0 ? (totalCost / foodRevenue) * 100 : 0;
        const oldCost = event.food_cost_sum || 0;
        const oldPct = event.food_cost_pct || 0;

        if (Math.abs(totalCost - oldCost) > 0.01 || Math.abs(foodCostPct - oldPct) > 0.01) {
          await base44.entities.Event.update(event.id, {
            food_cost_sum: totalCost,
            food_cost_pct: foodCostPct,
            food_revenue: foodRevenue
          });
          eventsUpdated++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event_form_dishes'] });
      queryClient.invalidateQueries({ queryKey: ['eventDishes'] });
      toast.success(`עודכנו ${dishesUpdated} מנות, ${eventsUpdated} אירועים`);
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
