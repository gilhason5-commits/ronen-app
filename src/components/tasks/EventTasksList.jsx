import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Bell, AlertTriangle, Edit2, Users, Plus, Minus, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import TaskEditDialog from "./TaskEditDialog";

export default function EventTasksList({ eventId, event, templates, staffing }) {
  const [editingTask, setEditingTask] = useState(null);
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['taskAssignments', eventId],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.filter({ event_id: eventId });
      return data;
    },
    initialData: [],
    enabled: !!eventId,
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskAssignment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה הוסרה מהאירוע');
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה נוספה לאירוע');
    },
  });

  const handleAddToEvent = (template) => {
    const eventStartTime = new Date(`${event.event_date}T${event.event_time || '00:00'}`);
    const startTime = new Date(eventStartTime.getTime() + (template.start_offset_minutes || 0) * 60000);
    const endTime = new Date(startTime.getTime() + (template.duration_minutes || 60) * 60000);
    
    createAssignmentMutation.mutate({
      task_template_id: template.id,
      task_title: template.title,
      task_description: template.description,
      event_id: eventId,
      event_name: event.event_name,
      assigned_to_id: '',
      assigned_to_name: '',
      assigned_to_phone: '',
      computed_start_time: startTime.toISOString(),
      computed_end_time: endTime.toISOString(),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'PENDING',
      reminder_before_start_minutes: template.reminder_before_start_minutes || 10,
      reminder_before_end_minutes: template.reminder_before_end_minutes || 10,
      escalate_to_manager: template.escalate_to_manager_if_not_done || false,
      manager_id: '',
      manager_name: '',
      manager_phone: '',
      manually_overridden: false
    });
  };

  const handleRemoveFromEvent = (assignmentId) => {
    deleteAssignmentMutation.mutate(assignmentId);
  };

  // Get templates that are not yet assigned to this event
  const assignedTemplateIds = assignments.map(a => a.task_template_id);
  const availableTemplates = templates.filter(t => t.is_active);

  return (
    <div className="space-y-6">
      {/* Available Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">כל המשימות לאירוע</CardTitle>
          <p className="text-sm text-stone-500">
            לחץ על משימה לעריכה או מחק משימות לא רלוונטיות
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableTemplates.map(template => {
            const existingAssignment = assignments.find(a => a.task_template_id === template.id);
            const isAssigned = !!existingAssignment;

            return (
              <div
                key={template.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isAssigned ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className={`font-semibold ${isAssigned ? 'text-stone-900' : 'text-stone-500'}`}>{template.title}</h4>
                      {isAssigned ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          <Check className="w-3 h-3 mr-1" />
                          כלול באירוע
                        </Badge>
                      ) : (
                        <Badge className="bg-stone-200 text-stone-600">
                          לא כלול
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className={`text-sm mb-2 ${isAssigned ? 'text-stone-600' : 'text-stone-400'}`}>{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{template.category_name}</Badge>
                      <Badge variant="outline">{template.department}</Badge>
                      {template.duration_minutes && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {template.duration_minutes} דקות
                        </Badge>
                      )}
                      {template.reminder_before_start_minutes > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          התראה {template.reminder_before_start_minutes} דק' לפני
                        </Badge>
                      )}
                      {template.escalate_to_manager_if_not_done && (
                        <Badge variant="outline" className="flex items-center gap-1 text-orange-600">
                          <AlertTriangle className="w-3 h-3" />
                          אסקלציה למנהל
                        </Badge>
                      )}
                    </div>

                    {isAssigned && existingAssignment && (
                      <div className="mt-3 p-2 bg-white rounded border space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span className="text-stone-600">שעת התחלה:</span>
                          <span className="font-medium text-stone-900">
                            {existingAssignment.start_time 
                              ? `${format(new Date(existingAssignment.start_time), 'HH:mm')} - ${format(new Date(existingAssignment.end_time), 'HH:mm')}`
                              : 'לא הוגדרה'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-stone-500" />
                          <span className="text-stone-600">מוקצה ל:</span>
                          <span className="font-medium">{existingAssignment.assigned_to_name || 'לא מוקצה'}</span>
                        </div>
                        {existingAssignment.additional_employees?.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-stone-500">
                            <span>+ {existingAssignment.additional_employees.map(e => e.employee_name).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isAssigned ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingTask({ template, assignment: existingAssignment })}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFromEvent(existingAssignment.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          הסר מאירוע
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAddToEvent(template)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        הוסף לאירוע
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
            })}

            {availableTemplates.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">אין משימות במאגר</p>
                <p className="text-xs text-stone-400">הוסף משימות במאגר המשימות תחילה</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {editingTask && (
        <TaskEditDialog
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          template={editingTask.template}
          assignment={editingTask.assignment}
          eventId={eventId}
          event={event}
          staffing={staffing}
        />
      )}
    </div>
  );
}