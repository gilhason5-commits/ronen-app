import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Clock, User, Users, Save, Info, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function TaskEditDialog({ open, onClose, template, assignment, eventId, event }) {
  const queryClient = useQueryClient();

  const [overrideRole, setOverrideRole] = useState("");
  const [overrideStartTime, setOverrideStartTime] = useState("");
  const [additionalEmployees, setAdditionalEmployees] = useState([]);

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  // Calculate default start time from event + template offset
  const getDefaultStartTime = () => {
    if (!event?.event_date) return null;
    const eventStart = new Date(`${event.event_date}T${event.event_time || '00:00'}`);
    const offsetMinutes = template?.start_offset_minutes || 0;
    return new Date(eventStart.getTime() + offsetMinutes * 60000);
  };

  // Calculate default employee from template role
  const getDefaultEmployee = () => {
    if (!template?.default_role) return null;
    return allEmployees.find(e => e.role_id === template.default_role && e.is_active);
  };

  useEffect(() => {
    if (assignment) {
      setOverrideRole(assignment.assigned_to_id || "");
      const startTime = assignment.start_time ? new Date(assignment.start_time) : getDefaultStartTime();
      setOverrideStartTime(startTime ? format(startTime, "HH:mm") : "");
      setAdditionalEmployees(assignment.additional_employees || []);
    } else {
      setOverrideRole("");
      const defaultStart = getDefaultStartTime();
      setOverrideStartTime(defaultStart ? format(defaultStart, "HH:mm") : "");
      setAdditionalEmployees([]);
    }
  }, [template, assignment, event]);

  const availableEmployees = allEmployees.filter(e => e.is_active);
  const defaultEmployee = getDefaultEmployee();
  const defaultStartTime = getDefaultStartTime();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaskAssignment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה עודכנה');
      onClose();
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('עדכון המשימה נכשל');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה נשמרה');
      onClose();
    },
    onError: (error) => {
      console.error('Create error:', error);
      toast.error('שמירת המשימה נכשלה');
    },
  });

  const handleSave = () => {
    try {
      const employee = allEmployees.find(e => e.id === overrideRole);
      const durationMinutes = template?.duration_minutes || 60;

      const [hours, minutes] = (overrideStartTime || '00:00').split(':').map(Number);
      const startTime = new Date(`${event.event_date}T00:00:00`);
      startTime.setHours(hours, minutes, 0, 0);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      const escalationRoleId = template?.escalation_role_id;
      const escalationEmployee = escalationRoleId
        ? allEmployees.find(e => e.role_id === escalationRoleId && e.is_active)
        : null;

      const isOverridden = (
        (overrideRole && defaultEmployee && overrideRole !== defaultEmployee.id) ||
        (defaultStartTime && overrideStartTime !== format(defaultStartTime, "HH:mm"))
      );

      if (assignment) {
        const updateData = {
          assigned_to_id: overrideRole || null,
          assigned_to_name: employee?.full_name || '',
          assigned_to_phone: employee?.phone_e164 || '',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: (assignment.assigned_to_id === overrideRole) ? assignment.status : 'PENDING',
          manually_overridden: isOverridden || false,
          escalation_role_id: escalationRoleId || null,
          escalation_role_name: template?.escalation_role_name || '',
          escalation_employee_id: escalationEmployee?.id || null,
          escalation_employee_name: escalationEmployee?.full_name || '',
          escalation_employee_phone: escalationEmployee?.phone_e164 || '',
          manager_id: employee?.manager_id || null,
          manager_name: employee?.manager_name || '',
        };
        if (assignment.assigned_to_id !== overrideRole) {
          updateData.last_notification_start_sent_at = null;
          updateData.last_notification_end_sent_at = null;
          updateData.escalation_sent_at = null;
        }
        updateMutation.mutate({ id: assignment.id, data: updateData });
      } else {
        const createData = {
          task_template_id: template?.id || null,
          task_title: template?.title || '',
          task_description: template?.description || '',
          event_id: eventId,
          event_name: event?.event_name || '',
          assigned_to_id: overrideRole || null,
          assigned_to_name: employee?.full_name || '',
          assigned_to_phone: employee?.phone_e164 || '',
          computed_start_time: (defaultStartTime || startTime).toISOString(),
          computed_end_time: new Date((defaultStartTime || startTime).getTime() + durationMinutes * 60000).toISOString(),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'PENDING',
          reminder_before_start_minutes: template?.reminder_before_start_minutes ?? 10,
          reminder_before_end_minutes: template?.reminder_before_end_minutes || 0,
          escalate_to_manager: template?.escalate_to_manager_if_not_done ?? true,
          additional_employees: additionalEmployees,
          escalation_role_id: escalationRoleId || null,
          escalation_role_name: template?.escalation_role_name || '',
          escalation_employee_id: escalationEmployee?.id || null,
          escalation_employee_name: escalationEmployee?.full_name || '',
          escalation_employee_phone: escalationEmployee?.phone_e164 || '',
          manager_id: employee?.manager_id || null,
          manager_name: employee?.manager_name || '',
          manager_phone: '',
          manually_overridden: isOverridden || false,
        };
        createMutation.mutate(createData);
      }
    } catch (err) {
      console.error('handleSave error:', err);
      toast.error('שגיאה בשמירת המשימה: ' + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת משימה: {template?.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Info about defaults from template */}
          <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-600 space-y-1">
            <div className="flex items-center gap-2 font-medium text-stone-700">
              <Info className="w-4 h-4" />
              הגדרות ברירת מחדל מהתבנית
            </div>
            <p>תפקיד מבצע: {defaultEmployee ? `${defaultEmployee.full_name} (${defaultEmployee.role_name})` : 'לא הוגדר'}
              {template?.default_role && (() => {
                const roleEmps = allEmployees.filter(e => e.role_id === template.default_role && e.is_active);
                return roleEmps.length > 1 ? ` + ${roleEmps.length - 1} נוספים` : '';
              })()}
            </p>
            <p>שעת התחלה: {defaultStartTime ? format(defaultStartTime, "HH:mm") : 'לא מוגדר'} (היסט {template?.start_offset_minutes ?? 0} דק')</p>
            <p>משך: {template?.duration_minutes || 60} דקות</p>
          </div>

          {/* Override Employee */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              עובד מוקצה ראשי
            </Label>
            <Select 
              value={overrideRole} 
              onValueChange={setOverrideRole}
            >
              <SelectTrigger>
                <SelectValue placeholder={defaultEmployee ? defaultEmployee.full_name : "בחר עובד"} />
              </SelectTrigger>
              <SelectContent>
                {availableEmployees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} - {emp.role_name || emp.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Override Start Time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              דריסת שעת התחלה
            </Label>
            <Input
              type="time"
              value={overrideStartTime}
              onChange={(e) => setOverrideStartTime(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {assignment ? 'עדכן' : 'שמור'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}