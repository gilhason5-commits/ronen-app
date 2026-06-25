import { createClient } from "@supabase/supabase-js";
import { reassignEventTasksToBackup } from "./_taskBackup.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/move-tasks-to-backup  { eventId, employeeId }
 *
 * Manual trigger of the backup-reassignment flow from the per-event task board
 * ("העבר משימות לעובד חלופי" button on a role column). Marks the primary
 * employee as not coming for the event and hands their pending tasks to the
 * configured backup performer — the same logic the WhatsApp "not coming" reply
 * runs. Unlike the WhatsApp path it does not fire the office-manager escalation:
 * this is a deliberate action and backups already cover the absence.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { eventId, employeeId } = body;
    if (!eventId || !employeeId) {
      return res.status(400).json({ error: "eventId and employeeId are required" });
    }

    const [{ data: employee }, { data: event }] = await Promise.all([
      supabase.from("TaskEmployee").select("id, full_name").eq("id", employeeId).single(),
      supabase.from("Event").select("id, event_name, event_date").eq("id", eventId).single(),
    ]);

    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Mark the primary as not coming for this event (mirrors the WhatsApp reply
    // path) so the status is visible in the UI and the morning availability
    // flow won't re-ask. Upsert against any existing row for this event/date.
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase
      .from("EmployeeDailyAvailability")
      .select("id")
      .eq("event_id", eventId)
      .eq("employee_id", employeeId)
      .eq("event_date", event.event_date)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("EmployeeDailyAvailability")
        .update({
          confirmation_status: "CONFIRMED_UNAVAILABLE",
          confirmation_response_at: nowIso,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("EmployeeDailyAvailability").insert({
        event_id: eventId,
        employee_id: employeeId,
        employee_name: employee.full_name,
        event_date: event.event_date,
        confirmation_status: "CONFIRMED_UNAVAILABLE",
        confirmation_response_at: nowIso,
      });
    }

    const result = await reassignEventTasksToBackup(supabase, {
      eventId,
      employeeId,
      employeeName: employee.full_name,
    });

    console.log(
      `🔘 Manual move-to-backup for ${employee.full_name} @ ${event.event_name}: ${result.reassigned} reassigned, ${result.cancelled} marked NOT_ARRIVING`,
    );

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("move-tasks-to-backup error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
