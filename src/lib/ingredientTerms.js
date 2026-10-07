// Date-aware ingredient "terms" (price + supplier).
//
// A price or supplier change on an ingredient takes effect from a chosen
// date (Ingredient_Price_History.effective_from), possibly in the future, so
// events dated before the change keep the old price/supplier — both in their
// food cost and in their purchase orders.
//
// The Ingredient row always holds the terms in effect today. History rows
// with applied = true are already on it (walk them back for earlier dates);
// rows with applied = false are future changes not yet copied onto it
// (walk them forward for later dates).
//
// Plain ES module with no "@/" imports — also used by the /api cron that
// applies future changes when their date arrives.

export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

// ingredient_id -> its change rows, oldest effective date first.
export function buildChangeIndex(changes = []) {
  const index = new Map();
  for (const row of changes) {
    if (!row?.ingredient_id || !row.effective_from) continue;
    if (!index.has(row.ingredient_id)) index.set(row.ingredient_id, []);
    index.get(row.ingredient_id).push(row);
  }
  for (const rows of index.values()) {
    rows.sort((a, b) =>
      a.effective_from.localeCompare(b.effective_from) ||
      String(a.created_date || "").localeCompare(String(b.created_date || ""))
    );
  }
  return index;
}

function withTerms(ing, row, side) {
  const next = { ...ing };
  if (row.price_changed) {
    const basePrice = num(row[`${side}_price`]);
    const purchaseUnit = num(row[`${side}_purchase_unit`]);
    const pricePerSystem = num(row[`${side}_price_per_system`]);
    if (basePrice != null) next.base_price = basePrice;
    if (purchaseUnit != null) next.purchase_unit = purchaseUnit;
    if (pricePerSystem != null) {
      next.price_per_system = pricePerSystem;
      next.price_per_unit = pricePerSystem;
    }
  }
  if (row.supplier_changed) {
    next.current_supplier_id = row[`${side}_supplier_id`] || null;
    next.current_supplier_name = row[`${side}_supplier_name`] || "";
  }
  return next;
}

// The ingredient as it was / will be on `date` (YYYY-MM-DD).
export function ingredientAt(ingredient, date, index) {
  const rows = ingredient && index?.get(ingredient.id);
  if (!rows?.length || !date) return ingredient;
  let ing = ingredient;
  for (const row of rows) {
    if (!row.applied && row.effective_from <= date) ing = withTerms(ing, row, "new");
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row.applied && row.effective_from > date) ing = withTerms(ing, row, "old");
  }
  return ing;
}

// Whether a dated change (made with the "from which date" popup) touched this
// ingredient's price / supplier — only then do the dated terms override the
// supplier catalog (items_supplied) in purchasing. Rows logged before dated
// changes existed only recorded a price and carry no purchase unit.
export function hasDatedChange(ingredientId, index, kind) {
  const rows = index?.get(ingredientId);
  return !!rows?.some((r) =>
    kind === "supplier" ? r.supplier_changed : (r.price_changed && r.new_purchase_unit != null)
  );
}

// Latest effective date recorded for an ingredient — a new change can't be
// dated before it (otherwise the walk back/forward would mix up the order).
export function latestChangeDate(ingredientId, index) {
  const rows = index?.get(ingredientId);
  return rows?.length ? rows[rows.length - 1].effective_from : null;
}

// Per-system-unit price used in dish cost: supplier price / purchase unit,
// grossed up for the ingredient's waste % (same as DishDialog).
function dishPricePerSystem(ing) {
  const purchaseUnit = num(ing.purchase_unit) || 1;
  const base = num(ing.price_per_system) ?? ((num(ing.base_price) ?? 0) / purchaseUnit);
  const wastePct = num(ing.waste_pct) || 0;
  return wastePct > 0 ? base / (1 - wastePct / 100) : base;
}

// Sub-dish (SpecialIngredient) price per system unit on `date` — same formula
// as SpecialIngredientDialog (component prices without waste, averaged over
// the total quantity). Falls back to the stored price when it has no
// components to compute from.
export function specialIngredientPriceAt(si, date, ctx) {
  const components = si?.components || [];
  let totalCost = 0;
  let totalQty = 0;
  for (const comp of components) {
    const base = ctx.ingredientsById[comp.ingredient_id];
    if (!base) continue;
    const ing = ingredientAt(base, date, ctx.index);
    const qty = num(comp.qty) || 0;
    totalCost += qty * (num(ing.price_per_system) || 0);
    totalQty += qty;
  }
  if (totalQty > 0) return totalCost / totalQty;
  return num(si?.price_per_system_unit) || 0;
}

// Dish unit cost on `date` — same formula as DishDialog.calculateDishCost.
// A dish with no ingredient list keeps its stored unit_cost.
export function dishUnitCostAt(dish, date, ctx) {
  const items = dish?.ingredients || [];
  if (!ctx || items.length === 0) return num(dish?.unit_cost) || 0;
  let total = 0;
  for (const item of items) {
    const qty = num(item.qty) || 0;
    const si = ctx.specialById[item.ingredient_id];
    if (si) {
      total += qty * specialIngredientPriceAt(si, date, ctx);
      continue;
    }
    const base = ctx.ingredientsById[item.ingredient_id];
    if (base) total += qty * dishPricePerSystem(ingredientAt(base, date, ctx.index));
  }
  return total;
}

export function makeCostContext({ ingredients = [], specialIngredients = [], changes = [] }) {
  return {
    ingredientsById: Object.fromEntries(ingredients.map((i) => [i.id, i])),
    specialById: Object.fromEntries(specialIngredients.map((s) => [s.id, s])),
    index: buildChangeIndex(changes),
  };
}

// Dishes / sub-dishes that use an ingredient (directly or via a sub-dish) —
// the ones whose stored cost moves when its price changes.
export function dishesUsingIngredient(ingredientId, dishes, specialIngredients) {
  const viaSpecial = new Set(
    specialIngredients
      .filter((si) => (si.components || []).some((c) => c.ingredient_id === ingredientId))
      .map((si) => si.id)
  );
  const affectedDishes = dishes.filter((d) =>
    (d.ingredients || []).some((it) => it.ingredient_id === ingredientId || viaSpecial.has(it.ingredient_id))
  );
  return { affectedDishes, affectedSpecialIds: [...viaSpecial] };
}
