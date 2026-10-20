// Batch yield of a sub-dish (SpecialIngredient) — what the dialog shows as
// "כמות כוללת" and what purchasing/prints divide by to get batches.
//
// Each component counts in the sub-dish's own unit. ק״ג and ליטר count 1:1
// (as before). A component written in ק״ג/ליטר counts as written. A component
// written in יחידה counts by its ingredient's "כמות ליחידה" (unit_size_grams,
// grams or ml per unit) — e.g. 5 sprigs of rosemary at 40g each add 0.2 to a
// sauce measured in ליטר, not 5.
// A יחידה component with no unit size set still counts by its raw qty (the
// old behaviour) and is reported in `missing` so the dialog can warn.

import { isPieceUnit, isWeighedUnit, rowQtyInSystemUnits, unitSizeOf } from "@/lib/recipeQty";

// `sourceOf(id)` returns the component's Ingredient or SpecialIngredient.
export function componentYield(comp, source, targetUnit) {
  const qty = rowQtyInSystemUnits(comp, source);
  const unit = source?.system_unit || comp?.unit;
  if (isWeighedUnit(targetUnit) && isPieceUnit(unit)) {
    const grams = unitSizeOf(source);
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
