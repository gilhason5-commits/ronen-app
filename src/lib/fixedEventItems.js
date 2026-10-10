// "Fixed" items: dishes under a Category flagged fixed_per_event. They are
// not part of the guest-count driven dish tree (never selected per event /
// stored in Events_Dish) — every event of the category's event_type gets
// each of them once, at the dish's fixed_event_qty, priced at unit_cost.

export const isFixedPerEventCategory = (cat) => !!cat?.fixed_per_event;

export const getFixedEventQty = (dish) => {
  const qty = parseFloat(dish?.fixed_event_qty);
  return Number.isFinite(qty) ? qty : 1;
};

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

export function computeFixedItemsCost(eventType, dishes, categories) {
  return getFixedEventDishes(eventType, dishes, categories).reduce(
    (sum, d) => sum + getFixedEventQty(d) * (d.unit_cost || 0),
    0
  );
}
