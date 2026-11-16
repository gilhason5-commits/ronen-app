import { calculateStaffingGuestCount } from "@/lib/dinerCount";

// Station -> color mapping for the kitchen/cleaning weekly schedule, matching
// the color-coded paper sheet Ronen's team already uses (green = hot
// kitchen, light green = cold kitchen, pink = fish, purple = patisserie,
// blue = pot washing...). One solid fill per station spans the whole row —
// name cell and every day cell — the way the paper sheet does it; only the
// station label column in the far column stays neutral. A station typed in
// fresh via the roster UI that isn't in this fixed list falls back to a
// stable hash-based color so it still reads consistently without needing a
// code change.
const STATION_COLORS = {
  "מטבח חם": "bg-emerald-700 text-white",
  "מטבח קר": "bg-emerald-200 text-emerald-900",
  "אקסטרה": "bg-stone-200 text-stone-700",
  "דגים": "bg-rose-200 text-rose-900",
  "קונדיטוריה": "bg-purple-200 text-purple-900",
  "שטיפת סירים/ניקיון מטבח": "bg-sky-200 text-sky-900",
  "תפעול": "bg-white text-stone-900",
  "בר": "bg-blue-200 text-blue-900",
  "ניקיון": "bg-red-200 text-red-900",
  "מדיח": "bg-green-200 text-green-900",
};

const FALLBACK_PALETTE = [
  "bg-amber-200 text-amber-900",
  "bg-lime-200 text-lime-900",
  "bg-indigo-200 text-indigo-900",
  "bg-orange-200 text-orange-900",
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Tailwind bg+text classes for a station's row fill (name cell + every day cell). */
export function getStationColor(station) {
  if (STATION_COLORS[station]) return STATION_COLORS[station];
  return FALLBACK_PALETTE[hashString(station || "") % FALLBACK_PALETTE.length];
}

/** Every date (1st through the last day) of the month containing `month`. */
export function monthDates(month) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, m, i + 1));
}

export function toDateStr(d) {
  return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD, local time (not UTC)
}

// Turn digits-only shorthand into "HH:MM" so a shift time can be typed as
// plain numbers, e.g. "1615" -> "16:15", "915" -> "09:15", "8" -> "08:00".
// Anything already containing a colon (or empty) passes through unchanged.
// A shift time of 00:00 isn't a real clock-in/out — it's what happens when
// someone types "0000" (meant as "nothing"/off) or leaves stray zeros.
// Treat it the same as blank everywhere, both fresh entry and existing data.
const isZeroTime = (v) => v === "00:00";

export function formatTimeDigits(raw) {
  const trimmed = (raw || "").trim();
  if (isZeroTime(trimmed)) return "";
  if (!trimmed || trimmed.includes(":")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  let hour, minute;
  if (digits.length <= 2) {
    hour = digits;
    minute = "00";
  } else if (digits.length === 3) {
    hour = digits.slice(0, 1);
    minute = digits.slice(1);
  } else {
    hour = digits.slice(0, -2);
    minute = digits.slice(-2);
  }
  const result = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  return isZeroTime(result) ? "" : result;
}

// Pot-washing (שטיפת סירים) standard: arrival depends on the day's guest
// count (14:00 up to 100, 13:00 up to 200, 12:00 above 200); finish by 02:00,
// 03:00 on Thursdays. Every Sunday after a Friday event they come in at 11:00
// (event or not), and on a day marked "הכנות" in the day-name row at 10:00.
// Returns null for any other station, so its fixed default hours apply.
export function isPotWashStation(station) {
  return (station || "").includes("שטיפת סירים");
}

export function potWashDefaultHours({ date, guests, hasEvent, fridayHadEvent, dayLabel }) {
  const clockOut = date.getDay() === 4 ? "03:00" : "02:00";
  if ((dayLabel || "").includes("הכנות")) return { clockIn: "10:00", clockOut };
  if (date.getDay() === 0 && fridayHadEvent) return { clockIn: "11:00", clockOut };
  if (!hasEvent) return { clockIn: "", clockOut: "" };
  const clockIn = guests <= 100 ? "14:00" : guests <= 200 ? "13:00" : "12:00";
  return { clockIn, clockOut };
}

// Hours a kitchen/ops roster cell shows when nothing is saved for it — the
// staffing map's grid and the labour-cost report both use this. Fixed weekly
// hours (e.g. every Friday 07:00–11:00) win; then big-event hours on days
// with at least min_guests guests; pot washers follow their guest-count
// standard; everyone else gets their default hours on event days only.
//   eventDaySet: Set of YYYY-MM-DD with a (non-cancelled) event
//   guestsByDay: Map YYYY-MM-DD → staffing guest count
//   dayLabelOf:  YYYY-MM-DD → the day-name row label for this roster group
export function rosterDefaultHours(member, d, { eventDaySet, guestsByDay, dayLabelOf = () => undefined }) {
  const ds = toDateStr(d);
  const weekly = member.weekly_hours?.[d.getDay()];
  if (weekly) return { clockIn: weekly.in ?? "", clockOut: weekly.out ?? "" };
  const big = member.large_event_hours;
  if (big && eventDaySet.has(ds) && (guestsByDay.get(ds) || 0) >= big.min_guests) {
    return { clockIn: big.in ?? "", clockOut: big.out ?? "" };
  }
  if (isPotWashStation(member.station)) {
    const friday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 2);
    return potWashDefaultHours({
      date: d,
      guests: guestsByDay.get(ds) || 0,
      hasEvent: eventDaySet.has(ds),
      fridayHadEvent: eventDaySet.has(toDateStr(friday)),
      dayLabel: dayLabelOf(ds),
    });
  }
  if (!eventDaySet.has(ds)) return { clockIn: "", clockOut: "" };
  return { clockIn: member.default_clock_in ?? "", clockOut: member.default_clock_out ?? "" };
}

// Guest count used for every staffing/headcount figure — confirmed guests
// only (guest_count + children + vegan + glatt), NOT reserves, which are
// unconfirmed extra seats nobody should be staffed for in advance. Mirrors
// staffingEngine.js's guestsOf().
export function staffingGuestsOf(event) {
  if (event.guest_count != null) {
    return calculateStaffingGuestCount(event.guest_count, event.children_count, event.vegan_count, event.glatt_count);
  }
  return Number(event.total_guests) || 0;
}
