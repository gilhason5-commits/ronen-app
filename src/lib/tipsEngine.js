// Tips distribution engine.
// Input: pool amount, active TipRule rows, and the month's EventShift rows.
// Output: role deductions + per-waiter allocation by actual shifts.

/** Shifts of a month grouped per worker (waiters only participate in the remainder). */
export function summarizeWorkers(shifts) {
  const map = new Map();
  for (const s of shifts) {
    const key = s.worker_id || `name:${s.worker_name}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        worker_name: s.worker_name,
        agency_name: s.agency_name || '',
        shifts: 0,
        runners: 0,
        closings: 0,
      });
    }
    const w = map.get(key);
    w.shifts += 1;
    if (s.is_runner) w.runners += 1;
    if (s.is_closing) w.closings += 1;
  }
  return [...map.values()].sort((a, b) => b.shifts - a.shifts);
}

/**
 * Compute the full monthly distribution.
 * Returns { deductions, perOccurrenceTotal, remainder, perShift, workers }
 */
export function computeTipAllocation(poolAmount, tipRules, shifts) {
  const amount = Number(poolAmount) || 0;
  const active = tipRules.filter((r) => r.is_active);
  const workers = summarizeWorkers(shifts);

  // 1. Role deductions from the pool (percent + fixed)
  const deductions = [];
  let deducted = 0;
  for (const r of active) {
    if (r.rule_type === 'PERCENT') {
      const v = (amount * Number(r.value)) / 100;
      deductions.push({ role_name: r.role_name, type: 'PERCENT', label: `${r.value}%`, amount: v });
      deducted += v;
    } else if (r.rule_type === 'FIXED' && Number(r.value) > 0) {
      deductions.push({ role_name: r.role_name, type: 'FIXED', label: 'פיקס', amount: Number(r.value) });
      deducted += Number(r.value);
    }
  }

  // 2. Per-occurrence additions (runner/closing) from recorded attendance
  const runnerRule = active.find((r) => r.rule_type === 'PER_RUNNER');
  const closingRule = active.find((r) => r.rule_type === 'PER_CLOSING');
  const runnerValue = Number(runnerRule?.value) || 0;
  const closingValue = Number(closingRule?.value) || 0;
  let perOccurrenceTotal = 0;
  for (const w of workers) {
    w.runnerPay = w.runners * runnerValue;
    w.closingPay = w.closings * closingValue;
    perOccurrenceTotal += w.runnerPay + w.closingPay;
  }

  // 3. Remainder split between waiters by actual shifts
  const remainder = Math.max(0, amount - deducted - perOccurrenceTotal);
  const totalShifts = workers.reduce((s, w) => s + w.shifts, 0);
  const perShift = totalShifts > 0 ? remainder / totalShifts : 0;

  for (const w of workers) {
    w.shiftPay = w.shifts * perShift;
    w.total = w.shiftPay + w.runnerPay + w.closingPay;
    w.breakdown = {
      shifts: w.shifts,
      per_shift: perShift,
      shift_pay: w.shiftPay,
      runners: w.runners,
      runner_pay: w.runnerPay,
      closings: w.closings,
      closing_pay: w.closingPay,
    };
  }

  return { deductions, deducted, perOccurrenceTotal, remainder, perShift, totalShifts, workers };
}

export const formatShekel = (n) =>
  `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`;
