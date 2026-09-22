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
export function formatTimeDigits(raw) {
  const trimmed = (raw || "").trim();
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
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
