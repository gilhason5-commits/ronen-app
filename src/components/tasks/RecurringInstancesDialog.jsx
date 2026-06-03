import React, { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { Clock, Calendar, AlertTriangle, Bell, Trash2 } from "lucide-react";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isAfter,
} from "date-fns";
import { he } from "date-fns/locale";

function getPeriodForRecType(recType) {
  const now = new Date();
  if (recType === 'daily') {
    return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
  }
  if (recType === 'weekly') {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }
  if (recType === 'monthly') {
    const currentMonth = now.getMonth();
    return currentMonth < 6
      ? { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 5, 31, 23, 59, 59) }
      : { start: new Date(now.getFullYear(), 6, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  }
  return null;
}

const statusConfig = {
  PENDING: { color: "bg-blue-50 border-blue-300", badge: "bg-blue-100 text-blue-700", label: "ממתין" },
  DONE: { color: "bg-green-50 border-green-300", badge: "bg-green-100 text-green-700", label: "בוצע" },
  NOT_DONE: { color: "bg-red-50 border-red-300", badge: "bg-red-100 text-red-700", label: "לא בוצע" },
  OVERDUE: { color: "bg-orange-50 border-orange-300", badge: "bg-orange-100 text-orange-700", label: "באיחור" },
  NOT_ARRIVING: { color: "bg-yellow-50 border-yellow-300", badge: "bg-yellow-100 text-yellow-700", label: "לא מגיע" },
  MISSING: { color: "bg-stone-50 border-stone-200", badge: "bg-stone-100 text-stone-500", label: "אין רשומה" },
};

function effectiveStatus(instance) {
  const now = new Date();
  const end = instance.end_time ? new Date(instance.end_time) : null;
  const status = (instance.status || "").toUpperCase();
  if (status === "DONE") return "DONE";
  if (status === "NOT_DONE") return "NOT_DONE";
  if (status === "OVERDUE") return "OVERDUE";
  if (status === "NOT_ARRIVING") return "NOT_ARRIVING";
  if (status === "PENDING" && end && now > end) return "OVERDUE";
  return "PENDING";
}

function getRelevantInstances(instances, fallback = []) {
  const known = (instances && instances.length > 0) ? instances : fallback;
  if (!known || known.length === 0) return [];

  const rep = known[0];
  const recType = rep.recurrence_type;
  const recDays = Array.isArray(rep.recurrence_days) ? rep.recurrence_days : [];
  const recDayOfMonth = rep.recurrence_day_of_month;
  const recTime = rep.recurrence_time || "09:00";
  const now = new Date();

  let periodStart, periodEnd;
  let isExpectedDay;

  if (recType === 'daily') {
    periodStart = startOfWeek(now, { weekStartsOn: 0 });
    periodEnd = endOfWeek(now, { weekStartsOn: 0 });
    isExpectedDay = (d) => d.getDay() !== 5 && d.getDay() !== 6;
  } else if (recType === 'weekly') {
    periodStart = startOfMonth(now);
    periodEnd = endOfMonth(now);
    isExpectedDay = (d) => recDays.length === 0 ? false : recDays.includes(d.getDay());
  } else if (recType === 'monthly') {
    const currentMonth = now.getMonth();
    periodStart = currentMonth < 6
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), 6, 1);
    periodEnd = currentMonth < 6
      ? new Date(now.getFullYear(), 5, 31, 23, 59, 59)
      : new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    isExpectedDay = (d) => {
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(recDayOfMonth || 1, lastDay);
      return d.getDate() === targetDay;
    };
  } else {
    return instances
      .slice()
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }

  const realInPeriod = instances.filter((i) => {
    const d = new Date(i.start_time);
    return d >= periodStart && d <= periodEnd;
  });
  const realKey = new Set(
    realInPeriod.map((i) => format(new Date(i.start_time), "yyyy-MM-dd"))
  );

  const [hours, minutes] = recTime.split(":").map(Number);
  const placeholders = [];
  let cursor = new Date(periodStart);
  while (!isAfter(cursor, periodEnd)) {
    if (isExpectedDay(cursor)) {
      const dayKey = format(cursor, "yyyy-MM-dd");
      if (!realKey.has(dayKey)) {
        const startISO = new Date(
          cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), hours, minutes
        ).toISOString();
        placeholders.push({
          _placeholder: true,
          id: `placeholder-${dayKey}`,
          start_time: startISO,
          end_time: null,
          status: "MISSING",
        });
      }
    }
    cursor = addDays(cursor, 1);
  }

  return [...realInPeriod, ...placeholders].sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time)
  );
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

