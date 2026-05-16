import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Morning events (event_time < 14:00) follow a fixed earlier window so the
// 11:00 default doesn't collide with a 11:00 event start. Each event picks
// its own send window based on event_time, and this cron processes the
// events whose window is currently open.
const MORNING_THRESHOLD_HOUR = 14;
const MORNING_SEND_HHMM = '07:30';
const SEND_WINDOW_MIN = 60;

function parseHhmm(s) {
  if (!s) return null;
  const [h, m] = String(s).split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (m || 0);
}

/**
 * GET/POST /api/arrive-today  (Vercel Cron: every 5 minutes)
 * Sends "מגיע היום?" to employees assigned to today's events when the
 * event's send window opens. Morning events (event_time < 14:00) send at
 * 07:30; other events send at the configured availability_send_hour.
 * Skips if already sent today.
 */
export default async function handler(req, res) {
  try {
    // Get configured send hour (used for non-morning events)
    const { data: setting } = await supabase
      .from('AppSetting')
      .select('value')
      .eq('key', 'availability_send_hour')
      .single();

    const eveningSendHHMM = setting?.value || '11:00';

    // Read the current Israel-local hour, minute and date with Intl, which
    // does not depend on the JS runtime's own timezone setting. The previous
    // implementation used `new Date(toLocaleString(...))` which only produced
    // the right values when the host happened to be UTC; if Vercel ever
    // moves a deployment to a non-UTC runtime the window check silently
    // shifts and the cron skips its slot.
    const now = new Date();
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const nowHour = parseInt(timeParts.find((p) => p.type === 'hour').value, 10);
    const nowMin = parseInt(timeParts.find((p) => p.type === 'minute').value, 10);
    const totalNowMin = nowHour * 60 + nowMin;
    const padded = (n) => String(n).padStart(2, '0');
    const nowIsrael = `${padded(nowHour)}:${padded(nowMin)}`;
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const morningSendMin = parseHhmm(MORNING_SEND_HHMM);
    const eveningSendMin = parseHhmm(eveningSendHHMM);
    const inMorningWindow = totalNowMin >= morningSendMin && totalNowMin <= morningSendMin + SEND_WINDOW_MIN;
    const inEveningWindow = totalNowMin >= eveningSendMin && totalNowMin <= eveningSendMin + SEND_WINDOW_MIN;

    if (!inMorningWindow && !inEveningWindow) {
      console.log(`arrive-today: skip — outside any send window (now=${nowIsrael} israel ${todayStr}, morning=${MORNING_SEND_HHMM}, evening=${eveningSendHHMM})`);
      return res.status(200).json({ message: 'Not send time yet', morningSendHHMM: MORNING_SEND_HHMM, eveningSendHHMM, nowIsrael, todayStr });
    }
    console.log(`arrive-today: in ${inMorningWindow ? 'morning' : 'evening'} window (now=${nowIsrael} israel ${todayStr})`);

    // Pull every event for today regardless of status. Earlier this filtered
    // out 'producer_draft', but tasks-scheduler doesn't apply that filter at
    // all — so producer-drafted events were getting their task reminders
    // sent while their employees never received the matching availability
    // check. Match the tasks-scheduler behaviour: if the event is in the
    // table for today, send.
    const { data: allEvents, error: eventsErr } = await supabase
      .from('Event')
      .select('id, event_name, event_date, event_time, status')
      .eq('event_date', todayStr);

    if (eventsErr) {
      console.error(`arrive-today: events query error: ${eventsErr.message}`);
      return res.status(500).json({ error: eventsErr.message });
    }
    if (!allEvents?.length) {
      console.log(`arrive-today: skip — no events for ${todayStr}`);
      return res.status(200).json({ message: 'No events today', sent: 0, todayStr });
    }

    // Only process events whose send window matches the window we're in now.
    // Morning events (event_time < 14:00) belong to the 07:30 window; the
    // rest belong to the evening (configured) window.
    const events = allEvents.filter((ev) => {
      const evMin = parseHhmm(ev.event_time);
      if (evMin === null) return inEveningWindow; // events without a time fall back to evening behaviour
      const isMorning = evMin < MORNING_THRESHOLD_HOUR * 60;
      return (isMorning && inMorningWindow) || (!isMorning && inEveningWindow);
    });

    if (!events.length) {
      console.log(`arrive-today: ${allEvents.length} event(s) today but none match the current window`);
      return res.status(200).json({ message: 'No events match this window', sent: 0, todayStr });
    }
    console.log(`arrive-today: processing ${events.length}/${allEvents.length} event(s) in this window: ${events.map((e) => `${e.event_name} [${e.event_time}]`).join(', ')}`);

    // Get all active employees with WhatsApp
    const { data: employees, error: empErr } = await supabase
      .from('TaskEmployee')
      .select('id, full_name, phone_e164')
      .eq('is_active', true)
      .eq('whatsapp_enabled', true);

    if (empErr) {
      console.error(`arrive-today: employees query error: ${empErr.message}`);
      return res.status(500).json({ error: empErr.message });
    }
    if (!employees?.length) {
      console.log('arrive-today: skip — no active employees with whatsapp_enabled');
      return res.status(200).json({ message: 'No employees', sent: 0 });
    }
    console.log(`arrive-today: ${employees.length} candidate employee(s) with whatsapp_enabled`);

    let sent = 0;
    let skippedExisting = 0;
    let skippedUnassigned = 0;

    for (const event of events) {
      // Get employees assigned to this event's tasks
      const { data: assignments } = await supabase
        .from('TaskAssignment')
        .select('assigned_to_id, assigned_to_name')
        .eq('event_id', event.id);

      const assignedIds = new Set((assignments || []).map(a => a.assigned_to_id).filter(Boolean));
      console.log(`arrive-today: event ${event.event_name} has ${assignedIds.size} assigned employee(s)`);

      for (const emp of employees) {
        if (!assignedIds.has(emp.id)) { skippedUnassigned++; continue; }
        if (!emp.phone_e164) continue;

        // Skip if a row was already created today for this event/employee.
        // Filter by event_date too — a stale record from a previous date
        // for the same event_id (rescheduled event) should not block today's
        // send. maybeSingle is used because .single() errors when 0 rows
        // match, forcing extra error handling for a normal case.
        const { data: existing } = await supabase
          .from('EmployeeDailyAvailability')
          .select('id')
          .eq('event_id', event.id)
          .eq('employee_id', emp.id)
          .eq('event_date', todayStr)
          .maybeSingle();

        if (existing) { skippedExisting++; continue; }

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

    console.log(`arrive-today: done — sent=${sent}, skipped_existing=${skippedExisting}, skipped_unassigned=${skippedUnassigned}`);
    return res.status(200).json({ success: true, sent, skippedExisting, skippedUnassigned });
  } catch (err) {
    console.error(`arrive-today: unhandled error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
