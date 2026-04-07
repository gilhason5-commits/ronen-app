import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";

export default function EventStaffingDialog({ eventId, event, employees, existingStaffing, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    event_id: eventId,
    event_name: event?.event_name,
    event_date: event?.event_date,
    employee_id: '',
    employee_name: '',
    staffing_role_override: ''
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.EventStaffing.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventStaffing'] });
      toast.success('עובד נוסף לאירוע');
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleEmployeeChange = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    setFormData({
      ...formData,
      employee_id: employeeId,
      employee_name: employee?.full_name || ''
    });
  };

  const availableEmployees = employees.filter(emp => 
    !existingStaffing.some(staff => staff.employee_id === emp.id)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת עובד לאירוע</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>עובד *</Label>
            <Select
              value={formData.employee_id}
              onValueChange={handleEmployeeChange}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עובד" />
              </SelectTrigger>
              <SelectContent>
                {availableEmployees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.department})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>עקיפת תפקיד (אופציונלי)</Label>
            <Input
              value={formData.staffing_role_override}
              onChange={(e) => setFormData({...formData, staffing_role_override: e.target.value})}
              placeholder="תפקיד ספציפי לאירוע זה"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              הוסף
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}