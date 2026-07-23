// Staffing standards engine ("ספר התקנים")
// Computes required staffing per event from editable StaffingRule rows,
// and diffs the plan against the requirements to produce red flags.

export const FORMAT_LABELS = {
  serving: 'הגשה',
  flipped: 'הפוכה',
  connected: 'מחוברת',
  party: 'מסיבה',
  tasting: 'טעימות',
};

export const FORMAT_OPTIONS = Object.entries(FORMAT_LABELS).map(([value, label]) => ({ value, label }));

function inRange(rule, guests) {
  if (rule.min_guests != null && guests < rule.min_guests) return false;
  if (rule.max_guests != null && guests > rule.max_guests) return false;
  return true;
}

// Roles that count as "managers" for the flipped-format waiter formula
function countedManagers(requiredRoles, excludeRoles) {
  return requiredRoles
    .filter((r) => !excludeRoles.includes(r.role_name))
    .reduce((sum, r) => sum + r.count, 0);
}

/**
 * Required roles (managers side) for an event: active REQUIRED_ROLE rules
 * whose guest range matches. Returns [{role_name, count, arrival_offset_minutes, explanation}]
 */
export function computeRequiredRoles(event, rules) {
  const guests = Number(event.guest_count) || 0;
  return rules
    .filter((r) => r.is_active && r.rule_type === 'REQUIRED_ROLE' && inRange(r, guests))
    .map((r) => ({
      role_name: r.role_name,
      count: r.quantity || 1,
      arrival_offset_minutes: r.arrival_offset_minutes,
      explanation: r.explanation,
    }));
}

/**
 * Waiter count for an event by its staffing format.
 */
export function computeWaiters(event, rules, requiredRoles) {
  const guests = Number(event.guest_count) || 0;
  const format = event.staffing_format || 'serving';
  const rule = rules.find(
    (r) => r.is_active && r.rule_type === 'WAITER_FORMULA' && r.event_format === format
  );
  if (!rule) return { count: Math.ceil(guests / 10), rule: null };

  const p = rule.params || {};
  let count;
  switch (p.formula) {
    case 'ratio':
      count = Math.ceil(guests / (p.ratio || 10));
      break;
    case 'ratio_plus':
      count = Math.ceil(guests / (p.ratio || 10)) + (p.plus || 0);
      break;
    case 'flipped': {
      const managers = countedManagers(requiredRoles, p.exclude_roles || []);
      count = Math.max(0, Math.ceil(guests / (p.ratio || 10)) - managers);
      break;
    }
    case 'tables': {
      const tables = Number(event.tables_count) || Math.ceil(guests / 10);
      count = tables * (p.per_tables || 1);
      break;
    }
    default:
      count = Math.ceil(guests / 10);
  }
  return { count, rule };
}

/**
 * Ops/cleaning crew: OPS rules matched by range, plus SPECIAL_DAY additions.
 * events: all events that month (needed for "event tomorrow" conditions).
 */
export function computeOps(event, rules, allEvents = []) {
  const guests = Number(event.guest_count) || 0;
  const byRole = new Map();
  for (const r of rules) {
    if (!r.is_active || r.rule_type !== 'OPS' || !inRange(r, guests)) continue;
    // Later (higher min) matching rule for the same role wins
    const prev = byRole.get(r.role_name);
    if (!prev || (r.min_guests || 0) >= (prev.min_guests || 0)) byRole.set(r.role_name, r);
  }
  const ops = [...byRole.values()].map((r) => ({
    role_name: r.role_name,
    count: r.quantity || 1,
    explanation: r.explanation,
  }));

  // Special-day additions
  const day = event.event_date ? new Date(`${event.event_date}T00:00:00`).getDay() : null;
  const extras = [];
  for (const r of rules) {
    if (!r.is_active || r.rule_type !== 'SPECIAL_DAY') continue;
    const p = r.params || {};
    if (p.day != null && day !== p.day) continue;
    if (p.formats && !p.formats.includes(event.staffing_format)) continue;
    if (p.condition === 'event_next_day') {
      const next = new Date(`${event.event_date}T00:00:00`);
      next.setDate(next.getDate() + 1);
      const nextStr = next.toISOString().slice(0, 10);
      if (!allEvents.some((e) => e.event_date === nextStr && e.id !== event.id)) continue;
    }
    extras.push({ role_name: r.role_name, count: r.quantity || 0, explanation: r.explanation, special: true, arrival_offset_minutes: r.arrival_offset_minutes });
  }
  return { ops, extras };
}

