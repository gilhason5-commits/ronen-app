import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/send-availability  (also called by Vercel Cron)
 * Sends WhatsApp availability requests to all active employees
 * for events happening in the next 3 days.
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

    const { data: events, error: eventsError } = await supabase
      .from('Event')
      .select('*')
      .gte('event_date', today.toISOString().split('T')[0])
      .lte('event_date', in3Days.toISOString().split('T')[0])
      .not('status', 'eq', 'producer_draft');

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return res.status(200).json({ message: 'No upcoming events', sent: 0 });
    }

    // Get all active employees with WhatsApp enabled
    const { data: employees, error: empError } = await supabase
      .from('TaskEmployee')
      .select('*')
      .eq('is_active', true)
      .eq('whatsapp_enabled', true);

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return res.status(200).json({ message: 'No active employees', sent: 0 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

    let sent = 0;
    const results = [];

    for (const event of events) {
      const eventDate = new Date(event.event_date);
      const dateStr = eventDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const dayName = eventDate.toLocaleDateString('he-IL', { weekday: 'long' });

      for (const emp of employees) {
        if (!emp.phone_e164) continue;

        // Check if already sent for this event+employee
        const { data: existing } = await supabase
          .from('EmployeeDailyAvailability')
          .select('id')
          .eq('event_id', event.id)
          .eq('employee_id', emp.id)
          .single();

        if (existing) continue; // already sent

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
                To: `whatsapp:${emp.phone_e164}`,
                Body: message,
              }).toString(),
            }
          );

          const twilioData = await response.json();

          if (response.ok) {
            // Record that we sent the request
            await supabase.from('EmployeeDailyAvailability').insert({
              event_id: event.id,
              employee_id: emp.id,
              employee_name: emp.full_name,
              event_date: event.event_date,
              confirmation_status: 'PENDING',
              confirmation_sent_at: new Date().toISOString(),
            });
            sent++;
            results.push({ employee: emp.full_name, event: event.event_name, status: 'sent' });
          } else {
            results.push({ employee: emp.full_name, event: event.event_name, status: 'failed', error: twilioData.message });
          }
        } catch (err) {
          results.push({ employee: emp.full_name, event: event.event_name, status: 'error', error: err.message });
        }
      }
    }

    return res.status(200).json({ success: true, sent, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
