import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Search } from "lucide-react";
import { format } from "date-fns";

// PostgREST caps any single response at ~1000 rows regardless of the limit
// asked for, which silently drops the tail of large tables. Paginate via
// .range() until a short page comes back so every row is included.
async function fetchAllRows(tableName, pageSize = 1000) {
  const out = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// Read-only menus view for the "גרפיקה" role: every event in the system,
// with dish names grouped by category and sub-category. No quantities,
// no edit controls.
export default function MenuViewer() {
  const [search, setSearch] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", "all"],
    queryFn: () => base44.entities.Event.list("-event_date", 500),
    initialData: [],
  });

  const { data: eventDishes = [] } = useQuery({
    queryKey: ["eventDishes", "all"],
    queryFn: () => fetchAllRows("Events_Dish"),
    initialData: [],
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ["dishes"],
    queryFn: () => fetchAllRows("Dish"),
    initialData: [],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
    initialData: [],
  });

  const { data: subCategories = [] } = useQuery({
    queryKey: ["subCategories"],
    queryFn: () => base44.entities.SubCategory.list(),
    initialData: [],
  });

  const dishById = useMemo(() => Object.fromEntries(dishes.map((d) => [d.id, d])), [dishes]);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const subById = useMemo(() => Object.fromEntries(subCategories.map((s) => [s.id, s])), [subCategories]);

  // For every event, group its dishes by category and sub-category, ordered
  // by display_order so the menu reads top-down in the canonical sequence.
  const groupedByEvent = useMemo(() => {
    const out = {};
    for (const ed of eventDishes) {
      const dish = dishById[ed.dish_id];
      if (!dish?.name) continue;
      const catId = (dish.categories || [])[0] || "__no_cat__";
      const cat = catById[catId];
      const catName = cat?.name || "ללא קטגוריה";
      const catOrder = cat?.display_order ?? 999;
      const subId = dish.sub_category_id || "__no_sub__";
      const sub = subById[subId];
      const subName = sub?.name || dish.sub_category_name || "";
      const subOrder = sub?.display_order ?? 999;

      if (!out[ed.event_id]) out[ed.event_id] = {};
      if (!out[ed.event_id][catId]) {
        out[ed.event_id][catId] = { name: catName, order: catOrder, subs: {} };
      }
      if (!out[ed.event_id][catId].subs[subId]) {
        out[ed.event_id][catId].subs[subId] = { name: subName, order: subOrder, dishes: [] };
      }
      out[ed.event_id][catId].subs[subId].dishes.push(dish.name);
    }

    // Sort within each event.
    const sorted = {};
    for (const [eventId, cats] of Object.entries(out)) {
      const catEntries = Object.values(cats)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "he"))
        .map((cat) => ({
          ...cat,
          subs: Object.values(cat.subs)
            .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "he"))
            .map((sub) => ({
              ...sub,
              dishes: [...sub.dishes].sort((a, b) => a.localeCompare(b, "he")),
            })),
        }));
      sorted[eventId] = catEntries;
    }
    return sorted;
  }, [eventDishes, dishById, catById, subById]);

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => (e.event_name || "").toLowerCase().includes(q));
  }, [events, search]);

  return (
    <div className="p-6 lg:p-8 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">תפריטי אירועים</h1>
        <p className="text-stone-500 mt-1">תצוגה לגרפיקה — כל האירועים והמנות שלהם לפי קטגוריות</p>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
        <Input
          placeholder="חיפוש אירוע..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-stone-500">טוען...</div>
      ) : visibleEvents.length === 0 ? (
        <div className="text-center py-12 text-stone-500">לא נמצאו אירועים</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleEvents.map((event) => {
            const catGroups = groupedByEvent[event.id] || [];
            const hasDishes = catGroups.some((c) => c.subs.some((s) => s.dishes.length > 0));
            return (
              <Card key={event.id} className="overflow-hidden">
                <CardHeader className="bg-stone-50 border-b border-stone-200 pb-3">
                  <CardTitle className="text-lg text-stone-900 leading-snug">
                    {event.event_name || "—"}
                  </CardTitle>
                  {event.event_date && (
                    <p className="text-sm text-stone-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(event.event_date), "dd/MM/yyyy")}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  {!hasDishes ? (
                    <p className="text-sm text-stone-400 italic">אין מנות באירוע</p>
                  ) : (
                    <div className="space-y-4">
                      {catGroups.map((cat, ci) => (
                        <div key={ci}>
                          <h4 className="font-bold text-stone-800 text-sm border-b border-stone-200 pb-1 mb-2">
                            {cat.name}
                          </h4>
                          <div className="space-y-3">
                            {cat.subs.map((sub, si) => (
                              <div key={si}>
                                {sub.name && (
                                  <p className="text-xs font-medium text-stone-600 mb-1">{sub.name}</p>
                                )}
                                <ul className="space-y-0.5 mr-2">
                                  {sub.dishes.map((name, di) => (
                                    <li key={di} className="text-sm text-stone-700 leading-relaxed">
                                      • {name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
