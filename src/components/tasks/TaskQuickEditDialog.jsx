import React, { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

// Per-task quick edit: change the time on all future instances of this
// template+employee, or wipe the series entirely. Reached from the small
// "עריכה" button at the bottom of each task card on the recurring task
// columns.
export default function TaskQuickEditDialog({
  open,
  onClose,
  templateId,
  assignedToId,
  taskTitle,
  currentRecTime,
}) {
  const queryClient = useQueryClient();
  const [editTime, setEditTime] = useState(currentRecTime || "");

  useEffect(() => {
    setEditTime(currentRecTime || "");
  }, [currentRecTime, open]);

  const updateTimeMutation = useMutation({
    mutationFn: async (newTime) => {
      if (!templateId || !assignedToId) throw new Error("חסר template_id או עובד");
      const [h, m] = newTime.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error("שעה לא תקינה");

      // Future-only: rows whose start_time has already passed keep their
      // original time. From "now" forward, shift HH:MM and slide end_time by
      // the same delta so the duration stays intact.
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
      // Wipe past, present, and future for this template+employee. The
      // generator picks the "latest owner" per template — leaving historic
      // rows for this employee would have it regenerate the series.
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
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{taskTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-stone-700 mb-1 block">שעת המשימה</label>
            <div className="flex items-end gap-2">
              <Input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="h-9"
              />
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => updateTimeMutation.mutate(editTime)}
                disabled={!editTime || editTime === currentRecTime || updateTimeMutation.isPending}
              >
                עדכן שעה לעתיד
              </Button>
            </div>
            <p className="text-xs text-stone-500 mt-1">חל על כל המופעים העתידיים בלבד</p>
          </div>

          <div className="border-t border-stone-200 pt-3">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
