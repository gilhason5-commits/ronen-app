import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight, ChevronLeft, Printer } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, isSameDay, isAfter, isBefore } from "date-fns";
import { he } from "date-fns/locale";
import EventTaskSummaryCard from "./EventTaskSummaryCard";

const STATUS_CONFIG = {
  PENDING: { color: "#1d4ed8", bg: "#dbeafe", label: "ממתין" },
  DONE: { color: "#15803d", bg: "#dcfce7", label: "בוצע" },
  NOT_DONE: { color: "#b91c1c", bg: "#fee2e2", label: "לא בוצע" },
  OVERDUE: { color: "#c2410c", bg: "#ffedd5", label: "באיחור" },
  NOT_ARRIVING: { color: "#a16207", bg: "#fef9c3", label: "לא מגיע" },
};

const computeStatus = (a) => {
  const now = new Date();
  const endTime = a.end_time ? new Date(a.end_time) : null;
  if (a.status === "DONE") return "DONE";
  if (a.status === "NOT_DONE") return "NOT_DONE";
  if (a.status === "OVERDUE") return "OVERDUE";
  if (a.status === "NOT_ARRIVING") return "NOT_ARRIVING";
  if (a.status === "PENDING" && endTime && now > endTime) return "OVERDUE";
  return "PENDING";
};

const fmtTime = (iso) => (iso ? format(parseISO(iso), "HH:mm") : "--:--");
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