export default function RecurringInstancesDialog({ open, onClose, taskTitle, allInstances, templateId, onStatusChange }) {
  const queryClient = useQueryClient();
  const recType = allInstances?.[0]?.recurrence_type;
  const period = getPeriodForRecType(recType);
  const { data: fetchedInstances } = useQuery({
    queryKey: ["recurringInstances", templateId, recType, period?.start?.toISOString()],
    queryFn: async () => {
      if (!templateId || !period) return null;
      const { data, error } = await supabase
        .from("TaskAssignment")
        .select("*")
        .eq("task_template_id", templateId)
        .gte("start_time", period.start.toISOString())
        .lte("start_time", period.end.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!(open && templateId && period),
  });

  const effectiveInstances = fetchedInstances ?? allInstances ?? [];
  const relevant = getRelevantInstances(effectiveInstances, allInstances || []);
  const periodLabel = getPeriodLabel(effectiveInstances.length ? effectiveInstances : (allInstances || []));

  // The owner of this column's series — every real instance in the dialog
  // belongs to the same employee since the columns view groups by role.
  const realInstance = (allInstances || []).find((i) => i.assigned_to_id) || effectiveInstances.find((i) => i?.assigned_to_id);
  const assignedToId = realInstance?.assigned_to_id || null;
  const currentRecTime = realInstance?.recurrence_time || (realInstance?.start_time ? format(new Date(realInstance.start_time), "HH:mm") : "");

  const [editTime, setEditTime] = useState(currentRecTime);
  useEffect(() => { setEditTime(currentRecTime); }, [currentRecTime, open]);

  const updateTimeMutation = useMutation({
    mutationFn: async (newTime) => {
      if (!templateId || !assignedToId) throw new Error("חסר template_id או עובד");
      const [h, m] = newTime.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error("שעה לא תקינה");

      // Future-only: today's row whose start_time has already passed stays
      // untouched. Anything from "now" forward gets its HH:MM shifted, with
      // end_time moved by the same delta so the duration is preserved.
      const nowIso = new Date().toISOString();
      const { data: rows, error } = await supabase
        .from("TaskAssignment")
        .select("id, start_time, end_time")
        .eq("task_template_id", templateId)
        .eq("assigned_to_id", assignedToId)
        .gte("start_time", nowIso);
      if (error) throw error;
      if (!rows?.length) return { updated: 0 };

      await Promise.all(rows.map(async (row) => {
        const oldStart = new Date(row.start_time);
        const newStart = new Date(oldStart);
        newStart.setHours(h, m, 0, 0);
        const durationMs = row.end_time
          ? new Date(row.end_time).getTime() - oldStart.getTime()
          : 60 * 60 * 1000;
        const newEnd = new Date(newStart.getTime() + durationMs);
        await supabase
          .from("TaskAssignment")
          .update({
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            computed_start_time: newStart.toISOString(),
            computed_end_time: newEnd.toISOString(),
            recurrence_time: newTime,
          })
          .eq("id", row.id);
      }));

      return { updated: rows.length };
    },
    onSuccess: ({ updated }) => {
      queryClient.invalidateQueries({ queryKey: ["taskAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["recurringInstances", templateId] });
      toast.success(`עודכנו ${updated} מופעים עתידיים`);
    },
    onError: (err) => toast.error(`עדכון שעה נכשל: ${err?.message || ""}`),
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async () => {
      if (!templateId || !assignedToId) throw new Error("חסר template_id או עובד");
      // Wipe the whole series for this employee: past, present, and future.
      // The generator picks the "latest owner" per template — leaving any
      // historic rows for this employee would have it regenerate the series.
      const { data: rows, error } = await supabase
        .from("TaskAssignment")
        .select("id")
        .eq("task_template_id", templateId)
        .eq("assigned_to_id", assignedToId);
      if (error) throw error;
      if (!rows?.length) return { deleted: 0 };

      const ids = rows.map((r) => r.id);
      const { error: delErr } = await supabase
        .from("TaskAssignment")
        .delete()
        .in("id", ids);
      if (delErr) throw delErr;
      return { deleted: ids.length };
    },
    onSuccess: ({ deleted }) => {
      queryClient.invalidateQueries({ queryKey: ["taskAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["recurringInstances", templateId] });
      toast.success(`נמחקו ${deleted} מופעים`);
      onClose?.();
    },
    onError: (err) => toast.error(`מחיקה נכשלה: ${err?.message || ""}`),
  });

  const handleDelete = () => {
    const ok = window.confirm(`למחוק את המשימה "${taskTitle}" לגמרי, כולל כל המופעים העתידיים?`);
    if (!ok) return;
    deleteSeriesMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{taskTitle}</DialogTitle>
          {periodLabel && <p className="text-sm text-stone-500">{periodLabel}</p>}
        </DialogHeader>

        {assignedToId && (
          <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-stone-700 mb-1 block">שעת המשימה</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => updateTimeMutation.mutate(editTime)}
                disabled={!editTime || editTime === currentRecTime || updateTimeMutation.isPending}
              >
                עדכן שעה לעתיד
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-2"
              onClick={handleDelete}
              disabled={deleteSeriesMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              מחק את המשימה לגמרי
            </Button>
          </div>
        )}

        <div className="space-y-3 py-2">
          {relevant.length === 0 ? (
            <p className="text-center text-stone-500 py-8">אין מופעים בתקופה זו</p>
          ) : (
            relevant.map(instance => {
              const status = instance._placeholder ? "MISSING" : effectiveStatus(instance);
              const cfg = statusConfig[status] || statusConfig.PENDING;
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
                  {!instance._placeholder && (
                    <div className="flex items-center gap-1 text-xs text-stone-600 mb-2">
                      <Clock className="w-3 h-3" />
                      <span>
                        {format(startDate, "HH:mm")}
                        {instance.end_time && ` - ${format(new Date(instance.end_time), "HH:mm")}`}
                      </span>
                    </div>
                  )}

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
