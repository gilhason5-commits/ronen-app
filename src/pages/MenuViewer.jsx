import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Search } from "lucide-react";
import { format } from "date-fns";

// Read-only menus view for the "גרפיקה" role: every event in the system,
// with just its dish names. No quantities, no edit controls.
export default function MenuViewer() {
  const [search, setSearch] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", "all"],
    queryFn: () => base44.entities.Event.list("-event_date", 500),
    initialData: [],
  });

  const { data: eventDishes = [] } = useQuery({
    queryKey: ["eventDishes", "all"],
    queryFn: () => base44.entities.Events_Dish.list(),
    initialData: [],
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ["dishes"],
    queryFn: () => base44.entities.Dish.list(),
    initialData: [],
  });

  const dishById = useMemo(() => Object.fromEntries(dishes.map((d) => [d.id, d])), [dishes]);

  const dishesByEvent = useMemo(() => {
    const map = {};
    for (const ed of eventDishes) {
      if (!map[ed.event_id]) map[ed.event_id] = [];
      const d = dishById[ed.dish_id];
      if (d?.name) map[ed.event_id].push(d.name);
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => a.localeCompare(b, "he"));
    }
    return map;
  }, [eventDishes, dishById]);

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => (e.event_name || "").toLowerCase().includes(q));
  }, [events, search]);

  return (
    <div className="p-6 lg:p-8 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">תפריטי אירועים</h1>
        <p className="text-stone-500 mt-1">תצוגה לגרפיקה — כל האירועים והמנות שלהם</p>
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
            const dishNames = dishesByEvent[event.id] || [];
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
                  {dishNames.length === 0 ? (
                    <p className="text-sm text-stone-400 italic">אין מנות באירוע</p>
                  ) : (
                    <ul className="space-y-1">
                      {dishNames.map((name, idx) => (
                        <li key={`${event.id}-${idx}`} className="text-sm text-stone-700 leading-relaxed">
                          • {name}
                        </li>
                      ))}
                    </ul>
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
