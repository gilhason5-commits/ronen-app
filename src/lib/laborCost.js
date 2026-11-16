import { supabase } from "@/api/supabaseClient";
import { rosterDefaultHours, staffingGuestsOf, toDateStr } from "@/lib/kitchenSchedule";

// Labour cost for the reports page, at employer cost (TaskEmployee
// employer_cost_hourly × hours, or employer_cost_daily per day/event), from
// the staffing map's tables plus waiter attendance:
//   מלצרים — clocked attendance (EventShift)
//   פלור   — the floor staffing map (EventStaffingPlan) per event
//   מטבח / תפעול — the kitchen and ops tables (KitchenShift, or the cell's
//            default hours when nothing was saved — what the grid shows)
// Anyone without an hourly/daily employer cost is counted as missing, never
// guessed.

const PAGE_SIZE = 1000;

async function fetchPaged(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export function fetchEventShiftsInRange(fromDate, toDate) {
  return fetchPaged(() => supabase
    .from("EventShift")
    .select("id,event_id,event_date,worker_id,hours,clock_in,clock_out")
    .gte("event_date", fromDate).lte("event_date", toDate).order("id"));
}

export function fetchRosterShiftsInRange(fromDate, toDate) {
  return fetchPaged(() => supabase
    .from("KitchenShift")
    .select("member_id,shift_date,clock_in,clock_out")
    .gte("shift_date", fromDate).lte("shift_date", toDate).order("id"));
}

export function fetchDayNotesInRange(fromDate, toDate) {
  return fetchPaged(() => supabase
    .from("KitchenDayNote")
    .select("shift_date,roster_group,label")
    .gte("shift_date", fromDate).lte("shift_date", toDate).order("id"));
}

export async function fetchStaffingPlanForEvents(eventIds) {
  const rows = [];
  for (let i = 0; i < eventIds.length; i += 100) {
    const ids = eventIds.slice(i, i + 100);
    rows.push(...await fetchPaged(() => supabase
      .from("EventStaffingPlan")
      .select("id,event_id,assigned_employee_id,assigned_name,clock_in,clock_out")
      .in("event_id", ids).order("id")));
  }
  return rows;
}

const num = (v) => Number(v) || 0;
const TIME = /^(\d{1,2}):(\d{2})$/;

/** Hours between two HH:MM times (past midnight wraps); null if either isn't a time. */
export function hoursBetween(clockIn, clockOut) {
  const a = TIME.exec((clockIn || "").trim()), b = TIME.exec((clockOut || "").trim());
  if (!a || !b) return null;
  const mins = (+b[1] * 60 + +b[2]) - (+a[1] * 60 + +a[2]);
  return (mins < 0 ? mins + 1440 : mins) / 60;
}

/** Stored attendance hours, else clock-out − clock-in. */
export function shiftHours(s) {
  if (num(s.hours) > 0) return num(s.hours);
  return hoursBetween(s.clock_in, s.clock_out) || 0;
}

// Employer cost of one shift of `hours`, or null when the employee has none.
function employerCost(emp, hours) {
  if (num(emp?.employer_cost_hourly) > 0) return hours > 0 ? hours * num(emp.employer_cost_hourly) : null;
  if (num(emp?.employer_cost_daily) > 0) return num(emp.employer_cost_daily);
  return null;
}

const emptyLine = () => ({ total: 0, hours: 0, missing: new Set(), noHours: 0 });

function* daysBetween(fromDate, toDate) {
  const [y, m, d] = fromDate.split("-").map(Number);
  for (let day = new Date(y, m - 1, d); toDateStr(day) <= toDate; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    yield day;
  }
}

/**
 * periodEvents: the P&L's approved + completed events in the period.
 * allEvents: every event (the kitchen/ops default hours depend on which days
 * have an event and how many guests, like the staffing map).
 */
export function laborBreakdown({
  fromDate, toDate, periodEvents, allEvents, employeesById,
  shifts = [], planRows = [], members = [], rosterShifts = [], dayNotes = [],
  today = toDateStr(new Date()),
}) {
  const periodIds = new Set(periodEvents.map((e) => e.id));

  // מלצרים — attendance
  const waiters = emptyLine();
  const withAttendance = new Set();
  const attended = new Set();
  for (const s of shifts) {
    if (!periodIds.has(s.event_id)) continue;
    withAttendance.add(s.event_id);
    attended.add(`${s.event_id}|${s.worker_id}`);
    const h = shiftHours(s);
    if (h <= 0) continue;
    const cost = employerCost(employeesById[s.worker_id], h);
    if (cost == null) { waiters.missing.add(s.worker_id); continue; }
    waiters.total += cost;
    waiters.hours += h;
  }
  const noAttendance = periodEvents.filter((e) => e.event_date < today && !withAttendance.has(e.id)).length;

  // פלור — staffing map assignments (skip anyone already in attendance)
  const floor = emptyLine();
  for (const p of planRows) {
    if (!periodIds.has(p.event_id) || !p.assigned_employee_id) continue;
    if (attended.has(`${p.event_id}|${p.assigned_employee_id}`)) continue;
    const emp = employeesById[p.assigned_employee_id];
    const h = hoursBetween(p.clock_in, p.clock_out) || 0;
    const cost = employerCost(emp, h);
    if (cost == null) {
      if (num(emp?.employer_cost_hourly) > 0) floor.noHours += 1;
      else floor.missing.add(p.assigned_employee_id);
      continue;
    }
    floor.total += cost;
    floor.hours += h;
  }

  // מטבח / תפעול — the roster tables, day by day
  const live = allEvents.filter((e) => e.status !== "cancelled");
  const eventDaySet = new Set(live.map((e) => e.event_date));
  const guestsByDay = new Map();
  for (const e of live) guestsByDay.set(e.event_date, (guestsByDay.get(e.event_date) || 0) + staffingGuestsOf(e));
  const saved = new Map(rosterShifts.map((s) => [`${s.member_id}|${s.shift_date}`, s]));
  const labels = new Map(dayNotes.map((n) => [`${n.roster_group}|${n.shift_date}`, n.label]));
  const roster = { kitchen: emptyLine(), ops: emptyLine() };
  for (const d of daysBetween(fromDate, toDate)) {
    const ds = toDateStr(d);
    for (const m of members) {
      const group = m.roster_group || "kitchen";
      const line = roster[group];
      if (!line) continue;
      const row = saved.get(`${m.id}|${ds}`);
      if (!row && !m.is_active) continue;
      const { clockIn, clockOut } = row
        ? { clockIn: row.clock_in, clockOut: row.clock_out }
        : rosterDefaultHours(m, d, { eventDaySet, guestsByDay, dayLabelOf: (x) => labels.get(`${group}|${x}`) });
      if (!(clockIn || "").trim() && !(clockOut || "").trim()) continue; // day off
      const h = hoursBetween(clockIn, clockOut);
      if (h == null) { line.noHours += 1; continue; } // e.g. "END"
      const cost = employerCost(employeesById[m.employee_id], h);
      if (cost == null) { line.missing.add(m.id); continue; }
      line.total += cost;
      line.hours += h;
    }
  }

  const lines = { waiters, floor, kitchen: roster.kitchen, ops: roster.ops };
  const total = waiters.total + floor.total + roster.kitchen.total + roster.ops.total;
  return { total, lines, noAttendance };
}
