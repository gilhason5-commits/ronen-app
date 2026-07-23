import { base44 } from "@/api/base44Client";
import { clampMorningEventTaskTimes } from "@/lib/eventTaskSchedule";

// Shared event-task generation used by both the producer approval flow
// (fires immediately at approve time) and the PerEventTasks page (kept as a
// safety net for legacy approved events with no rows yet). Identical payload
// shape to the original in-component effect so existing scheduler/cron
// behaviour is unchanged — only the call site moved.
export async function generateEventTasks(event) {
  if (!event?.id || !event?.event_date) {
    return { created: 0, skipped: "missing event id/date" };
  }

  const [templatesAll, existingAssignments, allEmployees] = await Promise.all([
    base44.entities.TaskTemplate.list(),
    base44.entities.TaskAssignment.filter({ event_id: event.id }),
    base44.entities.TaskEmployee.list(),
  ]);

  const activeTemplates = (templatesAll || []).filter(
    (t) => t.task_type === "PER_EVENT" && t.is_active,
  );
  if (activeTemplates.length === 0) return { created: 0 };

  const existingTemplateIds = new Set(
    (existingAssignments || []).map((a) => a.task_template_id),
  );
  const templatesToCreate = activeTemplates.filter((t) => !existingTemplateIds.has(t.id));
  if (templatesToCreate.length === 0) return { created: 0 };

  const eventStartTime = new Date(`${event.event_date}T${event.event_time || "00:00"}`);

  const newAssignments = templatesToCreate.map((template) => {
    const rawStart = new Date(eventStartTime.getTime() + (template.start_offset_minutes || 0) * 60000);
    const rawEnd = new Date(rawStart.getTime() + (template.duration_minutes || 60) * 60000);
    const { startTime, endTime } = clampMorningEventTaskTimes(
      event.event_date,
      event.event_time,
      rawStart,
      rawEnd,
    );

    const roleEmployees = template.default_role
      ? (allEmployees || []).filter((e) => e.role_id === template.default_role && e.is_active)
      : [];

    const primaryEmployee = roleEmployees[0] || null;
    const additionalEmployees = roleEmployees.slice(1).map((emp) => ({
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_phone: emp.phone_e164 || "",
    }));

    const escalationEmployee = template.escalation_role_id
      ? (allEmployees || []).find((e) => e.role_id === template.escalation_role_id && e.is_active)
      : null;

    return {
      task_template_id: template.id,
      task_title: template.title,
      task_description: template.description,
      event_id: event.id,
      event_name: event.event_name,
      assigned_to_id: primaryEmployee?.id || null,
      assigned_to_name: primaryEmployee?.full_name || "",
      assigned_to_phone: primaryEmployee?.phone_e164 || "",
      additional_employees: additionalEmployees,
      computed_start_time: startTime.toISOString(),
      computed_end_time: endTime.toISOString(),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "PENDING",
      reminder_before_start_minutes: template.reminder_before_start_minutes || 10,
      reminder_before_end_minutes: template.reminder_before_end_minutes || 10,
      escalate_to_manager: template.escalate_to_manager_if_not_done || false,
      escalation_role_id: template.escalation_role_id || null,
      escalation_role_name: template.escalation_role_name || "",
      escalation_employee_id: escalationEmployee?.id || null,
      escalation_employee_name: escalationEmployee?.full_name || "",
      escalation_employee_phone: escalationEmployee?.phone_e164 || "",
      backup_role_id: template.backup_role_id || null,
      backup_role_name: template.backup_role_name || "",
      manager_id: primaryEmployee?.manager_id || null,
      manager_name: primaryEmployee?.manager_name || "",
      manager_phone: "",
      manually_overridden: false,
    };
  });

  await base44.entities.TaskAssignment.bulkCreate(newAssignments);
  return { created: newAssignments.length };
}

// Compute calendar-day distance between today (local) and an event_date
// string (YYYY-MM-DD). Positive when the event is in the future.
export function daysUntilEvent(eventDateStr) {
  if (!eventDateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(eventDateStr);
  eventDate.setHours(0, 0, 0, 0);
  return Math.floor((eventDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

// Approval is only allowed while at least this many days remain before the
// event. Once fewer days than this remain, it's too late to approve
// (worker/kitchen quantities must lock in before the last-minute crunch).
export const APPROVAL_MAX_DAYS_BEFORE = 4;
