import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { applyWasteToQty } from '@/lib/foodWaste';
import { calculateAdultPortions } from '@/lib/dinerCount';
import { getFixedEventDishes, getFixedEventQty } from '@/lib/fixedEventItems';

export const roundToPurchaseUnit = (qty, purchaseUnit) => {
  if (!purchaseUnit || purchaseUnit <= 0) return qty;
  return Math.ceil(qty / purchaseUnit) * purchaseUnit;
};

/**
 * Calculate ingredient needs per event for all approved events in a given week.
 * Returns {
 *   needsPerEvent: { eventId: { ingredientId: { ingredient_name, unit, qty, price_per_unit, total_price, supplier_id, supplier_name } } },
 *   subDishPlan: [{ deliveryDate, half, prepEvent, preps: [{ name, demand, batch_size, batches, unit }] }]
 * }
 */
export function calcIngredientNeedsPerEvent(events, eventDishesMap, dishes, ingredients, specialIngredients, categories, suppliers) {

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
    // Always calculate from source (guest count × serving % × portion factor),
    // then apply the event-level food reduction (פחת) — this drives purchasing.
    const dish = dishes.find(d => d.id === eventDish.dish_id);
    if (!dish) return 0;
    const guestCount = event?.guest_count || 0;
    // Standard dish quantities are planned for guests eating the standard
    // menu — guest_count minus vegans/glatt, who get separate dishes not
    // counted in this tree (e.g. 300 committed, 20 vegan -> plan for 280).
    const dishGuestCount = calculateAdultPortions(event?.guest_count, event?.vegan_count, event?.glatt_count);
    const servingPercentage = dish.serving_percentage ?? 100;
    let baseQty;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = dishGuestCount * (servingPercentage / 100);
      baseQty = Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    } else {
      // First-course rule applies to all event types EXCEPT weddings ("הפוכה")
      const isWedding = event?.event_type === 'wedding';
      const portionFactor = (isFirstCourseDish(dish) && !isWedding) ? 1 / 6 : (dish.portion_factor ?? 1);
      const rawQuantity = dishGuestCount * (servingPercentage / 100) * portionFactor;
      baseQty = Math.ceil(rawQuantity);
    }
    return applyWasteToQty(baseQty, guestCount);
  };

  // Adds a purchasable ingredient's need (raw qty, before ingredient waste)
  // to an event's needs map.
  const addIngredientNeed = (eventNeeds, ingredientId, rawQty, fallback = {}) => {
    const ingredient = ingredients.find(i => i.id === ingredientId);
    if (!ingredient || !(rawQty > 0)) return;
    const wastePct = ingredient.waste_pct || 0;
    const qty = wastePct > 0 ? rawQty / (1 - wastePct / 100) : rawQty;
    const supInfo = supplierByIngredient[ingredientId];
    if (!eventNeeds[ingredientId]) {
      eventNeeds[ingredientId] = {
        ingredient_id: ingredientId,
        ingredient_name: ingredient.name || fallback.name,
        unit: ingredient.system_unit || fallback.unit,
        qty: 0,
        waste_pct: wastePct,
        price_per_unit: supInfo?.price_per_unit || ingredient.price_per_system || 0,
        supplier_id: supInfo?.supplier_id || ingredient.current_supplier_id || '',
        supplier_name: supInfo?.supplier_name || ingredient.current_supplier_name || '',
        supplier_type: supInfo?.supplier_type || 'daily',
        purchase_unit: ingredient.purchase_unit || 1
      };
    }
    eventNeeds[ingredientId].qty += qty;
  };

  const findSI = (id) => (specialIngredients || []).find(s => s.id === id);

  const result = {};
  // Sub-dish (SI) demand per half-week delivery slot: sub-dishes are prepared
  // once for all of the slot's events (Sun–Tue / Wed–Fri), so demand is
  // aggregated across those events before rounding up to whole batches.
  // slotKey -> { slot, prepEvent, demand: { siId: qty } }
  const siBySlot = {};

  [...events]
    .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
    .forEach(event => {
      const evDishes = eventDishesMap[event.id] || [];
      const eventNeeds = {};
      result[event.id] = eventNeeds;

      const slot = getWeeklyDeliverySlot(event.event_date);
      if (!siBySlot[slot.deliveryDate]) {
        siBySlot[slot.deliveryDate] = { slot, prepEvent: event, demand: {} };
      }
      const slotDemand = siBySlot[slot.deliveryDate].demand;

      // Menu dishes (guest-count driven) plus the event type's fixed items,
      // which every event gets once at their fixed quantity.
      const fixedDishes = getFixedEventDishes(event.event_type, dishes, categories);
      const fixedIds = new Set(fixedDishes.map(d => d.id));
      const dishLines = [
        ...evDishes
          .filter(ed => !fixedIds.has(ed.dish_id))
          .map(ed => {
            const dish = dishes.find(d => d.id === ed.dish_id);
            return dish && { dish, effectiveQty: getEffectivePlannedQty(ed, event) };
          })
          .filter(Boolean),
        ...fixedDishes.map(dish => ({ dish, effectiveQty: getFixedEventQty(dish) })),
      ];

      dishLines.forEach(({ dish, effectiveQty }) => {
        if (!effectiveQty || effectiveQty <= 0) return;
        (dish.ingredients || []).forEach(ing => {
          const qtyNeeded = (ing.qty || 0) * effectiveQty;
          if (findSI(ing.ingredient_id)) {
            if (qtyNeeded > 0) slotDemand[ing.ingredient_id] = (slotDemand[ing.ingredient_id] || 0) + qtyNeeded;
            return;
          }
          addIngredientNeed(eventNeeds, ing.ingredient_id, qtyNeeded, { name: ing.ingredient_name, unit: ing.unit });
        });
      });
    });

  // Expand each slot's sub-dishes into whole batches. A sub-dish inside a
  // sub-dish is demanded by its parent's batches, so parents are expanded
  // first (by nesting rank) and each sub-dish is batched once on its total
  // demand. The resulting ingredients are bought for the slot's first event
  // (the sub-dishes are prepared ahead of it, for the whole slot).
  const rankCache = {};
  const siRank = (siId, seen = new Set()) => {
    if (rankCache[siId] !== undefined) return rankCache[siId];
    if (seen.has(siId)) return 0; // guard against a cyclic recipe
    seen.add(siId);
    const parents = (specialIngredients || []).filter(p =>
      (p.components || []).some(c => c.ingredient_id === siId));
    const rank = parents.length ? 1 + Math.max(...parents.map(p => siRank(p.id, seen))) : 0;
    rankCache[siId] = rank;
    return rank;
  };

  const subDishPlan = [];
  Object.values(siBySlot).forEach(({ slot, prepEvent, demand }) => {
    const prepNeeds = result[prepEvent.id];
    const preps = [];
    const pending = { ...demand };
    const done = new Set();
    for (;;) {
      const ready = Object.keys(pending).filter(id => !done.has(id));
      if (ready.length === 0) break;
      const siId = ready.reduce((a, b) => (siRank(a) <= siRank(b) ? a : b));
      done.add(siId);
      const si = findSI(siId);
      const totalDemand = pending[siId];
      // Batch yield = sum of all component quantities (matches what
      // SpecialIngredientDialog displays as "כמות כוללת"). The DB does not
      // currently persist a total_quantity column, so always derive it.
      const comps = si.components || [];
      const batchSize = comps.reduce((sum, c) => sum + (parseFloat(c.qty) || 0), 0) || 1;
      const batches = Math.ceil(totalDemand / batchSize);
      preps.push({ si_id: siId, name: si.name, demand: totalDemand, batch_size: batchSize, batches, unit: si.system_unit || '' });
      comps.forEach(comp => {
        const compQty = (comp.qty || 0) * batches;
        if (findSI(comp.ingredient_id)) {
          if (compQty > 0 && !done.has(comp.ingredient_id)) {
            pending[comp.ingredient_id] = (pending[comp.ingredient_id] || 0) + compQty;
          }
          return;
        }
        addIngredientNeed(prepNeeds, comp.ingredient_id, compQty, { name: comp.ingredient_name, unit: comp.unit });
      });
    }
    if (preps.length > 0) subDishPlan.push({ ...slot, prepEvent, preps });
  });
  subDishPlan.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));

  // Compute total_price and purchase_qty for each
  Object.values(result).forEach(eventNeeds => {
    Object.values(eventNeeds).forEach(n => {
      n.purchase_qty = roundToPurchaseUnit(n.qty, n.purchase_unit);
      n.total_price = n.qty * n.price_per_unit;
    });
  });

  return { needsPerEvent: result, subDishPlan };
}

