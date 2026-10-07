import { createClient } from '@supabase/supabase-js';
import {
  makeCostContext,
  dishUnitCostAt,
  specialIngredientPriceAt,
  dishesUsingIngredient,
} from '../src/lib/ingredientTerms.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function israelToday() {
  // en-CA formats as YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

async function all(table, orderBy) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*').range(from, from + 999);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * Called by /api/run-all (a helper module, not its own endpoint — the plan
 * caps the number of serverless functions). Future-dated ingredient price/supplier changes wait in
 * Ingredient_Price_History with applied = false. Once their date arrives
 * (Israel time), copy them onto the Ingredient row and re-store today's cost
 * of the dishes / sub-dishes that use it. Event costs and purchase orders
 * already price each event by its own date, so they need nothing here.
 * Idempotent — safe to run every 10 minutes.
 */
export async function applyIngredientChanges() {
  const today = israelToday();
  const { data: due, error } = await supabase
    .from('Ingredient_Price_History')
    .select('*')
    .eq('applied', false)
    .lte('effective_from', today)
    .order('effective_from', { ascending: true })
    .order('created_date', { ascending: true });
  if (error) throw error;
  if (!due.length) return { ok: true, applied: 0 };

  const touched = new Set();
  for (const row of due) {
    const update = {};
    if (row.price_changed) {
      update.base_price = row.new_price;
      update.purchase_unit = row.new_purchase_unit;
      update.price_per_system = row.new_price_per_system;
      update.price_per_unit = row.new_price_per_system;
      update.last_price_update = row.effective_from;
    }
    if (row.supplier_changed) {
      update.current_supplier_id = row.new_supplier_id;
      update.current_supplier_name = row.new_supplier_name || '';
    }
    if (Object.keys(update).length) {
      const { error: upErr } = await supabase.from('Ingredient').update(update).eq('id', row.ingredient_id);
      if (upErr) throw upErr;
    }
    const { error: markErr } = await supabase
      .from('Ingredient_Price_History')
      .update({ applied: true })
      .eq('id', row.id);
    if (markErr) throw markErr;
    touched.add(row.ingredient_id);
  }

  // Re-store today's cost of affected dishes / sub-dishes.
  const [ingredients, specialIngredients, changes, dishes] = await Promise.all([
    all('Ingredient'),
    all('SpecialIngredient'),
    all('Ingredient_Price_History', 'effective_from'),
    all('Dish'),
  ]);
  const ctx = makeCostContext({ ingredients, specialIngredients, changes });
  let dishesUpdated = 0;
  for (const ingredientId of touched) {
    const { affectedDishes, affectedSpecialIds } = dishesUsingIngredient(ingredientId, dishes, specialIngredients);
    for (const siId of affectedSpecialIds) {
      const si = ctx.specialById[siId];
      const totalQty = (si.components || []).reduce((s, c) => s + (parseFloat(c.qty) || 0), 0);
      const price = specialIngredientPriceAt(si, today, ctx);
      await supabase.from('SpecialIngredient')
        .update({ price_per_system_unit: price, total_cost: price * totalQty })
        .eq('id', siId);
    }
    for (const dish of affectedDishes) {
      await supabase.from('Dish').update({ unit_cost: dishUnitCostAt(dish, today, ctx) }).eq('id', dish.id);
      dishesUpdated++;
    }
  }

  return { ok: true, applied: due.length, ingredients: touched.size, dishesUpdated };
}
