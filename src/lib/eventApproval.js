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

// Once an event is approved, purchasing/staffing are planned off its guest
// counts and its menu, so for everyone: the guest counts are frozen, and the
// serving type (which decides the whole menu) can no longer change.
export const GUEST_COUNT_FIELDS = ["guest_count", "children_count", "vegan_count", "glatt_count", "reserves", "total_guests"];
export const GUEST_COUNT_LOCKED_MSG = "האירוע אושר — לא ניתן לשנות כמות סועדים";
export const EVENT_TYPE_LOCKED_MSG = "האירוע אושר — לא ניתן לשנות סוג הגשה";

export function isGuestCountLocked(event) {
  return !!event?.producer_approved;
}

// Serving and flipped events use different menus (dishes are per event_type),
// so switching the type wipes the event's chosen dishes and their notes.
export async function clearEventMenu(eventId) {
  const [eventDishes, notes] = await Promise.all([
    base44.entities.Events_Dish.filter({ event_id: eventId }),
    base44.entities.EventDishNote.filter({ event_id: eventId }),
  ]);
  await Promise.all([
    ...eventDishes.map((d) => base44.entities.Events_Dish.delete(d.id)),
    ...notes.map((n) => base44.entities.EventDishNote.delete(n.id)),
  ]);
}
