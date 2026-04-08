import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays } from "lucide-react";
import { format, addMinutes } from "date-fns";
import EventTimelineGrid from "../components/tasks/EventTimelineGrid.jsx";
import EventTasksByRoleColumns from "../components/tasks/EventTasksByRoleColumns.jsx";
import AvailabilitySendTimeControl from "../components/tasks/AvailabilitySendTimeControl.jsx";


export default function PerEventTasks() {
  const [activeTab, setActiveTab] = useState("tasks");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [autoCreating, setAutoCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['events', 'perEventTasks'],
    queryFn: async () => {
      const data = await base44.entities.Event.list('-event_date');
      // Show future events + events from the last 7 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return data.filter(e => {
        if (e.status === 'producer_draft') return false;
        if (!e.approved_for_kitchen) return false;
        if (!e.event_date) return true;
        const eventDate = new Date(e.event_date);
        eventDate.setHours(23, 59, 59, 999);
        return eventDate >= oneWeekAgo;
      });
    },
    initialData: [],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['taskCategories', 'PER_EVENT'],
    queryFn: async () => {
      const data = await base44.entities.TaskCategory.list();
      return data.filter(c => c.category_type === 'PER_EVENT');
    },
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['taskTemplates', 'PER_EVENT'],
    queryFn: async () => {
      const data = await base44.entities.TaskTemplate.list();
      return data.filter(t => t.task_type === 'PER_EVENT');
    },
    initialData: [],
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['taskAssignments', selectedEventId],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.filter({ event_id: selectedEventId });
      return data;
    },
    initialData: [],
    enabled: !!selectedEventId,
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Track which events we've already auto-created for to prevent duplicates
  const autoCreatedRef = React.useRef(new Set());

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  // Auto-create all active PER_EVENT templates as assignments when an event is selected
  // and has no assignments yet
  useEffect(() => {
    if (!selectedEventId || !selectedEvent || assignmentsLoading || autoCreating) return;
    if (templates.length === 0) return;
    if (assignments.length > 0) return; // already has assignments
    if (autoCreatedRef.current.has(selectedEventId)) return; // already triggered for this event

    const activeTemplates = templates.filter(t => t.is_active);
    if (activeTemplates.length === 0) return;

    autoCreatedRef.current.add(selectedEventId);
    setAutoCreating(true);

    // Double-check from DB to prevent race conditions
    base44.entities.TaskAssignment.filter({ event_id: selectedEventId }).then(existingAssignments => {
      const existingTemplateIds = new Set(existingAssignments.map(a => a.task_template_id));
      const templatesToCreate = activeTemplates.filter(t => !existingTemplateIds.has(t.id));

      if (templatesToCreate.length === 0) {
        setAutoCreating(false);
        return;
      }

      const eventStartTime = new Date(`${selectedEvent.event_date}T${selectedEvent.event_time || '00:00'}`);
      
      const newAssignments = templatesToCreate.map(template => {
        const startTime = new Date(eventStartTime.getTime() + (template.start_offset_minutes || 0) * 60000);
        const endTime = new Date(startTime.getTime() + (template.duration_minutes || 60) * 60000);

        // Auto-assign ALL employees with this role
        const roleEmployees = template.default_role 
          ? allEmployees.filter(e => e.role_id === template.default_role && e.is_active) 
          : [];

        const primaryEmployee = roleEmployees[0] || null;
        const additionalEmployees = roleEmployees.slice(1).map(emp => ({
          employee_id: emp.id,
          employee_name: emp.full_name,
          employee_phone: emp.phone_e164 || ''
        }));

        // Auto-assign escalation employee based on template's escalation_role_id
        const escalationEmployee = template.escalation_role_id 
          ? allEmployees.find(e => e.role_id === template.escalation_role_id && e.is_active)
          : null;

        return {
          task_template_id: template.id,
          task_title: template.title,
          task_description: template.description,
          event_id: selectedEventId,
          event_name: selectedEvent.event_name,
          assigned_to_id: primaryEmployee?.id || null,
          assigned_to_name: primaryEmployee?.full_name || '',
          assigned_to_phone: primaryEmployee?.phone_e164 || '',
          additional_employees: additionalEmployees,
          computed_start_time: startTime.toISOString(),
          computed_end_time: endTime.toISOString(),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'PENDING',
          reminder_before_start_minutes: template.reminder_before_start_minutes || 10,
          reminder_before_end_minutes: template.reminder_before_end_minutes || 10,
          escalate_to_manager: template.escalate_to_manager_if_not_done || false,
          escalation_role_id: template.escalation_role_id || null,
          escalation_role_name: template.escalation_role_name || '',
          escalation_employee_id: escalationEmployee?.id || null,
          escalation_employee_name: escalationEmployee?.full_name || '',
          escalation_employee_phone: escalationEmployee?.phone_e164 || '',
          manager_id: primaryEmployee?.manager_id || null,
          manager_name: primaryEmployee?.manager_name || '',
          manager_phone: '',
          manually_overridden: false
        };
      });

      return base44.entities.TaskAssignment.bulkCreate(newAssignments);
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments', selectedEventId] });
      setAutoCreating(false);
    }).catch((err) => {
      console.error('Failed to auto-create task assignments:', err);
      alert('שגיאה ביצירת משימות: ' + (err?.message || JSON.stringify(err)));
      autoCreatedRef.current.delete(selectedEventId);
      setAutoCreating(false);
    });
  }, [selectedEventId, selectedEvent, templates, assignments.length, assignmentsLoading]);

  const formatEventDisplay = (event) => {
    if (!event) return '';
    try {
      const dateStr = event.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy') : '';
      return `${event.event_name || 'אירוע'} - ${dateStr}`;
    } catch {
      return event.event_name || 'אירוע';
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">תכנון משימות אירועים</h1>
          <p className="text-stone-500 mt-1">הקצאת משימות וניהול צוות לאירועים</p>
        </div>
        <AvailabilitySendTimeControl />
      </div>

      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-stone-900 mb-2">בחירת אירוע</h3>
              <Select value={selectedEventId || ""} onValueChange={setSelectedEventId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="בחר אירוע לניהול משימות" />
                </SelectTrigger>
                <SelectContent>
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {formatEventDisplay(event)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEvent && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-stone-600">תאריך:</span>
                    <p className="font-medium">
                      {selectedEvent.event_date ? format(new Date(selectedEvent.event_date), 'dd/MM/yyyy') : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-600">שעת התחלה:</span>
                    <p className="font-medium">{selectedEvent.event_time || '-'}</p>
                  </div>
                  <div>
                    <span className="text-stone-600">מספר אורחים:</span>
                    <p className="font-medium">{selectedEvent.guest_count || '-'}</p>
                  </div>
                  <div>
                    <span className="text-stone-600">סוג אירוע:</span>
                    <p className="font-medium">{selectedEvent.event_type === 'wedding' ? 'חתונה' : 'אירוע'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedEventId && (
        <div className="text-xs text-stone-400 bg-stone-100 p-2 rounded">
          תבניות: {templates.length} | משימות קיימות: {assignments.length} | עובדים: {allEmployees.length}
        </div>
      )}

      {!selectedEventId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarDays className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-stone-700 mb-2">בחר אירוע</h3>
            <p className="text-stone-500">בחר אירוע מהרשימה למעלה כדי לנהל את המשימות והצוות שלו</p>
          </CardContent>
        </Card>
      ) : autoCreating ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-stone-600">מוסיף משימות לאירוע...</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tasks">תכנון אירוע</TabsTrigger>
            <TabsTrigger value="status">מעקב סטטוס</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            <EventTimelineGrid 
              eventId={selectedEventId} 
              event={selectedEvent}
              templates={templates}
            />
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <EventTasksByRoleColumns 
              eventId={selectedEventId} 
              event={selectedEvent}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}