// Dish and sub-dish recipes store ingredient refs (id + name + unit) that
// outlive the ingredient itself: deleting an ingredient leaves the refs in
// place, and every id lookup then misses, so prints silently drop the line.
// This appends a flagged placeholder per missing id so it still prints.
export const MISSING_INGREDIENT_LABEL = '⚠ לא קיים במלאי';

export function withMissingIngredients(ingredients = [], dishes = [], specialIngredients = []) {
  const known = new Set([...ingredients, ...specialIngredients].map(i => i.id));
  const placeholders = {};
  const refs = [
    ...dishes.flatMap(d => d.ingredients || []),
    ...specialIngredients.flatMap(si => si.components || []),
  ];
  refs.forEach(ref => {
    const id = ref?.ingredient_id;
    if (!id || known.has(id) || placeholders[id]) return;
    placeholders[id] = {
      id,
      name: `${(ref.ingredient_name || 'רכיב').trim()} (${MISSING_INGREDIENT_LABEL})`,
      system_unit: ref.unit,
      waste_pct: 0,
      price_per_system: 0,
      missing: true,
    };
  });
  const extra = Object.values(placeholders);
  return extra.length ? [...ingredients, ...extra] : ingredients;
}

// Names of dishes / sub-dishes whose recipe uses the given ingredient.
export function ingredientUsage(ingredientId, dishes = [], specialIngredients = []) {
  const uses = (refs) => (refs || []).some(r => r.ingredient_id === ingredientId);
  return [
    ...dishes.filter(d => uses(d.ingredients)).map(d => d.name),
    ...specialIngredients.filter(si => uses(si.components)).map(si => si.name),
  ];
}
