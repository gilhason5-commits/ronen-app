import { base44 } from "@/api/base44Client";
import {
  localDateString,
  buildChangeIndex,
  ingredientAt,
  latestChangeDate,
  makeCostContext,
  dishUnitCostAt,
  specialIngredientPriceAt,
  dishesUsingIngredient,
} from "@/lib/ingredientTerms";
import { computeEventFoodCost } from "@/lib/eventFoodCost";

const PRICE_FIELDS = ["base_price", "purchase_unit", "price_per_system", "price_per_unit", "last_price_update"];
const SUPPLIER_FIELDS = ["current_supplier_id", "current_supplier_name"];

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

// Did the form change the ingredient's price (purchase price / purchase unit)
// or supplier, compared with `terms`? Those are the changes that take effect
// from a chosen date.
export function datedTermsChanged(terms, data) {
  const priceChanged =
    num(data.base_price) !== num(terms.base_price) ||
    num(data.purchase_unit || 1) !== num(terms.purchase_unit || 1);
  const supplierChanged = (data.current_supplier_id || null) !== (terms.current_supplier_id || null);
  return { priceChanged, supplierChanged, any: priceChanged || supplierChanged };
}

export async function loadIngredientChanges(ingredientId) {
  return base44.entities.Ingredient_Price_History.filter({ ingredient_id: ingredientId });
}

// Earliest date a new change may take effect: not before the last change
// already recorded for this ingredient.
export function minEffectiveDate(ingredientId, changes) {
  return latestChangeDate(ingredientId, buildChangeIndex(changes));
}

// Save an edited ingredient whose price and/or supplier changes from
// `effectiveFrom` (YYYY-MM-DD). Today or earlier: the Ingredient row takes
// the new terms now. Later: the row keeps today's terms and the change waits
// (applied = false) for /api/apply-ingredient-changes on that date. Either
// way events dated before `effectiveFrom` keep the old price and supplier.
export async function saveIngredientWithDatedChange(ingredient, dataToSave, effectiveFrom) {
  const today = localDateString();
  const changes = await loadIngredientChanges(ingredient.id);
  const minDate = minEffectiveDate(ingredient.id, changes);
  if (minDate && effectiveFrom < minDate) {
    throw new Error(`כבר נרשם שינוי לרכיב החל מ-${minDate.split("-").reverse().join("/")} — אי אפשר לקבוע שינוי לפני התאריך הזה`);
  }

  // Terms in effect just before this change, on its date (includes any
  // earlier future change already waiting).
  const before = ingredientAt(ingredient, effectiveFrom, buildChangeIndex(changes));
  const { priceChanged, supplierChanged } = datedTermsChanged(before, dataToSave);
  const isNow = effectiveFrom <= today;

  if (priceChanged || supplierChanged) {
    await base44.entities.Ingredient_Price_History.create({
      ingredient_id: ingredient.id,
      ingredient_name: dataToSave.name,
      effective_from: effectiveFrom,
      applied: isNow,
      price_changed: priceChanged,
      supplier_changed: supplierChanged,
      old_price: num(before.base_price),
      new_price: num(dataToSave.base_price),
      old_purchase_unit: num(before.purchase_unit || 1),
      new_purchase_unit: num(dataToSave.purchase_unit || 1),
      old_price_per_system: num(before.price_per_system),
      new_price_per_system: num(dataToSave.price_per_system),
      old_supplier_id: before.current_supplier_id || null,
      old_supplier_name: before.current_supplier_name || "",
      new_supplier_id: dataToSave.current_supplier_id || null,
      new_supplier_name: dataToSave.current_supplier_name || "",
      supplier_id: dataToSave.current_supplier_id || null,
      supplier_name: dataToSave.current_supplier_name || "",
      change_date: today,
    });
  }

  const update = { ...dataToSave };
  if (!isNow) {
    // Future change: everything else saves now, price/supplier stay as today.
    for (const f of [...PRICE_FIELDS, ...SUPPLIER_FIELDS]) delete update[f];
  }
  const result = await base44.entities.Ingredient.update(ingredient.id, update);
  await refreshCostsAfterChange(ingredient.id, effectiveFrom);
  return result;
}

// Cancel a future change that hasn't taken effect yet.
export async function cancelPendingChange(row) {
  if (row.applied) throw new Error("השינוי כבר נכנס לתוקף");
  await base44.entities.Ingredient_Price_History.delete(row.id);
  await refreshCostsAfterChange(row.ingredient_id, row.effective_from);
}

// After a dated change: re-store today's cost of the dishes / sub-dishes that
// use the ingredient (shown on the dishes pages), and the stored food cost of
// events from `fromDate` on (dashboard / reports read the stored value).
export async function refreshCostsAfterChange(ingredientId, fromDate) {
  const [ingredients, specialIngredients, changes, dishes, categories] = await Promise.all([
    base44.entities.Ingredient.list(),
    base44.entities.SpecialIngredient.list(),
    base44.entities.Ingredient_Price_History.list("effective_from"),
    base44.entities.Dish.list(),
    base44.entities.Category.list(),
  ]);
  const ctx = makeCostContext({ ingredients, specialIngredients, changes });
  const today = localDateString();
  const { affectedDishes, affectedSpecialIds } = dishesUsingIngredient(ingredientId, dishes, specialIngredients);

  for (const siId of affectedSpecialIds) {
    const si = ctx.specialById[siId];
    const totalQty = (si.components || []).reduce((sum, c) => sum + num(c.qty), 0);
    const pricePerUnit = specialIngredientPriceAt(si, today, ctx);
    if (Math.abs(pricePerUnit - num(si.price_per_system_unit)) > 0.0001) {
      await base44.entities.SpecialIngredient.update(siId, {
        price_per_system_unit: pricePerUnit,
        total_cost: pricePerUnit * totalQty,
      });
    }
  }
  for (const dish of affectedDishes) {
    const unitCost = dishUnitCostAt(dish, today, ctx);
    if (Math.abs(unitCost - num(dish.unit_cost)) > 0.0001) {
      await base44.entities.Dish.update(dish.id, { unit_cost: unitCost });
    }
  }

  if (affectedDishes.length === 0) return;
  const affectedDishIds = new Set(affectedDishes.map((d) => d.id));
  const events = await base44.entities.Event.listWhere((q) => q.gte("event_date", fromDate), "event_date");
  if (events.length === 0) return;
  const eventDishes = await base44.entities.Events_Dish.filter({ event_id: events.map((e) => e.id) });
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));

  for (const event of events) {
    const eds = eventDishes.filter((ed) => ed.event_id === event.id);
    if (!eds.some((ed) => affectedDishIds.has(ed.dish_id))) continue;
    const { foodCostSum, foodCostPct } = computeEventFoodCost(event, eds, dishesById, categoriesById, ctx);
    if (Math.abs(foodCostSum - num(event.food_cost_sum)) > 0.01) {
      await base44.entities.Event.update(event.id, { food_cost_sum: foodCostSum, food_cost_pct: foodCostPct });
    }
  }
}
