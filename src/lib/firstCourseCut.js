// "5 מנות ראשונות" rule: when an event serves 5 or more first-course dishes,
// every first-course dish gets 10% less. Like the פחת and Friday rules in
// foodWaste.js it is applied LIVE wherever planned quantities are consumed —
// nothing is re-baked into Events_Dish — so it also covers events already in
// the system.
//
// Applies to every event type, weddings included; only for dishes planned by
// serving % (a fixed / per-guests count was set by hand).

export const FIRST_COURSE_CUT_PCT = 0.10;
export const FIRST_COURSE_CUT_MIN_DISHES = 5;

export const isFirstCourseCategoryName = (name) => {
  const n = (name || "").toLowerCase();
  return n.includes("first course") || n.includes("מנה ראשונה") || n.includes("מנות ראשונות");
};

// Accepts an array of {id} records or an id → record map.
const toMap = (list) => (Array.isArray(list) ? Object.fromEntries(list.map((x) => [x.id, x])) : list || {});

// The Events_Dish row is a first course by the category it was added under,
// or (rows without one) by the dish's own categories.
function isFirstCourseRow(ed, dishesById, categoriesById) {
  if (ed.category_id && categoriesById[ed.category_id]) {
    return isFirstCourseCategoryName(categoriesById[ed.category_id].name);
  }
  const dish = dishesById[ed.dish_id];
  return (dish?.categories || []).some((id) => isFirstCourseCategoryName(categoriesById[id]?.name));
}

// Returns factorOf(eventDish) → 0.9 for a first-course dish the rule cuts,
// 1 otherwise. `eventDishes` are the event's own Events_Dish rows.
export function firstCourseCut(event, eventDishes, dishes, categories) {
  const dishesById = toMap(dishes);
  const categoriesById = toMap(categories);
  const rows = (eventDishes || []).filter((ed) => !event?.id || !ed.event_id || ed.event_id === event.id);
  const firstCourseDishIds = new Set(
    rows.filter((ed) => isFirstCourseRow(ed, dishesById, categoriesById)).map((ed) => ed.dish_id)
  );
  const applies = firstCourseDishIds.size >= FIRST_COURSE_CUT_MIN_DISHES;
  const factorOf = (ed) => {
    if (!applies || !firstCourseDishIds.has(ed?.dish_id)) return 1;
    const mode = dishesById[ed.dish_id]?.qty_mode;
    if (mode === "fixed" || mode === "per_guests") return 1; // isExplicitQtyMode
    return 1 - FIRST_COURSE_CUT_PCT;
  };
  return { applies, count: firstCourseDishIds.size, factorOf };
}

export const firstCourseCutLabel = (count) =>
  `הפחתה ${FIRST_COURSE_CUT_PCT * 100}% (${count} מנות ראשונות)`;
