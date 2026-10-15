// Event-level food reduction ("פחת") driven by the adult-commitment headcount
// (event.guest_count). The factor is derived LIVE from guest_count at every
// consumption point — quantities are NOT re-baked into the DB — so the rule
// applies retroactively to every future event already in the system.
//
// Shown to users as "הפחתת כמות לאירוע גדול" — not "פחת", which is the
// per-ingredient waste.
//
// Brackets (guest_count = סה״כ מבוגרים להתחייבות):
//   < 150        → 0%
//   150 – 249    → 2.5%
//   250 – 349    → 5%
//   ≥ 350        → 7.5%
//
// Friday events get 10% more food on top of that (×1.1), also live — so
// every Friday event already in the system, past or future, picks it up.
//
// Every function here takes either the event itself (needed for the Friday
// rule) or a bare guest count (reduction only).
export const FRIDAY_EXTRA_PCT = 0.10;

const guestsOf = (eventOrGuests) =>
  eventOrGuests && typeof eventOrGuests === 'object' ? eventOrGuests.guest_count : eventOrGuests;

export function isFridayEvent(eventOrGuests) {
  const date = eventOrGuests && typeof eventOrGuests === 'object' ? eventOrGuests.event_date : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  return !!m && new Date(+m[1], +m[2] - 1, +m[3]).getDay() === 5;
}

export function eventWastePct(eventOrGuests) {
  const n = parseInt(guestsOf(eventOrGuests), 10) || 0;
  if (n >= 350) return 0.075;
  if (n >= 250) return 0.05;
  if (n >= 150) return 0.025;
  return 0;
}

// Multiplier to apply to a quantity/cost (e.g. 0.95 for a 5% reduction,
// 0.95 × 1.1 = 1.045 for the same event on a Friday).
export function eventWasteFactor(eventOrGuests) {
  const friday = isFridayEvent(eventOrGuests) ? 1 + FRIDAY_EXTRA_PCT : 1;
  return Math.round((1 - eventWastePct(eventOrGuests)) * friday * 10000) / 10000;
}

// Apply the reduction to an already-computed BASE quantity.
// Ceils so we never round down into under-catering.
export function applyWasteToQty(baseQty, eventOrGuests) {
  const factor = eventWasteFactor(eventOrGuests);
  if (factor === 1) return baseQty || 0;
  // Rounded first so float noise (100 × 1.1 = 110.00000000000001) does not ceil up.
  return Math.ceil(Math.round((baseQty || 0) * factor * 1e6) / 1e6);
}

// Apply the reduction to a continuous value (cost, ingredient grams) — no rounding.
export function applyWasteToValue(value, eventOrGuests) {
  return (value || 0) * eventWasteFactor(eventOrGuests);
}

// Short human label for the applied reduction, e.g. "−5% (×0.95)".
// Returns '' when no reduction applies.
export function wasteLabel(eventOrGuests) {
  const pct = eventWastePct(eventOrGuests);
  if (pct <= 0) return '';
  const pctNum = pct * 100;
  const pctStr = Number.isInteger(pctNum) ? String(pctNum) : pctNum.toFixed(1);
  return `−${pctStr}%`;
}

// Short label for the Friday increase, e.g. "+10%". '' when not a Friday.
export function fridayLabel(event) {
  return isFridayEvent(event) ? `+${FRIDAY_EXTRA_PCT * 100}%` : '';
}
