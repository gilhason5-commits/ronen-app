import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// Recurring tasks whose employee was deleted (assigned_to_id was set to null
// by the FK) keep generating with no owner. Hand their pending rows — today's
// and the pre-generated future ones — to an existing employee; the generator
// then continues the series under the new owner.
export default function AssignOrphanTasksDialog({ open, onClose, orphanName, departmentName, templateIds = [] }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  useEffect(() => { if (open) setEmployeeId(""); }, [open]);

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["taskEmployees"],
    queryFn: () => base44.entities.TaskEmployee.list(),
  });
  // Any active employee can take the tasks; the department's own people are
  // listed first. (Limiting the list to the department left only a handful of
  // names, so the person meant to take over often wasn't there at all.)
  const label = (e) => (e.full_name || "").trim() || e.role_name || "ללא שם";
  const inDept = (e) => !!departmentName && e.department_name === departmentName;
  const candidates = allEmployees
    .filter((e) => e.is_active)
    .sort((a, b) => (inDept(b) - inDept(a)) || label(a).localeCompare(label(b), "he"));

  const assignMutation = useMutation({
    mutationFn: async () => {
      const emp = allEmployees.find((e) => e.id === employeeId);
      if (!emp) throw new Error("בחר עובד");
      let q = supabase
        .from("TaskAssignment")
        .update({
          assigned_to_id: emp.id,
          assigned_to_name: label(emp),
          assigned_to_phone: emp.phone_e164 || "",
          manager_id: emp.manager_id || null,
          manager_name: emp.manager_name || "",
        })
        .is("event_id", null)
        .is("assigned_to_id", null)
        .in("status", ["PENDING", "pending"])
        .in("task_template_id", templateIds);
      q = orphanName ? q.eq("assigned_to_name", orphanName) : q;
      const { data, error } = await q.select("id");
      if (error) throw error;
      return { count: data?.length || 0, name: label(emp) };
    },
    onSuccess: ({ count, name }) => {
      queryClient.invalidateQueries({ queryKey: ["taskAssignments"] });
      toast.success(`${count} מופעים הועברו ל${name}`);
      onClose();
    },
    onError: (err) => toast.error(`העברה נכשלה: ${err?.message || ""}`),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>שיוך משימות של {orphanName || "עובד שנמחק"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>עובד חדש</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue placeholder="בחר עובד" /></SelectTrigger>
            <SelectContent>
              {candidates.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {label(emp)}
                  {emp.role_name && label(emp) !== emp.role_name ? ` — ${emp.role_name}` : ""}
                  {!inDept(emp) && emp.department_name ? ` (${emp.department_name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-stone-500">
            העובד לא ברשימה? הוסף אותו בעמוד העובדים, ואז חזור לכאן.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">ביטול</Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!employeeId || assignMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {assignMutation.isPending ? "מעביר..." : "העבר משימות"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
