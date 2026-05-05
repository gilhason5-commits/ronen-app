// Parse a text value that may be a single number or range "10-15" — return the max.
export function parseRangeMax(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  if (!str) return 0;
  const range = str.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return Math.max(parseInt(range[1], 10), parseInt(range[2], 10));
  const single = parseInt(str, 10);
  return isNaN(single) ? 0 : single;
}

// guest_count (סה״כ מבוגרים להתחייבות) = total_guests − children_count
// Use this whenever the form needs to derive guest_count from user inputs.
export function calculateAdultCommitment(totalGuests, childrenCount) {
  const total = parseInt(totalGuests, 10) || 0;
  const children = parseInt(childrenCount, 10) || 0;
  const adults = total - children;
  return adults > 0 ? adults : 0;
}

// מנות מבוגר (display only) = guest_count − max(vegan_count) − max(glatt_count)
export function calculateAdultPortions(guestCount, veganCount, glattCount) {
  const adults = parseInt(guestCount, 10) || 0;
  const portions = adults - parseRangeMax(veganCount) - parseRangeMax(glattCount);
  return portions > 0 ? portions : 0;
}
