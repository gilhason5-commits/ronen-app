import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Phone numbers to never send to (regardless of TaskEmployee.whatsapp_enabled).
// Used to silence employees whose underlying WhatsApp number is broken until
// the root cause is fixed. Numbers are matched in E.164 form.
const BLOCKED_PHONES = new Set([
  '+972523342321', // Lev — repeated Twilio Failed; investigate before re-enabling
]);

const normalizePhone = (p) => (p ? String(p).replace(/[\s-]/g, '') : '');

/**
 * GET/POST /api/arrive-today  (Vercel Cron: every 5 minutes)
 * At availability_send_hour: sends "מגיע היום?" to employees assigned to today's events.
 * Skips if already sent today.
 */
export default async function handler(req, res) {
  try {
    // Get configured send hour
    const { data: setting } = await supabase
      .from('AppSetting')
      .select('value')
      .eq('key', 'availability_send_hour')
      .single();

    const sendHour = setting?.value || '11:00';
    const [targetHour, targetMin] = sendHour.split(':').map(Number);

    const now = new Date();
    // Convert to Israel timezone for comparison
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const nowHour = israelTime.getHours();
    const nowMin = israelTime.getMinutes();

    // Forward-only window: send only between the configured time and 60
    // minutes after. Sending before the configured time was the bug that
    // had availability checks going out an hour early; the existing-record
    // check below still dedupes any duplicate sends if the cron fires
    // multiple times in the 60-minute window.
    const totalNowMin = nowHour * 60 + nowMin;
    const totalTargetMin = targetHour * 60 + targetMin;
    const padded = (n) => String(n).padStart(2, '0');
    const nowIsrael = `${padded(nowHour)}:${padded(nowMin)}`;
    if (totalNowMin < totalTargetMin || totalNowMin > totalTargetMin + 60) {
      console.log(`arrive-today: skip (now=${nowIsrael} israel, target=${sendHour}, window=[${sendHour}, ${sendHour}+60min])`);
      return res.status(200).json({ message: 'Not send time yet', sendHour, nowIsrael });
    }
    console.log(`arrive-today: in window (now=${nowIsrael} israel, target=${sendHour})`);

    const todayStr = israelTime.toISOString().split('T')[0];

    // Get today's events
    const { data: events } = await supabase
      .from('Event')
      .select('id, event_name, event_date, event_time')
      .eq('event_date', todayStr)
      .not('status', 'eq', 'producer_draft');

    if (!events?.length) return res.status(200).json({ message: 'No events today', sent: 0 });

    // Get all active employees with WhatsApp
    const { data: employees } = await supabase
      .from('TaskEmployee')
      .select('id, full_name, phone_e164')
      .eq('is_active', true)
      .eq('whatsapp_enabled', true);

    if (!employees?.length) return res.status(200).json({ message: 'No employees', sent: 0 });

    let sent = 0;

    for (const event of events) {
      // Get employees assigned to this event's tasks
      const { data: assignments } = await supabase
        .from('TaskAssignment')
        .select('assigned_to_id, assigned_to_name')
        .eq('event_id', event.id);

      const assignedIds = new Set((assignments || []).map(a => a.assigned_to_id).filter(Boolean));

      for (const emp of employees) {
        if (!assignedIds.has(emp.id)) continue;
        if (!emp.phone_e164) continue;
        if (BLOCKED_PHONES.has(normalizePhone(emp.phone_e164))) {
          console.log(`arrive-today: skipping ${emp.full_name} — phone ${emp.phone_e164} is on block list`);
          continue;
        }

        // Skip if already sent today for this event
        const { data: existing } = await supabase
          .from('EmployeeDailyAvailability')
          .select('id')
          .eq('event_id', event.id)
          .eq('employee_id', emp.id)
          .single();

        if (existing) continue;

        try {
          await sendWhatsApp(emp.phone_e164, TEMPLATES.ARRIVE_TODAY, {
            '1': emp.full_name,
            '2': event.event_name || 'אירוע',
            '3': event.event_time || '',
          });

          await supabase.from('EmployeeDailyAvailability').insert({
            event_id: event.id,
            employee_id: emp.id,
            employee_name: emp.full_name,
            event_date: event.event_date,
            confirmation_status: 'PENDING',
            confirmation_sent_at: new Date().toISOString(),
          });

          sent++;
        } catch (err) {
          console.error(`arrive-today: send failed to ${emp.full_name} (${emp.phone_e164}) for event ${event.id}: ${err.message}`);
          // Persist a row so the cron does not keep retrying every 10 minutes
          // for the rest of the window. NO_RESPONSE is used because the
          // existing check constraint does not include a FAILED state and
          // the employee in fact never received a reachable message. The
          // 2-hour no-response escalator only acts on PENDING rows so it
          // will not pile a second alert on top of this. The insert itself
          // is wrapped in try/catch — if it throws (transient DB blip, RLS,
          // constraint, etc.) the next cron run would otherwise see no
          // existing row and retry the same dead number forever.
          try {
            const { error: insertErr } = await supabase
              .from('EmployeeDailyAvailability')
              .insert({
                event_id: event.id,
                employee_id: emp.id,
                employee_name: emp.full_name,
                event_date: event.event_date,
                confirmation_status: 'NO_RESPONSE',
                confirmation_sent_at: new Date().toISOString(),
              });
            if (insertErr) {
              console.error(`arrive-today: failed to persist NO_RESPONSE marker for ${emp.full_name} (event ${event.id}): ${insertErr.message}`);
            } else {
              console.log(`arrive-today: marked ${emp.full_name} as NO_RESPONSE for event ${event.id} (delivery failed, will not retry)`);
            }
          } catch (insertEx) {
            console.error(`arrive-today: exception persisting NO_RESPONSE marker for ${emp.full_name}: ${insertEx.message}`);
          }
        }
      }
    }

    return res.status(200).json({ success: true, sent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
