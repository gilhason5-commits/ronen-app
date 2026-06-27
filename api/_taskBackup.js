// Core backup-reassignment logic shared by the WhatsApp "not coming" reply
// handler (api/whatsapp-reply.js) and the manual "move to backup" button
// endpoint (api/move-tasks-to-backup.js).
//
// Given an employee who is not coming to an event, each of their PENDING event
// tasks is either handed to the active employee filling the task's backup role,
// or — when no eligible backup exists — marked NOT_ARRIVING so the scheduler
// stops sending it. A backup who has themselves confirmed unavailable for the
// same event is skipped (single check, no chaining).
export async function reassignEventTasksToBackup(
  supabase,
  { eventId, employeeId, employeeName },
) {
  if (!eventId || !employeeId) {
    return { reassigned: 0, cancelled: 0, suppressManagerEscalation: false };
  }

  const { data: tasks } = await supabase
    .from("TaskAssignment")
    .select("id, task_title, assigned_to_id, assigned_to_name, backup_role_id")
    .eq("event_id", eventId)
    .eq("assigned_to_id", employeeId)
    .eq("status", "PENDING");

  if (!tasks?.length) {
    return { reassigned: 0, cancelled: 0, suppressManagerEscalation: false };
  }

  // Resolve each distinct backup role to its first active employee.
  const backupRoleIds = [...new Set(tasks.map((t) => t.backup_role_id).filter(Boolean))];
  const activeByRole = {};
  let unavailableBackupIds = new Set();

  if (backupRoleIds.length) {
    const { data: emps } = await supabase
      .from("TaskEmployee")
      .select("id, full_name, phone_e164, role_id")
      .in("role_id", backupRoleIds)
      .eq("is_active", true);

    for (const e of emps || []) {
      if (!activeByRole[e.role_id]) activeByRole[e.role_id] = e;
    }

    const candidateIds = Object.values(activeByRole).map((e) => e.id);
    if (candidateIds.length) {
      const { data: unavail } = await supabase
        .from("EmployeeDailyAvailability")
        .select("employee_id")
        .eq("event_id", eventId)
        .eq("confirmation_status", "CONFIRMED_UNAVAILABLE")
        .in("employee_id", candidateIds);
      unavailableBackupIds = new Set((unavail || []).map((r) => r.employee_id));
    }
  }

  let reassigned = 0;
  let cancelled = 0;

  await Promise.all(
    tasks.map(async (task) => {
      const backup = task.backup_role_id ? activeByRole[task.backup_role_id] : null;

      if (backup && !unavailableBackupIds.has(backup.id)) {
        await supabase
          .from("TaskAssignment")
          .update({
            assigned_to_id: backup.id,
            assigned_to_name: backup.full_name || "",
            assigned_to_phone: backup.phone_e164 || "",
            original_assigned_to_id: task.assigned_to_id,
            original_assigned_to_name: task.assigned_to_name || employeeName || "",
            last_notification_start_sent_at: null,
            last_notification_end_sent_at: null,
          })
          .eq("id", task.id)
          .eq("status", "PENDING");
        reassigned++;
        console.log(`↪️ Task ${task.id} (${task.task_title || "-"}) reassigned to backup ${backup.full_name}`);
      } else {
        await supabase
          .from("TaskAssignment")
          .update({
            status: "NOT_ARRIVING",
            last_notification_start_sent_at: null,
            last_notification_end_sent_at: null,
          })
          .eq("id", task.id)
          .eq("status", "PENDING");
        cancelled++;
      }
    }),
  );

  return { reassigned, cancelled, suppressManagerEscalation: cancelled === 0 };
}