export default function RecurringTasksDailySummary() {
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  const { data: employees = [] } = useQuery({
    queryKey: ["taskEmployees"],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const pvEmployeeIds = useMemo(() => {
    return new Set(employees.filter((e) => e.department_name === "פטי וור").map((e) => e.id));
  }, [employees]);

  const { data: assignments = [] } = useQuery({
    queryKey: ["taskAssignments", "RECURRING", [...pvEmployeeIds]],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.list("-start_time", 500);
      return data.filter((a) => !a.event_id && !pvEmployeeIds.has(a.assigned_to_id));
    },
    initialData: [],
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["employeeRoles"],
    queryFn: () => base44.entities.EmployeeRole.list(),
    initialData: [],
  });

  const today = useMemo(() => startOfDay(new Date()), []);
  const minDay = useMemo(() => subDays(today, 30), [today]);

  const canGoPrev = isAfter(selectedDay, minDay);
  const canGoNext = isBefore(selectedDay, today);

  const goPrev = () => {
    if (canGoPrev) setSelectedDay((d) => subDays(d, 1));
  };
  const goNext = () => {
    if (canGoNext) setSelectedDay((d) => addDays(d, 1));
  };

  const employeeGroups = useMemo(() => {
    const dayStart = startOfDay(selectedDay);
    const dayEnd = endOfDay(selectedDay);

    const dayAssignments = assignments.filter((a) => {
      if (!a.start_time) return false;
      const t = new Date(a.start_time);
      return t >= dayStart && t <= dayEnd;
    });

    const byEmployee = {};
    dayAssignments.forEach((a) => {
      const empId = a.assigned_to_id || "unassigned";
      if (!byEmployee[empId]) {
        const emp = employees.find((e) => e.id === a.assigned_to_id);
        const role = emp?.role_id ? roles.find((r) => r.id === emp.role_id) : null;
        byEmployee[empId] = {
          empId,
          name: emp?.full_name || a.assigned_to_name || "ללא הקצאה",
          roleName: role?.role_name || emp?.role_name || "",
          tasks: [],
        };
      }
      byEmployee[empId].tasks.push(a);
    });

    Object.values(byEmployee).forEach((group) => {
      group.tasks.sort((a, b) => {
        const tA = a.start_time ? new Date(a.start_time).getTime() : 0;
        const tB = b.start_time ? new Date(b.start_time).getTime() : 0;
        return tA - tB;
      });
    });

    return Object.values(byEmployee).sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [assignments, employees, roles, selectedDay]);

  const dayLabel = format(selectedDay, "EEEE, d בMMMM yyyy", { locale: he });
  const isToday = isSameDay(selectedDay, today);

  const handlePrint = () => {
    const printedAt = format(new Date(), "dd/MM/yyyy HH:mm");

    const employeeBlocks = employeeGroups
      .map((group) => {
        const taskRows = group.tasks
          .map((task) => {
            const status = computeStatus(task);
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
            const completedHtml =
              status === "DONE" && task.completed_at
                ? `<span class="completed">הושלם ב-${fmtTime(task.completed_at)}</span>`
                : "";
            return `
              <tr>
                <td class="task-title">${escapeHtml(task.task_title || "-")}</td>
                <td class="task-time">${fmtTime(task.start_time)} - ${fmtTime(task.end_time)}</td>
                <td class="task-status">
                  <span class="badge" style="color:${cfg.color};background:${cfg.bg};">${cfg.label}</span>
                  ${completedHtml}
                </td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="employee-block">
            <div class="employee-header">
              <span class="employee-name">${escapeHtml(group.name)}</span>
              ${group.roleName ? `<span class="employee-role">· ${escapeHtml(group.roleName)}</span>` : ""}
              <span class="employee-count">${group.tasks.length} משימות</span>
            </div>
            <table class="task-table">
              <thead>
                <tr>
                  <th>משימה</th>
                  <th class="col-time">שעות</th>
                  <th class="col-status">סטטוס</th>
                </tr>
              </thead>
              <tbody>${taskRows}</tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const bodyHtml = employeeGroups.length
      ? employeeBlocks
      : '<div class="empty">אין משימות שוטפות ליום זה</div>';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>סיכום יומי של משימות - ${escapeHtml(dayLabel)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, 'Heebo', sans-serif; direction: rtl; padding: 12mm; color: #1c1917; font-size: 12px; }
    .doc-header { border-bottom: 2px solid #1c1917; padding-bottom: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .doc-title { font-size: 20px; font-weight: 900; }
    .doc-sub { font-size: 12px; color: #57534e; margin-top: 4px; }
    .doc-meta { font-size: 10px; color: #78716c; text-align: left; }
    .employee-block { margin-bottom: 14px; page-break-inside: avoid; }
    .employee-header { background: #f5f5f4; padding: 8px 12px; border: 1px solid #d6d3d1; border-bottom: none; border-radius: 4px 4px 0 0; display: flex; align-items: baseline; gap: 6px; }
    .employee-name { font-weight: 700; font-size: 13px; }
    .employee-role { color: #78716c; font-size: 11px; }
    .employee-count { margin-right: auto; color: #78716c; font-size: 10px; }
    .task-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #d6d3d1; }
    .task-table th { background: #fafaf9; padding: 6px 10px; text-align: right; border-bottom: 1px solid #d6d3d1; font-weight: 600; }
    .task-table td { padding: 6px 10px; border-bottom: 1px solid #e7e5e4; }
    .task-table tr:last-child td { border-bottom: none; }
    .col-time { width: 110px; }
    .col-status { width: 180px; }
    .task-title { font-weight: 500; }
    .task-time { color: #57534e; white-space: nowrap; }
    .task-status { white-space: nowrap; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 600; display: inline-block; }
    .completed { font-size: 10px; color: #15803d; margin-right: 6px; }
    .empty { text-align: center; padding: 40px; color: #a8a29e; font-size: 13px; }
    @page { size: A4 portrait; margin: 10mm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="doc-title">סיכום יומי של משימות שוטפות</div>
      <div class="doc-sub">${escapeHtml(dayLabel)}</div>
    </div>
    <div class="doc-meta">הופק: ${printedAt}</div>
  </div>
  ${bodyHtml}
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 300); });
  </script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              סיכום יומי של משימות
            </CardTitle>
            <p className="text-sm text-stone-500 mt-1">
              מי קיבל אילו משימות באותו יום והאם הושלמו
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={goPrev}
                disabled={!canGoPrev}
                title="יום קודם"
                className="h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <div className="text-sm font-semibold text-stone-700 min-w-[200px] text-center">
                {dayLabel}
                {isToday && <span className="text-xs text-stone-400 mr-1">(היום)</span>}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={goNext}
                disabled={!canGoNext}
                title="יום הבא"
                className="h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2"
              disabled={employeeGroups.length === 0}
            >
              <Printer className="w-4 h-4" />
              הדפס
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {employeeGroups.length === 0 ? (
          <div className="text-center py-10 text-stone-500">אין משימות שוטפות ליום זה</div>
        ) : (
          <div className="space-y-5">
            {employeeGroups.map((group) => (
              <div key={group.empId}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-bold text-stone-800">{group.name}</span>
                  {group.roleName && (
                    <span className="text-sm text-stone-500">· {group.roleName}</span>
                  )}
                  <span className="text-xs text-stone-400 mr-auto">
                    {group.tasks.length} משימות
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {group.tasks.map((task) => (
                    <EventTaskSummaryCard key={task.id} assignment={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
