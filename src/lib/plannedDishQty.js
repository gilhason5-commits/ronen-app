import { calculateAdultPortions } from "@/lib/dinerCount";

// Stored Events_Dish.planned_qty / planned_cost for a dish in an event — the
// same formula the event form uses when a dish is added (before waste):
// guests eating the standard menu × serving % × portion factor, or the
// number of preparations when the dish has preparation/portion grams.
export function computePlannedDish(dish, event, isFirstCourse) {
  const guestCount = calculateAdultPortions(event?.guest_count, event?.vegan_count, event?.glatt_count);
  const servingPct = (dish.serving_percentage ?? 100) / 100;
  let qty;
  if (dish.preparation_mass_grams && dish.portion_size_grams) {
    qty = Math.ceil((guestCount * servingPct) / (dish.preparation_mass_grams / dish.portion_size_grams));
  } else {
    const factor = (isFirstCourse && event?.event_type !== "wedding") ? 1 / 6 : (dish.portion_factor ?? 1);
    qty = Math.ceil(guestCount * servingPct * factor);
  }
  return { planned_qty: qty, planned_cost: qty * (dish.unit_cost || 0) };
}
