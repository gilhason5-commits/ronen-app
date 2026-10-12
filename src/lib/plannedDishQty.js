import { calculateAdultPortions } from "@/lib/dinerCount";

// Dish quantity modes (Dish.qty_mode):
//   percent    — guests × serving % (default, existing behaviour)
//   fixed      — fixed_event_qty plates in every event
//   per_guests — per_guests_qty plates for every per_guests_base guests
export const QTY_MODES = {
  percent: "אחוז מהאורחים",
  fixed: "כמות קבועה לאירוע",
  per_guests: "כמות לפי מספר אורחים",
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const isExplicitQtyMode = (dish) => dish?.qty_mode === "fixed" || dish?.qty_mode === "per_guests";

// Plate count for the explicit modes, or null for percent mode. It is final:
// the event-level waste (פחת) does not apply, since the number was set by hand.
export function explicitDishQty(dish, event) {
  if (dish?.qty_mode === "fixed") return num(dish.fixed_event_qty);
  if (dish?.qty_mode === "per_guests") {
    const base = num(dish.per_guests_base) || 100;
    return Math.ceil((num(event?.guest_count) * num(dish.per_guests_qty)) / base);
  }
  return null;
}

// Short Hebrew description of how the dish's quantity is set.
export function qtyModeLabel(dish) {
  if (dish?.qty_mode === "fixed") return `כמות קבועה: ${num(dish.fixed_event_qty)} לאירוע`;
  if (dish?.qty_mode === "per_guests") return `${num(dish.per_guests_qty)} לכל ${num(dish.per_guests_base) || 100} אורחים`;
  return `אחוז הגשה: ${dish?.serving_percentage || 100}%`;
}

// Stored Events_Dish.planned_qty / planned_cost for a dish in an event — the
// same formula the event form uses when a dish is added (before waste):
// guests eating the standard menu × serving % × portion factor, or the
// number of preparations when the dish has preparation/portion grams.
export function computePlannedDish(dish, event, isFirstCourse) {
  let qty = explicitDishQty(dish, event);
  if (qty == null) {
    const guestCount = calculateAdultPortions(event?.guest_count, event?.vegan_count, event?.glatt_count);
    const servingPct = (dish.serving_percentage ?? 100) / 100;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      qty = Math.ceil((guestCount * servingPct) / (dish.preparation_mass_grams / dish.portion_size_grams));
    } else {
      const factor = (isFirstCourse && event?.event_type !== "wedding") ? 1 / 6 : (dish.portion_factor ?? 1);
      qty = Math.ceil(guestCount * servingPct * factor);
    }
  }
  return { planned_qty: qty, planned_cost: qty * (dish.unit_cost || 0) };
}
