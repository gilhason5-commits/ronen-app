import { base44 } from "@/api/base44Client";
import { computeEventFoodCost } from "@/lib/eventFoodCost";

// An ingredient price change applies from today: future events take the new
// price (dish costs, event food cost; purchasing already reads the current
// ingredient price/supplier for upcoming events), past events keep the cost
// they had (see isPastEvent).

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Past events are frozen at their stored food cost — a later price change
// must not rewrite what an event that already happened cost.
export function isPastEvent(event) {
  return !!event?.event_date && event.event_date < todayString();
}

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

// Same formula as SpecialIngredientDialog.calculateTotals.
function specialIngredientTotals(si, ingredientsById) {
  let totalCost = 0;
  let totalQty = 0;
  for (const comp of si.components || []) {
    const ing = ingredientsById[comp.ingredient_id];
    if (!ing) continue;
    const qty = num(comp.qty);
    totalCost += qty * num(ing.price_per_system);
    totalQty += qty;
  }
  return { totalCost, pricePerUnit: totalQty > 0 ? totalCost / totalQty : 0 };
}

// Same formula as DishDialog.calculateDishCost.
function dishUnitCost(dish, ingredientsById, specialById) {
  let total = 0;
  for (const item of dish.ingredients || []) {
    const qty = num(item.qty);
    const si = specialById[item.ingredient_id];
    if (si) {
      total += qty * num(si.price_per_system_unit);
      continue;
    }
    const ing = ingredientsById[item.ingredient_id];
    if (!ing) continue;
    const purchaseUnit = num(ing.purchase_unit) || 1;
    const base = ing.price_per_system ?? (num(ing.base_price) / purchaseUnit);
    const waste = num(ing.waste_pct);
    total += qty * (waste > 0 ? num(base) / (1 - waste / 100) : num(base));
  }
  return total;
}

// After an ingredient's price changed: re-store the cost of the sub-dishes
// and dishes that use it, then of every future event (today on) that serves
// one of those dishes. Returns how many of each were updated.
export async function refreshAfterIngredientPriceChange(ingredientId) {
  const [ingredients, specialIngredients, dishes] = await Promise.all([
    base44.entities.Ingredient.list(),
    base44.entities.SpecialIngredient.list(),
    base44.entities.Dish.list(),
  ]);
  const ingredientsById = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const specialById = Object.fromEntries(specialIngredients.map((s) => [s.id, s]));

  // Sub-dishes that contain the ingredient.
  const affectedSpecialIds = new Set();
  for (const si of specialIngredients) {
    if (!(si.components || []).some((c) => c.ingredient_id === ingredientId)) continue;
    affectedSpecialIds.add(si.id);
    const { totalCost, pricePerUnit } = specialIngredientTotals(si, ingredientsById);
    specialById[si.id] = { ...si, price_per_system_unit: pricePerUnit, total_cost: totalCost };
    if (Math.abs(pricePerUnit - num(si.price_per_system_unit)) > 0.0001) {
      await base44.entities.SpecialIngredient.update(si.id, { price_per_system_unit: pricePerUnit, total_cost: totalCost });
    }
  }

  // Dishes that use it directly or through one of those sub-dishes.
  const affectedDishIds = new Set();
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  for (const dish of dishes) {
    const uses = (dish.ingredients || []).some(
      (it) => it.ingredient_id === ingredientId || affectedSpecialIds.has(it.ingredient_id)
    );
    if (!uses) continue;
    affectedDishIds.add(dish.id);
    const unitCost = dishUnitCost(dish, ingredientsById, specialById);
    dishesById[dish.id] = { ...dish, unit_cost: unitCost };
    if (Math.abs(unitCost - num(dish.unit_cost)) > 0.0001) {
      await base44.entities.Dish.update(dish.id, { unit_cost: unitCost });
    }
  }

  let eventsUpdated = 0;
  if (affectedDishIds.size > 0) {
    const events = await base44.entities.Event.listWhere((q) => q.gte("event_date", todayString()), "event_date");
    if (events.length > 0) {
      const [eventDishes, categories] = await Promise.all([
        base44.entities.Events_Dish.filter({ event_id: events.map((e) => e.id) }),
        base44.entities.Category.list(),
      ]);
      const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
      for (const event of events) {
        const eds = eventDishes.filter((ed) => ed.event_id === event.id);
        if (!eds.some((ed) => affectedDishIds.has(ed.dish_id))) continue;
        // Stored per-dish cost snapshots of the affected dishes take the new price.
        for (const ed of eds) {
          if (!affectedDishIds.has(ed.dish_id) || !(num(ed.planned_qty) > 0)) continue;
          const plannedCost = num(ed.planned_qty) * num(dishesById[ed.dish_id].unit_cost);
          if (Math.abs(plannedCost - num(ed.planned_cost)) > 0.001) {
            await base44.entities.Events_Dish.update(ed.id, { planned_cost: plannedCost });
            ed.planned_cost = plannedCost;
          }
        }
        const { foodCostSum, foodCostPct } = computeEventFoodCost(event, eds, dishesById, categoriesById);
        if (Math.abs(foodCostSum - num(event.food_cost_sum)) > 0.01) {
          await base44.entities.Event.update(event.id, { food_cost_sum: foodCostSum, food_cost_pct: foodCostPct });
          eventsUpdated++;
        }
      }
    }
  }
  return { specialIngredients: affectedSpecialIds.size, dishes: affectedDishIds.size, events: eventsUpdated };
}
