import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONCURRENCY = 8;

// Some employee records have phone_e164 stored in local format ("0..."),
// which Twilio rejects outright ("not a valid phone number") — the send
// silently never happens for that person. Normalize defensively so a bad
// stored format doesn't drop a real employee from every availability check.
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d+]/g, '');
  if (p.startsWith('0')) p = `+972${p.substring(1)}`;
  if (!p.startsWith('+')) p = `+${p}`;
  return p;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * POST /api/send-availability  (also called by Vercel Cron)
 * Sends WhatsApp availability requests for events happening in the next 3
 * days, to whoever actually has a task on that event — not a blanket
 * broadcast to every active employee, since the check is only relevant to
 * people with something to show up for.
 *
 * Runs the "already sent" lookup as one batched query and fires the Twilio
 * sends with bounded concurrency instead of one employee at a time. The
 * previous fully-sequential version (one dedup query + one Twilio call per
 * employee per event, awaited one by one) could take longer than this
 * project's Vercel Hobby-plan function timeout once there were more than a
 * handful of employees/events, silently cutting the run off partway through
 * — some people got no availability check at all for later events, not
 * because anything failed, but because the function never got to them.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get upcoming events (next 3 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);

    // Include all events regardless of status — once an event is in the
    // table it should be treated identically to any other event, whether
    // it originated from the producer flow or directly. Earlier this
    // excluded 'producer_draft' which kept the matching tasks-scheduler
    // and event UIs out of sync.
    const { data: events, error: eventsError } = await supabase
      .from('Event')
      .select('*')
      .gte('event_date', today.toISOString().split('T')[0])
      .lte('event_date', in3Days.toISOString().split('T')[0]);

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return res.status(200).json({ message: 'No upcoming events', sent: 0 });
    }

    const eventIds = events.map((e) => e.id);

    // Who actually has a task on each event: the primary assignee plus any
    // additional employees on the row.
    const { data: eventTasks, error: tasksError } = await supabase
      .from('TaskAssignment')
      .select('event_id, assigned_to_id, additional_employees')
      .in('event_id', eventIds);

    if (tasksError) throw tasksError;

    const employeeIdsByEvent = {};
    for (const t of eventTasks || []) {
      if (!t.event_id) continue;
      if (!employeeIdsByEvent[t.event_id]) employeeIdsByEvent[t.event_id] = new Set();
      if (t.assigned_to_id) employeeIdsByEvent[t.event_id].add(t.assigned_to_id);
      for (const addEmp of t.additional_employees || []) {
        if (addEmp?.employee_id) employeeIdsByEvent[t.event_id].add(addEmp.employee_id);
      }
    }

    const allEmployeeIds = [...new Set(Object.values(employeeIdsByEvent).flatMap((s) => [...s]))];
    if (allEmployeeIds.length === 0) {
      return res.status(200).json({ message: 'No employees with tasks on upcoming events', sent: 0 });
    }

    const { data: employees, error: empError } = await supabase
      .from('TaskEmployee')
      .select('id, full_name, phone_e164, is_active, whatsapp_enabled')
      .in('id', allEmployeeIds)
      .eq('is_active', true)
      .eq('whatsapp_enabled', true);

    if (empError) throw empError;
    const employeeById = Object.fromEntries((employees || []).map((e) => [e.id, e]));

    // Already-sent (event, employee) pairs, fetched once instead of a
    // per-employee round trip.
    const { data: existingRows, error: existingError } = await supabase
      .from('EmployeeDailyAvailability')
      .select('event_id, employee_id')
      .in('event_id', eventIds);

    if (existingError) throw existingError;
    const alreadySent = new Set((existingRows || []).map((r) => `${r.event_id}__${r.employee_id}`));

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

    const jobs = [];
    for (const event of events) {
      const employeeIds = employeeIdsByEvent[event.id] || new Set();
      for (const empId of employeeIds) {
        const emp = employeeById[empId];
        if (!emp || !emp.phone_e164) continue;
        if (alreadySent.has(`${event.id}__${empId}`)) continue;
        jobs.push({ event, emp });
      }
    }

    let sent = 0;
    const results = await mapWithConcurrency(jobs, CONCURRENCY, async ({ event, emp }) => {
      const eventDate = new Date(event.event_date);
      const dateStr = eventDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const dayName = eventDate.toLocaleDateString('he-IL', { weekday: 'long' });
      const message = `שלום ${emp.full_name} 👋\n\nיש אירוע *${event.event_name || 'אירוע'}* ב${dayName} ${dateStr}${event.event_time ? ` בשעה ${event.event_time}` : ''}.\n\nהאם אתה/את זמין/ה?\nענה *כן* אם זמין/ה\nענה *לא* אם לא זמין/ה`;

      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: fromNumber,
              To: `whatsapp:${normalizePhone(emp.phone_e164)}`,
              Body: message,
            }).toString(),
          }
        );

        const twilioData = await response.json();

        if (response.ok) {
          await supabase.from('EmployeeDailyAvailability').insert({
            event_id: event.id,
            employee_id: emp.id,
            employee_name: emp.full_name,
            event_date: event.event_date,
            confirmation_status: 'PENDING',
            confirmation_sent_at: new Date().toISOString(),
          });
          sent++;
          return { employee: emp.full_name, event: event.event_name, status: 'sent' };
        }
        return { employee: emp.full_name, event: event.event_name, status: 'failed', error: twilioData.message };
      } catch (err) {
        return { employee: emp.full_name, event: event.event_name, status: 'error', error: err.message };
      }
    });

    return res.status(200).json({ success: true, sent, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
