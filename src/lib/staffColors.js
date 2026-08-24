// Name -> color mapping for the staffing map, matching Ronen's master Excel
// roster ("סידור עבודה מנהלים ריי") exactly. The workbook has a hidden
// legend row (גיליון1!E25:U25) pairing each first name with its fixed cell
// color; we resolved those (including Excel theme/tint colors) to real hex
// once and hardcoded them here. Anyone not in that legend falls back to an
// auto-generated but still stable color from PALETTE.
const LEGEND = {
  "מייקי": "A6A6A6",
  "לב": "D9D9D9",
  "גליה": "7BD7A5",
  "סשה": "10D2C9",
  "ורוניקה": "009999",
  "סשהי": "63A4F7", // "סשה. י" in the sheet — a different person from plain "סשה"
  "סטיבן": "A3DBFF",
  "מקסים": "BDD7EE",
  "אליה": "8FAADC",
  "שושנה": "76E3FF",
  "מאשה": "C189F7",
  "נועם": "D846C7",
  "ליאם": "F58BDE",
  "טליה": "F896BB",
  "מור": "FFC6C6",
  "אלינה": "F8CBAD",
  "יאנה": "ED7D31",
};
// Backgrounds dark/saturated enough to need white text instead of dark text.
const LIGHT_TEXT_NAMES = new Set(["ורוניקה", "נועם", "יאנה"]);

// Fallback palette for anyone not in the legend above — deterministic by
// name hash so a given person still keeps one color everywhere, it just
// isn't guaranteed to match the Excel exactly.
const PALETTE = [
  { bg: "bg-orange-100", text: "text-orange-900" },
  { bg: "bg-blue-100", text: "text-blue-900" },
  { bg: "bg-pink-100", text: "text-pink-900" },
  { bg: "bg-purple-100", text: "text-purple-900" },
  { bg: "bg-teal-100", text: "text-teal-900" },
  { bg: "bg-yellow-100", text: "text-yellow-900" },
  { bg: "bg-cyan-100", text: "text-cyan-900" },
  { bg: "bg-lime-100", text: "text-lime-900" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-900" },
  { bg: "bg-indigo-100", text: "text-indigo-900" },
  { bg: "bg-rose-100", text: "text-rose-900" },
  { bg: "bg-sky-100", text: "text-sky-900" },
  { bg: "bg-emerald-100", text: "text-emerald-900" },
  { bg: "bg-amber-100", text: "text-amber-900" },
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Strip spaces/periods so "סשה .י", "סשה. י", "סשה י." etc. all normalize
// the same way as the legend key.
function normalize(str) {
  return String(str).replace(/[\s.]/g, "");
}

export function getStaffColor(name) {
  if (!name) return null;
  const trimmed = String(name).trim();
  const firstWord = trimmed.split(/\s+/)[0] || trimmed;

  // "סשה" alone vs "סשה .י" are different people in the legend — the "י"
  // suffix (with or without a separating space/period) picks the latter.
  let legendKey = firstWord;
  if (firstWord === "סשה" && normalize(trimmed).startsWith("סשהי")) {
    legendKey = "סשהי";
  }

  const hex = LEGEND[legendKey];
  if (hex) {
    return {
      className: LIGHT_TEXT_NAMES.has(legendKey) ? "text-white" : "text-stone-900",
      style: { backgroundColor: `#${hex}` },
    };
  }

  const p = PALETTE[hashString(trimmed) % PALETTE.length];
  return { className: `${p.bg} ${p.text}`, style: undefined };
}
