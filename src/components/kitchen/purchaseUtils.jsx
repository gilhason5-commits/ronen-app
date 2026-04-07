import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';

export const roundToPurchaseUnit = (qty, purchaseUnit) => {
  if (!purchaseUnit || purchaseUnit <= 0) return qty;
  return Math.ceil(qty / purchaseUnit) * purchaseUnit;
};

/**
 * Calculate ingredient needs per event for all approved events in a given week.
 * Returns: { eventId: { ingredientId: { ingredient_name, unit, qty, price_per_unit, total_price, supplier_id, supplier_name } } }
 */
export function calcIngredientNeedsPerEvent(events, eventDishesMap, dishes, ingredients, specialIngredients, categories, suppliers) {
  const result = {};

  // Build supplier lookup by ingredient_id
  const supplierByIngredient = {};
  (suppliers || []).forEach(sup => {
    (sup.items_supplied || []).forEach(item => {
      if (item.ingredient_id) {
        supplierByIngredient[item.ingredient_id] = {
          supplier_id: sup.id,
          supplier_name: sup.name,
          supplier_type: sup.supplier_type || 'daily',
          price_per_unit: item.price_per_unit || 0,
          unit: item.unit
        };
      }
    });
  });

  const isFirstCourseDish = (dish) => {
    const dishCategories = (categories || []).filter(cat => dish.categories?.includes(cat.id));
    return dishCategories.some(cat => {
      const name = (cat.name || '').toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
  };

  const getEffectivePlannedQty = (eventDish, event) => {
    if (eventDish.planned_qty && eventDish.planned_qty > 0) return eventDish.planned_qty;
    const dish = dishes.find(d => d.id === eventDish.dish_id);
    if (!dish) return 0;
    const guestCount = event?.guest_count || 0;
    const servingPercentage = dish.serving_percentage ?? 100;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = guestCount * (servingPercentage / 100);
      return Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    }
    // For wedding events, skip the 1/6 first course division
    const isWedding = event?.event_type === 'wedding';
    const portionFactor = (!isWedding && isFirstCourseDish(dish)) ? 1 / 7 : (dish.portion_factor ?? 1);
    const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
    return Math.ceil(rawQuantity);
  };

  events.forEach(event => {
    const evDishes = eventDishesMap[event.id] || [];
    const eventNeeds = {};

    evDishes.forEach(ed => {
      const dish = dishes.find(d => d.id === ed.dish_id);
      if (!dish) return;
      const effectiveQty = getEffectivePlannedQty(ed, event);
      if (!effectiveQty || effectiveQty <= 0) return;

      (dish.ingredients || []).forEach(ing => {
        // Check if it's a special ingredient
        const si = (specialIngredients || []).find(s => s.id === ing.ingredient_id);
        if (si) {
          // Expand special ingredient into its components
          const siQtyNeeded = (ing.qty || 0) * effectiveQty;
          const batchSize = si.total_quantity || 1;
          const batches = Math.ceil(siQtyNeeded / batchSize);

          (si.components || []).forEach(comp => {
            const compIngredient = ingredients.find(i => i.id === comp.ingredient_id);
            if (!compIngredient) return;
            const rawCompQty = (comp.qty || 0) * batches;
            const compWastePct = compIngredient.waste_pct || 0;
            const compQty = compWastePct > 0 ? rawCompQty / (1 - compWastePct / 100) : rawCompQty;
            const supInfo = supplierByIngredient[comp.ingredient_id];
            const pricePerUnit = supInfo?.price_per_unit || compIngredient.price_per_system || 0;

            const key = comp.ingredient_id;
            if (!eventNeeds[key]) {
              eventNeeds[key] = {
                ingredient_id: comp.ingredient_id,
                ingredient_name: compIngredient.name || comp.ingredient_name,
                unit: compIngredient.system_unit || comp.unit,
                qty: 0,
                waste_pct: compIngredient.waste_pct || 0,
                price_per_unit: pricePerUnit,
                supplier_id: supInfo?.supplier_id || compIngredient.current_supplier_id || '',
                supplier_name: supInfo?.supplier_name || compIngredient.current_supplier_name || '',
                supplier_type: supInfo?.supplier_type || 'daily',
                purchase_unit: compIngredient.purchase_unit || 1
              };
            }
            eventNeeds[key].qty += compQty;
          });
          return;
        }

        const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
        if (!ingredient) return;

        const rawQtyNeeded = (ing.qty || 0) * effectiveQty;
        const wastePct = ingredient.waste_pct || 0;
        const qtyNeeded = wastePct > 0 ? rawQtyNeeded / (1 - wastePct / 100) : rawQtyNeeded;
        const supInfo = supplierByIngredient[ing.ingredient_id];
        const pricePerUnit = supInfo?.price_per_unit || ingredient.price_per_system || 0;

        const key = ing.ingredient_id;
        if (!eventNeeds[key]) {
          eventNeeds[key] = {
            ingredient_id: ing.ingredient_id,
            ingredient_name: ingredient.name || ing.ingredient_name,
            unit: ingredient.system_unit || ing.unit,
            qty: 0,
            waste_pct: ingredient.waste_pct || 0,
            price_per_unit: pricePerUnit,
            supplier_id: supInfo?.supplier_id || ingredient.current_supplier_id || '',
            supplier_name: supInfo?.supplier_name || ingredient.current_supplier_name || '',
            supplier_type: supInfo?.supplier_type || 'daily',
            purchase_unit: ingredient.purchase_unit || 1
          };
        }
        eventNeeds[key].qty += qtyNeeded;
      });
    });

    // Compute total_price and purchase_qty for each
    Object.values(eventNeeds).forEach(n => {
      n.purchase_qty = roundToPurchaseUnit(n.qty, n.purchase_unit);
      n.total_price = n.qty * n.price_per_unit;
    });

    result[event.id] = eventNeeds;
  });

  return result;
}

/**
 * Group ingredient needs by supplier for a list of events.
 * For daily suppliers: one ticket per event per supplier
 * For weekly suppliers: one ticket per supplier aggregating all events
 */
export function buildSupplierTickets(events, needsPerEvent, suppliers) {
  const supplierMap = {};
  (suppliers || []).forEach(s => { supplierMap[s.id] = s; });

  const dailyTickets = []; // { supplier, event, items: [{ingredient_id, ingredient_name, unit, qty, price_per_unit, total_price}], deliveryDate }
  const weeklyTicketsMap = {}; // supplierId -> { supplier, items: {ingId: {aggregated}}, perEvent: {ingId: [{eventName, qty}]}, deliveryDate }

  events.forEach(event => {
    const eventNeeds = needsPerEvent[event.id] || {};
    // Group by supplier
    const bySupplier = {};

    Object.values(eventNeeds).forEach(need => {
      const supId = need.supplier_id;
      if (!supId) return;
      if (!bySupplier[supId]) bySupplier[supId] = [];
      bySupplier[supId].push(need);
    });

    Object.entries(bySupplier).forEach(([supId, items]) => {
      const supplier = supplierMap[supId];
      if (!supplier) return;

      if (supplier.supplier_type === 'weekly') {
        if (!weeklyTicketsMap[supId]) {
          // Find the coming Sunday for default delivery
          const eventDate = event.event_date ? new Date(event.event_date) : new Date();
          const weekStart = startOfWeek(eventDate, { weekStartsOn: 0 });
          weeklyTicketsMap[supId] = {
            supplier,
            items: {},
            perEvent: {},
            deliveryDate: format(weekStart, 'yyyy-MM-dd')
          };
        }
        items.forEach(item => {
          const key = item.ingredient_id;
          if (!weeklyTicketsMap[supId].items[key]) {
            weeklyTicketsMap[supId].items[key] = {
              ingredient_id: item.ingredient_id,
              ingredient_name: item.ingredient_name,
              unit: item.unit,
              qty: 0,
              waste_pct: item.waste_pct || 0,
              purchase_unit: item.purchase_unit,
              price_per_unit: item.price_per_unit
            };
          }
          weeklyTicketsMap[supId].items[key].qty += item.qty;

          if (!weeklyTicketsMap[supId].perEvent[key]) {
            weeklyTicketsMap[supId].perEvent[key] = [];
          }
          weeklyTicketsMap[supId].perEvent[key].push({
            event_name: event.event_name,
            event_id: event.id,
            qty: item.qty
          });
        });
      } else {
        // Daily: one ticket per event per supplier
        const deliveryDate = event.event_date
          ? format(subDays(new Date(event.event_date), 1), 'yyyy-MM-dd')
          : '';
        dailyTickets.push({
          supplier,
          event,
          items: items.map(i => ({
            ingredient_id: i.ingredient_id,
            ingredient_name: i.ingredient_name,
            unit: i.unit,
            qty: i.qty,
            waste_pct: i.waste_pct || 0,
            purchase_unit: i.purchase_unit,
            purchase_qty: i.purchase_qty,
            price_per_unit: i.price_per_unit,
            total_price: i.qty * i.price_per_unit
          })),
          deliveryDate
        });
      }
    });
  });

  // Finalize weekly tickets
  const weeklyTickets = Object.values(weeklyTicketsMap).map(wt => ({
    supplier: wt.supplier,
    items: Object.values(wt.items).map(i => ({
      ...i,
      purchase_qty: roundToPurchaseUnit(i.qty, i.purchase_unit),
      total_price: i.qty * i.price_per_unit
    })),
    perEvent: wt.perEvent,
    deliveryDate: wt.deliveryDate
  }));

  return { dailyTickets, weeklyTickets };
}

export const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  if (num === 0) return '0';
  const fixed = Math.round(num * 100) / 100;
  const str = Number.isInteger(fixed) ? fixed.toString() : fixed.toFixed(2).replace(/\.?0+$/, '');
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

export const formatUnit = (unit) => {
  if (!unit) return '';
  const u = unit.toLowerCase();
  if (u === 'kg' || u === 'kilo') return 'ק״ג';
  if (u === 'g' || u === 'gr' || u === 'gram') return 'גרם';
  if (u === 'l' || u === 'liter' || u === 'litre') return 'ליטר';
  if (u === 'ml') return 'מ״ל';
  if (u === 'unit' || u === 'units' || u === 'pcs') return 'יחידות';
  return unit;
};