/**
 * Weekly-supplier deliveries are split into two per week: events on
 * Sun–Tue are delivered on Sunday, events on Wed–Fri on Wednesday.
 * Returns { weekStart, half: 'A' | 'B', deliveryDate } for an event date.
 */
export function getWeeklyDeliverySlot(eventDateStr) {
  const eventDate = eventDateStr ? new Date(eventDateStr) : new Date();
  const weekStart = startOfWeek(eventDate, { weekStartsOn: 0 });
  const half = eventDate.getDay() <= 2 ? 'A' : 'B';
  return {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    half,
    deliveryDate: format(half === 'A' ? weekStart : addDays(weekStart, 3), 'yyyy-MM-dd')
  };
}

/**
 * Group ingredient needs by supplier for a list of events.
 * For daily suppliers: one ticket per event per supplier
 * For weekly suppliers: one ticket per supplier per delivery slot
 * (Sunday for Sun–Tue events, Wednesday for Wed–Fri events)
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
        const slot = getWeeklyDeliverySlot(event.event_date);
        const ticketKey = `${supId}|${slot.deliveryDate}`;
        if (!weeklyTicketsMap[ticketKey]) {
          weeklyTicketsMap[ticketKey] = {
            supplier,
            items: {},
            perEvent: {},
            ...slot
          };
        }
        const ticket = weeklyTicketsMap[ticketKey];
        items.forEach(item => {
          const key = item.ingredient_id;
          if (!ticket.items[key]) {
            ticket.items[key] = {
              ingredient_id: item.ingredient_id,
              ingredient_name: item.ingredient_name,
              unit: item.unit,
              qty: 0,
              waste_pct: item.waste_pct || 0,
              purchase_unit: item.purchase_unit,
              price_per_unit: item.price_per_unit
            };
          }
          ticket.items[key].qty += item.qty;

          if (!ticket.perEvent[key]) {
            ticket.perEvent[key] = [];
          }
          ticket.perEvent[key].push({
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
    deliveryDate: wt.deliveryDate,
    weekStart: wt.weekStart,
    half: wt.half
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