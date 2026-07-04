import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

// Paused employees are tracked in AppSetting rows keyed `paused_employee:<id>`.
// Using the existing key/value table avoids a schema migration; the scheduler
// loads the set of paused IDs at the start of every run and skips their
// reminders and escalations.
const PAUSE_KEY_PREFIX = "paused_employee:";

export default function RoleEditDialog({ open, onClose, roleId, roleName, currentEmployeeId, departmentName, tasks = [] }) {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentEmployeeId || "");
  const [isPaused, setIsPaused] = useState(false);
  const [taskTimes, setTaskTimes] = useState({});

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["taskEmployees"],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const { data: pausedKeys = [] } = useQuery({
    queryKey: ["pausedEmployees"],
    queryFn: async () => {
      const all = await base44.entities.AppSetting.list();
      return all.filter((s) => (s.key || "").startsWith(PAUSE_KEY_PREFIX));
    },
    initialData: [],
  });

  useEffect(() => {
    if (!open) return;
    setSelectedEmployeeId(currentEmployeeId || "");
    setIsPaused(pausedKeys.some((s) => s.key === `${PAUSE_KEY_PREFIX}${currentEmployeeId}`));
    const initialTimes = {};
    for (const t of tasks) {
      initialTimes[t.templateId] = t.recurrenceTime || "";
    }
    setTaskTimes(initialTimes);
  }, [open, currentEmployeeId, pausedKeys, tasks]);

  // Employees in the same department as the column. Falls back to all active
  // employees if the column has no department on the role record so the picker
  // is never empty.
  const candidateEmployees = allEmployees.filter((e) => {
    if (!e.is_active) return false;
    if (departmentName && e.department_name !== departmentName) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const newEmpId = selectedEmployeeId || null;
      const newEmployee = allEmployees.find((e) => e.id === newEmpId) || null;

      // 1. Replace assignee on every recurring TaskAssignment that belonged to
      //    the previous employee, so today's pending rows and any pre-generated
      //    future rows move with the role.
      if (currentEmployeeId && newEmpId && currentEmployeeId !== newEmpId) {
        const updates = {
          assigned_to_id: newEmployee?.id || null,
          assigned_to_name: newEmployee?.full_name || "",
          assigned_to_phone: newEmployee?.phone_e164 || "",
          manager_id: newEmployee?.manager_id || null,
          manager_name: newEmployee?.manager_name || "",
        };
        const recurringTasks = await base44.entities.TaskAssignment.filter({ assigned_to_id: currentEmployeeId });
        const recurringPending = recurringTasks.filter(
          (t) => !t.event_id && (t.status === "PENDING" || t.status === "pending"),
        );
        await Promise.all(
          recurringPending.map((t) => base44.entities.TaskAssignment.update(t.id, updates)),
        );

        // Also move the role on the TaskEmployee records themselves so the
        // employees page reflects the swap: clear it on the previous holder,
        // assign it to the new one. Department fields are derived from the
        // role record, matching the handleSave logic on the employees page.
        const role = roleId ? await base44.entities.EmployeeRole.get(roleId).catch(() => null) : null;
        await base44.entities.TaskEmployee.update(currentEmployeeId, {
          role_id: null,
          role_name: "",
          department_id: null,
          department_name: "",
        });
        if (newEmpId) {
          await base44.entities.TaskEmployee.update(newEmpId, {
            role_id: roleId || null,
            role_name: role?.role_name || "",
            department_id: role?.department_id || null,
            department_name: role?.department_name || "",
          });
        }
      }

      // 2. Toggle pause via the AppSetting row keyed by the (possibly new)
      //    employee's id. Pause acts on the employee, not on the role, so a
      //    replacement automatically un-pauses the role if the new employee
      //    isn't paused independently.
      const targetEmpId = newEmpId || currentEmployeeId;
      if (targetEmpId) {
        const key = `${PAUSE_KEY_PREFIX}${targetEmpId}`;
        const existing = pausedKeys.find((s) => s.key === key);
        if (isPaused && !existing) {
          await base44.entities.AppSetting.create({ key, value: "1" });
        } else if (!isPaused && existing) {
          await base44.entities.AppSetting.delete(existing.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["taskEmployees"] });
      queryClient.invalidateQueries({ queryKey: ["pausedEmployees"] });
      toast.success("התפקיד עודכן");
      onClose();
    },
    onError: (err) => {
      console.error(err);
      toast.error(`עדכון נכשל: ${err?.message || ""}`);
    },
  });

  // Per-task time update (in-place, no need to close dialog). Updates the
  // current and future PENDING rows of THIS template+employee so the change
  // applies to "this period and forward" without disturbing past history.
  const updateTaskTimeMutation = useMutation({
    mutationFn: async ({ templateId, newTime }) => {
      if (!templateId || !currentEmployeeId) throw new Error("חסרים פרטים");
      const [h, m] = newTime.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error("שעה לא תקינה");

      const { data: rows, error } = await supabase
        .from("TaskAssignment")
        .select("id, start_time, end_time")
        .eq("task_template_id", templateId)
        .eq("assigned_to_id", currentEmployeeId)
        .in("status", ["PENDING", "pending"]);
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
      toast.success(`עודכנו ${updated} מופעים`);
    },
    onError: (err) => toast.error(`עדכון שעה נכשל: ${err?.message || ""}`),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (templateId) => {
      if (!templateId || !currentEmployeeId) throw new Error("חסרים פרטים");
      const { data: rows, error } = await supabase
        .from("TaskAssignment")
        .select("id")
        .eq("task_template_id", templateId)
        .eq("assigned_to_id", currentEmployeeId);
      if (error) throw error;
      if (!rows?.length) return { deleted: 0 };
      const ids = rows.map((r) => r.id);
      const { error: delErr } = await supabase.from("TaskAssignment").delete().in("id", ids);
      if (delErr) throw delErr;
      return { deleted: ids.length };
    },
    onSuccess: ({ deleted }) => {
      queryClient.invalidateQueries({ queryKey: ["taskAssignments"] });
      toast.success(`נמחקו ${deleted} מופעים`);
    },
    onError: (err) => toast.error(`מחיקה נכשלה: ${err?.message || ""}`),
  });

  const handleDeleteTask = (templateId, title) => {
    if (!window.confirm(`למחוק את המשימה "${title}" לגמרי, כולל כל המופעים העתידיים?`)) return;
    deleteTaskMutation.mutate(templateId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת תפקיד: {roleName || "—"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>עובד בתקן</Label>
            <Select
              value={selectedEmployeeId || "__none__"}
              onValueChange={(v) => setSelectedEmployeeId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עובד" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא עובד</SelectItem>
                {candidateEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                    {emp.role_name ? ` — ${emp.role_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2">
            <div>
              <Label className="block">השהיית משימות</Label>
              <p className="text-xs text-stone-500 mt-1">
                כשמופעל, כל המשימות של העובד הזה לא ישלחו תזכורות ולא יבוצעו אסקלציות עד שההשהייה תבוטל.
              </p>
            </div>
            <Switch checked={isPaused} onCheckedChange={setIsPaused} />
          </div>

          {tasks.length > 0 && (
            <div className="border border-stone-200 rounded-md">
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200">
                <Label>משימות התפקיד</Label>
                <p className="text-xs text-stone-500 mt-1">
                  שינוי שעה מחיל על כל המופעים הממתינים — כולל היום והעתידיים. מחיקה מסירה את כל הסדרה.
                </p>
              </div>
              <div className="divide-y divide-stone-200">
                {tasks.map((t) => {
                  const value = taskTimes[t.templateId] ?? "";
                  const changed = value && value !== (t.recurrenceTime || "");
                  return (
                    <div key={t.templateId} className="px-3 py-2 space-y-2">
                      <p className="text-sm text-stone-800 font-medium leading-snug">{t.taskTitle}</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          dir="ltr"
                          value={value}
                          onChange={(e) => setTaskTimes((prev) => ({ ...prev, [t.templateId]: e.target.value }))}
                          className="h-9 w-32 text-left"
                        />
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateTaskTimeMutation.mutate({ templateId: t.templateId, newTime: value })}
                          disabled={!changed || updateTaskTimeMutation.isPending}
                        >
                          עדכן שעה
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 mr-auto"
                          onClick={() => handleDeleteTask(t.templateId, t.taskTitle)}
                          disabled={deleteTaskMutation.isPending}
                          title="מחק את המשימה"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            סגור
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            שמור עובד/השהייה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
