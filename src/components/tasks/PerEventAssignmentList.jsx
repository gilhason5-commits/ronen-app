import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertTriangle, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import AddTaskFromTemplateDialog from "./AddTaskFromTemplateDialog";

export default function PerEventAssignmentList({ eventId, event }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ['taskAssignments', eventId],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.filter({ event_id: eventId });
      return data;
    },
    initialData: [],
    enabled: !!eventId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['taskTemplates', 'PER_EVENT'],
    queryFn: async () => {
      const data = await base44.entities.TaskTemplate.list();
      return data.filter(t => t.task_type === 'PER_EVENT' && t.is_active);
    },
    initialData: [],
  });

  const { data: staffing = [] } = useQuery({
    queryKey: ['eventStaffing', eventId],
    queryFn: async () => {
      const data = await base44.entities.EventStaffing.filter({ event_id: eventId });
      return data;
    },
    initialData: [],
    enabled: !!eventId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => 
      base44.entities.TaskAssignment.update(id, { 
        status,
        completed_at: status === 'DONE' ? new Date().toISOString() : null
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('סטטוס עודכן');
    },
  });

  const statusConfig = {
    PENDING: { icon: Clock, color: "bg-blue-100 text-blue-700", label: "ממתין" },
    DONE: { icon: CheckCircle, color: "bg-emerald-100 text-emerald-700", label: "בוצע" },
    NOT_DONE: { icon: XCircle, color: "bg-red-100 text-red-700", label: "לא בוצע" },
    OVERDUE: { icon: AlertTriangle, color: "bg-orange-100 text-orange-700", label: "באיחור" }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>משימות לאירוע</CardTitle>
          <Button 
            onClick={() => setShowAddDialog(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            הוסף משימה מהמאגר
          </Button>
        </div>
        <p className="text-sm text-stone-500 mt-2">
          {templates.length} משימות פעילות | {staffing.length} עובדים מוקצים
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const StatusIcon = statusConfig[assignment.status]?.icon || Clock;
            return (
              <div key={assignment.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-stone-900">{assignment.task_title}</h4>
                    <p className="text-sm text-stone-600">{assignment.assigned_to_name}</p>
                  </div>
                  <Badge className={statusConfig[assignment.status]?.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig[assignment.status]?.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-stone-500">התחלה:</span>
                    <p className="font-medium">
                      {assignment.start_time ? format(new Date(assignment.start_time), 'dd/MM HH:mm') : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-500">סיום:</span>
                    <p className="font-medium">
                      {assignment.end_time ? format(new Date(assignment.end_time), 'dd/MM HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                {assignment.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: assignment.id, status: 'DONE' })}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      בוצע
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: assignment.id, status: 'NOT_DONE' })}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      לא בוצע
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {assignments.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 mb-2">אין משימות לאירוע זה</p>
            <p className="text-xs text-stone-400">לחץ על "הוסף משימה מהמאגר" כדי להוסיף משימות</p>
          </div>
        )}
      </CardContent>

      <AddTaskFromTemplateDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        eventId={eventId}
        event={event}
        staffing={staffing}
      />
    </Card>
  );
}