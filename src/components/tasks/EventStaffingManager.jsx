import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import EventStaffingDialog from "./EventStaffingDialog";
import { toast } from "sonner";

export default function EventStaffingManager({ eventId, event }) {
  const [showDialog, setShowDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: staffing = [] } = useQuery({
    queryKey: ['eventStaffing', eventId],
    queryFn: async () => {
      const data = await base44.entities.EventStaffing.filter({ event_id: eventId });
      return data;
    },
    initialData: [],
    enabled: !!eventId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventStaffing.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventStaffing'] });
      toast.success('עובד הוסר מהאירוע');
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('האם להסיר עובד זה מהאירוע?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>צוות לאירוע</CardTitle>
          <Button onClick={() => setShowDialog(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            הוסף עובד
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {staffing.map((staff) => {
            const employee = employees.find(e => e.id === staff.employee_id);
            return (
            <div key={staff.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{staff.employee_name}</p>
                <div className="flex gap-2 text-sm text-stone-600">
                  {employee?.role_name && <span>תפקיד: {employee.role_name}</span>}
                  {employee?.role_name && employee?.department_name && <span>•</span>}
                  {employee?.department_name && <span>מחלקה: {employee.department_name}</span>}
                </div>
                {staff.staffing_role_override && (
                  <p className="text-xs text-emerald-600">תפקיד באירוע: {staff.staffing_role_override}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(staff.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            );
          })}
        </div>

        {staffing.length === 0 && (
          <div className="text-center py-12">
            <p className="text-stone-500">אין עובדים מוקצים לאירוע זה</p>
          </div>
        )}
      </CardContent>

      <EventStaffingDialog
        eventId={eventId}
        event={event}
        employees={employees}
        existingStaffing={staffing}
        open={showDialog}
        onClose={() => setShowDialog(false)}
      />
    </Card>
  );
}