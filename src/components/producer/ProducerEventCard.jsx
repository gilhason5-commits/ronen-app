import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Pencil, Send, CheckCircle2, Printer, Trash2, Download } from "lucide-react";
import { format } from "date-fns";

const eventTypeLabels = {
  serving: "אירוע הגשה",
  wedding: "אירוע הפוכה",
  party: "מסיבה"
};

export default function ProducerEventCard({ event, dishCount, onEdit, onApprove, onPrint, onDelete, onSavePdf }) {
  const isApproved = event.producer_approved;

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
                  אושר והועבר להנהלה
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
                {event.guest_count || 0} סועדים
              </span>
              <Badge variant="outline">{eventTypeLabels[event.event_type] || event.event_type}</Badge>
              <span className="text-xs text-stone-500">{dishCount} מנות נבחרו</span>
              {event.children_count > 0 && <span className="text-xs">ילדים: {event.children_count}</span>}
              {event.vegan_count > 0 && <span className="text-xs">טבעונים: {event.vegan_count}</span>}
              {event.glatt_count > 0 && <span className="text-xs">גלאט: {event.glatt_count}</span>}
              {event.kashrut_note && <span className="text-xs text-amber-700">הערה גלאט: {event.kashrut_note}</span>}
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
            {!isApproved && (
              <>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(event)}>
                  <Trash2 className="w-4 h-4 ml-1" />
                  מחיקה
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
                  <Pencil className="w-4 h-4 ml-1" />
                  עריכה
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => onApprove(event)}
                >
                  <Send className="w-4 h-4 ml-1" />
                  אושר - העבר להנהלה
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}