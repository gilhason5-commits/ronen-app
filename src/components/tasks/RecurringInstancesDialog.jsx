import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { Clock, Calendar, AlertTriangle, Bell } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { he } from "date-fns/locale";

const statusConfig = {
  PENDING: { color: "bg-blue-50 border-blue-300", badge: "bg-blue-100 text-blue-700", label: "ממתין" },
  DONE: { color: "bg-green-50 border-green-300", badge: "bg-green-100 text-green-700", label: "בוצע" },
  NOT_DONE: { color: "bg-red-50 border-red-300", badge: "bg-red-100 text-red-700", label: "לא בוצע" },
  OVERDUE: { color: "bg-orange-50 border-orange-300", badge: "bg-orange-100 text-orange-700", label: "באיחור" },
  NOT_ARRIVING: { color: "bg-yellow-50 border-yellow-300", badge: "bg-yellow-100 text-yellow-700", label: "לא מגיע" },
};

function getRelevantInstances(instances) {
  if (!instances || instances.length === 0) return [];

  const rep = instances[0];
  const recType = rep.recurrence_type;
  const now = new Date();

  if (recType === 'daily') {
    // Current week (Sun-Thu)
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    return instances.filter(i => {
      const d = new Date(i.start_time);
      return d >= weekStart && d <= weekEnd;
    }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }

  if (recType === 'weekly') {
    // Current month
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    return instances.filter(i => {
      const d = new Date(i.start_time);
      return d >= monthStart && d <= monthEnd;
    }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }

  if (recType === 'monthly') {
    // Current half year (6 months from start of current year half)
    const currentMonth = now.getMonth();
    const halfStart = currentMonth < 6
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), 6, 1);
    const halfEnd = currentMonth < 6
      ? new Date(now.getFullYear(), 5, 31, 23, 59, 59)
      : new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return instances.filter(i => {
      const d = new Date(i.start_time);
      return d >= halfStart && d <= halfEnd;
    }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }

  // once - show all
  return instances.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function getPeriodLabel(instances) {
  if (!instances || instances.length === 0) return "";
  const rep = instances[0];
  const recType = rep.recurrence_type;
  const now = new Date();

  if (recType === 'daily') {
    const ws = startOfWeek(now, { weekStartsOn: 0 });
    const we = endOfWeek(now, { weekStartsOn: 0 });
    return `שבוע נוכחי: ${format(ws, "d/M", { locale: he })} - ${format(we, "d/M", { locale: he })}`;
  }
  if (recType === 'weekly') {
    return `חודש נוכחי: ${format(now, "MMMM yyyy", { locale: he })}`;
  }
  if (recType === 'monthly') {
    const currentMonth = now.getMonth();
    const halfStart = currentMonth < 6
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), 6, 1);
    const halfEnd = currentMonth < 6
      ? new Date(now.getFullYear(), 5, 31)
      : new Date(now.getFullYear(), 11, 31);
    return `חצי שנה: ${format(halfStart, "MMM", { locale: he })} - ${format(halfEnd, "MMM yyyy", { locale: he })}`;
  }
  return "";
}

export default function RecurringInstancesDialog({ open, onClose, taskTitle, allInstances, onStatusChange }) {
  const relevant = getRelevantInstances(allInstances);
  const periodLabel = getPeriodLabel(allInstances);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{taskTitle}</DialogTitle>
          {periodLabel && <p className="text-sm text-stone-500">{periodLabel}</p>}
        </DialogHeader>

        <div className="space-y-3 py-2">
          {relevant.length === 0 ? (
            <p className="text-center text-stone-500 py-8">אין מופעים בתקופה זו</p>
          ) : (
            relevant.map(instance => {
              const cfg = statusConfig[instance.status] || statusConfig.PENDING;
              const startDate = new Date(instance.start_time);
              return (
                <div key={instance.id} className={`border-2 rounded-lg p-3 ${cfg.color} transition-all`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-stone-500" />
                      <span className="font-medium text-sm">
                        {format(startDate, "EEEE, d/M/yyyy", { locale: he })}
                      </span>
                    </div>
                    <Badge className={`${cfg.badge} text-xs`}>{cfg.label}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-stone-600 mb-2">
                    <Clock className="w-3 h-3" />
                    <span>
                      {format(startDate, "HH:mm")}
                      {instance.end_time && ` - ${format(new Date(instance.end_time), "HH:mm")}`}
                    </span>
                  </div>

                  {instance.completed_at && (
                    <p className="text-xs text-stone-500 mb-2">
                      הושלם: {format(new Date(instance.completed_at), "dd/MM HH:mm")}
                    </p>
                  )}

                  {instance.last_notification_start_sent_at && (
                    <p className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      תזכורת התחלה נשלחה: {format(new Date(instance.last_notification_start_sent_at), "dd/MM HH:mm")}
                    </p>
                  )}

                  {instance.last_notification_end_sent_at && (
                    <p className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      תזכורת סיום נשלחה: {format(new Date(instance.last_notification_end_sent_at), "dd/MM HH:mm")}
                    </p>
                  )}

                  {instance.escalation_sent_at && (
                    <p className="text-xs text-amber-600 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      אסקלציה נשלחה: {format(new Date(instance.escalation_sent_at), "dd/MM HH:mm")}
                      {instance.escalation_employee_name && ` (${instance.escalation_employee_name})`}
                    </p>
                  )}


                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}