// Deterministic name -> color mapping so each staff member always renders in
// the same color everywhere their name appears in the staffing map, mirroring
// the color-coded paper roster Ronen's team already works from.
const PALETTE = [
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-900" },
  { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-900" },
  { bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-900" },
  { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-900" },
  { bg: "bg-teal-100", border: "border-teal-300", text: "text-teal-900" },
  { bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-900" },
  { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-900" },
  { bg: "bg-lime-100", border: "border-lime-400", text: "text-lime-900" },
  { bg: "bg-fuchsia-100", border: "border-fuchsia-300", text: "text-fuchsia-900" },
  { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-900" },
  { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-900" },
  { bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-900" },
  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-900" },
  { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-900" },
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Same input always maps to the same palette entry, so a given person keeps
// one color across every row/column/session.
export function getStaffColor(name) {
  if (!name) return null;
  return PALETTE[hashString(String(name).trim()) % PALETTE.length];
}
