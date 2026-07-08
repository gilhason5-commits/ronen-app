import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, Printer, UserCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { markUnavailableAndReassignToBackup } from "@/lib/taskBackup";
import EventTaskSummaryCard from "./EventTaskSummaryCard";

const STATUS_CONFIG = {
  PENDING: { color: '#1d4ed8', bg: '#dbeafe', label: 'ממתין' },
  DONE: { color: '#15803d', bg: '#dcfce7', label: 'בוצע' },
  NOT_DONE: { color: '#b91c1c', bg: '#fee2e2', label: 'לא בוצע' },
  OVERDUE: { color: '#c2410c', bg: '#ffedd5', label: 'באיחור' },
  NOT_ARRIVING: { color: '#a16207', bg: '#fef9c3', label: 'לא מגיע' },
};

const computeStatus = (a) => {
  const now = new Date();
  const endTime = a.end_time ? new Date(a.end_time) : null;
  if (a.status === 'DONE') return 'DONE';
  if (a.status === 'NOT_DONE') return 'NOT_DONE';
  if (a.status === 'OVERDUE') return 'OVERDUE';
  if (a.status === 'NOT_ARRIVING') return 'NOT_ARRIVING';
  if (a.status === 'PENDING' && endTime && now > endTime) return 'OVERDUE';
  return 'PENDING';
};

const fmtTime = (iso) => (iso ? format(parseISO(iso), 'HH:mm') : '--:--');
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));


