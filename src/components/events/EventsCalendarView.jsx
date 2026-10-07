import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import EventCalendar from "../dashboard/EventCalendar";
import EventForm from "./EventForm";

const STATUS_BADGE = {
  producer_draft: ["ממתין לאישור", "bg-amber-100 text-amber-800"],
  in_progress: ["מאושר", "bg-emerald-100 text-emerald-700"],
  completed: ["הושלם", "bg-blue-100 text-blue-700"],
};

// Events as a month/week/day calendar (אירועים and עמוד מפיק). Clicking an
// event opens its page; the open event lives in the URL (?event=<id>, or
// ?new=<date> for a new one) so the browser back button returns to the
// calendar and an event can be linked to directly.
export default function EventsCalendarView({ title, subtitle, producerMode = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const openId = searchParams.get("event");
  const newDate = searchParams.get("new");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-event_date"),
  });

  // Once an in-progress event's date has passed, flip it to completed —
  // nobody should have to remember to close out old events by hand.
  useEffect(() => {
    if (!events.length) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stale = events.filter(
      (e) => e.status === "in_progress" && e.event_date && new Date(e.event_date) < today
    );
    if (stale.length === 0) return;
    (async () => {
      await Promise.all(stale.map((e) =>
        base44.entities.Event.update(e.id, { status: "completed" }).catch((err) => {
          console.error("Failed to auto-complete past event:", e.id, err);
        })
      ));
      queryClient.invalidateQueries({ queryKey: ["events"] });
    })();
  }, [events]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return events
      .filter((e) => e.event_name?.toLowerCase().includes(term))
      .sort((a, b) => (b.event_date || "").localeCompare(a.event_date || ""))
      .slice(0, 12);
  }, [events, searchTerm]);

  const openEvent = (event) => {
    setSearchTerm("");
    setSearchParams({ event: event.id });
  };
  const createEvent = (date) => setSearchParams({ new: date || "" });
  const backToCalendar = () => setSearchParams({});

  if (openId) {
    const event = events.find((e) => e.id === openId);
    if (!event) {
      return (
        <div className="p-6 lg:p-8 text-center text-stone-500 space-y-4">
          <p>{isLoading ? "טוען אירוע..." : "האירוע לא נמצא (ייתכן שנמחק)"}</p>
          {!isLoading && <Button variant="outline" onClick={backToCalendar}>חזרה ללוח האירועים</Button>}
        </div>
      );
    }
    return (
      <div className="p-6 lg:p-8">
        <EventForm key={event.id} event={event} onClose={backToCalendar} producerMode={producerMode} />
      </div>
    );
  }

  if (newDate !== null) {
    return (
      <div className="p-6 lg:p-8">
        <EventForm key={`new-${newDate}`} event={null} initialDate={newDate} onClose={backToCalendar} producerMode={producerMode} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">{title}</h1>
          {subtitle && <p className="text-stone-500 mt-1">{subtitle}</p>}
        </div>
        <Button onClick={() => createEvent("")} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 ml-2" />
          אירוע חדש
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input
          placeholder="חיפוש אירוע לפי שם..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
        {searchTerm.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg max-h-80 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="p-3 text-sm text-stone-400">לא נמצאו אירועים</p>
            ) : (
              searchResults.map((e) => {
                const [label, cls] = STATUS_BADGE[e.status] || [e.status, "bg-stone-100 text-stone-700"];
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openEvent(e)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-stone-50 border-b border-stone-100 last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-stone-900 truncate">{e.event_name}</span>
                      <span className="block text-xs text-stone-500">
                        {e.event_date ? format(new Date(e.event_date), "dd/MM/yyyy") : "ללא תאריך"}
                      </span>
                    </span>
                    <Badge className={`${cls} shrink-0`}>{label}</Badge>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="h-96 bg-stone-100 animate-pulse rounded-xl" />
      ) : (
        <EventCalendar events={events} onEventClick={openEvent} onCreateEvent={createEvent} />
      )}
    </div>
  );
}
