import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import ProducerEventForm from "../components/producer/ProducerEventForm";
import ProducerEventCard from "../components/producer/ProducerEventCard";
import ProducerEventPrint from "../components/producer/ProducerEventPrint";

export default function ProducerPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [printEvent, setPrintEvent] = useState(null);
  const [pdfEvent, setPdfEvent] = useState(null);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["producer_events"],
    queryFn: () => base44.entities.Event.filter({ status: "producer_draft" }, "-event_date"),
    initialData: []
  });

  const { data: allEventDishes = [] } = useQuery({
    queryKey: ["all_event_dishes"],
    queryFn: () => base44.entities.Events_Dish.list(),
    initialData: []
  });

  const approveMutation = useMutation({
    mutationFn: async (event) => {
      return await base44.entities.Event.update(event.id, {
        producer_approved: true,
        status: "in_progress"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producer_events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("האירוע אושר והועבר להנהלה בהצלחה!");
    },
    onError: () => {
      toast.error("שגיאה באישור האירוע");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (event) => {
      // Delete associated dishes first
      const dishes = await base44.entities.Events_Dish.filter({ event_id: event.id });
      for (const d of dishes) {
        await base44.entities.Events_Dish.delete(d.id);
      }
      // Delete associated stages
      const stages = await base44.entities.Event_Stage.filter({ event_id: event.id });
      for (const s of stages) {
        await base44.entities.Event_Stage.delete(s.id);
      }
      return await base44.entities.Event.delete(event.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producer_events"] });
      queryClient.invalidateQueries({ queryKey: ["all_event_dishes"] });
      toast.success("האירוע נמחק בהצלחה");
    },
    onError: () => {
      toast.error("שגיאה במחיקת האירוע");
    }
  });

  const handleDelete = (event) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${event.event_name}"?`)) {
      deleteMutation.mutate(event);
    }
  };

  const handleApprove = (event) => {
    if (confirm(`האם אתה בטוח שברצונך לאשר את האירוע "${event.event_name}" ולהעביר אותו להנהלה?`)) {
      approveMutation.mutate(event);
    }
  };

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedEvent(null);
    queryClient.invalidateQueries({ queryKey: ["producer_events"] });
    queryClient.invalidateQueries({ queryKey: ["all_event_dishes"] });
  };

  if (showForm) {
    return (
      <div className="p-6 lg:p-8">
        <ProducerEventForm event={selectedEvent} onClose={handleCloseForm} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">עמוד מפיק</h1>
          <p className="text-stone-500 mt-1">צור אירועים חדשים, בחר מנות ואשר להעברה להנהלה</p>
        </div>
        <Button
          onClick={() => { setSelectedEvent(null); setShowForm(true); }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          אירוע חדש
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-stone-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <p className="text-lg">אין אירועים כרגע</p>
          <p className="text-sm mt-1">צור אירוע חדש כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => (
            <ProducerEventCard
              key={event.id}
              event={event}
              dishCount={allEventDishes.filter(ed => ed.event_id === event.id).length}
              onEdit={handleEdit}
              onApprove={handleApprove}
              onPrint={setPrintEvent}
              onDelete={handleDelete}
              onSavePdf={setPdfEvent}
            />
          ))}
        </div>
      )}
      <ProducerEventPrint
        event={printEvent}
        open={!!printEvent}
        onClose={() => setPrintEvent(null)}
      />
      <ProducerEventPrint
        event={pdfEvent}
        open={!!pdfEvent}
        onClose={() => setPdfEvent(null)}
        savePdfMode={true}
      />
    </div>
  );
}