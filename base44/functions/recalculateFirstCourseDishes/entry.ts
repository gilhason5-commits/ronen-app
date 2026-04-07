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

    // Get all categories
    const categories = await base44.asServiceRole.entities.Category.list();
    
    // Find first course category IDs
    const firstCourseCategoryIds = categories
      .filter(cat => {
        const name = cat.name.toLowerCase();
        return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
      })
      .map(cat => cat.id);

    console.log('First course category IDs:', firstCourseCategoryIds);

    // Get all dishes and update their price_per_guest to unit_cost / 6
    const dishes = await base44.asServiceRole.entities.Dish.list();
    const dishesMap = {};
    let dishUpdatedCount = 0;

    for (const dish of dishes) {
      dishesMap[dish.id] = dish;
      const isFirstCourse = dish.categories?.some(catId => firstCourseCategoryIds.includes(catId));
      if (isFirstCourse && dish.unit_cost) {
        const correctPricePerGuest = dish.unit_cost / 6;
        if (Math.abs((dish.price_per_guest || 0) - correctPricePerGuest) > 0.001) {
          await base44.asServiceRole.entities.Dish.update(dish.id, {
            price_per_guest: correctPricePerGuest
          });
          dish.price_per_guest = correctPricePerGuest;
          dishUpdatedCount++;
        }
      }
    }

    // Get all event dishes and recalculate planned_cost for first course dishes
    const eventDishes = await base44.asServiceRole.entities.Events_Dish.list();
    
    let updatedCount = 0;
    const updates = [];

    for (const eventDish of eventDishes) {
      const dish = dishesMap[eventDish.dish_id];
      if (!dish) continue;

      const isFirstCourse = dish.categories?.some(catId => firstCourseCategoryIds.includes(catId));
      
      if (isFirstCourse) {
        const plannedQty = eventDish.planned_qty || 0;
        // Cost = qty * unit_cost (simple and consistent)
        const newPlannedCost = plannedQty * (dish.unit_cost || 0);
        const oldPlannedCost = eventDish.planned_cost || 0;

        if (Math.abs(oldPlannedCost - newPlannedCost) > 0.01) {
          await base44.asServiceRole.entities.Events_Dish.update(eventDish.id, {
            planned_cost: newPlannedCost
          });

          updates.push({
            event_dish_id: eventDish.id,
            dish_name: dish.name,
            event_id: eventDish.event_id,
            planned_qty: plannedQty,
            old_cost: oldPlannedCost,
            new_cost: newPlannedCost
          });

          updatedCount++;
        }
      }
    }

    // Recalculate event totals for affected events
    const affectedEventIds = [...new Set(updates.map(u => u.event_id))];
    
    for (const eventId of affectedEventIds) {
      try {
        const eventDishesForEvent = await base44.asServiceRole.entities.Events_Dish.filter({ event_id: eventId });
        const totalCost = eventDishesForEvent.reduce((sum, d) => sum + (d.planned_cost || 0), 0);
        
        const events = await base44.asServiceRole.entities.Event.filter({ id: eventId });
        if (events && events[0]) {
          const foodRevenue = (events[0].price_per_plate || 0) * (events[0].guest_count || 0);
          const foodCostPct = foodRevenue > 0 ? (totalCost / foodRevenue) * 100 : 0;
          
          await base44.asServiceRole.entities.Event.update(eventId, {
            food_cost_sum: totalCost,
            food_cost_pct: foodCostPct
          });
        }
      } catch (e) {
        console.error('Error updating event', eventId, e.message);
      }
    }

    return Response.json({
      success: true,
      message: `Updated ${dishUpdatedCount} dishes price_per_guest, ${updatedCount} event dishes planned_cost`,
      affectedEvents: affectedEventIds.length,
      updates
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});