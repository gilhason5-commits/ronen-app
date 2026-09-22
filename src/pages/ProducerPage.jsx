import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import ProducerEventForm from "../components/producer/ProducerEventForm";
import ProducerEventCard from "../components/producer/ProducerEventCard";
import ProducerEventPrint from "../components/producer/ProducerEventPrint";
import {
  generateEventTasks,
  businessDaysUntilEvent,
  APPROVAL_MIN_BUSINESS_DAYS,
  APPROVAL_MAX_BUSINESS_DAYS,
} from "@/lib/eventTaskGeneration";
import { useAuth } from "@/lib/AuthContext";

export default function ProducerPage() {
  const { user } = useAuth();
  const canApprove = user?.role === "producer";
  // The producer role only approves events the main user creates — it no
  // longer creates or deletes events itself.
  const isProducerRole = user?.role === "producer";
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [printEvent, setPrintEvent] = useState(null);
  const [pdfEvent, setPdfEvent] = useState(null);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["producer_events"],
    queryFn: () => base44.entities.Event.filter({ status: "producer_draft" }),
    initialData: []
  });

  const { data: approvedEvents = [], isLoading: loadingApproved } = useQuery({
    queryKey: ["producer_approved_events"],
    queryFn: () => base44.entities.Event.filter({ producer_approved: true }),
    initialData: []
  });

  // Sort approved events with the furthest future date at the top.
  // Events without a date sink to the bottom.
  const approvedOnly = approvedEvents
    .filter(e => e.status !== "producer_draft")
    .slice()
    .sort((a, b) => {
      const tA = a.event_date ? new Date(a.event_date).getTime() : -Infinity;
      const tB = b.event_date ? new Date(b.event_date).getTime() : -Infinity;
      return tB - tA;
    });

  const { data: allEventDishes = [] } = useQuery({
    queryKey: ["all_event_dishes"],
    queryFn: () => base44.entities.Events_Dish.list(),
    initialData: []
  });

  const approveMutation = useMutation({
    mutationFn: async (event) => {
      // Defensive: only the producer role may approve, and only within the
      // 4-7 business-day window — the button is disabled otherwise, but the
      // mutation re-checks in case of a stale render or a direct call.
      if (!canApprove) {
        throw new Error("רק המפיק יכול לאשר אירועים");
      }
      const days = businessDaysUntilEvent(event.event_date);
      if (days < APPROVAL_MIN_BUSINESS_DAYS) {
        throw new Error("אנא אשר מול רונן");
      }
      if (days > APPROVAL_MAX_BUSINESS_DAYS) {
        throw new Error(`ניתן לאשר רק החל מ-${APPROVAL_MAX_BUSINESS_DAYS} ימי עסקים לפני האירוע`);
      }
      await base44.entities.Event.update(event.id, {
        producer_approved: true,
        status: "in_progress",
      });
      // Fire the event-task generation immediately. Wrapped in try/catch so a
      // failure surfaces a toast but doesn't roll back the approval — the
      // PerEventTasks page still acts as a safety net for missing rows.
      try {
        await generateEventTasks({ ...event, producer_approved: true });
      } catch (taskErr) {
        console.error("Failed to generate event tasks on approval:", taskErr);
        toast.error("האירוע אושר אך יצירת המשימות נכשלה — נסה לפתוח את עמוד משימות אירועים כדי להשלים");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producer_events"] });
      queryClient.invalidateQueries({ queryKey: ["producer_approved_events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["taskAssignments"] });
      toast.success("האירוע אושר והמשימות נוצרו");
    },
    onError: (err) => {
      toast.error(err?.message || "שגיאה באישור האירוע");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (event) => {
      // Defensive: the delete button is hidden for the producer role, but
      // guard the mutation itself in case of a stale render or direct call —
      // producer only approves events, it doesn't create or delete them.
      if (isProducerRole) {
        throw new Error("מפיק אינו יכול למחוק אירועים");
      }
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
    queryClient.invalidateQueries({ queryKey: ["producer_approved_events"] });
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
          <p className="text-stone-500 mt-1">
            {isProducerRole ? "בחר מנות ואשר אירועים להעברה לביצוע" : "צור אירועים חדשים, בחר מנות ואשר להעברה להנהלה"}
          </p>
        </div>
        {!isProducerRole && (
          <Button
            onClick={() => { setSelectedEvent(null); setShowForm(true); }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            אירוע חדש
          </Button>
        )}
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
              canDelete={!isProducerRole}
              onSavePdf={setPdfEvent}
              canApprove={canApprove}
            />
          ))}
        </div>
      )}
      {approvedOnly.length > 0 && (
        <div className="space-y-4 mt-10">
          <h2 className="text-xl font-bold text-stone-700 border-b border-stone-200 pb-2">אירועים מאושרים</h2>
          {approvedOnly.map(event => (
            <ProducerEventCard
              key={event.id}
              event={event}
              dishCount={allEventDishes.filter(ed => ed.event_id === event.id).length}
              onEdit={handleEdit}
              onApprove={handleApprove}
              onPrint={setPrintEvent}
              onDelete={handleDelete}
              canDelete={!isProducerRole}
              onSavePdf={setPdfEvent}
              canApprove={canApprove}
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