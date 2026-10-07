import { applyWasteToValue } from "./foodWaste";
import { calculateAdultPortions } from "./dinerCount";
import { dishUnitCostAt } from "./ingredientTerms";

function isFirstCourseDish(dish, categoriesById) {
  const dishCategories = (dish.categories || []).map((id) => categoriesById[id]).filter(Boolean);
  return dishCategories.some((cat) => {
    const name = (cat.name || "").toLowerCase();
    return name.includes("first course") || name.includes("מנה ראשונה") || name.includes("מנות ראשונות");
  });
}

// Same formula as EventForm.jsx's getEffectivePlannedCost / handleDishToggle:
// falls back to a fresh computation from the dish's unit_cost and the event's
// current guest_count whenever no positive planned_cost is stored, so a
// stale/never-saved Events_Dish row still reads correctly.
//
// With a costCtx (usePriceContext / makeCostContext) the dish is priced from
// its ingredients' prices on the event's date — a dated price change only
// affects events from its effective date on — instead of the stored
// planned_cost / unit_cost snapshots.
export function getEffectivePlannedCost(eventDish, event, dishesById, categoriesById, costCtx = null) {
  const guestCount = event.guest_count || 0;
  const dish = dishesById[eventDish.dish_id];
  if (costCtx && dish) {
    const unitCost = dishUnitCostAt(dish, event.event_date, costCtx);
    const storedQty = Number(eventDish.planned_qty) || 0;
    const qty = eventDish.planned_cost > 0 && storedQty > 0
      ? storedQty
      : suggestedQty(dish, event, categoriesById);
    return applyWasteToValue(qty * unitCost, guestCount);
  }
  if (eventDish.planned_cost && eventDish.planned_cost > 0) {
    return applyWasteToValue(eventDish.planned_cost, guestCount);
  }
  if (!dish) return 0;
  return applyWasteToValue(suggestedQty(dish, event, categoriesById) * (dish.unit_cost || 0), guestCount);
}

function suggestedQty(dish, event, categoriesById) {
  const dishGuestCount = calculateAdultPortions(event.guest_count, event.vegan_count, event.glatt_count);
  const servingPercentage = dish.serving_percentage ?? 100;
  let plannedQty;
  if (dish.preparation_mass_grams && dish.portion_size_grams) {
    const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
    const totalPortionsNeeded = dishGuestCount * (servingPercentage / 100);
    plannedQty = Math.ceil(totalPortionsNeeded / portionsPerPreparation);
  } else {
    const isWedding = event?.event_type === "wedding";
    const portionFactor = (isFirstCourseDish(dish, categoriesById) && !isWedding) ? 1 / 6 : (dish.portion_factor ?? 1);
    const rawQuantity = dishGuestCount * (servingPercentage / 100) * portionFactor;
    plannedQty = Math.ceil(rawQuantity);
  }
  return plannedQty;
}

// Live food revenue/cost for one event — computed fresh from its selected
// dishes' current data every time, never from a stored snapshot that can
// drift out of sync with what the event actually shows.
export function computeEventFoodCost(event, eventDishes, dishesById, categoriesById, costCtx = null) {
  const guestCount = event.guest_count || 0;
  const pricePerPlate = parseFloat(event.price_per_plate) || 0;
  const foodRevenue = pricePerPlate * guestCount;
  const foodCostSum = eventDishes.reduce(
    (sum, ed) => sum + getEffectivePlannedCost(ed, event, dishesById, categoriesById, costCtx),
    0
  );
  const foodCostPct = foodRevenue > 0 ? (foodCostSum / foodRevenue) * 100 : 0;
  return { foodRevenue, foodCostSum, foodCostPct };
}
