import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [events, allEventDishes, allDishes, allCategories] = await Promise.all([
      base44.entities.Event.filter({}),
      base44.entities.Events_Dish.filter({}),
      base44.entities.Dish.filter({}),
      base44.entities.Category.filter({})
    ]);

    const dishMap = {};
    for (const d of allDishes) {
      dishMap[d.id] = d;
    }

    const isFirstCourseDish = (dish) => {
      const dishCats = (allCategories || []).filter(cat => dish.categories?.includes(cat.id));
      return dishCats.some(cat => {
        const name = (cat.name || '').toLowerCase();
        return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
      });
    };

    const eventMap = {};
    for (const e of events) {
      eventMap[e.id] = e;
    }

    const getEffectivePlannedCost = (eventDish, guestCount) => {
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
        // For wedding events, skip the 1/6 first course division
        const parentEvent = eventMap[eventDish.event_id];
        const isWedding = parentEvent?.event_type === 'wedding';
        const portionFactor = (!isWedding && isFirstCourseDish(dish)) ? 1 / 6 : (dish.portion_factor ?? 1);
        const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
        plannedQty = Math.ceil(rawQuantity);
      }

      return plannedQty * (dish.unit_cost || 0);
    };

    let updatedCount = 0;
    const results = [];

    for (const event of events) {
      const guestCount = event.guest_count || 0;
      const pricePerPlate = event.price_per_plate || 0;
      const foodRevenue = pricePerPlate * guestCount;

      const eventDishes = allEventDishes.filter(ed => ed.event_id === event.id);
      if (eventDishes.length === 0) continue;

      const totalCost = eventDishes.reduce((sum, ed) => sum + getEffectivePlannedCost(ed, guestCount), 0);
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
        results.push({
          name: event.event_name,
          old_cost: oldCost,
          new_cost: totalCost,
          old_pct: oldPct,
          new_pct: foodCostPct
        });
      }
    }

    return Response.json({ 
      success: true, 
      total_events: events.length,
      updated_count: updatedCount,
      results 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});