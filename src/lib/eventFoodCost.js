import { applyWasteToValue } from "./foodWaste";
import { calculateAdultPortions } from "./dinerCount";

function isFirstCourseDish(dish, categoriesById) {
  const dishCategories = (dish.categories || []).map((id) => categoriesById[id]).filter(Boolean);
  return dishCategories.some((cat) => {
    const name = (cat.name || "").toLowerCase();
    return name.includes("first course") || name.includes("מנה ראשונה") || name.includes("מנות ראשונות");
  });
}

// Same formula as EventForm.jsx's getEffectivePlannedCost / handleDishToggle:
// falls back to a fresh computation from the dish's current unit_cost and
// the event's current guest_count whenever no positive planned_cost is
// stored, so a stale/never-saved Events_Dish row still reads correctly.
export function getEffectivePlannedCost(eventDish, event, dishesById, categoriesById) {
  const guestCount = event.guest_count || 0;
  if (eventDish.planned_cost && eventDish.planned_cost > 0) {
    return applyWasteToValue(eventDish.planned_cost, guestCount);
  }
  const dishGuestCount = calculateAdultPortions(event.guest_count, event.vegan_count, event.glatt_count);
  const dish = dishesById[eventDish.dish_id];
  if (!dish) return 0;
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
  return applyWasteToValue(plannedQty * (dish.unit_cost || 0), guestCount);
}

// Live food revenue/cost for one event — computed fresh from its selected
// dishes' current data every time, never from a stored snapshot that can
// drift out of sync with what the event actually shows.
export function computeEventFoodCost(event, eventDishes, dishesById, categoriesById) {
  const guestCount = event.guest_count || 0;
  const pricePerPlate = parseFloat(event.price_per_plate) || 0;
  const foodRevenue = pricePerPlate * guestCount;
  const foodCostSum = eventDishes.reduce(
    (sum, ed) => sum + getEffectivePlannedCost(ed, event, dishesById, categoriesById),
    0
  );
  const foodCostPct = foodRevenue > 0 ? (foodCostSum / foodRevenue) * 100 : 0;
  return { foodRevenue, foodCostSum, foodCostPct };
}
