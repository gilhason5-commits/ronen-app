import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
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

// Dedicated read-only view (for the "מנהל אירוע" role): pick one event from
// the dropdown, see its dish tree with planned quantity per dish — no
// editing, no other event data.
export default function DishQuantities() {
  const [selectedEventId, setSelectedEventId] = useState("");

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

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.event_date || 0) - new Date(a.event_date || 0)),
    [events]
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Group the selected event's dishes by category/sub-category, ordered by
  // display_order, each with its planned quantity (כמות צלחות).
  const catGroups = useMemo(() => {
    if (!selectedEventId) return [];
    const out = {};
    for (const ed of eventDishes) {
      if (ed.event_id !== selectedEventId) continue;
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

      if (!out[catId]) out[catId] = { name: catName, order: catOrder, subs: {} };
      if (!out[catId].subs[subId]) out[catId].subs[subId] = { name: subName, order: subOrder, items: [] };
      out[catId].subs[subId].items.push({
        name: dish.name,
        qty: ed.planned_qty ?? 0,
        unit: ed.unit || dish.base_unit || "",
      });
    }
    return Object.values(out)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "he"))
      .map((cat) => ({
        ...cat,
        subs: Object.values(cat.subs)
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "he"))
          .map((sub) => ({
            ...sub,
            items: [...sub.items].sort((a, b) => a.name.localeCompare(b.name, "he")),
          })),
      }));
  }, [selectedEventId, eventDishes, dishById, catById, subById]);

  return (
    <div className="p-6 lg:p-8 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">כמויות מנות לאירוע</h1>
        <p className="text-stone-500 mt-1">בחרי אירוע כדי לראות את כל המנות וכמות הצלחות לכל אחת</p>
      </div>

      <div className="max-w-md">
        <Select value={selectedEventId} onValueChange={setSelectedEventId} disabled={isLoading}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "טוען אירועים..." : "בחר אירוע..."} />
          </SelectTrigger>
          <SelectContent>
            {sortedEvents.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.event_name || "—"}
                {e.event_date ? ` — ${format(new Date(e.event_date), "dd/MM/yyyy")}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedEventId ? (
        <div className="text-center py-16 text-stone-400">בחרי אירוע מהתפריט למעלה</div>
      ) : catGroups.length === 0 ? (
        <div className="text-center py-16 text-stone-400">אין מנות באירוע זה</div>
      ) : (
        <Card className="overflow-hidden max-w-2xl">
          <CardHeader className="bg-stone-50 border-b border-stone-200">
            <CardTitle className="text-lg text-stone-900">{selectedEvent?.event_name || "—"}</CardTitle>
            {selectedEvent?.event_date && (
              <p className="text-sm text-stone-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(selectedEvent.event_date), "dd/MM/yyyy")}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            {catGroups.map((cat, ci) => (
              <div key={ci}>
                <h4 className="font-bold text-stone-800 border-b border-stone-200 pb-1 mb-2">{cat.name}</h4>
                <div className="space-y-3">
                  {cat.subs.map((sub, si) => (
                    <div key={si}>
                      {sub.name && <p className="text-xs font-medium text-stone-600 mb-1">{sub.name}</p>}
                      <ul className="space-y-1 mr-2">
                        {sub.items.map((item, ii) => (
                          <li
                            key={ii}
                            className="flex items-center justify-between text-sm text-stone-700 border-b border-dashed border-stone-100 pb-1"
                          >
                            <span>{item.name}</span>
                            <span className="font-semibold text-stone-900">
                              {item.qty} {item.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
