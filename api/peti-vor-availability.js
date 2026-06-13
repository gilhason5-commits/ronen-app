import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Peti Vor employees work daily recurring tasks rather than per-event. Send a
// standalone availability check at 11:00 with a two-hour window to respond
// — same cadence as the default evening flow. The record is stored with
// event_id = null so the existing inbound webhook and escalation flows know
// to act on recurring tasks rather than event tasks.
const SEND_HHMM = '11:00';
const WINDOW_MIN = 60;
const PV_DEPT_NAME = 'פטי וור';
const PV_LABEL = 'משימות שוטפות פטי וור';

function parseHhmm(s) {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * GET/POST /api/peti-vor-availability  (called via /api/run-all)
 * In the 08:30-09:30 window: every active Peti Vor employee who has at least
 * one PENDING recurring TaskAssignment scheduled today gets an availability
 * check using the existing ARRIVE_TODAY template. Already-sent rows are
 * skipped via a row lookup on (employee_id, event_id=null, event_date).
 */
export default async function handler(req, res) {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const nowHour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
    const nowMin = parseInt(parts.find((p) => p.type === 'minute').value, 10);
    const totalNowMin = nowHour * 60 + nowMin;
    const padded = (n) => String(n).padStart(2, '0');
    const nowIsrael = `${padded(nowHour)}:${padded(nowMin)}`;
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const sendMin = parseHhmm(SEND_HHMM);
    if (totalNowMin < sendMin || totalNowMin > sendMin + WINDOW_MIN) {
      console.log(`peti-vor-availability: skip — outside window (now=${nowIsrael}, target=${SEND_HHMM})`);
      return res.status(200).json({ message: 'Not send time yet', nowIsrael, sendHHMM: SEND_HHMM });
    }

    // Fri (5) / Sat (6) IL: Peti Vor staff don't work, so skip the daily
    // "מגיע היום?" entirely. Sunday's normal 11:00 run handles the next
    // workday's availability check.
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'short',
    }).format(now);
    if (weekday === 'Fri' || weekday === 'Sat') {
      console.log(`peti-vor-availability: skip — ${weekday} IL is a non-workday`);
      return res.status(200).json({ message: 'Non-workday', weekday });
    }

    const { data: pvEmployees, error: empErr } = await supabase
      .from('TaskEmployee')
      .select('id, full_name, phone_e164')
      .eq('is_active', true)
      .eq('whatsapp_enabled', true)
      .eq('department_name', PV_DEPT_NAME);

    // Drop paused employees so we don't pester them while they're off.
    const { data: pauseRows } = await supabase
      .from('AppSetting')
      .select('key')
      .ilike('key', 'paused_employee:%');
    const pausedIds = new Set((pauseRows || []).map((r) => String(r.key).slice('paused_employee:'.length)));

    if (empErr) {
      console.error(`peti-vor-availability: employees query error: ${empErr.message}`);
      return res.status(500).json({ error: empErr.message });
    }
    if (!pvEmployees?.length) {
      console.log('peti-vor-availability: no Peti Vor employees');
      return res.status(200).json({ message: 'No PV employees', sent: 0 });
    }

    // Today's recurring task assignments (no event_id) that are still actionable.
    const dayStart = `${todayStr}T00:00:00`;
    const dayEnd = `${todayStr}T23:59:59`;
    const { data: tasksToday } = await supabase
      .from('TaskAssignment')
      .select('assigned_to_id')
      .is('event_id', null)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .in('status', ['PENDING', 'pending', 'OVERDUE', 'overdue']);

    const empsWithTasks = new Set((tasksToday || []).map((t) => t.assigned_to_id).filter(Boolean));
    if (empsWithTasks.size === 0) {
      console.log('peti-vor-availability: no recurring tasks for today');
      return res.status(200).json({ message: 'No recurring tasks today', sent: 0 });
    }

    let sent = 0;
    let skippedExisting = 0;
    let skippedNoTasks = 0;
    let skippedNoPhone = 0;

    for (const emp of pvEmployees) {
      if (!empsWithTasks.has(emp.id)) { skippedNoTasks++; continue; }
      if (pausedIds.has(emp.id)) { continue; }
      if (!emp.phone_e164) { skippedNoPhone++; continue; }

      const { data: existing } = await supabase
        .from('EmployeeDailyAvailability')
        .select('id')
        .eq('employee_id', emp.id)
        .is('event_id', null)
        .eq('event_date', todayStr)
        .maybeSingle();
      if (existing) { skippedExisting++; continue; }

      try {
        await sendWhatsApp(emp.phone_e164, TEMPLATES.ARRIVE_TODAY, {
          '1': emp.full_name,
          '2': PV_LABEL,
          '3': '',
        });

        await supabase.from('EmployeeDailyAvailability').insert({
          event_id: null,
          employee_id: emp.id,
          employee_name: emp.full_name,
          event_date: todayStr,
          confirmation_status: 'PENDING',
          confirmation_sent_at: new Date().toISOString(),
        });

        sent++;
        console.log(`peti-vor-availability: sent to ${emp.full_name} (${emp.phone_e164})`);
      } catch (err) {
        console.error(`peti-vor-availability: send failed to ${emp.full_name}: ${err.message}`);
        // Persist a NO_RESPONSE marker so we don't retry the same dead number
        // every cron tick for the rest of the morning window.
        try {
          await supabase.from('EmployeeDailyAvailability').insert({
            event_id: null,
            employee_id: emp.id,
            employee_name: emp.full_name,
            event_date: todayStr,
            confirmation_status: 'NO_RESPONSE',
            confirmation_sent_at: new Date().toISOString(),
          });
        } catch (insertErr) {
          console.error(`peti-vor-availability: failed to mark NO_RESPONSE for ${emp.full_name}: ${insertErr.message}`);
        }
      }
    }

    console.log(`peti-vor-availability: done — sent=${sent}, skippedExisting=${skippedExisting}, skippedNoTasks=${skippedNoTasks}, skippedNoPhone=${skippedNoPhone}`);
    return res.status(200).json({ success: true, sent, skippedExisting, skippedNoTasks, skippedNoPhone });
  } catch (err) {
    console.error(`peti-vor-availability: unhandled error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
