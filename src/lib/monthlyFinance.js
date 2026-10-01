// Monthly P&L building blocks shared by עמוד הוצאות and the reports page,
// so both always count the same events, guests and revenue.
import { calculateTotalGuests } from "@/lib/dinerCount";

export const VAT_RATE = 0.18;

export const withoutVat = (amountInclVat) => (Number(amountInclVat) || 0) / (1 + VAT_RATE);

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** First and last YYYY-MM-DD of the month containing `date`. */
export function monthRange(date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const key = monthKey(date);
  return [`${key}-01`, `${key}-${String(last).padStart(2, "0")}`];
}

// Only events that actually happen count toward a month: approved by the
// producer (in progress) or already completed — not drafts or cancellations.
export const COUNTED_STATUSES = ["in_progress", "completed"];

export function countedEventsInMonth(events, date) {
  const key = monthKey(date);
  return events.filter((e) => COUNTED_STATUSES.includes(e.status) && e.event_date?.slice(0, 7) === key);
}

/** סה״כ אורחים — the same total the event form shows. */
export function eventGuests(e) {
  return calculateTotalGuests(e.guest_count, e.children_count, e.vegan_count, e.glatt_count, e.reserves);
}

// Same per-event total-revenue formula as EventSummary.jsx: food revenue
// (price_per_plate × guests, falling back to event_price) plus every
// addition line item. Entered amounts include VAT.
export function eventTotalRevenue(e) {
  const guestCount = e.guest_count ?? e.total_guests ?? 0;
  const calculatedRevenue = (parseFloat(e.price_per_plate) || 0) * (parseFloat(guestCount) || 0);
  const foodRevenue = calculatedRevenue || parseFloat(e.event_price) || 0;
  const additions =
    (parseFloat(e.lighting_sound_cost) || 0) +
    (parseFloat(e.after_party_food_cost) || 0) +
    (parseFloat(e.custom_addition_1_amount) || 0) +
    (parseFloat(e.custom_addition_2_amount) || 0);
  return foodRevenue + additions;
}

const sumAmounts = (rows) => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

/**
 * Event-dependent general expenses for a month (pre-VAT): per-event items ×
 * the month's events, plus per-guest items × the month's total guests.
 */
export function generalExpensesForMonth(items, monthEvents) {
  const eventCount = monthEvents.length;
  const guestCount = monthEvents.reduce((sum, e) => sum + eventGuests(e), 0);
  const perEventUnit = sumAmounts(items.filter((i) => i.basis === "per_event"));
  const perGuestUnit = sumAmounts(items.filter((i) => i.basis === "per_guest"));
  const perEventTotal = perEventUnit * eventCount;
  const perGuestTotal = perGuestUnit * guestCount;
  return { eventCount, guestCount, perEventUnit, perGuestUnit, perEventTotal, perGuestTotal, total: perEventTotal + perGuestTotal };
}

export const fixedExpensesTotal = (fixedExpenses) => sumAmounts(fixedExpenses.filter((e) => e.is_active !== false));
