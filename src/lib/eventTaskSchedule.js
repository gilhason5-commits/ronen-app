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
