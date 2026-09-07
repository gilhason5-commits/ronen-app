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
  "מטבח חם": "bg-green-400 text-green-950",
  "מטבח קר": "bg-green-200 text-green-950",
  "אקסטרה": "bg-white text-stone-800",
  "דגים": "bg-rose-300 text-rose-950",
  "קונדיטוריה": "bg-purple-300 text-purple-950",
  "שטיפת סירים": "bg-blue-300 text-blue-950",
};

const FALLBACK_PALETTE = [
  "bg-amber-300 text-amber-950",
  "bg-lime-300 text-lime-950",
  "bg-indigo-300 text-indigo-950",
  "bg-orange-300 text-orange-950",
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sunday (start of week) for the week containing `date`. */
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** The 7 dates (Sun..Sat) of the week starting at `weekStart`. */
export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
}

export function toDateStr(d) {
  return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD, local time (not UTC)
}
