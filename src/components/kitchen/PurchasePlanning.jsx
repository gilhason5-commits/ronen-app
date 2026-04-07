import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ShoppingCart, Truck, CalendarDays, CheckSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { calcIngredientNeedsPerEvent, buildSupplierTickets } from "./purchaseUtils";
import MultiEventDailyTicket from "./MultiEventDailyTicket";
import WeeklyOrderTicket from "./WeeklyOrderTicket";

export default function PurchasePlanning({ events }) {
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [confirmed, setConfirmed] = useState(false);

  const { data: allDishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: []
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: []
  });

  const { data: specialIngredients = [] } = useQuery({
    queryKey: ['specialIngredients'],
    queryFn: () => base44.entities.SpecialIngredient.list(),
    initialData: []
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
    initialData: []
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: []
  });

  const eventIds = events.map(e => e.id);

  const { data: allEventDishes = [] } = useQuery({
    queryKey: ['allEventDishes', eventIds.join(',')],
    queryFn: async () => {
      if (eventIds.length === 0) return [];
      const results = await Promise.all(
        eventIds.map(id => base44.entities.Events_Dish.filter({ event_id: id }))
      );
      return results.flat();
    },
    enabled: eventIds.length > 0,
    initialData: []
  });

  const eventDishesMap = useMemo(() => {
    const map = {};
    allEventDishes.forEach(ed => {
      if (!map[ed.event_id]) map[ed.event_id] = [];
      map[ed.event_id].push(ed);
    });
    return map;
  }, [allEventDishes]);

  const selectedEvents = useMemo(() => 
    events.filter(e => selectedEventIds.includes(e.id))
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '')),
    [events, selectedEventIds]
  );

  const { dailyGrouped, weeklyTickets } = useMemo(() => {
    if (!confirmed || selectedEvents.length === 0 || allDishes.length === 0 || ingredients.length === 0 || suppliers.length === 0) {
      return { dailyGrouped: [], weeklyTickets: [] };
    }

    const needsPerEvent = calcIngredientNeedsPerEvent(
      selectedEvents, eventDishesMap, allDishes, ingredients, specialIngredients, categories, suppliers
    );

    const { dailyTickets, weeklyTickets } = buildSupplierTickets(selectedEvents, needsPerEvent, suppliers);

    // Group daily tickets by supplier (merge events into one ticket per supplier)
    const supplierGroups = {};
    dailyTickets.forEach(ticket => {
      const supId = ticket.supplier.id;
      if (!supplierGroups[supId]) {
        supplierGroups[supId] = {
          supplier: ticket.supplier,
          eventSections: []
        };
      }
      supplierGroups[supId].eventSections.push({
        event: ticket.event,
        items: ticket.items,
        deliveryDate: ticket.deliveryDate
      });
    });

    const dailyGrouped = Object.values(supplierGroups);

    return { dailyGrouped, weeklyTickets };
  }, [confirmed, selectedEvents, eventDishesMap, allDishes, ingredients, specialIngredients, categories, suppliers]);

  const toggleEvent = (eventId) => {
    setSelectedEventIds(prev => 
      prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]
    );
  };

  const toggleAll = () => {
    if (selectedEventIds.length === events.length) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(events.map(e => e.id));
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-stone-500">
        <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-stone-300" />
        <p>אין אירועים מאושרים לתכנון הזמנות</p>
      </div>
    );
  }

  // Step 1: Event selection
  if (!confirmed) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900">בחר אירועים לתכנון רכש</h2>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                <CheckSquare className="w-4 h-4 ml-1" />
                {selectedEventIds.length === events.length ? 'בטל הכל' : 'בחר הכל'}
              </Button>
            </div>
            <div className="space-y-2">
              {events.map(event => (
                <label
                  key={event.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedEventIds.includes(event.id) 
                      ? 'border-emerald-300 bg-emerald-50' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Checkbox
                    checked={selectedEventIds.includes(event.id)}
                    onCheckedChange={() => toggleEvent(event.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">{event.event_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {event.guest_count} סועדים
                      </Badge>
                    </div>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {event.event_date ? format(new Date(event.event_date), 'EEEE, dd/MM/yyyy', { locale: he }) : 'ללא תאריך'}
                      {event.event_time ? ` | ${event.event_time}` : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button
                onClick={() => setConfirmed(true)}
                disabled={selectedEventIds.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <ShoppingCart className="w-4 h-4 ml-2" />
                צור הזמנות רכש ({selectedEventIds.length} אירועים)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Show tickets
  const hasAnyTickets = dailyGrouped.length > 0 || weeklyTickets.length > 0;

  if (!hasAnyTickets) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setConfirmed(false)}>
          ← חזרה לבחירת אירועים
        </Button>
        <div className="text-center py-12 text-stone-500">
          <Truck className="w-10 h-10 mx-auto mb-3 text-stone-300" />
          <p>אין ספקים מקושרים לרכיבים בתפריטי האירועים</p>
          <p className="text-xs mt-1">ודא שלרכיבים יש ספק מוגדר בעמוד ספקים</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setConfirmed(false)}>
          ← חזרה לבחירת אירועים
        </Button>
        <Badge className="bg-emerald-100 text-emerald-700">
          {selectedEvents.length} אירועים נבחרו
        </Badge>
      </div>

      {/* Daily Suppliers */}
      {dailyGrouped.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-bold text-stone-900">הזמנות מספקים יומיים</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {dailyGrouped.map((group) => (
              <MultiEventDailyTicket key={group.supplier.id} group={group} />
            ))}
          </div>
        </div>
      )}

      {/* Weekly Suppliers */}
      {weeklyTickets.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Truck className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-stone-900">הזמנות מספקים שבועיים</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {weeklyTickets.map((ticket, idx) => (
              <WeeklyOrderTicket key={`${ticket.supplier.id}-${idx}`} ticket={ticket} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}