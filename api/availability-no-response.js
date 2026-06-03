import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Morning events (event_time < 14:00) get a 1h response window, matching the
// 07:30 send time in arrive-today.js. Other events keep the existing 2h
// window aligned with the configured availability_send_hour.
const MORNING_THRESHOLD_HOUR = 14;
const MORNING_TIMEOUT_MS = 60 * 60 * 1000;
const EVENING_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function parseHhmm(s) {
  if (!s) return null;
  const [h, m] = String(s).split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (m || 0);
}

/**
 * GET/POST /api/availability-no-response  (Vercel Cron: every 5 minutes)
 * Marks PENDING availability as NO_RESPONSE and escalates to office manager.
 * Timeout is 1h for morning events (event_time < 14:00) or 2h otherwise.
 */
export default async function handler(req, res) {
  try {
    const now = Date.now();
    // Fetch with the shorter timeout as the lower bound so morning records
    // become visible at 1h; per-record filtering below enforces the right
    // timeout for each event.
    const earliestCutoff = new Date(now - MORNING_TIMEOUT_MS).toISOString();

    const { data: pending } = await supabase
      .from('EmployeeDailyAvailability')
      .select('*, Event:event_id(event_name, event_time)')
      .eq('confirmation_status', 'PENDING')
      .lt('confirmation_sent_at', earliestCutoff);

    if (!pending?.length) return res.status(200).json({ message: 'No pending records', processed: 0 });

    const ready = pending.filter((record) => {
      // Only morning events (event_time < 14:00) keep the 1h timeout. Peti
      // Vor (event_id IS NULL) and regular evening events both get 2h.
      const evMin = parseHhmm(record.Event?.event_time);
      const isMorning = evMin !== null && evMin < MORNING_THRESHOLD_HOUR * 60;
      const timeoutMs = isMorning ? MORNING_TIMEOUT_MS : EVENING_TIMEOUT_MS;
      const ageMs = now - new Date(record.confirmation_sent_at).getTime();
      return ageMs >= timeoutMs;
    });

    if (!ready.length) return res.status(200).json({ message: 'No records past timeout', processed: 0 });

    let processed = 0;

    for (const record of ready) {
      // Update to NO_RESPONSE
      await supabase
        .from('EmployeeDailyAvailability')
        .update({ confirmation_status: 'NO_RESPONSE' })
        .eq('id', record.id);

      // Find office manager to escalate to
      const { data: managers } = await supabase
        .from('TaskEmployee')
        .select('full_name, phone_e164, role_name')
        .eq('is_active', true)
        .eq('role_name', 'מנהלת משרד');

      const manager = managers?.[0];
      if (manager?.phone_e164) {
        try {
          const ctxName = record.event_id
            ? (record.Event?.event_name || 'אירוע')
            : 'משימות שוטפות פטי וור';
          await sendWhatsApp(manager.phone_e164, TEMPLATES.NO_ANSWER_ESC, {
            '1': record.employee_name,
            '2': ctxName,
            '3': record.Event?.event_time || '',
          });

          await supabase
            .from('EmployeeDailyAvailability')
            .update({ manager_notified_at: new Date().toISOString() })
            .eq('id', record.id);
        } catch (err) {
          console.error(`Failed to escalate for ${record.employee_name}:`, err.message);
        }
      }

      processed++;
    }

    return res.status(200).json({ success: true, processed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
