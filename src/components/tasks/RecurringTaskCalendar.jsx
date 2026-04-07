import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Clock, User, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, addWeeks, isSameDay, isSameMonth, parseISO } from "date-fns";
import { he } from "date-fns/locale";

export default function RecurringTaskCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // month or week
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ['taskAssignments', 'RECURRING'],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.list('-start_time');
      return data.filter(a => !a.event_id);
    },
    initialData: [],
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['taskTemplates', 'RECURRING'],
    queryFn: async () => {
      const data = await base44.entities.TaskTemplate.list();
      return data.filter(t => t.task_type === 'RECURRING');
    },
    initialData: [],
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: () => base44.entities.EmployeeRole.list(),
    initialData: [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  // Get employees for a role
  const getEmployeesForRole = (roleId) => {
    if (!roleId) return [];
    return employees.filter(e => e.role_id === roleId && e.is_active);
  };

  // Get role info for a task
  const getRoleInfoForTask = (task) => {
    const template = templates.find(t => t.id === task.template_id);
    if (!template?.default_role) return null;
    const role = roles.find(r => r.id === template.default_role);
    const roleEmployees = getEmployeesForRole(template.default_role);
    return {
      roleName: role?.role_name || template.default_role_name,
      employees: roleEmployees
    };
  };

  const getCalendarDays = () => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

      const days = [];
      let day = calendarStart;
      while (day <= calendarEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
      return days;
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return days;
    }
  };

  const getTasksForDay = (day) => {
    return assignments.filter(a => {
      if (!a.start_time) return false;
      // Parse the ISO string and extract local date components
      const taskDate = new Date(a.start_time);
      // Compare using local year, month, day
      return taskDate.getFullYear() === day.getFullYear() &&
             taskDate.getMonth() === day.getMonth() &&
             taskDate.getDate() === day.getDate();
    });
  };

  const getEventsForDay = (day) => {
    return events.filter(e => {
      if (!e.event_date) return false;
      const eventDate = new Date(e.event_date);
      return eventDate.getFullYear() === day.getFullYear() &&
             eventDate.getMonth() === day.getMonth() &&
             eventDate.getDate() === day.getDate();
    });
  };

  const handlePrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, -1));
    } else {
      setCurrentDate(addWeeks(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const calendarDays = getCalendarDays();
  const weekDays = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            לוח משימות שוטפות
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "month" ? "week" : "month")}
            >
              {viewMode === "month" ? "תצוגה שבועית" : "תצוגה חודשית"}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevious}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              היום
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <h3 className="text-lg font-semibold">
            {format(currentDate, viewMode === "month" ? "MMMM yyyy" : "'שבוע' w, yyyy", { locale: he })}
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {/* Header */}
          {weekDays.map((day, i) => (
            <div key={i} className="text-center font-semibold text-stone-600 py-2">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, i) => {
            const dayTasks = getTasksForDay(day);
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = viewMode === "week" || isSameMonth(day, currentDate);

            return (
              <div
                key={i}
                className={`min-h-[100px] border rounded-lg p-2 cursor-pointer hover:border-emerald-400 transition-colors ${
                  isToday ? "bg-emerald-50 border-emerald-300" : "bg-white"
                } ${!isCurrentMonth ? "opacity-40" : ""}`}
                onClick={() => setSelectedDay(day)}
              >
                <div className={`text-sm font-semibold mb-2 ${isToday ? "text-emerald-700" : "text-stone-700"}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {/* Event Start Times */}
                  {dayEvents.map(event => (
                    <div
                      key={`event-${event.id}`}
                      className="text-xs bg-blue-500 text-white rounded px-2 py-1 font-medium"
                    >
                      {event.event_time || '00:00'} תחילת אירוע
                    </div>
                  ))}
                  {dayTasks.length > 0 && (
                    <div className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-1">
                      {dayTasks.length} משימות
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day Tasks Dialog */}
        <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                משימות ליום {selectedDay && format(selectedDay, "EEEE, d בMMMM yyyy", { locale: he })}
              </DialogTitle>
            </DialogHeader>
            {selectedDay && (
              <div className="space-y-3 py-2">
                {getTasksForDay(selectedDay).length === 0 ? (
                  <p className="text-sm text-stone-500 text-center py-4">אין משימות ליום זה</p>
                ) : (
                  getTasksForDay(selectedDay).map(task => (
                    <div key={task.id} className="border rounded-lg p-4 space-y-2 bg-stone-50">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-stone-900">{task.task_title}</h4>
                        <Badge className={
                          task.status === 'DONE' ? 'bg-green-100 text-green-700' :
                          task.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                          task.status === 'NOT_DONE' ? 'bg-red-100 text-red-700' :
                          task.status === 'NOT_ARRIVING' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-amber-100 text-amber-700'
                        }>
                          {task.status === 'DONE' ? 'בוצע' :
                           task.status === 'OVERDUE' ? 'באיחור' :
                           task.status === 'NOT_DONE' ? 'לא בוצע' :
                           task.status === 'NOT_ARRIVING' ? 'לא מגיע' : 'ממתין'}
                        </Badge>
                      </div>
                      
                      {task.task_description && (
                        <p className="text-sm text-stone-600">{task.task_description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 text-sm text-stone-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-stone-400" />
                          <span>
                            {format(new Date(task.start_time), "HH:mm")}
                            {task.end_time && ` - ${format(new Date(task.end_time), "HH:mm")}`}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-stone-400" />
                          <span className={!task.assigned_to_name ? 'text-red-600 font-medium' : ''}>
                            {task.assigned_to_name || 'יש להקצות עובד לתפקיד זה'}
                          </span>
                        </div>
                        
                        {task.reminder_before_start_minutes > 0 && (
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-stone-400" />
                            <span>{task.reminder_before_start_minutes} דק' לפני</span>
                          </div>
                        )}
                      </div>
                      
                      {task.additional_employees?.length > 0 && (
                        <div className="text-sm text-stone-600">
                          <span className="text-stone-500">עובדים נוספים: </span>
                          {task.additional_employees.map(e => e.employee_name).join(', ')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}