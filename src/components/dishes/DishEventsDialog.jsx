import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Which events include a dish ("מופיע באירועים"): upcoming events first
// (nearest on top), then past ones. Only queries while open.
export default function DishEventsDialog({ dish, open, onOpenChange }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dishEvents", dish?.id],
    enabled: open && !!dish?.id,
    queryFn: async () => {
      const eventDishes = await base44.entities.Events_Dish.filter({ dish_id: dish.id });
      const eventIds = [...new Set(eventDishes.map((ed) => ed.event_id))];
      if (eventIds.length === 0) return [];
      const events = await base44.entities.Event.filter({ id: eventIds });
      return events.map((event) => ({
        event,
        qty: eventDishes
          .filter((ed) => ed.event_id === event.id)
          .reduce((sum, ed) => sum + (Number(ed.planned_qty) || 0), 0),
      }));
    },
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const upcoming = rows
    .filter((r) => !r.event.event_date || r.event.event_date >= today)
    .sort((a, b) => (a.event.event_date || "9999").localeCompare(b.event.event_date || "9999"));
  const past = rows
    .filter((r) => r.event.event_date && r.event.event_date < today)
    .sort((a, b) => b.event.event_date.localeCompare(a.event.event_date));

  const renderRow = ({ event, qty }) => (
    <li key={event.id} className="flex items-center justify-between gap-3 py-2 border-b border-stone-100 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-stone-900 truncate">{event.event_name || "—"}</p>
        <p className="text-xs text-stone-500">
          {event.event_date ? format(new Date(event.event_date), "dd/MM/yyyy") : "ללא תאריך"}
          {qty > 0 ? ` · ${Math.round(qty * 10) / 10} מנות` : ""}
        </p>
      </div>
      {event.producer_approved ? (
        <Badge className="bg-emerald-100 text-emerald-700 shrink-0">מאושר</Badge>
      ) : (
        <Badge className="bg-amber-100 text-amber-800 shrink-0">ממתין לאישור</Badge>
      )}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">מופיע באירועים — {dish?.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-center text-stone-400 py-8">טוען...</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-stone-400 py-8">המנה לא מופיעה באף אירוע</p>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-stone-700 mb-1">אירועים קרובים ({upcoming.length})</h4>
                <ul>{upcoming.map(renderRow)}</ul>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-stone-500 mb-1">אירועים שעברו ({past.length})</h4>
                <ul className="opacity-75">{past.map(renderRow)}</ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