/**
 * Split waiters between agencies: fill by sort_order up to each agency cap.
 */
export function computeAgencySplit(waiterCount, agencies) {
  const active = agencies.filter((a) => a.is_active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  let remaining = waiterCount;
  const split = [];
  for (const agency of active) {
    const cap = agency.max_waiters_per_event ?? remaining;
    const take = Math.min(cap, remaining);
    split.push({ agency_id: agency.id, agency_name: agency.name, planned_count: take });
    remaining -= take;
  }
  if (remaining > 0 && split.length) split[split.length - 1].planned_count += remaining;
  return split;
}

/** Arrival schedule: role → arrival time string, derived from event_time + offsets. */
export function computeArrivalSchedule(event, requiredRoles, waitersRule) {
  if (!event.event_time) return [];
  const [h, m] = String(event.event_time).split(':').map(Number);
  if (Number.isNaN(h)) return [];
  const base = h * 60 + (m || 0);
  const fmt = (mins) => {
    const t = ((mins % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };
  const rows = requiredRoles
    .filter((r) => r.arrival_offset_minutes != null)
    .map((r) => ({ role_name: r.role_name, arrival: fmt(base + r.arrival_offset_minutes), offset: r.arrival_offset_minutes }));
  if (waitersRule?.arrival_offset_minutes != null) {
    rows.push({ role_name: 'מלצרים', arrival: fmt(base + waitersRule.arrival_offset_minutes), offset: waitersRule.arrival_offset_minutes });
  }
  return rows.sort((a, b) => a.offset - b.offset);
}

/**
 * Full computation for one event.
 */
export function computeStaffing(event, rules, agencies, allEvents = []) {
  const requiredRoles = computeRequiredRoles(event, rules);
  const { count: waiterCount, rule: waitersRule } = computeWaiters(event, rules, requiredRoles);
  const { ops, extras } = computeOps(event, rules, allEvents);
  const split = computeAgencySplit(waiterCount, agencies);
  const arrivals = computeArrivalSchedule(event, requiredRoles, waitersRule);
  const briefTime = arrivals.find((a) => a.role_name === 'מלצרים')?.arrival || null;
  return { requiredRoles, waiterCount, waitersRule, ops, extras, split, arrivals, briefTime };
}

/**
 * Red flags: diff between requirements and the current plan/splits.
 * planRows: EventStaffingPlan rows of the event; splitRows: EventAgencySplit rows.
 */
export function computeFlags(event, staffing, planRows, splitRows) {
  const flags = [];
  const guests = Number(event.guest_count) || 0;

  for (const req of staffing.requiredRoles) {
    const assigned = planRows.filter((p) => p.role_name === req.role_name && (p.assigned_name || p.assigned_employee_id));
    if (assigned.length < req.count) {
      flags.push({
        severity: 'red',
        role_name: req.role_name,
        message: `חסר ${req.role_name}: ${req.explanation || `נדרש לפי התקן (${guests} סועדים)`}`,
      });
    }
  }

  // Stale assignments — role no longer required but someone is assigned
  const requiredNames = new Set(staffing.requiredRoles.map((r) => r.role_name));
  for (const p of planRows) {
    if ((p.assigned_name || p.assigned_employee_id) && !requiredNames.has(p.role_name)) {
      flags.push({
        severity: 'yellow',
        role_name: p.role_name,
        message: `${p.role_name} משובץ אך לא נדרש לפי התקן הנוכחי (${guests} סועדים)`,
      });
    }
  }

  const plannedWaiters = splitRows.reduce((s, r) => s + (Number(r.planned_count) || 0), 0);
  if (splitRows.length > 0 && plannedWaiters !== staffing.waiterCount) {
    const diff = plannedWaiters - staffing.waiterCount;
    flags.push({
      severity: diff > 0 ? 'yellow' : 'red',
      role_name: 'מלצרים',
      message: diff > 0
        ? `עודף ${diff} מלצרים מול התקן (מתוכנן ${plannedWaiters}, נדרש ${staffing.waiterCount})`
        : `חסרים ${-diff} מלצרים מול התקן (מתוכנן ${plannedWaiters}, נדרש ${staffing.waiterCount})`,
    });
  }

  return flags;
}
