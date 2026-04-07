import React, { useState } from "react";
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
    if (event.status === "producer_draft") return false;
    const matchesSearch = event.event_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || event.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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

          <EventsList 
            events={filteredEvents}
            isLoading={isLoading}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
          />
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