import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, AlertTriangle, Phone, Plus, Pencil, Trash2, RefreshCw, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import AddRecurringTaskDialog from "./AddRecurringTaskDialog";

export default function TaskAssignmentList({ taskType }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ['taskAssignments', taskType],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.list('-start_time', 500);
      const filtered = data.filter(a => taskType === 'RECURRING' ? !a.event_id : !!a.event_id);
      
      // Auto-delete expired one-time tasks (24h after start_time)
      const now = new Date();
      const expiredOnce = filtered.filter(a => {
        if (a.recurrence_type !== 'once') return false;
        if (!a.start_time) return false;
        const startTime = new Date(a.start_time);
        return (now - startTime) > 24 * 60 * 60 * 1000;
      });
      
      if (expiredOnce.length > 0) {
        Promise.all(expiredOnce.map(a => base44.entities.TaskAssignment.delete(a.id)))
          .then(() => queryClient.invalidateQueries({ queryKey: ['taskAssignments'] }));
      }
      
      // Return only non-expired tasks
      const expiredIds = new Set(expiredOnce.map(a => a.id));
      return filtered.filter(a => !expiredIds.has(a.id));
    },
    initialData: [],
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: () => base44.entities.EmployeeRole.list(),
    initialData: [],
  });

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['taskTemplates'],
    queryFn: () => base44.entities.TaskTemplate.list(),
    initialData: [],
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

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskAssignment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('המשימה נמחקה בהצלחה');
    },
  });

  const handleDelete = (assignment) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את המשימה "${assignment.task_title}"?`)) {
      deleteAssignmentMutation.mutate(assignment.id);
    }
  };

  const handleEditClick = (assignment) => {
    setEditingAssignment(assignment);
    setShowAddDialog(true);
  };

  const getRecurrenceLabel = (assignment) => {
    const type = assignment.recurrence_type;
    const time = assignment.recurrence_time || (assignment.start_time ? new Date(assignment.start_time).toTimeString().slice(0,5) : '');
    const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

    if (type === 'daily') return `כל יום בשעה ${time}`;
    if (type === 'weekly' && assignment.recurrence_days?.length > 0) {
      const days = assignment.recurrence_days.map(d => dayNames[d]).join(', ');
      return `כל שבוע ביום ${days} בשעה ${time}`;
    }
    if (type === 'monthly') return `כל ${assignment.recurrence_day_of_month || ''} לחודש בשעה ${time}`;
    if (type === 'once') return `חד פעמי - ${assignment.start_time ? format(new Date(assignment.start_time), 'dd/MM/yyyy HH:mm') : ''}`;
    return 'משימה חוזרת';
  };

  const filteredAssignments = assignments.filter(a => {
    const search = searchTerm.toLowerCase();
    return a.task_title?.toLowerCase().includes(search) ||
           a.assigned_to_name?.toLowerCase().includes(search);
  });

  // Group assignments by template_id for display
  // One-time tasks get their own unique key so they appear as separate items
  let displayItems = filteredAssignments;
  if (taskType === 'RECURRING') {
    const grouped = {};
    filteredAssignments.forEach(a => {
      const isOnce = a.recurrence_type === 'once';
      const key = isOnce ? `once_${a.id}` : (a.task_template_id || a.id);
      if (!grouped[key]) {
        grouped[key] = {
          ...a,
          isGroup: true,
          groupCount: 1,
          allAssignments: [a]
        };
      } else {
        grouped[key].groupCount++;
        grouped[key].allAssignments.push(a);
      }
    });
    displayItems = Object.values(grouped);
  }

  const statusConfig = {
    PENDING: { icon: Clock, color: "bg-blue-100 text-blue-700", label: "ממתין" },
    DONE: { icon: CheckCircle, color: "bg-emerald-100 text-emerald-700", label: "בוצע" },
    NOT_DONE: { icon: XCircle, color: "bg-red-100 text-red-700", label: "לא בוצע" },
    OVERDUE: { icon: AlertTriangle, color: "bg-orange-100 text-orange-700", label: "באיחור" },
    NOT_ARRIVING: { icon: AlertTriangle, color: "bg-yellow-100 text-yellow-700", label: "לא מגיע" }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>הקצאות משימות</CardTitle>
          {taskType === 'RECURRING' && (
            <Button 
              onClick={() => setShowAddDialog(true)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף משימה מהמאגר
            </Button>
          )}
        </div>
        <Input
          placeholder="חיפוש משימות..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-4"
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayItems.map((item) => {
            const assignment = item.isGroup ? item.allAssignments[0] : item;
            const StatusIcon = statusConfig[assignment.status]?.icon || Clock;
            
            return (
              <div key={item.isGroup ? (item.task_template_id || item.id) : item.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-stone-900">{assignment.task_title}</h4>
                      {assignment.recurrence_type === 'once' && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">חד פעמי</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-stone-600">
                      <span className={!assignment.assigned_to_name ? 'text-red-600 font-medium' : ''}>
                        {assignment.assigned_to_name || 'יש להקצות עובד לתפקיד זה'}
                      </span>
                      {assignment.assigned_to_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {assignment.assigned_to_phone}
                        </span>
                      )}
                    </div>
                    {assignment.escalation_employee_name && (
                      <p className="text-xs text-amber-600 mt-1">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        אסקלציה: {assignment.escalation_role_name} ({assignment.escalation_employee_name})
                        {assignment.escalation_sent_at && (
                          <span className="text-stone-500 mr-2">
                            | נשלח: {format(new Date(assignment.escalation_sent_at), 'dd/MM/yyyy HH:mm')}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.isGroup && (
                      <Badge className={statusConfig[assignment.status]?.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig[assignment.status]?.label}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (item.isGroup && item.groupCount > 1) {
                          if (confirm(`האם למחוק את כל ${item.groupCount} המשימות של "${assignment.task_title}"?`)) {
                            item.allAssignments.forEach(a => deleteAssignmentMutation.mutate(a.id));
                          }
                        } else {
                          handleDelete(assignment);
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title={item.isGroup ? `מחק את כל ${item.groupCount} המשימות` : "מחק משימה"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {!item.isGroup && (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-stone-500">התחלה:</span>
                        <p className="font-medium">
                          {assignment.start_time ? format(new Date(assignment.start_time), 'dd/MM/yyyy HH:mm') : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-stone-500">סיום:</span>
                        <p className="font-medium">
                          {assignment.end_time ? format(new Date(assignment.end_time), 'dd/MM/yyyy HH:mm') : '-'}
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
                          סמן כבוצע
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: assignment.id, status: 'NOT_DONE' })}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          סמן כלא בוצע
                        </Button>
                      </div>
                    )}

                    {assignment.completed_at && (
                      <p className="text-xs text-stone-500 mt-2">
                        הושלם: {format(new Date(assignment.completed_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-2 border-t pt-2">
                  {(() => {
                    const recurrenceLabels = {
                      daily: 'יומי',
                      weekly: 'שבועי',
                      monthly: 'חודשי',
                      once: 'חד פעמי',
                    };
                    const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
                    const recType = assignment.recurrence_type;
                    const time = assignment.recurrence_time || (assignment.start_time ? format(new Date(assignment.start_time), 'HH:mm') : '');
                    const date = assignment.start_time ? format(new Date(assignment.start_time), 'dd/MM/yyyy') : '';
                    
                    return (
                      <>
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {recType ? recurrenceLabels[recType] || recType : 'חד פעמי'}
                          {recType === 'weekly' && assignment.recurrence_days?.length > 0 && (
                            <> - ימים: {assignment.recurrence_days.map(d => dayNames[d]).join(', ')}</>
                          )}
                          {recType === 'monthly' && assignment.recurrence_day_of_month && (
                            <> - יום {assignment.recurrence_day_of_month} בחודש</>
                          )}
                        </span>
                        {time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {time}
                          </span>
                        )}
                        {date && (!recType || recType === 'once') && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {date}
                          </span>
                        )}
                      </>
                    );
                  })()}
                  {(() => {
                    const emp = allEmployees.find(e => e.id === assignment.assigned_to_id);
                    const role = emp?.role_id ? allRoles.find(r => r.id === emp.role_id) : null;
                    return role ? (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        תפקיד: {role.role_name}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {displayItems.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500">אין משימות</p>
          </div>
        )}
      </CardContent>

      {taskType === 'RECURRING' && (
        <AddRecurringTaskDialog
          open={showAddDialog}
          onClose={() => {
            setShowAddDialog(false);
            setEditingAssignment(null);
          }}
          editingAssignment={editingAssignment}
        />
      )}
    </Card>
  );
}