import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import RecurringTaskSummaryCard from "./RecurringTaskSummaryCard";
import RecurringInstancesDialog from "./RecurringInstancesDialog";

const ORDER_KEY = "pv_recurring_task_column_order";
const TASK_ORDER_KEY = "pv_recurring_task_order";

export default function PetiVorRecurringTaskColumns({ departmentId }) {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const orderLoaded = useRef(false);

  const { data: employees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: () => base44.entities.EmployeeRole.list(),
    initialData: [],
  });

  // Only employees in Peti Vor department
  const pvEmployeeIds = useMemo(() => {
    return new Set(employees.filter(e => e.department_name === 'פטי וור').map(e => e.id));
  }, [employees]);

  const { data: assignments = [] } = useQuery({
    queryKey: ['taskAssignments', 'PETI_VOR_RECURRING'],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.list('-start_time', 500);
      return data.filter(a => !a.event_id && pvEmployeeIds.has(a.assigned_to_id));
    },
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

  const columns = useMemo(() => {
    const roleMap = {};
    assignments.forEach(a => {
      const emp = employees.find(e => e.id === a.assigned_to_id);
      const roleId = emp?.role_id || 'unassigned';
      const role = roles.find(r => r.id === roleId);
      const roleName = role?.role_name || emp?.role_name || 'ללא תפקיד';

      if (!roleMap[roleId]) {
        roleMap[roleId] = { name: roleName, employeeName: emp?.full_name || a.assigned_to_name || '', templates: {} };
      }

      const tmplId = a.task_template_id || a.id;
      if (!roleMap[roleId].templates[tmplId]) {
        roleMap[roleId].templates[tmplId] = {
          taskTitle: a.task_title,
          taskDescription: a.task_description,
          instances: []
        };
      }
      roleMap[roleId].templates[tmplId].instances.push(a);
    });
    return roleMap;
  }, [assignments, employees, roles]);

  const [columnOrder, setColumnOrder] = useState(null);
  const [taskOrder, setTaskOrder] = useState({});

  useEffect(() => {
    if (orderLoaded.current) return;
    orderLoaded.current = true;
    base44.auth.me().then(user => {
      if (user?.[ORDER_KEY]) setColumnOrder(user[ORDER_KEY]);
      if (user?.[TASK_ORDER_KEY]) setTaskOrder(user[TASK_ORDER_KEY]);
    }).catch(() => {});
  }, []);

  const orderedColumnKeys = useMemo(() => {
    const keys = Object.keys(columns);
    if (!columnOrder) return keys;
    const ordered = columnOrder.filter(k => keys.includes(k));
    keys.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
    return ordered;
  }, [columns, columnOrder]);

  const getOrderedTemplateKeys = useCallback((roleId) => {
    const keys = Object.keys(columns[roleId]?.templates || {});
    const order = taskOrder[roleId];
    if (!order) return keys;
    const ordered = order.filter(k => keys.includes(k));
    keys.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
    return ordered;
  }, [columns, taskOrder]);

  const moveColumn = useCallback((index, direction) => {
    setColumnOrder(prev => {
      const arr = [...(prev || orderedColumnKeys)];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= arr.length) return arr;
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      base44.auth.updateMe({ [ORDER_KEY]: arr });
      return arr;
    });
  }, [orderedColumnKeys]);

  const moveTask = useCallback((roleId, taskIndex, direction) => {
    setTaskOrder(prev => {
      const keys = getOrderedTemplateKeys(roleId);
      const arr = [...keys];
      const newIndex = taskIndex + direction;
      if (newIndex < 0 || newIndex >= arr.length) return prev;
      [arr[taskIndex], arr[newIndex]] = [arr[newIndex], arr[taskIndex]];
      const newOrder = { ...prev, [roleId]: arr };
      base44.auth.updateMe({ [TASK_ORDER_KEY]: newOrder });
      return newOrder;
    });
  }, [getOrderedTemplateKeys]);

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const getRecurrenceLabel = (instance) => {
    if (!instance) return '-';
    const type = instance.recurrence_type;
    if (type === 'daily') return 'יומי';
    if (type === 'weekly' && instance.recurrence_days?.length) {
      const days = instance.recurrence_days.map(d => dayNames[d] || d).join(', ');
      return `שבועי (${days})`;
    }
    if (type === 'weekly') return 'שבועי';
    if (type === 'monthly') return `חודשי (יום ${instance.recurrence_day_of_month || '-'})`;
    return instance.recurrence_time ? `חד פעמי ${instance.recurrence_time}` : '-';
  };

  const printColumn = useCallback((roleId) => {
    const col = columns[roleId];
    if (!col) return;
    const templateKeys = getOrderedTemplateKeys(roleId);
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    const rows = templateKeys.map(tmplId => {
      const tmpl = col.templates[tmplId];
      if (!tmpl) return '';
      const recurrence = getRecurrenceLabel(tmpl.instances[0]);
      return `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${tmpl.taskTitle || '-'}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">${recurrence}</td></tr>`;
    }).join('');
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${col.name} - משימות פטי וור</title><style>body{font-family:Arial,sans-serif;padding:20px}h2{margin-bottom:4px}.sub{color:#666;font-size:13px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#f5f5f4;padding:8px 10px;border:1px solid #ddd;text-align:right}</style></head><body><h2>${col.name}</h2>${col.employeeName ? `<div class="sub">${col.employeeName}</div>` : ''}<table><thead><tr><th>משימה</th><th>תדירות</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.print();
  }, [columns, getOrderedTemplateKeys]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            משימות שוטפות פטי וור לפי תפקיד
          </CardTitle>
          <p className="text-sm text-stone-500 mt-1">לחץ על משימה לצפייה בכל המופעים והסטטוסים</p>
        </CardHeader>
        <CardContent>
          {orderedColumnKeys.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500">אין משימות שוטפות פטי וור מוגדרות</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {orderedColumnKeys.map((roleId, colIndex) => {
                const col = columns[roleId];
                if (!col) return null;
                const templateKeys = getOrderedTemplateKeys(roleId);
                return (
                  <div key={roleId} className="min-w-[280px] max-w-[320px] flex-shrink-0">
                    <div className="bg-stone-100 rounded-t-lg px-4 py-3 border border-b-0 border-stone-200">
                      <div className="flex items-center justify-between gap-1">
                        <button onClick={() => moveColumn(colIndex, 1)} disabled={colIndex === orderedColumnKeys.length - 1} className="p-1 rounded hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="הזז ימינה">
                          <ChevronRight className="w-4 h-4 text-stone-600" />
                        </button>
                        <div className="text-center flex-1 min-w-0">
                          <h3 className="font-bold text-stone-800 truncate">{col.name}</h3>
                          {col.employeeName && <p className="text-xs text-stone-500 truncate mt-0.5">{col.employeeName}</p>}
                        </div>
                        <button onClick={() => moveColumn(colIndex, -1)} disabled={colIndex === 0} className="p-1 rounded hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="הזז שמאלה">
                          <ChevronLeft className="w-4 h-4 text-stone-600" />
                        </button>
                      </div>
                    </div>
                    <div className="border border-t-0 border-stone-200 p-3 space-y-2 bg-stone-50 min-h-[200px] max-h-[70vh] overflow-y-auto">
                      {templateKeys.map((tmplId, taskIndex) => {
                        const tmpl = col.templates[tmplId];
                        if (!tmpl) return null;
                        return (
                          <div key={tmplId} className="flex items-start gap-1">
                            <div className="flex flex-col gap-0.5 pt-2 flex-shrink-0">
                              <button onClick={() => moveTask(roleId, taskIndex, -1)} disabled={taskIndex === 0} className="p-0.5 rounded hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="הזז למעלה">
                                <ChevronUp className="w-3.5 h-3.5 text-stone-500" />
                              </button>
                              <button onClick={() => moveTask(roleId, taskIndex, 1)} disabled={taskIndex === templateKeys.length - 1} className="p-0.5 rounded hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="הזז למטה">
                                <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <RecurringTaskSummaryCard
                                templateId={tmplId}
                                taskTitle={tmpl.taskTitle}
                                taskDescription={tmpl.taskDescription}
                                instances={tmpl.instances}
                                onClick={() => setSelectedTask({ templateId: tmplId, taskTitle: tmpl.taskTitle, instances: tmpl.instances })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border border-t-0 border-stone-200 rounded-b-lg px-3 py-2 bg-white">
                      <Button variant="ghost" size="sm" className="w-full text-stone-500 hover:text-stone-700 gap-2" onClick={() => printColumn(roleId)}>
                        <Printer className="w-4 h-4" />
                        הדפס עמודה
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RecurringInstancesDialog
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        taskTitle={selectedTask?.taskTitle || ''}
        allInstances={selectedTask?.instances || []}
        onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
      />
    </>
  );
}