export default function EventTasksByRoleColumns({ eventId, event }) {
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['taskAssignments', 'status', eventId],
    queryFn: () => base44.entities.TaskAssignment.filter({ event_id: eventId }),
    initialData: [],
    enabled: !!eventId,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

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

  const queryClient = useQueryClient();

  const moveToBackupMutation = useMutation({
    mutationFn: async (employeeId) => {
      const employee = employees.find((e) => e.id === employeeId);
      if (!employee) throw new Error('לא נמצא העובד הראשי');
      return markUnavailableAndReassignToBackup({ event, employee, employees });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments', 'status', eventId] });
      const { reassigned = 0, cancelled = 0, escalationsRerouted = 0 } = data || {};
      const escSuffix = escalationsRerouted > 0 ? `, ${escalationsRerouted} אסקלציות הועברו אליו` : '';
      if (reassigned > 0) {
        toast.success(`${reassigned} משימות הועברו למבצע החלופי${cancelled > 0 ? `, ${cancelled} ללא חלופי סומנו "לא מגיע"` : ''}${escSuffix}`);
      } else if (cancelled > 0) {
        toast.warning(`אין מבצע חלופי זמין — ${cancelled} משימות סומנו "לא מגיע"${escSuffix}`);
      } else if (escalationsRerouted > 0) {
        toast.success(`${escalationsRerouted} אסקלציות הועברו למבצע החלופי`);
      } else {
        toast.info('לא נמצאו משימות פעילות להעברה');
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'שגיאה בהעברת המשימות');
    },
  });

  const handleMoveToBackup = (col) => {
    if (!col?.employeeId) return;
    const ok = window.confirm(
      `להעביר את משימות ${col.employeeName || 'העובד'} למבצע החלופי? ${col.employeeName || 'העובד'} יסומן כ"לא מגיע" לאירוע.`
    );
    if (ok) moveToBackupMutation.mutate(col.employeeId);
  };

  const columns = useMemo(() => {
    const roleMap = {};

    assignments.forEach(a => {
      // A task handed to a backup stays in its ORIGINAL owner's column — the
      // card just notes who it moved to. Group by the original assignee.
      const ownerId = a.original_assigned_to_id || a.assigned_to_id;
      const emp = employees.find(e => e.id === ownerId);
      const roleId = emp?.role_id || 'unassigned';
      const role = roles.find(r => r.id === roleId);
      const roleName = role?.role_name || emp?.role_name || 'ללא תפקיד';
      const employeeName = emp?.full_name || a.assigned_to_name || '';

      if (!roleMap[roleId]) {
        roleMap[roleId] = { name: roleName, employeeName, employeeId: ownerId || null, tasks: [] };
      }
      roleMap[roleId].tasks.push(a);
    });

    // A column can be moved to its backup when it has an identifiable primary
    // employee, at least one PENDING task that hasn't already been reassigned,
    // and some backup to hand it to — the employee-level backup ("עובד חלופי"
    // from the employees page) or a per-task backup role.
    Object.values(roleMap).forEach(col => {
      const emp = employees.find(e => e.id === col.employeeId);
      const movable = col.tasks.filter(t => t.status === 'PENDING' && !t.original_assigned_to_id);
      col.canMoveToBackup = !!col.employeeId && movable.length > 0 &&
        (!!emp?.backup_employee_id || movable.some(t => t.backup_role_id));
    });

    // Sort tasks by start_time within each role
    Object.values(roleMap).forEach(col => {
      col.tasks.sort((a, b) => {
        const tA = a.start_time ? new Date(a.start_time).getTime() : 0;
        const tB = b.start_time ? new Date(b.start_time).getTime() : 0;
        return tA - tB;
      });
    });

    return roleMap;
  }, [assignments, employees, roles]);

  const columnKeys = Object.keys(columns);

  const handlePrint = () => {
    const eventName = event?.event_name || '';
    const eventDate = event?.event_date ? format(parseISO(event.event_date), 'dd/MM/yyyy') : '';
    const eventTime = event?.event_time || '';
    const printedAt = format(new Date(), 'dd/MM/yyyy HH:mm');

    const columnsHtml = columnKeys.map(roleId => {
      const col = columns[roleId];
      if (!col) return '';

      const tasksHtml = col.tasks.map(task => {
        const status = computeStatus(task);
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
        const reminderHtml = task.last_notification_start_sent_at
          ? `<div class="meta blue">🔔 תזכורת נשלחה ב-${fmtTime(task.last_notification_start_sent_at)}</div>`
          : '';
        const escalationHtml = task.escalation_sent_at
          ? `<div class="meta orange">⬆ הועבר למנהל ב-${fmtTime(task.escalation_sent_at)}</div>`
          : '';
        const completedHtml = status === 'DONE' && task.completed_at
          ? `<div class="meta green">הושלם: ${format(parseISO(task.completed_at), 'dd/MM HH:mm')}</div>`
          : '';
        const descHtml = task.task_description
          ? `<div class="task-desc">${escapeHtml(task.task_description)}</div>`
          : '';
        return `
          <div class="task-card">
            <div class="task-header">
              <div class="task-title">${escapeHtml(task.task_title || '')}</div>
              <span class="badge" style="color:${cfg.color};background:${cfg.bg};">${cfg.label}</span>
            </div>
            ${descHtml}
            <div class="meta">🕒 ${fmtTime(task.start_time)} - ${fmtTime(task.end_time)}</div>
            ${reminderHtml}
            ${escalationHtml}
            ${completedHtml}
          </div>
        `;
      }).join('');

      return `
        <div class="column">
          <div class="column-header">
            <div class="role-name">${escapeHtml(col.name)}</div>
            ${col.employeeName ? `<div class="employee-name">${escapeHtml(col.employeeName)}</div>` : ''}
          </div>
          <div class="column-body">
            ${tasksHtml || '<div class="empty">אין משימות</div>'}
          </div>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>מעקב סטטוס לפי תפקיד - ${escapeHtml(eventName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, 'Heebo', sans-serif; direction: rtl; padding: 12mm; color: #1c1917; font-size: 11px; }
    .doc-header { border-bottom: 2px solid #1c1917; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .doc-title { font-size: 18px; font-weight: 900; }
    .doc-sub { font-size: 11px; color: #57534e; margin-top: 4px; }
    .doc-meta { font-size: 10px; color: #78716c; text-align: left; }
    .columns { display: flex; gap: 8px; flex-wrap: nowrap; align-items: flex-start; }
    .column { flex: 1 1 0; min-width: 0; border: 1px solid #d6d3d1; border-radius: 6px; overflow: hidden; }
    .column-header { background: #f5f5f4; padding: 8px; text-align: center; border-bottom: 1px solid #d6d3d1; }
    .role-name { font-weight: 700; font-size: 12px; color: #1c1917; }
    .employee-name { font-size: 10px; color: #78716c; margin-top: 2px; }
    .column-body { padding: 6px; background: #fafaf9; }
    .task-card { background: #fff; border: 1px solid #e7e5e4; border-radius: 5px; padding: 6px 8px; margin-bottom: 6px; page-break-inside: avoid; }
    .task-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 3px; }
    .task-title { font-weight: 600; font-size: 11px; line-height: 1.3; flex: 1; }
    .badge { font-size: 9px; padding: 1px 6px; border-radius: 8px; font-weight: 600; flex-shrink: 0; }
    .task-desc { font-size: 10px; color: #78716c; line-height: 1.3; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #57534e; line-height: 1.4; margin-top: 2px; }
    .meta.blue { color: #1d4ed8; }
    .meta.orange { color: #c2410c; }
    .meta.green { color: #15803d; }
    .empty { font-size: 10px; color: #a8a29e; text-align: center; padding: 12px 0; }
    @page { size: A4 landscape; margin: 8mm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="doc-title">מעקב סטטוס לפי תפקיד</div>
      <div class="doc-sub">${escapeHtml(eventName)}${eventDate ? ` | ${eventDate}` : ''}${eventTime ? ` | ${eventTime}` : ''}</div>
    </div>
    <div class="doc-meta">הופק: ${printedAt}</div>
  </div>
  <div class="columns">${columnsHtml}</div>
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 300); });
  </script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  if (assignmentsLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-stone-500">טוען משימות...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">


      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                מעקב סטטוס לפי תפקיד
              </CardTitle>
              <p className="text-sm text-stone-500 mt-1">מתעדכן אוטומטית כל 30 שניות</p>
            </div>
            {columnKeys.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="flex-shrink-0 gap-2"
              >
                <Printer className="w-4 h-4" />
                הדפס
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {columnKeys.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500">אין משימות לאירוע זה</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 pb-4">
              {columnKeys.map(roleId => {
                const col = columns[roleId];
                if (!col) return null;
                return (
                  <div key={roleId} className="min-w-[280px] max-w-[320px] flex-shrink-0">
                    <div className="bg-stone-100 rounded-t-lg px-4 py-3 border border-b-0 border-stone-200">
                      <div className="text-center">
                        <h3 className="font-bold text-stone-800 truncate">{col.name}</h3>
                        {col.employeeName && (
                          <p className="text-xs text-stone-500 truncate mt-0.5">{col.employeeName}</p>
                        )}
                      </div>
                      {col.canMoveToBackup && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                          disabled={moveToBackupMutation.isPending}
                          onClick={() => handleMoveToBackup(col)}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          העבר משימות לעובד חלופי
                        </Button>
                      )}
                    </div>
                    <div className="border border-t-0 border-stone-200 rounded-b-lg p-3 space-y-2 bg-stone-50 min-h-[200px] max-h-[70vh] overflow-y-auto">
                      {col.tasks.map(task => (
                        <EventTaskSummaryCard key={task.id} assignment={task} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}