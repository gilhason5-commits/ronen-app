// Core backup-reassignment logic shared by the WhatsApp "not coming" reply
// handler (api/whatsapp-reply.js) and the manual "move to backup" button
// (client-side mirror in src/lib/taskBackup.js).
//
// Backup resolution order, for both event tasks and Peti Vor recurring tasks:
//   1. The employee-level backup ("עובד חלופי") configured on the employee's
//      row in the employees page — receives ALL the leaving employee's tasks
//      and any task escalations that pointed at them.
//   2. Fallbacks when unset: the task's template backup_role (event tasks) or
//      the per-assignment backup_employee (Peti Vor tasks).
// A backup who is inactive or has themselves confirmed unavailable for the
// same event/day is skipped (single check, no chaining). Tasks with no
// eligible backup are marked NOT_ARRIVING so the scheduler stops sending them.

// Resolve the employee-level backup for an employee, or null when unset /
// inactive / self / unavailable for the same event (eventId) or day
// (eventDate with event_id IS NULL — the Peti Vor availability shape).
export async function fetchEmployeeLevelBackup(supabase, { employeeId, eventId, eventDate }) {
  const { data: employee } = await supabase
    .from("TaskEmployee")
    .select("backup_employee_id")
    .eq("id", employeeId)
    .single();

  const backupId = employee?.backup_employee_id;
  if (!backupId || backupId === employeeId) return null;

  const { data: backup } = await supabase
    .from("TaskEmployee")
    .select("id, full_name, phone_e164, is_active")
    .eq("id", backupId)
    .single();

  if (!backup?.is_active) return null;

  let unavailQuery = supabase
    .from("EmployeeDailyAvailability")
    .select("id")
    .eq("employee_id", backupId)
    .eq("confirmation_status", "CONFIRMED_UNAVAILABLE");
  if (eventId) {
    unavailQuery = unavailQuery.eq("event_id", eventId);
  } else {
    unavailQuery = unavailQuery.is("event_id", null).eq("event_date", eventDate);
  }
  const { data: unavail } = await unavailQuery.limit(1);
  if (unavail?.length) return null;

  return backup;
}

