import { supabase } from "@/api/supabaseClient";

// PostgREST silently caps every response at 1000 rows no matter what limit
// the client asks for, so an unbounded "list everything, oldest first" call
// starts dropping the *newest* shifts once the table outgrows that — the
// cells for those dates then fall back to default hours and look unsaved.
// Fetching just the visible month in pages keeps this correct at any size.
const PAGE_SIZE = 1000;

export async function fetchKitchenShifts(fromDate, toDate) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("KitchenShift")
      .select("*")
      .gte("shift_date", fromDate)
      .lte("shift_date", toDate)
      .order("shift_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// One atomic write per (member, date). A plain create-or-update decided from
// the client's cached list races with itself (Tab between the two time
// boxes, a second tab or person, a list that hadn't finished loading) and
// the loser hit the unique constraint, so the edit was silently lost.
export async function saveKitchenShift(row) {
  const { data, error } = await supabase
    .from("KitchenShift")
    .upsert(row, { onConflict: "member_id,shift_date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Same 1000-row API cap applies to the events list, so the monthly tables
// load just the visible month's events instead of "all events, oldest first".
export async function fetchEventsInRange(fromDate, toDate) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("Event")
      .select("*")
      .gte("event_date", fromDate)
      .lte("event_date", toDate)
      .order("event_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Free-text label for a day that has no event (see KitchenDayNote migration).
export async function fetchDayNotes(fromDate, toDate, group) {
  const { data, error } = await supabase
    .from("KitchenDayNote")
    .select("*")
    .eq("roster_group", group)
    .gte("shift_date", fromDate)
    .lte("shift_date", toDate);
  if (error) throw error;
  return data;
}

export async function saveDayNote(row) {
  const { data, error } = await supabase
    .from("KitchenDayNote")
    .upsert(row, { onConflict: "shift_date,roster_group" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
