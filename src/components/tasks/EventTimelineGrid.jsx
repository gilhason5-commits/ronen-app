import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, User, Users, Bell, AlertTriangle, Edit2, Trash2 } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { toast } from "sonner";
import TaskEditDialog from "./TaskEditDialog";

export default function EventTimelineGrid({ eventId, event, templates }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
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

  // Generate time slots in 15-minute intervals
  const timeSlots = useMemo(() => {
    const slots = [];
    const eventTime = event?.event_time || '18:00';
    const [eventHours, eventMinutes] = eventTime.split(':').map(Number);
    
    // Event start in total minutes from midnight
    const eventStartTotalMinutes = eventHours * 60 + (eventMinutes || 0);
    // Start 5 hours before event
    const gridStartMinutes = eventStartTotalMinutes - 300;
    
    for (let i = 0; i < 40; i++) { // 10 hours total (5 before + 5 after) in 15-min slots
      const totalMinutes = gridStartMinutes + i * 15;
      const slotHour = Math.floor(totalMinutes / 60);
      const slotMinute = totalMinutes % 60;
      const timeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;
      
      // offsetMinutes relative to event start: slot 8 = event start
      const offsetFromEvent = totalMinutes - eventStartTotalMinutes;
      
      slots.push({
        time: timeStr,
        hour: slotHour,
        minute: slotMinute,
        offsetMinutes: offsetFromEvent
      });
    }
    return slots;
  }, [event]);

  // Get tasks that have a start_time defined
  const scheduledTasks = useMemo(() => {
    return assignments.filter(a => a.start_time);
  }, [assignments]);

  // Calculate how many 15-min slots a task covers
  const getTaskSlotSpan = (assignment) => {
    const template = templates.find(t => t.id === assignment.task_template_id);
    const duration = template?.duration_minutes || 60;
    return Math.ceil(duration / 15);
  };

  // Group tasks by their slot index and arrange them so they don't overlap
  const getTasksLayout = useMemo(() => {
    if (!timeSlots.length) return { tasks: [], totalColumns: 0 };
    
    const slotHeightPx = 48;
    const minutesPerSlot = 15;
    const pxPerMinute = slotHeightPx / minutesPerSlot;
    
    // Grid start time in minutes from midnight (local display time)
    const gridStartMinutes = timeSlots[0].hour * 60 + timeSlots[0].minute;
    
    // For each task, calculate position so task starts FROM the line of start time
    // and stretches TO the line of end time
    const tasksWithSlots = scheduledTasks.map(task => {
      const taskStart = new Date(task.start_time);
      const taskEnd = new Date(task.end_time);
      
      // Extract hours and minutes from the displayed time string (what user sees: HH:mm)
      const displayedStartTime = format(taskStart, 'HH:mm');
      const displayedEndTime = format(taskEnd, 'HH:mm');
      
      const [taskStartHour, taskStartMinute] = displayedStartTime.split(':').map(Number);
      const [taskEndHour, taskEndMinute] = displayedEndTime.split(':').map(Number);
      
      const taskStartMinutes = taskStartHour * 60 + taskStartMinute;
      const taskEndMinutes = taskEndHour * 60 + taskEndMinute;
      
      // Each slot displays its time at the BOTTOM (on the line)
      // If task starts at time T, we want it to start FROM the line labeled T
      // The line for time T is at the bottom of the slot showing T, which is: ((T - gridStart) / 15 + 1) * slotHeight
      const startLinePx = ((taskStartMinutes - gridStartMinutes) / minutesPerSlot + 1) * slotHeightPx;
      const endLinePx = ((taskEndMinutes - gridStartMinutes) / minutesPerSlot + 1) * slotHeightPx;
      
      const topPx = startLinePx;
      const heightPx = endLinePx - startLinePx;
      
      // For overlap detection, use slot indices
      const startSlotIndex = Math.floor((taskStartMinutes - gridStartMinutes) / minutesPerSlot);
      const endSlotIndex = Math.ceil((taskEndMinutes - gridStartMinutes) / minutesPerSlot);
      
      return {
        ...task,
        topPx,
        heightPx,
        slotIndex: startSlotIndex,
        slotSpan: Math.max(1, endSlotIndex - startSlotIndex),
        endSlotIndex: Math.max(startSlotIndex, endSlotIndex - 1)
      };
    }).filter(t => t.topPx >= 0 && t.topPx < timeSlots.length * slotHeightPx);

    // Sort by slotIndex, then by creation time
    tasksWithSlots.sort((a, b) => a.slotIndex - b.slotIndex || new Date(a.created_date) - new Date(b.created_date));

    // Assign columns to avoid overlap
    const columns = []; // Array of arrays, each representing a column
    
    tasksWithSlots.forEach(task => {
      // Find the first column where this task doesn't overlap with existing tasks
      let columnIndex = columns.findIndex(column => {
        return !column.some(existingTask => {
          // Check if there's an overlap
          const overlap = !(task.slotIndex > existingTask.endSlotIndex || task.endSlotIndex < existingTask.slotIndex);
          return overlap;
        });
      });
      
      if (columnIndex === -1) {
        // Need a new column
        columnIndex = columns.length;
        columns.push([]);
      }
      
      task.columnIndex = columnIndex;
      columns[columnIndex].push(task);
    });

    return {
      tasks: tasksWithSlots,
      totalColumns: columns.length
    };
  }, [scheduledTasks, timeSlots, templates]);

  const getTaskColor = (assignment) => {
    const colors = [
      { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800' },
      { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
      { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
      { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800' },
      { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-800' },
      { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-800' },
    ];
    // Use task_template_id to get consistent color
    const index = assignment.task_template_id?.charCodeAt(0) || 0;
    return colors[index % colors.length];
  };

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskAssignment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה הוסרה מהאירוע');
      setSelectedTask(null);
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('האם להסיר משימה זו מהאירוע?')) {
      deleteAssignmentMutation.mutate(id);
    }
  };

  const handleEdit = (task) => {
    const template = templates.find(t => t.id === task.task_template_id);
    setSelectedTask(null);
    setEditingTask({ template, assignment: task });
  };

  const SLOT_HEIGHT = 48; // pixels per 15-minute slot

  return (
    <div className="space-y-6">
      {/* Timeline Grid */}
      <Card>
        <CardHeader>
          <CardTitle>לוח זמנים</CardTitle>
          <p className="text-sm text-stone-500">
            לחץ על משימה לצפייה בפרטים. הגדר שעות התחלה בלשונית "משימות".
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Time header */}
              <div className="flex border-b-2 border-stone-300">
                <div className="w-20 flex-shrink-0 p-2 bg-stone-100 font-semibold text-center">שעה</div>
                <div className="flex-1 p-2 bg-stone-100 font-semibold text-center">משימות</div>
              </div>

              {/* Timeline body with time labels and tasks area */}
              <div className="flex">
                {/* Time labels column - labels appear AT the line (bottom of each slot) */}
                <div className="w-20 flex-shrink-0 relative" style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}>
                  {timeSlots.map((slot, index) => {
                    const isEventStart = slot.offsetMinutes === 0;
                    const isHourMark = slot.time.endsWith(':00');
                    
                    return (
                      <div 
                        key={slot.time}
                        style={{ 
                          position: 'absolute',
                          top: `${index * SLOT_HEIGHT}px`,
                          left: 0,
                          right: 0,
                          height: `${SLOT_HEIGHT}px`,
                        }}
                        className={`border-b border-l ${
                          isEventStart ? 'border-emerald-500 border-b-2' : 
                          isHourMark ? 'border-stone-300' : 'border-stone-200'
                        }`}
                      >
                        {/* Time label positioned at the bottom line */}
                        <div 
                          className={`absolute bottom-0 left-0 right-0 translate-y-1/2 text-center text-sm bg-white px-1 ${
                            isEventStart ? 'font-bold text-emerald-700' : 
                            isHourMark ? 'font-medium text-stone-900' : 'text-stone-500'
                          }`}
                        >
                          {slot.time}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tasks area - relative container for absolute positioned tasks */}
                <div className="flex-1 relative" style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}>
                  {/* Grid lines for visual reference */}
                  {timeSlots.map((slot, index) => {
                    const isEventStart = slot.offsetMinutes === 0;
                    const isHourMark = slot.time.endsWith(':00');
                    
                    return (
                      <div 
                        key={`grid-${slot.time}`}
                        style={{ 
                          position: 'absolute',
                          top: `${index * SLOT_HEIGHT}px`,
                          left: 0,
                          right: 0,
                          height: `${SLOT_HEIGHT}px`,
                        }}
                        className={`border-b ${
                          isEventStart ? 'border-emerald-500 border-b-2 bg-emerald-50/50' : 
                          isHourMark ? 'border-stone-300' : 'border-stone-200'
                        }`}
                      />
                    );
                  })}

                  {/* Event Start Marker */}
                  {(() => {
                    const eventStartSlot = timeSlots.findIndex(s => s.offsetMinutes === 0);
                    if (eventStartSlot >= 0) {
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            top: `${(eventStartSlot + 1) * SLOT_HEIGHT - 12}px`,
                            right: '4px',
                            zIndex: 5,
                          }}
                        >
                          <Badge className="bg-blue-500 text-white text-xs">
                            תחילת אירוע
                          </Badge>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Tasks positioned absolutely */}
                  {getTasksLayout.tasks.map((task) => {
                    const taskStartTime = format(new Date(task.start_time), 'HH:mm');
                    const colors = getTaskColor(task);
                    
                    const totalColumns = getTasksLayout.totalColumns || 1;
                    const columnWidth = 100 / totalColumns;
                    const rightPosition = task.columnIndex * columnWidth;

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        style={{
                          position: 'absolute',
                          top: `${task.topPx}px`,
                          right: `${rightPosition}%`,
                          width: `calc(${columnWidth}% - 8px)`,
                          height: 'auto',
                          minHeight: `${Math.max(task.heightPx - 4, 44)}px`,
                          marginRight: '4px',
                          zIndex: 10,
                        }}
                        className={`${colors.bg} border-2 ${colors.border} rounded-lg px-2 py-1 text-xs cursor-pointer transition-all hover:shadow-lg hover:z-30`}
                      >
                        <p className={`font-semibold ${colors.text} leading-tight`} style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.task_title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-stone-500 leading-tight whitespace-nowrap">
                          <span>{taskStartTime} - {format(new Date(task.end_time), 'HH:mm')}</span>
                          {task.assigned_to_name && (
                            <span className="flex items-center gap-0.5 text-stone-600">
                              <User className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate max-w-[80px]">{task.assigned_to_name}</span>
                              {task.additional_employees?.length > 0 && (
                                <span className="text-stone-400">+{task.additional_employees.length}</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {scheduledTasks.length === 0 && (
                <div className="text-center py-8 text-stone-500">
                  <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p>אין משימות עם שעת התחלה מוגדרת</p>
                  <p className="text-xs text-stone-400">הגדר שעות התחלה למשימות בלשונית "משימות"</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Details Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.task_title}</DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              {selectedTask.task_description && (
                <p className="text-stone-600">{selectedTask.task_description}</p>
              )}

              <div className="space-y-3 text-sm">
                {/* Time */}
                <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">שעות</p>
                    <p className="text-stone-600">
                      {format(new Date(selectedTask.start_time), 'HH:mm')} - {format(new Date(selectedTask.end_time), 'HH:mm')}
                    </p>
                  </div>
                </div>

                {/* Assigned Employee */}
                <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                  <User className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium">עובד מוקצה</p>
                    <p className="text-stone-600">
                      {selectedTask.assigned_to_name || 'לא מוקצה'}
                      {selectedTask.assigned_to_phone && ` (${selectedTask.assigned_to_phone})`}
                    </p>
                  </div>
                </div>

                {/* Additional Employees */}
                {selectedTask.additional_employees?.length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-medium">עובדים נוספים</p>
                      <div className="space-y-1">
                        {selectedTask.additional_employees.map((emp, idx) => (
                          <p key={idx} className="text-stone-600">
                            {emp.employee_name}
                            {emp.employee_phone && ` (${emp.employee_phone})`}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reminders */}
                {selectedTask.reminder_before_start_minutes > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                    <Bell className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium">תזכורות</p>
                      <p className="text-stone-600">
                        {selectedTask.reminder_before_start_minutes} דק' לפני התחלה
                      </p>
                    </div>
                  </div>
                )}

                {/* Escalation */}
                {selectedTask.escalate_to_manager && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-orange-800">אסקלציה למנהל</p>
                      <p className="text-orange-700">
                        {selectedTask.escalation_employee_name || selectedTask.manager_name || 'לא הוגדר'}
                        {selectedTask.escalation_role_name && (
                          <span className="text-orange-500 text-xs mr-1">({selectedTask.escalation_role_name})</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="pt-2">
                  <Badge className={
                    selectedTask.status === 'DONE' ? 'bg-green-100 text-green-800' :
                    selectedTask.status === 'NOT_DONE' ? 'bg-red-100 text-red-800' :
                    selectedTask.status === 'OVERDUE' ? 'bg-orange-100 text-orange-800' :
                    'bg-stone-100 text-stone-800'
                  }>
                    {selectedTask.status === 'DONE' ? 'בוצע' :
                     selectedTask.status === 'NOT_DONE' ? 'לא בוצע' :
                     selectedTask.status === 'OVERDUE' ? 'באיחור' :
                     'ממתין'}
                  </Badge>
                </div>

                {/* Edit & Delete Actions */}
                <div className="flex gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(selectedTask)}
                    className="flex-1"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    עריכה
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selectedTask.id)}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    הסר מאירוע
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editingTask && (
        <TaskEditDialog
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          template={editingTask.template}
          assignment={editingTask.assignment}
          eventId={eventId}
          event={event}
        />
      )}
    </div>
  );
}