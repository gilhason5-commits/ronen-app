// Batch yield of a sub-dish (SpecialIngredient) — what the dialog shows as
// "כמות כוללת" and what purchasing/prints divide by to get batches.
//
// Each component counts in the sub-dish's own unit. ק״ג and ליטר count 1:1
// (as before). A component bought per יחידה counts by its ingredient's
// "כמות ליחידה" (unit_size_grams, grams or ml per unit) — e.g. 5 sprigs of
// rosemary at 40g each add 0.2 to a sauce measured in ליטר, not 5.
// A יחידה component with no unit size set still counts by its raw qty (the
// old behaviour) and is reported in `missing` so the dialog can warn.

const MASS_UNITS = new Set(["ק״ג", "קילוגרם", "ק\"ג", "קג", "ליטר"]);
const isMassUnit = (u) => MASS_UNITS.has((u || "").trim());
const isPieceUnit = (u) => (u || "").trim() === "יחידה";
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Grams/ml per unit when `source` (a יחידה ingredient) is weighed into a
// ק״ג/ליטר sub-dish; 0 when it counts as-is.
export function weighedUnitSize(source, targetUnit) {
  if (!isMassUnit(targetUnit) || !isPieceUnit(source?.system_unit)) return 0;
  return num(source?.unit_size_grams);
}

// `sourceOf(id)` returns the component's Ingredient or SpecialIngredient.
export function componentYield(comp, source, targetUnit) {
  const qty = num(comp?.qty);
  const unit = source?.system_unit || comp?.unit;
  if (isMassUnit(targetUnit) && isPieceUnit(unit)) {
    const grams = num(source?.unit_size_grams);
    if (grams > 0) return { qty: (qty * grams) / 1000, missing: false };
    return { qty, missing: true };
  }
  return { qty, missing: false };
}

export function specialIngredientYield(si, sourceOf) {
  let total = 0;
  const missing = [];
  for (const comp of si?.components || []) {
    const source = sourceOf(comp.ingredient_id);
    const y = componentYield(comp, source, si?.system_unit);
    total += y.qty;
    if (y.missing) missing.push(source?.name || comp.ingredient_name || "רכיב");
  }
  return { total, missing };
}

// Batch size for dividing demand into batches — never 0.
export const specialIngredientBatchSize = (si, sourceOf) => specialIngredientYield(si, sourceOf).total || 1;
