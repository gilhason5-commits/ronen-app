import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Pencil, Send, CheckCircle2, Printer, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import {
  businessDaysUntilEvent,
  APPROVAL_MIN_BUSINESS_DAYS,
  APPROVAL_MAX_BUSINESS_DAYS,
} from "@/lib/eventTaskGeneration";

const eventTypeLabels = {
  serving: "אירוע הגשה",
  wedding: "אירוע הפוכה",
  party: "מסיבה"
};

export default function ProducerEventCard({ event, dishCount, onEdit, onApprove, onPrint, onDelete, onSavePdf, canApprove = true, canDelete = true }) {
  const isApproved = event.producer_approved;
  const days = businessDaysUntilEvent(event.event_date);
  // Approval window: only allowed between 4 and 7 business days before the
  // event. Too close and staffing/kitchen quantities must already be
  // locked in; too early and plans aren't final enough yet.
  const tooLate = days < APPROVAL_MIN_BUSINESS_DAYS;
  const tooEarly = days > APPROVAL_MAX_BUSINESS_DAYS;

  return (
    <Card className={`border-stone-200 ${isApproved ? "bg-emerald-50 border-emerald-200" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-900">{event.event_name}</h3>
              {isApproved && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 ml-1" />
                  אושר והועבר לביצוע
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {event.event_date ? format(new Date(event.event_date), "dd/MM/yyyy") : "-"}
              </span>
              {event.event_time && <span>{event.event_time}</span>}
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {(event.total_guests ?? event.guest_count) || 0} אורחים
              </span>
              <span className="text-xs">מבוגרים להתחייבות: {event.guest_count || 0}</span>
              <Badge variant="outline">{eventTypeLabels[event.event_type] || event.event_type}</Badge>
              <span className="text-xs text-stone-500">{dishCount} מנות נבחרו</span>
              {event.reserves && <span className="text-xs">רזרבות: {event.reserves}</span>}
              {event.children_count ? <span className="text-xs">ילדים: {event.children_count}</span> : null}
              {event.vegan_count && <span className="text-xs">טבעונים: {event.vegan_count}</span>}
              {event.glatt_count && <span className="text-xs">גלאט: {event.glatt_count}{event.kashrut_note ? ` (${event.kashrut_note})` : ''}</span>}
            </div>
            {event.notes && (
              <p className="text-sm text-stone-500 whitespace-pre-line">{event.notes}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onPrint(event)}>
              <Printer className="w-4 h-4 ml-1" />
              הדפסה
            </Button>
            <Button variant="outline" size="sm" onClick={() => onSavePdf(event)}>
              <Download className="w-4 h-4 ml-1" />
              שמור כ-PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
              <Pencil className="w-4 h-4 ml-1" />
              עריכה
            </Button>
            {!isApproved && (
              <>
                {canDelete && (
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(event)}>
                    <Trash2 className="w-4 h-4 ml-1" />
                    מחיקה
                  </Button>
                )}
                <div className="flex flex-col items-end gap-1 max-w-[280px]">
                  {canApprove ? (
                    <Button
                      size="sm"
                      className={(tooLate || tooEarly) ? "bg-stone-300 hover:bg-stone-300 cursor-not-allowed text-stone-600" : "bg-emerald-600 hover:bg-emerald-700"}
                      disabled={tooLate || tooEarly}
                      title={tooLate ? "אנא אשר מול רונן" : tooEarly ? `ניתן לאשר רק החל מ-${APPROVAL_MAX_BUSINESS_DAYS} ימי עסקים לפני האירוע` : ""}
                      onClick={() => !(tooLate || tooEarly) && onApprove(event)}
                    >
                      <Send className="w-4 h-4 ml-1" />
                      אושר - העבר להנהלה
                    </Button>
                  ) : (
                    <Button size="sm" disabled className="bg-stone-300 hover:bg-stone-300 cursor-not-allowed text-stone-600" title="רק המפיק יכול לאשר אירועים">
                      <Send className="w-4 h-4 ml-1" />
                      אושר - העבר להנהלה
                    </Button>
                  )}
                  <p className="text-[11px] text-stone-500 leading-snug text-right">
                    לחיצה על אישור היא התחייבות סופית מבחינת כמות העובדים והמטבח. לאחר האישור הכמויות נחשבות סופיות לאירוע.
                  </p>
                  {!canApprove && (
                    <p className="text-[11px] text-amber-700 leading-snug text-right">
                      רק המפיק יכול לאשר אירועים.
                    </p>
                  )}
                  {canApprove && tooLate && (
                    <p className="text-[11px] text-amber-700 leading-snug text-right">
                      אנא אשר מול רונן.
                    </p>
                  )}
                  {canApprove && !tooLate && tooEarly && (
                    <p className="text-[11px] text-amber-700 leading-snug text-right">
                      ניתן לאשר את האירוע רק בין {APPROVAL_MIN_BUSINESS_DAYS} ל-{APPROVAL_MAX_BUSINESS_DAYS} ימי עסקים לפני תחילתו.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}