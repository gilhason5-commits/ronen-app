// Station -> color mapping for the kitchen/cleaning weekly schedule, matching
// the color-coded paper sheet Ronen's team already uses (green = hot
// kitchen, light green = cold kitchen, pink = fish, purple = patisserie,
// blue = pot washing...). A station typed in fresh via the roster UI that
// isn't in this fixed list falls back to a stable hash-based color so it
// still reads consistently without needing a code change.
const STATION_COLORS = {
  "מטבח חם": { header: "bg-emerald-700 text-white", row: "bg-emerald-600 text-white" },
  "מטבח קר": { header: "bg-emerald-300 text-emerald-950", row: "bg-emerald-200 text-emerald-950" },
  "אקסטרה": { header: "bg-stone-200 text-stone-800", row: "bg-white text-stone-800" },
  "דגים": { header: "bg-rose-300 text-rose-950", row: "bg-rose-200 text-rose-950" },
  "קונדיטוריה": { header: "bg-purple-300 text-purple-950", row: "bg-purple-200 text-purple-950" },
  "שטיפת סירים": { header: "bg-sky-300 text-sky-950", row: "bg-sky-200 text-sky-950" },
};

const FALLBACK_PALETTE = [
  { header: "bg-amber-300 text-amber-950", row: "bg-amber-200 text-amber-950" },
  { header: "bg-lime-300 text-lime-950", row: "bg-lime-200 text-lime-950" },
  { header: "bg-indigo-300 text-indigo-950", row: "bg-indigo-200 text-indigo-950" },
  { header: "bg-orange-300 text-orange-950", row: "bg-orange-200 text-orange-950" },
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

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
