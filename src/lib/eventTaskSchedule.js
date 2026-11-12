// Morning events (event_time < 14:00) follow a separate timing rule: the
// availability check fires at 07:30 with a one-hour response window, and any
// task whose computed start_time falls before 08:40 on the event day is
// pushed to 08:40. The 10-minute gap between the availability close (08:30)
// and the task floor avoids piling task reminders on top of the unavailable
// escalations to the office manager.

const MORNING_THRESHOLD_HOUR = 14;
const TASK_FLOOR_HHMM = '08:40';

export function isMorningEvent(eventTime) {
  if (!eventTime) return false;
  const [h] = String(eventTime).split(':').map(Number);
  return Number.isFinite(h) && h < MORNING_THRESHOLD_HOUR;
}

export function clampMorningEventTaskTimes(eventDate, eventTime, startTime, endTime) {
  if (!isMorningEvent(eventTime) || !eventDate) {
    return { startTime, endTime };
  }
  const floor = new Date(`${eventDate}T${TASK_FLOOR_HHMM}:00`);
  if (startTime >= floor) return { startTime, endTime };
  const delta = floor.getTime() - startTime.getTime();
  return {
    startTime: floor,
    endTime: new Date(endTime.getTime() + delta),
  };
}

// A PER_EVENT template can pin its start to a clock time on the event day
// (e.g. "16:30 family room check") instead of an offset from the event start.
// Stored in the existing schedule_rule column as JSON {"time":"HH:MM"} — the
// same shape recurring templates already use — so no schema change.
export function templateFixedTime(template) {
  if (!template?.schedule_rule) return null;
  try {
    const t = JSON.parse(template.schedule_rule)?.time;
    return /^\d{2}:\d{2}$/.test(t || '') ? t : null;
  } catch {
    return null;
  }
}

// Start/end of a template's task for one event. The fixed clock time only
// applies to evening events; a morning event falls back to the template's
// offset (an afternoon clock time makes no sense when the event is at 11:00).
export function computeTemplateTaskTimes(event, template) {
  const eventStart = new Date(`${event.event_date}T${event.event_time || '00:00'}`);
  const fixed = templateFixedTime(template);
  const rawStart = fixed && !isMorningEvent(event.event_time)
    ? new Date(`${event.event_date}T${fixed}:00`)
    : new Date(eventStart.getTime() + (template?.start_offset_minutes || 0) * 60000);
  const rawEnd = new Date(rawStart.getTime() + (template?.duration_minutes || 60) * 60000);
  return clampMorningEventTaskTimes(event.event_date, event.event_time, rawStart, rawEnd);
}
