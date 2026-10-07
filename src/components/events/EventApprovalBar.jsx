import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Send, ShieldCheck, Trash2, Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useSingleFlightMutation } from "@/lib/useSingleFlightMutation";
import { approveEvent, isApprovalTooLate, APPROVAL_TOO_LATE_MSG, TASKS_FAILED_MSG } from "@/lib/eventApproval";
import { canOverrideApprovalWindow } from "@/lib/officeUser";
import ProducerEventPrint from "../producer/ProducerEventPrint";

// Top of an event's page: its approval status and every action that used to
// live on the event cards (events list / producer page) — approve (producer,
// while APPROVAL_MIN_BUSINESS_DAYS remain), manual approval (office account,
// after the window closed), delete, and the producer's print / PDF.
export default function EventApprovalBar({ event, onDeleted }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [printMode, setPrintMode] = useState(null); // 'print' | 'pdf'

  const isProducer = user?.role === "producer";
  const canOverride = canOverrideApprovalWindow(user);
  const approved = !!event.producer_approved;
  const tooLate = isApprovalTooLate(event);
  // The producer may delete only events not yet approved; the main users any.
  const canDelete = !isProducer || !approved;

  const invalidate = () => {
    ["events", "producer_events", "producer_approved_events", "taskAssignments", "eventsDishes"]
      .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const approveMutation = useSingleFlightMutation({
    mutationFn: async ({ override }) => {
      // Defensive: the buttons are hidden otherwise, but re-check in case of
      // a stale render.
      if (override) {
        if (!canOverride) throw new Error("אין הרשאה לאישור חריג");
      } else {
        if (!isProducer) throw new Error("רק המפיק יכול לאשר אירועים");
        if (isApprovalTooLate(event)) throw new Error(APPROVAL_TOO_LATE_MSG);
      }
      return approveEvent(event);
    },
    onSuccess: (result) => {
      invalidate();
      if (result?.tasksFailed) toast.error(TASKS_FAILED_MSG);
      else toast.success("האירוע אושר והמשימות נוצרו");
    },
    onError: (err) => toast.error(err?.message || "שגיאה באישור האירוע"),
  });

  const deleteMutation = useSingleFlightMutation({
    mutationFn: async () => {
      if (!canDelete) throw new Error("לא ניתן למחוק אירוע מאושר");
      const [dishes, stages] = await Promise.all([
        base44.entities.Events_Dish.filter({ event_id: event.id }),
        base44.entities.Event_Stage.filter({ event_id: event.id }),
      ]);
      for (const d of dishes) await base44.entities.Events_Dish.delete(d.id);
      for (const s of stages) await base44.entities.Event_Stage.delete(s.id);
      return base44.entities.Event.delete(event.id);
    },
    onSuccess: () => {
      invalidate();
      toast.success("האירוע נמחק");
      onDeleted?.();
    },
    onError: (err) => toast.error(err?.message || "מחיקת האירוע נכשלה"),
  });

  const handleApprove = () => {
    if (approveMutation.isPending) return; // approving twice would create the event's tasks twice
    if (confirm(`האם אתה בטוח שברצונך לאשר את האירוע "${event.event_name}" ולהעביר אותו להנהלה?`)) {
      approveMutation.mutate({ override: false });
    }
  };

  const handleOverride = () => {
    if (approveMutation.isPending) return;
    if (confirm(`אישור חריג: חלון האישור לאירוע "${event.event_name}" כבר נסגר. לאשר בכל זאת ולהעביר להנהלה?`)) {
      approveMutation.mutate({ override: true });
    }
  };

  const handleDelete = () => {
    if (deleteMutation.isPending) return;
    if (confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${event.event_name}"? הפעולה תמחק גם את כל המנות שלו.`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className={`print:hidden rounded-xl border px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${approved ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex flex-col gap-1">
        {approved ? (
          <Badge className="w-fit bg-emerald-100 text-emerald-700 border-emerald-300">
            <CheckCircle2 className="w-3 h-3 ml-1" /> מאושר סופית
          </Badge>
        ) : (
          <Badge className="w-fit bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="w-3 h-3 ml-1" /> ממתין לאישור המפיק
          </Badge>
        )}
        {!approved && (
          <p className="text-xs text-stone-600">
            {tooLate
              ? `${APPROVAL_TOO_LATE_MSG}.`
              : isProducer
                ? "לחיצה על אישור היא התחייבות סופית מבחינת כמות העובדים והמטבח."
                : "רק המפיק יכול לאשר אירועים."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!approved && isProducer && !tooLate && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={approveMutation.isPending} onClick={handleApprove}>
            <Send className="w-4 h-4 ml-1" /> אושר - העבר להנהלה
          </Button>
        )}
        {!approved && tooLate && canOverride && (
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700" disabled={approveMutation.isPending} onClick={handleOverride}>
            <ShieldCheck className="w-4 h-4 ml-1" /> אישור חריג
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setPrintMode("print")}>
          <Printer className="w-4 h-4 ml-1" /> הדפסה
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPrintMode("pdf")}>
          <Download className="w-4 h-4 ml-1" /> שמור כ-PDF
        </Button>
        {canDelete && (
          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" disabled={deleteMutation.isPending} onClick={handleDelete}>
            <Trash2 className="w-4 h-4 ml-1" /> מחיקה
          </Button>
        )}
      </div>

      <ProducerEventPrint
        event={printMode ? event : null}
        open={!!printMode}
        onClose={() => setPrintMode(null)}
        savePdfMode={printMode === "pdf"}
      />
    </div>
  );
}
