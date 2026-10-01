import { base44 } from "@/api/base44Client";

// Events_Dish is the largest table the app reads (thousands of rows, ~1.7MB
// with every column). Screens that summarise across events only need these
// columns, and they all share one cached query, so moving between them
// doesn't download it again. Invalidating ['eventsDishes'] refreshes it.
const SUMMARY_COLUMNS = "id,event_id,dish_id,category_id,planned_qty,planned_cost,unit";

export const eventDishSummaryQuery = {
  queryKey: ["eventsDishes", "summary"],
  queryFn: () => base44.entities.Events_Dish.listWhere((q) => q, "created_date", SUMMARY_COLUMNS),
};
