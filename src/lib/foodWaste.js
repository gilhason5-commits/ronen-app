// Event-level food reduction ("פחת") driven by the adult-commitment headcount
// (event.guest_count). The factor is derived LIVE from guest_count at every
// consumption point — quantities are NOT re-baked into the DB — so the rule
// applies retroactively to every future event already in the system.
//
// Brackets (guest_count = סה״כ מבוגרים להתחייבות):
//   < 150        → 0%
//   150 – 249    → 2.5%
//   250 – 349    → 5%
//   ≥ 350        → 7.5%
export function eventWastePct(guestCount) {
  const n = parseInt(guestCount, 10) || 0;
  if (n >= 350) return 0.075;
  if (n >= 250) return 0.05;
  if (n >= 150) return 0.025;
  return 0;
}

// Multiplier to apply to a quantity/cost (e.g. 0.95 for a 5% reduction).
export function eventWasteFactor(guestCount) {
  return 1 - eventWastePct(guestCount);
}

// Apply the reduction to an already-computed BASE quantity.
// Ceils so we never round down into under-catering.
export function applyWasteToQty(baseQty, guestCount) {
  const factor = eventWasteFactor(guestCount);
  if (factor >= 1) return baseQty || 0;
  return Math.ceil((baseQty || 0) * factor);
}

// Apply the reduction to a continuous value (cost, ingredient grams) — no rounding.
export function applyWasteToValue(value, guestCount) {
  return (value || 0) * eventWasteFactor(guestCount);
}

// Short human label for the applied reduction, e.g. "−5% (×0.95)".
// Returns '' when no reduction applies.
export function wasteLabel(guestCount) {
  const pct = eventWastePct(guestCount);
  if (pct <= 0) return '';
  const pctNum = pct * 100;
  const pctStr = Number.isInteger(pctNum) ? String(pctNum) : pctNum.toFixed(1);
  return `−${pctStr}%`;
}