export async function reassignEventTasksToBackup(
  supabase,
  { eventId, employeeId, employeeName },
) {
  if (!eventId || !employeeId) {
    return { reassigned: 0, cancelled: 0, escalationsRerouted: 0, suppressManagerEscalation: false };
  }

  const employeeBackup = await fetchEmployeeLevelBackup(supabase, { employeeId, eventId });

  // All of the leaving employee's tasks in this event: the PENDING ones get
  // reassigned, and the full set (any status) feeds the fallback derivation of
  // the escalation backup when no employee-level backup is configured.
  const { data: allTasks } = await supabase
    .from("TaskAssignment")
    .select("id, task_title, assigned_to_id, assigned_to_name, backup_role_id, status")
    .eq("event_id", eventId)
    .eq("assigned_to_id", employeeId);

  const tasks = (allTasks || []).filter((t) => t.status === "PENDING");

  // Fallback machinery: resolve each distinct backup role to its first active
  // employee (only needed for tasks the employee-level backup doesn't cover).
  const backupRoleIds = [...new Set((allTasks || []).map((t) => t.backup_role_id).filter(Boolean))];
  const activeByRole = {};
  let unavailableBackupIds = new Set();

  if (!employeeBackup && backupRoleIds.length) {
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
      const roleBackup = task.backup_role_id ? activeByRole[task.backup_role_id] : null;
      const backup =
        employeeBackup ||
        (roleBackup && !unavailableBackupIds.has(roleBackup.id) ? roleBackup : null);

      if (backup) {
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

  const escalationBackup =
    employeeBackup || pickEscalationBackup(allTasks, activeByRole, unavailableBackupIds, employeeId);
  const escalationsRerouted = escalationBackup
    ? await rerouteEscalationsToBackup(supabase, { eventId, employeeId, backup: escalationBackup })
    : 0;

  return {
    reassigned,
    cancelled,
    escalationsRerouted,
    suppressManagerEscalation: tasks.length > 0 && cancelled === 0,
  };
}

// A Peti Vor / recurring (event_id IS NULL) employee marked unavailable for the
// day. Each of that day's PENDING recurring tasks is handed to the backup
// (employee-level first, then the per-assignment backup_employee), or marked
// NOT_ARRIVING when there's no eligible backup. Escalations on that day's
// recurring tasks that point at the absent employee move to their
// employee-level backup as well. No restore is needed — the next occurrence is
// a separate row already assigned to the primary.
export async function reassignRecurringTasksToBackup(supabase, record) {
  if (!record.employee_id || !record.event_date) {
    return { reassigned: 0, cancelled: 0, escalationsRerouted: 0, suppressManagerEscalation: false };
  }

  const dayStartIso = new Date(`${record.event_date}T00:00:00`).toISOString();
  const dayEndIso = new Date(`${record.event_date}T23:59:59`).toISOString();
  const dayRange = { startIso: dayStartIso, endIso: dayEndIso };

  const employeeBackup = await fetchEmployeeLevelBackup(supabase, {
    employeeId: record.employee_id,
    eventDate: record.event_date,
  });

  const { data: tasks } = await supabase
    .from("TaskAssignment")
    .select("id, task_title, assigned_to_id, assigned_to_name, backup_employee_id, backup_employee_name, backup_employee_phone")
    .eq("assigned_to_id", record.employee_id)
    .eq("status", "PENDING")
    .is("event_id", null)
    .gte("start_time", dayStartIso)
    .lte("start_time", dayEndIso);

  // Per-assignment backups who already confirmed unavailable for this same day
  // must not receive the work (the employee-level backup was already vetted).
  const backupIds = [...new Set((tasks || []).map((t) => t.backup_employee_id).filter(Boolean))];
  let unavailableBackupIds = new Set();
  if (!employeeBackup && backupIds.length) {
    const { data: unavail } = await supabase
      .from("EmployeeDailyAvailability")
      .select("employee_id")
      .is("event_id", null)
      .eq("event_date", record.event_date)
      .eq("confirmation_status", "CONFIRMED_UNAVAILABLE")
      .in("employee_id", backupIds);
    unavailableBackupIds = new Set((unavail || []).map((r) => r.employee_id));
  }

  let reassigned = 0;
  let cancelled = 0;

  await Promise.all(
    (tasks || []).map(async (task) => {
      const assignmentBackup =
        task.backup_employee_id && !unavailableBackupIds.has(task.backup_employee_id)
          ? { id: task.backup_employee_id, full_name: task.backup_employee_name, phone_e164: task.backup_employee_phone }
          : null;
      const backup = employeeBackup || assignmentBackup;

      if (backup) {
        await supabase
          .from("TaskAssignment")
          .update({
            assigned_to_id: backup.id,
            assigned_to_name: backup.full_name || "",
            assigned_to_phone: backup.phone_e164 || "",
            original_assigned_to_id: task.assigned_to_id,
            original_assigned_to_name: task.assigned_to_name || record.employee_name || "",
            last_notification_start_sent_at: null,
            last_notification_end_sent_at: null,
          })
          .eq("id", task.id)
          .eq("status", "PENDING");
        reassigned++;
        console.log(`↪️ Recurring task ${task.id} (${task.task_title || "-"}) reassigned to backup ${backup.full_name}`);
      } else {
        await supabase
          .from("TaskAssignment")
          .update({ status: "NOT_ARRIVING" })
          .eq("id", task.id)
          .eq("status", "PENDING");
        cancelled++;
      }
    }),
  );

  const escalationsRerouted = employeeBackup
    ? await rerouteEscalationsToBackup(supabase, {
        dayRange,
        employeeId: record.employee_id,
        backup: employeeBackup,
      })
    : 0;

  console.log(
    `🔁 Recurring for ${record.employee_name || record.employee_id}: ${reassigned} reassigned to backup, ${cancelled} marked NOT_ARRIVING, ${escalationsRerouted} escalation(s) rerouted`,
  );

  return {
    reassigned,
    cancelled,
    escalationsRerouted,
    suppressManagerEscalation: (tasks || []).length > 0 && cancelled === 0,
  };
}

// Fallback escalation backup when no employee-level backup exists: whoever
// steps into the leaving employee's shoes — the active employee filling the
// most common backup role across their tasks.
export function pickEscalationBackup(allTasks, activeByRole, unavailableBackupIds, employeeId) {
  const roleCounts = {};
  for (const t of allTasks || []) {
    if (t.backup_role_id) roleCounts[t.backup_role_id] = (roleCounts[t.backup_role_id] || 0) + 1;
  }
  const topRoleId = Object.keys(roleCounts).sort((a, b) => roleCounts[b] - roleCounts[a])[0];
  const backup = topRoleId ? activeByRole[topRoleId] : null;
  if (!backup || backup.id === employeeId || unavailableBackupIds.has(backup.id)) return null;
  return backup;
}

// Repoint every unsent escalation that targets the leaving employee (PENDING,
// or OVERDUE that the scheduler hasn't alerted on yet) to the backup, keeping
// the original target in original_escalation_employee_*. Scope is either one
// event ({ eventId }) or one day of recurring tasks ({ dayRange }). Rows
// already rerouted keep their first snapshot (no double-reroute).
export async function rerouteEscalationsToBackup(supabase, { eventId, dayRange, employeeId, backup }) {
  let query = supabase
    .from("TaskAssignment")
    .select("id, escalation_employee_id, escalation_employee_name, escalation_employee_phone")
    .eq("escalation_employee_id", employeeId)
    .is("escalation_sent_at", null)
    .is("original_escalation_employee_id", null)
    .in("status", ["PENDING", "OVERDUE"]);
  if (eventId) {
    query = query.eq("event_id", eventId);
  } else {
    query = query
      .is("event_id", null)
      .gte("start_time", dayRange.startIso)
      .lte("start_time", dayRange.endIso);
  }
  const { data: escTasks } = await query;

  if (!escTasks?.length) return 0;

  await Promise.all(
    escTasks.map((task) =>
      supabase
        .from("TaskAssignment")
        .update({
          escalation_employee_id: backup.id,
          escalation_employee_name: backup.full_name || "",
          escalation_employee_phone: backup.phone_e164 || "",
          original_escalation_employee_id: task.escalation_employee_id,
          original_escalation_employee_name: task.escalation_employee_name || "",
          original_escalation_employee_phone: task.escalation_employee_phone || "",
        })
        .eq("id", task.id)
        .is("escalation_sent_at", null),
    ),
  );

  console.log(`⤴️ ${escTasks.length} escalation(s) rerouted to backup ${backup.full_name}`);
  return escTasks.length;
}

// Symmetric undo for the escalation reroute (event scope only — Peti Vor has
// no restore): hand every escalation that was moved off this employee back to
// them. Escalations already sent are left as they are.
export async function restoreEscalationReroutes(supabase, { eventId, employeeId }) {
  const { data: escTasks } = await supabase
    .from("TaskAssignment")
    .select("id, original_escalation_employee_id, original_escalation_employee_name, original_escalation_employee_phone")
    .eq("event_id", eventId)
    .eq("original_escalation_employee_id", employeeId)
    .is("escalation_sent_at", null);

  if (!escTasks?.length) return 0;

  await Promise.all(
    escTasks.map((task) =>
      supabase
        .from("TaskAssignment")
        .update({
          escalation_employee_id: task.original_escalation_employee_id,
          escalation_employee_name: task.original_escalation_employee_name || "",
          escalation_employee_phone: task.original_escalation_employee_phone || "",
          original_escalation_employee_id: null,
          original_escalation_employee_name: null,
          original_escalation_employee_phone: null,
        })
        .eq("id", task.id),
    ),
  );

  console.log(`⤵️ ${escTasks.length} escalation(s) restored to original target for event ${eventId}`);
  return escTasks.length;
}
