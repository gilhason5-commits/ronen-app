import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    // Only run within the configured hour (60-minute window since trigger runs hourly)
    const totalNowMin = nowHour * 60 + nowMin;
    const totalTargetMin = targetHour * 60 + targetMin;
    if (Math.abs(totalNowMin - totalTargetMin) > 60) {
      return res.status(200).json({ message: 'Not send time yet', sendHour, nowIsrael: `${nowHour}:${nowMin}` });
    }

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
          console.error(`Failed to send to ${emp.full_name}:`, err.message);
        }
      }
    }

    return res.status(200).json({ success: true, sent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
