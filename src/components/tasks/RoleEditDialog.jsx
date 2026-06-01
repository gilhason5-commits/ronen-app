import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// Paused employees are tracked in AppSetting rows keyed `paused_employee:<id>`.
// Using the existing key/value table avoids a schema migration; the scheduler
// loads the set of paused IDs at the start of every run and skips their
// reminders and escalations.
const PAUSE_KEY_PREFIX = "paused_employee:";

export default function RoleEditDialog({ open, onClose, roleId, roleName, currentEmployeeId, departmentName }) {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentEmployeeId || "");
  const [isPaused, setIsPaused] = useState(false);

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
  }, [open, currentEmployeeId, pausedKeys]);

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
        const tasks = await base44.entities.TaskAssignment.filter({ assigned_to_id: currentEmployeeId });
        const recurringPending = tasks.filter(
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            ביטול
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
