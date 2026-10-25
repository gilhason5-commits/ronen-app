import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { applyWasteToQty } from '@/lib/foodWaste';
import { firstCourseCut } from '@/lib/firstCourseCut';
import { specialIngredientBatchSize } from '@/lib/specialIngredientYield';
import { rowQtyInSystemUnits } from '@/lib/recipeQty';
import { calculateAdultPortions } from '@/lib/dinerCount';
import { getFixedEventDishes, getFixedItemEventQty } from '@/lib/fixedEventItems';
import { explicitDishQty } from "@/lib/plannedDishQty";

export const roundToPurchaseUnit = (qty, purchaseUnit) => {
  if (!purchaseUnit || purchaseUnit <= 0) return qty;
  return Math.ceil(qty / purchaseUnit) * purchaseUnit;
};

/**
 * Calculate ingredient needs per event for all approved events in a given week.
 * Returns {
 *   needsPerEvent: { eventId: { ingredientId: { ingredient_name, unit, qty, price_per_unit, total_price, supplier_id, supplier_name } } },
 *   subDishPlan: [{ deliveryDate, half, prepEvent, events, preps: [{ si, name, demand, demandByEvent, batch_size, batches, unit }] }]
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
    const explicitQty = explicitDishQty(dish, event);
    if (explicitQty != null) return explicitQty;
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
    // "5 מנות ראשונות" cut, live like the event-level reduction.
    const cut = firstCourseCut(event, eventDishesMap[event?.id] || [], dishes, categories).factorOf(eventDish);
    return applyWasteToQty(baseQty, event, cut);
  };

  // Adds a purchasable ingredient's need (raw qty, before ingredient waste)
  // to an event's needs map. `source` names the dish (and sub-dish) the qty
  // comes from, for the "where does it come from" breakdown.
  const addIngredientNeed = (eventNeeds, ingredientId, rawQty, fallback = {}, source = null) => {
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
        net_qty: 0,
        waste_pct: wastePct,
        price_per_unit: supInfo?.price_per_unit || ingredient.price_per_system || 0,
        supplier_id: supInfo?.supplier_id || ingredient.current_supplier_id || '',
        supplier_name: supInfo?.supplier_name || ingredient.current_supplier_name || '',
        supplier_type: supInfo?.supplier_type || 'daily',
        purchase_unit: ingredient.purchase_unit || 1,
        sources: {}
      };
    }
    eventNeeds[ingredientId].qty += qty;
    eventNeeds[ingredientId].net_qty += rawQty;
    if (source) {
      const src = (eventNeeds[ingredientId].sources[source.key] ||= { ...source, qty: 0, net_qty: 0 });
      src.qty += qty;
      src.net_qty += rawQty;
    }
  };

  const findSI = (id) => (specialIngredients || []).find(s => s.id === id);

  const result = {};
  // Sub-dish (SI) demand per half-week delivery slot: sub-dishes are prepared
  // once for all of the slot's events (Sun–Tue / Wed–Fri), so demand is
  // aggregated across those events before rounding up to whole batches.
  // slotKey -> { slot, prepEvent, slotEvents, demand: { siId: qty },
  //              byEvent: { siId: { eventId: qty } },
  //              byDish: { siId: { srcKey: { ...dish source, qty } } } }
  const siBySlot = {};

  [...events]
    .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
    .forEach(event => {
      const evDishes = eventDishesMap[event.id] || [];
      const eventNeeds = {};
      result[event.id] = eventNeeds;

      const slot = getWeeklyDeliverySlot(event.event_date);
      if (!siBySlot[slot.deliveryDate]) {
        siBySlot[slot.deliveryDate] = { slot, prepEvent: event, slotEvents: [], demand: {}, byEvent: {}, byDish: {} };
      }
      siBySlot[slot.deliveryDate].slotEvents.push(event);
      const slotDemand = siBySlot[slot.deliveryDate].demand;
      const slotByEvent = siBySlot[slot.deliveryDate].byEvent;
      const slotByDish = siBySlot[slot.deliveryDate].byDish;

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
        ...fixedDishes.map(dish => ({ dish, effectiveQty: getFixedItemEventQty(dish, event) })),
      ];

      dishLines.forEach(({ dish, effectiveQty }) => {
        if (!effectiveQty || effectiveQty <= 0) return;
        const source = { key: `${event.id}|${dish.id}`, event_id: event.id, event_name: event.event_name, dish_name: dish.name };
        (dish.ingredients || []).forEach(ing => {
          // Bought in the ingredient card's unit (a ק״ג row of a יחידה ingredient converts).
          const qtyNeeded = rowQtyInSystemUnits(ing, ingredients.find(i => i.id === ing.ingredient_id)) * effectiveQty;
          if (findSI(ing.ingredient_id)) {
            if (qtyNeeded > 0) {
              slotDemand[ing.ingredient_id] = (slotDemand[ing.ingredient_id] || 0) + qtyNeeded;
              const perEvent = (slotByEvent[ing.ingredient_id] ||= {});
              perEvent[event.id] = (perEvent[event.id] || 0) + qtyNeeded;
              const perDish = (slotByDish[ing.ingredient_id] ||= {});
              (perDish[source.key] ||= { ...source, qty: 0 }).qty += qtyNeeded;
            }
            return;
          }
          addIngredientNeed(eventNeeds, ing.ingredient_id, qtyNeeded, { name: ing.ingredient_name, unit: ing.unit }, source);
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
  Object.values(siBySlot).forEach(({ slot, prepEvent, slotEvents, demand, byEvent, byDish }) => {
    const prepNeeds = result[prepEvent.id];
    const preps = [];
    const pending = { ...demand };
    const pendingByEvent = Object.fromEntries(Object.entries(byEvent).map(([id, m]) => [id, { ...m }]));
    const pendingByDish = Object.fromEntries(Object.entries(byDish).map(([id, m]) =>
      [id, Object.fromEntries(Object.entries(m).map(([k, src]) => [k, { ...src }]))]));
    const done = new Set();
    for (;;) {
      const ready = Object.keys(pending).filter(id => !done.has(id));
      if (ready.length === 0) break;
      const siId = ready.reduce((a, b) => (siRank(a) <= siRank(b) ? a : b));
      done.add(siId);
      const si = findSI(siId);
      const totalDemand = pending[siId];
      // Batch yield = what SpecialIngredientDialog displays as "כמות כוללת".
      // The DB does not persist a total_quantity column, so always derive it.
      const comps = si.components || [];
      const batchSize = specialIngredientBatchSize(si, (id) => findSI(id) || ingredients.find(i => i.id === id));
      const batches = Math.ceil(totalDemand / batchSize);
      const demandByEvent = pendingByEvent[siId] || {};
      const demandByDish = Object.values(pendingByDish[siId] || {});
      preps.push({ si_id: siId, si, name: si.name, demand: totalDemand, demandByEvent, batch_size: batchSize, batches, unit: si.system_unit || '' });
      comps.forEach(comp => {
        const compQty = rowQtyInSystemUnits(comp, ingredients.find(i => i.id === comp.ingredient_id)) * batches;
        if (findSI(comp.ingredient_id)) {
          if (compQty > 0 && !done.has(comp.ingredient_id)) {
            pending[comp.ingredient_id] = (pending[comp.ingredient_id] || 0) + compQty;
            // A nested sub-dish is split between events in the same shares as its parent.
            const childByEvent = (pendingByEvent[comp.ingredient_id] ||= {});
            Object.entries(demandByEvent).forEach(([evId, q]) => {
              childByEvent[evId] = (childByEvent[evId] || 0) + compQty * (q / totalDemand);
            });
            const childByDish = (pendingByDish[comp.ingredient_id] ||= {});
            demandByDish.forEach(src => {
              (childByDish[src.key] ||= { ...src, qty: 0 }).qty += compQty * (src.qty / totalDemand);
            });
          }
          return;
        }
        const fallback = { name: comp.ingredient_name, unit: comp.unit };
        if (demandByDish.length === 0) {
          addIngredientNeed(prepNeeds, comp.ingredient_id, compQty, fallback);
          return;
        }
        // Split the batch qty between the dishes in their demand shares
        // (the batch rounding surplus is spread the same way).
        demandByDish.forEach(src => {
          addIngredientNeed(prepNeeds, comp.ingredient_id, compQty * (src.qty / totalDemand), fallback, {
            key: `${src.key}|${siId}`, event_id: src.event_id, event_name: src.event_name, dish_name: src.dish_name, via: si.name
          });
        });
      });
    }
    if (preps.length > 0) subDishPlan.push({ ...slot, prepEvent, events: slotEvents, preps });
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
              net_qty: 0,
              waste_pct: item.waste_pct || 0,
              purchase_unit: item.purchase_unit,
              price_per_unit: item.price_per_unit,
              sources: {}
            };
          }
          ticket.items[key].qty += item.qty;
          ticket.items[key].net_qty += item.net_qty ?? item.qty;
          Object.values(item.sources || {}).forEach(src => {
            const merged = (ticket.items[key].sources[src.key] ||= { ...src, qty: 0, net_qty: 0 });
            merged.qty += src.qty;
            merged.net_qty += src.net_qty;
          });

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
            net_qty: i.net_qty,
            waste_pct: i.waste_pct || 0,
            purchase_unit: i.purchase_unit,
            purchase_qty: i.purchase_qty,
            price_per_unit: i.price_per_unit,
            total_price: i.qty * i.price_per_unit,
            sources: Object.values(i.sources || {})
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
      sources: Object.values(i.sources),
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