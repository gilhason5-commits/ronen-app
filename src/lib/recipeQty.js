// A recipe row (dish ingredient / sub-dish component) keeps the unit it was
// written in — ק״ג, ליטר or יחידה. Cost and purchasing count the ingredient in
// its card's unit (system_unit), so a row written in ק״ג/ליטר for a יחידה
// ingredient converts through the card's "כמות ליחידה" (unit_size_grams) when
// read. Editing the card therefore flows into every existing recipe.

const UNIT_ALIASES = {
  "ק״ג": "ק״ג", "ק\"ג": "ק״ג", "קג": "ק״ג", "קילוגרם": "ק״ג", "kg": "ק״ג",
  "ליטר": "ליטר", "l": "ליטר", "liter": "ליטר", "litre": "ליטר",
  "יחידה": "יחידה", "unit": "יחידה", "units": "יחידה", "pcs": "יחידה",
};

export const normalizeUnit = (u) => {
  const s = (u || "").trim();
  return UNIT_ALIASES[s.toLowerCase()] || UNIT_ALIASES[s] || s;
};
export const isWeighedUnit = (u) => ["ק״ג", "ליטר"].includes(normalizeUnit(u));
export const isPieceUnit = (u) => normalizeUnit(u) === "יחידה";

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Grams/ml in one unit of `source`, or 0 when it is not a יחידה ingredient
// with "כמות ליחידה" set.
export const unitSizeOf = (source) =>
  isPieceUnit(source?.system_unit) ? num(source?.unit_size_grams) : 0;

// Units a row can be written in for `source`: its own unit, plus ק״ג/ליטר
// when the card says how much one unit weighs.
export const rowUnitOptions = (source) => {
  const own = normalizeUnit(source?.system_unit);
  return unitSizeOf(source) ? [own, "ק״ג", "ליטר"] : [own];
};

// The row's quantity in the source's own unit.
export function rowQtyInSystemUnits(row, source) {
  const qty = num(row?.qty);
  const size = unitSizeOf(source);
  if (size && isWeighedUnit(row?.unit)) return (qty * 1000) / size;
  return qty;
}

// Re-express `qty` written in `fromUnit` in `toUnit`, keeping the same amount
// (used when the row's unit is switched in the editor).
export function convertRowQty(qty, fromUnit, toUnit, source) {
  const size = unitSizeOf(source);
  const q = num(qty);
  if (!size || normalizeUnit(fromUnit) === normalizeUnit(toUnit)) return q;
  if (isWeighedUnit(fromUnit) && isPieceUnit(toUnit)) return (q * 1000) / size;
  if (isPieceUnit(fromUnit) && isWeighedUnit(toUnit)) return (q * size) / 1000;
  return q; // ק״ג ↔ ליטר: same number (גרם / מ״ל per unit)
}
