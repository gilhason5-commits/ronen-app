import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [events, allEventDishes, allDishes, allCategories] = await Promise.all([
      base44.asServiceRole.entities.Event.list(),
      base44.asServiceRole.entities.Events_Dish.list(),
      base44.asServiceRole.entities.Dish.list(),
      base44.asServiceRole.entities.Category.list()
    ]);

    const dishMap = {};
    for (const d of allDishes) {
      dishMap[d.id] = d;
    }

    // Find first course category IDs
    const firstCourseCategoryIds = allCategories
      .filter(cat => {
        const name = (cat.name || '').toLowerCase();
        return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
      })
      .map(cat => cat.id);

    const isFirstCourseDish = (dish) => {
      return dish.categories?.some(catId => firstCourseCategoryIds.includes(catId));
    };

    const calculateSuggestedQty = (dish, guestCount, eventType) => {
      const servingPercentage = dish.serving_percentage ?? 100;

      if (dish.preparation_mass_grams && dish.portion_size_grams) {
        const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
        const totalPortionsNeeded = guestCount * (servingPercentage / 100);
        return Math.ceil(totalPortionsNeeded / portionsPerPreparation);
      }

      // For wedding events, skip the 1/6 first course division
      const isWedding = eventType === 'wedding';
      const portionFactor = (!isWedding && isFirstCourseDish(dish)) ? 1 / 6 : (dish.portion_factor ?? 1);
      const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
      return Math.ceil(rawQuantity);
    };

    let updatedCount = 0;
    const updates = [];

    for (const eventDish of allEventDishes) {
      const dish = dishMap[eventDish.dish_id];
      if (!dish) continue;
      if (!isFirstCourseDish(dish)) continue;

      // Find the event for this dish
      const event = events.find(e => e.id === eventDish.event_id);
      if (!event) continue;

      const guestCount = event.guest_count || 0;
      const suggestedQty = calculateSuggestedQty(dish, guestCount, event.event_type);
      const oldQty = eventDish.planned_qty || 0;

      if (Math.abs(oldQty - suggestedQty) > 0.001) {
        const newPlannedCost = suggestedQty * (dish.unit_cost || 0);
        await base44.asServiceRole.entities.Events_Dish.update(eventDish.id, {
          planned_qty: suggestedQty,
          planned_cost: newPlannedCost
        });
        updatedCount++;
        updates.push({
          event_name: event.event_name,
          dish_name: dish.name,
          old_qty: oldQty,
          new_qty: suggestedQty,
          guests: guestCount
        });
      }
    }

    // Recalculate event totals for affected events
    const affectedEventIds = [...new Set(updates.map(u => {
      const ev = events.find(e => e.event_name === u.event_name);
      return ev?.id;
    }).filter(Boolean))];

    for (const eventId of affectedEventIds) {
      const eventDishesForEvent = await base44.asServiceRole.entities.Events_Dish.filter({ event_id: eventId });
      const event = events.find(e => e.id === eventId);
      if (!event) continue;

      const totalCost = eventDishesForEvent.reduce((sum, ed) => {
        if (ed.planned_cost && ed.planned_cost > 0) return sum + ed.planned_cost;
        const d = dishMap[ed.dish_id];
        if (!d) return sum;
        const qty = ed.planned_qty || calculateSuggestedQty(d, event.guest_count || 0, event.event_type);
        return sum + qty * (d.unit_cost || 0);
      }, 0);

      const foodRevenue = (event.price_per_plate || 0) * (event.guest_count || 0);
      const foodCostPct = foodRevenue > 0 ? (totalCost / foodRevenue) * 100 : 0;

      await base44.asServiceRole.entities.Event.update(eventId, {
        food_cost_sum: totalCost,
        food_cost_pct: foodCostPct,
        food_revenue: foodRevenue
      });
    }

    return Response.json({
      success: true,
      updated_dishes: updatedCount,
      affected_events: affectedEventIds.length,
      updates
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});