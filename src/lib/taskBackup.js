import { base44 } from "@/api/base44Client";

// Client-side backup reassignment for the manual "move to backup" button on the
// event task board. Mirrors the server copy in api/_taskBackup.js (used by the
// WhatsApp "not coming" reply path). It lives client-side because the Vercel
// Hobby plan caps a deployment at 12 serverless functions and the project is
// already at the limit — a dedicated endpoint would fail the deploy.
//
// Marks the primary employee as not coming for the event, then hands each of
// their pending tasks to the active employee filling the task's backup role, or
// marks it NOT_ARRIVING when no eligible backup exists.
export async function markUnavailableAndReassignToBackup({ event, employee, employees }) {
  if (!event?.id || !employee?.id) return { reassigned: 0, cancelled: 0 };

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

  // 2. Reassign their pending event tasks.
  const tasks = await base44.entities.TaskAssignment.filter({
    event_id: event.id,
    assigned_to_id: employee.id,
    status: "PENDING",
  });
  if (!tasks?.length) return { reassigned: 0, cancelled: 0 };

  // Backup role -> first active employee filling it.
  const activeByRole = {};
  for (const e of employees || []) {
    if (e.is_active && e.role_id && !activeByRole[e.role_id]) activeByRole[e.role_id] = e;
  }

  // Backups who already confirmed unavailable for this event are skipped. The
  // primary we just marked above is in this set, so a backup role that resolves
  // back to the primary correctly falls through to NOT_ARRIVING.
  const unavailRecords = await base44.entities.EmployeeDailyAvailability.filter({
    event_id: event.id,
    confirmation_status: "CONFIRMED_UNAVAILABLE",
  });
  const unavailableBackupIds = new Set((unavailRecords || []).map((r) => r.employee_id));

  let reassigned = 0;
  let cancelled = 0;

  await Promise.all(
    tasks.map(async (task) => {
      const backup = task.backup_role_id ? activeByRole[task.backup_role_id] : null;

      if (backup && !unavailableBackupIds.has(backup.id)) {
        await base44.entities.TaskAssignment.update(task.id, {
          assigned_to_id: backup.id,
          assigned_to_name: backup.full_name || "",
          assigned_to_phone: backup.phone_e164 || "",
          original_assigned_to_id: task.assigned_to_id,
          original_assigned_to_name: task.assigned_to_name || employee.full_name || "",
          last_notification_start_sent_at: null,
          last_notification_end_sent_at: null,
        });
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

  return { reassigned, cancelled };
}
