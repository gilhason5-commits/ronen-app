import { calculateAdultPortions } from "./dinerCount";
import { applyWasteToQty } from "./foodWaste";

// "Fixed" items: dishes under a Category flagged fixed_per_event. They are
// not part of the guest-count driven dish tree (never selected per event /
// stored in Events_Dish) — every event of the category's event_type gets
// each of them automatically, priced at unit_cost. The quantity follows the
// dish's qty_mode like any dish: a fixed count per event (fixed_event_qty),
// serving % of the guests, or N per X guests.

export const isFixedPerEventCategory = (cat) => !!cat?.fixed_per_event;

export const getFixedEventQty = (dish) => {
  const qty = parseFloat(dish?.fixed_event_qty);
  return Number.isFinite(qty) ? qty : 1;
};

// Quantity of a fixed item in a given event. Percent mode is planned for the
// guests eating the standard menu and takes the event-level reduction (פחת),
// same as a menu dish in purchasing.
export function getFixedItemEventQty(dish, event) {
  if (dish?.qty_mode === "percent") {
    const portions = calculateAdultPortions(event?.guest_count, event?.vegan_count, event?.glatt_count);
    const qty = Math.ceil(portions * ((dish.serving_percentage ?? 100) / 100) * (dish.portion_factor ?? 1));
    return applyWasteToQty(qty, event?.guest_count || 0);
  }
  if (dish?.qty_mode === "per_guests") {
    const base = parseFloat(dish.per_guests_base) || 100;
    return Math.ceil(((parseInt(event?.guest_count, 10) || 0) * (parseFloat(dish.per_guests_qty) || 0)) / base);
  }
  return getFixedEventQty(dish);
}

// Fixed dishes that apply to an event of the given type.
export function getFixedEventDishes(eventType, dishes, categories) {
  const fixedCategoryIds = new Set(
    (categories || [])
      .filter((c) => isFixedPerEventCategory(c) && c.event_type === eventType)
      .map((c) => c.id)
  );
  if (fixedCategoryIds.size === 0) return [];
  return (dishes || []).filter(
    (d) => d.event_type === eventType && d.active !== false &&
      (d.categories || []).some((cid) => fixedCategoryIds.has(cid))
  );
}

export function computeFixedItemsCost(event, dishes, categories) {
  return getFixedEventDishes(event?.event_type, dishes, categories).reduce(
    (sum, d) => sum + getFixedItemEventQty(d, event) * (d.unit_cost || 0),
    0
  );
}
