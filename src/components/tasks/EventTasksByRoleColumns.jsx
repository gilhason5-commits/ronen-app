import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users } from "lucide-react";
import EventTaskSummaryCard from "./EventTaskSummaryCard";


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

  const columns = useMemo(() => {
    const roleMap = {};

    assignments.forEach(a => {
      // Find the employee to get role info
      const emp = employees.find(e => e.id === a.assigned_to_id);
      const roleId = emp?.role_id || 'unassigned';
      const role = roles.find(r => r.id === roleId);
      const roleName = role?.role_name || emp?.role_name || 'ללא תפקיד';
      const employeeName = emp?.full_name || a.assigned_to_name || '';

      if (!roleMap[roleId]) {
        roleMap[roleId] = { name: roleName, employeeName, tasks: [] };
      }
      roleMap[roleId].tasks.push(a);
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
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            מעקב סטטוס לפי תפקיד
          </CardTitle>
          <p className="text-sm text-stone-500 mt-1">מתעדכן אוטומטית כל 30 שניות</p>
        </CardHeader>
        <CardContent>
          {columnKeys.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500">אין משימות לאירוע זה</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
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