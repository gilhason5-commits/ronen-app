import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Clock, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from "sonner";
export default function EventPlanningGrid({ eventId, event, categories, templates, staffing }) {
  const queryClient = useQueryClient();
  const [stages, setStages] = useState([
    { name: "הכנות", start_offset: -120, duration: 60 },
    { name: "קבלת פנים", start_offset: 0, duration: 30 },
    { name: "אירוע ראשי", start_offset: 30, duration: 120 },
    { name: "סיום ופינוי", start_offset: 150, duration: 60 }
  ]);

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['taskAssignments', eventId],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.filter({ event_id: eventId });
      return data;
    },
    initialData: [],
    enabled: !!eventId,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה נוספה');
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskAssignment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה הוסרה');
    },
  });

  const addStage = () => {
    setStages([...stages, { name: "שלב חדש", start_offset: 0, duration: 60 }]);
  };

  const updateStage = (index, field, value) => {
    const newStages = [...stages];
    newStages[index][field] = value;
    setStages(newStages);
  };

  const removeStage = (index) => {
    const newStages = stages.filter((_, i) => i !== index);
    setStages(newStages);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    // Parse destination cell (format: "cell-stageIndex-categoryId")
    const [, stageIndex, categoryId] = destination.droppableId.split('-');
    const stage = stages[parseInt(stageIndex)];
    const category = categories.find(c => c.id === categoryId);
    
    // Find employee
    const employee = allEmployees.find(e => e.id === draggableId);
    if (!employee) return;

    // Find appropriate template for this category
    const categoryTemplates = templates.filter(t => t.category_id === categoryId && t.is_active);
    if (categoryTemplates.length === 0) {
      toast.error('לא נמצאו תבניות פעילות לקטגוריה זו');
      return;
    }

    // Use first matching template (or could show selector)
    const template = categoryTemplates[0];

    // Calculate times based on event and stage
    const eventStartTime = new Date(`${event.event_date}T${event.event_time || '00:00'}`);
    const startTime = new Date(eventStartTime.getTime() + stage.start_offset * 60000);
    const endTime = new Date(startTime.getTime() + (template.duration_minutes || stage.duration) * 60000);

    createAssignmentMutation.mutate({
      task_template_id: template.id,
      task_title: template.title,
      task_description: template.description,
      event_id: eventId,
      event_name: event.event_name,
      assigned_to_id: employee.id,
      assigned_to_name: employee.full_name,
      assigned_to_phone: employee.phone_e164 || '',
      computed_start_time: startTime.toISOString(),
      computed_end_time: endTime.toISOString(),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'PENDING',
      reminder_before_start_minutes: template.reminder_before_start_minutes,
      reminder_before_end_minutes: template.reminder_before_end_minutes,
      escalate_to_manager: template.escalate_to_manager_if_not_done,
      manager_id: employee.manager_id || '',
      manager_name: employee.manager_name || '',
      manager_phone: '',
      manually_overridden: false
    });
  };

  const getAssignmentsForCell = (stageIndex, categoryId) => {
    const stage = stages[stageIndex];
    return assignments.filter(a => {
      const template = templates.find(t => t.id === a.task_template_id);
      return template?.category_id === categoryId;
    });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Available Employees */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">עובדים זמינים</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Droppable droppableId="employees-pool" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex flex-wrap gap-2"
                >
                  {allEmployees.filter(e => e.is_active && staffing.some(s => s.employee_id === e.id)).map((employee, index) => (
                    <Draggable key={employee.id} draggableId={employee.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border-2 border-blue-300 cursor-move transition-shadow ${
                            snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                          }`}
                        >
                          <User className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="font-semibold text-sm text-stone-900">{employee.full_name}</p>
                            <p className="text-xs text-stone-600">{employee.department_name}</p>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </CardContent>
        </Card>

        {/* Planning Grid */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>תכנון אירוע - טבלת שלבים ומשימות</CardTitle>
              <Button onClick={addStage} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                הוסף שלב
              </Button>
            </div>
          </CardHeader>
          <CardContent>
        <div className="space-y-4">
          {/* Stage Headers */}
          <div className="grid gap-2 mb-4">
            {stages.map((stage, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center bg-stone-50 p-2 rounded">
                <Input
                  className="col-span-4"
                  value={stage.name}
                  onChange={(e) => updateStage(index, 'name', e.target.value)}
                  placeholder="שם השלב"
                />
                <div className="col-span-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stone-400" />
                  <Input
                    type="number"
                    value={stage.start_offset}
                    onChange={(e) => updateStage(index, 'start_offset', parseInt(e.target.value) || 0)}
                    placeholder="הסטה"
                    className="w-20"
                  />
                  <span className="text-xs text-stone-500">דק׳</span>
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stone-400" />
                  <Input
                    type="number"
                    value={stage.duration}
                    onChange={(e) => updateStage(index, 'duration', parseInt(e.target.value) || 0)}
                    placeholder="משך"
                    className="w-20"
                  />
                  <span className="text-xs text-stone-500">דק׳</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStage(index)}
                  className="col-span-2"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Planning Grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-stone-100 text-right font-semibold sticky right-0">שלב</th>
                  {categories.map(category => (
                    <th key={category.id} className="border p-2 bg-stone-100 text-center font-semibold min-w-[200px]">
                      {category.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, stageIndex) => (
                  <tr key={stageIndex}>
                    <td className="border p-2 bg-stone-50 font-medium sticky right-0">
                      {stage.name}
                    </td>
                    {categories.map(category => {
                      const cellAssignments = getAssignmentsForCell(stageIndex, category.id);
                      return (
                        <td key={category.id} className="border p-2 align-top">
                          <Droppable droppableId={`cell-${stageIndex}-${category.id}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-[100px] space-y-2 p-2 rounded transition-colors ${
                                  snapshot.isDraggingOver ? 'bg-emerald-50' : ''
                                }`}
                              >
                                {cellAssignments.map(assignment => (
                                  <div key={assignment.id} className="bg-emerald-100 p-2 rounded text-xs border border-emerald-300">
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-stone-900 truncate">
                                          {assignment.task_title}
                                        </p>
                                        <p className="text-stone-600 flex items-center gap-1 mt-1">
                                          <User className="w-3 h-3" />
                                          {assignment.assigned_to_name}
                                        </p>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </CardContent>
      </Card>

    </div>
    </DragDropContext>
  );
}