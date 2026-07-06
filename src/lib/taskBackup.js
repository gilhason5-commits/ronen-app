import { base44 } from "@/api/base44Client";

// Client-side backup reassignment for the manual "move to backup" button on the
// event task board. Mirrors the server copy in api/_taskBackup.js (used by the
// WhatsApp "not coming" reply path). It lives client-side because the Vercel
// Hobby plan caps a deployment at 12 serverless functions and the project is
// already at the limit — a dedicated endpoint would fail the deploy.
//
// Marks the primary employee as not coming for the event, then hands their
// pending tasks and any unsent escalations that pointed at them to their
// backup. Backup resolution order matches the server: the employee-level
// backup ("עובד חלופי" from the employees page) first, then the task's
// template backup_role as fallback. Tasks with no eligible backup are marked
// NOT_ARRIVING.
export async function markUnavailableAndReassignToBackup({ event, employee, employees }) {
  if (!event?.id || !employee?.id) return { reassigned: 0, cancelled: 0, escalationsRerouted: 0 };

  const nowIso = new Date().toISOString();

  // 1. Mark the primary as not coming for this event (upsert by event/date).
  const existing = await base44.entities.EmployeeDailyAvailability.filter({
    event_id: event.id,
    employee_id: employee.id,
    event_date: event.event_date,
  });
  if (existing?.length) {
    await base44.entities.EmployeeDailyAvailability.update(existing[0].id, {
      confirmation_status: "CONFIRMED_UNAVAILABLE",
      confirmation_response_at: nowIso,
    });
  } else {
    await base44.entities.EmployeeDailyAvailability.create({
      event_id: event.id,
      employee_id: employee.id,
      employee_name: employee.full_name,
      event_date: event.event_date,
      confirmation_status: "CONFIRMED_UNAVAILABLE",
      confirmation_response_at: nowIso,
    });
  }

  // Backups who already confirmed unavailable for this event are skipped. The
  // primary we just marked above is in this set, so a backup that resolves
  // back to the primary correctly falls through to NOT_ARRIVING.
  const unavailRecords = await base44.entities.EmployeeDailyAvailability.filter({
    event_id: event.id,
    confirmation_status: "CONFIRMED_UNAVAILABLE",
  });
  const unavailableBackupIds = new Set((unavailRecords || []).map((r) => r.employee_id));

  // Employee-level backup, vetted for activity/self/availability.
  const configured = employee.backup_employee_id
    ? (employees || []).find((e) => e.id === employee.backup_employee_id)
    : null;
  const employeeBackup =
    configured &&
    configured.is_active &&
    configured.id !== employee.id &&
    !unavailableBackupIds.has(configured.id)
      ? configured
      : null;

  // 2. Reassign their pending event tasks.
  const tasks = await base44.entities.TaskAssignment.filter({
    event_id: event.id,
    assigned_to_id: employee.id,
    status: "PENDING",
  });

  // Fallback: backup role -> first active employee filling it.
  const activeByRole = {};
  for (const e of employees || []) {
    if (e.is_active && e.role_id && !activeByRole[e.role_id]) activeByRole[e.role_id] = e;
  }

  let reassigned = 0;
  let cancelled = 0;

  await Promise.all(
    (tasks || []).map(async (task) => {
      const roleBackup = task.backup_role_id ? activeByRole[task.backup_role_id] : null;
      const backup =
        employeeBackup ||
        (roleBackup && !unavailableBackupIds.has(roleBackup.id) ? roleBackup : null);

      if (backup) {
        // Two-row handoff: the original stays on the absent employee as
        // NOT_ARRIVING (with who covered it), and the backup gets a linked
        // PENDING copy that carries the normal reminder/escalation lifecycle.
        await base44.entities.TaskAssignment.update(task.id, {
          status: "NOT_ARRIVING",
          covered_by_backup_id: backup.id,
          covered_by_backup_name: backup.full_name || "",
          last_notification_start_sent_at: null,
          last_notification_end_sent_at: null,
        });
        const copy = { ...task };
        delete copy.id;
        delete copy.created_date;
        delete copy.updated_date;
        Object.assign(copy, {
          assigned_to_id: backup.id,
          assigned_to_name: backup.full_name || "",
          assigned_to_phone: backup.phone_e164 || "",
          original_assigned_to_id: task.assigned_to_id,
          original_assigned_to_name: task.assigned_to_name || employee.full_name || "",
          copied_from_task_id: task.id,
          covered_by_backup_id: null,
          covered_by_backup_name: null,
          status: "PENDING",
          completed_at: null,
          escalation_sent_at: null,
          last_notification_start_sent_at: null,
          last_notification_end_sent_at: null,
        });
        await base44.entities.TaskAssignment.create(copy);
        reassigned++;
      } else {
        await base44.entities.TaskAssignment.update(task.id, {
          status: "NOT_ARRIVING",
          last_notification_start_sent_at: null,
          last_notification_end_sent_at: null,
        });
        cancelled++;
      }
    }),
  );

  // 3. Reroute unsent escalations that target this employee. Prefer the
  // employee-level backup; fall back to whoever took over the tasks (the
  // active employee filling the most common backup role among them).
  let escalationBackup = employeeBackup;
  if (!escalationBackup) {
    const roleCounts = {};
    for (const t of tasks || []) {
      if (t.backup_role_id) roleCounts[t.backup_role_id] = (roleCounts[t.backup_role_id] || 0) + 1;
    }
    const topRoleId = Object.keys(roleCounts).sort((a, b) => roleCounts[b] - roleCounts[a])[0];
    const candidate = topRoleId ? activeByRole[topRoleId] : null;
    if (candidate && candidate.id !== employee.id && !unavailableBackupIds.has(candidate.id)) {
      escalationBackup = candidate;
    }
  }

  let escalationsRerouted = 0;
  if (escalationBackup) {
    const escCandidates = await base44.entities.TaskAssignment.filter({
      event_id: event.id,
      escalation_employee_id: employee.id,
    });
    const escTasks = (escCandidates || []).filter(
      (t) =>
        !t.escalation_sent_at &&
        !t.original_escalation_employee_id &&
        (t.status === "PENDING" || t.status === "OVERDUE"),
    );

    await Promise.all(
      escTasks.map(async (task) => {
        await base44.entities.TaskAssignment.update(task.id, {
          escalation_employee_id: escalationBackup.id,
          escalation_employee_name: escalationBackup.full_name || "",
          escalation_employee_phone: escalationBackup.phone_e164 || "",
          original_escalation_employee_id: task.escalation_employee_id,
          original_escalation_employee_name: task.escalation_employee_name || "",
          original_escalation_employee_phone: task.escalation_employee_phone || "",
        });
        escalationsRerouted++;
      }),
    );
  }

  return { reassigned, cancelled, escalationsRerouted };
}
