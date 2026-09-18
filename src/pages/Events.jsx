import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import EventsList from "../components/events/EventsList";
import EventForm from "../components/events/EventForm";
import RecalculateAllButton from "../components/events/RecalculateAllButton";

export default function Events() {
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date'),
    initialData: [],
  });

  const { data: allDishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: [],
  });

  // Once an in-progress event's date has passed, flip it to completed —
  // nobody should have to remember to close out old events by hand.
  useEffect(() => {
    if (!events.length) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stale = events.filter(
      (e) => e.status === 'in_progress' && e.event_date && new Date(e.event_date) < today
    );
    if (stale.length === 0) return;
    (async () => {
      for (const e of stale) {
        try {
          await base44.entities.Event.update(e.id, { status: 'completed' });
        } catch (err) {
          console.error('Failed to auto-complete past event:', e.id, err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['events'] });
    })();
  }, [events]);

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
    initialData: [],
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId) => {
      // Delete associated event stages and dishes
      const stages = await base44.entities.Event_Stage.filter({ event_id: eventId });
      const dishes = await base44.entities.Events_Dish.filter({ event_id: eventId });
      
      for (const dish of dishes) {
        await base44.entities.Events_Dish.delete(dish.id);
      }
      
      for (const stage of stages) {
        await base44.entities.Event_Stage.delete(stage.id);
      }
      
      return await base44.entities.Event.delete(eventId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('האירוע נמחק');
    },
    onError: () => {
      toast.error('מחיקת האירוע נכשלה');
    }
  });

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.event_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || event.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Split into: the single nearest upcoming event (shown on its own up top),
  // the rest of the future events (soonest first), and everything already
  // past (most recent first) under "ארכיון אירועים".
  const todayStr = new Date().toLocaleDateString("sv-SE");
  const futureEvents = filteredEvents
    .filter(e => e.event_date >= todayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const pastEvents = filteredEvents
    .filter(e => e.event_date < todayStr)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
  const [closestEvent, ...restFutureEvents] = futureEvents;

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setShowForm(true);
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setShowForm(true);
  };

  const handleDeleteEvent = (eventId) => {
    deleteEventMutation.mutate(eventId);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedEvent(null);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {!showForm ? (
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-stone-900">אירועים</h1>
              <p className="text-stone-500 mt-1">ניהול אירועים עם תכנון מנות לפי שלבים</p>
            </div>
            <div className="flex gap-3">
              <RecalculateAllButton 
                events={events} 
                allDishes={allDishes} 
                allCategories={allCategories} 
              />
              <Button 
                onClick={handleCreateEvent}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                אירוע חדש
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="חיפוש אירועים..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {[
                { key: "all", label: "הכל" },
                { key: "in_progress", label: "בתהליך" },
                { key: "completed", label: "הושלם" }
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={filterStatus === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(key)}
                  className={filterStatus === key ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <EventsList events={[]} isLoading onEdit={handleEditEvent} onDelete={handleDeleteEvent} />
          ) : (
            <>
              {closestEvent && (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-stone-900">האירוע הקרוב ביותר</h2>
                  <EventsList
                    events={[closestEvent]}
                    isLoading={false}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                  />
                </div>
              )}

              {restFutureEvents.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-stone-900">אירועים עתידיים</h2>
                  <EventsList
                    events={restFutureEvents}
                    isLoading={false}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                  />
                </div>
              )}

              {pastEvents.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-stone-200">
                  <h2 className="text-xl font-semibold text-stone-900">ארכיון אירועים</h2>
                  <EventsList
                    events={pastEvents}
                    isLoading={false}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                  />
                </div>
              )}

              {futureEvents.length === 0 && pastEvents.length === 0 && (
                <EventsList events={[]} isLoading={false} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />
              )}
            </>
          )}
        </>
      ) : (
        <EventForm 
          event={selectedEvent}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}