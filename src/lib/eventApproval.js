import { base44 } from "@/api/base44Client";
import { generateEventTasks, businessDaysUntilEvent, APPROVAL_MIN_BUSINESS_DAYS } from "@/lib/eventTaskGeneration";

export const APPROVAL_TOO_LATE_MSG = `נותרו פחות מ-${APPROVAL_MIN_BUSINESS_DAYS} ימי עסקים לאירוע — אנא אשר מול רונן`;
export const TASKS_FAILED_MSG = "האירוע אושר אך יצירת המשימות נכשלה — נסה לפתוח את עמוד משימות אירועים כדי להשלים";

export function isApprovalTooLate(event) {
  return businessDaysUntilEvent(event?.event_date) < APPROVAL_MIN_BUSINESS_DAYS;
}

// Marks the event approved and generates its tasks. Callers check who may
// approve and when. A task-generation failure doesn't roll back the approval —
// the PerEventTasks page still acts as a safety net for missing rows.
export async function approveEvent(event) {
  await base44.entities.Event.update(event.id, {
    producer_approved: true,
    status: "in_progress",
  });
  try {
    await generateEventTasks({ ...event, producer_approved: true });
    return { tasksFailed: false };
  } catch (taskErr) {
    console.error("Failed to generate event tasks on approval:", taskErr);
    return { tasksFailed: true };
  }
}
